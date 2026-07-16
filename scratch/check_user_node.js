import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";
const AIPCORE_ADDRESS = '0xE82239361FBE54731CFF90D8c2036a33743fFd4d';

const ABI = [
  "function nodeId(address user) view returns (uint256)",
  "function nodes(uint256 nodeId) view returns (address wallet, uint88 nodeId_, uint256 sponsor, uint256 matrixParent, uint40 joinedAt, uint256 tier, uint256 directNodes, uint256 totalMatrixNodes, uint256 totalContribution)",
  "function isFreeRegistered(uint256 nodeId) view returns (bool)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(AIPCORE_ADDRESS, ABI, provider);
  const user = "0xD975e406ceDd3992D9D233C0C0c7fB87C2942CCf";

  try {
    const nId = await contract.nodeId(user);
    console.log(`User ${user} Node ID:`, nId.toString());
    if (nId > 0n) {
      const details = await contract.nodes(nId);
      console.log(`Node details:`, details);
      const isFree = await contract.isFreeRegistered(nId).catch(() => false);
      console.log(`Is free registered:`, isFree);
    }
  } catch (e) {
    console.error("Error querying:", e);
  }
}

main();
