import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";

const ABI = [
  "function getRegistrationFee() view returns (uint256)",
  "function registrationFeeUSD() view returns (uint256)",
  "function getTierCost(uint256 index) view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract("0xB6CbD70147835D4eA93B4a768D8e101B6E9A420f", ABI, provider);
  try {
    const fee = await contract.getRegistrationFee();
    console.log(`Registration Fee: ${ethers.formatEther(fee)} BNB`);
  } catch (e) {
    console.log("getRegistrationFee failed:", e.message);
  }
  try {
    const feeUSD = await contract.registrationFeeUSD();
    console.log(`Registration Fee USD: ${feeUSD.toString()}`);
  } catch (e) {
    console.log("registrationFeeUSD failed:", e.message);
  }
  try {
    const tier0 = await contract.getTierCost(0);
    console.log(`Tier 0 Cost: ${ethers.formatEther(tier0)} BNB`);
  } catch (e) {
    console.log("getTierCost failed:", e.message);
  }
}

main();
