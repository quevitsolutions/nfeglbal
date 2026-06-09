// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  INodeFlowEngine
 * @notice External interface for NodeFlow Engine — allows reward pool contracts,
 *         dashboards, and third-party protocols to interact with NodeFlowEngine
 *         without importing the full implementation.
 *
 * ── TERMINOLOGY ───────────────────────────────────────────────────────────
 *   Node     = a registered participant (formerly "User")
 *   Tier     = upgrade level 0–17 (formerly "level")
 *   Sponsor  = direct referrer (formerly "referrer")
 *   FeeReceiver = platform distribution wallet (missed rewards + dust)
 *   RewardPool = reward distribution wallet (formerly "rewardwallet")
 */
interface Infeglobal {

    // ── STRUCTS ────────────────────────────────────────────────────────────
    
    struct ChainConfig {
        string nativeSymbol;
        address priceFeed;
        uint256 maxAllowedPrice;
        uint256 minAllowedPrice;
    }

    struct Node {
        address wallet;
        uint64 nodeId;
        uint64 sponsor;
        uint64 matrixParent;
        uint40 joinedAt;
        uint8 tier;
        uint32 directNodes;
        uint32 totalMatrixNodes;
        uint totalContribution;
        uint32[18] sponsorTierRanks;
        uint64[18] matrixRewardReceiver;
    }

    struct NodeWithStats {
        Node node;
        uint missedReward;
    }

    struct RewardInfo {
        uint totalRewards;
        uint sponsorReward;
        uint layerReward;
        uint matrixReward;
        /// @dev LOW-07: directReward is reserved for future use; currently always 0.
        ///              Reward type 1 (direct sponsor) is tracked in sponsorReward.
        uint directReward;
        uint missedReward;
        uint[18] tierRewards;
    }

    struct RewardEvent {
        uint id;
        uint layer;
        uint amount;
        uint time;
        bool isMissed;
        uint rewardType;
        uint tier;
    }

    struct FastDashboardData {
        uint256 totalFreeUsers;
        uint256 totalFreeUpgraded;
        uint256 conversionRate;
        uint256 todayConversions;
        uint256 weeklyConversions;
        uint256 monthlyConversions;
        uint256 directIncomePotential;
        uint256 layerIncomePotential;
        uint256 matrixIncomePotential;
        uint256 totalPotentialIncome;
        uint256 teamTreasuryGenerated;
        uint256 teamTreasuryUsed;
        uint256 remainingTreasury;
        uint256 totalUpgrades;
        uint256 teamRewardsDistributed;
        uint256 sponsorFreeUsers;
        uint256 sponsorConvertedUsers;
        uint256 sponsorConversionRate;
        uint256 sponsorTeamGrowth;
        string achievementBadge;
        uint256 directsCount;
        uint256 missionRemaining;
        uint256 missionProgressPercent;
        bool missionCompleted;
    }

    // ── EVENTS ─────────────────────────────────────────────────────────────

    event NodeCreated(
        address indexed wallet,
        uint indexed nodeId,
        uint indexed sponsorId,
        uint matrixParentId
    );
    event TierUnlocked(address indexed wallet, uint indexed nodeId, uint tierId);
    event RewardDistributed(
        address indexed wallet,
        uint indexed nodeId,
        uint fromId,
        uint layer,
        uint amount,
        uint time,
        bool isMissed,
        uint rewardType,
        uint tier
    );
    event OraclePriceUpdated(uint newPrice, uint time);
    event OracleError(address indexed feed, uint time);
    /// @notice Emitted when oracle price update is accepted despite exceeding the normal 20% deviation guard
    event OracleDeviationTooHigh(uint indexed oldPrice, uint indexed newPrice, uint deviation, uint timestamp);
    event RewardPending(address indexed recipient, uint amount);
    event OracleAdminUpdated(address indexed newAdmin);
    // Admin / governance events
    event MatrixAdminUpdated(address indexed newAdmin);
    event AddressUpdated(uint indexed addrType, address indexed newAddress, address indexed oldAddress);
    event LayersUpdated(uint indexed layerType, uint oldValue, uint newValue);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeReceiverSwept(uint platformFees, uint missedRewards, uint total); // @deprecated: sweepFeeReceiver is now a no-op
    event RescueScheduled(uint executeAfter);
    /// @notice Emitted when contract dust (balance above reserved) is swept to the reward pool
    event DustSwept(uint amount, address indexed pool, uint timestamp);
    // Keeper bot signal — emitted on createNode and unlockTier for off-chain pool sync
    event PoolCheckRequired(uint indexed nodeId, uint timestamp);
    /// @notice HIGH-01 Fix: Emitted when BFS queue overflows and genesis is used as matrix parent fallback
    event MatrixFallback(uint indexed nodeId, uint indexed sponsor, uint timestamp);
    /// @notice Emitted when a node becomes eligible and is added to the treasury upgrade FIFO queue
    event TreasuryNodeQueued(uint indexed nodeId, uint tier);
    /// @notice Emitted when a treasury-funded upgrade completes full distributions
    event TreasuryUpgradeExecuted(uint indexed nodeId, uint oldTier, uint newTier, uint treasuryAmount);
    /// @notice Emitted after each batch process step — shows how many items remain
    event TreasuryQueueProcessed(uint indexed nodeId, uint remainingQueueSize);
    /// @notice M-05 Fix: Emitted when price safety bounds are updated — makes changes detectable on-chain
    event PriceBoundsUpdated(uint oldMin, uint oldMax, uint newMin, uint newMax);

    event TreasuryCredited(uint indexed nodeId, uint amount, uint balance);
    event TreasuryDormant(uint indexed nodeId, uint amount, uint timestamp);
    event DormancyRecovered(uint indexed nodeId);
    event DormantTreasuryTransferred(uint indexed nodeId, uint amount);
    event DaoSpendingExecuted(address indexed target, uint amount, string purpose);
    event DormancyThresholdUpdated(uint oldVal, uint newVal);
    event TreasuryAbandoned(uint256 indexed nodeId, address indexed recipient, uint256 amount);

    // V2.1 Hardening Events
    event TreasuryUsed(
        uint indexed nodeId,
        uint amount,
        uint remainingBalance
    );
    event DaoTreasuryIncreased(
        uint indexed nodeId,
        uint amount,
        uint newDaoTreasuryBalance
    );
    event DaoTreasuryDecreased(
        address indexed receiver,
        uint amount,
        uint remainingDaoTreasury
    );
    event DormancyProposed(
        uint indexed nodeId,
        uint timestamp
    );
    event DormancyActivated(
        uint indexed nodeId,
        uint timestamp
    );
    event DaoProposalCreated(
        uint proposalId,
        address target,
        uint amount,
        uint executeAfter
    );
    event DaoProposalExecuted(
        uint proposalId
    );
    event OracleCircuitBreakerTriggered(
        uint oldPrice,
        uint newPrice,
        uint deviation
    );
    event DustSkimmed(
        uint amount,
        address rewardPool
    );
    event MigrationLocked();
    event Tier18TreasuryReleased(
        uint indexed nodeId,
        uint amount
    );

    // ── NODE REGISTRATION & UPGRADE ────────────────────────────────────────

    /// @notice Register a new Node linked to a sponsor Node ID
    function createNode(uint _sponsor) external payable;

    /// @notice Unlock tiers up to `_toTier` for the given Node ID
    function unlockTier(uint _nodeId, uint _toTier) external payable;

    /// @notice Register using a sponsor's wallet address — sponsor must already be registered
    function createNodeWithSponsorAddress(address _sponsorAddress) external payable;

    /// @notice Claim any BNB credited via Pull Payment (failed push)
    function withdraw() external;

    // ── NODE QUERIES ───────────────────────────────────────────────────────

    /// @notice Returns the Node struct for a given Node ID
    function nodes(uint nodeId) external view returns (
        address wallet,
        uint64 id,
        uint64 sponsor,
        uint64 matrixParent,
        uint40 joinedAt,
        uint8 tier,
        uint32 directNodes,
        uint32 totalMatrixNodes,
        uint totalContribution
    );

    /// @notice Returns the RewardInfo struct for a given Node ID
    function rewardInfo(uint nodeId) external view returns (
        uint totalRewards,
        uint sponsorReward,
        uint layerReward,
        uint matrixReward,
        uint directReward,
        uint missedReward
    );

    /// @notice Returns the Node ID registered to a wallet address
    function nodeId(address wallet) external view returns (uint);

    /// @notice Returns the Node struct by wallet address
    function getNodeByAddress(address _addr) external view returns (Node memory);

    /// @notice LOW-03 Fix: Returns the full Node struct (including arrays) by node ID
    function getNode(uint256 _nodeId) external view returns (Node memory);

    /// @notice Returns key stats for a Node
    function getNodeStats(uint _userId) external view returns (
        uint tier,
        uint directCount,
        uint matrixCount,
        uint totalRewards,
        uint totalContribution,
        uint daysActive
    );

    // ── TIER & COST QUERIES ────────────────────────────────────────────────

    /// @notice BNB cost for a given tier index (0–17)
    function getTierCost(uint _index) external view returns (uint);

    /// @notice BNB cost for all 18 tiers
    function getTierCosts() external view returns (uint[18] memory);

    /// @notice Per-tier reward breakdown for a Node
    function getTierRewards(uint _nodeId) external view returns (uint[18] memory);

    /// @notice BNB cost to unlock `_levels` tiers starting from `_fromLevel`
    function getUpgradeCost(uint _fromLevel, uint _levels) external view returns (uint totalCost);

    /// @notice Whether a Node can unlock `_levels` more tiers
    function canUpgrade(uint _nodeId, uint _levels) external view returns (bool);

    // ── REWARD POOL INTERFACE ──────────────────────────────────────────────

    /// @notice Full qualification data for external reward pool contracts
    function getPoolQualificationData(uint _nodeId) external view returns (
        uint totalDeposited,
        uint directReferrals,
        uint totalTeam,
        uint currentLevel,
        uint directTeamL1,
        uint matrixTeam,
        uint registrationTime,
        bool isActive
    );

    /// @notice Pending pull-payment balance for a wallet
    function pendingReward(address wallet) external view returns (uint);

    /// @notice Returns the total missed rewards pending for a node until they upgrade
    function getPendingUpgradeRewards(uint nodeId) external view returns (uint);

    function treasuryBalance(uint nodeId) external view returns (uint);
    function inTreasuryQueue(uint nodeId) external view returns (bool);
    function queuedTier(uint nodeId) external view returns (uint);
    function queuedCostBNB(uint nodeId) external view returns (uint);
    function lastTreasuryActivity(uint nodeId) external view returns (uint);
    function treasuryDormant(uint nodeId) external view returns (bool);
    function dormantStart(uint nodeId) external view returns (uint);
    function governance() external view returns (address);
    function migrationLocked() external view returns (bool);
    function totalTreasuryBalance() external view returns (uint);
    function queue(uint index) external view returns (uint);
    function queueHead() external view returns (uint);
    function queueTail() external view returns (uint);

    /// @notice Total pending rewards (pull payments) globally in the contract
    function totalPendingRewards() external view returns (uint);

    // V2.1 Hardening Getters & Mappings
    function dormancyProposed(uint nodeId) external view returns (bool);
    function dormancyProposalTime(uint nodeId) external view returns (uint);
    function oracleCircuitBreaker() external view returns (bool);
    function circuitBreakerActivatedAt() external view returns (uint);
    function config() external view returns (string memory nativeSymbol, address priceFeed, uint256 maxAllowedPrice, uint256 minAllowedPrice);

    // ── INCOME / HISTORY QUERIES ───────────────────────────────────────────

    /// @notice Returns the most recent `length` reward events for a node.
    ///         LOW-09 Fix: Results are returned OLDEST-FIRST (index 0 = oldest in the window).
    function getIncome(uint nodeId, uint length) external view returns (RewardEvent[] memory);



    /// @notice Returns how many days since this node registered (for daysActive)
    function getNodeCurDay(uint nodeId) external view returns (uint);

    // ── MATRIX QUERIES ─────────────────────────────────────────────────────

    /// @notice Returns the two direct binary children of a Node
    function getMatrixDirect(uint _nodeId) external view returns (uint[2] memory);



    /// @notice Number of nodes at a given referral-tree depth (0–16) for a given Node.
    ///         Reads from networkTree (referral tree), NOT the binary matrix tree.
    ///         For matrix data use getMatrixUsers().
    function getTeamSize(uint _nodeId, uint _depth) external view returns (uint);

    /// @notice Paginated matrix layer members (Node structs)
    function getMatrixUsers(uint nodeId, uint layer, uint startIndex, uint num)
        external view returns (Node[] memory);

    /// @notice Paginated referral network members at a given depth
    function getNetworkNodes(uint nodeId, uint layer, uint num)
        external view returns (Node[] memory);



    // ── PROTOCOL CONFIG ────────────────────────────────────────────────────

    /// @notice Returns global protocol configuration
    function getConfig() external view returns (
        uint _defaultRefer,
        uint _totalNodes,
        uint _maxMatrixDepth,
        uint _bnbPrice,
        uint _lastUpdate,
        address _owner,
        address _oracleAdmin,
        address _matrixAdmin,
        address _feeReceiver,
        address _rewardPool,
        uint _maxAllowedPrice,
        uint _minAllowedPrice
    );

    /// @notice Total registered nodes
    function totalNodes() external view returns (uint);

    /// @notice Returns the current tier level for a node (L-02 Fix: added missing declaration)
    function getUserLevel(uint _userId) external view returns (uint);

    /// @notice Genesis Node ID (root of the tree)
    function defaultRefer() external view returns (uint);

    /// @notice Current Native Token/USD price used for tier cost calculation (8 decimals)
    function nativePrice() external view returns (uint);

    /// @notice Current BNB/USD price used for tier cost calculation (8 decimals) (Backwards-compatibility alias)
    function bnbPrice() external view returns (uint);

    /// @notice Symbol of the native token
    function nativeTokenSymbol() external view returns (string memory);

    /// @notice Price of the native token
    function nativeTokenPrice() external view returns (uint);

    /// @notice Timestamp of last oracle price update
    function lastPriceUpdate() external view returns (uint);

    /// @notice Max allowed price for oracle circuit breaker
    function maxAllowedPrice() external view returns (uint);

    /// @notice Min allowed price for oracle circuit breaker
    function minAllowedPrice() external view returns (uint);

    /// @notice Total missed rewards currently locked in contract (Backwards-compatibility alias)
    function totalMissedRewards() external view returns (uint);

    /// @notice Returns the timestamp of last action for a node (Backwards-compatibility alias)
    function lastActivity(uint nodeId) external view returns (uint);

    /// @notice Returns the treasury balance (Backwards-compatibility alias)
    function treasury(uint nodeId) external view returns (uint bnbAmount, uint usdValue);



    // ── TRANSPARENCY ───────────────────────────────────────────────────────

    /// @notice One-call transparency dashboard: totals, contract address, ownership
    function getTransparencyData() external view returns (
        uint  _totalNodes,
        uint  _totalBNBDistributed,
        uint  _totalTiers,
        address _contractAddress,
        address _ownerAddress,
        bool  _isRenounced
    );



    // ── ADMIN / GOVERNANCE ─────────────────────────────────────────────────

    /// @notice Updates addresses: type 0=feeReceiver, 1=rewardPool, 7+=admin roles
    function setAddr(uint _type, address _new, uint _num) external;

    function rescueNative(uint _amount) external;

    /// @notice Owner: Schedule a rescue (owner only). Must wait 48h timelock before executing.
    function scheduleRescueNative() external;



    /// @notice Oracle admin: manually set BNB price (max 20% deviation)
    function manualUpdatePrice(uint _newPrice) external;

    /// @notice Owner: set safe BNB price bounds for oracle validation
    function setPriceBounds(uint _min, uint _max) external;

    /// @notice Owner/Oracle Admin: set symbol of the native token
    function setNativeTokenSymbol(string calldata _symbol) external;

    /// @notice Owner: permanently renounce contract ownership
    function renounceOwnership() external;

    /// @notice Owner: transfer contract ownership to a new address
    function transferOwnership(address _newOwner) external;

    /// @notice Allows a registered node to upgrade their own tier by exactly 1 level (funded by tier-reserved missed rewards if sufficient, otherwise paid)
    function selfUpgrade() external payable;

    /// @notice Public permissionless keeper function — processes up to AUTO_BATCH=1 treasury queue entries
    function processTreasuryQueue() external;

    function proposeDormancy(uint _nodeId) external;
    function activateDormancy(uint _nodeId) external;
    function claimDormantTreasury() external;
    function migrateDormantTreasury(uint _nodeId) external;
    function declareDormant(uint _nodeId) external;
    function dormantSince(uint _nodeId) external view returns (uint);
    function reclaimDormantNode() external;
    function abandonTreasury(uint _nodeId) external;
    function setGovernance(address _newGovernance) external;
    function lockMigrationForever() external;
    function resetOracleCircuitBreaker() external;
    function skimDust() external;
    function dormancyThreshold() external view returns (uint);
}