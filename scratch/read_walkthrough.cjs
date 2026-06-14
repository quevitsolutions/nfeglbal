const fs = require('fs');

const path = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\fe92a627-c649-45fd-93f2-9908fe8701f4\\walkthrough.md';
if (fs.existsSync(path)) {
  console.log(fs.readFileSync(path, 'utf8'));
} else {
  console.log("Walkthrough file does not exist at:", path);
}
