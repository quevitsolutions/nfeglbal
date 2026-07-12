// scripts/test_direct_view.js
const { ethers } = require("hardhat");

async function main() {
  const oldViewAddr = "0x1883cEd2948f7213424ac9D1fd3E50d4aee9E29A";
  
  // ABI for AIPCoreViewsContract
  const abi = [
    "function getNodeStats(uint256 _userId) external view returns (uint256 totalEarned, uint256 teamSize, uint256 directRefs, uint256 level)"
  ];
  
  const viewContract = new ethers.Contract(oldViewAddr, abi, ethers.provider);
  
  console.log("Calling getNodeStats(55555) directly on oldViewAddr...");
  try {
    const stats = await viewContract.getNodeStats(55555);
    console.log("Success! Stats:", stats);
  } catch (err) {
    console.log("Failed as expected! Error:", err.message);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
