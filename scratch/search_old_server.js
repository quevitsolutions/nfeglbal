import fs from 'fs';

const content = fs.readFileSync('e:/aipcore hub/server/index.js', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('0xb6cbd') || line.toLowerCase().includes('aipcore_address') || line.toLowerCase().includes('rewardpool_address')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
