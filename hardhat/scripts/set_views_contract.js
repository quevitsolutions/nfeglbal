// scripts/set_views_contract.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Owner/Deployer Wallet:", deployer.address);
  
  const coreAddr = "0x89C394B2f7d35F9e798d881DD05a6Acfa42107D7";
  const viewsAddr = "0x1883cEd2948f7213424ac9D1fd3E50d4aee9E29A";
  
  console.log(`Setting viewsContract on Core to ${viewsAddr}...`);
  const core = await ethers.getContractAt("aipcore", coreAddr);
  
  const tx = await core.setViewsContract(viewsAddr);
  console.log("Transaction hash:", tx.hash);
  
  console.log("Waiting for confirmation...");
  await tx.wait();
  
  console.log("Successfully linked viewsContract!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
