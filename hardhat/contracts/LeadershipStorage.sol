// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LeadershipInterfaces.sol";

abstract contract LeadershipStorage {
    // Requirements (Configurable)
    uint256 public founderBronzeRequired = 10;
    uint256 public seniorSilverRequired = 5;
    uint256 public ambassadorGoldRequired = 3;

    // Activity maintenance rules (Configurable)
    uint256 public founderActivityRequired = 1;
    uint256 public founderActivityWindow = 30 days;

    uint256 public seniorActivityRequired = 1;
    uint256 public seniorActivityWindow = 30 days;

    uint256 public ambassadorActivityRequired = 1;
    uint256 public ambassadorActivityWindow = 30 days;

    // Achievement counts (sponsor mapping)
    mapping(uint256 => uint256) public bronzeAchievers;
    mapping(uint256 => uint256) public silverAchievers;
    mapping(uint256 => uint256) public goldAchievers;

    // Deduplication mappings
    mapping(uint256 => bool) public countedBronze;
    mapping(uint256 => bool) public countedSilver;
    mapping(uint256 => bool) public countedGold;

    // Ring buffers for activity
    struct RingBuffer {
        uint32[10] timestamps;
        uint16 writeIdx;
        uint32 count;
    }
    mapping(uint256 => RingBuffer) public bronzeActivity;
    mapping(uint256 => RingBuffer) public silverActivity;
    mapping(uint256 => RingBuffer) public goldActivity;

    // Leadership status
    enum LeadershipRank {
        None,
        Founder,
        SeniorFounder,
        Ambassador
    }
    mapping(uint256 => LeadershipRank) public rank;
    mapping(uint256 => bool) public isRankActive;

    // Funding configurations
    uint256 public leadershipAllocationBP = 5000; // 50%
    uint256 public founderPoolShareBP = 5000;      // 50%
    uint256 public seniorPoolShareBP = 3000;       // 30%
    uint256 public ambassadorPoolShareBP = 2000;   // 20%

    // Accounting Accumulators (wei, scaled by 1e18)
    uint256 public founderAccPerShare;
    uint256 public seniorAccPerShare;
    uint256 public ambassadorAccPerShare;

    // Per-node debt
    mapping(uint256 => uint256) public founderDebt;
    mapping(uint256 => uint256) public seniorDebt;
    mapping(uint256 => uint256) public ambassadorDebt;

    // Member counts
    uint256 public founderMembers;
    uint256 public seniorMembers;
    uint256 public ambassadorMembers;

    // Harvested/claimed rewards tracking
    mapping(uint256 => uint256) public accumulatedLeadershipRewards;
    mapping(uint256 => uint256) public claimedLeadershipRewards;

    // Residual values when active members are 0
    uint256 public residualFounder;
    uint256 public residualSenior;
    uint256 public residualAmbassador;

    // Global counters
    uint256 public totalLeadershipReceived;
    uint256 public totalLeadershipDistributed;
    
    // Address of the core contracts
    address public engine;
    address public rewardPool; // RewardPool contract address
    address public feeReceiverWallet; // Where the other 50% goes
    address public owner;
}
