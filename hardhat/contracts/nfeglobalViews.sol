// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Infeglobal.sol";

interface IRewardPoolViews {
    function getClaimable(uint nodeId) external view returns (uint fromCurrentPool, uint fromExitedPools, uint total);
    function totalClaimed(uint nodeId) external view returns (uint);
}

library nfeglobalViews {

    function missedRewardsByTier(
        mapping(uint => Infeglobal.RewardEvent[]) storage rewardHistory,
        uint _nodeId,
        uint _tier
    ) external view returns (uint total) {
        uint len = rewardHistory[_nodeId].length;
        for (uint i = 0; i < len; i++) {
            Infeglobal.RewardEvent memory ev = rewardHistory[_nodeId][i];
            if (ev.isMissed && ev.tier == _tier) total += ev.amount;
        }
    }

    function getMatrixUsers(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(uint => mapping(uint => uint[])) storage teams,
        uint _nodeId, uint _layer, uint _startIndex, uint _num
    ) external view returns (Infeglobal.Node[] memory) {
        uint length = teams[_nodeId][_layer].length;
        if (length == 0 || _startIndex >= length) return new Infeglobal.Node[](0);
        
        uint resultCount = (length > _num + _startIndex) ? _num : (length - _startIndex);
        Infeglobal.Node[] memory _users = new Infeglobal.Node[](resultCount);
        
        for (uint i = 0; i < resultCount; i++) {
            _users[i] = nodes[teams[_nodeId][_layer][_startIndex + i]];
        }
        return _users;
    }

    /// @notice Returns the most recent `_length` reward events for a node.
    ///         LOW-09 Fix: Results are returned oldest-first (index 0 = oldest in the window).
    function getIncome(
        mapping(uint => Infeglobal.RewardEvent[]) storage rewardHistory,
        uint _nodeId, uint _length
    ) external view returns (Infeglobal.RewardEvent[] memory) {
        // L-02 Fix: guard against _length == 0 — `returnLen - 1` underflows in 0.8+
        if (_length == 0) return new Infeglobal.RewardEvent[](0);
        uint historyLen = rewardHistory[_nodeId].length;
        if (historyLen == 0) return new Infeglobal.RewardEvent[](0);

        uint returnLen = historyLen > _length ? _length : historyLen;
        Infeglobal.RewardEvent[] memory _income = new Infeglobal.RewardEvent[](returnLen);

        uint index = returnLen - 1;
        for (uint i = historyLen; i > historyLen - returnLen; i--) {
            _income[index] = rewardHistory[_nodeId][i - 1];
            if (index > 0) index--;
        }
        return _income;
    }

    /// @notice Returns the most recent `_length` MISSED reward events for a node.
    ///         Results are returned oldest-first (index 0 = oldest in the window).
    function getMissedIncome(
        mapping(uint => Infeglobal.RewardEvent[]) storage rewardHistory,
        uint _nodeId, uint _length
    ) external view returns (Infeglobal.RewardEvent[] memory) {
        // L-02 Fix: guard against _length == 0 — `returnLen - 1` underflows in 0.8+
        if (_length == 0) return new Infeglobal.RewardEvent[](0);
        uint historyLen = rewardHistory[_nodeId].length;
        if (historyLen == 0) return new Infeglobal.RewardEvent[](0);

        uint missedCount = 0;
        for (uint i = 0; i < historyLen; i++) {
            if (rewardHistory[_nodeId][i].isMissed) missedCount++;
        }
        
        uint returnLen = missedCount > _length ? _length : missedCount;
        Infeglobal.RewardEvent[] memory _income = new Infeglobal.RewardEvent[](returnLen);
        if (returnLen == 0) return _income;

        uint index = returnLen - 1;
        for (uint i = historyLen; i > 0; i--) {
            if (rewardHistory[_nodeId][i - 1].isMissed) {
                _income[index] = rewardHistory[_nodeId][i - 1];
                if (index == 0) break;
                index--;
            }
        }
        return _income;
    }

    function getIncomeByType(
        mapping(uint => Infeglobal.RewardEvent[]) storage rewardHistory,
        uint _nodeId, uint _type, uint _length
    ) external view returns (Infeglobal.RewardEvent[] memory) {
        uint historyLen = rewardHistory[_nodeId].length;
        if (historyLen == 0) return new Infeglobal.RewardEvent[](0);

        uint typeCount = 0;
        for (uint i = 0; i < historyLen; i++) {
            if (rewardHistory[_nodeId][i].rewardType == _type) typeCount++;
        }
        
        uint returnLen = typeCount > _length ? _length : typeCount;
        Infeglobal.RewardEvent[] memory _income = new Infeglobal.RewardEvent[](returnLen);
        if (returnLen == 0) return _income;

        uint index = returnLen - 1;
        for (uint i = historyLen; i > 0; i--) {
            if (rewardHistory[_nodeId][i - 1].rewardType == _type) {
                _income[index] = rewardHistory[_nodeId][i - 1];
                if (index == 0) break;
                index--;
            }
        }
        return _income;
    }

    // --- DASHBOARD TUPLE HELPERS ---

    function _getPoolIncome(address _rewardPool, uint _userId) private view returns (uint) {
        if (_rewardPool == address(0)) return 0;
        uint poolIncome = 0;
        try IRewardPoolViews(_rewardPool).getClaimable(_userId) returns (uint, uint, uint claimable) {
            try IRewardPoolViews(_rewardPool).totalClaimed(_userId) returns (uint claimed) {
                poolIncome = claimable + claimed;
            } catch {}
        } catch {}
        return poolIncome;
    }

    function getTotalIncome(
        mapping(uint => Infeglobal.RewardInfo) storage rewardInfo,
        address _rewardPool,
        uint _userId
    ) external view returns (uint) {
        uint poolIncome = _getPoolIncome(_rewardPool, _userId);
        return rewardInfo[_userId].totalRewards + poolIncome;
    }

    function getNodeStats(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(uint => Infeglobal.RewardInfo) storage rewardInfo,
        address _rewardPool,
        uint _userId
    ) external view returns (
        uint tier, uint directCount, uint matrixCount,
        uint totalRewards, uint totalContribution, uint daysActive
    ) {
        Infeglobal.Node memory node = nodes[_userId];
        require(node.nodeId != 0, "Node not found");
        
        tier = node.tier;
        directCount = node.directNodes;
        matrixCount = node.totalMatrixNodes;
        
        uint poolIncome = _getPoolIncome(_rewardPool, _userId);
        totalRewards = rewardInfo[_userId].totalRewards + poolIncome;
        
        totalContribution = node.totalContribution;
        daysActive = (block.timestamp - node.joinedAt) / 1 days;
    }

    function getIncomeBreakdown(
        mapping(uint => Infeglobal.RewardInfo) storage rewardInfo,
        address _rewardPool,
        uint _userId
    ) external view returns (
        uint total, uint referral, uint tier,
        uint binary, uint direct, uint lost, uint poolIncome
    ) {
        Infeglobal.RewardInfo storage info = rewardInfo[_userId];
        poolIncome = _getPoolIncome(_rewardPool, _userId);
        
        return (
            info.totalRewards + poolIncome, info.sponsorReward, info.layerReward,
            info.matrixReward, info.directReward, info.missedReward, poolIncome
        );
    }

    function getPoolQualificationData(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(uint => mapping(uint => uint[])) storage networkTree,
        uint _userId
    ) external view returns (
        uint totalDeposited, uint directReferrals, uint totalTeam,
        uint currentLevel, uint directTeamL1, uint matrixTeam,
        uint registrationTime, bool isActive
    ) {
        Infeglobal.Node memory node = nodes[_userId];
        
        totalDeposited = node.totalContribution;
        directReferrals = node.directNodes;
        totalTeam = networkTree[_userId][0].length;
        currentLevel = node.tier;
        directTeamL1 = node.directNodes;      // M-07 Fix: directNodes is semantically correct
        matrixTeam = node.totalMatrixNodes;
        registrationTime = node.joinedAt;
        isActive = (node.nodeId != 0);
    }

    function getNetworkNodes(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(uint => mapping(uint => uint[])) storage networkTree,
        uint _nodeId, uint _layer, uint _num
    ) external view returns (Infeglobal.Node[] memory) {
        uint treeLen = networkTree[_nodeId][_layer].length;
        if (treeLen == 0) return new Infeglobal.Node[](0);

        uint returnLen = treeLen > _num ? _num : treeLen;
        Infeglobal.Node[] memory _users = new Infeglobal.Node[](returnLen);

        uint taken = 0;
        for (uint i = treeLen; i > treeLen - returnLen; i--) {
            _users[taken] = nodes[networkTree[_nodeId][_layer][i - 1]];
            taken++;
        }
        return _users;
    }

    function getNetworkNodesWithStats(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(uint => Infeglobal.RewardInfo) storage rewardInfo,
        mapping(uint => mapping(uint => uint[])) storage networkTree,
        uint _nodeId, uint _layer, uint _num
    ) external view returns (Infeglobal.NodeWithStats[] memory) {
        uint treeLen = networkTree[_nodeId][_layer].length;
        if (treeLen == 0) return new Infeglobal.NodeWithStats[](0);

        uint returnLen = treeLen > _num ? _num : treeLen;
        Infeglobal.NodeWithStats[] memory _users = new Infeglobal.NodeWithStats[](returnLen);

        for (uint i = 0; i < returnLen; i++) {
            uint targetId = networkTree[_nodeId][_layer][treeLen - 1 - i];
            _users[i] = Infeglobal.NodeWithStats({
                node: nodes[targetId],
                missedReward: rewardInfo[targetId].missedReward
            });
        }
        return _users;
    }

    function getTierCosts(
        uint nativeTokenPrice,
        uint[18] storage tierPriceUSD
    ) external view returns (uint[18] memory _costs) {
        uint safePrice = nativeTokenPrice == 0 ? 1e15 : nativeTokenPrice;
        for (uint i = 0; i < 18; i++) {
            _costs[i] = (tierPriceUSD[i] * 1e8) / safePrice;
        }
        return _costs;
    }

    function getDirectReferrals(
        mapping(uint => Infeglobal.Node) storage nodes,
        uint _userId
    ) external view returns (uint count) {
        return nodes[_userId].directNodes;
    }

    function getMatrixPosition(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(uint => mapping(uint => uint[])) storage teams,
        uint _userId
    ) external view returns (
        uint uplineId,
        uint leftChild,
        uint rightChild
    ) {
        Infeglobal.Node memory node = nodes[_userId];
        uplineId = node.matrixParent;
        
        if (teams[_userId][0].length > 0) {
            leftChild = teams[_userId][0][0];
        }
        if (teams[_userId][0].length > 1) {
            rightChild = teams[_userId][0][1];
        }
    }

    function isNodeActive(
        mapping(uint => Infeglobal.Node) storage nodes,
        uint userId
    ) external view returns (bool) {
        return (nodes[userId].nodeId != 0);
    }

    function isNodeRegistered(
        mapping(address => uint) storage nodeId,
        address node
    ) external view returns (bool) {
        return (nodeId[node] != 0);
    }

    function getMatrixDirect(
        mapping(uint => mapping(uint => uint[])) storage teams,
        uint _nodeId
    ) external view returns(uint[2] memory _directs) {
        for(uint i=0; i<teams[_nodeId][0].length && i<2; i++) {
            _directs[i] = teams[_nodeId][0][i];
        }
    }

    function getNodeCurDay(
        mapping(uint => Infeglobal.Node) storage nodes,
        uint _nodeId
    ) external view returns(uint) {
        return (block.timestamp - nodes[_nodeId].joinedAt) / 24 hours;
    }

    function getTierRewards(
        mapping(uint => Infeglobal.RewardInfo) storage rewardInfo,
        uint _nodeId
    ) external view returns(uint[18] memory) {
        return rewardInfo[_nodeId].tierRewards;
    }

    function addressToNodeId(
        mapping(address => uint) storage nodeId,
        address _wallet
    ) external view returns (uint256) {
        return nodeId[_wallet];
    }

    function getNode(
        mapping(uint => Infeglobal.Node) storage nodes,
        uint256 _nodeId
    ) external view returns (Infeglobal.Node memory) {
        require(nodes[_nodeId].nodeId != 0, "");
        return nodes[_nodeId];
    }

    function getNodeByAddress(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(address => uint) storage nodeId,
        address _addr
    ) external view returns (Infeglobal.Node memory) {
        uint userId = nodeId[_addr];
        require(userId != 0, "");
        return nodes[userId];
    }

    function getFeeReceiverBreakdown() external pure returns (
        uint platformFees,
        uint missedRewards,
        uint totalPending
    ) {
        return (0, 0, 0);
    }

    function getTeamSize(
        mapping(uint => mapping(uint => uint[])) storage networkTree,
        uint layerDepth,
        uint _userId,
        uint _depth
    ) external view returns (uint) {
        uint targetDepth = _depth;
        if (targetDepth >= layerDepth) {
            targetDepth = layerDepth - 1; // clamp to valid referral depth
        }
        return networkTree[_userId][targetDepth].length;
    }

    function getUserLevel(
        mapping(uint => Infeglobal.Node) storage nodes,
        uint _userId
    ) external view returns (uint) {
        return nodes[_userId].tier;
    }

    function canUpgrade(
        mapping(uint => Infeglobal.Node) storage nodes,
        uint _userId,
        uint _levels
    ) external view returns (bool) {
        Infeglobal.Node memory node = nodes[_userId];
        if (node.nodeId == 0) return false;
        if (node.tier + _levels > 18) return false;
        return true;
    }

    function getUpgradeCost(
        uint _fromLevel,
        uint _levels,
        uint nativeTokenPrice,
        uint[18] storage tierPriceUSD
    ) external view returns (uint totalCost) {
        require(_fromLevel + _levels <= 18, "");
        
        uint safePrice = nativeTokenPrice == 0 ? 1e15 : nativeTokenPrice;
        for (uint i = _fromLevel; i < _fromLevel + _levels; i++) {
            totalCost += (tierPriceUSD[i] * 1e8) / safePrice;
        }
    }

    function isOwnershipRenounced(address owner) external pure returns (bool) {
        return owner == address(0);
    }

    function getTransparencyData(
        uint totalNodes,
        uint totalBNBDistributed,
        address contractAddress,
        address owner
    ) external pure returns (
        uint  _totalNodes,
        uint  _totalBNBDistributed,
        uint  _totalTiers,
        address _contractAddress,
        address _ownerAddress,
        bool  _isRenounced
    ) {
        _totalNodes          = totalNodes;
        _totalBNBDistributed = totalBNBDistributed;
        _totalTiers          = 18;
        _contractAddress     = contractAddress;
        _ownerAddress        = owner;
        _isRenounced         = (owner == address(0));
    }

    function getConfig(
        uint defaultRefer,
        uint totalNodes,
        uint maxMatrixDepth,
        uint bnbPrice,
        uint lastPriceUpdate,
        address owner,
        address oracleAdmin,
        address matrixAdmin,
        address feeReceiver,
        address rewardPool,
        uint maxAllowedPrice,
        uint minAllowedPrice
    ) external pure returns (
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
    ) {
        return (
            defaultRefer,
            totalNodes,
            maxMatrixDepth,
            bnbPrice,
            lastPriceUpdate,
            owner,
            oracleAdmin,
            matrixAdmin,
            feeReceiver,
            rewardPool,
            maxAllowedPrice,
            minAllowedPrice
        );
    }

    function assignMatrixPosition(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(uint => mapping(uint => uint[])) storage teams,
        mapping(uint => uint) storage matrixChildCount,
        mapping(uint => uint) storage matrixDepth,
        mapping(uint => uint) storage minVacancyDepth,
        uint _nodeId,
        uint _sponsor,
        uint defaultRefer,
        uint maxMatrixDepth
    ) external returns (uint parentId, bool isFallback) {
        uint current = _sponsor;
        while (teams[current][0].length >= 2) {
            require(teams[current][0].length == 2, "");
            uint leftChild = teams[current][0][0];
            uint rightChild = teams[current][0][1];
            if (minVacancyDepth[leftChild] <= minVacancyDepth[rightChild]) {
                current = leftChild;
            } else {
                current = rightChild;
            }
        }
        parentId = current;
        
        if (parentId == 0) {
            parentId = defaultRefer;
            isFallback = true;
        }

        nodes[_nodeId].matrixParent = uint64(parentId);
        teams[parentId][0].push(_nodeId);
        matrixChildCount[parentId] = uint(teams[parentId][0].length);

        // PRE-COMPUTE O(1) MATRIX REWARD TARGETS (up to 18 levels)
        uint currentTarget = parentId;
        for(uint t=0; t<18; ++t) {
            if(currentTarget == 0) {
                nodes[_nodeId].matrixRewardReceiver[t] = uint64(defaultRefer);
            } else {
                nodes[_nodeId].matrixRewardReceiver[t] = uint64(currentTarget);
                currentTarget = nodes[currentTarget].matrixParent;
            }
        }

        // Set depth and vacancy for the new node
        matrixDepth[_nodeId] = matrixDepth[parentId] + 1;
        minVacancyDepth[_nodeId] = matrixDepth[_nodeId];

        // PASS 1 — Unlimited ancestor counter propagation and vacancy tracking
        {
            uint cId = parentId;
            while (cId != 0) {
                nodes[cId].totalMatrixNodes += 1;
                
                // Update minVacancyDepth for ancestor cId
                if (teams[cId][0].length < 2) {
                    minVacancyDepth[cId] = matrixDepth[cId];
                } else {
                    uint leftChild = teams[cId][0][0];
                    uint rightChild = teams[cId][0][1];
                    uint leftVacancy = minVacancyDepth[leftChild];
                    uint rightVacancy = minVacancyDepth[rightChild];
                    minVacancyDepth[cId] = leftVacancy < rightVacancy ? leftVacancy : rightVacancy;
                }
                
                cId = nodes[cId].matrixParent;
            }
        }

        // PASS 2 — Capped UI layer view (teams array) — max maxMatrixDepth levels.
        {
            uint cId = parentId;
            for (uint i = 1; i < maxMatrixDepth; ++i) {
                cId = nodes[cId].matrixParent;
                if (cId == 0) break;
                teams[cId][i].push(_nodeId);
            }
        }
    }

    function updateNetworkTree(
        mapping(uint => Infeglobal.Node) storage nodes,
        mapping(uint => mapping(uint => uint[])) storage networkTree,
        uint nodeId,
        uint sponsor,
        uint layerDepth
    ) external {
        uint parentId = sponsor;
        for (uint i = 0; i < layerDepth; ++i) {
            if (parentId == 0) break;
            networkTree[parentId][i].push(nodeId);
            parentId = nodes[parentId].sponsor;
        }
    }
}

interface ICoreForViews {
    function owner() external view returns (address);
    function oracleAdmin() external view returns (address);
    function matrixAdmin() external view returns (address);
    function feeReceiver() external view returns (address);
    function rewardPool() external view returns (address);
    
    function defaultRefer() external view returns (uint);
    function totalNodes() external view returns (uint);
    function nativeTokenPrice() external view returns (uint);
    function lastPriceUpdate() external view returns (uint);
    function config() external view returns (string memory, address, uint, uint);
    
    function totalFreeUsers() external view returns (uint);
    function totalFreeUpgraded() external view returns (uint);
    function isFreeRegistered(uint) external view returns (bool);
    function _nextId() external view returns (uint);
    
    function nodes(uint) external view returns (address, uint64, uint64, uint64, uint40, uint8, uint32, uint32, uint);
    function rewardInfo(uint) external view returns (uint, uint, uint, uint, uint, uint);
    function treasuryBalance(uint) external view returns (uint);
    
    function levelFreeCount(uint, uint) external view returns (uint);
    function levelPaidCount(uint, uint) external view returns (uint);
    function levelTreasuryGenerated(uint, uint) external view returns (uint);
    function levelTreasuryUsed(uint, uint) external view returns (uint);
    function levelRewardsDistributed(uint, uint) external view returns (uint);
    function teamTotalUpgrades(uint) external view returns (uint);
    
    function teams(uint, uint, uint) external view returns (uint);
    function tierPriceUSD(uint) external view returns (uint);
    function maxMatrixDepth() external view returns (uint);
    function totalBNBDistributed() external view returns (uint);
    function nodeId(address) external view returns (uint);
    // networkTree(parentId, depth, index)
    function networkTree(uint, uint, uint) external view returns (uint);
    // rewardHistory(nodeId, index)
    function rewardHistory(uint, uint) external view returns (uint, uint, uint, uint, bool, uint, uint);
}

contract NFEGlobalViewsContract {

    function _getPoolIncome(address _rewardPool, uint _userId) private view returns (uint) {
        if (_rewardPool == address(0)) return 0;
        uint poolIncome = 0;
        try IRewardPoolViews(_rewardPool).getClaimable(_userId) returns (uint, uint, uint claimable) {
            try IRewardPoolViews(_rewardPool).totalClaimed(_userId) returns (uint claimed) {
                poolIncome = claimable + claimed;
            } catch {}
        } catch {}
        return poolIncome;
    }

    function getNodeStats(uint256 _userId) external view returns (
        uint256 totalEarned,
        uint256 teamSize,
        uint256 directRefs,
        uint256 level
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        (address w,,,,,uint8 tier,uint32 directNodes,,) = core.nodes(_userId);
        if (w == address(0)) return (0, 0, 0, 0);
        
        directRefs = uint256(directNodes);
        level = uint256(tier);
        
        // Calculate team size across 10 levels
        for (uint256 i = 0; i < 10; i++) {
            teamSize += core.levelFreeCount(_userId, i) + core.levelPaidCount(_userId, i);
        }
        
        (uint256 totalRewards,,,,,) = core.rewardInfo(_userId);
        uint256 poolIncome = _getPoolIncome(core.rewardPool(), _userId);
        totalEarned = totalRewards + poolIncome;
    }

    function getIncomeBreakdown(uint256 _userId) external view returns (
        uint256 direct,
        uint256 matrix,
        uint256 pool,
        uint256 pending
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        (
            ,
            uint256 sponsorReward,
            uint256 layerReward,
            uint256 matrixReward,
            uint256 directReward,
            
        ) = core.rewardInfo(_userId);
        
        direct = sponsorReward + directReward;
        matrix = layerReward + matrixReward;
        pool = _getPoolIncome(core.rewardPool(), _userId);
        pending = core.treasuryBalance(_userId);
    }

    function _getConversionRate(uint256 totalFree, uint256 totalUpgraded) internal pure returns (uint256) {
        if (totalFree == 0) return 0;
        return (totalUpgraded * 10000) / totalFree;
    }

    function getFreeStats() external view returns (
        uint256 totalFree,
        uint256 totalUpgraded,
        uint256 conversionRate
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        totalFree = core.totalFreeUsers();
        totalUpgraded = core.totalFreeUpgraded();
        conversionRate = _getConversionRate(totalFree, totalUpgraded);
    }

    function getFreeUserList(
        uint256 start,
        uint256 length
    ) external view returns (uint256[] memory freeUsers, uint256 totalFreeCount) {
        ICoreForViews core = ICoreForViews(msg.sender);
        uint256 nextId = core._nextId();
        
        uint256 count = 0;
        for (uint256 i = 55556; i < nextId; i++) {
            if (core.isFreeRegistered(i)) {
                count++;
            }
        }
        totalFreeCount = count;

        if (count == 0 || start >= count || length == 0) {
            return (new uint256[](0), totalFreeCount);
        }

        uint256 size = (count - start > length) ? length : (count - start);
        freeUsers = new uint256[](size);

        uint256 skipped = 0;
        uint256 added = 0;
        for (uint256 i = 55556; i < nextId && added < size; i++) {
            if (core.isFreeRegistered(i)) {
                if (skipped < start) {
                    skipped++;
                } else {
                    freeUsers[added] = i;
                    added++;
                }
            }
        }
    }

    function getFreeUserDetails(uint256 _nodeId) external view returns (
        address wallet,
        uint256 sponsor,
        uint256 tier,
        uint256 treasuryBal,
        uint256 joinedAt,
        bool isConverted,
        uint256 totalRewards
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        
        (
            address w,
            ,
            uint64 sp,
            ,
            uint40 ja,
            uint8 t,
            ,
            ,
            
        ) = core.nodes(_nodeId);
        
        wallet = w;
        sponsor = sp;
        tier = t;
        treasuryBal = core.treasuryBalance(_nodeId);
        joinedAt = ja;
        isConverted = !core.isFreeRegistered(_nodeId) && (tier >= 1);
        
        (
            uint256 tr,
            ,
            ,
            ,
            ,
            
        ) = core.rewardInfo(_nodeId);
        totalRewards = tr;
    }

    function getLevelWiseTeamStats(uint256 _nodeId) external view returns (
        uint256[10] memory freeUsers,
        uint256[10] memory paidUsers,
        uint256[10] memory teamSize,
        uint256[10] memory treasuryGenerated,
        uint256[10] memory treasuryUsed,
        uint256[10] memory conversions,
        uint256[10] memory rewardsDistributed
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        for (uint256 i = 0; i < 10; i++) {
            freeUsers[i] = core.levelFreeCount(_nodeId, i);
            paidUsers[i] = core.levelPaidCount(_nodeId, i);
            teamSize[i] = freeUsers[i] + paidUsers[i];
            treasuryGenerated[i] = core.levelTreasuryGenerated(_nodeId, i);
            treasuryUsed[i] = core.levelTreasuryUsed(_nodeId, i);
            conversions[i] = paidUsers[i];
            rewardsDistributed[i] = core.levelRewardsDistributed(_nodeId, i);
        }
    }

    function getTeamRevenueStats(uint256 _nodeId) external view returns (
        uint256 teamTreasuryGenerated,
        uint256 teamTreasuryUsed,
        uint256 remainingTreasury,
        uint256 totalUpgrades,
        uint256 teamRewardsDistributed
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        for (uint256 i = 0; i < 10; i++) {
            teamTreasuryGenerated += core.levelTreasuryGenerated(_nodeId, i);
            teamTreasuryUsed += core.levelTreasuryUsed(_nodeId, i);
            teamRewardsDistributed += core.levelRewardsDistributed(_nodeId, i);
        }
        remainingTreasury = teamTreasuryGenerated >= teamTreasuryUsed ? teamTreasuryGenerated - teamTreasuryUsed : 0;
        totalUpgrades = core.teamTotalUpgrades(_nodeId);
    }

    function getSponsorPerformance(uint256 _nodeId) external view returns (
        uint256 freeUsers,
        uint256 convertedUsers,
        uint256 conversionRate,
        uint256 teamGrowth
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        freeUsers = core.levelFreeCount(_nodeId, 0);
        convertedUsers = core.levelPaidCount(_nodeId, 0);
        
        uint256 directsCount = freeUsers + convertedUsers;
        conversionRate = _getConversionRate(directsCount, convertedUsers);
        
        for (uint256 i = 0; i < 10; i++) {
            teamGrowth += core.levelFreeCount(_nodeId, i) + core.levelPaidCount(_nodeId, i);
        }
    }

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
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        _defaultRefer = core.defaultRefer();
        _totalNodes = core.totalNodes();
        _maxMatrixDepth = core.maxMatrixDepth();
        _bnbPrice = core.nativeTokenPrice();
        _lastUpdate = core.lastPriceUpdate();
        _owner = core.owner();
        _oracleAdmin = core.oracleAdmin();
        _matrixAdmin = core.matrixAdmin();
        _feeReceiver = core.feeReceiver();
        _rewardPool = core.rewardPool();
        (,,uint maxP, uint minP) = core.config();
        _maxAllowedPrice = maxP;
        _minAllowedPrice = minP;
    }

    function getTierCosts() external view returns(uint[18] memory _costs) {
        ICoreForViews core = ICoreForViews(msg.sender);
        uint price = core.nativeTokenPrice();
        if (price == 0) price = 1e15;
        for (uint i = 0; i < 18; i++) {
            _costs[i] = (core.tierPriceUSD(i) * 1e8) / price;
        }
    }


    function getMatrixDirect(uint _nodeId) external view returns(uint[2] memory _directs) {
        ICoreForViews core = ICoreForViews(msg.sender);
        
        // Query elements index 0 and 1 of teams[_nodeId][0]
        try core.teams(_nodeId, 0, 0) returns (uint val0) {
            _directs[0] = val0;
        } catch {}
        
        try core.teams(_nodeId, 0, 1) returns (uint val1) {
            _directs[1] = val1;
        } catch {}
    }

    function getNodeCurDay(uint _nodeId) external view returns(uint) {
        ICoreForViews core = ICoreForViews(msg.sender);
        (,,,,uint40 joinedAt,,,,) = core.nodes(_nodeId);
        return (block.timestamp - joinedAt) / 24 hours;
    }
    function getUserLevel(uint _userId) external view returns (uint) {
        ICoreForViews core = ICoreForViews(msg.sender);
        (,,,,, uint8 tier,,,) = core.nodes(_userId);
        return uint(tier);
    }

    function canUpgrade(uint _userId, uint _levels) external view returns (bool) {
        ICoreForViews core = ICoreForViews(msg.sender);
        (address w,,,,,uint8 t,,,) = core.nodes(_userId);
        if (w == address(0)) return false;
        if (uint(t) + _levels > 18) return false;
        return true;
    }

    function getUpgradeCost(uint _fromLevel, uint _levels) external view returns (uint totalCost) {
        require(_fromLevel + _levels <= 18);
        ICoreForViews core = ICoreForViews(msg.sender);
        uint price = core.nativeTokenPrice();
        if (price == 0) price = 1e15;
        for (uint i = _fromLevel; i < _fromLevel + _levels; i++) {
            totalCost += (core.tierPriceUSD(i) * 1e8) / price;
        }
    }

    function getTeamSize(uint _userId, uint _depth) external view returns (uint) {
        ICoreForViews core = ICoreForViews(msg.sender);
        // layerDepth constant is 10 in the core contract
        uint d = _depth >= 10 ? 9 : _depth;
        // networkTree[userId][depth] length — read via teams mapping used for referral network
        // The core exposes networkTree as a public mapping auto-getter: networkTree(uint,uint,uint)->uint
        // We cannot get array length via auto-getter; approximate via iterating is too expensive.
        // Instead we provide a dedicated networkTree length via the teams/networkTree public var.
        // teams is matrix, networkTree is referral. For referral depth we need networkTree length.
        // Since the auto-getter doesn't expose length, we reuse the library-computed stored data:
        // levelFreeCount + levelPaidCount at depth d gives total referral count at that level.
        uint free = core.levelFreeCount(_userId, d);
        uint paid = core.levelPaidCount(_userId, d);
        return free + paid;
    }

    function getTransparencyData() external view returns (
        uint  _totalNodes,
        uint  _totalBNBDistributed,
        uint  _totalTiers,
        address _contractAddress,
        address _ownerAddress,
        bool  _isRenounced
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        _totalNodes = core.totalNodes();
        _totalBNBDistributed = core.totalBNBDistributed();
        _totalTiers = 18;
        _contractAddress = msg.sender;
        _ownerAddress = core.owner();
        _isRenounced = (core.owner() == address(0));
    }

    function getNode(uint256 _nodeId) external view returns (Infeglobal.Node memory) {
        ICoreForViews core = ICoreForViews(msg.sender);
        (
            address wallet,
            uint64 nodeId,
            uint64 sponsor,
            uint64 matrixParent,
            uint40 joinedAt,
            uint8 tier,
            uint32 directNodes,
            uint32 totalMatrixNodes,
            uint totalContribution
        ) = core.nodes(_nodeId);
        
        Infeglobal.Node memory node;
        node.wallet = wallet;
        node.nodeId = nodeId;
        node.sponsor = sponsor;
        node.matrixParent = matrixParent;
        node.joinedAt = joinedAt;
        node.tier = tier;
        node.directNodes = directNodes;
        node.totalMatrixNodes = totalMatrixNodes;
        node.totalContribution = totalContribution;
        return node;
    }

    function getNodeByAddress(address _addr) external view returns (Infeglobal.Node memory) {
        ICoreForViews core = ICoreForViews(msg.sender);
        uint256 id = core.nodeId(_addr);
        require(id != 0, "Node not found");
        
        (
            address wallet,
            uint64 nodeId,
            uint64 sponsor,
            uint64 matrixParent,
            uint40 joinedAt,
            uint8 tier,
            uint32 directNodes,
            uint32 totalMatrixNodes,
            uint totalContribution
        ) = core.nodes(id);
        
        Infeglobal.Node memory node;
        node.wallet = wallet;
        node.nodeId = nodeId;
        node.sponsor = sponsor;
        node.matrixParent = matrixParent;
        node.joinedAt = joinedAt;
        node.tier = tier;
        node.directNodes = directNodes;
        node.totalMatrixNodes = totalMatrixNodes;
        node.totalContribution = totalContribution;
        return node;
    }

    function getMatrixUsers(uint256 _nodeId, uint256 _layer, uint256 _startIndex, uint256 _num) external view returns(Infeglobal.Node[] memory) {
        ICoreForViews core = ICoreForViews(msg.sender);
        uint256 length = 0;
        while (true) {
            try core.teams(_nodeId, _layer, length) {
                length++;
            } catch {
                break;
            }
        }
        if (length == 0 || _startIndex >= length) return new Infeglobal.Node[](0);
        
        uint256 resultCount = (length > _num + _startIndex) ? _num : (length - _startIndex);
        Infeglobal.Node[] memory _users = new Infeglobal.Node[](resultCount);
        
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 targetId = core.teams(_nodeId, _layer, _startIndex + i);
            (
                address wallet,
                uint64 nodeId,
                uint64 sponsor,
                uint64 matrixParent,
                uint40 joinedAt,
                uint8 tier,
                uint32 directNodes,
                uint32 totalMatrixNodes,
                uint totalContribution
            ) = core.nodes(targetId);
            
            _users[i].wallet = wallet;
            _users[i].nodeId = nodeId;
            _users[i].sponsor = sponsor;
            _users[i].matrixParent = matrixParent;
            _users[i].joinedAt = joinedAt;
            _users[i].tier = tier;
            _users[i].directNodes = directNodes;
            _users[i].totalMatrixNodes = totalMatrixNodes;
            _users[i].totalContribution = totalContribution;
        }
        return _users;
    }

    function getNetworkNodes(uint256 _nodeId, uint256 _layer, uint256 _num) external view returns (Infeglobal.Node[] memory) {
        ICoreForViews core = ICoreForViews(msg.sender);
        uint256 treeLen = 0;
        while (true) {
            try core.networkTree(_nodeId, _layer, treeLen) {
                treeLen++;
            } catch {
                break;
            }
        }
        if (treeLen == 0) return new Infeglobal.Node[](0);

        uint256 returnLen = treeLen > _num ? _num : treeLen;
        Infeglobal.Node[] memory _users = new Infeglobal.Node[](returnLen);

        uint256 taken = 0;
        for (uint256 i = treeLen; i > treeLen - returnLen; i--) {
            uint256 targetId = core.networkTree(_nodeId, _layer, i - 1);
            (
                address wallet,
                uint64 nodeId,
                uint64 sponsor,
                uint64 matrixParent,
                uint40 joinedAt,
                uint8 tier,
                uint32 directNodes,
                uint32 totalMatrixNodes,
                uint totalContribution
            ) = core.nodes(targetId);
            
            _users[taken].wallet = wallet;
            _users[taken].nodeId = nodeId;
            _users[taken].sponsor = sponsor;
            _users[taken].matrixParent = matrixParent;
            _users[taken].joinedAt = joinedAt;
            _users[taken].tier = tier;
            _users[taken].directNodes = directNodes;
            _users[taken].totalMatrixNodes = totalMatrixNodes;
            _users[taken].totalContribution = totalContribution;
            taken++;
        }
        return _users;
    }

    function getIncome(uint256 _nodeId, uint256 _length) external view returns (Infeglobal.RewardEvent[] memory) {
        if (_length == 0) return new Infeglobal.RewardEvent[](0);
        ICoreForViews core = ICoreForViews(msg.sender);
        
        uint256 historyLen = 0;
        while (true) {
            try core.rewardHistory(_nodeId, historyLen) {
                historyLen++;
            } catch {
                break;
            }
        }
        if (historyLen == 0) return new Infeglobal.RewardEvent[](0);

        uint256 returnLen = historyLen > _length ? _length : historyLen;
        Infeglobal.RewardEvent[] memory _income = new Infeglobal.RewardEvent[](returnLen);

        uint256 index = returnLen - 1;
        for (uint256 i = historyLen; i > historyLen - returnLen; i--) {
            (
                uint256 id,
                uint256 layer,
                uint256 amount,
                uint256 time,
                bool isMissed,
                uint256 rewardType,
                uint256 tier
            ) = core.rewardHistory(_nodeId, i - 1);
            
            _income[index] = Infeglobal.RewardEvent(id, layer, amount, time, isMissed, rewardType, tier);
            if (index > 0) index--;
        }
        return _income;
    }

    function getPoolQualificationData(uint256 _userId) external view returns (
        uint256 totalDeposited,
        uint256 directReferrals,
        uint256 totalTeam,
        uint256 currentLevel,
        uint256 directTeamL1,
        uint256 matrixTeam,
        uint256 registrationTime,
        bool isActive
    ) {
        ICoreForViews core = ICoreForViews(msg.sender);
        (
            address wallet,
            ,
            ,
            ,
            uint40 joinedAt,
            uint8 tier,
            uint32 directNodes,
            uint32 totalMatrixNodes,
            uint totalContribution
        ) = core.nodes(_userId);
        
        totalDeposited = totalContribution;
        directReferrals = uint256(directNodes);
        
        for (uint256 i = 0; i < 10; i++) {
            totalTeam += core.levelFreeCount(_userId, i) + core.levelPaidCount(_userId, i);
        }
        
        currentLevel = uint256(tier);
        directTeamL1 = uint256(directNodes);
        matrixTeam = uint256(totalMatrixNodes);
        registrationTime = uint256(joinedAt);
        isActive = (wallet != address(0));
    }

    function missedRewardsByTier(uint256 _nodeId, uint256 _tier) external view returns (uint256 total) {
        ICoreForViews core = ICoreForViews(msg.sender);
        uint256 index = 0;
        while (true) {
            try core.rewardHistory(_nodeId, index) returns (
                uint256 ,
                uint256 ,
                uint256 amount,
                uint256 ,
                bool isMissed,
                uint256 ,
                uint256 tier
            ) {
                if (isMissed && tier == _tier) {
                    total += amount;
                }
                index++;
            } catch {
                break;
            }
        }
    }
}