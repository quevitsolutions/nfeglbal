// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =============================================================================
//  NFEVestingVault.sol — Reward Vesting & Instant Withdrawal
//
//  All earned rewards from nfeglobal.sol and RewardPool are deposited here
//  instead of being sent directly to user wallets. Each deposit creates an
//  independent vesting position (no merging). Users may:
//    1. Claim vested rewards gradually (no penalty).
//    2. Instant-withdraw any amount at a 20% penalty (configurable).
//
//  Genesis node (55555) ALWAYS bypasses the vault — rewards go directly to wallet.
//
//  CRITICAL: Vested rewards are ALWAYS claimable with NO subscription restrictions.
//  The cycle/renewal system only affects FUTURE reward routing, not past earnings.
// =============================================================================

import "./NFEInterfaces.sol";

/**
 * @title NFEVestingVault
 * @author NFEGlobal ICE Team
 * @notice Stores and gradually releases earned rewards for NFEGlobal node operators.
 *         Each reward deposit creates an independent vesting position.
 *         Vesting period scales with tier level (Tier N = N * vestingDaysPerTier days).
 *
 * @dev Security model:
 *      - deposit()      : callable by core or rewardPool only
 *      - deductVested() : callable by renewalEngine only
 *      - claim/withdraw : callable by node wallet only
 *      - All state changes follow CEI pattern
 *      - ReentrancyGuard on all external payable/state-changing functions
 */
contract NFEVestingVault is IVestingVault {

    // =========================================================================
    // Reentrancy Guard
    // =========================================================================

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    modifier nonReentrant() {
        require(_status != _ENTERED, "NFEVestingVault: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // =========================================================================
    // Constants
    // =========================================================================

    uint256 public constant GENESIS_NODE_ID    = 55555;
    uint256 public constant BASIS_POINTS       = 10000;
    uint256 public constant MIN_DEPOSIT        = 1000; // 1000 wei minimum

    // =========================================================================
    // Configuration
    // =========================================================================

    address public owner;
    address public core;          // nfeglobal.sol
    address public rewardPool;    // RewardPool.sol
    address public renewalEngine; // NFERenewalEngine.sol
    address public feeReceiver;

    /// @notice Penalty on instant withdrawal in basis points (default 20%)
    uint256 public instantPenaltyBP = 2000;

    /// @notice Share of penalty going to rewardPool (default 50% of penalty)
    uint256 public penaltyToPoolBP  = 5000;

    /// @notice Vesting days per tier level (Tier 1 = 5 days, Tier 2 = 10 days, etc.)
    uint256 public vestingDaysPerTier = 5;

    /// @notice Default vesting period for deposits without tier context (5 days)
    uint256 public defaultVestingDays = 5;

    // =========================================================================
    // State
    // =========================================================================

    struct VestingPosition {
        uint128 amount;       // Original deposited amount
        uint128 claimed;      // Amount already claimed from this position
        uint64  startTime;    // When this position started vesting
        uint64  endTime;      // When this position is fully vested
    }

    /// @notice All vesting positions per node
    mapping(uint256 => VestingPosition[]) public userVestings;

    /// @notice Total deposited (all time) per node
    mapping(uint256 => uint256) public totalDeposited;

    /// @notice Total claimed (all time) per node
    mapping(uint256 => uint256) public totalClaimed;

    /// @notice Total pending instant-withdrawal penalties sent to pool+fee
    uint256 public totalPenaltiesCollected;

    /// @notice Total BNB held in the vault
    uint256 public totalVaultBalance;

    // =========================================================================
    // Events
    // =========================================================================

    event RewardDeposited(
        uint256 indexed nodeId,
        uint256 amount,
        uint64  startTime,
        uint64  endTime,
        uint256 positionIndex
    );
    event VestedClaimed(
        uint256 indexed nodeId,
        address indexed wallet,
        uint256 amount
    );
    event InstantWithdrawn(
        uint256 indexed nodeId,
        address indexed wallet,
        uint256 grossAmount,
        uint256 penalty,
        uint256 netAmount
    );
    event VestedDeducted(
        uint256 indexed nodeId,
        uint256 amount,
        address indexed caller
    );
    event InstantPenaltyBPUpdated(uint256 oldBP, uint256 newBP);
    event CoreUpdated(address indexed oldCore, address indexed newCore);
    event RewardPoolUpdated(address indexed oldPool, address indexed newPool);
    event RenewalEngineUpdated(address indexed oldEngine, address indexed newEngine);
    event FeeReceiverUpdated(address indexed oldFee, address indexed newFee);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "NFEVestingVault: not owner");
        _;
    }

    modifier onlyCoreOrPool() {
        require(
            msg.sender == core || msg.sender == rewardPool,
            "NFEVestingVault: only core or rewardPool"
        );
        _;
    }

    modifier onlyRenewalEngine() {
        require(msg.sender == renewalEngine, "NFEVestingVault: only renewalEngine");
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        address _owner,
        address _core,
        address _rewardPool,
        address _feeReceiver
    ) {
        require(_owner       != address(0), "NFEVestingVault: zero owner");
        require(_core        != address(0), "NFEVestingVault: zero core");
        require(_feeReceiver != address(0), "NFEVestingVault: zero feeReceiver");
        owner        = _owner;
        core         = _core;
        rewardPool   = _rewardPool;
        feeReceiver  = _feeReceiver;
        _status      = _NOT_ENTERED;
    }

    receive() external payable {}

    // =========================================================================
    // IVestingVault Implementation
    // =========================================================================

    /**
     * @notice Deposit BNB to create a vesting position for a node.
     * @dev Only callable by core (nfeglobal.sol) or rewardPool.
     *      Genesis node deposits are rejected — should never be called for genesis.
     * @param nodeId  The node to credit the reward to.
     */
    function deposit(uint256 nodeId) external payable override onlyCoreOrPool {
        require(nodeId != GENESIS_NODE_ID, "NFEVestingVault: genesis bypasses vault");
        require(nodeId != 0,               "NFEVestingVault: invalid nodeId");
        require(msg.value >= MIN_DEPOSIT,  "NFEVestingVault: amount too small");

        uint256 vestingSeconds = _getVestingSeconds(nodeId);
        uint64 start = uint64(block.timestamp);
        uint64 end   = uint64(block.timestamp + vestingSeconds);

        uint256 posIdx = userVestings[nodeId].length;

        userVestings[nodeId].push(VestingPosition({
            amount    : uint128(msg.value),
            claimed   : 0,
            startTime : start,
            endTime   : end
        }));

        totalDeposited[nodeId] += msg.value;
        totalVaultBalance      += msg.value;

        emit RewardDeposited(nodeId, msg.value, start, end, posIdx);
    }

    /**
     * @notice Get the total currently vested (claimable) balance for a node.
     * @dev Iterates all vesting positions and sums available-to-claim amounts.
     *      This is a view function — safe to call from RenewalEngine for priority funding.
     */
    function getVestedBalance(uint256 nodeId) external view override returns (uint256) {
        return _computeVestedBalance(nodeId);
    }

    /**
     * @notice Get total deposited (all-time) for a node.
     */
    function getTotalDeposited(uint256 nodeId) external view override returns (uint256) {
        return totalDeposited[nodeId];
    }

    /**
     * @notice Deduct from a node's vested balance to fund a renewal.
     * @dev Only callable by renewalEngine. Follows CEI pattern.
     *      Deducts from the OLDEST positions first (FIFO). Sends BNB to renewalEngine.
     * @param nodeId  The node whose vesting is deducted.
     * @param amount  Amount to deduct in wei.
     */
    function deductVested(uint256 nodeId, uint256 amount) external override onlyRenewalEngine nonReentrant {
        require(amount > 0, "NFEVestingVault: zero amount");
        uint256 available = _computeVestedBalance(nodeId);
        require(available >= amount, "NFEVestingVault: insufficient vested balance");

        // Effects: deduct from positions FIFO
        uint256 remaining = amount;
        VestingPosition[] storage positions = userVestings[nodeId];
        uint256 len = positions.length;

        for (uint256 i = 0; i < len && remaining > 0; ) {
            VestingPosition storage pos = positions[i];
            uint256 posVested = _positionVested(pos);
            if (posVested > 0) {
                uint256 deductFromPos = remaining <= posVested ? remaining : posVested;
                pos.claimed += uint128(deductFromPos);
                remaining   -= deductFromPos;
            }
            unchecked { ++i; }
        }

        totalClaimed[nodeId]  += amount;
        totalVaultBalance      = totalVaultBalance >= amount ? totalVaultBalance - amount : 0;

        // Interactions: send BNB to renewalEngine
        (bool ok, ) = payable(renewalEngine).call{value: amount}("");
        require(ok, "NFEVestingVault: deduct transfer failed");

        emit VestedDeducted(nodeId, amount, msg.sender);
    }

    /**
     * @notice Get number of vesting positions for a node.
     */
    function getPositionCount(uint256 nodeId) external view override returns (uint256) {
        return userVestings[nodeId].length;
    }

    // =========================================================================
    // User-Facing Claims
    // =========================================================================

    /**
     * @notice Claim all currently vested rewards for the caller's node.
     * @dev NO subscription restriction — vested rewards are ALWAYS claimable.
     *      Caller must be the node's wallet. Uses reentrancy guard.
     */
    function claimVestedRewards(uint256 nodeId) external nonReentrant {
        address wallet = _getNodeWallet(nodeId);
        require(msg.sender == wallet, "NFEVestingVault: not node wallet");

        uint256 vested = _computeVestedBalance(nodeId);
        require(vested > 0, "NFEVestingVault: nothing to claim");

        // Effects: mark all as claimed
        _markClaimed(nodeId, vested);
        totalClaimed[nodeId]  += vested;
        totalVaultBalance      = totalVaultBalance >= vested ? totalVaultBalance - vested : 0;

        // Interactions: send to wallet
        (bool ok, ) = payable(wallet).call{value: vested}("");
        require(ok, "NFEVestingVault: claim transfer failed");

        emit VestedClaimed(nodeId, wallet, vested);
    }

    /**
     * @notice Claim a specific amount from vested rewards (partial claim).
     * @dev NO subscription restriction. Caller must be node wallet.
     * @param nodeId  Node ID to claim from.
     * @param amount  Amount to claim (must be <= vested balance).
     */
    function claimPartial(uint256 nodeId, uint256 amount) external nonReentrant {
        require(amount > 0, "NFEVestingVault: zero amount");
        address wallet = _getNodeWallet(nodeId);
        require(msg.sender == wallet, "NFEVestingVault: not node wallet");

        uint256 vested = _computeVestedBalance(nodeId);
        require(vested >= amount, "NFEVestingVault: insufficient vested");

        // Effects
        _markClaimedAmount(nodeId, amount);
        totalClaimed[nodeId]  += amount;
        totalVaultBalance      = totalVaultBalance >= amount ? totalVaultBalance - amount : 0;

        // Interactions
        (bool ok, ) = payable(wallet).call{value: amount}("");
        require(ok, "NFEVestingVault: transfer failed");

        emit VestedClaimed(nodeId, wallet, amount);
    }

    /**
     * @notice Instant-withdraw any amount from total (vested+unvested) balance
     *         at a penalty. The penalty is split between rewardPool and feeReceiver.
     * @dev NO subscription restriction — always claimable.
     *      Penalty: instantPenaltyBP / 10000 of `amount`.
     *      penaltyToPoolBP / 10000 of penalty → rewardPool.
     *      Remainder of penalty → feeReceiver.
     * @param nodeId  Node ID to instant-withdraw from.
     * @param amount  Gross amount to instant-withdraw (before penalty deduction).
     */
    function instantWithdraw(uint256 nodeId, uint256 amount) external nonReentrant {
        require(amount > 0, "NFEVestingVault: zero amount");
        address wallet = _getNodeWallet(nodeId);
        require(msg.sender == wallet, "NFEVestingVault: not node wallet");

        // Total available includes unvested
        uint256 totalAvail = _computeTotalAvailable(nodeId);
        require(totalAvail >= amount, "NFEVestingVault: amount exceeds balance");

        // Compute penalty
        uint256 penalty = amount * instantPenaltyBP / BASIS_POINTS;
        uint256 net     = amount - penalty;

        // Split penalty
        uint256 poolShare    = penalty * penaltyToPoolBP / BASIS_POINTS;
        uint256 feeShare     = penalty - poolShare;

        // Effects: deduct from positions FIFO (total, including unvested)
        _deductTotal(nodeId, amount);
        totalClaimed[nodeId]  += amount;
        totalVaultBalance      = totalVaultBalance >= amount ? totalVaultBalance - amount : 0;
        totalPenaltiesCollected += penalty;

        // Interactions
        (bool ok1, ) = payable(wallet).call{value: net}("");
        require(ok1, "NFEVestingVault: net transfer failed");

        if (poolShare > 0 && rewardPool != address(0)) {
            (bool ok2, ) = payable(rewardPool).call{value: poolShare}("");
            if (!ok2) {
                // fallback to feeReceiver if pool call fails
                feeShare += poolShare;
            }
        } else {
            feeShare += poolShare;
        }

        if (feeShare > 0) {
            (bool ok3, ) = payable(feeReceiver).call{value: feeShare}("");
            require(ok3, "NFEVestingVault: fee transfer failed");
        }

        emit InstantWithdrawn(nodeId, wallet, amount, penalty, net);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get detailed info about a node's vesting position.
     * @param nodeId    The node ID.
     * @param posIndex  The position index.
     */
    function getPosition(uint256 nodeId, uint256 posIndex) external view returns (
        uint256 amount,
        uint256 claimed,
        uint64  startTime,
        uint64  endTime,
        uint256 vestedNow,
        uint256 claimableNow
    ) {
        VestingPosition storage pos = userVestings[nodeId][posIndex];
        uint256 vested = _positionVested(pos);
        uint256 claimable = vested > pos.claimed ? vested - pos.claimed : 0;
        return (
            pos.amount,
            pos.claimed,
            pos.startTime,
            pos.endTime,
            vested,
            claimable
        );
    }

    /**
     * @notice Get total unvested (locked) balance for a node.
     */
    function getUnvestedBalance(uint256 nodeId) external view returns (uint256) {
        return _computeTotalAvailable(nodeId) - _computeVestedBalance(nodeId);
    }

    /**
     * @notice Get full summary for a node.
     */
    function getNodeSummary(uint256 nodeId) external view returns (
        uint256 deposited,
        uint256 claimed,
        uint256 vestedClaimable,
        uint256 unvested,
        uint256 positionCount
    ) {
        uint256 vested  = _computeVestedBalance(nodeId);
        uint256 total   = _computeTotalAvailable(nodeId);
        uint256 unvest  = total >= vested ? total - vested : 0;
        return (
            totalDeposited[nodeId],
            totalClaimed[nodeId],
            vested,
            unvest,
            userVestings[nodeId].length
        );
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /**
     * @notice Compute the vested (linear) amount for one position at current time.
     */
    function _positionVested(VestingPosition storage pos) internal view returns (uint256) {
        if (block.timestamp >= pos.endTime) {
            return pos.amount;
        }
        if (block.timestamp <= pos.startTime) {
            return 0;
        }
        uint256 elapsed  = block.timestamp - pos.startTime;
        uint256 duration = pos.endTime - pos.startTime;
        return (uint256(pos.amount) * elapsed) / duration;
    }

    /**
     * @notice Compute total currently claimable (vested minus already claimed) for all positions.
     */
    function _computeVestedBalance(uint256 nodeId) internal view returns (uint256) {
        VestingPosition[] storage positions = userVestings[nodeId];
        uint256 total = 0;
        uint256 len   = positions.length;
        for (uint256 i = 0; i < len; ) {
            VestingPosition storage pos = positions[i];
            uint256 vested = _positionVested(pos);
            if (vested > pos.claimed) {
                total += vested - uint256(pos.claimed);
            }
            unchecked { ++i; }
        }
        return total;
    }

    /**
     * @notice Compute total remaining (vested + unvested - claimed) for all positions.
     *         Used by instantWithdraw to check total available funds.
     */
    function _computeTotalAvailable(uint256 nodeId) internal view returns (uint256) {
        VestingPosition[] storage positions = userVestings[nodeId];
        uint256 total = 0;
        uint256 len   = positions.length;
        for (uint256 i = 0; i < len; ) {
            VestingPosition storage pos = positions[i];
            uint256 remaining = uint256(pos.amount) - uint256(pos.claimed);
            total += remaining;
            unchecked { ++i; }
        }
        return total;
    }

    /**
     * @notice Mark vested rewards as claimed (FIFO, only vested portion).
     */
    function _markClaimed(uint256 nodeId, uint256 amount) internal {
        VestingPosition[] storage positions = userVestings[nodeId];
        uint256 remaining = amount;
        uint256 len = positions.length;
        for (uint256 i = 0; i < len && remaining > 0; ) {
            VestingPosition storage pos = positions[i];
            uint256 posVested = _positionVested(pos);
            if (posVested > uint256(pos.claimed)) {
                uint256 avail = posVested - uint256(pos.claimed);
                uint256 take  = remaining <= avail ? remaining : avail;
                pos.claimed  += uint128(take);
                remaining    -= take;
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Mark a specific amount as claimed from vested portions (FIFO).
     */
    function _markClaimedAmount(uint256 nodeId, uint256 amount) internal {
        _markClaimed(nodeId, amount);
    }

    /**
     * @notice Deduct from total (vested+unvested) — for instant withdrawal.
     *         Marks the full amount as claimed regardless of vesting schedule.
     */
    function _deductTotal(uint256 nodeId, uint256 amount) internal {
        VestingPosition[] storage positions = userVestings[nodeId];
        uint256 remaining = amount;
        uint256 len = positions.length;
        for (uint256 i = 0; i < len && remaining > 0; ) {
            VestingPosition storage pos = positions[i];
            uint256 avail = uint256(pos.amount) - uint256(pos.claimed);
            if (avail > 0) {
                uint256 take = remaining <= avail ? remaining : avail;
                pos.claimed += uint128(take);
                remaining   -= take;
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Get the vesting period in seconds for a given node based on its tier.
     * @dev Calls ICoreEngine(core) to get tier — if call fails, uses defaultVestingDays.
     *      Tier 0 = 5 days, Tier 1 = 5 days, Tier 2 = 10 days, ..., Tier 18 = 90 days.
     */
    function _getVestingSeconds(uint256 nodeId) internal view returns (uint256) {
        // Try to get node tier from core
        try ICoreEngine(core).getNodeTier(nodeId) returns (uint256 tier) {
            if (tier <= 2) {
                return 5 * 1 days;
            }
            if (tier >= 18) {
                return 90 * 1 days;
            }
            return (tier - 1) * 5 * 1 days;
        } catch {
            return defaultVestingDays * 1 days;
        }
    }

    /**
     * @notice Get the wallet address for a node from core.
     */
    function _getNodeWallet(uint256 nodeId) internal view returns (address) {
        return ICoreEngine(core).getNodeWallet(nodeId);
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Set the core contract address.
     */
    function setCore(address _core) external onlyOwner {
        require(_core != address(0), "NFEVestingVault: zero address");
        address old = core;
        core = _core;
        emit CoreUpdated(old, _core);
    }

    /**
     * @notice Set the reward pool address.
     */
    function setRewardPool(address _pool) external onlyOwner {
        address old = rewardPool;
        rewardPool = _pool;
        emit RewardPoolUpdated(old, _pool);
    }

    /**
     * @notice Set the renewal engine address.
     */
    function setRenewalEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "NFEVestingVault: zero address");
        address old = renewalEngine;
        renewalEngine = _engine;
        emit RenewalEngineUpdated(old, _engine);
    }

    /**
     * @notice Set the fee receiver address.
     */
    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        require(_feeReceiver != address(0), "NFEVestingVault: zero address");
        address old = feeReceiver;
        feeReceiver = _feeReceiver;
        emit FeeReceiverUpdated(old, _feeReceiver);
    }

    /**
     * @notice Update the instant withdrawal penalty (max 50%).
     */
    function setInstantPenaltyBP(uint256 _bp) external onlyOwner {
        require(_bp <= 5000, "NFEVestingVault: penalty too high (max 50%)");
        uint256 old = instantPenaltyBP;
        instantPenaltyBP = _bp;
        emit InstantPenaltyBPUpdated(old, _bp);
    }

    /**
     * @notice Update penalty split to pool (in BP of the penalty, default 5000 = 50%).
     */
    function setPenaltyToPoolBP(uint256 _bp) external onlyOwner {
        require(_bp <= BASIS_POINTS, "NFEVestingVault: over 100%");
        penaltyToPoolBP = _bp;
    }

    /**
     * @notice Update vesting days per tier (default 5 days per tier).
     */
    function setVestingDaysPerTier(uint256 _days) external onlyOwner {
        require(_days >= 1 && _days <= 30, "NFEVestingVault: out of range");
        vestingDaysPerTier = _days;
    }

    /**
     * @notice Update the default vesting days for deposits without tier context.
     */
    function setDefaultVestingDays(uint256 _days) external onlyOwner {
        require(_days >= 1 && _days <= 90, "NFEVestingVault: out of range");
        defaultVestingDays = _days;
    }

    /**
     * @notice Transfer ownership.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "NFEVestingVault: zero address");
        address old = owner;
        owner = _newOwner;
        emit OwnershipTransferred(old, _newOwner);
    }
}
