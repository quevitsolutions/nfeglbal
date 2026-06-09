// Final size-reduction pass:
// 1. Add missedRewardsByTier to nfeglobalViews library (moves the loop bytecode out of nfeglobal)
// 2. Delegate missedRewardsByTier in nfeglobal.sol to library
// 3. Remove scheduleRescueBNB + rescueBNB (exact aliases of scheduleRescueNative/rescueNative)
// Expected: ~350 bytes saved → contract drops under 24,576 byte mainnet limit

const fs = require('fs');

function apply(src, from, to, label) {
  const idx = src.indexOf(from);
  if (idx === -1) throw new Error(`Pattern "${label}" not found`);
  return src.slice(0, idx) + to + src.slice(idx + from.length);
}

// ─── 1. Patch nfeglobalViews.sol ─── add missedRewardsByTier before closing brace
const viewsFiles = [
  'E:/NFEGLOBAL/hardhat/contracts/nfeglobalViews.sol',
  'E:/NFEGLOBAL/contracts/nfeglobalViews.sol',
];

const missedRewardsFn = `
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

`;

for (const fp of viewsFiles) {
  let src = fs.readFileSync(fp, 'utf8');
  const hasCRLF = src.includes('\r\n');
  let normalized = hasCRLF ? src.replace(/\r\n/g, '\n') : src;
  // Insert before closing brace of library
  normalized = apply(normalized, '\n}\n', missedRewardsFn + '\n}\n', 'library closing brace');
  const final = hasCRLF ? normalized.replace(/\r?\n/g, '\r\n') : normalized;
  fs.writeFileSync(fp, final, 'utf8');
  console.log(`✅ nfeglobalViews patched: ${fp.split('/').pop()}`);
}

// ─── 2. Patch nfeglobal.sol ───
const coreFiles = [
  'E:/NFEGLOBAL/hardhat/contracts/nfeglobal.sol',
  'E:/NFEGLOBAL/contracts/nfeglobal.sol',
];

// OLD: missedRewardsByTier with inline loop
const oldMissedFn = `    function missedRewardsByTier(uint _nodeId, uint _tier) public view returns (uint) {
        uint total = 0;
        uint len = rewardHistory[_nodeId].length;
        for (uint i = 0; i < len; i++) {
            RewardEvent memory ev = rewardHistory[_nodeId][i];
            if (ev.isMissed && ev.tier == _tier) {
                total += ev.amount;
            }
        }
        return total;
    }`;

// NEW: thin delegate to library
const newMissedFn = `    function missedRewardsByTier(uint _nodeId, uint _tier) public view returns (uint) {
        return nfeglobalViews.missedRewardsByTier(rewardHistory, _nodeId, _tier);
    }`;

// Remove scheduleRescueBNB (exact alias of scheduleRescueNative)
const oldScheduleBNB = `    function scheduleRescueBNB() external onlyOwner {
        _scheduleRescueNativeInternal();
    }

`;

// Remove rescueBNB (exact alias of rescueNative)
const oldRescueBNB = `    function rescueBNB(uint _amount) external onlyOwner {
        _rescueNativeInternal(_amount);
    }

`;

for (const fp of coreFiles) {
  let src = fs.readFileSync(fp, 'utf8');
  const hasCRLF = src.includes('\r\n');
  let normalized = hasCRLF ? src.replace(/\r\n/g, '\n') : src;

  normalized = apply(normalized, oldMissedFn, newMissedFn, 'missedRewardsByTier');

  // Remove BNB alias functions (with or without trailing blank line)
  if (normalized.includes(oldScheduleBNB)) {
    normalized = apply(normalized, oldScheduleBNB, '', 'scheduleRescueBNB');
    console.log(`  removed scheduleRescueBNB`);
  } else {
    console.warn(`  WARNING: scheduleRescueBNB not found in ${fp}`);
  }

  if (normalized.includes(oldRescueBNB)) {
    normalized = apply(normalized, oldRescueBNB, '', 'rescueBNB');
    console.log(`  removed rescueBNB`);
  } else {
    console.warn(`  WARNING: rescueBNB not found in ${fp}`);
  }

  const final = hasCRLF ? normalized.replace(/\r?\n/g, '\r\n') : normalized;
  fs.writeFileSync(fp, final, 'utf8');
  console.log(`✅ nfeglobal patched: ${fp.split('/').pop()} (${final.length} bytes)`);
}

console.log('\nDone — recompile to verify size.');
