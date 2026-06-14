// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Infeglobal.sol";

interface ICoreEngine {
    function getNodeWallet(uint256 nodeId) external view returns (address);
    function getNode(uint256 nodeId) external view returns (Infeglobal.Node memory);
    function getRegistrationFee() external view returns (uint256);
    function getTierCost(uint256 tierIndex) external view returns (uint256);
}

contract FounderPool is ReentrancyGuard, Ownable {

    // Contracts
    address public core;
    address public rewardPool;
    address public feeReceiverWallet;

    // Pool shares (9 pools, 1-indexed)
    // 1: Starter Founder Pool
    // 2: Fast Activator Pool
    // 3: Starter Builder Pool
    // 4: Conversion Builder Pool Tier 1 (10 referrals)
    // 5: Conversion Builder Pool Tier 2 (20 referrals)
    // 6: Conversion Builder Pool Tier 3 (50 referrals)
    // 7: Conversion Builder Pool Tier 4 (100 referrals)
    // 8: Conversion Builder Pool Tier 5 (200 referrals)
    // 9: Free Recruiter Pool
    uint256[10] public poolAccPerShare;
    uint256[10] public poolMembers;
    uint256[10] public residualBalances;

    // Qualifications & Stats
    mapping(uint256 => mapping(uint8 => bool)) public isQualified;
    mapping(uint256 => mapping(uint8 => uint256)) public userDebt;
    mapping(uint256 => mapping(uint8 => uint256)) public totalClaimed;
    mapping(uint256 => mapping(uint8 => uint256)) public remainingAccrued;

    // Referrer tracking for qualifications
    mapping(uint256 => uint256) public freeReferralsCount;
    mapping(uint256 => uint256) public starterFoundersReferred;
    mapping(uint256 => uint256) public convertedReferrals;

    // Configurable parameters
    uint256 public fastActivatorCapUSD = 160; // default $160 (2 * Tier 5 cost)
    uint256 public fastActivatorWindow = 24 hours;
    uint256 public starterBuilderWindow = 30 days;

    // Transparency counters
    uint256 public totalReceived;
    uint256 public totalDistributed;

    event PoolReceived(uint256 amount, uint256 sharePerPool);
    event NodeQualified(uint256 indexed nodeId, uint8 indexed poolId);
    event NodeExited(uint256 indexed nodeId, uint8 indexed poolId, uint256 totalClaimed);
    event RewardClaimed(uint256 indexed nodeId, address indexed wallet, uint8 indexed poolId, uint256 amount);

    constructor(
        address _core,
        address _rewardPool,
        address _feeReceiverWallet
    ) {
        require(_core != address(0), "Zero core address");
        require(_rewardPool != address(0), "Zero pool address");
        require(_feeReceiverWallet != address(0), "Zero fee receiver address");

        core = _core;
        rewardPool = _rewardPool;
        feeReceiverWallet = _feeReceiverWallet;
    }

    receive() external payable {
        if (msg.value == 0) return;
        totalReceived += msg.value;

        // Split incoming BNB:
        // Pool 1, 2, 3, and 9 (the 4 non-conversion pools) each get 20% (1/5th) of msg.value
        // Pools 4, 5, 6, 7, 8 (the 5 conversion sub-pools) each get 4% (1/25th) of msg.value
        uint256 baseShare20 = msg.value / 5;
        uint256 baseShare4 = baseShare20 / 5;
        
        // Remainder logic: distribute any rounding dust to Pool 9 (Free Recruiter Pool)
        uint256 sumDistributed = baseShare20 * 3 + baseShare4 * 5;
        uint256 remainder = msg.value - sumDistributed;

        // Pool 1: Starter Founder
        _creditPool(1, baseShare20);
        // Pool 2: Fast Activator
        _creditPool(2, baseShare20);
        // Pool 3: Starter Builder
        _creditPool(3, baseShare20);

        // Pools 4-8: Conversion Builder Sub-pools
        for (uint8 i = 4; i <= 8; i++) {
            _creditPool(i, baseShare4);
        }

        // Pool 9: Free Recruiter + remainder
        _creditPool(9, baseShare20 + remainder);

        emit PoolReceived(msg.value, baseShare20);
    }

    function _creditPool(uint8 poolId, uint256 amount) private {
        if (poolMembers[poolId] > 0) {
            poolAccPerShare[poolId] += (amount * 1e18) / poolMembers[poolId];
        } else {
            residualBalances[poolId] += amount;
        }
    }

    /**
     * @notice Record a new node registration. Called by core.
     */
    function onNodeRegistered(uint256 nodeId, uint256 sponsorId) external {
        require(msg.sender == core || msg.sender == owner(), "Unauthorized caller");
        if (nodeId == 55555 || nodeId == 0) return; // Genesis exempt

        if (sponsorId != 0 && sponsorId != 55555) {
            freeReferralsCount[sponsorId]++;
            
            // Qualify sponsor for Free Recruiter Pool (pool 9) if they have referred at least 1 free user
            if (!isQualified[sponsorId][9]) {
                isQualified[sponsorId][9] = true;
                poolMembers[9]++;
                userDebt[sponsorId][9] = poolAccPerShare[9];
                emit NodeQualified(sponsorId, 9);
            }
        }
    }

    /**
     * @notice Record a node upgrade. Called by core.
     */
    function onNodeUpgrade(uint256 nodeId, uint256 fromTier, uint256 toTier) external {
        require(msg.sender == core || msg.sender == owner(), "Unauthorized caller");
        if (nodeId == 55555 || nodeId == 0) return; // Genesis exempt

        Infeglobal.Node memory node = ICoreEngine(core).getNode(nodeId);
        uint256 sponsorId = node.sponsor;
        uint256 joinedAt = node.joinedAt;

        // Starter Founder (pool 1) check: upgrades from Tier 0 to Tier 1 on same day
        if (fromTier == 0 && toTier >= 1) {
            if (block.timestamp / 86400 == joinedAt / 86400) {
                if (!isQualified[nodeId][1]) {
                    isQualified[nodeId][1] = true;
                    poolMembers[1]++;
                    userDebt[nodeId][1] = poolAccPerShare[1];
                    emit NodeQualified(nodeId, 1);

                    // Track sponsor progress for Starter Builder (pool 3)
                    if (sponsorId != 0 && sponsorId != 55555) {
                        starterFoundersReferred[sponsorId]++;
                        if (starterFoundersReferred[sponsorId] >= 10 && !isQualified[sponsorId][3]) {
                            Infeglobal.Node memory sponsorNode = ICoreEngine(core).getNode(sponsorId);
                            if (block.timestamp - sponsorNode.joinedAt <= starterBuilderWindow) {
                                isQualified[sponsorId][3] = true;
                                poolMembers[3]++;
                                userDebt[sponsorId][3] = poolAccPerShare[3];
                                emit NodeQualified(sponsorId, 3);
                            }
                        }
                    }
                }
            }

            // Track sponsor progress for Conversion Builder Sub-pools (pools 4-8)
            if (sponsorId != 0 && sponsorId != 55555) {
                convertedReferrals[sponsorId]++;
                _checkConversionMilestone(sponsorId, 10, 4);
                _checkConversionMilestone(sponsorId, 20, 5);
                _checkConversionMilestone(sponsorId, 50, 6);
                _checkConversionMilestone(sponsorId, 100, 7);
                _checkConversionMilestone(sponsorId, 200, 8);
            }
        }

        // Fast Activator (pool 2) check: reaches Tier 5 within 24 hours of joining
        if (toTier >= 5 && !isQualified[nodeId][2]) {
            if (block.timestamp - joinedAt <= fastActivatorWindow) {
                isQualified[nodeId][2] = true;
                poolMembers[2]++;
                userDebt[nodeId][2] = poolAccPerShare[2];
                emit NodeQualified(nodeId, 2);
            }
        }
    }

    function _checkConversionMilestone(uint256 sponsorId, uint256 threshold, uint8 poolId) private {
        if (convertedReferrals[sponsorId] >= threshold && !isQualified[sponsorId][poolId]) {
            isQualified[sponsorId][poolId] = true;
            poolMembers[poolId]++;
            userDebt[sponsorId][poolId] = poolAccPerShare[poolId];
            emit NodeQualified(sponsorId, poolId);
        }
    }

    /**
     * @notice Get pending rewards for a node in a specific pool.
     */
    function getPendingRewards(uint256 nodeId, uint8 poolId) public view returns (uint256) {
        if (!isQualified[nodeId][poolId] || poolId < 1 || poolId > 9) return 0;
        
        uint256 accrued = (poolAccPerShare[poolId] - userDebt[nodeId][poolId]) / 1e18;
        uint256 totalAccrued = accrued + remainingAccrued[nodeId][poolId];
        uint256 cap = getPoolCap(nodeId, poolId);

        if (cap > 0) {
            uint256 claimed = totalClaimed[nodeId][poolId];
            if (claimed >= cap) return 0;
            if (claimed + totalAccrued > cap) {
                return cap - claimed;
            }
        }
        return totalAccrued;
    }

    /**
     * @notice Get the lifetime cap for a node in a specific pool.
     */
    function getPoolCap(uint256 nodeId, uint8 poolId) public view returns (uint256) {
        if (poolId == 1) { // Starter Founder: 1x Tier 1 Cost
            return ICoreEngine(core).getTierCost(0);
        } else if (poolId == 2) { // Fast Activator: configurable cap in USD/BNB
            return 2 * ICoreEngine(core).getTierCost(4);
        } else if (poolId == 3) { // Starter Builder: 1x Tier 1 (T0) Cost per Starter Founder referral
            return starterFoundersReferred[nodeId] * ICoreEngine(core).getTierCost(0);
        } else if (poolId >= 4 && poolId <= 8) { // Conversion Builder Sub-pools: 2x Tier 1 Cost
            return 2 * ICoreEngine(core).getTierCost(0);
        } else if (poolId == 9) { // Free Recruiter: 1x total registration fees generated
            return freeReferralsCount[nodeId] * ICoreEngine(core).getRegistrationFee();
        }
        return 0;
    }

    /**
     * @notice Claim rewards from a specific pool. Bypasses vesting vault.
     */
    function claim(uint256 nodeId, uint8 poolId) external nonReentrant {
        address wallet = ICoreEngine(core).getNodeWallet(nodeId);
        require(wallet != address(0), "Invalid node");
        require(msg.sender == wallet, "Not node wallet");
        require(poolId >= 1 && poolId <= 9, "Invalid poolId");

        uint256 pending = getPendingRewards(nodeId, poolId);
        require(pending > 0, "No rewards to claim");

        uint256 accrued = (poolAccPerShare[poolId] - userDebt[nodeId][poolId]) / 1e18;

        // CEI: update remainingAccrued and userDebt before state changes
        remainingAccrued[nodeId][poolId] = (accrued + remainingAccrued[nodeId][poolId]) - pending;
        userDebt[nodeId][poolId] = poolAccPerShare[poolId];
        totalClaimed[nodeId][poolId] += pending;
        totalDistributed += pending;

        // Auto-exit check
        uint256 cap = getPoolCap(nodeId, poolId);
        if (cap > 0 && totalClaimed[nodeId][poolId] >= cap) {
            isQualified[nodeId][poolId] = false;
            if (poolMembers[poolId] > 0) {
                poolMembers[poolId]--;
            }
            emit NodeExited(nodeId, poolId, totalClaimed[nodeId][poolId]);
        }

        (bool success, ) = payable(wallet).call{value: pending}("");
        require(success, "Reward transfer failed");

        emit RewardClaimed(nodeId, wallet, poolId, pending);
    }

    /**
     * @notice Reclaim residual balance of a pool when members are 0.
     */
    function sweepResidual(uint8 poolId) external onlyOwner {
        require(poolId >= 1 && poolId <= 9, "Invalid poolId");
        uint256 bal = residualBalances[poolId];
        require(bal > 0, "No residual balance");
        residualBalances[poolId] = 0;
        
        (bool success, ) = payable(feeReceiverWallet).call{value: bal}("");
        require(success, "Residual transfer failed");
    }

    // Owner configuration
    function setParams(uint256 _fastActivatorCapUSD, uint256 _fastActivatorWindow, uint256 _starterBuilderWindow) external onlyOwner {
        fastActivatorCapUSD = _fastActivatorCapUSD;
        fastActivatorWindow = _fastActivatorWindow;
        starterBuilderWindow = _starterBuilderWindow;
    }
}
