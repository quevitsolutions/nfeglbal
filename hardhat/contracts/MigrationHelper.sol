// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./nfeglobalStorage.sol";

contract MigrationHelper is nfeglobalStorage {
    constructor() nfeglobalStorage(0) {}

    function migrateNode(
        Infeglobal.Node calldata nodeData,
        uint256 _treasuryBalance
    ) external {
        require(!migrationLocked, "Migration locked");
        uint64 _nodeId = nodeData.nodeId;
        require(nodes[_nodeId].nodeId == 0, "Node already exists");
        address _wallet = nodeData.wallet;
        require(nodeId[_wallet] == 0, "Wallet already registered");
        
        nodeId[_wallet] = _nodeId;
        nodes[_nodeId] = nodeData;
        
        if (_treasuryBalance > 0) {
            treasuryBalance[_nodeId] = _treasuryBalance;
            totalTreasuryBalance += _treasuryBalance;
            lastTreasuryActivity[_nodeId] = block.timestamp;
        }
        
        globalNodes.push(_nodeId);
        totalNodes += 1;
        
        if (_nodeId >= _nextId) {
            _nextId = _nodeId + 1;
        }
        
        emit NodeCreated(_wallet, _nodeId, nodeData.sponsor, nodeData.matrixParent);
    }

    function migratePendingReward(address _wallet, uint256 _amount) external {
        require(!migrationLocked, "Migration locked");
        require(pendingReward[_wallet] == 0, "Pending reward already exists");
        
        pendingReward[_wallet] = _amount;
        totalPendingRewards += _amount;
    }

    function proposeDormancy(uint _nodeId) external {
        Infeglobal.Node storage node = nodes[_nodeId];
        if (node.nodeId == 0)          revert NodeNotExist();
        if (dormancyProposed[_nodeId])  revert AlreadyProposed();
        if (treasuryDormant[_nodeId])   revert AlreadyDormant();
        
        uint lastAct = lastTreasuryActivity[_nodeId];
        if (lastAct == 0) {
            lastAct = node.joinedAt;
        }
        
        require(block.timestamp > lastAct + dormancyThreshold);
        
        dormancyProposed[_nodeId] = true;
        dormancyProposalTime[_nodeId] = block.timestamp;
        
        emit DormancyProposed(_nodeId, block.timestamp);
    }

    function _activateDormancy(uint _nodeId) private {
        treasuryDormant[_nodeId] = true;
        dormantStart[_nodeId] = block.timestamp;
        emit DormancyActivated(_nodeId, block.timestamp);
        emit TreasuryDormant(_nodeId, treasuryBalance[_nodeId], block.timestamp);
    }

    function _clearDormancyAndQueue(uint _nodeId, uint _amount) private {
        treasuryBalance[_nodeId] = 0;
        totalTreasuryBalance = (totalTreasuryBalance >= _amount) ? (totalTreasuryBalance - _amount) : 0;
        treasuryDormant[_nodeId] = false;
        dormantStart[_nodeId] = 0;
        dormancyProposed[_nodeId] = false;
        dormancyProposalTime[_nodeId] = 0;
        inTreasuryQueue[_nodeId] = false;
        delete queuedTier[_nodeId];
        delete queuedCostBNB[_nodeId];
    }

    function activateDormancy(uint _nodeId) external {
        require(dormancyProposed[_nodeId]);
        require(block.timestamp >= dormancyProposalTime[_nodeId] + 30 days);
        require(!treasuryDormant[_nodeId]);
        
        _activateDormancy(_nodeId);
    }

    function _claimDormant() private {
        uint _nodeId = nodeId[msg.sender];
        require(_nodeId != 0);
        if (dormancyProposed[_nodeId]) {
            dormancyProposed[_nodeId] = false;
            dormancyProposalTime[_nodeId] = 0;
        }
        if (treasuryDormant[_nodeId]) {
            require(block.timestamp <= dormantStart[_nodeId] + CLAIM_PERIOD);
            treasuryDormant[_nodeId] = false;
            dormantStart[_nodeId] = 0;
            emit DormancyRecovered(_nodeId);
        }
        lastTreasuryActivity[_nodeId] = block.timestamp;
    }

    function claimDormantTreasury() external {
        _claimDormant();
    }

    function migrateDormantTreasury(uint _nodeId) external {
        require(treasuryDormant[_nodeId]);
        require(block.timestamp > dormantStart[_nodeId] + CLAIM_PERIOD);
        
        uint amount = treasuryBalance[_nodeId];
        require(amount > 0);
        
        _clearDormancyAndQueue(_nodeId, amount);
        
        emit DormantTreasuryTransferred(_nodeId, amount);
        
        (bool success, ) = governance.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit DaoTreasuryIncreased(_nodeId, amount, address(governance).balance);
    }

    function declareDormant(uint _nodeId) external {
        Infeglobal.Node storage node = nodes[_nodeId];
        if (node.nodeId == 0) revert NodeNotExist();
        if (treasuryDormant[_nodeId]) revert AlreadyDormant();
        
        uint lastAct = lastTreasuryActivity[_nodeId];
        if (lastAct == 0) {
            lastAct = node.joinedAt;
        }
        
        if (block.timestamp <= lastAct + dormancyThreshold) revert NotInactiveLongEnough();
        
        _activateDormancy(_nodeId);
    }

    function reclaimDormantNode() external {
        _claimDormant();
    }

    function abandonTreasury(uint _nodeId) external {
        require(treasuryDormant[_nodeId]);
        require(block.timestamp > dormantStart[_nodeId] + CLAIM_PERIOD);
        
        uint amount = treasuryBalance[_nodeId];
        require(amount > 0);
        
        _clearDormancyAndQueue(_nodeId, amount);

        (bool success, ) = governance.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit TreasuryAbandoned(_nodeId, governance, amount);
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
        else if(_type == 13) {
            _checkOwner();
            require(_new != address(0));
            address oldAddr = governance;
            governance = _new;
            emit AddressUpdated(13, _new, oldAddr);
        }
        else if(_type == 14) {
            _checkOwner();
            require(_num > 0);
            uint oldVal = dormancyThreshold;
            dormancyThreshold = _num;
            emit DormancyThresholdUpdated(oldVal, _num);
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

    function setRegistrationFeeUSD(uint256 newFee) external {
        _checkOwner();
        registrationFeeUSD = newFee;
    }

    function manualUpdatePrice(uint _newPrice) external {
        _checkOwnerOrOracleAdmin();
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
    
    function setPriceBounds(uint _min, uint _max) external {
        _checkOwnerOrOracleAdmin();
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

    function setNativeTokenSymbol(string calldata _symbol) external {
        _checkOwnerOrOracleAdmin();
        nativeTokenSymbol = _symbol;
        config.nativeSymbol = _symbol;
    }
    
    function renounceOwnership() external {
        _checkOwner();
        address oldOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(oldOwner, address(0));
    }

    function transferOwnership(address _newOwner) external {
        _checkOwner();
        require(_newOwner != address(0));
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
}

interface AggregatorV3Interface {
  function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
