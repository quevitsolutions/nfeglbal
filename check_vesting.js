import { ethers } from "ethers";

async function main() {
  const vestingAddress = "0xc58aB1190B60CB379a0E5920ba6317Db24d71Bbb";
  const abi = [
    "function defaultVestingDays() view returns (uint256)",
    "function vestingDaysPerTier() view returns (uint256)"
  ];

  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
  const contract = new ethers.Contract(vestingAddress, abi, provider);

  try {
    const defaultDays = await contract.defaultVestingDays();
    const daysPerTier = await contract.vestingDaysPerTier();
    console.log("On-chain Vesting Details:");
    console.log("defaultVestingDays:", defaultDays.toString());
    console.log("vestingDaysPerTier:", daysPerTier.toString());
  } catch (err) {
    console.error("Error querying vesting contract:", err);
  }
}

main().catch(console.error);
