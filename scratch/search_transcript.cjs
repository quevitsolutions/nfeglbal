const fs = require('fs');
const readline = require('readline');

async function run() {
  const fileStream = fs.createReadStream('C:\\Users\\user\\.gemini\\antigravity\\brain\\716fb180-0cf6-4af3-80ea-ae5ce7a1d9ed\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('"source":"USER_EXPLICIT"') || line.includes('wei') || line.includes('0.1')) {
      try {
        const obj = JSON.parse(line);
        if (obj.source === 'USER_EXPLICIT') {
          console.log(`[USER_EXPLICIT] Step ${obj.step_index}: ${obj.content}`);
        }
      } catch (e) {}
    }
  }
}
run();
