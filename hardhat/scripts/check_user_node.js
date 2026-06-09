const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x8f21F8458D19743932540a2E62FFd20AEc89cb72";
  const userAddress = ethers.getAddress("0xf220dc8e6cddb7cddcb628043c969d4f09ded25e"); // from logs (lowercased)
  
  const Core = await ethers.getContractAt("nfeglobal", contractAddress);
  const nodeId = await Core.nodeId(userAddress);
  console.log(`User Address: ${userAddress}`);
  console.log(`Node ID:      ${nodeId.toString()}`);
  if (nodeId > 0n) {
    const node = await Core.nodes(nodeId);
    console.log("Node Info:");
    console.log(`- Wallet:      ${node.wallet}`);
    console.log(`- Sponsor:     ${node.sponsor.toString()}`);
    console.log(`- Tier:        ${node.tier.toString()}`);
    console.log(`- Active:      ${node.active.toString()}`);
  }
}

main().catch(console.error);
