import fs from 'fs';

const content = fs.readFileSync('e:/aipcore hub/server/index.js', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('vesting')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
