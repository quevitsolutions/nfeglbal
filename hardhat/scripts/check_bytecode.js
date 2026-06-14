// scripts/check_bytecode.js
const { ethers } = require("hardhat");

async function main() {
  const oldViewAddr = "0x1883cEd2948f7213424ac9D1fd3E50d4aee9E29A";
  const oldCoreAddr = "0x9daA28D40082E4173b4b07AE76A92Eda0Ff3A522";
  
  const code = await ethers.provider.getCode(oldViewAddr);
  
  const targetHex = oldCoreAddr.slice(2).toLowerCase();
  const index = code.toLowerCase().indexOf(targetHex);
  
  if (index !== -1) {
    console.log(`FOUND old Core address hardcoded in views contract bytecode at character index ${index}!`);
  } else {
    console.log("NOT FOUND: Old Core address is not hardcoded in the bytecode.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
