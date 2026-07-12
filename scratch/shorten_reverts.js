const fs = require('fs');
const path = require('path');

function shortenRevertsInFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    let output = '';
    let i = 0;
    let count = 0;
    
    while (i < content.length) {
        if (content.substring(i, i + 8) === 'require(') {
            let start = i;
            let parenCount = 1;
            let j = i + 8;
            let inString = false;
            let stringChar = '';
            
            while (j < content.length && parenCount > 0) {
                let char = content[j];
                if (inString) {
                    if (char === '\\') {
                        j += 2;
                        continue;
                    } else if (char === stringChar) {
                        inString = false;
                    }
                } else {
                    if (char === '"' || char === "'") {
                        inString = true;
                        stringChar = char;
                    } else if (char === '(') {
                        parenCount++;
                    } else if (char === ')') {
                        parenCount--;
                    }
                }
                j++;
            }
            
            let requireStr = content.substring(start, j);
            let match = requireStr.match(/,\s*(["'])(.*)(["'])\s*\)$/s);
            
            if (match) {
                let quote = match[1];
                let origMsg = match[2];
                // Shorten to first 3 characters, or empty string if it's already short
                let shortenedMsg = origMsg.length > 3 ? origMsg.substring(0, 3) : origMsg;
                let replacement = `, ${quote}${shortenedMsg}${quote})`;
                requireStr = requireStr.replace(/,\s*(["'])(.*)(["'])\s*\)$/s, replacement);
                count++;
            }
            
            output += requireStr;
            i = j;
        } else {
            output += content[i];
            i++;
        }
    }
    
    fs.writeFileSync(filePath, output, 'utf8');
    console.log(`✅ Successfully shortened ${count} require strings in ${filePath}`);
}

const rootPath = path.join(__dirname, '..');
shortenRevertsInFile(path.join(rootPath, 'contracts/aipcore.sol'));
shortenRevertsInFile(path.join(rootPath, 'hardhat/contracts/aipcore.sol'));
