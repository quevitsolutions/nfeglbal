const fs = require("fs");
const path = require("path");

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList);
    } else if (file.endsWith(".json") && !file.endsWith(".dbg.json")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function main() {
  const artifactsDir = path.join(__dirname, "../hardhat/artifacts/contracts");
  if (!fs.existsSync(artifactsDir)) {
    console.error("Artifacts directory not found! Run npx hardhat compile first.");
    return;
  }

  const files = scanDirectory(artifactsDir);
  console.log("==========================================================");
  console.log("             ALL ECOSYSTEM CONTRACT BYTECODE SIZES");
  console.log("==========================================================\n");

  const results = [];

  for (const file of files) {
    try {
      const artifact = JSON.parse(fs.readFileSync(file, "utf8"));
      const name = artifact.contractName;
      const bytecode = artifact.bytecode;
      const deployedBytecode = artifact.deployedBytecode;
      
      if (!bytecode || bytecode === "0x") continue;

      const creationSize = bytecode.length > 2 ? (bytecode.length - 2) / 2 : 0;
      const deployedSize = deployedBytecode.length > 2 ? (deployedBytecode.length - 2) / 2 : 0;
      
      const creationKB = (creationSize / 1024).toFixed(3);
      const deployedKB = (deployedSize / 1024).toFixed(3);
      
      const limitPercentage = ((deployedSize / 24576) * 100).toFixed(1);
      
      results.push({
        name,
        creationSize,
        creationKB,
        deployedSize,
        deployedKB,
        limitPercentage,
        exceeds: deployedSize > 24576
      });
    } catch (err) {
      // Skip files that aren't valid artifacts
    }
  }

  // Sort by size descending
  results.sort((a, b) => b.deployedSize - a.deployedSize);

  for (const r of results) {
    console.log(`Contract: ${r.name}`);
    console.log(`  - Creation Bytecode Size : ${r.creationSize} bytes (${r.creationKB} KB)`);
    console.log(`  - Deployed Bytecode Size : ${r.deployedSize} bytes (${r.deployedKB} KB)`);
    console.log(`  - EVM Size Limit Usage   : ${r.limitPercentage}% of 24.576 KB limit`);
    if (r.exceeds) {
      console.log("  ⚠️ WARNING: Exceeds EVM size limit!");
    } else {
      console.log("  ✅ Within EVM size limit.");
    }
    console.log("----------------------------------------------------------");
  }
}

main().catch(console.error);
