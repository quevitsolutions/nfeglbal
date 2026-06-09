const fs = require('fs');
const readline = require('readline');

async function run() {
  const fileStream = fs.createReadStream('C:\\Users\\user\\.gemini\\antigravity\\brain\\716fb180-0cf6-4af3-80ea-ae5ce7a1d9ed\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    if (line.includes('"source":"USER_EXPLICIT"') || line.includes('"USER"')) {
      console.log(`Line: ${line.substring(0, 300)}...`);
    }
  }
}
run();
