// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRewardPoolLeadership {
    function claimFor(uint256 nodeId) external returns (uint256);
    function recordAchievement(uint256 nodeId, uint8 poolId) external;
    function syncLeadershipStatus(uint256 nodeId) external;
    function isLeadershipActive(uint256 nodeId, uint8 rankVal) external view returns (bool);
    function getRecentAchievements(uint256 nodeId, uint8 poolId) external view returns (uint256);
    function getPendingRewards(uint256 nodeId, uint8 poolId) external view returns (uint256);
    function getClaimableTotal(uint256 nodeId) external view returns (uint256);
}

interface IRewardPool {
    function nodePool(uint256 nodeId) external view returns (uint8);
    // returns engine address
    function engine() external view returns (address);
}
