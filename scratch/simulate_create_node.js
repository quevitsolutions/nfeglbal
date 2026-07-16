import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";
const AIPCORE_ADDRESS = '0xE82239361FBE54731CFF90D8c2036a33743fFd4d';

const ABI = [
  "function createNode(uint256 _sponsor) external payable",
  "function nodeId(address user) view returns (uint256)",
  "function getRegistrationFee() view returns (uint256)",
  "function nodes(uint256 nodeId) view returns (address wallet, uint88 nodeId_, uint256 sponsor, uint256 matrixParent, uint40 joinedAt, uint256 tier, uint256 directNodes, uint256 totalMatrixNodes, uint256 totalContribution)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(AIPCORE_ADDRESS, ABI, provider);
  const user = "0xD975e406ceDd3992D9D233C0C0c7fB87C2942CCf";
  const sponsorId = 55555;

  try {
    const fee = await contract.getRegistrationFee();
    console.log(`On-chain Fee: ${ethers.formatEther(fee)} BNB`);

    const nid = await contract.nodeId(user);
    console.log(`User Node ID: ${nid.toString()}`);

    const sponsorDetails = await contract.nodes(sponsorId);
    console.log(`Sponsor ID ${sponsorId} Details - joinedAt: ${sponsorDetails[4].toString()}`);

    // Try to simulate call (staticCall)
    console.log("Simulating staticCall for createNode...");
    // We cannot change msg.sender easily in standard ethers contract calls, but we can do populateTransaction + call
    const txData = await contract.createNode.populateTransaction(sponsorId, { value: 0n });
    console.log("Tx Data:", txData);

    const res = await provider.call({
      from: user,
      to: AIPCORE_ADDRESS,
      data: txData.data,
      value: 0n
    });
    console.log("Simulation success! Return data:", res);
  } catch (e) {
    console.error("Simulation failed:", e);
  }
}

main();
