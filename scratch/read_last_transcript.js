const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function run() {
  const transcriptPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\fe92a627-c649-45fd-93f2-9908fe8701f4\\.system_generated\\logs\\transcript.jsonl';
  if (!fs.existsSync(transcriptPath)) {
    console.log("File does not exist:", transcriptPath);
    return;
  }
  
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'USER_INPUT') {
        console.log(`\n=== USER INPUT (Step \${data.step_index}) ===`);
        console.log(data.content);
      } else if (data.type === 'PLANNER_RESPONSE' && data.content) {
        console.log(`\n--- ASSISTANT (Step \${data.step_index}) ---`);
        console.log(data.content.substring(0, 500) + (data.content.length > 500 ? '...' : ''));
      }
    } catch (err) {
      // Ignored
    }
  }
}
run();
