// scripts/verify_reward_pool.js
const { ethers } = require("hardhat");

async function main() {
  const coreAddr = "0x89C394B2f7d35F9e798d881DD05a6Acfa42107D7";
  const core = await ethers.getContractAt("nfeglobal", coreAddr);
  
  const rewardPool = await core.rewardPool();
  console.log("Current rewardPool set in Core:", rewardPool);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
