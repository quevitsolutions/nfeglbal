import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";
const AIPCORE_ADDRESS = '0xE82239361FBE54731CFF90D8c2036a33743fFd4d';

const ABI = [
  "function nodes(uint256 nodeId) view returns (address wallet, uint88 nodeId_, uint256 sponsor, uint256 matrixParent, uint40 joinedAt, uint256 tier, uint256 directNodes, uint256 totalMatrixNodes, uint256 totalContribution)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(AIPCORE_ADDRESS, ABI, provider);
  try {
    const details = await contract.nodes(55556);
    console.log(`Node 55556 joinedAt: ${details[4].toString()}`);
  } catch (e) {
    console.log("Failed:", e.message);
  }
}

main();
