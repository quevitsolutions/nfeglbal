const fs = require("fs");
const path = require("path");

function patchArtifact(targetPath, sourceAbi) {
  if (!fs.existsSync(targetPath)) {
    console.log(`Target artifact not found: ${targetPath}`);
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  const existingAbi = artifact.abi;
  const existingMethods = new Set(
    existingAbi.filter(item => item.type === "function").map(item => item.name)
  );

  let patchedCount = 0;
  for (const item of sourceAbi) {
    if (item.type === "function" && !existingMethods.has(item.name)) {
      existingAbi.push(item);
      patchedCount++;
    }
  }

  fs.writeFileSync(targetPath, JSON.stringify(artifact, null, 2), "utf8");
  console.log(`Successfully patched ${artifact.contractName} at ${path.basename(targetPath)} with ${patchedCount} new functions.`);
}

function main() {
  const infeglobalPath = path.join(__dirname, "../artifacts/contracts/Infeglobal.sol/Infeglobal.json");
  
  if (!fs.existsSync(infeglobalPath)) {
    console.error(`Source Infeglobal artifact not found at ${infeglobalPath}. Ensure you compiled first.`);
    process.exit(1);
  }

  const sourceArtifact = JSON.parse(fs.readFileSync(infeglobalPath, "utf8"));
  const sourceAbi = sourceArtifact.abi;

  const nfeglobalPath = path.join(__dirname, "../artifacts/contracts/nfeglobal.sol/nfeglobal.json");
  const nfeglobalMockPath = path.join(__dirname, "../artifacts/contracts/nfeglobalMock.sol/nfeglobalMock.json");

  patchArtifact(nfeglobalPath, sourceAbi);
  patchArtifact(nfeglobalMockPath, sourceAbi);
}

main();
