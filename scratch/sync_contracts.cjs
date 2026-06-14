const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'hardhat', 'contracts');
const destDir = path.join(__dirname, '..', 'contracts');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy all .sol files from srcDir to destDir
const files = fs.readdirSync(srcDir);
for (const file of files) {
  if (file.endsWith('.sol')) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    fs.copyFileSync(srcFile, destFile);
    console.log(`Copied ${file} to root contracts/`);
  }
}

// Update server/contracts_context.txt
try {
  const core = fs.readFileSync(path.join(destDir, 'nfeglobal.sol'), 'utf8');
  const pool = fs.readFileSync(path.join(destDir, 'RewardPool.sol'), 'utf8');
  const vault = fs.readFileSync(path.join(destDir, 'IncomeVaultHelper.sol'), 'utf8');
  const fp = fs.existsSync(path.join(destDir, 'FounderPool.sol')) ? fs.readFileSync(path.join(destDir, 'FounderPool.sol'), 'utf8') : '';
  const lp = fs.existsSync(path.join(destDir, 'LeaderboardPool.sol')) ? fs.readFileSync(path.join(destDir, 'LeaderboardPool.sol'), 'utf8') : '';

  fs.writeFileSync(
    path.join(__dirname, '..', 'server', 'contracts_context.txt'),
    `\n\n// ----- nfeglobal.sol -----\n${core}\n\n// ----- RewardPool.sol -----\n${pool}\n\n// ----- IncomeVaultHelper.sol -----\n${vault}\n\n// ----- FounderPool.sol -----\n${fp}\n\n// ----- LeaderboardPool.sol -----\n${lp}`
  );
  console.log('Updated server/contracts_context.txt successfully');
} catch (err) {
  console.error('Failed to update server context:', err.message);
}
