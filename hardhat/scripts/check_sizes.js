const hre = require("hardhat");

async function main() {
  const contracts = [
    { name: "nfeglobal", file: "nfeglobal.sol/nfeglobal.json" },
    { name: "NFEGlobalViewsContract", file: "nfeglobalViews.sol/NFEGlobalViewsContract.json" },
    { name: "nfeglobalViews (Library)", file: "nfeglobalViews.sol/nfeglobalViews.json" },
    { name: "RewardPool", file: "RewardPool.sol/RewardPool.json" },
    { name: "BNBPriceOracle", file: "BNBPriceOracle.sol/BNBPriceOracle.json" }
  ];

  console.log("==========================================================");
  console.log("             SMART CONTRACT BYTECODE SIZES");
  console.log("==========================================================\n");

  for (const c of contracts) {
    try {
      const artifact = require(`../artifacts/contracts/${c.file}`);
      const bytecode = artifact.bytecode;
      const deployedBytecode = artifact.deployedBytecode;
      
      const creationSize = bytecode.length > 2 ? (bytecode.length - 2) / 2 : 0;
      const deployedSize = deployedBytecode.length > 2 ? (deployedBytecode.length - 2) / 2 : 0;
      
      const creationKB = (creationSize / 1024).toFixed(3);
      const deployedKB = (deployedSize / 1024).toFixed(3);
      
      const limitPercentage = ((deployedSize / 24576) * 100).toFixed(1);
      
      console.log(`Contract: ${c.name}`);
      console.log(`  - Creation Bytecode Size : ${creationSize} bytes (${creationKB} KB)`);
      console.log(`  - Deployed Bytecode Size : ${deployedSize} bytes (${deployedKB} KB)`);
      console.log(`  - EVM Size Limit Usage   : ${limitPercentage}% of 24.576 KB limit`);
      
      if (deployedSize > 24576) {
        console.log("  ⚠️ WARNING: Contract exceeds EVM size limit!");
      } else {
        console.log("  ✅ Within EVM size limit.");
      }
      console.log("----------------------------------------------------------");
    } catch (err) {
      console.log(`Could not load size for ${c.name}: ${err.message}`);
      console.log("----------------------------------------------------------");
    }
  }
}

main().catch(console.error);
