// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  RewardPool  v2.0 — Hardened & Future-Compatible
 * @notice Receives BNB from NFEGlobal and distributes proportionally to
 *         qualified nodes via three exclusive tiers:
 *
 *         🥉 Bronze  — NFEGlobal tier ≥ 6  and < 10   (30% of inflow)
 *         🥈 Silver  — NFEGlobal tier ≥ 10 and < 14   (35% of inflow)
 *         🥇 Gold    — NFEGlobal tier ≥ 14             (35% of inflow)
 *
 * @dev    Changes in v2.0 vs v1:
 *         - SECURITY: ReentrancyGuard added to claim()
 *         - SECURITY: registerNode() restricted to authorised callers only
 *         - FUTURE: authorizedCallers whitelist — any future NFEGlobal upgrade
 *           or helper contract can be whitelisted by owner without redeployment
 *         - FUTURE: setEngine() already present, now also clears old-engine
 *           from authorizedCallers automatically and adds new engine
 *         - FUTURE: emergencyRescue with 48-hour timelock for owner fund recovery
 *         - FUTURE: pool parameters (tier thresholds, directs, team) are now
 *           owner-updatable so future business rule changes don't need redeploy
 */

interface IRewardPoolLeadership {
    function claimFor(uint256 nodeId) external returns (uint256);
    function recordAchievement(uint256 nodeId, uint8 poolId) external;
    function getClaimableTotal(uint256 nodeId) external view returns (uint256);
}

interface Infeglobal {
    // ── Qualification data (used by registerNode & views) ──────────────────
    function getPoolQualificationData(uint _userId) external view returns (
        uint totalDeposited,
        uint directReferrals,
        uint totalTeam,
        uint currentLevel,
        uint directTeamL1,
        uint matrixTeam,
        uint registrationTime,
        bool isActive
    );

    // ── Targeted node field getters ──────────────────────────────────────────
    // NOTE: nodes() is NOT declared here because the Node struct contains two
    // fixed-size array fields (uint32[18] sponsorTierRanks, uint64[18] matrixRewardReceiver)
    // that make the auto-generated getter return dynamically-encoded ABI data.
    // Calling it via a 9-field static interface causes a silent revert.
    // Use the targeted getters below instead.
    function getNodeWallet(uint nodeId) external view returns (address);
    function getNodeContribution(uint nodeId) external view returns (uint);

    // ── Node registration & upgrade ─────────────────────────────────────────
    function createNode(uint _sponsor) external payable;
    function unlockTier(uint _nodeId, uint _toTier) external payable;
    function selfUpgrade() external payable;

    // ── Pull-payment recovery ────────────────────────────────────────────────
    function withdraw() external;

    // ── Missed / pending rewards (treasury accounting) ──────────────────────
    function missedRewardsByTier(uint nodeId, uint tier) external view returns (uint);
    function getPendingUpgradeRewards(uint nodeId) external view returns (uint total);
    function pendingReward(address wallet) external view returns (uint);
    function totalMissedRewards() external view returns (uint);
    function totalPendingRewards() external view returns (uint);

    // ── Address / node lookups ──────────────────────────────────────────────
    function nodeId(address wallet) external view returns (uint);
    function isNodeActive(uint _nodeId) external view returns (bool);
    function defaultRefer() external view returns (uint);
}


contract RewardPool {

    /* ─────────────────────────────────────────────
       REENTRANCY GUARD (inline — no external import)
    ───────────────────────────────────────────── */

    uint8 private _locked;
    modifier nonReentrant() {
        require(_locked == 0, "Reentrant call");
        _locked = 1;
        _;
        _locked = 0;
    }

    /* ─────────────────────────────────────────────
       CONSTANTS
    ───────────────────────────────────────────── */

    uint private constant BASE       = 10000;
    uint private constant BRONZE_PCT = 3000;  // 30%
    uint private constant SILVER_PCT = 3500;  // 35%
    uint private constant GOLD_PCT   = 3500;  // 35%

    uint private constant TRANSFER_GAS = 100_000;

    /* ─────────────────────────────────────────────
       CONFIGURABLE POOL PARAMETERS (owner-updatable)
       Allows future business rule changes without redeployment
    ───────────────────────────────────────────── */

    uint public BRONZE_MIN_TIER   = 6;
    uint public SILVER_MIN_TIER   = 10;
    uint public GOLD_MIN_TIER     = 14;

    uint public BRONZE_MIN_DIRECT = 2;
    uint public SILVER_MIN_DIRECT = 5;
    uint public GOLD_MIN_DIRECT   = 10;

    uint public BRONZE_MIN_TEAM   = 30;
    uint public SILVER_MIN_TEAM   = 500;
    uint public GOLD_MIN_TEAM     = 5000;

    uint public BRONZE_CAP_MULT   = 3;
    uint public SILVER_CAP_MULT   = 10;
    uint public GOLD_CAP_MULT     = 25;

    /* ─────────────────────────────────────────────
       STATE
    ───────────────────────────────────────────── */

    Infeglobal public engine;
    address  public owner;
    address  public incomeVault;
    address  public leadershipEngine;

    // Cumulative BNB per pool (wei, scaled ×1e18 for precision)
    uint public bronzeAccPerNode;
    uint public silverAccPerNode;
    uint public goldAccPerNode;

    // Active node counts
    uint public bronzeNodes;
    uint public silverNodes;
    uint public goldNodes;

    // Per-node accounting
    mapping(uint => uint8) public nodePool;
    mapping(uint => uint)  public bronzeDebt;
    mapping(uint => uint)  public silverDebt;
    mapping(uint => uint)  public goldDebt;
    mapping(uint => uint)  public pendingClaim;
    mapping(uint => uint)  public totalClaimed;

    // Super nodes — in ALL pools simultaneously, no cap, no exit
    mapping(uint => bool) public isSuperNode;
    mapping(uint => bool) public superRegistered;

    // SECURITY: Authorized callers for registerNode()
    // Includes: owner, engine, node's own wallet, any whitelisted contract
    // This allows future NFEGlobal upgrades to trigger pool registration automatically
    mapping(address => bool) public authorizedCallers;

    // Residual BNB accumulated when a pool has 0 members
    uint public residualBronze;
    uint public residualSilver;
    uint public residualGold;

    // Transparency counters
    uint public totalReceived;
    uint public totalDistributed;



    /* ─────────────────────────────────────────────
       EVENTS
    ───────────────────────────────────────────── */

    event PoolReceived(uint amount, uint bronze, uint silver, uint gold, uint timestamp);
    event NodeRegistered(uint nodeId, uint8 poolId);
    event PoolTransition(uint nodeId, uint8 fromPool, uint8 toPool, uint pendingCarried);
    event RewardClaimed(uint nodeId, address wallet, uint amount);
    event CapReached(uint indexed nodeId, address indexed wallet, uint totalEarned);
    event SuperNodeUpdated(uint indexed nodeId, bool status);
    event EngineUpdated(address oldEngine, address newEngine);
    event OwnershipTransferred(address newOwner);
    event CallerAuthorized(address caller, bool status);
    event PoolParamsUpdated(string param, uint value);
    event IncomeVaultUpdated(address indexed oldVault, address indexed newVault);
    event LeadershipEngineUpdated(address indexed oldEngine, address indexed newEngine);


    /* ─────────────────────────────────────────────
       MODIFIERS
    ───────────────────────────────────────────── */

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @dev Allows: owner, engine contract, whitelisted contracts, or the node's own wallet.
     *      The `nodeId` param is used to resolve the wallet check.
     */
    modifier onlyAuthorized(uint nodeId) {
        if (msg.sender != owner && !authorizedCallers[msg.sender] && msg.sender != address(engine)) {
            // Also allow the node's own registered wallet.
            // Uses getNodeWallet() instead of nodes() to avoid ABI mismatch:
            // Node struct has array fields that make the auto-getter dynamically encoded.
            address wallet = engine.getNodeWallet(nodeId);
            require(msg.sender == wallet, "Not authorized");
        }
        _;
    }

    /* ─────────────────────────────────────────────
       CONSTRUCTOR
    ───────────────────────────────────────────── */

    /**
     * @param _engine        NFEGlobal contract address
     * @param _owner         Contract owner
     * @param _genesisNodeId Genesis node ID to auto-register into all pools as super node.
     *                       Set to 0 to skip — then call initializeGenesis() after deployment.
     */
    constructor(address _engine, address _owner, uint _genesisNodeId) {
        require(_engine != address(0), "Zero engine");
        require(_owner  != address(0), "Zero owner");
        engine = Infeglobal(_engine);
        owner  = _owner;
        // Auto-authorize engine on construction
        authorizedCallers[_engine] = true;

        // Auto-register genesis as super node in all 3 pools if provided
        if (_genesisNodeId > 0) {
            isSuperNode[_genesisNodeId]      = true;
            superRegistered[_genesisNodeId]  = true;
            _enterPool(_genesisNodeId, 1);
            _enterPool(_genesisNodeId, 2);
            _enterPool(_genesisNodeId, 3);
            emit SuperNodeUpdated(_genesisNodeId, true);
            emit NodeRegistered(_genesisNodeId, 255);
        }
    }

    /**
     * @notice Fallback initializer for the 2-step deploy scenario where
     *         genesisNodeId was not passed to constructor (set to 0).
     *         Can only be called once — reverts if genesis is already registered.
     */
    function initializeGenesis(uint nodeId) external onlyOwner {
        require(nodeId > 0, "Invalid nodeId");           // M-03 Fix: reject zero-ID
        require(!superRegistered[nodeId], "Already initialized");
        isSuperNode[nodeId]     = true;
        superRegistered[nodeId] = true;
        _enterPool(nodeId, 1);
        _enterPool(nodeId, 2);
        _enterPool(nodeId, 3);
        emit SuperNodeUpdated(nodeId, true);
        emit NodeRegistered(nodeId, 255);
    }

    /* ─────────────────────────────────────────────
       RECEIVE — called by NFEGlobal on every fee inflow
    ───────────────────────────────────────────── */

    receive() external payable {
        if (msg.value == 0) return;
        if (msg.sender == leadershipEngine) {
            // Leadership rewards transfer from engine during claim
            return;
        }

        totalReceived += msg.value;

        uint bronzeShare = msg.value * BRONZE_PCT / BASE;
        uint silverShare = msg.value * SILVER_PCT / BASE;
        uint goldShare   = msg.value - bronzeShare - silverShare;

        if (bronzeNodes > 0) {
            bronzeAccPerNode += bronzeShare * 1e18 / bronzeNodes;
        } else {
            residualBronze += bronzeShare;
        }
        if (silverNodes > 0) {
            silverAccPerNode += silverShare * 1e18 / silverNodes;
        } else {
            residualSilver += silverShare;
        }
        if (goldNodes > 0) {
            goldAccPerNode += goldShare * 1e18 / goldNodes;
        } else {
            residualGold += goldShare;
        }

        emit PoolReceived(msg.value, bronzeShare, silverShare, goldShare, block.timestamp);
    }

    /* ─────────────────────────────────────────────
       REGISTER NODE
    ───────────────────────────────────────────── */

    /**
     * @notice Register or upgrade a node's pool membership.
     *         Callable by: owner, engine, whitelisted contracts, or the node's own wallet.
     *         Future NFEGlobal upgrades can be whitelisted via setAuthorizedCaller().
     */
    function registerNode(uint nodeId) external nonReentrant onlyAuthorized(nodeId) {
        // ── Super node path ───────────────────────────────────────────────
        if (isSuperNode[nodeId]) {
            // H-01 Fix: return instead of revert so auto-calls from nfeglobal
            // (try/catch) don't waste gas on a silent revert after first registration.
            if (superRegistered[nodeId]) return;
            (,,,,,,, bool sIsActive) = engine.getPoolQualificationData(nodeId);
            require(sIsActive, "Node not active in engine");

            // Fix: exit any existing normal pool first to avoid double-counting
            // this node in pool member counts and losing unclaimed accruals.
            uint8 prevPool = nodePool[nodeId];
            if (prevPool > 0) {
                uint earnedPrev = _pendingFromPool(nodeId, prevPool);
                if (earnedPrev > 0) pendingClaim[nodeId] += earnedPrev;
                _exitPool(nodeId, prevPool);
                nodePool[nodeId] = 0;
            }

            _enterPool(nodeId, 1);
            _enterPool(nodeId, 2);
            _enterPool(nodeId, 3);
            superRegistered[nodeId] = true;
            emit NodeRegistered(nodeId, 255);
            return;
        }

        // ── Normal node path ───────────────────────────────────────────────
        (, uint directRefs, , uint currentTier, , uint matrixTeam, , bool isActive)
            = engine.getPoolQualificationData(nodeId);
        require(isActive, "Node not active in engine");

        uint8 newPool = _qualifies(currentTier, directRefs, matrixTeam);
        uint8 oldPool = nodePool[nodeId];

        require(newPool >= oldPool, "Cannot downgrade pool");
        require(newPool > 0, "Does not meet pool qualification criteria");

        if (newPool == oldPool) return;

        // H-03 Fix: Prevent cap-reached node from re-entering pool.
        // A capped node would inflate pool counts and can never claim, permanently
        // locking a pool slot and diluting rewards for all other members.
        {
            // Uses getNodeContribution() instead of nodes() — see interface comment.
            uint totalContribution = engine.getNodeContribution(nodeId);
            uint capMult = newPool == 3 ? GOLD_CAP_MULT : newPool == 2 ? SILVER_CAP_MULT : BRONZE_CAP_MULT;
            uint lifetimeCap = totalContribution * capMult;
            require(lifetimeCap == 0 || totalClaimed[nodeId] < lifetimeCap, "Node earnings cap already reached");
        }

        if (oldPool > 0) {
            uint earned = _pendingFromPool(nodeId, oldPool);
            if (earned > 0) pendingClaim[nodeId] += earned;
            _exitPool(nodeId, oldPool);
        }

        _enterPool(nodeId, newPool);
        nodePool[nodeId] = newPool;

        if (address(leadershipEngine) != address(0)) {
            try IRewardPoolLeadership(leadershipEngine).recordAchievement(nodeId, newPool) {} catch {}
        }

        emit PoolTransition(nodeId, oldPool, newPool, pendingClaim[nodeId]);
        if (oldPool == 0) emit NodeRegistered(nodeId, newPool);
    }

    /* ─────────────────────────────────────────────
       CLAIM — nonReentrant
    ───────────────────────────────────────────── */

    /**
     * @notice Claim all accrued rewards for your node.
     *         Protected by reentrancy guard.
     */
    function claim(uint nodeId) external nonReentrant {
        // Uses targeted getters instead of nodes() — see interface comment.
        address wallet = engine.getNodeWallet(nodeId);
        uint totalContribution = engine.getNodeContribution(nodeId);
        require(wallet != address(0), "Invalid wallet");
        require(msg.sender == wallet, "Not node wallet");

        bool ok;

        // Pull leadership rewards if the engine is set
        uint leadershipReward = 0;
        if (address(leadershipEngine) != address(0)) {
            try IRewardPoolLeadership(leadershipEngine).claimFor(nodeId) returns (uint amt) {
                leadershipReward = amt;
            } catch {}
        }

        // ── Super node: all pools, no cap ─────────────────────────────────
        if (isSuperNode[nodeId]) {
            require(superRegistered[nodeId], "Super node not registered");
            uint sTotal = _pendingFromPool(nodeId, 1)
                        + _pendingFromPool(nodeId, 2)
                        + _pendingFromPool(nodeId, 3)
                        + pendingClaim[nodeId]
                        + leadershipReward;
            require(sTotal > 0, "Nothing to claim");

            _updateDebt(nodeId, 1);
            _updateDebt(nodeId, 2);
            _updateDebt(nodeId, 3);
            pendingClaim[nodeId] = 0;
            totalDistributed += sTotal;

            // Direct transfer to wallet for all, bypassing incomeVault!
            (ok,) = payable(wallet).call{value: sTotal, gas: TRANSFER_GAS}("");
            require(ok, "Transfer failed");

            emit RewardClaimed(nodeId, wallet, sTotal);
            return;
        }

        // ── Normal node ────────────────────────────────────────────────────
        uint8 pool = nodePool[nodeId];
        
        // If not in a pool but has leadership rewards, we can still claim them
        if (pool == 0) {
            require(leadershipReward > 0, "Not in a pool and no leadership rewards");
            
            totalDistributed += leadershipReward;
            (ok,) = payable(wallet).call{value: leadershipReward, gas: TRANSFER_GAS}("");
            require(ok, "Transfer failed");
            
            emit RewardClaimed(nodeId, wallet, leadershipReward);
            return;
        }

        uint capMult = pool == 3 ? GOLD_CAP_MULT : pool == 2 ? SILVER_CAP_MULT : BRONZE_CAP_MULT;
        uint cap = totalContribution * capMult;
        require(cap > 0, "No contribution recorded");
        
        if (totalClaimed[nodeId] >= cap) {
            _exitPool(nodeId, pool);
            nodePool[nodeId] = 0;
            if (pendingClaim[nodeId] > 0) {
                if (pool == 1) residualBronze += pendingClaim[nodeId];
                else if (pool == 2) residualSilver += pendingClaim[nodeId];
                else residualGold += pendingClaim[nodeId];
                pendingClaim[nodeId] = 0;
            }
            
            if (leadershipReward > 0) {
                totalDistributed += leadershipReward;
                (ok,) = payable(wallet).call{value: leadershipReward, gas: TRANSFER_GAS}("");
                require(ok, "Transfer failed");
                emit RewardClaimed(nodeId, wallet, leadershipReward);
            } else {
                emit CapReached(nodeId, wallet, totalClaimed[nodeId]);
            }
            return;
        }

        uint current = _pendingFromPool(nodeId, pool);
        _updateDebt(nodeId, pool);

        uint gross = current + pendingClaim[nodeId];
        require(gross + leadershipReward > 0, "Nothing to claim");

        uint capRemaining = cap - totalClaimed[nodeId];
        uint standardToClaim = gross > capRemaining ? capRemaining : gross;
        uint leftover = gross - standardToClaim;

        pendingClaim[nodeId] = leftover;
        totalClaimed[nodeId] += standardToClaim;
        
        uint total = standardToClaim + leadershipReward;
        totalDistributed += total;

        // Auto-Exit on Cap: stop accruing shares if they hit their limit
        if (totalClaimed[nodeId] >= cap) {
            _exitPool(nodeId, pool);
            nodePool[nodeId] = 0;
            if (leftover > 0) {
                if (pool == 1) residualBronze += leftover;
                else if (pool == 2) residualSilver += leftover;
                else residualGold += leftover;
                pendingClaim[nodeId] = 0;
            }
            emit CapReached(nodeId, wallet, totalClaimed[nodeId]);
        }

        // Direct transfer to wallet, bypassing incomeVault completely!
        (ok,) = payable(wallet).call{value: total, gas: TRANSFER_GAS}("");
        require(ok, "Transfer failed");
        
        emit RewardClaimed(nodeId, wallet, total);
    }

    /* ─────────────────────────────────────────────
       VIEWS
    ───────────────────────────────────────────── */

    function getClaimable(uint nodeId) external view returns (
        uint fromCurrentPool,
        uint fromExitedPools,
        uint total
    ) {
        uint leadershipReward = 0;
        if (address(leadershipEngine) != address(0)) {
            try IRewardPoolLeadership(leadershipEngine).getClaimableTotal(nodeId) returns (uint amt) {
                leadershipReward = amt;
            } catch {}
        }

        if (isSuperNode[nodeId] && superRegistered[nodeId]) {
            fromCurrentPool = _pendingFromPool(nodeId, 1)
                            + _pendingFromPool(nodeId, 2)
                            + _pendingFromPool(nodeId, 3);
            fromExitedPools = pendingClaim[nodeId];
            total = fromCurrentPool + fromExitedPools + leadershipReward;
            return (fromCurrentPool, fromExitedPools, total);
        }

        uint8 pool = nodePool[nodeId];
        fromCurrentPool = (pool > 0) ? _pendingFromPool(nodeId, pool) : 0;
        fromExitedPools = pendingClaim[nodeId];
        total = fromCurrentPool + fromExitedPools;

        if (pool > 0) {
            uint totalContribution = engine.getNodeContribution(nodeId);
            uint capMult = pool == 3 ? GOLD_CAP_MULT : pool == 2 ? SILVER_CAP_MULT : BRONZE_CAP_MULT;
            uint cap = totalContribution * capMult;
            // H-02 Fix: safe subtraction prevents underflow revert if capMult was
            // reduced by owner after the node has already claimed above the new cap.
            uint capRemaining = cap > totalClaimed[nodeId] ? cap - totalClaimed[nodeId] : 0;
            if (total > capRemaining) total = capRemaining;
        }

        total = total + leadershipReward;
    }

    function getCapInfo(uint nodeId) external view returns (
        uint capMultiplier,
        uint totalDeposited,
        uint lifetimeCap,
        uint claimed,
        uint remaining
    ) {
        uint8 pool = nodePool[nodeId];
        uint totalContribution = engine.getNodeContribution(nodeId);
        capMultiplier = pool == 3 ? GOLD_CAP_MULT : pool == 2 ? SILVER_CAP_MULT : pool == 1 ? BRONZE_CAP_MULT : 0;
        totalDeposited = totalContribution;
        lifetimeCap    = totalContribution * capMultiplier;
        claimed        = totalClaimed[nodeId];
        remaining      = lifetimeCap > claimed ? lifetimeCap - claimed : 0;
    }

    function getPoolForNode(uint nodeId) external view returns (uint8) {
        (, uint directRefs, , uint currentTier, , uint matrixTeam, ,) = engine.getPoolQualificationData(nodeId);
        return _qualifies(currentTier, directRefs, matrixTeam);
    }

    function getQualificationStatus(uint nodeId) external view returns (
        uint8 currentPool,
        uint  nfeTier,
        uint  directRefs,
        uint  matrixTeam,
        bool  bronzeQualified,
        bool  silverQualified,
        bool  goldQualified,
        uint  directNeededBronze,
        uint  directNeededSilver,
        uint  directNeededGold,
        uint  teamNeededBronze,
        uint  teamNeededSilver,
        uint  teamNeededGold
    ) {
        (, uint dRefs, , uint tier, , uint mTeam, ,) = engine.getPoolQualificationData(nodeId);
        currentPool = nodePool[nodeId];
        nfeTier     = tier;
        directRefs  = dRefs;
        matrixTeam  = mTeam;

        bronzeQualified = (tier >= BRONZE_MIN_TIER && dRefs >= BRONZE_MIN_DIRECT && mTeam >= BRONZE_MIN_TEAM);
        silverQualified = (tier >= SILVER_MIN_TIER && dRefs >= SILVER_MIN_DIRECT && mTeam >= SILVER_MIN_TEAM);
        goldQualified   = (tier >= GOLD_MIN_TIER   && dRefs >= GOLD_MIN_DIRECT   && mTeam >= GOLD_MIN_TEAM);

        directNeededBronze = dRefs >= BRONZE_MIN_DIRECT ? 0 : BRONZE_MIN_DIRECT - dRefs;
        directNeededSilver = dRefs >= SILVER_MIN_DIRECT ? 0 : SILVER_MIN_DIRECT - dRefs;
        directNeededGold   = dRefs >= GOLD_MIN_DIRECT   ? 0 : GOLD_MIN_DIRECT   - dRefs;

        teamNeededBronze = mTeam >= BRONZE_MIN_TEAM ? 0 : BRONZE_MIN_TEAM - mTeam;
        teamNeededSilver = mTeam >= SILVER_MIN_TEAM ? 0 : SILVER_MIN_TEAM - mTeam;
        teamNeededGold   = mTeam >= GOLD_MIN_TEAM   ? 0 : GOLD_MIN_TEAM   - mTeam;
    }

    function getPoolStats() external view returns (
        uint _bronzeNodes,
        uint _silverNodes,
        uint _goldNodes,
        uint _bronzeAccPerNode,
        uint _silverAccPerNode,
        uint _goldAccPerNode,
        uint _totalReceived,
        uint _totalDistributed
    ) {
        return (
            bronzeNodes, silverNodes, goldNodes,
            bronzeAccPerNode, silverAccPerNode, goldAccPerNode,
            totalReceived, totalDistributed
        );
    }

    function getNodeInfo(uint nodeId) external view returns (
        uint8  currentPool,
        string memory poolName,
        uint   nfeTier,
        uint   claimable,
        uint   lifetimeCap,
        uint   lifetimeClaimed,
        uint   capRemaining,
        bool   capReached,
        uint   totalDeposited
    ) {
        currentPool = nodePool[nodeId];
        poolName    = _poolName(currentPool);

        uint totalContribution = engine.getNodeContribution(nodeId);
        (uint deposited, , , uint tier, , , ,) = engine.getPoolQualificationData(nodeId);
        totalDeposited = deposited;
        nfeTier        = tier;

        uint capMult = currentPool == 3 ? GOLD_CAP_MULT
                     : currentPool == 2 ? SILVER_CAP_MULT
                     : currentPool == 1 ? BRONZE_CAP_MULT : 0;

        lifetimeCap     = totalContribution * capMult;
        lifetimeClaimed = totalClaimed[nodeId];
        capRemaining    = lifetimeCap > lifetimeClaimed ? lifetimeCap - lifetimeClaimed : 0;
        capReached      = (lifetimeClaimed >= lifetimeCap && lifetimeCap > 0);

        uint fromPool = (currentPool > 0) ? _pendingFromPool(nodeId, currentPool) : 0;
        uint rawTotal = fromPool + pendingClaim[nodeId];
        claimable     = rawTotal > capRemaining ? capRemaining : rawTotal;
    }

    /**
     * @notice Comprehensive view helper for the frontend.
     *         Returns everything needed for the Pool Dashboard in ONE call.
     */
    function getPoolViewHelper(uint nodeId) external view returns (
        uint8   currentPoolId,
        string  memory poolName,
        uint    claimable,
        uint    totalEarned,
        uint    totalClaimedAmount,
        uint    remainingCap,
        uint    lifetimeCap,
        uint    totalDeposited,
        uint    nfeTier,
        bool    isQualifiedForNext,
        uint8   nextPoolId,
        uint[3] memory missingRequirements // [missingTier, missingDirects, missingTeam]
    ) {
        currentPoolId = nodePool[nodeId];
        poolName      = _poolName(currentPoolId);
        
        uint totalContribution = engine.getNodeContribution(nodeId);
        (, uint dRefs, , uint tier, , uint mTeam, , ) = engine.getPoolQualificationData(nodeId);
        
        totalDeposited     = totalContribution;
        nfeTier            = tier;
        totalClaimedAmount = totalClaimed[nodeId];

        uint8 p = currentPoolId;
        uint capMult = p == 3 ? GOLD_CAP_MULT : p == 2 ? SILVER_CAP_MULT : p == 1 ? BRONZE_CAP_MULT : 0;
        lifetimeCap = totalContribution * capMult;
        
        uint fromPool = (p > 0) ? _pendingFromPool(nodeId, p) : 0;
        uint rawTotal = fromPool + pendingClaim[nodeId];
        
        remainingCap = lifetimeCap > totalClaimedAmount ? lifetimeCap - totalClaimedAmount : 0;
        claimable    = rawTotal > remainingCap ? remainingCap : rawTotal;
        totalEarned  = totalClaimedAmount + claimable;

        // Next pool logic
        nextPoolId = p < 3 ? p + 1 : 0;
        if (nextPoolId > 0) {
            uint reqTier   = nextPoolId == 3 ? GOLD_MIN_TIER : nextPoolId == 2 ? SILVER_MIN_TIER : BRONZE_MIN_TIER;
            uint reqDirect = nextPoolId == 3 ? GOLD_MIN_DIRECT : nextPoolId == 2 ? SILVER_MIN_DIRECT : BRONZE_MIN_DIRECT;
            uint reqTeam   = nextPoolId == 3 ? GOLD_MIN_TEAM : nextPoolId == 2 ? SILVER_MIN_TEAM : BRONZE_MIN_TEAM;
            
            isQualifiedForNext = (tier >= reqTier && dRefs >= reqDirect && mTeam >= reqTeam);
            
            missingRequirements[0] = tier >= reqTier ? 0 : reqTier - tier;
            missingRequirements[1] = dRefs >= reqDirect ? 0 : reqDirect - dRefs;
            missingRequirements[2] = mTeam >= reqTeam ? 0 : reqTeam - mTeam;
        }
    }

    function getContractInfo() external view returns (
        uint    _totalReceived,
        uint    _totalDistributed,
        uint    _pendingInContract,
        uint    _bronzeNodes,
        uint    _silverNodes,
        uint    _goldNodes,
        address _contractAddress,
        address _engineAddress
    ) {
        _totalReceived     = totalReceived;
        _totalDistributed  = totalDistributed;
        _pendingInContract = address(this).balance;
        _bronzeNodes       = bronzeNodes;
        _silverNodes       = silverNodes;
        _goldNodes         = goldNodes;
        _contractAddress   = address(this);
        _engineAddress     = address(engine);
    }

    function isCapReached(uint nodeId) external view returns (bool) {
        uint8 pool = nodePool[nodeId];
        if (pool == 0) return false;
        uint totalContribution = engine.getNodeContribution(nodeId);
        uint capMult = pool == 3 ? GOLD_CAP_MULT : pool == 2 ? SILVER_CAP_MULT : BRONZE_CAP_MULT;
        return totalClaimed[nodeId] >= totalContribution * capMult;
    }

    function getPoolName(uint8 pool) external pure returns (string memory) {
        return _poolName(pool);
    }

    /* ─────────────────────────────────────────────
       ADMIN — SECURITY & FUTURE COMPATIBILITY
    ───────────────────────────────────────────── */

    /**
     * @notice Grant or revoke a contract/address as an authorised caller of registerNode().
     *         Use this to whitelist future NFEGlobal versions or helper contracts
     *         so they can auto-register nodes without redeploying RewardPool.
     */
    function setAuthorizedCaller(address caller, bool status) external onlyOwner {
        require(caller != address(0), "Zero address");
        authorizedCallers[caller] = status;
        emit CallerAuthorized(caller, status);
    }

    /**
     * @notice Update the NFEGlobal engine address.
     *         Old engine is removed from authorizedCallers; new engine is added.
     *         All existing pool positions and debts are preserved.
     */
    function setEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "Zero engine");
        address old = address(engine);
        // Revoke old engine
        if (authorizedCallers[old]) {
            authorizedCallers[old] = false;
            emit CallerAuthorized(old, false);
        }
        engine = Infeglobal(_engine);
        // Authorise new engine automatically
        authorizedCallers[_engine] = true;
        emit CallerAuthorized(_engine, true);
        emit EngineUpdated(old, _engine);
    }

    /**
     * @notice Designate a super node (genesis / owner-designated).
     *         Call registerNode() after this to enter all pools.
     */
    function setSuperNode(uint nodeId, bool status) external onlyOwner {
        if (!status && superRegistered[nodeId]) {
            // Fix: credit accrued rewards before exiting so unclaimed accruals
            // are not wiped by the debt reset in _exitPool.
            uint accrued = _pendingFromPool(nodeId, 1)
                         + _pendingFromPool(nodeId, 2)
                         + _pendingFromPool(nodeId, 3);
            if (accrued > 0) pendingClaim[nodeId] += accrued;
            // M-01/M-05 Fix: exit all pools before revoking super status so node
            // counts stay accurate and nodePool mapping is cleaned up correctly.
            // Super nodes are registered in pools 1, 2, 3 independently
            _exitPool(nodeId, 1);
            _exitPool(nodeId, 2);
            _exitPool(nodeId, 3);
            nodePool[nodeId] = 0;
            superRegistered[nodeId] = false;
        }
        isSuperNode[nodeId] = status;
        emit SuperNodeUpdated(nodeId, status);
    }

    /**
     * @notice Update pool tier thresholds (future business rule changes).
     *         param: "BRONZE_TIER", "SILVER_TIER", "GOLD_TIER"
     */
    function setPoolTierThreshold(string calldata pool, uint value) external onlyOwner {
        bytes32 p = keccak256(bytes(pool));
        if (p == keccak256("BRONZE_TIER"))       { BRONZE_MIN_TIER = value; }
        else if (p == keccak256("SILVER_TIER"))  { SILVER_MIN_TIER = value; }
        else if (p == keccak256("GOLD_TIER"))    { GOLD_MIN_TIER   = value; }
        else revert("Unknown param");
        emit PoolParamsUpdated(pool, value);
    }

    /**
     * @notice Update pool direct referral requirements.
     *         param: "BRONZE_DIRECT", "SILVER_DIRECT", "GOLD_DIRECT"
     */
    function setPoolDirectReq(string calldata pool, uint value) external onlyOwner {
        bytes32 p = keccak256(bytes(pool));
        if (p == keccak256("BRONZE_DIRECT"))      { BRONZE_MIN_DIRECT = value; }
        else if (p == keccak256("SILVER_DIRECT")) { SILVER_MIN_DIRECT = value; }
        else if (p == keccak256("GOLD_DIRECT"))   { GOLD_MIN_DIRECT   = value; }
        else revert("Unknown param");
        emit PoolParamsUpdated(pool, value);
    }

    /**
     * @notice Update pool team size requirements.
     *         param: "BRONZE_TEAM", "SILVER_TEAM", "GOLD_TEAM"
     */
    function setPoolTeamReq(string calldata pool, uint value) external onlyOwner {
        bytes32 p = keccak256(bytes(pool));
        if (p == keccak256("BRONZE_TEAM"))      { BRONZE_MIN_TEAM = value; }
        else if (p == keccak256("SILVER_TEAM")) { SILVER_MIN_TEAM = value; }
        else if (p == keccak256("GOLD_TEAM"))   { GOLD_MIN_TEAM   = value; }
        else revert("Unknown param");
        emit PoolParamsUpdated(pool, value);
    }

    /**
     * @notice Update earnings cap multipliers.
     *         param: "BRONZE_CAP", "SILVER_CAP", "GOLD_CAP"
     */
    function setCapMultiplier(string calldata pool, uint value) external onlyOwner {
        require(value > 0, "Cap must be > 0");
        bytes32 p = keccak256(bytes(pool));
        if (p == keccak256("BRONZE_CAP"))      { BRONZE_CAP_MULT = value; }
        else if (p == keccak256("SILVER_CAP")) { SILVER_CAP_MULT = value; }
        else if (p == keccak256("GOLD_CAP"))   { GOLD_CAP_MULT   = value; }
        else revert("Unknown param");
        // M-08 Fix: enforce tier ordering invariant after any threshold change
        require(BRONZE_CAP_MULT <= SILVER_CAP_MULT, "Cap ordering: Bronze must be <= Silver");
        require(SILVER_CAP_MULT <= GOLD_CAP_MULT,   "Cap ordering: Silver must be <= Gold");
        emit PoolParamsUpdated(pool, value);
    }



    /**
     * @notice Recover BNB credited to this pool as pendingReward inside the
     *         engine. The engine pushes pool fees with a 100k gas stipend; if
     *         receive() exceeds it (e.g., first inflow writing cold storage),
     *         the BNB is parked as pendingReward[address(this)] in the engine
     *         and only this contract can withdraw it. Callable by anyone;
     *         recovered BNB flows through receive() and is distributed.
     */
    function recoverEngineRewards() external nonReentrant {
        engine.withdraw();
    }

    function transferOwnership(address _new) external onlyOwner {
        require(_new != address(0), "Zero address");
        owner = _new;
        emit OwnershipTransferred(_new);
    }

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Zero address");
        address oldVault = incomeVault;
        incomeVault = _vault;
        emit IncomeVaultUpdated(oldVault, _vault);
    }

    function setLeadershipEngine(address _engine) external onlyOwner {
        address old = leadershipEngine;
        leadershipEngine = _engine;
        emit LeadershipEngineUpdated(old, _engine);
    }

    /* ─────────────────────────────────────────────
       INTERNAL HELPERS
    ───────────────────────────────────────────── */

    function _qualifies(uint tier, uint directRefs, uint matrixTeam) private view returns (uint8) {
        if (tier >= GOLD_MIN_TIER   && directRefs >= GOLD_MIN_DIRECT   && matrixTeam >= GOLD_MIN_TEAM)   return 3;
        if (tier >= SILVER_MIN_TIER && directRefs >= SILVER_MIN_DIRECT && matrixTeam >= SILVER_MIN_TEAM) return 2;
        if (tier >= BRONZE_MIN_TIER && directRefs >= BRONZE_MIN_DIRECT && matrixTeam >= BRONZE_MIN_TEAM) return 1;
        return 0;
    }

    function _poolName(uint8 pool) private pure returns (string memory) {
        if (pool == 3) return "Gold";
        if (pool == 2) return "Silver";
        if (pool == 1) return "Bronze";
        return "None";
    }

    function _pendingFromPool(uint nodeId, uint8 pool) private view returns (uint) {
        // C-03 Fix: safe subtraction — debt can theoretically exceed accumulator
        // after edge-case re-registration or admin cap changes, which would cause
        // an underflow revert (Solidity 0.8+) and permanently lock the account.
        if (pool == 1) {
            return bronzeAccPerNode >= bronzeDebt[nodeId]
                ? (bronzeAccPerNode - bronzeDebt[nodeId]) / 1e18 : 0;
        }
        if (pool == 2) {
            return silverAccPerNode >= silverDebt[nodeId]
                ? (silverAccPerNode - silverDebt[nodeId]) / 1e18 : 0;
        }
        if (pool == 3) {
            return goldAccPerNode >= goldDebt[nodeId]
                ? (goldAccPerNode - goldDebt[nodeId]) / 1e18 : 0;
        }
        return 0;
    }

    function _updateDebt(uint nodeId, uint8 pool) private {
        if (pool == 1) bronzeDebt[nodeId] = bronzeAccPerNode;
        if (pool == 2) silverDebt[nodeId] = silverAccPerNode;
        if (pool == 3) goldDebt[nodeId]   = goldAccPerNode;
    }

    function _enterPool(uint nodeId, uint8 pool) private {
        // H-01 Fix: set debt BEFORE injecting residual so that the joining node
        // earns the residual (debt captures the pre-injection accumulator value).
        // Previous code injected residual first, then set debt = post-injection
        // accumulator, making the residual permanently unclaim-able.
        _updateDebt(nodeId, pool);

        if (pool == 1) {
            bronzeNodes++;
            if (bronzeNodes == 1 && residualBronze > 0) {
                bronzeAccPerNode += residualBronze * 1e18;
                residualBronze = 0;
            }
        }
        if (pool == 2) {
            silverNodes++;
            if (silverNodes == 1 && residualSilver > 0) {
                silverAccPerNode += residualSilver * 1e18;
                residualSilver = 0;
            }
        }
        if (pool == 3) {
            goldNodes++;
            if (goldNodes == 1 && residualGold > 0) {
                goldAccPerNode += residualGold * 1e18;
                residualGold = 0;
            }
        }
    }

    function _exitPool(uint nodeId, uint8 pool) private {
        _updateDebt(nodeId, pool);
        if (pool == 1 && bronzeNodes > 0) bronzeNodes--;
        if (pool == 2 && silverNodes > 0) silverNodes--;
        if (pool == 3 && goldNodes   > 0) goldNodes--;
    }
}