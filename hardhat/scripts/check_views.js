// scripts/check_views.js
const { ethers } = require("hardhat");

async function main() {
  const coreAddr = "0x89C394B2f7d35F9e798d881DD05a6Acfa42107D7";
  const core = await ethers.getContractAt("nfeglobal", coreAddr);
  
  const viewsContract = await core.viewsContract();
  console.log("Current viewsContract on Core:", viewsContract);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
