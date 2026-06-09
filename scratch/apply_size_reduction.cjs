// apply_size_reduction.cjs
// Reduces nfeglobal.sol contract bytecode below the 24,576-byte mainnet limit by:
//   1. Making private vars public (needed by NFEGlobalViews standalone contract)
//   2. Removing 15 view wrapper functions from core (delegates to NFEGlobalViews via fallback)
//   3. Adding viewsContract state var + setViewsContract + fallback() staticcall proxy
//   4. Updating contracts/nfeglobalViews.sol (standalone) with new functions + ICoreForViews additions
//   5. Copying the updated standalone to hardhat/contracts/NFEGlobalViews.sol

const fs = require('fs');

function norm(s) { return s.replace(/\r\n/g, '\n'); }
function denorm(s, wasCRLF) { return wasCRLF ? s.replace(/\r?\n/g, '\r\n') : s; }

function apply(src, from, to, label) {
  const idx = src.indexOf(from);
  if (idx === -1) {
    // Print what we searched for (first 80 chars) to aid debugging
    console.error(`  ❌ Pattern NOT FOUND: "${label}"`);
    console.error(`     First 80 chars: "${from.slice(0, 80).replace(/\n/g,'↵')}"`);
    process.exit(1);
  }
  console.log(`  ✅ ${label}`);
  return src.slice(0, idx) + to + src.slice(idx + from.length);
}

// ═══════════════════════════════════════════════════════════════
// PART 1 — Patch hardhat/contracts/nfeglobal.sol
// ═══════════════════════════════════════════════════════════════
console.log('\n[1/2] Patching hardhat/contracts/nfeglobal.sol...');
const corePath = 'E:/NFEGLOBAL/hardhat/contracts/nfeglobal.sol';
let rawCore = fs.readFileSync(corePath, 'utf8');
const coreHasCRLF = rawCore.includes('\r\n');
let c = norm(rawCore);

// ── 1a. Make private vars public ──────────────────────────────
c = apply(c, '    uint private _nextId; ',
              '    uint public _nextId;\n    address public viewsContract;',
              'Make _nextId public + add viewsContract');

c = apply(c, '    address private feeReceiver;',
              '    address public feeReceiver;',
              'Make feeReceiver public');

c = apply(c, '    address private rewardPool;',
              '    address public rewardPool;',
              'Make rewardPool public');

c = apply(c, '    uint[18] private tierPriceUSD = [',
              '    uint[18] public tierPriceUSD = [',
              'Make tierPriceUSD public');

// ── 1b. Remove getMatrixDirect + getNodeCurDay (keep getNetworkNodes + getTierRewards) ──
c = apply(c,
  '    function getMatrixDirect(uint _nodeId) external view returns(uint[2] memory) {\n' +
  '        return nfeglobalViews.getMatrixDirect(teams, _nodeId);\n' +
  '    }\n' +
  '\n' +
  '    function getNetworkNodes(uint _nodeId, uint _layer, uint _num) external view returns(Node[] memory) {\n' +
  '        return nfeglobalViews.getNetworkNodes(nodes, networkTree, _nodeId, _layer, _num);\n' +
  '    } \n' +
  '\n' +
  '    function getNodeCurDay(uint _nodeId) public view returns(uint) {\n' +
  '        return nfeglobalViews.getNodeCurDay(nodes, _nodeId);\n' +
  '    }',

  '    function getNetworkNodes(uint _nodeId, uint _layer, uint _num) external view returns(Node[] memory) {\n' +
  '        return nfeglobalViews.getNetworkNodes(nodes, networkTree, _nodeId, _layer, _num);\n' +
  '    }',
  'Remove getMatrixDirect + getNodeCurDay'
);

// ── 1c. Remove getTierCosts ────────────────────────────────────
c = apply(c,
  '\n    function getTierCosts() external view returns(uint[18] memory _costs) {\n' +
  '        return nfeglobalViews.getTierCosts(nativeTokenPrice, tierPriceUSD);\n' +
  '    }\n',
  '\n',
  'Remove getTierCosts'
);

// ── 1d. Remove getTeamSize, getUserLevel, canUpgrade, getUpgradeCost ──
c = apply(c,
  '    function getTeamSize(uint _userId, uint _depth) external view returns (uint) {\n' +
  '        return nfeglobalViews.getTeamSize(networkTree, layerDepth, _userId, _depth);\n' +
  '    }\n' +
  '\n' +
  '    function getUserLevel(uint _userId) external view returns (uint) {\n' +
  '        return nfeglobalViews.getUserLevel(nodes, _userId);\n' +
  '    }\n' +
  '\n' +
  '    function canUpgrade(uint _userId, uint _levels) external view returns (bool) {\n' +
  '        return nfeglobalViews.canUpgrade(nodes, _userId, _levels);\n' +
  '    }\n' +
  '\n' +
  '    function getUpgradeCost(uint _fromLevel, uint _levels) external view returns (uint) {\n' +
  '        return nfeglobalViews.getUpgradeCost(_fromLevel, _levels, nativeTokenPrice, tierPriceUSD);\n' +
  '    }',
  '',
  'Remove getTeamSize + getUserLevel + canUpgrade + getUpgradeCost'
);

// ── 1e. Remove getTransparencyData … getSponsorPerformance (8 functions) ──
c = apply(c,
  '    function getTransparencyData() external view returns (\n' +
  '        uint  _totalNodes,\n' +
  '        uint  _totalBNBDistributed,\n' +
  '        uint  _totalTiers,\n' +
  '        address _contractAddress,\n' +
  '        address _ownerAddress,\n' +
  '        bool  _isRenounced\n' +
  '    ) {\n' +
  '        return nfeglobalViews.getTransparencyData(totalNodes, totalBNBDistributed, address(this), owner);\n' +
  '    }\n' +
  '\n' +
  '    function getConfig() external view returns (\n' +
  '        uint _defaultRefer,\n' +
  '        uint _totalNodes,\n' +
  '        uint _maxMatrixDepth,\n' +
  '        uint _bnbPrice,\n' +
  '        uint _lastUpdate,\n' +
  '        address _owner,\n' +
  '        address _oracleAdmin,\n' +
  '        address _matrixAdmin,\n' +
  '        address _feeReceiver,\n' +
  '        address _rewardPool,\n' +
  '        uint _maxAllowedPrice,\n' +
  '        uint _minAllowedPrice\n' +
  '    ) {\n' +
  '        return nfeglobalViews.getConfig(\n' +
  '            defaultRefer,\n' +
  '            totalNodes,\n' +
  '            maxMatrixDepth,\n' +
  '            nativeTokenPrice,\n' +
  '            lastPriceUpdate,\n' +
  '            owner,\n' +
  '            oracleAdmin,\n' +
  '            matrixAdmin,\n' +
  '            feeReceiver,\n' +
  '            rewardPool,\n' +
  '            config.maxAllowedPrice,\n' +
  '            config.minAllowedPrice\n' +
  '        );\n' +
  '    }\n' +
  '\n' +
  '    function getFreeStats() external view returns (\n' +
  '        uint256 totalFree,\n' +
  '        uint256 totalUpgraded,\n' +
  '        uint256 conversionRate\n' +
  '    ) {\n' +
  '        return nfeglobalViews.getFreeStats(totalFreeUsers, totalFreeUpgraded);\n' +
  '    }\n' +
  '\n' +
  '    function getFreeUserList(\n' +
  '        uint256 start,\n' +
  '        uint256 length\n' +
  '    ) external view returns (uint256[] memory freeUsers, uint256 totalFreeCount) {\n' +
  '        return nfeglobalViews.getFreeUserList(isFreeRegistered, _nextId, start, length);\n' +
  '    }\n' +
  '\n' +
  '    function getFreeUserDetails(uint256 _nodeId) external view returns (\n' +
  '        address wallet,\n' +
  '        uint256 sponsor,\n' +
  '        uint256 tier,\n' +
  '        uint256 treasuryBal,\n' +
  '        uint256 joinedAt,\n' +
  '        bool isConverted,\n' +
  '        uint256 totalRewards\n' +
  '    ) {\n' +
  '        return nfeglobalViews.getFreeUserDetails(nodes, treasuryBalance, rewardInfo, isFreeRegistered, _nodeId);\n' +
  '    }\n' +
  '\n' +
  '    function getLevelWiseTeamStats(uint256 _nodeId) external view returns (\n' +
  '        uint256[10] memory freeUsers,\n' +
  '        uint256[10] memory paidUsers,\n' +
  '        uint256[10] memory teamSize,\n' +
  '        uint256[10] memory treasuryGenerated,\n' +
  '        uint256[10] memory treasuryUsed,\n' +
  '        uint256[10] memory conversions,\n' +
  '        uint256[10] memory rewardsDistributed\n' +
  '    ) {\n' +
  '        return nfeglobalViews.getLevelWiseTeamStats(\n' +
  '            levelFreeCount,\n' +
  '            levelPaidCount,\n' +
  '            levelTreasuryGenerated,\n' +
  '            levelTreasuryUsed,\n' +
  '            levelRewardsDistributed,\n' +
  '            _nodeId\n' +
  '        );\n' +
  '    }\n' +
  '\n' +
  '    function getTeamRevenueStats(uint256 _nodeId) external view returns (\n' +
  '        uint256 teamTreasuryGenerated,\n' +
  '        uint256 teamTreasuryUsed,\n' +
  '        uint256 remainingTreasury,\n' +
  '        uint256 totalUpgrades,\n' +
  '        uint256 teamRewardsDistributed\n' +
  '    ) {\n' +
  '        return nfeglobalViews.getTeamRevenueStats(\n' +
  '            levelTreasuryGenerated,\n' +
  '            levelTreasuryUsed,\n' +
  '            levelRewardsDistributed,\n' +
  '            teamTotalUpgrades,\n' +
  '            _nodeId\n' +
  '        );\n' +
  '    }\n' +
  '\n' +
  '    function getSponsorPerformance(uint256 _nodeId) external view returns (\n' +
  '        uint256 freeUsers,\n' +
  '        uint256 convertedUsers,\n' +
  '        uint256 conversionRate,\n' +
  '        uint256 teamGrowth\n' +
  '    ) {\n' +
  '        return nfeglobalViews.getSponsorPerformance(\n' +
  '            levelFreeCount,\n' +
  '            levelPaidCount,\n' +
  '            _nodeId\n' +
  '        );\n' +
  '    }',
  '',
  'Remove getTransparencyData…getSponsorPerformance (8 functions)'
);

// ── 1f. Add setViewsContract + fallback() before contract closing brace ──
c = apply(c,
  '\n    function skimDust() external nonReentrant {\n' +
  '        uint bal = address(this).balance;\n' +
  '        uint reserved = totalTreasuryBalance + daoTreasury + totalPendingRewards;\n' +
  '        if (bal > reserved) {\n' +
  '            address target = rewardPool == address(0) ? feeReceiver : rewardPool;\n' +
  '            (bool ok, ) = payable(target).call{value: bal - reserved}("");\n' +
  '            require(ok);\n' +
  '            emit DustSkimmed(bal - reserved, target);\n' +
  '        }\n' +
  '    }\n' +
  '}',

  '\n    function skimDust() external nonReentrant {\n' +
  '        uint bal = address(this).balance;\n' +
  '        uint reserved = totalTreasuryBalance + daoTreasury + totalPendingRewards;\n' +
  '        if (bal > reserved) {\n' +
  '            address target = rewardPool == address(0) ? feeReceiver : rewardPool;\n' +
  '            (bool ok, ) = payable(target).call{value: bal - reserved}("");\n' +
  '            require(ok);\n' +
  '            emit DustSkimmed(bal - reserved, target);\n' +
  '        }\n' +
  '    }\n' +
  '\n' +
  '    function setViewsContract(address _v) external onlyOwner {\n' +
  '        viewsContract = _v;\n' +
  '    }\n' +
  '\n' +
  '    fallback() external payable {\n' +
  '        address target = viewsContract;\n' +
  '        require(target != address(0));\n' +
  '        assembly {\n' +
  '            calldatacopy(0, 0, calldatasize())\n' +
  '            let result := staticcall(gas(), target, 0, calldatasize(), 0, 0)\n' +
  '            returndatacopy(0, 0, returndatasize())\n' +
  '            switch result\n' +
  '            case 0 { revert(0, returndatasize()) }\n' +
  '            default { return(0, returndatasize()) }\n' +
  '        }\n' +
  '    }\n' +
  '}',
  'Add setViewsContract + fallback() proxy'
);

// Write core
const coreOut = denorm(c, coreHasCRLF);
fs.writeFileSync(corePath, coreOut, 'utf8');
console.log(`\n  📄 Wrote ${corePath} (${coreOut.length} bytes source)`);

// ═══════════════════════════════════════════════════════════════
// PART 2 — Patch contracts/nfeglobalViews.sol (standalone)
// ═══════════════════════════════════════════════════════════════
console.log('\n[2/2] Patching contracts/nfeglobalViews.sol...');
const viewsPath = 'E:/NFEGLOBAL/contracts/nfeglobalViews.sol';
let rawViews = fs.readFileSync(viewsPath, 'utf8');
const viewsHasCRLF = rawViews.includes('\r\n');
let v = norm(rawViews);

// ── 2a. Expand ICoreForViews with missing getters ────────────
v = apply(v,
  '    function teams(uint, uint, uint) external view returns (uint);\n' +
  '    function tierPriceUSD(uint) external view returns (uint);\n' +
  '}',

  '    function teams(uint, uint, uint) external view returns (uint);\n' +
  '    function tierPriceUSD(uint) external view returns (uint);\n' +
  '    function maxMatrixDepth() external view returns (uint);\n' +
  '    function totalBNBDistributed() external view returns (uint);\n' +
  '}',
  'Add maxMatrixDepth + totalBNBDistributed to ICoreForViews'
);

// ── 2b. Fix getConfig: use core.maxMatrixDepth() instead of hardcoded 17 ──
v = apply(v,
  '        _maxMatrixDepth = 17;',
  '        _maxMatrixDepth = core.maxMatrixDepth();',
  'Fix getConfig _maxMatrixDepth to read from core'
);

// ── 2c. Remove broken getTierRewards (core handles it directly with library) ──
if (v.includes('    function getTierRewards(uint _nodeId) external view returns(uint[18] memory tr) {')) {
  v = apply(v,
    '\n    function getTierRewards(uint _nodeId) external view returns(uint[18] memory tr) {\n' +
    '        ICoreForViews core = ICoreForViews(msg.sender);\n' +
    '        (,,,,,tr) = core.rewardInfo(_nodeId);\n' +
    '    }\n',
    '\n',
    'Remove broken getTierRewards from NFEGlobalViews'
  );
} else {
  console.log('  ℹ️  getTierRewards not found in NFEGlobalViews (already removed or different signature)');
}

// ── 2d. Add new view functions before closing brace ─────────
const newFunctions = `
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
`;

// Insert before last closing brace
const lastBrace = v.lastIndexOf('\n}');
if (lastBrace === -1) { console.error('Cannot find closing brace in NFEGlobalViews'); process.exit(1); }
v = v.slice(0, lastBrace) + newFunctions + '\n}';
console.log('  ✅ Added getUserLevel, canUpgrade, getUpgradeCost, getTeamSize, getTransparencyData');

// Write standalone NFEGlobalViews
const viewsOut = denorm(v, viewsHasCRLF);
fs.writeFileSync(viewsPath, viewsOut, 'utf8');
console.log(`  📄 Wrote ${viewsPath} (${viewsOut.length} bytes source)`);

// ── 2e. Copy to hardhat/contracts/NFEGlobalViews.sol ────────
const hardhatViewsPath = 'E:/NFEGLOBAL/hardhat/contracts/NFEGlobalViews.sol';
// NFEGlobalViews is a standalone contract (not a library), no imports needed
fs.writeFileSync(hardhatViewsPath, viewsOut, 'utf8');
console.log(`  📄 Copied to ${hardhatViewsPath}`);

console.log('\n✅ All patches applied. Run: cd hardhat && npx hardhat compile\n');
