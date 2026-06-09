const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const txHash = "0x19e46b0f6111ae85391616ce86b9e07be53577a62d292a791847714fe45ef527";
  console.log("Fetching transaction input for:", txHash);

  const tx = await ethers.provider.getTransaction(txHash);
  if (!tx) {
    console.error("Transaction not found!");
    return;
  }
  const onChainInput = tx.data;
  console.log("On-chain input length (hex chars):", onChainInput.length);

  // Load the compiled artifact
  const artifactPath = path.join(__dirname, "../artifacts/contracts/RewardPool.sol/RewardPool.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found! Run compile first.");
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const localCreationBytecode = artifact.bytecode;
  console.log("Locally compiled creation bytecode length (hex chars):", localCreationBytecode.length);

  // Encode constructor arguments
  const engine = "0xbd076cC53AbaeC543EF6caC34050cf8290D3D1C5";
  const owner = "0x3125B4d0d4250132140d91F0800521905A4580fa";
  const genesisNodeId = 55555;

  const encoder = new ethers.AbiCoder();
  const encodedArgs = encoder.encode(
    ["address", "address", "uint256"],
    [engine, owner, genesisNodeId]
  ).slice(2); // remove 0x

  console.log("Encoded arguments length (hex chars):", encodedArgs.length);
  console.log("Encoded arguments:", encodedArgs);

  const expectedInput = localCreationBytecode + encodedArgs;
  console.log("Expected input length (hex chars):", expectedInput.length);

  if (onChainInput === expectedInput) {
    console.log("✅ Expected input and on-chain input match 100% perfectly!");
  } else {
    console.log("⚠️ Input mismatch!");
    if (onChainInput.length !== expectedInput.length) {
      console.log(`Lengths differ! On-chain: ${onChainInput.length}, Expected: ${expectedInput.length}`);
    }
    
    // Find where the mismatch starts
    let firstMismatch = -1;
    const minLength = Math.min(onChainInput.length, expectedInput.length);
    for (let i = 0; i < minLength; i++) {
      if (onChainInput[i] !== expectedInput[i]) {
        firstMismatch = i;
        break;
      }
    }
    if (firstMismatch !== -1) {
      console.log(`First mismatch at hex char index ${firstMismatch}`);
      console.log("On-chain surrounding:", onChainInput.slice(Math.max(0, firstMismatch - 20), firstMismatch + 40));
      console.log("Expected surrounding:", expectedInput.slice(Math.max(0, firstMismatch - 20), firstMismatch + 40));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
