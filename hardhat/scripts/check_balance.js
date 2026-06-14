const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  const symbol = hre.network.name === "polygon" ? "POL" : "BNB";
  console.log("Balance:", hre.ethers.formatEther(balance), symbol);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
