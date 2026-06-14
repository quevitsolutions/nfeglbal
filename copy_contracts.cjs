const fs = require('fs');
const core = fs.readFileSync('contracts/nfeglobal.sol', 'utf8');
const pool = fs.readFileSync('contracts/RewardPool.sol', 'utf8');
const vault = fs.readFileSync('contracts/IncomeVaultHelper.sol', 'utf8');
fs.writeFileSync('server/contracts_context.txt', `\n\n// ----- nfeglobal.sol -----\n${core}\n\n// ----- RewardPool.sol -----\n${pool}\n\n// ----- IncomeVaultHelper.sol -----\n${vault}`);
console.log('Done');
