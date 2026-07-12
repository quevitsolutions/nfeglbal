const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x8f21F8458D19743932540a2E62FFd20AEc89cb72";
  const Core = await ethers.getContractAt("aipcore", contractAddress);
  
  const totalNodes = await Core.totalNodes();
  const owner = await Core.owner();
  const bnbPrice = await Core.bnbPrice();
  console.log(`Contract:    ${contractAddress}`);
  console.log(`Owner:       ${owner}`);
  console.log(`Total Nodes: ${totalNodes.toString()}`);
  console.log(`BNB Price:   $${(Number(bnbPrice) / 1e8).toString()}`);
}

main().catch(console.error);
