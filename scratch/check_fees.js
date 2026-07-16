import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";

const ABI = [
  "function getRegistrationFee() view returns (uint256)",
  "function registrationFeeUSD() view returns (uint256)",
  "function getTierCost(uint256 index) view returns (uint256)",
  "function oracleCircuitBreaker() view returns (bool)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract("0xE82239361FBE54731CFF90D8c2036a33743fFd4d", ABI, provider);
  try {
    const fee = await contract.getRegistrationFee();
    const feeUSD = await contract.registrationFeeUSD();
    const tier0Cost = await contract.getTierCost(0);
    const cb = await contract.oracleCircuitBreaker();
    console.log(`Registration Fee: ${ethers.formatEther(fee)} BNB`);
    console.log(`Registration Fee USD: ${feeUSD.toString()}`);
    console.log(`Tier 0 Cost: ${ethers.formatEther(tier0Cost)} BNB`);
    console.log(`Oracle Circuit Breaker: ${cb}`);
  } catch (e) {
    console.log("Failed:", e.message);
  }
}

main();
