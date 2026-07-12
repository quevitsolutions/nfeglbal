// scripts/test_fallback_view.js
const { ethers } = require("hardhat");

async function main() {
  const coreAddr = "0x89C394B2f7d35F9e798d881DD05a6Acfa42107D7";
  
  // ABI for AIPCoreViewsContract (4 return values)
  const viewsAbi = [
    "function getNodeStats(uint256 _userId) external view returns (uint256 totalEarned, uint256 teamSize, uint256 directRefs, uint256 level)"
  ];
  
  // Create contract instance of views contract interface AT the core address!
  const coreViews = new ethers.Contract(coreAddr, viewsAbi, ethers.provider);
  
  console.log("Calling getNodeStats(55555) on Core contract address (fallback delegation)...");
  try {
    const stats = await coreViews.getNodeStats(55555);
    console.log("SUCCESS! Returned stats from views contract:");
    console.log("  Total Earned :", ethers.formatEther(stats.totalEarned), "BNB");
    console.log("  Team Size    :", stats.teamSize.toString());
    console.log("  Direct Refs  :", stats.directRefs.toString());
    console.log("  Level        :", stats.level.toString());
  } catch (err) {
    console.error("Failed! Error:", err.message);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
