const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x89C394B2f7d35F9e798d881DD05a6Acfa42107D7";
  const userAddress = ethers.getAddress("0xA237A82f0623b0214e49CE33ec55132D2f579053");
  
  const Core = await ethers.getContractAt("aipcore", contractAddress);
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
