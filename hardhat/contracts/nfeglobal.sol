

pragma solidity ^0.8.20;




import "./Infeglobal.sol";
import "./nfeglobalViews.sol";
import "./nfeglobalStorage.sol";

interface AggregatorV3Interface {
  function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}



interface IRewardPool {
    function registerNode(uint nodeId) external;
}

contract nfeglobal is nfeglobalStorage {

    


    event FreeNodeRegistered(uint256 indexed nodeId, address indexed wallet, uint256 indexed sponsor);
    event FreeNodeUpgraded(uint256 indexed nodeId, address indexed wallet);



    constructor(
        address _firstUser,
        address _feeReceiver,
        address _rewardPool,
        address _owner,
        address _oracleAdmin,
        address _matrixAdmin
    ) nfeglobalStorage(55555) {
        require(_firstUser   != address(0));
        require(_feeReceiver != address(0));
        require(_owner       != address(0));
        require(_oracleAdmin != address(0));
        require(_matrixAdmin != address(0));

        owner       = _owner;
        oracleAdmin = _oracleAdmin;
        matrixAdmin = _matrixAdmin;

        string memory sym = "BNB";
        if (block.chainid == 137 || block.chainid == 80001 || block.chainid == 80002) {
            sym = "POL";
        } else if (block.chainid == 8453 || block.chainid == 84531 || block.chainid == 84532 || block.chainid == 42161 || block.chainid == 421613 || block.chainid == 421614) {
            sym = "ETH";
        } else if (block.chainid == 43114 || block.chainid == 43113) {
            sym = "AVAX";
        }

        nativeTokenSymbol = sym;
        maxAllowedPrice = 5000e8;
        minAllowedPrice = 100e8;

        config = Infeglobal.ChainConfig({
            nativeSymbol: sym,
            priceFeed: address(0),
            maxAllowedPrice: 5000e8,
            minAllowedPrice: 100e8
        });

        nativeTokenPrice = 60000000000; 
        lastPriceUpdate = block.timestamp;

        feeReceiver = _feeReceiver;
        if (_rewardPool != address(0)) {
            rewardPool = _rewardPool;
        }

        defaultRefer = 55555;
        _nextId      = defaultRefer + 1;

        uint newId = defaultRefer;
        nodeId[_firstUser] = newId;
        Infeglobal.Node storage node  = nodes[newId];
        node.nodeId        = uint64(newId);
        node.sponsor       = 0;
        node.matrixParent  = 0;
        node.wallet        = _firstUser;
        globalNodes.push(node.nodeId);
        totalNodes += 1;
        node.tier     = 1;
        node.joinedAt = uint40(block.timestamp);
        node.totalContribution += getTierCost(0);

        matrixDepth[newId] = 1;
        minVacancyDepth[newId] = 1;
    }
    receive() external payable {}

    
    function nativePrice() public view returns (uint) {
        return nativeTokenPrice;
    }

    
    function bnbPrice() public view returns (uint) {
        return nativeTokenPrice;
    }

    
    function totalMissedRewards() public view returns (uint) {
        return totalTreasuryBalance;
    }

    
    function lastActivity(uint _nodeId) public view returns (uint) {
        return lastTreasuryActivity[_nodeId];
    }

    
    function missedRewardsByTier(uint _nodeId, uint _tier) public view returns (uint) {
        return nfeglobalViews.missedRewardsByTier(rewardHistory, _nodeId, _tier);
    }

    
    function treasury(uint _nodeId) public view returns (uint bnbAmount, uint usdValue) {
        return (treasuryBalance[_nodeId], (treasuryBalance[_nodeId] * nativeTokenPrice) / 1e8);
    }

    function getTierCost(uint tier) public view returns (uint) {
        return tierPriceUSD[tier] * 1e8 / nativeTokenPrice;
    }

    function _syncOraclePrice() private {
        if(config.priceFeed != address(0)) {
             try AggregatorV3Interface(config.priceFeed).latestRoundData() returns (
                 uint80 ,
                 int256 price,
                 uint256 ,
                 uint256 updatedAt,
                 uint80 
             ) {
                  
                  
                  if (block.timestamp - updatedAt > ORACLE_HEARTBEAT) return;
                  
                  if (updatedAt <= lastOracleRoundTime) return;
                  if (price <= 0) return;
                  
                  uint newPrice = uint(price);
                  
                  
                  if (newPrice < config.minAllowedPrice || newPrice > config.maxAllowedPrice) return;
                  
                  
                  uint deviation = newPrice > nativeTokenPrice ? 
                      ((newPrice - nativeTokenPrice) * 10000) / nativeTokenPrice :
                      ((nativeTokenPrice - newPrice) * 10000) / nativeTokenPrice;
                      
                   if (deviation > 5000) {
                       oracleCircuitBreaker = true;
                       circuitBreakerActivatedAt = block.timestamp;
                       emit OracleCircuitBreakerTriggered(nativeTokenPrice, newPrice, deviation);
                   }
                  if (deviation > MAX_PRICE_DEVIATION) {
                      
                      
                      emit OracleDeviationTooHigh(nativeTokenPrice, newPrice, deviation, block.timestamp);
                  }
                 nativeTokenPrice = newPrice;
                 lastOracleRoundTime = updatedAt;
                 lastPriceUpdate = block.timestamp;
                 emit OraclePriceUpdated(nativeTokenPrice, block.timestamp);
             } catch {
                 emit OracleError(config.priceFeed, block.timestamp);
             }
        }
    }

    function _pushReward(address _to, uint _amt) private {
        if(_amt > 0) {
            require(_to != address(0));
            (bool success, ) = payable(_to).call{value: _amt, gas: TRANSFER_GAS_LIMIT}("");
            if(!success) {
                
                pendingReward[_to] += _amt;
                totalPendingRewards += _amt;
                emit RewardPending(_to, _amt);
            } else {
                totalBNBDistributed += _amt; 
            }
        }
    }

    
    function withdraw() external nonReentrant {
        uint amount = pendingReward[msg.sender];
        require(amount > 0);
        uint nid = nodeId[msg.sender];
        if (nid != 0) {
            lastTreasuryActivity[nid] = block.timestamp;
        }
        pendingReward[msg.sender] = 0; 
        totalPendingRewards -= amount;
        totalBNBDistributed += amount; 
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok);
    }

    
    function getPendingUpgradeRewards(uint _nodeId) public view returns (uint) {
        return treasuryBalance[_nodeId];
    }

    function _routeToPool(address _pool, uint _amt) private {
        if(_amt > 0) {
            _pushReward(_pool == address(0) ? feeReceiver : _pool, _amt);
        }
    }

    
    
    
    
    function getNodeCurDay(uint _nodeId) public view returns(uint) {
        return (block.timestamp - nodes[_nodeId].joinedAt) / 24 hours;
    }

    function _recordReward(uint _fromNode, uint _toNode, uint _tier, uint _amount, uint _type, bool _isMissed, uint _layerIndex) private {
        if (_isMissed) {
            rewardInfo[_toNode].missedReward += _amount;
        } else {
            rewardInfo[_toNode].totalRewards += _amount;
            if (_type == 1) {
                rewardInfo[_toNode].sponsorReward += _amount;
                rewardInfo[_toNode].directReward += _amount; 
            }
            else if (_type == 2) rewardInfo[_toNode].layerReward += _amount;
            else if (_type == 3) rewardInfo[_toNode].matrixReward += _amount;
            
            rewardInfo[_toNode].tierRewards[_tier] += _amount;
            nodeDayReward[_toNode][getNodeCurDay(_toNode)] += _amount;
        }

        rewardHistory[_toNode].push(Infeglobal.RewardEvent(_fromNode, _layerIndex, _amount, block.timestamp, _isMissed, _type, _tier));
        emit RewardDistributed(nodes[_fromNode].wallet, _toNode, _fromNode, _layerIndex, _amount, block.timestamp, _isMissed, _type, _tier);
    }


    
    
    function scheduleRescueNative() external onlyOwner {
        _scheduleRescueNativeInternal();
    }

    function _scheduleRescueNativeInternal() private {
        rescueTimeLock = block.timestamp + RESCUE_DELAY;
        emit RescueScheduled(rescueTimeLock);
    }

    
    
    
    
    
    function rescueNative(uint _amount) external onlyOwner {
        _rescueNativeInternal(_amount);
    }

    function _rescueNativeInternal(uint _amount) private {
        require(rescueTimeLock != 0);
        require(block.timestamp >= rescueTimeLock);

        
        uint reserved = totalTreasuryBalance + totalPendingRewards;
        require(address(this).balance > reserved);
        uint maxDust = address(this).balance - reserved;
        uint toSend  = _amount > maxDust ? maxDust : _amount;

        rescueTimeLock = 0; 

        
        address destination = rewardPool != address(0) ? rewardPool : feeReceiver;
        (bool ok,) = payable(destination).call{value: toSend}("");
        require(ok);

        emit DustSwept(toSend, destination, block.timestamp);
    }

    
    
    

    function _createNodeInternal(address _user, uint _sponsor, uint _value) internal {
        
        uint newId = _nextId;
        _nextId += 1;
        nodeId[_user] = newId;
        Infeglobal.Node storage node = nodes[newId];
        node.nodeId = uint64(newId);
        lastTreasuryActivity[newId] = block.timestamp;

        uint regFee = getRegistrationFee();
        require(_value >= regFee, "Insufficient registration fee"); 
        
        // Forward registration fee to feeReceiver
        _pushReward(feeReceiver, regFee);

        if(_value > regFee) {
            (bool ok,) = payable(_user).call{value: _value - regFee}("");
            require(ok, "Refund failed");
        }

        node.sponsor = uint64(_sponsor);
        node.wallet = _user;
        node.joinedAt = uint40(block.timestamp);
        node.tier = 0; // Starts at Tier 0
        node.totalContribution = 0;

        isFreeRegistered[newId] = true;
        totalFreeUsers += 1;
       
        nodes[node.sponsor].directNodes += 1;
        nfeglobalViews.updateNetworkTree(nodes, networkTree, node.nodeId, node.sponsor, layerDepth);
        _propagateRegistration(newId, node.sponsor);

        globalNodes.push(node.nodeId);
        totalNodes += 1;

        if(totalNodes > 1){ 
            _assignMatrixPosition(node.nodeId, node.sponsor);
        }

        emit NodeCreated(node.wallet, node.nodeId, node.sponsor, node.matrixParent);
        emit FreeNodeRegistered(newId, _user, _sponsor);
        emit PoolCheckRequired(newId, block.timestamp);
        _autoUpgradeBatch();
    }

    function createNode(uint _sponsor) external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if(block.timestamp > lastPriceUpdate + 24 hours) {
            _syncOraclePrice();
        }

        require(nodeId[msg.sender] == 0);
        require(nodes[_sponsor].joinedAt > 0 || _sponsor == defaultRefer);

        _createNodeInternal(msg.sender, _sponsor, msg.value);
    }

    
    
    function createNodeWithSponsorAddress(address _sponsorAddress) external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if(block.timestamp > lastPriceUpdate + 24 hours) {
            _syncOraclePrice();
        }
        require(nodeId[msg.sender] == 0);
        uint sponsorId = nodeId[_sponsorAddress];
        require(sponsorId != 0); 
        _createNodeInternal(msg.sender, sponsorId, msg.value);
    }


    function _applyTreasuryDiscount(uint _nodeId, uint cost) private returns (uint) {
        uint disc = treasuryBalance[_nodeId];
        if (disc >= cost) {
            treasuryBalance[_nodeId] -= cost;
            totalTreasuryBalance = totalTreasuryBalance >= cost ? totalTreasuryBalance - cost : 0;
            totalTreasuryUsed[_nodeId] += cost;
            _propagateTreasuryUsed(_nodeId, cost);
            emit TreasuryUsed(_nodeId, cost, treasuryBalance[_nodeId]);
            return 0;
        }
        treasuryBalance[_nodeId] = 0;
        totalTreasuryBalance = totalTreasuryBalance >= disc ? totalTreasuryBalance - disc : 0;
        if (disc > 0) {
            totalTreasuryUsed[_nodeId] += disc;
            _propagateTreasuryUsed(_nodeId, disc);
            emit TreasuryUsed(_nodeId, disc, 0);
        }
        return cost - disc;
    }

    function _unlockTierCore(uint _nodeId, uint _toTier) private {
        bool isSuper = (_nodeId == defaultRefer);
        Infeglobal.Node storage node = nodes[_nodeId];
        require(node.nodeId != 0);
        require(msg.sender == node.wallet);

        lastTreasuryActivity[_nodeId] = block.timestamp;
        if (dormancyProposed[_nodeId]) {
            dormancyProposed[_nodeId] = false;
            dormancyProposalTime[_nodeId] = 0;
        }

        require(_toTier > node.tier);
        require(_toTier <= 18);

        uint initialLvl = node.tier;
        uint totalCostBNB;
        for (uint i = initialLvl; i < _toTier; i++) {
            totalCostBNB += getTierCost(i);
        }

        uint valueToSend = isSuper ? 0 : _applyTreasuryDiscount(_nodeId, totalCostBNB);

        require(msg.value >= valueToSend);
        if (msg.value > valueToSend) {
            (bool refundOk, ) = payable(msg.sender).call{value: msg.value - valueToSend}("");
            require(refundOk);
        }

        for (uint i = initialLvl; i < _toTier; i++) {
            uint costI = getTierCost(i);
            if (!isSuper) _executeTierDistribution(_nodeId, i, costI);
            node.tier += 1;
            node.totalContribution += costI;
            _propagateUpgrade(_nodeId);
            uint rankIdx = i < 18 ? i : 17;
            nodes[node.sponsor].sponsorTierRanks[rankIdx] += 1;
            emit TierUnlocked(node.wallet, _nodeId, i + 1);
        }

        if (initialLvl == 0 && isFreeRegistered[_nodeId]) {
            isFreeRegistered[_nodeId] = false;
            totalFreeUpgraded += 1;
            _propagateConversion(_nodeId);
            emit FreeNodeUpgraded(_nodeId, node.wallet);
        }

        emit PoolCheckRequired(_nodeId, block.timestamp);
        _releaseTier18Treasury(_nodeId);
        _autoUpgradeBatch();
    }

    function unlockTier(uint _nodeId, uint _toTier) external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if (block.timestamp > lastPriceUpdate + 24 hours) _syncOraclePrice();
        _unlockTierCore(_nodeId, _toTier);
    }

    function activateTier1() external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if (block.timestamp > lastPriceUpdate + 24 hours) _syncOraclePrice();
        uint256 _nodeId = nodeId[msg.sender];
        require(_nodeId != 0, "Node does not exist");
        require(isFreeRegistered[_nodeId], "Already activated or not free");
        _unlockTierCore(_nodeId, 1);
    }



    function _executeTierDistribution(uint _nodeId, uint _tier, uint costI) private {
        
        uint toDist = costI * directPercent / baseDivider;
        _routeReward(nodes[_nodeId].sponsor, toDist);
        _recordReward(_nodeId, nodes[_nodeId].sponsor, _tier, toDist, 1, false, _tier + 1);

        
        uint rewardPoolAmount = costI * rewardPoolPercent / baseDivider;
        _routeToPool(rewardPool, rewardPoolAmount);

        
        
        _distributeLayerRewards(_nodeId, _tier, costI);
        _distributeMatrixRewards(_nodeId, _tier, costI);
    }

    


    function _enqueueIfEligible(uint nodeId_) private {
        if (nodeId_ == defaultRefer) return;
        if (inTreasuryQueue[nodeId_]) return;
        uint8 nextTier = nodes[nodeId_].tier;
        if (nextTier >= 18) return;
        
        uint costSnapshot = getTierCost(nextTier);
        if (treasuryBalance[nodeId_] >= costSnapshot) {
            queue[queueTail] = nodeId_;
            queueTail++;
            inTreasuryQueue[nodeId_] = true;
            queuedTier[nodeId_] = nextTier;
            queuedCostBNB[nodeId_] = costSnapshot;
            emit TreasuryNodeQueued(nodeId_, nextTier);
        }
    }

    
    
    
    
    function _routeReward(
        uint256 recipientNodeId,
        uint256 amount
    ) internal {
        if (nodes[recipientNodeId].nodeId != 0) {
            if (nodes[recipientNodeId].tier == 0) {
                treasuryBalance[recipientNodeId] += amount;
                totalTreasuryBalance += amount;
                _propagateTreasuryGenerated(recipientNodeId, amount);
                lastTreasuryActivity[recipientNodeId] = block.timestamp;
                emit TreasuryCredited(recipientNodeId, amount, treasuryBalance[recipientNodeId]);
                _enqueueIfEligible(recipientNodeId);
            } else {
                _pushReward(nodes[recipientNodeId].wallet, amount);
                _propagateRewardsDistributed(recipientNodeId, amount);
            }
        } else {
            revert InvalidNode();
        }
    }

    function _processRewardRouting(
        uint _fromNode,
        uint _toNode,
        uint _tier,
        uint _amount,
        uint _rewardType,
        uint _layerIndex,
        bool _isQualified
    ) private {
        if (nodes[_toNode].nodeId != 0) {
            if (nodes[_toNode].tier == 0) {
                treasuryBalance[_toNode] += _amount;
                totalTreasuryBalance += _amount;
                _propagateTreasuryGenerated(_toNode, _amount);
                lastTreasuryActivity[_toNode] = block.timestamp;
                emit TreasuryCredited(_toNode, _amount, treasuryBalance[_toNode]);
                _enqueueIfEligible(_toNode);
                _recordReward(_fromNode, _toNode, _tier, _amount, _rewardType, false, _layerIndex);
            } else {
                if (_isQualified || nodes[_toNode].tier >= 18) {
                    _routeReward(_toNode, _amount);
                    _recordReward(_fromNode, _toNode, _tier, _amount, _rewardType, false, _layerIndex);
                } else {
                    treasuryBalance[_toNode] += _amount;
                    totalTreasuryBalance += _amount;
                    _propagateTreasuryGenerated(_toNode, _amount);
                    lastTreasuryActivity[_toNode] = block.timestamp;
                    emit TreasuryCredited(_toNode, _amount, treasuryBalance[_toNode]);
                    _enqueueIfEligible(_toNode);
                    _recordReward(_fromNode, _toNode, _tier, _amount, _rewardType, true, _layerIndex);
                }
            }
        } else {
            revert InvalidNode();
        }
    }

    function _distributeLayerRewards(uint _nodeId, uint _tier, uint cost) private {
        uint parentId = nodes[_nodeId].sponsor;

        for(uint i=0; i<layerDepth; i++)
        {
            if(parentId == 0) break;

            uint _percent = 150; 

            uint toDist = cost * _percent / baseDivider;
            bool isQualified = false;
            if (nodes[parentId].nodeId != 0) {
                if (nodes[parentId].tier == 0) {
                    isQualified = true;
                } else {
                    isQualified = (nodes[parentId].tier > _tier && (i < 5 || nodes[parentId].directNodes >= minDirectNodes));
                }
            }

            _processRewardRouting(_nodeId, parentId, _tier, toDist, 2, i+1, isQualified);

            parentId = nodes[parentId].sponsor;
        }
    }
 
    
    
    function _distributeMatrixRewards(uint _nodeId, uint _tier, uint cost) private {
        
        uint totalMatrix = cost * cyclicPercent / baseDivider;

        
        uint primary = nodes[_nodeId].matrixRewardReceiver[_tier];
        if (primary == 0) primary = defaultRefer; 

        bool isQualified = false;
        if (nodes[primary].nodeId != 0) {
            if (nodes[primary].tier == 0) {
                isQualified = true;
            } else {
                isQualified = (nodes[primary].tier > _tier);
            }
        }
        _processRewardRouting(_nodeId, primary, _tier, totalMatrix, 3, _tier + 1, isQualified);
    }
 
    function _assignMatrixPosition(uint _nodeId, uint _sponsor) private {
        (, bool isFallback) = nfeglobalViews.assignMatrixPosition(
            nodes,
            teams,
            matrixChildCount,
            matrixDepth,
            minVacancyDepth,
            _nodeId,
            _sponsor,
            defaultRefer,
            maxMatrixDepth
        );
        if (isFallback) {
            emit MatrixFallback(_nodeId, _sponsor, block.timestamp);
        }
    }



    function getMatrixUsers(uint _nodeId, uint _layer, uint _startIndex, uint _num) external view returns(Infeglobal.Node[] memory) {
        return nfeglobalViews.getMatrixUsers(nodes, teams, _nodeId, _layer, _startIndex, _num);
    }

    function getIncome(uint _nodeId, uint _length) external view returns(Infeglobal.RewardEvent[] memory) {
        return nfeglobalViews.getIncome(rewardHistory, _nodeId, _length);
    }



    function getNetworkNodes(uint _nodeId, uint _layer, uint _num) external view returns(Infeglobal.Node[] memory) {
        return nfeglobalViews.getNetworkNodes(nodes, networkTree, _nodeId, _layer, _num);
    }

    function getTierRewards(uint _nodeId) external view returns(uint[18] memory) {
        return nfeglobalViews.getTierRewards(rewardInfo, _nodeId);
    }   


    function setAddr(uint _type, address _new, uint _num) external {
        _delegateToHelper(abi.encodeCall(this.setAddr, (_type, _new, _num)));
    }

    function setRegistrationFeeUSD(uint256 newFee) external onlyOwner {
        _delegateToHelper(abi.encodeCall(this.setRegistrationFeeUSD, (newFee)));
    }

    function getRegistrationFee() public view returns (uint256) {
        uint256 price = nativeTokenPrice;
        require(price > 0, "Invalid price");
        return (registrationFeeUSD * 1e8) / price;
    }

    function manualUpdatePrice(uint _newPrice) external onlyOwnerOrOracleAdmin {
        _delegateToHelper(abi.encodeCall(this.manualUpdatePrice, (_newPrice)));
    }
    
    function setPriceBounds(uint _min, uint _max) external onlyOwnerOrOracleAdmin {
        _delegateToHelper(abi.encodeCall(this.setPriceBounds, (_min, _max)));
    }

    function setNativeTokenSymbol(string calldata _symbol) external onlyOwnerOrOracleAdmin {
        _delegateToHelper(abi.encodeCall(this.setNativeTokenSymbol, (_symbol)));
    }
    
    function renounceOwnership() external onlyOwner {
        _delegateToHelper(abi.encodeCall(this.renounceOwnership, ()));
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        _delegateToHelper(abi.encodeCall(this.transferOwnership, (_newOwner)));
    }



    


    function getNode(uint256 _nodeId) external view returns (Infeglobal.Node memory) {
        return nfeglobalViews.getNode(nodes, _nodeId);
    }

    function getNodeByAddress(address _addr) external view returns (Infeglobal.Node memory) {
        return nfeglobalViews.getNodeByAddress(nodes, nodeId, _addr);
    }

    function getNodeStats(uint _userId) external view returns (
        uint tier,
        uint directCount,
        uint matrixCount,
        uint totalRewards,
        uint totalContribution,
        uint daysActive
    ) {
        return nfeglobalViews.getNodeStats(nodes, rewardInfo, rewardPool, _userId);
    }








    
    
    
    
    


    function getPoolQualificationData(uint _userId) external view returns (
        uint totalDeposited,
        uint directReferrals,
        uint totalTeam,
        uint currentLevel,
        uint directTeamL1,
        uint matrixTeam,
        uint registrationTime,
        bool isActive
    ) {
        return nfeglobalViews.getPoolQualificationData(nodes, networkTree, _userId);
    }



    
    
    


    
    
    

    




    function _propagateRegistration(uint256 /*nodeId*/, uint256 sponsor) private {
        uint256 parent = sponsor;
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            levelFreeCount[parent][i] += 1;
            parent = nodes[parent].sponsor;
        }
    }

    function _propagateConversion(uint256 nodeId_) private {
        uint256 parent = nodes[nodeId_].sponsor;
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            if (levelFreeCount[parent][i] > 0) {
                levelFreeCount[parent][i] -= 1;
            }
            levelPaidCount[parent][i] += 1;
            parent = nodes[parent].sponsor;
        }
    }

    function _propagateTreasuryGenerated(uint256 nodeId_, uint256 amount) private {
        uint256 parent = nodes[nodeId_].sponsor;
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            levelTreasuryGenerated[parent][i] += amount;
            parent = nodes[parent].sponsor;
        }
    }

    function _propagateTreasuryUsed(uint256 nodeId_, uint256 amount) private {
        uint256 parent = nodes[nodeId_].sponsor;
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            levelTreasuryUsed[parent][i] += amount;
            parent = nodes[parent].sponsor;
        }
    }

    function _propagateRewardsDistributed(uint256 nodeId_, uint256 amount) private {
        uint256 parent = nodes[nodeId_].sponsor;
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            levelRewardsDistributed[parent][i] += amount;
            parent = nodes[parent].sponsor;
        }
    }

    function _propagateUpgrade(uint256 nodeId_) private {
        uint256 parent = nodes[nodeId_].sponsor;
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            teamTotalUpgrades[parent] += 1;
            parent = nodes[parent].sponsor;
        }
    }

    function _autoUpgradeTier(uint nodeId_, uint costBNB) private {
        Infeglobal.Node storage node = nodes[nodeId_];
        uint8 currentTier = node.tier;
        if (currentTier >= 18 || nodeId_ == defaultRefer) {
            return;
        }

        if (treasuryBalance[nodeId_] >= costBNB) {
            
            treasuryBalance[nodeId_] -= costBNB;
            totalTreasuryBalance = (totalTreasuryBalance >= costBNB) ? (totalTreasuryBalance - costBNB) : 0;
            totalTreasuryUsed[nodeId_] += costBNB;
            _propagateTreasuryUsed(nodeId_, costBNB);
            emit TreasuryUsed(nodeId_, costBNB, treasuryBalance[nodeId_]);

            
            _executeTierDistribution(nodeId_, currentTier, costBNB);

            
            node.tier += 1;
            node.totalContribution += costBNB;
            _propagateUpgrade(nodeId_);

            if (currentTier == 0 && isFreeRegistered[nodeId_]) {
                isFreeRegistered[nodeId_] = false;
                totalFreeUpgraded += 1;
                _propagateConversion(nodeId_);
                emit FreeNodeUpgraded(nodeId_, node.wallet);
            }
            
            uint rankIdx = currentTier < 18 ? currentTier : 17;
            nodes[node.sponsor].sponsorTierRanks[rankIdx] += 1;

            emit TierUnlocked(node.wallet, nodeId_, currentTier + 1);
            emit TreasuryUpgradeExecuted(nodeId_, currentTier, currentTier + 1, costBNB);
            emit PoolCheckRequired(nodeId_, block.timestamp);

            
            lastTreasuryActivity[nodeId_] = block.timestamp;
            if (dormancyProposed[nodeId_]) {
                dormancyProposed[nodeId_] = false;
                dormancyProposalTime[nodeId_] = 0;
            }

            
            _releaseTier18Treasury(nodeId_);
        }
    }

    function _autoUpgradeBatch() internal {
        if (queueHead >= queueTail) return; 

        uint snapshotTail = queueTail;
        uint processed    = 0;

        while (processed < AUTO_BATCH && queueHead < snapshotTail) {
            uint nodeId_ = queue[queueHead];
            delete queue[queueHead];
            queueHead++;
            processed++;

            if (!inTreasuryQueue[nodeId_]) continue;

            Infeglobal.Node storage node = nodes[nodeId_];
            uint8 currentTier = node.tier;

            if (queuedTier[nodeId_] != currentTier) {
                
                inTreasuryQueue[nodeId_] = false;
                delete queuedTier[nodeId_];
                delete queuedCostBNB[nodeId_];
                _enqueueIfEligible(nodeId_);
                continue;
            }

            _processAutoUpgradeLoop(nodeId_);

            inTreasuryQueue[nodeId_] = false;
            delete queuedTier[nodeId_];
            delete queuedCostBNB[nodeId_];
            _enqueueIfEligible(nodeId_);

            emit TreasuryQueueProcessed(nodeId_, queueTail > queueHead ? queueTail - queueHead : 0);
        }
    }

    function _releaseTier18Treasury(uint _nodeId) private {
        Infeglobal.Node storage node = nodes[_nodeId];
        if (node.tier >= 18) {
            uint remaining = treasuryBalance[_nodeId];
            if (remaining > 0) {
                treasuryBalance[_nodeId] = 0;
                totalTreasuryBalance = (totalTreasuryBalance >= remaining) ? (totalTreasuryBalance - remaining) : 0;
                _routeReward(_nodeId, remaining);
                emit Tier18TreasuryReleased(_nodeId, remaining);
            }
        }
    }

    function _processAutoUpgradeLoop(uint _nodeId) private {
        Infeglobal.Node storage node = nodes[_nodeId];
        if (node.tier >= 18) {
            return;
        }

        uint cost = queuedCostBNB[_nodeId];
        if (cost == 0) {
            cost = getTierCost(node.tier);
        }

        if (treasuryBalance[_nodeId] < cost) {
            return;
        }

        _autoUpgradeTier(_nodeId, cost);
    }

    
    
    function selfUpgrade() external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if (block.timestamp > lastPriceUpdate + 24 hours) _syncOraclePrice();
        uint _nodeId = nodeId[msg.sender];
        require(_nodeId != 0);
        _unlockTierCore(_nodeId, nodes[_nodeId].tier + 1);
    }

    
    
    
    
    function processTreasuryQueue() external nonReentrant {
        _autoUpgradeBatch();
    }



    function proposeDormancy(uint _nodeId) external {
        _delegateToHelper(abi.encodeCall(this.proposeDormancy, (_nodeId)));
    }

    function activateDormancy(uint _nodeId) external {
        _delegateToHelper(abi.encodeCall(this.activateDormancy, (_nodeId)));
    }

    function claimDormantTreasury() external {
        _delegateToHelper(abi.encodeCall(this.claimDormantTreasury, ()));
    }

    function migrateDormantTreasury(uint _nodeId) external nonReentrant {
        _delegateToHelper(abi.encodeCall(this.migrateDormantTreasury, (_nodeId)));
    }

    function declareDormant(uint _nodeId) external {
        _delegateToHelper(abi.encodeCall(this.declareDormant, (_nodeId)));
    }

    function dormantSince(uint _nodeId) external view returns (uint) {
        return dormantStart[_nodeId];
    }

    function reclaimDormantNode() external {
        _delegateToHelper(abi.encodeCall(this.reclaimDormantNode, ()));
    }

    function abandonTreasury(uint _nodeId) external nonReentrant {
        _delegateToHelper(abi.encodeCall(this.abandonTreasury, (_nodeId)));
    }

    function _delegateToHelper(bytes memory data) private {
        require(migrationHelper != address(0), "Helper not set");
        (bool ok, bytes memory res) = migrationHelper.delegatecall(data);
        if (!ok) {
            assembly {
                revert(add(res, 32), mload(res))
            }
        }
    }


    function setGovernance(address _newGovernance) public onlyOwner {
        require(_newGovernance != address(0));
        address oldGov = governance;
        governance = _newGovernance;
        emit AddressUpdated(13, _newGovernance, oldGov);
    }

    function setMigrationHelper(address _helper) external onlyOwner {
        require(_helper != address(0));
        migrationHelper = _helper;
    }

    function migrateNode(
        Infeglobal.Node calldata nodeData,
        uint256 _treasuryBalance
    ) external onlyOwner {
        require(migrationHelper != address(0), "Helper not set");
        (bool ok, ) = migrationHelper.delegatecall(
            abi.encodeWithSignature("migrateNode((address,uint64,uint64,uint64,uint40,uint8,uint32,uint32,uint256,uint32[18],uint64[18]),uint256)", nodeData, _treasuryBalance)
        );
        require(ok, "Delegatecall failed");
    }

    function migratePendingReward(address _wallet, uint256 _amount) external onlyOwner {
        require(migrationHelper != address(0), "Helper not set");
        (bool ok, ) = migrationHelper.delegatecall(
            abi.encodeWithSignature("migratePendingReward(address,uint256)", _wallet, _amount)
        );
        require(ok, "Delegatecall failed");
    }

    function lockMigrationForever() external onlyOwner {
        migrationLocked = true;
        emit MigrationLocked();
    }

    function resetOracleCircuitBreaker() external {
        if (msg.sender != owner && msg.sender != oracleAdmin) {
            require(oracleCircuitBreaker && block.timestamp >= circuitBreakerActivatedAt + 48 hours);
        }
        
        uint256 activatedAtBefore = circuitBreakerActivatedAt;
        _syncOraclePrice();
        
        require(block.timestamp - lastPriceUpdate <= ORACLE_HEARTBEAT);
        require(nativeTokenPrice >= config.minAllowedPrice && nativeTokenPrice <= config.maxAllowedPrice);
        require(circuitBreakerActivatedAt == activatedAtBefore);
        
        oracleCircuitBreaker = false;
        circuitBreakerActivatedAt = 0;
    }

    function skimDust() external nonReentrant {
        uint bal = address(this).balance;
        uint reserved = totalTreasuryBalance + totalPendingRewards;
        if (bal > reserved) {
            address target = rewardPool == address(0) ? feeReceiver : rewardPool;
            (bool ok, ) = payable(target).call{value: bal - reserved}("");
            require(ok);
            emit DustSkimmed(bal - reserved, target);
        }
    }

    function canUpgrade(uint _userId, uint _levels) external view returns (bool) {
        return nfeglobalViews.canUpgrade(nodes, _userId, _levels);
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
        return nfeglobalViews.getConfig(
            defaultRefer,
            totalNodes,
            maxMatrixDepth,
            nativeTokenPrice,
            lastPriceUpdate,
            owner,
            oracleAdmin,
            matrixAdmin,
            feeReceiver,
            rewardPool,
            config.maxAllowedPrice,
            config.minAllowedPrice
        );
    }

    function getMatrixDirect(uint _nodeId) external view returns (uint[2] memory) {
        return nfeglobalViews.getMatrixDirect(teams, _nodeId);
    }

    function getTeamSize(uint _userId, uint _depth) external view returns (uint) {
        return nfeglobalViews.getTeamSize(networkTree, layerDepth, _userId, _depth);
    }

    function getTierCosts() external view returns (uint[18] memory) {
        return nfeglobalViews.getTierCosts(nativeTokenPrice, tierPriceUSD);
    }

    function getTransparencyData() external view returns (
        uint  _totalNodes,
        uint  _totalBNBDistributed,
        uint  _totalTiers,
        address _contractAddress,
        address _ownerAddress,
        bool  _isRenounced
    ) {
        return nfeglobalViews.getTransparencyData(totalNodes, totalBNBDistributed, address(this), owner);
    }

    function getUpgradeCost(uint _fromLevel, uint _levels) external view returns (uint totalCost) {
        return nfeglobalViews.getUpgradeCost(_fromLevel, _levels, nativeTokenPrice, tierPriceUSD);
    }

    function getUserLevel(uint _userId) external view returns (uint) {
        return nfeglobalViews.getUserLevel(nodes, _userId);
    }

    function setViewsContract(address _v) external onlyOwner {
        viewsContract = _v;
    }

    fallback() external payable {
        address target = viewsContract;
        require(target != address(0));
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := staticcall(gas(), target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}


