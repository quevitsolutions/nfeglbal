// scripts/scan_old_core.js
const { ethers } = require("hardhat");

async function main() {
  const oldCoreAddr = "0x9daA28D40082E4173b4b07AE76A92Eda0Ff3A522";
  const oldViewAddr = "0x1883cEd2948f7213424ac9D1fd3E50d4aee9E29A";
  
  const target = oldViewAddr.toLowerCase();
  
  console.log("Scanning first 150 storage slots of old core for views address...");
  for (let slot = 0; slot < 150; slot++) {
    const value = await ethers.provider.getStorage(oldCoreAddr, slot);
    if (value.toLowerCase().includes(target.slice(2))) {
      console.log(`FOUND views address in Slot ${slot}: ${value}`);
      return;
    }
  }
  console.log("NOT FOUND in first 150 slots.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
