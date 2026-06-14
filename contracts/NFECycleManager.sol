// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =============================================================================
//  NFECycleManager.sol — Subscription Lifecycle Registry
//
//  Tracks whether a node has an active annual subscription.
//  NEVER duplicates tree data. Only stores lightweight participation flags.
//  Genesis node (55555) is permanently active and exempt from all checks.
// =============================================================================

import "./NFEInterfaces.sol";

/**
 * @title NFECycleManager
 * @author NFEGlobal ICE Team
 * @notice Manages the annual subscription lifecycle for the NFEGlobal ICE system.
 *         Nodes must renew every cycle to remain "active". Earned/vested rewards
 *         are ALWAYS claimable regardless of active status — no restriction.
 *
 * @dev Only stores {cycleStart, cycleEnd, cycleId, active} per node.
 *      All permanent tree data lives in nfeglobal.sol and is never touched here.
 */
contract NFECycleManager is ICycleManager {

    // =========================================================================
    // Constants
    // =========================================================================

    uint256 public constant GENESIS_NODE_ID = 55555;

    // =========================================================================
    // State
    // =========================================================================

    address public owner;
    address public renewalEngine;

    uint256 public override cycleDuration = 360 days;
    uint32  public override currentCycle;
    uint256 public cycleStartTime;

    struct SubscriptionInfo {
        uint64 cycleStart;
        uint64 cycleEnd;
        uint32 cycleId;
        bool   active;
    }

    /// @notice Maps nodeId => subscription info
    mapping(uint256 => SubscriptionInfo) public subscriptions;

    /// @notice Maps nodeId => cycleId => participated
    mapping(uint256 => mapping(uint32 => bool)) public cycleParticipation;

    // =========================================================================
    // Events
    // =========================================================================

    event NodeActivated(uint256 indexed nodeId, uint32 indexed cycleId, uint64 cycleEnd);
    event NodeDeactivated(uint256 indexed nodeId, uint32 indexed cycleId);
    event CycleAdvanced(uint32 indexed newCycle, uint256 timestamp);
    event RenewalEngineUpdated(address indexed oldEngine, address indexed newEngine);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "NFECycleManager: not owner");
        _;
    }

    modifier onlyRenewalEngine() {
        require(msg.sender == renewalEngine, "NFECycleManager: not renewal engine");
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _owner) {
        require(_owner != address(0), "NFECycleManager: zero owner");
        owner         = _owner;
        currentCycle  = 1;
        cycleStartTime = block.timestamp;
    }

    // =========================================================================
    // ICycleManager Implementation
    // =========================================================================

    /**
     * @notice Returns true if the node has an active subscription or is genesis.
     * @dev Genesis node (55555) is always active and exempt from all checks.
     */
    function isActive(uint256 nodeId) external view override returns (bool) {
        if (nodeId == GENESIS_NODE_ID) return true;
        SubscriptionInfo storage sub = subscriptions[nodeId];
        return sub.active && block.timestamp <= sub.cycleEnd;
    }

    /**
     * @notice Activate a node for a specific cycle. Called exclusively by RenewalEngine.
     * @param nodeId   The node to activate.
     * @param cycleId  The cycle ID to activate for.
     */
    function activateNode(uint256 nodeId, uint32 cycleId) external override onlyRenewalEngine {
        require(nodeId != 0, "NFECycleManager: invalid node");
        uint64 start = uint64(block.timestamp);
        uint64 end   = uint64(block.timestamp + cycleDuration);

        subscriptions[nodeId] = SubscriptionInfo({
            cycleStart : start,
            cycleEnd   : end,
            cycleId    : cycleId,
            active     : true
        });

        cycleParticipation[nodeId][cycleId] = true;

        emit NodeActivated(nodeId, cycleId, end);
    }

    /**
     * @notice Deactivate a node. Called by RenewalEngine or keeper after expiry.
     * @param nodeId  The node to deactivate.
     */
    function deactivateNode(uint256 nodeId) external override onlyRenewalEngine {
        require(nodeId != GENESIS_NODE_ID, "NFECycleManager: genesis exempt");
        SubscriptionInfo storage sub = subscriptions[nodeId];
        if (sub.active) {
            sub.active = false;
            emit NodeDeactivated(nodeId, sub.cycleId);
        }
    }

    /**
     * @notice Permissionless keeper: check and expire a node if past cycleEnd.
     * @param nodeId  The node to check.
     */
    function checkAndExpire(uint256 nodeId) external override {
        if (nodeId == GENESIS_NODE_ID) return;
        SubscriptionInfo storage sub = subscriptions[nodeId];
        if (sub.active && block.timestamp > sub.cycleEnd) {
            sub.active = false;
            emit NodeDeactivated(nodeId, sub.cycleId);
        }
    }

    /**
     * @notice Batch keeper: check and expire multiple nodes.
     * @param nodeIds  Array of node IDs to check (max 100 per call).
     */
    function batchCheckAndExpire(uint256[] calldata nodeIds) external {
        uint256 len = nodeIds.length;
        require(len <= 100, "NFECycleManager: max 100 per batch");
        for (uint256 i = 0; i < len; ) {
            uint256 nodeId = nodeIds[i];
            if (nodeId != GENESIS_NODE_ID) {
                SubscriptionInfo storage sub = subscriptions[nodeId];
                if (sub.active && block.timestamp > sub.cycleEnd) {
                    sub.active = false;
                    emit NodeDeactivated(nodeId, sub.cycleId);
                }
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Get subscription info for a node.
     */
    function getSubscription(uint256 nodeId) external view override returns (
        uint64 cycleStart,
        uint64 cycleEnd,
        uint32 cycleId,
        bool   active
    ) {
        SubscriptionInfo storage sub = subscriptions[nodeId];
        return (sub.cycleStart, sub.cycleEnd, sub.cycleId, sub.active);
    }

    /**
     * @notice Check if a node participated in a specific cycle.
     */
    function didParticipate(uint256 nodeId, uint32 cycleId) external view returns (bool) {
        if (nodeId == GENESIS_NODE_ID) return true;
        return cycleParticipation[nodeId][cycleId];
    }

    /**
     * @notice Get days remaining in a node's subscription.
     */
    function daysRemaining(uint256 nodeId) external view returns (uint256) {
        if (nodeId == GENESIS_NODE_ID) return type(uint256).max;
        SubscriptionInfo storage sub = subscriptions[nodeId];
        if (!sub.active || block.timestamp >= sub.cycleEnd) return 0;
        return (sub.cycleEnd - block.timestamp) / 1 days;
    }

    // =========================================================================
    // Admin: Cycle Advancement
    // =========================================================================

    /**
     * @notice Advance to the next global cycle. Only callable by owner.
     * @dev This increments the cycle ID and resets cycleStartTime.
     *      Existing active subscriptions retain their individual cycleEnd timestamps
     *      — they are not invalidated by cycle advancement.
     */
    function advanceCycle() external onlyOwner {
        currentCycle += 1;
        cycleStartTime = block.timestamp;
        emit CycleAdvanced(currentCycle, block.timestamp);
    }

    /**
     * @notice Update the cycle duration (360 days default).
     * @param _duration  New duration in seconds. Must be between 30 and 730 days.
     */
    function setCycleDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 30 days,  "NFECycleManager: too short");
        require(_duration <= 730 days, "NFECycleManager: too long");
        cycleDuration = _duration;
    }

    // =========================================================================
    // Admin: Access Control
    // =========================================================================

    /**
     * @notice Register the RenewalEngine contract. Only owner.
     * @param _engine  Address of the NFERenewalEngine contract.
     */
    function setRenewalEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "NFECycleManager: zero address");
        address old = renewalEngine;
        renewalEngine = _engine;
        emit RenewalEngineUpdated(old, _engine);
    }

    /**
     * @notice Transfer ownership.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "NFECycleManager: zero address");
        address old = owner;
        owner = _newOwner;
        emit OwnershipTransferred(old, _newOwner);
    }
}
