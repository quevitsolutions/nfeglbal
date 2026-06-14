// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LeadershipStorage.sol";
import "./Infeglobal.sol";

interface ILeaderboardPool {
    function recordPoints(uint256 nodeId, uint256 actionType, uint256 amount) external;
}

contract RewardPoolLeadership is LeadershipStorage {
    address public founderPool;
    address public leaderboardPool;

    event FounderPoolUpdated(address indexed oldPool, address indexed newPool);
    event LeaderboardPoolUpdated(address indexed oldPool, address indexed newPool);

    /* ─────────────────────────────────────────────
       REENTRANCY GUARD (inline)
       ───────────────────────────────────────────── */
    uint8 private _locked;
    modifier nonReentrant() {
        require(_locked == 0, "Reentrant call");
        _locked = 1;
        _;
        _locked = 0;
    }

    /* ─────────────────────────────────────────────
       EVENTS
       ───────────────────────────────────────────── */
    event FounderQualified(uint256 nodeId);
    event SeniorFounderQualified(uint256 nodeId);
    event AmbassadorQualified(uint256 nodeId);

    event FounderStatusChanged(uint256 nodeId, bool active);
    event SeniorStatusChanged(uint256 nodeId, bool active);
    event AmbassadorStatusChanged(uint256 nodeId, bool active);

    event LeadershipRevenueReceived(
        uint256 amount,
        uint256 founderShare,
        uint256 seniorShare,
        uint256 ambassadorShare
    );

    event LeadershipEngineConfigUpdated(string param, uint256 value);
    event FeeReceiverWalletUpdated(address oldWallet, address newWallet);
    event RewardPoolAddressUpdated(address oldPool, address newPool);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    /* ─────────────────────────────────────────────
       MODIFIERS
       ───────────────────────────────────────────── */
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyRewardPool() {
        require(msg.sender == rewardPool, "Only RewardPool");
        _;
    }

    /* ─────────────────────────────────────────────
       CONSTRUCTOR
       ───────────────────────────────────────────── */
    constructor(
        address _engine,
        address _rewardPool,
        address _feeReceiverWallet,
        address _owner
    ) {
        require(_engine != address(0), "Zero engine address");
        require(_rewardPool != address(0), "Zero reward pool address");
        require(_feeReceiverWallet != address(0), "Zero fee receiver address");
        require(_owner != address(0), "Zero owner address");

        engine = _engine;
        rewardPool = _rewardPool;
        feeReceiverWallet = _feeReceiverWallet;
        owner = _owner;

        // Auto-initialize Genesis Node (55555) as permanently active Founder, Senior, Ambassador
        uint256 genesisId = 55555;
        isRankActive[genesisId] = true;
        rank[genesisId] = LeadershipRank.Ambassador;

        // Count Genesis Node as active member of all 3 pools
        founderMembers = 1;
        seniorMembers = 1;
        ambassadorMembers = 1;

        emit FounderQualified(genesisId);
        emit SeniorFounderQualified(genesisId);
        emit AmbassadorQualified(genesisId);

        emit FounderStatusChanged(genesisId, true);
        emit SeniorStatusChanged(genesisId, true);
        emit AmbassadorStatusChanged(genesisId, true);
    }

    /* ─────────────────────────────────────────────
       RECEIVE — Platform fees inflow
       ───────────────────────────────────────────── */
    receive() external payable {
        if (msg.value == 0) return;

        uint256 shareAmount = msg.value / 4;
        uint256 remainder = msg.value - (shareAmount * 4);

        // 1) 25% to FounderPool
        if (founderPool != address(0)) {
            (bool success, ) = payable(founderPool).call{value: shareAmount}("");
            require(success, "FounderPool transfer failed");
        } else {
            (bool success, ) = payable(feeReceiverWallet).call{value: shareAmount}("");
            require(success, "FounderPool fallback failed");
        }

        // 2) 25% to LeaderboardPool
        if (leaderboardPool != address(0)) {
            (bool success, ) = payable(leaderboardPool).call{value: shareAmount}("");
            require(success, "LeaderboardPool transfer failed");
        } else {
            (bool success, ) = payable(feeReceiverWallet).call{value: shareAmount}("");
            require(success, "LeaderboardPool fallback failed");
        }

        // 3) 25% to EOA feeReceiverWallet
        {
            (bool success, ) = payable(feeReceiverWallet).call{value: shareAmount}("");
            require(success, "FeeReceiver wallet transfer failed");
        }

        // 4) 25% retained for active leadership ranks
        uint256 leadershipShare = shareAmount + remainder;
        if (leadershipShare > 0) {
            totalLeadershipReceived += leadershipShare;

            uint256 fShare = (leadershipShare * founderPoolShareBP) / 10000;
            uint256 sShare = (leadershipShare * seniorPoolShareBP) / 10000;
            uint256 aShare = leadershipShare - fShare - sShare;

            if (founderMembers > 0) {
                founderAccPerShare += (fShare * 1e18) / founderMembers;
            } else {
                residualFounder += fShare;
            }

            if (seniorMembers > 0) {
                seniorAccPerShare += (sShare * 1e18) / seniorMembers;
            } else {
                residualSenior += sShare;
            }

            if (ambassadorMembers > 0) {
                ambassadorAccPerShare += (aShare * 1e18) / ambassadorMembers;
            } else {
                residualAmbassador += aShare;
            }

            emit LeadershipRevenueReceived(msg.value, fShare, sShare, aShare);
        }
    }

    /* ─────────────────────────────────────────────
       RECORD ACHIEVEMENT
       ───────────────────────────────────────────── */
    function recordAchievement(uint256 nodeId, uint8 poolId) external onlyRewardPool {
        if (nodeId == 55555 || nodeId == 0) return; // Genesis exempt from sponsor counts

        // Fetch sponsor using existing getNode view helper on nfeglobal contract
        Infeglobal.Node memory node = Infeglobal(engine).getNode(nodeId);
        uint256 sponsor = node.sponsor;
        if (sponsor == 0) return;

        // Multi-level checks to handle quick upgrade paths (skipping pools)
        if (poolId >= 1) {
            if (!countedBronze[nodeId]) {
                countedBronze[nodeId] = true;
                bronzeAchievers[sponsor]++;
                _recordActivity(sponsor, 1);
                emit FounderStatusChanged(sponsor, isLeadershipActive(sponsor, 1));
                emit SeniorStatusChanged(sponsor, isLeadershipActive(sponsor, 2));
                emit AmbassadorStatusChanged(sponsor, isLeadershipActive(sponsor, 3));
                if (leaderboardPool != address(0)) {
                    try ILeaderboardPool(leaderboardPool).recordPoints(sponsor, 4, 1) {} catch {}
                }
            }
        }
        if (poolId >= 2) {
            if (!countedSilver[nodeId]) {
                countedSilver[nodeId] = true;
                silverAchievers[sponsor]++;
                _recordActivity(sponsor, 2);
                emit SeniorStatusChanged(sponsor, isLeadershipActive(sponsor, 2));
                if (leaderboardPool != address(0)) {
                    try ILeaderboardPool(leaderboardPool).recordPoints(sponsor, 4, 1) {} catch {}
                }
            }
        }
        if (poolId >= 3) {
            if (!countedGold[nodeId]) {
                countedGold[nodeId] = true;
                goldAchievers[sponsor]++;
                _recordActivity(sponsor, 3);
                emit AmbassadorStatusChanged(sponsor, isLeadershipActive(sponsor, 3));
                if (leaderboardPool != address(0)) {
                    try ILeaderboardPool(leaderboardPool).recordPoints(sponsor, 4, 1) {} catch {}
                }
            }
        }

        // Auto-check and upgrade sponsor's rank
        _checkAndUpgradeRank(sponsor);
    }

    /* ─────────────────────────────────────────────
       CLAIM FOR NODE
       ───────────────────────────────────────────── */
    function claimFor(uint256 nodeId) external onlyRewardPool nonReentrant returns (uint256) {
        // Sync active status first (harvests accrued if they transitioned)
        syncLeadershipStatus(nodeId);

        LeadershipRank r = rank[nodeId];
        uint256 pending = _pendingLeadershipRewards(nodeId, r);
        uint256 accumulated = accumulatedLeadershipRewards[nodeId];
        uint256 total = pending + accumulated;

        if (total > 0) {
            _updateDebt(nodeId, r);
            accumulatedLeadershipRewards[nodeId] = 0;
            claimedLeadershipRewards[nodeId] += total;
            totalLeadershipDistributed += total;

            // Transfer BNB to RewardPool contract
            (bool success, ) = payable(rewardPool).call{value: total}("");
            require(success, "Transfer to RewardPool failed");
        }

        return total;
    }

    /* ─────────────────────────────────────────────
       SYNC LEADERSHIP STATUS
       ───────────────────────────────────────────── */
    function syncLeadershipStatus(uint256 nodeId) public {
        if (nodeId == 55555 || nodeId == 0) return; // Genesis remains permanently active

        LeadershipRank currentRank = rank[nodeId];
        if (currentRank == LeadershipRank.None) {
            _checkAndUpgradeRank(nodeId);
            return;
        }

        bool currentlyActive = isLeadershipActive(nodeId, uint8(currentRank));
        bool storedActive = isRankActive[nodeId];

        if (storedActive && !currentlyActive) {
            // Deactivate: Harvest pending rewards to accumulated, decrement count
            _harvestRewards(nodeId, currentRank);
            isRankActive[nodeId] = false;
            _decrementMemberCount(currentRank);

            if (currentRank == LeadershipRank.Founder) emit FounderStatusChanged(nodeId, false);
            else if (currentRank == LeadershipRank.SeniorFounder) emit SeniorStatusChanged(nodeId, false);
            else if (currentRank == LeadershipRank.Ambassador) emit AmbassadorStatusChanged(nodeId, false);

        } else if (!storedActive && currentlyActive) {
            // Reactivate: Reset debt to current accumulator, increment count
            _updateDebt(nodeId, currentRank);
            isRankActive[nodeId] = true;
            _incrementMemberCount(currentRank);

            if (currentRank == LeadershipRank.Founder) emit FounderStatusChanged(nodeId, true);
            else if (currentRank == LeadershipRank.SeniorFounder) emit SeniorStatusChanged(nodeId, true);
            else if (currentRank == LeadershipRank.Ambassador) emit AmbassadorStatusChanged(nodeId, true);
        }

        // Check for promotion path
        _checkAndUpgradeRank(nodeId);
    }

    /* ─────────────────────────────────────────────
       VIEWS
       ───────────────────────────────────────────── */
    function getClaimableTotal(uint256 nodeId) public view returns (uint256) {
        LeadershipRank r = rank[nodeId];
        uint256 pending = _pendingLeadershipRewards(nodeId, r);
        uint256 accumulated = accumulatedLeadershipRewards[nodeId];
        return pending + accumulated;
    }

    function isLeadershipActive(uint256 nodeId, uint8 rankVal) public view returns (bool) {
        if (nodeId == 55555) return true; // Genesis exception

        LeadershipRank r = LeadershipRank(rankVal);

        if (r == LeadershipRank.Founder) {
            if (bronzeAchievers[nodeId] < founderBronzeRequired) return false;
            return _getRecentAchievements(bronzeActivity[nodeId], founderActivityWindow, founderActivityRequired) >= founderActivityRequired;
        }
        if (r == LeadershipRank.SeniorFounder) {
            if (silverAchievers[nodeId] < seniorSilverRequired) return false;
            return _getRecentAchievements(silverActivity[nodeId], seniorActivityWindow, seniorActivityRequired) >= seniorActivityRequired;
        }
        if (r == LeadershipRank.Ambassador) {
            if (goldAchievers[nodeId] < ambassadorGoldRequired) return false;
            return _getRecentAchievements(goldActivity[nodeId], ambassadorActivityWindow, ambassadorActivityRequired) >= ambassadorActivityRequired;
        }

        return false;
    }

    function getRecentAchievements(uint256 nodeId, uint8 poolId) external view returns (uint256) {
        if (poolId == 1) {
            return _getRecentAchievements(bronzeActivity[nodeId], founderActivityWindow, founderActivityRequired);
        } else if (poolId == 2) {
            return _getRecentAchievements(silverActivity[nodeId], seniorActivityWindow, seniorActivityRequired);
        } else if (poolId == 3) {
            return _getRecentAchievements(goldActivity[nodeId], ambassadorActivityWindow, ambassadorActivityRequired);
        }
        return 0;
    }

    function getPendingRewards(uint256 nodeId, uint8 poolId) external view returns (uint256) {
        if (nodeId == 55555) {
            if (poolId == 1) {
                return founderAccPerShare >= founderDebt[55555]
                    ? (founderAccPerShare - founderDebt[55555]) / 1e18 : 0;
            } else if (poolId == 2) {
                return seniorAccPerShare >= seniorDebt[55555]
                    ? (seniorAccPerShare - seniorDebt[55555]) / 1e18 : 0;
            } else if (poolId == 3) {
                return ambassadorAccPerShare >= ambassadorDebt[55555]
                    ? (ambassadorAccPerShare - ambassadorDebt[55555]) / 1e18 : 0;
            }
        }

        LeadershipRank r = rank[nodeId];
        if (!isRankActive[nodeId] || uint8(r) != poolId) return 0;

        if (poolId == 1) {
            return founderAccPerShare >= founderDebt[nodeId]
                ? (founderAccPerShare - founderDebt[nodeId]) / 1e18 : 0;
        } else if (poolId == 2) {
            return seniorAccPerShare >= seniorDebt[nodeId]
                ? (seniorAccPerShare - seniorDebt[nodeId]) / 1e18 : 0;
        } else if (poolId == 3) {
            return ambassadorAccPerShare >= ambassadorDebt[nodeId]
                ? (ambassadorAccPerShare - ambassadorDebt[nodeId]) / 1e18 : 0;
        }

        return 0;
    }

    /* ─────────────────────────────────────────────
       INTERNAL HELPERS
       ───────────────────────────────────────────── */
    function _recordActivity(uint256 sponsorId, uint8 poolId) internal {
        uint32 nowSec = uint32(block.timestamp);

        if (poolId == 1) {
            RingBuffer storage buf = bronzeActivity[sponsorId];
            buf.timestamps[buf.writeIdx] = nowSec;
            buf.writeIdx = uint16((buf.writeIdx + 1) % 10);
            buf.count++;
        } else if (poolId == 2) {
            RingBuffer storage buf = silverActivity[sponsorId];
            buf.timestamps[buf.writeIdx] = nowSec;
            buf.writeIdx = uint16((buf.writeIdx + 1) % 10);
            buf.count++;
        } else if (poolId == 3) {
            RingBuffer storage buf = goldActivity[sponsorId];
            buf.timestamps[buf.writeIdx] = nowSec;
            buf.writeIdx = uint16((buf.writeIdx + 1) % 10);
            buf.count++;
        }
    }

    function _getRecentAchievements(
        RingBuffer storage buf,
        uint256 window,
        uint256 /*required*/
    ) internal view returns (uint256) {
        if (buf.count == 0) return 0;

        uint32 nowSec = uint32(block.timestamp);
        uint32 cutoff = nowSec >= window ? nowSec - uint32(window) : 0;

        uint256 recent = 0;
        uint256 limit = buf.count > 10 ? 10 : buf.count;

        for (uint256 i = 0; i < limit; i++) {
            if (buf.timestamps[i] >= cutoff) {
                recent++;
            }
        }
        return recent;
    }

    function _checkAndUpgradeRank(uint256 sponsorId) internal {
        if (sponsorId == 55555 || sponsorId == 0) return;

        LeadershipRank currentRank = rank[sponsorId];
        LeadershipRank newRank = currentRank;

        if (goldAchievers[sponsorId] >= ambassadorGoldRequired) {
            newRank = LeadershipRank.Ambassador;
        } else if (silverAchievers[sponsorId] >= seniorSilverRequired) {
            newRank = LeadershipRank.SeniorFounder;
        } else if (bronzeAchievers[sponsorId] >= founderBronzeRequired) {
            newRank = LeadershipRank.Founder;
        } else {
            newRank = LeadershipRank.None;
        }

        if (newRank != currentRank) {
            // Harvest rewards and exit membership from old rank pool
            if (currentRank != LeadershipRank.None) {
                _harvestRewards(sponsorId, currentRank);
                if (isRankActive[sponsorId]) {
                    _decrementMemberCount(currentRank);
                }
            }

            // Set new rank
            rank[sponsorId] = newRank;

            // Check if active in new rank
            bool active = isLeadershipActive(sponsorId, uint8(newRank));
            isRankActive[sponsorId] = active;

            if (active && newRank != LeadershipRank.None) {
                _incrementMemberCount(newRank);
                _updateDebt(sponsorId, newRank);
            }

            if (newRank == LeadershipRank.Founder) emit FounderQualified(sponsorId);
            else if (newRank == LeadershipRank.SeniorFounder) emit SeniorFounderQualified(sponsorId);
            else if (newRank == LeadershipRank.Ambassador) emit AmbassadorQualified(sponsorId);
        }
    }

    function _harvestRewards(uint256 nodeId, LeadershipRank r) internal {
        uint256 pending = _pendingLeadershipRewards(nodeId, r);
        if (pending > 0) {
            accumulatedLeadershipRewards[nodeId] += pending;
        }
        _updateDebt(nodeId, r);
    }

    function _pendingLeadershipRewards(uint256 nodeId, LeadershipRank r) internal view returns (uint256) {
        if (nodeId == 55555) {
            uint256 pFounder = founderAccPerShare >= founderDebt[55555]
                ? (founderAccPerShare - founderDebt[55555]) / 1e18 : 0;
            uint256 pSenior = seniorAccPerShare >= seniorDebt[55555]
                ? (seniorAccPerShare - seniorDebt[55555]) / 1e18 : 0;
            uint256 pAmbassador = ambassadorAccPerShare >= ambassadorDebt[55555]
                ? (ambassadorAccPerShare - ambassadorDebt[55555]) / 1e18 : 0;
            return pFounder + pSenior + pAmbassador;
        }

        if (!isRankActive[nodeId]) return 0;

        if (r == LeadershipRank.Founder) {
            return founderAccPerShare >= founderDebt[nodeId]
                ? (founderAccPerShare - founderDebt[nodeId]) / 1e18 : 0;
        }
        if (r == LeadershipRank.SeniorFounder) {
            return seniorAccPerShare >= seniorDebt[nodeId]
                ? (seniorAccPerShare - seniorDebt[nodeId]) / 1e18 : 0;
        }
        if (r == LeadershipRank.Ambassador) {
            return ambassadorAccPerShare >= ambassadorDebt[nodeId]
                ? (ambassadorAccPerShare - ambassadorDebt[nodeId]) / 1e18 : 0;
        }
        return 0;
    }

    function _updateDebt(uint256 nodeId, LeadershipRank r) internal {
        if (nodeId == 55555) {
            founderDebt[55555] = founderAccPerShare;
            seniorDebt[55555] = seniorAccPerShare;
            ambassadorDebt[55555] = ambassadorAccPerShare;
            return;
        }

        if (r == LeadershipRank.Founder) {
            founderDebt[nodeId] = founderAccPerShare;
        } else if (r == LeadershipRank.SeniorFounder) {
            seniorDebt[nodeId] = seniorAccPerShare;
        } else if (r == LeadershipRank.Ambassador) {
            ambassadorDebt[nodeId] = ambassadorAccPerShare;
        }
    }

    function _incrementMemberCount(LeadershipRank r) internal {
        if (r == LeadershipRank.Founder) {
            founderMembers++;
            if (founderMembers == 1 && residualFounder > 0) {
                founderAccPerShare += (residualFounder * 1e18);
                residualFounder = 0;
            }
        } else if (r == LeadershipRank.SeniorFounder) {
            seniorMembers++;
            if (seniorMembers == 1 && residualSenior > 0) {
                seniorAccPerShare += (residualSenior * 1e18);
                residualSenior = 0;
            }
        } else if (r == LeadershipRank.Ambassador) {
            ambassadorMembers++;
            if (ambassadorMembers == 1 && residualAmbassador > 0) {
                ambassadorAccPerShare += (residualAmbassador * 1e18);
                residualAmbassador = 0;
            }
        }
    }

    function _decrementMemberCount(LeadershipRank r) internal {
        if (r == LeadershipRank.Founder) {
            if (founderMembers > 0) founderMembers--;
        } else if (r == LeadershipRank.SeniorFounder) {
            if (seniorMembers > 0) seniorMembers--;
        } else if (r == LeadershipRank.Ambassador) {
            if (ambassadorMembers > 0) ambassadorMembers--;
        }
    }

    /* ─────────────────────────────────────────────
       ADMIN & CONFIG SETTERS
       ───────────────────────────────────────────── */
    function setFounderRequirements(uint256 _bronzeReq) external onlyOwner {
        require(_bronzeReq > 0, "Invalid requirement");
        founderBronzeRequired = _bronzeReq;
        emit LeadershipEngineConfigUpdated("founderBronzeRequired", _bronzeReq);
    }

    function setSeniorRequirements(uint256 _silverReq) external onlyOwner {
        require(_silverReq > 0, "Invalid requirement");
        seniorSilverRequired = _silverReq;
        emit LeadershipEngineConfigUpdated("seniorSilverRequired", _silverReq);
    }

    function setAmbassadorRequirements(uint256 _goldReq) external onlyOwner {
        require(_goldReq > 0, "Invalid requirement");
        ambassadorGoldRequired = _goldReq;
        emit LeadershipEngineConfigUpdated("ambassadorGoldRequired", _goldReq);
    }

    function setFounderActivityRules(uint256 _req, uint256 _window) external onlyOwner {
        require(_req > 0 && _req <= 10, "Invalid req: must be <= 10");
        require(_window > 0, "Invalid window");
        founderActivityRequired = _req;
        founderActivityWindow = _window;
        emit LeadershipEngineConfigUpdated("founderActivityRequired", _req);
        emit LeadershipEngineConfigUpdated("founderActivityWindow", _window);
    }

    function setSeniorActivityRules(uint256 _req, uint256 _window) external onlyOwner {
        require(_req > 0 && _req <= 10, "Invalid req: must be <= 10");
        require(_window > 0, "Invalid window");
        seniorActivityRequired = _req;
        seniorActivityWindow = _window;
        emit LeadershipEngineConfigUpdated("seniorActivityRequired", _req);
        emit LeadershipEngineConfigUpdated("seniorActivityWindow", _window);
    }

    function setAmbassadorActivityRules(uint256 _req, uint256 _window) external onlyOwner {
        require(_req > 0 && _req <= 10, "Invalid req: must be <= 10");
        require(_window > 0, "Invalid window");
        ambassadorActivityRequired = _req;
        ambassadorActivityWindow = _window;
        emit LeadershipEngineConfigUpdated("ambassadorActivityRequired", _req);
        emit LeadershipEngineConfigUpdated("ambassadorActivityWindow", _window);
    }

    function setLeadershipAllocation(uint256 _allocBP) external onlyOwner {
        require(_allocBP <= 10000, "Allocation cannot exceed 100%");
        leadershipAllocationBP = _allocBP;
        emit LeadershipEngineConfigUpdated("leadershipAllocationBP", _allocBP);
    }

    function setLeadershipPoolShares(
        uint256 _founderShareBP,
        uint256 _seniorShareBP,
        uint256 _ambassadorShareBP
    ) external onlyOwner {
        require(_founderShareBP + _seniorShareBP + _ambassadorShareBP == 10000, "Must total 10000");
        founderPoolShareBP = _founderShareBP;
        seniorPoolShareBP = _seniorShareBP;
        ambassadorPoolShareBP = _ambassadorShareBP;
        emit LeadershipEngineConfigUpdated("founderPoolShareBP", _founderShareBP);
        emit LeadershipEngineConfigUpdated("seniorPoolShareBP", _seniorShareBP);
        emit LeadershipEngineConfigUpdated("ambassadorPoolShareBP", _ambassadorShareBP);
    }

    function setFeeReceiverWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Zero address");
        address oldWallet = feeReceiverWallet;
        feeReceiverWallet = _wallet;
        emit FeeReceiverWalletUpdated(oldWallet, _wallet);
    }

    function setRewardPool(address _rp) external onlyOwner {
        require(_rp != address(0), "Zero address");
        address oldPool = rewardPool;
        rewardPool = _rp;
        emit RewardPoolAddressUpdated(oldPool, _rp);
    }

    function setFounderPool(address _fp) external onlyOwner {
        require(_fp != address(0), "Zero address");
        address old = founderPool;
        founderPool = _fp;
        emit FounderPoolUpdated(old, _fp);
    }

    function setLeaderboardPool(address _lp) external onlyOwner {
        require(_lp != address(0), "Zero address");
        address old = leaderboardPool;
        leaderboardPool = _lp;
        emit LeaderboardPoolUpdated(old, _lp);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero owner address");
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
}
