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
  const iaipcorePath = path.join(__dirname, "../artifacts/contracts/Iaipcore.sol/Iaipcore.json");
  
  if (!fs.existsSync(iaipcorePath)) {
    console.error(`Source Iaipcore artifact not found at ${iaipcorePath}. Ensure you compiled first.`);
    process.exit(1);
  }

  const sourceArtifact = JSON.parse(fs.readFileSync(iaipcorePath, "utf8"));
  const sourceAbi = sourceArtifact.abi;

  const aipcorePath = path.join(__dirname, "../artifacts/contracts/aipcore.sol/aipcore.json");
  const aipcoreMockPath = path.join(__dirname, "../artifacts/contracts/aipcoreMock.sol/aipcoreMock.json");

  patchArtifact(aipcorePath, sourceAbi);
  patchArtifact(aipcoreMockPath, sourceAbi);
}

main();
