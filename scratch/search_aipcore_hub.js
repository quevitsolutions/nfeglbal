import fs from 'fs';
import path from 'path';

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      searchDir(filePath, query);
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.jsx'))) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        console.log(`Found in: ${filePath}`);
      }
    }
  }
}

try {
  console.log("Searching for VESTING in e:/aipcore hub/src:");
  searchDir("e:/aipcore hub/src", "vesting");
  console.log("\nSearching for GOVERNANCE in e:/aipcore hub/src:");
  searchDir("e:/aipcore hub/src", "gov");
} catch (e) {
  console.error(e);
}
