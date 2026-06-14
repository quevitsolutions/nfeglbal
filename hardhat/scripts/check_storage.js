// scripts/check_storage.js
const { ethers } = require("hardhat");

async function main() {
  const oldViewAddr = "0x1883cEd2948f7213424ac9D1fd3E50d4aee9E29A";
  
  console.log("Reading storage slots of views contract...");
  for (let slot = 0; slot < 5; slot++) {
    const value = await ethers.provider.getStorage(oldViewAddr, slot);
    console.log(`Slot ${slot}: ${value}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
