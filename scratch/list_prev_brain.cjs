const fs = require('fs');

const path = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\fe92a627-c649-45fd-93f2-9908fe8701f4';
if (fs.existsSync(path)) {
  console.log(fs.readdirSync(path));
} else {
  console.log("Directory does not exist at:", path);
}
