const { ethers } = require("hardhat");

async function main() {
  const deployer = "0x3125B4d0d4250132140d91F0800521905A4580fa".toLowerCase();
  const rewardPoolAddress = "0xFe5dc74f5C7285cc8d61461934A9028c01DebC95".toLowerCase();

  console.log("Searching for the RewardPool deployment transaction...");

  const latestBlock = await ethers.provider.getBlockNumber();
  console.log("Latest block:", latestBlock);

  // Search the last 200 blocks
  for (let i = 0; i < 200; i++) {
    const blockNum = latestBlock - i;
    const block = await ethers.provider.getBlock(blockNum, true);
    if (!block || !block.prefetchedTransactions) continue;

    for (const tx of block.prefetchedTransactions) {
      if (tx.from.toLowerCase() === deployer) {
        // Retrieve transaction receipt to check if it created RewardPool
        const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        if (receipt && receipt.contractAddress && receipt.contractAddress.toLowerCase() === rewardPoolAddress) {
          console.log("\n🎯 FOUND REWARDPOOL DEPLOYMENT TX!");
          console.log("Tx Hash:", tx.hash);
          console.log("Block Number:", blockNum);
          console.log("From:", tx.from);
          console.log("Created Contract:", receipt.contractAddress);
          console.log("Tx Input Length:", tx.data.length);
          
          // Print the last 200 characters of the tx data (which should contain constructor arguments)
          const lastChars = tx.data.slice(-200);
          console.log("Trailing tx data (last 200 hex chars):");
          console.log(lastChars);
          return;
        }
      }
    }
  }

  console.log("Could not find the deployment transaction in the last 200 blocks.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
