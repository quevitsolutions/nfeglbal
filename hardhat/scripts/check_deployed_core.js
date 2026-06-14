const hre = require("hardhat");

async function main() {
  const coreAddress = "0x89C394B2f7d35F9e798d881DD05a6Acfa42107D7";
  const code = await hre.ethers.provider.getCode(coreAddress);
  console.log("Deployed Code Length (hex):", code.length);
  console.log("Deployed Size (bytes):", (code.length - 2) / 2);
  console.log("Deployed Size (KB):", ((code.length - 2) / 2 / 1024).toFixed(3));
}

main().catch(console.error);
