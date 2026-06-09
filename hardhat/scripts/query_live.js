const hre = require("hardhat");

async function main() {
  console.log("Checking live contract storage slots...");

  const coreAddr = "0xaECA2Bb1b42DeA8F937c51f41A512C59dDd46a2d";
  
  for (let i = 0; i < 10; i++) {
    const data = await hre.ethers.provider.getStorage(coreAddr, i);
    console.log(`Slot ${i}: ${data}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
