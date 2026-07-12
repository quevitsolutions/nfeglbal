// SPDX-License-Identifier: MIT


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

interface IFounderPool {
    function onNodeRegistered(uint256 nodeId, uint256 sponsorId) external;
    function onNodeUpgrade(uint256 nodeId, uint256 fromTier, uint256 toTier) external;
}

interface ILeaderboardPool {
    function recordPoints(uint256 nodeId, uint256 actionType, uint256 amount) external;
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

    


    function getTierCost(uint tier) internal view returns (uint) {
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
        uint nid = nodeId[msg.sender];
        uint amount;
        if (nid != 0) {
            amount = accountBalances[nid].withdrawableBalance;
            accountBalances[nid].withdrawableBalance = 0;
            pendingReward[msg.sender] = 0;
            lastTreasuryActivity[nid] = block.timestamp;
        } else {
            amount = pendingReward[msg.sender];
            pendingReward[msg.sender] = 0;
        }
        require(amount > 0);

        totalPendingRewards = totalPendingRewards >= amount ? totalPendingRewards - amount : 0;

        if (incomeVault != address(0) && nid != 0 && nid != 55555) {
            (bool success, ) = incomeVault.call{value: amount, gas: 200000}(
                abi.encodeWithSignature("deposit(uint256)", nid)
            );
            if (success) {
                totalBNBDistributed += amount;
                return;
            }
        }

        totalBNBDistributed += amount; 
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok);
    }

    function depositToVault() external payable nonReentrant {
        uint256 userId = nodeId[msg.sender];
        require(userId != 0, "Node not registered");
        require(msg.value > 0, "Amount must be greater than 0");

        _creditTreasury(userId, msg.value);
        _propagateTreasuryGenerated(userId, msg.value);

        emit TreasuryCredited(userId, msg.value, accountBalances[userId].upgradeVaultBalance);

        _enqueueIfEligible(userId);
        _autoUpgradeBatch();
    }

    


    function _routeToPool(address _pool, uint _amt) private {
        if(_amt > 0) {
            _pushReward(_pool == address(0) ? feeReceiver : _pool, _amt);
        }
    }

    
    
    
    
    function getNodeCurDay(uint _nodeId) internal view returns(uint) {
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


    
    
    

    function _createNodeInternal(address _user, uint _sponsor, uint _value) internal {
        
        uint newId = _nextId;
        _nextId += 1;
        nodeId[_user] = newId;
        Infeglobal.Node storage node = nodes[newId];
        node.nodeId = uint64(newId);
        lastTreasuryActivity[newId] = block.timestamp;

        uint regFee = getRegistrationFee();
        require(_value >= regFee); 
        
        // Forward registration fee to feeReceiver
        _pushReward(feeReceiver, regFee);

        if(_value > regFee) {
            (bool ok,) = payable(_user).call{value: _value - regFee}("");
            require(ok);
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
        if (founderPool != address(0)) {
            try IFounderPool(founderPool).onNodeRegistered(newId, _sponsor) {} catch {}
        }
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


    function _unlockTierCore(uint _nodeId, uint _toTier) private {
        bool isSuper = (_nodeId == defaultRefer);
        Infeglobal.Node storage node = nodes[_nodeId];
        require(node.nodeId != 0);
        require(
            msg.sender == node.wallet ||
            msg.sender == incomeVault  ||
            msg.sender == renewalEngine,
            "Not authorized"
        );

        lastTreasuryActivity[_nodeId] = block.timestamp;

        require(_toTier > node.tier);
        require(_toTier <= 18);

        uint initialLvl = node.tier;
        uint totalCostBNB = 0;

        if (!isSuper) {
            for (uint8 i = uint8(initialLvl); i < _toTier; i++) {
                totalCostBNB += getTierCost(i);
            }
        }

        require(msg.value >= totalCostBNB);
        if (msg.value > totalCostBNB) {
            (bool refundOk, ) = payable(msg.sender).call{value: msg.value - totalCostBNB}("");
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
        accountBalances[_nodeId].lifetimeManualUpgrades += (_toTier - initialLvl);

        if (founderPool != address(0)) {
            try IFounderPool(founderPool).onNodeUpgrade(_nodeId, initialLvl, _toTier) {} catch {}
        }
        if (leaderboardPool != address(0)) {
            ILeaderboardPool(leaderboardPool).recordPoints(_nodeId, 1, _toTier - initialLvl);
            ILeaderboardPool(leaderboardPool).recordPoints(node.sponsor, 2, _toTier - initialLvl);
            ILeaderboardPool(leaderboardPool).recordPoints(_nodeId, 3, totalCostBNB);
            ILeaderboardPool(leaderboardPool).recordPoints(node.sponsor, 3, totalCostBNB);
        }

        if (initialLvl == 0 && isFreeRegistered[_nodeId]) {
            isFreeRegistered[_nodeId] = false;
            totalFreeUpgraded += 1;
            _propagateConversion(_nodeId);
            emit FreeNodeUpgraded(_nodeId, node.wallet);
        }

        emit PoolCheckRequired(_nodeId, block.timestamp);
        
        if (rewardPool != address(0) && nodes[_nodeId].tier >= 6) {
            try IRewardPool(rewardPool).registerNode(_nodeId) {} catch {}
        }
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
        require(_nodeId != 0);
        require(isFreeRegistered[_nodeId]);
        _unlockTierCore(_nodeId, 1);
    }



    function _executeTierDistribution(uint _nodeId, uint _tier, uint costI) private {
        
        uint toDist = costI * directPercent / baseDivider;
        _routeReward(nodes[_nodeId].sponsor, toDist, 1);
        _recordReward(_nodeId, nodes[_nodeId].sponsor, _tier, toDist, 1, false, _tier + 1);

        
        uint rewardPoolAmount = costI * rewardPoolPercent / baseDivider;
        _routeToPool(rewardPool, rewardPoolAmount);

        
        
        _distributeLayerRewards(_nodeId, _tier, costI);
        _distributeMatrixRewards(_nodeId, _tier, costI);
    }

    


    function _creditTreasury(uint nodeId, uint amount) private {
        if (amount == 0) return;
        treasuryBalance[nodeId] += amount;
        accountBalances[nodeId].upgradeVaultBalance = treasuryBalance[nodeId];
        accountBalances[nodeId].lifetimeVaultDeposits += amount;
        accountBalances[nodeId].totalTreasuryGenerated += amount;
        totalTreasuryBalance += amount;
        lastTreasuryActivity[nodeId] = block.timestamp;
    }

    function _debitTreasury(uint nodeId, uint amount) private {
        if (amount == 0) return;
        uint bal = treasuryBalance[nodeId];
        require(bal >= amount, "Debit exceeds balance");
        treasuryBalance[nodeId] -= amount;
        accountBalances[nodeId].upgradeVaultBalance = treasuryBalance[nodeId];
        totalTreasuryBalance = totalTreasuryBalance >= amount ? totalTreasuryBalance - amount : 0;
        lastTreasuryActivity[nodeId] = block.timestamp;
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
            emit UpgradeReady(nodeId_, nextTier + 1, treasuryBalance[nodeId_]);
        }
    }

    function _routeReward(
        uint256 recipientNodeId,
        uint256 amount,
        uint8 requiredTier
    ) internal {
        if (nodes[recipientNodeId].nodeId != 0) {
            if (nodes[recipientNodeId].tier >= requiredTier) {
                accountBalances[recipientNodeId].lifetimeRewards += amount;
                
                if (incomeVault != address(0) && recipientNodeId != 55555) {
                    (bool success, ) = incomeVault.call{value: amount, gas: 200000}(
                        abi.encodeWithSignature("deposit(uint256)", recipientNodeId)
                    );
                    if (!success) {
                        accountBalances[recipientNodeId].withdrawableBalance += amount;
                        pendingReward[nodes[recipientNodeId].wallet] = accountBalances[recipientNodeId].withdrawableBalance;
                        totalPendingRewards += amount;
                        emit RewardPending(nodes[recipientNodeId].wallet, amount);
                    } else {
                        totalBNBDistributed += amount;
                    }
                } else {
                    if (amount > 0) {
                        address toWallet = nodes[recipientNodeId].wallet;
                        (bool success, ) = payable(toWallet).call{value: amount, gas: TRANSFER_GAS_LIMIT}("");
                        if (!success) {
                            accountBalances[recipientNodeId].withdrawableBalance += amount;
                            pendingReward[toWallet] = accountBalances[recipientNodeId].withdrawableBalance;
                            totalPendingRewards += amount;
                            emit RewardPending(toWallet, amount);
                        } else {
                            totalBNBDistributed += amount;
                        }
                    }
                }
                _propagateRewardsDistributed(recipientNodeId, amount);
            } else {
                _creditTreasury(recipientNodeId, amount);
                _propagateTreasuryGenerated(recipientNodeId, amount);
                emit TreasuryCredited(recipientNodeId, amount, treasuryBalance[recipientNodeId]);
                _enqueueIfEligible(recipientNodeId);
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
            uint8 requiredTier = uint8(_tier + 1);
            if (_isQualified || nodes[_toNode].tier >= 18) {
                _routeReward(_toNode, _amount, requiredTier);
                _recordReward(_fromNode, _toNode, _tier, _amount, _rewardType, false, _layerIndex);
            } else {
                _creditTreasury(_toNode, _amount);
                _propagateTreasuryGenerated(_toNode, _amount);
                emit TreasuryCredited(_toNode, _amount, treasuryBalance[_toNode]);
                _recordReward(_fromNode, _toNode, _tier, _amount, _rewardType, true, _layerIndex);
                _enqueueIfEligible(_toNode);
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





    function getTierRewards(uint _nodeId) external view returns(uint[18] memory) {
        return nfeglobalViews.getTierRewards(rewardInfo, _nodeId);
    }   


    function setAddr(uint _type, address _new, uint _num) external {
        if(_type == 0) {
            _checkOwner();
            require(_new != address(0));
            address oldAddr = feeReceiver;
            feeReceiver = _new;
            emit AddressUpdated(0, _new, oldAddr);                  
        } 
        else if(_type == 1) {
            _checkOwner();
            require(_new != address(0));
            address oldAddr = rewardPool;
            rewardPool = _new;
            emit AddressUpdated(1, _new, oldAddr);                  
        } 
        else if(_type == 12) { 
            revert("");
        }
        else if(_type == 6) {
            _checkOwnerOrMatrixAdmin();
            require(_num >= 1);
            require(_num <= 50); 
            uint oldValue = maxMatrixDepth;
            maxMatrixDepth = _num;
            emit LayersUpdated(0, oldValue, _num);
        }
        else if(_type == 7) {
            _checkOwnerOrMatrixAdmin();
            require(_new != address(0));
            matrixAdmin = _new;
            emit MatrixAdminUpdated(_new);
        }
        else if(_type == 10) {
            _checkOwnerOrOracleAdmin();
            require(_new != address(0));
            oracleAdmin = _new;
            emit OracleAdminUpdated(_new);
        }
        else if(_type == 11) {
            _checkOwnerOrOracleAdmin();
            require(_new != address(0)); 
            config.priceFeed = _new;
            _syncOraclePrice();
        }
        else {
            revert(""); 
        }
    }

    function setRegistrationFeeUSD(uint256 newFee) external onlyGovernor {
        registrationFeeUSD = newFee;
    }

    /**
     * @notice Set the number of nodes processed per treasury queue batch
     * @param _batch Number of entries to process (1 to 50)
     */
    function setAutoBatch(uint _batch) external onlyGovernor {
        require(_batch > 0);
        require(_batch <= 50);
        autoBatch = _batch;

        emit AutoBatchUpdated(_batch);
    }

    function getRegistrationFee() public view returns (uint256) {
        uint256 price = nativeTokenPrice;
        require(price > 0);
        return (registrationFeeUSD * 1e8) / price;
    }

    function manualUpdatePrice(uint _newPrice) external onlyOwnerOrOracleAdmin {
        require(block.timestamp >= lastManualPriceUpdate + 1 hours);
        require(_newPrice >= config.minAllowedPrice);
        require(_newPrice <= config.maxAllowedPrice);
        
        uint deviation = _newPrice > nativeTokenPrice ? 
            ((_newPrice - nativeTokenPrice) * 10000) / nativeTokenPrice :
            ((nativeTokenPrice - _newPrice) * 10000) / nativeTokenPrice;
            
        require(deviation <= MAX_MANUAL_PRICE_DEVIATION);
        
        nativeTokenPrice = _newPrice;
        lastPriceUpdate = block.timestamp;
        lastManualPriceUpdate = block.timestamp; 
        emit OraclePriceUpdated(_newPrice, block.timestamp);
    }
    
    function setPriceBounds(uint _min, uint _max) external onlyOwnerOrOracleAdmin {
        require(_min > 0);
        require(_max > _min);
        uint oldMin = config.minAllowedPrice;
        uint oldMax = config.maxAllowedPrice;
        config.minAllowedPrice = _min;
        config.maxAllowedPrice = _max;
        minAllowedPrice = _min;
        maxAllowedPrice = _max;
        
        emit PriceBoundsUpdated(oldMin, oldMax, _min, _max);
    }

    function setNativeTokenSymbol(string calldata _symbol) external onlyOwnerOrOracleAdmin {
        nativeTokenSymbol = _symbol;
        config.nativeSymbol = _symbol;
    }
    
    function renounceOwnership() external onlyOwner {
        address oldOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(oldOwner, address(0));
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0));
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    // =========================================================================
    // Governance
    // =========================================================================

    /**
     * @notice Register the NFEGovernance contract as governor.
     *         Can be called multiple times by owner to migrate governor
     *         (owner → multisig → DAO). Emits GovernorSet.
     */
    function setGovernor(address _gov) external onlyOwner {
        require(_gov != address(0));
        address old = governor;
        governor = _gov;
        emit GovernorSet(old, _gov);
    }

    /**
     * @notice Set the income vault helper contract address.
     *         Only callable by governor or owner.
     * @param _vault  The new IncomeVaultHelper address.
     */
    function setVault(address _vault) external onlyGovernor {
        require(_vault != address(0));
        address oldVault = incomeVault;
        incomeVault = _vault;
        emit IncomeVaultUpdated(oldVault, _vault);
    }

    function setFounderPool(address _fp) external onlyGovernor {
        require(_fp != address(0));
        address old = founderPool;
        founderPool = _fp;
        emit FounderPoolUpdated(old, _fp);
    }

    function setLeaderboardPool(address _lp) external onlyGovernor {
        require(_lp != address(0));
        address old = leaderboardPool;
        leaderboardPool = _lp;
        emit LeaderboardPoolUpdated(old, _lp);
    }

    // =========================================================================
    // ICE System — Cycle Manager & Renewal Engine Hooks
    // =========================================================================

    /**
     * @notice Register the NFECycleManager contract.
     *         Only callable by governor or owner.
     * @param _cm  Address of the deployed NFECycleManager.
     */
    function setCycleManager(address _cm) external onlyGovernor {
        require(_cm != address(0));
        address old = cycleManager;
        cycleManager = _cm;
        emit CycleManagerUpdated(old, _cm);
    }

    /**
     * @notice Register the NFERenewalEngine contract.
     *         Only callable by governor or owner.
     * @param _engine  Address of the deployed NFERenewalEngine.
     */
    function setRenewalEngine(address _engine) external onlyGovernor {
        require(_engine != address(0));
        address old = renewalEngine;
        renewalEngine = _engine;
        emit RenewalEngineUpdated(old, _engine);
    }

    /**
     * @notice Execute full tier distribution for a renewal payment.
     *         Only callable by the registered renewalEngine.
     *         Treats the renewal like a Tier-0 unlock (Direct 10% + Layer + Matrix + Pool + Fee).
     * @param _nodeId   The node being renewed.
     * @param costBNB   The total renewal cost in BNB (used for distribution math).
     *                  msg.value must equal the non-treasury portion of costBNB.
     */
    function distributeRenewal(uint256 _nodeId, uint256 costBNB) external payable nonReentrant {
        require(msg.sender == renewalEngine);
        require(_nodeId != 0 && nodes[_nodeId].nodeId != 0, "Invalid node");
        require(_nodeId != defaultRefer, "Genesis exempt");

        // Update treasury activity timestamp
        lastTreasuryActivity[_nodeId] = block.timestamp;

        // Run full distribution at Tier-0 scale using the costBNB
        // _executeTierDistribution expects contract to hold the BNB
        _executeTierDistribution(_nodeId, 0, costBNB);

        emit RenewalDistributed(_nodeId, costBNB, block.timestamp);
        if (leaderboardPool != address(0)) {
            try ILeaderboardPool(leaderboardPool).recordPoints(nodes[_nodeId].sponsor, 5, 1) {} catch {}
        }
        _autoUpgradeBatch();
    }

    /**
     * @notice Deduct from a node's treasury balance.
     *         Only callable by the registered renewalEngine.
     * @param _nodeId  The node whose treasury is deducted.
     * @param amount   Amount to deduct in wei.
     */
    function deductTreasury(uint256 _nodeId, uint256 amount) external {
        require(msg.sender == renewalEngine);
        require(amount > 0);

        _debitTreasury(_nodeId, amount);
        accountBalances[_nodeId].lifetimeVaultUsed += amount;

        totalTreasuryUsed[_nodeId] += amount;
        _propagateTreasuryUsed(_nodeId, amount);
        emit TreasuryUsed(_nodeId, amount, treasuryBalance[_nodeId]);
    }

    /**
     * @notice Sweep a dormant node’s treasury balance (70/20/10).
     *         Only callable by governor or owner. Node must have been
     *         inactive for at least dormancyPeriod.
     * @param _nodeId  The node whose treasury is to be swept.
     */
    function sweepDormantTreasury(uint _nodeId) external onlyGovernor nonReentrant {
        require(_nodeId != defaultRefer);
        require(
            block.timestamp - lastTreasuryActivity[_nodeId] >= dormancyPeriod
        );
        uint bal = treasuryBalance[_nodeId];
        require(bal > 0);

        _debitTreasury(_nodeId, bal);

        uint rpAmt  = bal * dormancyRewardPoolBP / 10000;
        uint daoAmt = bal * dormancyDAOBP        / 10000;
        uint feeAmt = bal - rpAmt - daoAmt; // remainder to avoid rounding loss

        _pushReward(rewardPool   != address(0) ? rewardPool   : feeReceiver, rpAmt);
        _pushReward(daoTreasury  != address(0) ? daoTreasury  : feeReceiver, daoAmt);
        _pushReward(feeReceiver, feeAmt);

        emit DormantNodeSwept(_nodeId, rpAmt, daoAmt, feeAmt);
    }

    /**
     * @notice Update the dormancy period (governor or owner).
     * @param _period  Seconds of inactivity before a node is considered dormant.
     *                 Clamped to [365 days, 3650 days].
     */
    function setDormancyPeriod(uint _period) external onlyGovernor {
        require(_period >= 365 days);
        require(_period <= 3650 days);
        uint old = dormancyPeriod;
        dormancyPeriod = _period;
        emit DormancyPeriodUpdated(old, _period);
    }

    /**
     * @notice Update the dormancy distribution split (governor or owner).
     *         Basis points must sum to exactly 10 000.
     * @param _rpBP   Reward pool share in bp.
     * @param _daoBP  DAO treasury share in bp.
     * @param _feeBP  Fee receiver share in bp.
     */
    function setDormancyDistribution(
        uint _rpBP,
        uint _daoBP,
        uint _feeBP
    ) external onlyGovernor {
        require(_rpBP + _daoBP + _feeBP == 10000);
        dormancyRewardPoolBP = _rpBP;
        dormancyDAOBP        = _daoBP;
        dormancyFeeRecBP     = _feeBP;
        emit DormancyDistributionUpdated(_rpBP, _daoBP, _feeBP);
    }

    /**
     * @notice Set the DAO treasury address that receives the dormancy DAO share.
     * @param _dao  New DAO treasury address.
     */
    function setDaoTreasury(address _dao) external onlyGovernor {
        require(_dao != address(0));
        address old = daoTreasury;
        daoTreasury = _dao;
        emit DaoTreasuryUpdated(old, _dao);
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








    
    
    
    
    








    
    
    


    
    
    

    







    function _propagateMapping(
        uint256 parent,
        mapping(uint256 => mapping(uint256 => uint256)) storage levelMap,
        uint256 amount
    ) private {
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            levelMap[parent][i] += amount;
            parent = nodes[parent].sponsor;
        }
    }

    function _propagateUintMapping(
        uint256 parent,
        mapping(uint256 => uint256) storage levelMap
    ) private {
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            levelMap[parent] += 1;
            parent = nodes[parent].sponsor;
        }
    }

    function _propagateRegistration(uint256 /*nodeId*/, uint256 sponsor) private {
        _propagateMapping(sponsor, levelFreeCount, 1);
    }

    function _propagateConversion(uint256 nodeId_) private {
        uint256 parent = nodes[nodeId_].sponsor;
        _propagateMapping(parent, levelPaidCount, 1);
        for (uint256 i = 0; i < 10; i++) {
            if (parent == 0) break;
            if (levelFreeCount[parent][i] > 0) {
                levelFreeCount[parent][i] -= 1;
            }
            parent = nodes[parent].sponsor;
        }
    }

    function _propagateTreasuryGenerated(uint256 nodeId_, uint256 amount) private {
        _propagateMapping(nodes[nodeId_].sponsor, levelTreasuryGenerated, amount);
    }

    function _propagateTreasuryUsed(uint256 nodeId_, uint256 amount) private {
        _propagateMapping(nodes[nodeId_].sponsor, levelTreasuryUsed, amount);
    }

    function _propagateRewardsDistributed(uint256 nodeId_, uint256 amount) private {
        _propagateMapping(nodes[nodeId_].sponsor, levelRewardsDistributed, amount);
    }

    function _propagateUpgrade(uint256 nodeId_) private {
        _propagateUintMapping(nodes[nodeId_].sponsor, teamTotalUpgrades);
    }


    function _autoUpgradeTier(uint nodeId_, uint costBNB) private {
        Infeglobal.Node storage node = nodes[nodeId_];
        uint8 currentTier = node.tier;
        if (currentTier >= 18 || nodeId_ == defaultRefer) {
            return;
        }

        if (lastUpgradeBlock[nodeId_] >= block.number) {
            inTreasuryQueue[nodeId_] = false;
            delete queuedTier[nodeId_];
            delete queuedCostBNB[nodeId_];
            _enqueueIfEligible(nodeId_);
            return;
        }
        if (treasuryBalance[nodeId_] < costBNB) {
            return;
        }

        lastUpgradeBlock[nodeId_] = uint40(block.number);

        _debitTreasury(nodeId_, costBNB);
        accountBalances[nodeId_].lifetimeVaultUsed += costBNB;
        accountBalances[nodeId_].lifetimeAutoUpgrades++;

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
        if (node.sponsor != 0) {
            nodes[node.sponsor].sponsorTierRanks[rankIdx] += 1;
        }

        emit TierUnlocked(node.wallet, nodeId_, currentTier + 1);
        emit TreasuryUpgradeExecuted(nodeId_, currentTier, currentTier + 1, costBNB);
        emit PoolCheckRequired(nodeId_, block.timestamp);
        if (rewardPool != address(0) && node.tier >= 6) {
            try IRewardPool(rewardPool).registerNode(nodeId_) {} catch {}
        }

        lastTreasuryActivity[nodeId_] = block.timestamp;
        _releaseTier18Treasury(nodeId_);
    }

    function _autoUpgradeBatch() internal {
        if (queueHead >= queueTail) return; 

        uint snapshotTail = queueTail;
        uint processed    = 0;

        while (processed < autoBatch && queueHead < snapshotTail) {
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

            if (lastUpgradeBlock[nodeId_] >= block.number) {
                uint8 nextTier = node.tier;
                if (nextTier < 18 && treasuryBalance[nodeId_] >= getTierCost(nextTier)) {
                    queue[queueTail] = nodeId_;
                    queueTail++;
                } else {
                    inTreasuryQueue[nodeId_] = false;
                    delete queuedTier[nodeId_];
                    delete queuedCostBNB[nodeId_];
                }
                continue;
            }

            uint cost = getTierCost(currentTier);

            if (treasuryBalance[nodeId_] >= cost) {
                _autoUpgradeTier(nodeId_, cost);
            }

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
                _debitTreasury(_nodeId, remaining);
                accountBalances[_nodeId].withdrawableBalance += remaining;
                accountBalances[_nodeId].lifetimeRewards += remaining;
                pendingReward[node.wallet] += remaining;
                totalPendingRewards += remaining;
                emit Tier18TreasuryReleased(_nodeId, remaining);
            }
        }
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


