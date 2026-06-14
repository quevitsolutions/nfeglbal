const { ethers } = require("hardhat");

async function main() {
  const address = "0xA237A82f0623b0214e49CE33ec55132D2f579053";
  const coreAddress = "0x4ea93b8Cd18b66c027AdBaa63CCF06B240dA1dFA";

  const coreAbi = [
    "function nodeId(address wallet) external view returns (uint256)",
    "function nodes(uint256 id) external view returns (address wallet, uint256 parent, uint256 left, uint256 right, uint256 sponsor, uint256 tier, bool active)",
    "function isFreeRegistered(uint256 id) external view returns (bool)",
    "function isNodeActive(uint256 id) external view returns (bool)"
  ];

  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
  const contract = new ethers.Contract(coreAddress, coreAbi, provider);

  console.log("Checking wallet:", address);
  try {
    const balance = await provider.getBalance(address);
    console.log("BNB Balance:", ethers.formatEther(balance));

    const id = await contract.nodeId(address);
    console.log("nodeId returns:", id.toString());

    if (id > 0n) {
      const node = await contract.nodes(id);
      console.log("nodes(id) returns:", {
        wallet: node.wallet,
        parent: node.parent.toString(),
        left: node.left.toString(),
        right: node.right.toString(),
        sponsor: node.sponsor.toString(),
        tier: node.tier.toString(),
        active: node.active
      });

      const freeReg = await contract.isFreeRegistered(id);
      console.log("isFreeRegistered:", freeReg);

      const activeNode = await contract.isNodeActive(id);
      console.log("isNodeActive:", activeNode);
    }
  } catch (err) {
    console.error("Error querying contract:", err);
  }
}

main().catch(console.error);
