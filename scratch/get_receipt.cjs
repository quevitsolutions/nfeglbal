const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
  const txHash = "0x6d34c08ae51b21073969724e11c21c737ed17276148465641f88aa10bd55b143";
  const receipt = await provider.getTransactionReceipt(txHash);
  console.log("Transaction Receipt:");
  console.log("  Status         :", receipt.status);
  console.log("  Gas Used       :", receipt.gasUsed.toString());
  console.log("  Gas Price      :", receipt.gasPrice.toString());
  console.log("  To             :", receipt.to);
  console.log("  Contract Addr  :", receipt.contractAddress);
  console.log("  Cumulative Gas :", receipt.cumulativeGasUsed.toString());
}

main().catch(console.error);
