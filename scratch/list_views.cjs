const fs = require('fs');
const content = fs.readFileSync('hardhat/contracts/nfeglobalViews.sol', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('function ') && !line.includes('//')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
