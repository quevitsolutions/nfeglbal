const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x8f21F8458D19743932540a2E62FFd20AEc89cb72";
  const Core = await ethers.getContractAt("nfeglobal", contractAddress);
  
  const latestBlock = await ethers.provider.getBlockNumber();
  const startBlock = latestBlock - 5000;
  console.log(`Latest block: ${latestBlock}, scanning from block ${startBlock}...`);

  // Query NodeCreated events
  const filter = Core.filters.NodeCreated();
  const events = await Core.queryFilter(filter, startBlock, "latest");
  console.log(`Total NodeCreated events in last 5000 blocks: ${events.length}`);
  events.forEach((e) => {
    console.log(`- Wallet: ${e.args[0]}, Node ID: ${e.args[1].toString()}, Sponsor: ${e.args[2].toString()}`);
  });
}

main().catch(console.error);
