// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NFEGovernance
 * @notice Standalone timelock-based governance for the NFE Global smart contract.
 *
 * Architecture (three-phase migration):
 *   Phase 1 — Owner (EOA) is the initial governor.
 *   Phase 2 — Owner calls migrateGovernor() to hand control to a 3-of-5 multisig.
 *   Phase 3 — Multisig calls migrateGovernor() to hand control to a DAO contract.
 *
 * All critical parameter changes must go through a 7-day timelock proposal lifecycle:
 *   propose() → (7 days pass) → execute()   (or cancel() at any time before execution)
 *
 * Emergency sweep of dormant node treasuries (inactive > dormancyPeriod) can be
 * batched and called by anyone — it only calls the governor-gated sweepDormantTreasury()
 * on the core contract.  No timelock is required for dormancy sweeps because the
 * dormancyPeriod itself is the protective delay.
 */

interface INFEGlobal {
    // Governance setters
    function setGovernor(address _gov)            external;
    function sweepDormantTreasury(uint _nodeId)   external;
    function setDormancyPeriod(uint _period)      external;
    function setDormancyDistribution(uint _rpBP, uint _daoBP, uint _feeBP) external;
    function setDaoTreasury(address _dao)         external;

    // Existing admin setters (type-coded)
    function setAddr(uint _type, address _new, uint _num) external;
    function setRegistrationFeeUSD(uint256 newFee)        external;
    function setAutoBatch(uint _batch)                    external;
    function transferOwnership(address _newOwner)         external;

    // State readers
    function lastTreasuryActivity(uint nodeId) external view returns (uint256);
    function treasuryBalance(uint nodeId)      external view returns (uint256);
    function dormancyPeriod()                  external view returns (uint256);
}

contract NFEGovernance {

    // =========================================================================
    // Constants
    // =========================================================================

    uint256 public constant TIMELOCK_DELAY    = 7 days;
    uint256 public constant MAX_DORMANT_BATCH = 20;   // max nodes per dormancy sweep call

    // =========================================================================
    // State
    // =========================================================================

    address public nfe;       // Core NFEGlobal contract
    address public governor;  // Current governor (owner / multisig / DAO)

    // Proposal storage
    struct Proposal {
        address target;       // Contract to call
        bytes   data;         // Encoded call data
        uint256 eta;          // Earliest execution timestamp
        bool    executed;
        bool    cancelled;
        string  description;
    }

    mapping(bytes32 => Proposal) public proposals;
    bytes32[] public proposalIds; // for off-chain enumeration

    // =========================================================================
    // Events
    // =========================================================================

    event ProposalCreated(
        bytes32 indexed proposalId,
        address indexed target,
        bytes           data,
        uint256         eta,
        string          description
    );
    event ProposalExecuted(bytes32 indexed proposalId);
    event ProposalCancelled(bytes32 indexed proposalId);
    event GovernorMigrated(address indexed oldGovernor, address indexed newGovernor);
    event DormancySwept(uint indexed nodeId, address indexed caller);

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyGovernor() {
        require(msg.sender == governor, "NFEGov: not governor");
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param _nfe      Address of the deployed nfeglobal contract.
     * @param _governor Initial governor (deployer / owner EOA).
     */
    constructor(address _nfe, address _governor) {
        require(_nfe      != address(0), "Zero nfe");
        require(_governor != address(0), "Zero governor");
        nfe      = _nfe;
        governor = _governor;
    }

    // =========================================================================
    // Governor migration (one-way per step, fully auditable via events)
    // =========================================================================

    /**
     * @notice Transfer governance to a new address (multisig, DAO, etc.).
     *         This is irreversible from the old governor's perspective.
     *         The new governor must accept responsibility before this is called.
     * @param _newGovernor  Address of the new governor.
     */
    function migrateGovernor(address _newGovernor) external onlyGovernor {
        require(_newGovernor != address(0), "Zero address");
        require(_newGovernor != governor,   "Same governor");
        address old = governor;
        governor = _newGovernor;
        // Also update the governor slot on the core contract so it recognises the new governor
        INFEGlobal(nfe).setGovernor(_newGovernor);
        emit GovernorMigrated(old, _newGovernor);
    }

    // =========================================================================
    // Timelock proposal lifecycle
    // =========================================================================

    /**
     * @dev Internal proposal creation shared by propose() and all convenience builders.
     */
    function _propose(
        address _target,
        bytes memory _data,
        string memory _description
    ) internal returns (bytes32 proposalId) {
        require(_target != address(0), "Zero target");

        proposalId = keccak256(
            abi.encodePacked(_target, _data, block.timestamp, _description)
        );
        require(proposals[proposalId].eta == 0, "Proposal exists");

        uint256 eta = block.timestamp + TIMELOCK_DELAY;
        proposals[proposalId] = Proposal({
            target:      _target,
            data:        _data,
            eta:         eta,
            executed:    false,
            cancelled:   false,
            description: _description
        });
        proposalIds.push(proposalId);

        emit ProposalCreated(proposalId, _target, _data, eta, _description);
    }

    /**
     * @notice Create a new governance proposal with a 7-day timelock.
     * @param _target      Contract to call on execution.
     * @param _data        ABI-encoded call data.
     * @param _description Human-readable description.
     * @return proposalId  Unique identifier (keccak256 hash).
     */
    function propose(
        address _target,
        bytes calldata _data,
        string calldata _description
    ) external onlyGovernor returns (bytes32 proposalId) {
        return _propose(_target, _data, _description);
    }

    /**
     * @notice Execute a matured proposal.
     * @param _proposalId  The proposal identifier returned by propose().
     */
    function execute(bytes32 _proposalId) external onlyGovernor {
        Proposal storage p = proposals[_proposalId];
        require(p.eta != 0,            "Unknown proposal");
        require(!p.executed,           "Already executed");
        require(!p.cancelled,          "Cancelled");
        require(block.timestamp >= p.eta, "Timelock not expired");

        p.executed = true;
        (bool ok, bytes memory reason) = p.target.call(p.data);
        require(ok, string(reason));

        emit ProposalExecuted(_proposalId);
    }

    /**
     * @notice Cancel a pending proposal before it is executed.
     * @param _proposalId  The proposal identifier.
     */
    function cancel(bytes32 _proposalId) external onlyGovernor {
        Proposal storage p = proposals[_proposalId];
        require(p.eta != 0,   "Unknown proposal");
        require(!p.executed,  "Already executed");
        require(!p.cancelled, "Already cancelled");

        p.cancelled = true;
        emit ProposalCancelled(_proposalId);
    }

    // =========================================================================
    // Convenience proposal builders
    // Wrappers that encode and submit proposals for common governance actions.
    // =========================================================================

    function proposeSetDormancyPeriod(uint _period, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.setDormancyPeriod.selector, _period),
            _desc
        );
    }

    function proposeSetDormancyDistribution(
        uint _rpBP, uint _daoBP, uint _feeBP, string calldata _desc
    ) external onlyGovernor returns (bytes32) {
        return _propose(
            nfe,
            abi.encodeWithSelector(
                INFEGlobal.setDormancyDistribution.selector, _rpBP, _daoBP, _feeBP
            ),
            _desc
        );
    }

    function proposeSetDaoTreasury(address _dao, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.setDaoTreasury.selector, _dao),
            _desc
        );
    }

    function proposeSetFeeReceiver(address _new, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        // setAddr type 0 = feeReceiver
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.setAddr.selector, uint(0), _new, uint(0)),
            _desc
        );
    }

    function proposeSetRewardPool(address _new, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        // setAddr type 1 = rewardPool
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.setAddr.selector, uint(1), _new, uint(0)),
            _desc
        );
    }

    function proposeSetOracleFeed(address _feed, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        // setAddr type 11 = priceFeed
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.setAddr.selector, uint(11), _feed, uint(0)),
            _desc
        );
    }

    function proposeSetMaxMatrixDepth(uint _depth, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        // setAddr type 6 = maxMatrixDepth (num param used)
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.setAddr.selector, uint(6), address(0), _depth),
            _desc
        );
    }

    function proposeSetRegistrationFee(uint256 _fee, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.setRegistrationFeeUSD.selector, _fee),
            _desc
        );
    }

    function proposeSetAutoBatch(uint _batch, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.setAutoBatch.selector, _batch),
            _desc
        );
    }

    function proposeTransferCoreOwnership(address _newOwner, string calldata _desc)
        external onlyGovernor returns (bytes32)
    {
        return _propose(
            nfe,
            abi.encodeWithSelector(INFEGlobal.transferOwnership.selector, _newOwner),
            _desc
        );
    }

    // =========================================================================
    // Dormancy sweep (no timelock — dormancyPeriod is the guard)
    // =========================================================================

    /**
     * @notice Batch-sweep dormant node treasuries.
     *         Callable by anyone. Reverts silently per node (continues batch).
     *         Max 20 nodes per call to bound gas usage.
     * @param _nodeIds  Array of node IDs to check and sweep.
     */
    function processDormantNodes(uint256[] calldata _nodeIds) external {
        require(_nodeIds.length <= MAX_DORMANT_BATCH, "Batch too large");
        INFEGlobal core = INFEGlobal(nfe);
        uint256 dormPeriod = core.dormancyPeriod();

        for (uint256 i = 0; i < _nodeIds.length; i++) {
            uint256 nodeId_ = _nodeIds[i];
            // Root node (defaultRefer / 55555) is permanently exempt
            if (nodeId_ == 55555) continue;
            // Skip if no treasury or not yet dormant — avoid reverting entire batch
            if (core.treasuryBalance(nodeId_) == 0) continue;
            if (block.timestamp - core.lastTreasuryActivity(nodeId_) < dormPeriod) continue;


            // Governor-gated call on core contract — this contract IS the governor
            try core.sweepDormantTreasury(nodeId_) {
                emit DormancySwept(nodeId_, msg.sender);
            } catch {
                // Silently skip failed sweeps (e.g. already swept by another tx)
            }
        }
    }

    // =========================================================================
    // View helpers
    // =========================================================================

    /**
     * @notice Returns full proposal data by ID.
     */
    function getProposal(bytes32 _id) external view returns (Proposal memory) {
        return proposals[_id];
    }

    /**
     * @notice Total number of proposals submitted (for pagination).
     */
    function proposalCount() external view returns (uint256) {
        return proposalIds.length;
    }

    /**
     * @notice Check if a proposal is ready to execute.
     */
    function isReady(bytes32 _id) external view returns (bool) {
        Proposal storage p = proposals[_id];
        return (
            p.eta != 0 &&
            !p.executed &&
            !p.cancelled &&
            block.timestamp >= p.eta
        );
    }
}
