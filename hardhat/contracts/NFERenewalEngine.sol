// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =============================================================================
//  NFERenewalEngine.sol — Annual Subscription Renewal
//
//  Executes node renewals using a 3-priority funding system:
//    Priority 1: Deduct from node's treasury balance (core)
//    Priority 2: Deduct from node's vested vault balance
//    Priority 3: Accept wallet payment (msg.value)
//
//  On successful renewal:
//    - Calls core.distributeRenewal(nodeId, cost) to run full distribution
//      (Direct 10% + Layer rewards 15%x10 + Matrix + RewardPool 5%)
//    - Activates the node in NFECycleManager for another full cycle
//
//  Renewal Cost = Tier-1 upgrade price (getTierCost(TIER_1_INDEX)).
//  Rationale: Tier-0 (node.tier == 0) is the FREE REGISTRATION state on the
//  main tree — it has no renewal-economy meaning. Tier-1 is the first REAL
//  paid upgrade and anchors the annual renewal subscription cost.
//
//  Genesis node (55555) is ALWAYS exempt — cannot be renewed, always active.
//  Vested rewards are ALWAYS claimable regardless of renewal status.
// =============================================================================

import "./NFEInterfaces.sol";

/**
 * @title NFERenewalEngine
 * @author NFEGlobal ICE Team
 * @notice Manages the annual renewal process for NFEGlobal ICE nodes.
 *
 * @dev Funding priority:
 *      1. Core treasury balance (free for the user — already in the system)
 *      2. Vested vault balance (deducted from vault, vault sends BNB here)
 *      3. Direct wallet payment via msg.value
 *
 *      Renewal cost = getTierCost(TIER_1_INDEX) = Tier-1 live oracle price.
 *      ─────────────────────────────────────────────────────────────────────
 *      Tier index mapping in nfeglobal.sol (0-indexed getTierCost array):
 *        index 0  →  cost to go from node.tier=0 → node.tier=1  (= Tier-1 price)
 *        index 1  →  cost to go from node.tier=1 → node.tier=2  (= Tier-2 price)
 *        ...
 *      node.tier == 0 is the FREE REGISTRATION STATE (T0) — no purchase, tree-only.
 *      Therefore TIER_1_INDEX = 0 gives us the first real paid tier cost.
 */

contract NFERenewalEngine is IRenewalEngine {

    // =========================================================================
    // Reentrancy Guard
    // =========================================================================

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;
    uint256 private _status;

    modifier nonReentrant() {
        require(_status != _ENTERED, "NFERenewalEngine: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // =========================================================================
    // Constants
    // =========================================================================

    uint256 public constant GENESIS_NODE_ID = 55555;

    /// @notice The 0-based array index in getTierCost() that returns the Tier-1 price.
    ///         node.tier == 0 is the free registration state (T0) — no cost, tree only.
    ///         Tier-1 (first real paid upgrade) lives at getTierCost(TIER_1_INDEX).
    uint256 public constant TIER_1_INDEX = 0;

    // =========================================================================
    // State
    // =========================================================================

    address public owner;
    address public core;          // nfeglobal.sol
    address public vestingVault;  // NFEVestingVault.sol
    address public cycleManager;  // NFECycleManager.sol

    /// @notice Whether renewals are currently enabled
    bool public renewalsEnabled = true;

    /// @notice Total renewals processed
    uint256 public totalRenewals;

    /// @notice Maps nodeId => last renewal timestamp
    mapping(uint256 => uint256) public lastRenewalTime;

    /// @notice Maps nodeId => total renewal count
    mapping(uint256 => uint256) public renewalCount;

    // =========================================================================
    // Events
    // =========================================================================

    event Renewed(
        uint256 indexed nodeId,
        address indexed renewedBy,
        uint256 cost,
        uint8   fundingSource, // 1=treasury, 2=vault, 3=wallet, 4=mixed
        uint256 timestamp
    );
    event RenewalFailed(uint256 indexed nodeId, string reason);
    event CoreUpdated(address indexed oldCore, address indexed newCore);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event CycleManagerUpdated(address indexed oldCM, address indexed newCM);
    event RenewalsToggled(bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "NFERenewalEngine: not owner");
        _;
    }

    modifier renewalsActive() {
        require(renewalsEnabled, "NFERenewalEngine: renewals disabled");
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        address _owner,
        address _core,
        address _vestingVault,
        address _cycleManager
    ) {
        require(_owner        != address(0), "NFERenewalEngine: zero owner");
        require(_core         != address(0), "NFERenewalEngine: zero core");
        require(_vestingVault != address(0), "NFERenewalEngine: zero vault");
        require(_cycleManager != address(0), "NFERenewalEngine: zero cycleManager");

        owner        = _owner;
        core         = _core;
        vestingVault = _vestingVault;
        cycleManager = _cycleManager;
        _status      = _NOT_ENTERED;
    }

    receive() external payable {}

    // =========================================================================
    // IRenewalEngine Implementation
    // =========================================================================

    /**
     * @notice Get the current annual renewal cost in native BNB.
     * @dev    Returns the live oracle Tier-1 price: getTierCost(TIER_1_INDEX).
     *         T0 (node.tier == 0) is the FREE registration state on the main tree
     *         and is NOT used as a renewal cost. T1 is the anchor for subscriptions.
     * @return cost  BNB required for one full renewal cycle.
     */
    function getRenewalCost() public view override returns (uint256) {
        // TIER_1_INDEX = 0: the 0-based index of the Tier-1 upgrade cost in core.
        // T0 is registration-only (free on the main tree), so we use index 0 = T1.
        return ICoreEngine(core).getTierCost(TIER_1_INDEX);
    }

    /**
     * @notice Renew a node's subscription. Callable by anyone (node owner or keeper).
     * @dev Implements the 3-priority funding system. Excess msg.value is refunded.
     *      A node can renew even while still active (early renewal extends from now).
     * @param nodeId  The node to renew.
     */
    function renewFor(uint256 nodeId) external payable override nonReentrant renewalsActive {
        require(nodeId != GENESIS_NODE_ID, "NFERenewalEngine: genesis is exempt");
        require(nodeId != 0, "NFERenewalEngine: invalid nodeId");

        address wallet = ICoreEngine(core).getNodeWallet(nodeId);
        require(wallet != address(0), "NFERenewalEngine: node does not exist");

        uint256 cost = getRenewalCost();
        require(cost > 0, "NFERenewalEngine: zero cost");

        // ── Priority 1: Core Treasury Balance ─────────────────────────────
        uint256 treasuryBal = ICoreEngine(core).treasuryBalance(nodeId);
        uint256 fromTreasury = 0;
        uint256 remaining    = cost;

        if (treasuryBal >= remaining) {
            fromTreasury = remaining;
            remaining    = 0;
        } else if (treasuryBal > 0) {
            fromTreasury = treasuryBal;
            remaining   -= treasuryBal;
        }

        // ── Priority 2: Vested Vault Balance ──────────────────────────────
        uint256 fromVault = 0;
        if (remaining > 0) {
            uint256 vaultBal = IVestingVault(vestingVault).getVestedBalance(nodeId);
            if (vaultBal >= remaining) {
                fromVault = remaining;
                remaining = 0;
            } else if (vaultBal > 0) {
                fromVault = vaultBal;
                remaining -= vaultBal;
            }
        }

        // ── Priority 3: Wallet Payment ─────────────────────────────────────
        uint256 fromWallet = 0;
        if (remaining > 0) {
            require(msg.value >= remaining, "NFERenewalEngine: insufficient payment");
            fromWallet = remaining;
            remaining  = 0;
        }

        // Refund excess msg.value
        if (msg.value > fromWallet) {
            uint256 excess = msg.value - fromWallet;
            (bool refundOk, ) = payable(msg.sender).call{value: excess}("");
            require(refundOk, "NFERenewalEngine: refund failed");
        }

        // ── Execute Funding ────────────────────────────────────────────────
        // Deduct treasury (Effects on core)
        if (fromTreasury > 0) {
            ICoreEngine(core).deductTreasury(nodeId, fromTreasury);
        }

        // Deduct vault — vault sends BNB to this contract
        if (fromVault > 0) {
            IVestingVault(vestingVault).deductVested(nodeId, fromVault);
        }

        // Now this contract holds: fromVault (from vault) + fromWallet (from msg.value)
        uint256 totalBNBHere = fromVault + fromWallet;

        // ── Distribute Renewal ─────────────────────────────────────────────
        // Call core.distributeRenewal with the BNB we hold
        // Treasury portion was already deducted from core state — core handles it internally
        ICoreEngine(core).distributeRenewal{value: totalBNBHere}(nodeId, cost);

        // ── Activate in CycleManager ───────────────────────────────────────
        uint32 cycleId = ICycleManager(cycleManager).currentCycle();
        ICycleManager(cycleManager).activateNode(nodeId, cycleId);

        // ── State Updates ──────────────────────────────────────────────────
        lastRenewalTime[nodeId] = block.timestamp;
        renewalCount[nodeId]   += 1;
        totalRenewals          += 1;

        // Determine funding source label
        uint8 source;
        if (fromTreasury == cost) source = 1;
        else if (fromVault == cost) source = 2;
        else if (fromWallet == cost) source = 3;
        else source = 4; // mixed

        emit Renewed(nodeId, msg.sender, cost, source, block.timestamp);
    }

    /**
     * @notice Convenience: renew your own node.
     * @dev Looks up the caller's nodeId from core. Excess value is refunded.
     */
    function renew() external payable nonReentrant renewalsActive {
        uint256 nodeId = ICoreEngine(core).nodeId(msg.sender);
        require(nodeId != 0, "NFERenewalEngine: caller has no node");
        require(nodeId != GENESIS_NODE_ID, "NFERenewalEngine: genesis exempt");

        // Re-use renewFor logic by delegating via internal call
        // We pass msg.value through — duplicate reentrancy guard would block us,
        // so we implement inline here.

        address wallet = ICoreEngine(core).getNodeWallet(nodeId);
        require(wallet != address(0), "NFERenewalEngine: node does not exist");

        uint256 cost = getRenewalCost();
        require(cost > 0, "NFERenewalEngine: zero cost");

        uint256 treasuryBal  = ICoreEngine(core).treasuryBalance(nodeId);
        uint256 fromTreasury = 0;
        uint256 remaining    = cost;

        if (treasuryBal >= remaining) {
            fromTreasury = remaining;
            remaining    = 0;
        } else if (treasuryBal > 0) {
            fromTreasury = treasuryBal;
            remaining   -= treasuryBal;
        }

        uint256 fromVault = 0;
        if (remaining > 0) {
            uint256 vaultBal = IVestingVault(vestingVault).getVestedBalance(nodeId);
            if (vaultBal >= remaining) {
                fromVault = remaining;
                remaining = 0;
            } else if (vaultBal > 0) {
                fromVault = vaultBal;
                remaining -= vaultBal;
            }
        }

        uint256 fromWallet = 0;
        if (remaining > 0) {
            require(msg.value >= remaining, "NFERenewalEngine: insufficient payment");
            fromWallet = remaining;
            remaining  = 0;
        }

        if (msg.value > fromWallet) {
            uint256 excess = msg.value - fromWallet;
            (bool refundOk, ) = payable(msg.sender).call{value: excess}("");
            require(refundOk, "NFERenewalEngine: refund failed");
        }

        if (fromTreasury > 0) {
            ICoreEngine(core).deductTreasury(nodeId, fromTreasury);
        }

        if (fromVault > 0) {
            IVestingVault(vestingVault).deductVested(nodeId, fromVault);
        }

        uint256 totalBNBHere = fromVault + fromWallet;
        ICoreEngine(core).distributeRenewal{value: totalBNBHere}(nodeId, cost);

        uint32 cycleId = ICycleManager(cycleManager).currentCycle();
        ICycleManager(cycleManager).activateNode(nodeId, cycleId);

        lastRenewalTime[nodeId] = block.timestamp;
        renewalCount[nodeId]   += 1;
        totalRenewals          += 1;

        uint8 source;
        if (fromTreasury == cost) source = 1;
        else if (fromVault == cost) source = 2;
        else if (fromWallet == cost) source = 3;
        else source = 4;

        emit Renewed(nodeId, msg.sender, cost, source, block.timestamp);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get the renewal status and funding breakdown for a node.
     * @return isActive       Whether the node is currently active.
     * @return cost           Current renewal cost.
     * @return treasuryBal   Treasury available for renewal.
     * @return vaultBal      Vault (vested) available for renewal.
     * @return walletNeeded  BNB needed from wallet (after treasury+vault).
     * @return lastRenewed   Timestamp of last renewal.
     * @return renewals      Total renewal count.
     */
    function getRenewalStatus(uint256 nodeId) external view returns (
        bool   isActive,
        uint256 cost,
        uint256 treasuryBal,
        uint256 vaultBal,
        uint256 walletNeeded,
        uint256 lastRenewed,
        uint256 renewals
    ) {
        isActive    = ICycleManager(cycleManager).isActive(nodeId);
        cost        = getRenewalCost();
        treasuryBal = ICoreEngine(core).treasuryBalance(nodeId);
        vaultBal    = IVestingVault(vestingVault).getVestedBalance(nodeId);

        uint256 remaining = cost;
        if (treasuryBal >= remaining) {
            remaining = 0;
        } else {
            remaining -= treasuryBal > remaining ? remaining : treasuryBal;
        }
        if (vaultBal >= remaining) {
            remaining = 0;
        } else {
            remaining -= vaultBal > remaining ? remaining : vaultBal;
        }

        walletNeeded = remaining;
        lastRenewed  = lastRenewalTime[nodeId];
        renewals     = renewalCount[nodeId];
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Set the core contract address.
     */
    function setCore(address _core) external onlyOwner {
        require(_core != address(0), "NFERenewalEngine: zero address");
        address old = core;
        core = _core;
        emit CoreUpdated(old, _core);
    }

    /**
     * @notice Set the vesting vault address.
     */
    function setVestingVault(address _vault) external onlyOwner {
        require(_vault != address(0), "NFERenewalEngine: zero address");
        address old = vestingVault;
        vestingVault = _vault;
        emit VaultUpdated(old, _vault);
    }

    /**
     * @notice Set the cycle manager address.
     */
    function setCycleManager(address _cm) external onlyOwner {
        require(_cm != address(0), "NFERenewalEngine: zero address");
        address old = cycleManager;
        cycleManager = _cm;
        emit CycleManagerUpdated(old, _cm);
    }

    /**
     * @notice Enable or disable renewals (emergency pause).
     */
    function setRenewalsEnabled(bool _enabled) external onlyOwner {
        renewalsEnabled = _enabled;
        emit RenewalsToggled(_enabled);
    }

    /**
     * @notice Transfer ownership.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "NFERenewalEngine: zero address");
        address old = owner;
        owner = _newOwner;
        emit OwnershipTransferred(old, _newOwner);
    }
}
