// Reduces contract size by:
// 1. Extracting _applyTreasuryDiscount() private helper  (dedup discount logic)
// 2. Extracting _unlockTierCore() private helper         (dedup unlockTier / selfUpgrade)
// 3. Making selfUpgrade() a 5-line wrapper               (~600 bytes saved)
// 4. Making _autoUpgradeTier call _releaseTier18Treasury (~80 bytes saved)
// Applied to both hardhat/contracts and contracts copies.

const fs = require('fs');
const path = require('path');

// ──────────────── helper ────────────────
function apply(src, from, to) {
  const idx = src.indexOf(from);
  if (idx === -1) throw new Error('Pattern not found:\n' + from.slice(0, 120));
  return src.slice(0, idx) + to + src.slice(idx + from.length);
}

// ──────────────── patch unlockTier → _applyTreasuryDiscount + _unlockTierCore ────────────────
const oldUnlockTier = `    function unlockTier(uint _nodeId, uint _toTier) external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if(block.timestamp > lastPriceUpdate + 24 hours) {
            _syncOraclePrice();
        }

        bool isSuper = (_nodeId == defaultRefer); \n        Node storage node = nodes[_nodeId];
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
        uint totalCostBNB = 0;

        for (uint i = initialLvl; i < _toTier; i++) {
            totalCostBNB += getTierCost(i);
        }

        uint valueToSend = totalCostBNB;
        if (!isSuper) {
            uint discountBNB = treasuryBalance[_nodeId];

            if (discountBNB >= totalCostBNB) {
                valueToSend = 0;
                treasuryBalance[_nodeId] -= totalCostBNB;
                totalTreasuryBalance = (totalTreasuryBalance >= totalCostBNB) ? (totalTreasuryBalance - totalCostBNB) : 0;
                emit TreasuryUsed(_nodeId, totalCostBNB, treasuryBalance[_nodeId]);
            } else {
                treasuryBalance[_nodeId] = 0;
                totalTreasuryBalance = (totalTreasuryBalance >= discountBNB) ? (totalTreasuryBalance - discountBNB) : 0;
                valueToSend = totalCostBNB - discountBNB;
                if (discountBNB > 0) {
                    emit TreasuryUsed(_nodeId, discountBNB, 0);
                }
            }
        } else {
            valueToSend = 0;
        }

        require(msg.value >= valueToSend);

        if (msg.value > valueToSend) {
            (bool refundOk, ) = payable(msg.sender).call{value: msg.value - valueToSend}("");
            require(refundOk);
        }

        for (uint i = initialLvl; i < _toTier; i++) {
            uint costI = getTierCost(i);
            if (!isSuper) {
                _executeTierDistribution(_nodeId, i, costI);
            }
            node.tier += 1;
            node.totalContribution += costI;
            uint rankIdx = i < 18 ? i : 17;
            nodes[node.sponsor].sponsorTierRanks[rankIdx] += 1;

            emit TierUnlocked(node.wallet, _nodeId, i + 1);
        }

        emit PoolCheckRequired(_nodeId, block.timestamp);

        _releaseTier18Treasury(_nodeId);

        _autoUpgradeBatch();
    }`;

const newUnlockTier = `    function _applyTreasuryDiscount(uint _nodeId, uint cost) private returns (uint) {
        uint disc = treasuryBalance[_nodeId];
        if (disc >= cost) {
            treasuryBalance[_nodeId] -= cost;
            totalTreasuryBalance = totalTreasuryBalance >= cost ? totalTreasuryBalance - cost : 0;
            emit TreasuryUsed(_nodeId, cost, treasuryBalance[_nodeId]);
            return 0;
        }
        treasuryBalance[_nodeId] = 0;
        totalTreasuryBalance = totalTreasuryBalance >= disc ? totalTreasuryBalance - disc : 0;
        if (disc > 0) emit TreasuryUsed(_nodeId, disc, 0);
        return cost - disc;
    }

    function _unlockTierCore(uint _nodeId, uint _toTier) private {
        bool isSuper = (_nodeId == defaultRefer);
        Node storage node = nodes[_nodeId];
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
            uint rankIdx = i < 18 ? i : 17;
            nodes[node.sponsor].sponsorTierRanks[rankIdx] += 1;
            emit TierUnlocked(node.wallet, _nodeId, i + 1);
        }

        emit PoolCheckRequired(_nodeId, block.timestamp);
        _releaseTier18Treasury(_nodeId);
        _autoUpgradeBatch();
    }

    function unlockTier(uint _nodeId, uint _toTier) external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if (block.timestamp > lastPriceUpdate + 24 hours) _syncOraclePrice();
        _unlockTierCore(_nodeId, _toTier);
    }`;

// ──────────────── patch selfUpgrade ────────────────
const oldSelfUpgrade = `    function selfUpgrade() external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if (block.timestamp > lastPriceUpdate + 24 hours) {
            _syncOraclePrice();
        }

        uint _nodeId = nodeId[msg.sender];
        require(_nodeId != 0);
        
        lastTreasuryActivity[_nodeId] = block.timestamp;
        if (dormancyProposed[_nodeId]) {
            dormancyProposed[_nodeId] = false;
            dormancyProposalTime[_nodeId] = 0;
        }
        
        Node storage node = nodes[_nodeId];
        uint8 currentTier = node.tier;
        require(currentTier < 18);

        uint costBNB = getTierCost(currentTier);
        uint valueToSend = costBNB;
        bool isSuper = (_nodeId == defaultRefer);

        if (!isSuper) {
            uint discountBNB = treasuryBalance[_nodeId];

            if (discountBNB >= costBNB) {
                valueToSend = 0;
                treasuryBalance[_nodeId] -= costBNB;
                totalTreasuryBalance = (totalTreasuryBalance >= costBNB) ? (totalTreasuryBalance - costBNB) : 0;
                emit TreasuryUsed(_nodeId, costBNB, treasuryBalance[_nodeId]);
            } else {
                treasuryBalance[_nodeId] = 0;
                totalTreasuryBalance = (totalTreasuryBalance >= discountBNB) ? (totalTreasuryBalance - discountBNB) : 0;
                valueToSend = costBNB - discountBNB;
                if (discountBNB > 0) {
                    emit TreasuryUsed(_nodeId, discountBNB, 0);
                }
            }
        } else {
            valueToSend = 0;
        }

        require(msg.value >= valueToSend);

        if (msg.value > valueToSend) {
            (bool refundOk, ) = payable(msg.sender).call{value: msg.value - valueToSend}("");
            require(refundOk);
        }

        if (!isSuper) {
            _executeTierDistribution(_nodeId, currentTier, costBNB);
        }

        node.tier += 1;
        node.totalContribution += costBNB;
        uint rankIdx = currentTier < 18 ? currentTier : 17;
        nodes[node.sponsor].sponsorTierRanks[rankIdx] += 1;

        emit TierUnlocked(node.wallet, _nodeId, currentTier + 1);
        emit PoolCheckRequired(_nodeId, block.timestamp);

        if (node.tier >= 18) {
            uint remaining = treasuryBalance[_nodeId];
            if (remaining > 0) {
                treasuryBalance[_nodeId] = 0;
                totalTreasuryBalance = (totalTreasuryBalance >= remaining) ? (totalTreasuryBalance - remaining) : 0;
                _pushReward(node.wallet, remaining);
                emit Tier18TreasuryReleased(_nodeId, remaining);
            }
        }

        _autoUpgradeBatch();
    }`;

const newSelfUpgrade = `    function selfUpgrade() external payable nonReentrant {
        require(!oracleCircuitBreaker);
        if (block.timestamp > lastPriceUpdate + 24 hours) _syncOraclePrice();
        uint _nodeId = nodeId[msg.sender];
        require(_nodeId != 0);
        _unlockTierCore(_nodeId, nodes[_nodeId].tier + 1);
    }`;

// ──────────────── patch _autoUpgradeTier tier-18 block ────────────────
const oldTier18Block = `            if (node.tier >= 18) {
                uint remaining = treasuryBalance[nodeId_];
                if (remaining > 0) {
                    treasuryBalance[nodeId_] = 0;
                    totalTreasuryBalance = (totalTreasuryBalance >= remaining) ? (totalTreasuryBalance - remaining) : 0;
                    _pushReward(node.wallet, remaining);
                    emit Tier18TreasuryReleased(nodeId_, remaining);
                }
            }`;
const newTier18Block = `            _releaseTier18Treasury(nodeId_);`;

// ──────────────── apply to both files ────────────────
const targets = [
  'E:/NFEGLOBAL/hardhat/contracts/nfeglobal.sol',
  'E:/NFEGLOBAL/contracts/nfeglobal.sol',
];

for (const fp of targets) {
  let src = fs.readFileSync(fp, 'utf8');
  
  // Normalize CRLF → LF for matching, will write back as-is
  const hasCRLF = src.includes('\r\n');
  const normalized = hasCRLF ? src.replace(/\r\n/g, '\n') : src;
  
  let result = normalized;
  
  // Normalize oldUnlockTier / oldSelfUpgrade (they were written with \n)
  const norm = s => s.replace(/\r\n/g, '\n');
  
  try { result = apply(result, norm(oldUnlockTier), newUnlockTier); }
  catch(e) { console.error(`${fp}: unlockTier not found - ${e.message}`); process.exit(1); }
  
  try { result = apply(result, norm(oldSelfUpgrade), newSelfUpgrade); }
  catch(e) { console.error(`${fp}: selfUpgrade not found - ${e.message}`); process.exit(1); }
  
  try { result = apply(result, norm(oldTier18Block), newTier18Block); }
  catch(e) { console.error(`${fp}: tier18 block not found - ${e.message}`); process.exit(1); }
  
  // Write back (keep original line endings)
  const final = hasCRLF ? result.replace(/\r?\n/g, '\r\n') : result;
  fs.writeFileSync(fp, final, 'utf8');
  console.log(`✅ Patched ${fp.split('/').pop()} (${final.length} bytes)`);
}
console.log('Done - recompile to check new size.');
