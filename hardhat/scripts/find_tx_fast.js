const { ethers } = require("hardhat");

async function main() {
  const deployer = "0x3125B4d0d4250132140d91F0800521905A4580fa".toLowerCase();
  const targetAddress = "0xFe5dc74f5C7285cc8d61461934A9028c01DebC95".toLowerCase();

  console.log("Searching blocks for contract deployment transaction...");
  
  const latestBlock = await ethers.provider.getBlockNumber();
  console.log("Latest block:", latestBlock);
  
  // Scan from block latestBlock down to latestBlock - 1500 in batches of 100
  const startBlock = latestBlock;
  const endBlock = Math.max(0, latestBlock - 1500);
  const batchSize = 100;

  for (let b = startBlock; b > endBlock; b -= batchSize) {
    const currentBatchEnd = Math.max(endBlock, b - batchSize);
    console.log(`Scanning blocks ${b} down to ${currentBatchEnd}...`);
    
    const promises = [];
    for (let i = b; i > currentBatchEnd; i--) {
      promises.push(ethers.provider.getBlock(i, true));
    }
    
    const blocks = await Promise.all(promises);
    for (const block of blocks) {
      if (!block || !block.prefetchedTransactions) continue;
      
      for (const tx of block.prefetchedTransactions) {
        if (tx.from.toLowerCase() === deployer) {
          const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
          if (receipt && receipt.contractAddress && receipt.contractAddress.toLowerCase() === targetAddress) {
            console.log("\n🎯 FOUND DEPLOYMENT TX!");
            console.log("Tx Hash:", tx.hash);
            console.log("Block Number:", block.number);
            console.log("From:", tx.from);
            console.log("Created:", receipt.contractAddress);
            console.log("Tx Input Length:", tx.data.length);
            
            // Print trailing 200 hex characters of tx data
            const lastChars = tx.data.slice(-200);
            console.log("Trailing tx data (last 200 hex chars):");
            console.log(lastChars);
            return;
          }
        }
      }
    }
  }
  
  console.log("Not found in the last 1500 blocks.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
