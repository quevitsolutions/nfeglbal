// scripts/inspect_old_contracts.js
const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  
  const oldCoreAddr = "0x9daA28D40082E4173b4b07AE76A92Eda0Ff3A522";
  const oldViewAddr = "0x1883cEd2948f7213424ac9D1fd3E50d4aee9E29A";
  
  console.log("Checking Old Core viewsContract...");
  const oldCore = await ethers.getContractAt("aipcore", oldCoreAddr);
  try {
    const oldViewsContract = await oldCore.viewsContract();
    console.log("Old Core viewsContract is set to:", oldViewsContract);
  } catch (err) {
    console.log("Failed to query old core viewsContract:", err.message);
  }
  
  console.log("\nChecking bytecode at oldViewAddr:", oldViewAddr);
  const code = await provider.getCode(oldViewAddr);
  console.log("Bytecode length:", (code.length - 2) / 2, "bytes");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
