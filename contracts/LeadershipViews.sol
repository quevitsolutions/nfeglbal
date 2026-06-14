// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RewardPoolLeadership.sol";

contract LeadershipViews {

    struct NodeLeadershipView {
        uint256 nodeId;
        uint256 rank;
        bool isActive;
        uint256 bronzeAchieversCount;
        uint256 silverAchieversCount;
        uint256 goldAchieversCount;
        uint256 recentBronzeAchievements;
        uint256 recentSilverAchievements;
        uint256 recentGoldAchievements;
        uint256 claimableFounder;
        uint256 claimableSenior;
        uint256 claimableAmbassador;
        uint256 claimableTotal;
        uint256 lifetimeEarned;
        uint256 lifetimeClaimed;
    }

    struct GlobalLeadershipView {
        uint256 founderMembersCount;
        uint256 seniorMembersCount;
        uint256 ambassadorMembersCount;
        uint256 founderAccumulator;
        uint256 seniorAccumulator;
        uint256 ambassadorAccumulator;
        uint256 totalReceived;
        uint256 totalDistributed;
    }

    address public leadershipEngine;

    constructor(address _engine) {
        require(_engine != address(0), "Zero engine address");
        leadershipEngine = _engine;
    }

    // View helper for a single node's leadership status
    function getNodeView(uint256 nodeId) external view returns (NodeLeadershipView memory) {
        RewardPoolLeadership engineContract = RewardPoolLeadership(payable(leadershipEngine));

        uint256 rVal = uint256(engineContract.rank(nodeId));
        bool isActive = engineContract.isLeadershipActive(nodeId, uint8(rVal));

        uint256 bronzeCount = engineContract.bronzeAchievers(nodeId);
        uint256 silverCount = engineContract.silverAchievers(nodeId);
        uint256 goldCount = engineContract.goldAchievers(nodeId);

        uint256 recentBronze = engineContract.getRecentAchievements(nodeId, 1);
        uint256 recentSilver = engineContract.getRecentAchievements(nodeId, 2);
        uint256 recentGold = engineContract.getRecentAchievements(nodeId, 3);

        uint256 claimableF = engineContract.getPendingRewards(nodeId, 1);
        uint256 claimableS = engineContract.getPendingRewards(nodeId, 2);
        uint256 claimableA = engineContract.getPendingRewards(nodeId, 3);

        uint256 accumulated = engineContract.accumulatedLeadershipRewards(nodeId);
        uint256 claimableTotal = claimableF + claimableS + claimableA + accumulated;

        uint256 claimed = engineContract.claimedLeadershipRewards(nodeId);
        uint256 lifetime = claimed + claimableTotal;

        return NodeLeadershipView({
            nodeId: nodeId,
            rank: rVal,
            isActive: isActive,
            bronzeAchieversCount: bronzeCount,
            silverAchieversCount: silverCount,
            goldAchieversCount: goldCount,
            recentBronzeAchievements: recentBronze,
            recentSilverAchievements: recentSilver,
            recentGoldAchievements: recentGold,
            claimableFounder: claimableF,
            claimableSenior: claimableS,
            claimableAmbassador: claimableA,
            claimableTotal: claimableTotal,
            lifetimeEarned: lifetime,
            lifetimeClaimed: claimed
        });
    }

    // View helper for global leadership engine stats
    function getGlobalView() external view returns (GlobalLeadershipView memory) {
        RewardPoolLeadership engineContract = RewardPoolLeadership(payable(leadershipEngine));

        return GlobalLeadershipView({
            founderMembersCount: engineContract.founderMembers(),
            seniorMembersCount: engineContract.seniorMembers(),
            ambassadorMembersCount: engineContract.ambassadorMembers(),
            founderAccumulator: engineContract.founderAccPerShare(),
            seniorAccumulator: engineContract.seniorAccPerShare(),
            ambassadorAccumulator: engineContract.ambassadorAccPerShare(),
            totalReceived: engineContract.totalLeadershipReceived(),
            totalDistributed: engineContract.totalLeadershipDistributed()
        });
    }
}
