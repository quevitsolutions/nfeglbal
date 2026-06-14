// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =============================================================================
//  NFEInterfaces.sol — Shared interfaces for the NFEGlobal ICE system
//  All ICE contracts import only this file for cross-contract calls.
// =============================================================================

/**
 * @title ICycleManager
 * @notice Interface for NFECycleManager — subscription lifecycle flags.
 */
interface ICycleManager {
    /// @notice Returns true if the node has an active subscription or is genesis.
    function isActive(uint256 nodeId) external view returns (bool);

    /// @notice Returns the current cycle ID.
    function currentCycle() external view returns (uint32);

    /// @notice Returns the duration of one cycle in seconds.
    function cycleDuration() external view returns (uint256);

    /// @notice Activate a node for the current cycle. Called by RenewalEngine.
    function activateNode(uint256 nodeId, uint32 cycleId) external;

    /// @notice Deactivate a node (expire subscription). Called by RenewalEngine or keeper.
    function deactivateNode(uint256 nodeId) external;

    /// @notice Check and expire a node if overdue. Permissionless keeper call.
    function checkAndExpire(uint256 nodeId) external;

    /// @notice Get subscription info for a node.
    function getSubscription(uint256 nodeId) external view returns (
        uint64 cycleStart,
        uint64 cycleEnd,
        uint32 cycleId,
        bool   active
    );
}

/**
 * @title IVestingVault
 * @notice Interface for NFEVestingVault — reward vesting and claims.
 */
interface IVestingVault {
    /// @notice Deposit BNB into vesting for a specific node. Called by core/rewardPool.
    function deposit(uint256 nodeId) external payable;

    /// @notice Get total vested (claimable right now) balance for a node.
    function getVestedBalance(uint256 nodeId) external view returns (uint256);

    /// @notice Get total deposited (all-time, including not-yet-vested) for a node.
    function getTotalDeposited(uint256 nodeId) external view returns (uint256);

    /// @notice Deduct from a node's vested balance — called by RenewalEngine to fund renewals.
    function deductVested(uint256 nodeId, uint256 amount) external;

    /// @notice Get number of vesting positions for a node.
    function getPositionCount(uint256 nodeId) external view returns (uint256);
}

/**
 * @title ICoreEngine
 * @notice Minimal interface for nfeglobal.sol used by ICE contracts.
 */
interface ICoreEngine {
    /// @notice Get the BNB cost for a tier index (0-indexed, tier 0 = Tier 1).
    function getTierCost(uint256 tierIndex) external view returns (uint256);

    /// @notice Get wallet address of a node.
    function getNodeWallet(uint256 nodeId) external view returns (address);

    /// @notice Get total contribution of a node.
    function getNodeContribution(uint256 nodeId) external view returns (uint256);

    /// @notice Get nodeId for an address.
    function nodeId(address wallet) external view returns (uint256);

    /// @notice Treasury balance for a node.
    function treasuryBalance(uint256 nodeId) external view returns (uint256);

    /// @notice Execute full tier distribution (direct+layer+matrix+pool+fee) for a renewal.
    ///         Only callable by renewalEngine.
    function distributeRenewal(uint256 nodeId, uint256 costBNB) external payable;

    /// @notice Deduct from a node's treasury balance. Only callable by renewalEngine.
    function deductTreasury(uint256 nodeId, uint256 amount) external;
}

/**
 * @title IRenewalEngine
 * @notice Interface for NFERenewalEngine.
 */
interface IRenewalEngine {
    /// @notice Renew a node's subscription. Callable by node wallet or keeper.
    function renewFor(uint256 nodeId) external payable;

    /// @notice Get the current renewal cost in native token (live oracle price).
    function getRenewalCost() external view returns (uint256);
}
