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
interface IAIPCore {

    // ── STRUCTS ────────────────────────────────────────────────────────────

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
    event RewardPending(address indexed recipient, uint amount);
    event OracleAdminUpdated(address indexed newAdmin);
    // Admin / governance events
    event MatrixAdminUpdated(address indexed newAdmin);
    event AddressUpdated(uint indexed addrType, address indexed newAddress, address indexed oldAddress);
    event LayersUpdated(uint indexed layerType, uint oldValue, uint newValue);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeReceiverSwept(uint platformFees, uint missedRewards, uint total);
    event RescueScheduled(uint executeAfter); // H1 Fix: time-lock schedule event
    // Keeper bot signal — emitted on createNode and unlockTier for off-chain pool sync
    event PoolCheckRequired(uint indexed nodeId, uint timestamp);

    // ── NODE REGISTRATION & UPGRADE ────────────────────────────────────────

    /// @notice Register a new Node linked to a sponsor Node ID
    function createNode(uint _sponsor) external payable;

    /// @notice Unlock tiers up to `_toTier` for the given Node ID
    function unlockTier(uint _nodeId, uint _toTier) external payable;

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

    /// @notice Returns whether a Node ID is active
    function isNodeActive(uint _nodeId) external view returns (bool);

    /// @notice Returns whether a wallet address is registered
    function isNodeRegistered(address _wallet) external view returns (bool);

    /// @notice Returns the Node struct by wallet address
    function getNodeByAddress(address _addr) external view returns (Node memory);

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

    /// @notice Missed rewards by tier mapping exposure
    function missedRewardsByTier(uint nodeId, uint tier) external view returns (uint);

    /// @notice Total missed rewards currently locked in the contract
    function totalMissedRewards() external view returns (uint);

    /// @notice Total pending rewards (pull payments) globally in the contract
    function totalPendingRewards() external view returns (uint);

    // ── INCOME / HISTORY QUERIES ───────────────────────────────────────────

    /// @notice Returns the most recent `length` reward events for a node (newest first)
    function getIncome(uint nodeId, uint length) external view returns (RewardEvent[] memory);

    /// @notice Returns the most recent `length` MISSED reward events for a node
    function getMissedIncome(uint nodeId, uint length) external view returns (RewardEvent[] memory);

    /// @notice Returns the most recent `length` reward events of a specific type (0=Referral, 1=Direct, 2=Layer, 3=Matrix)
    function getIncomeByType(uint nodeId, uint rewardType, uint length) external view returns (RewardEvent[] memory);

    /// @notice Returns a full income breakdown for a node
    function getIncomeBreakdown(uint _nodeId) external view returns (
        uint total,
        uint referral,
        uint tier,
        uint binary,
        uint direct,
        uint lost,
        uint poolIncome
    );

    /// @notice Returns the total lifetime income for a node
    function getTotalIncome(uint nodeId) external view returns (uint);

    /// @notice Returns the count of direct referrals for a node
    function getDirectReferrals(uint nodeId) external view returns (uint count);

    /// @notice Returns how many days since this node registered (for daysActive)
    function getNodeCurDay(uint nodeId) external view returns (uint);

    // ── MATRIX QUERIES ─────────────────────────────────────────────────────

    /// @notice Returns the two direct binary children of a Node
    function getMatrixDirect(uint _nodeId) external view returns (uint[2] memory);

    /// @notice Returns matrix parent and children for a Node
    function getMatrixPosition(uint _nodeId) external view returns (
        uint matrixParentId,
        uint leftChild,
        uint rightChild
    );

    /// @notice Number of nodes at a given matrix depth for a given Node
    function getTeamSize(uint _nodeId, uint _depth) external view returns (uint);

    /// @notice Paginated matrix layer members (Node structs)
    function getMatrixUsers(uint nodeId, uint layer, uint startIndex, uint num)
        external view returns (Node[] memory);

    /// @notice Paginated referral network members at a given depth
    function getNetworkNodes(uint nodeId, uint layer, uint num)
        external view returns (Node[] memory);

    /// @notice Paginated referral network members mapped with explicitly bypassed income variables
    function getNetworkNodesWithStats(uint nodeId, uint layer, uint num)
        external view returns (NodeWithStats[] memory);

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

    /// @notice Genesis Node ID (root of the tree)
    function defaultRefer() external view returns (uint);

    /// @notice Current BNB/USD price used for tier cost calculation (8 decimals)
    function bnbPrice() external view returns (uint);

    /// @notice Timestamp of last oracle price update
    function lastPriceUpdate() external view returns (uint);

    /// @notice Whether contract ownership has been renounced
    function isOwnershipRenounced() external view returns (bool);

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

    /// @notice Returns pending feeReceiver accruals split by type
    function getFeeReceiverBreakdown() external view returns (
        uint platformFees,
        uint missedRewards,
        uint totalPending
    );

    // ── ADMIN / GOVERNANCE ─────────────────────────────────────────────────

    /// @notice Updates addresses: type 0=feeReceiver, 1=rewardPool, 7+=admin roles
    function setAddr(uint _type, address _new, uint _num) external;

    /// @notice Owner: Sweep any accidental BNB to owner (replaces accrual sweep)
    function rescueBNB(uint _amount) external;

    /// @notice [DEPRECATED] Use rescueBNB. Now a no-op as funds are routed immediately.
    function sweepFeeReceiver() external;

    /// @notice Oracle admin: manually set BNB price (max 20% deviation)
    function manualUpdatePrice(uint _newPrice) external;

    /// @notice Owner: set safe BNB price bounds for oracle validation
    function setPriceBounds(uint _min, uint _max) external;

    /// @notice Owner: permanently renounce contract ownership
    function renounceOwnership() external;

    /// @notice Owner: transfer contract ownership to a new address
    function transferOwnership(address _newOwner) external;
}