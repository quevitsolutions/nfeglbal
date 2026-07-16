import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";
const AIPCORE_ADDRESS = '0xE82239361FBE54731CFF90D8c2036a33743fFd4d';

const ABI = [
  "function getRegistrationFee() view returns (uint256)",
  "function getTierCost(uint256 tier) view returns (uint256)",
  "function getTierCosts() view returns (uint256[])",
  "function registrationFeeUSD() view returns (uint256)",
  "function oracleCircuitBreaker() view returns (bool)",
  "function totalNodes() view returns (uint256)",
  "function _nextId() view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(AIPCORE_ADDRESS, ABI, provider);

  try {
    const nextId = await contract._nextId();
    console.log("Next ID:", nextId.toString());

    const totalNodes = await contract.totalNodes();
    console.log("Total Nodes:", totalNodes.toString());

    const regFeeUSD = await contract.registrationFeeUSD();
    console.log("Registration Fee USD:", regFeeUSD.toString());

    const regFee = await contract.getRegistrationFee();
    console.log("Registration Fee (BNB):", ethers.formatEther(regFee));

    const tier0Cost = await contract.getTierCost(0);
    console.log("Tier 0 Cost:", ethers.formatEther(tier0Cost));

    const costs = await contract.getTierCosts();
    console.log("All Tier Costs:", costs.map(c => ethers.formatEther(c)));
  } catch (e) {
    console.error("Error querying contract:", e);
  }
}

main();
