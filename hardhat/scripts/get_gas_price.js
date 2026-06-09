const hre = require("hardhat");

async function main() {
  const feeData = await hre.ethers.provider.getFeeData();
  console.log("Gas Price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
