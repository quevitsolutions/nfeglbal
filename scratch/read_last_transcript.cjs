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

  const lines = [];
  for await (const line of rl) {
    lines.push(line);
  }

  // Print the last 15 steps
  const lastLines = lines.slice(-15);
  for (const line of lastLines) {
    try {
      const data = JSON.parse(line);
      console.log(`\n==================================================`);
      console.log(`STEP ${data.step_index} | SOURCE: ${data.source} | TYPE: ${data.type}`);
      console.log(`==================================================`);
      if (data.content) {
        console.log(data.content);
      }
      if (data.tool_calls) {
        console.log("Tool Calls:", JSON.stringify(data.tool_calls, null, 2));
      }
    } catch (err) {
      // Ignored
    }
  }
}
run();
