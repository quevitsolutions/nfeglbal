const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const address = "0x9f64054Ea5F8fD7A5626Aa20F4Ac1b82B3c33346";
  console.log("Fetching deployed bytecode for:", address);

  const deployedBytecode = await hre.ethers.provider.getCode(address);
  console.log("Deployed bytecode length (hex):", deployedBytecode.length);
  if (deployedBytecode === "0x") {
    console.error("No code found at address! Are you sure you are on bscTestnet?");
    return;
  }

  // Load the compiled artifact
  const artifactPath = path.join(__dirname, "../artifacts/contracts/RewardPool.sol/RewardPool.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found! Run compile first.");
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const localDeployedBytecode = artifact.deployedBytecode;
  console.log("Locally compiled bytecode length (hex):", localDeployedBytecode.length);

  // Compare lengths
  if (deployedBytecode.length !== localDeployedBytecode.length) {
    console.log("⚠️ Lengths differ!");
  } else {
    console.log("✅ Lengths match perfectly!");
  }

  // Find mismatching bytes (ignoring the last 100 bytes of metadata if possible)
  let mismatches = 0;
  const minLength = Math.min(deployedBytecode.length, localDeployedBytecode.length);
  for (let i = 0; i < minLength; i++) {
    if (deployedBytecode[i] !== localDeployedBytecode[i]) {
      mismatches++;
      if (mismatches <= 10) {
        console.log(`Mismatch at index ${i}: Deployed: ${deployedBytecode[i]}, Local: ${localDeployedBytecode[i]}`);
      }
    }
  }

  console.log(`Total mismatches out of ${minLength} characters: ${mismatches}`);

  // Save deployed bytecode for references
  fs.writeFileSync(path.join(__dirname, "../deployed_bytecode.hex"), deployedBytecode);
  console.log("Saved deployed bytecode to deployed_bytecode.hex");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
