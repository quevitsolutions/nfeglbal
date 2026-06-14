const { ethers } = require("ethers");
require("dotenv").config({ path: "./hardhat/.env" });

async function main() {
  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
  const gasPrice = await provider.getFeeData();
  console.log("Current gas price on BSC Mainnet:");
  console.log("  Gas Price (Legacy) :", ethers.formatUnits(gasPrice.gasPrice, "gwei"), "gwei");
  console.log("  Max Fee (EIP1559)  :", gasPrice.maxFeePerGas ? ethers.formatUnits(gasPrice.maxFeePerGas, "gwei") : "N/A", "gwei");
  console.log("  Priority Fee       :", gasPrice.maxPriorityFeePerGas ? ethers.formatUnits(gasPrice.maxPriorityFeePerGas, "gwei") : "N/A", "gwei");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (privateKey) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const balance = await wallet.provider.getBalance(wallet.address);
    console.log("Deployer Wallet:", wallet.address);
    console.log("Deployer Balance:", ethers.formatEther(balance), "BNB");
  } else {
    console.log("No private key found in hardhat/.env");
  }
}

main().catch(err => console.error(err));
