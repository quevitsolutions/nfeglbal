const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const coreAddr = "0x89C394B2f7d35F9e798d881DD05a6Acfa42107D7";
  const viewAddr = "0xF0E18D1Ab3F7D789c154D555daD718aC7a690aF0";
  const poolAddr = "0x9f64054Ea5F8fD7A5626Aa20F4Ac1b82B3c33346";
  
  const user = "0xA237A82f0623b0214e49CE33ec55132D2f579053";
  
  const core = await ethers.getContractAt("nfeglobal", coreAddr);
  const NFEGLOBAL_VIEWS_ABI = [
    "function getNodeStats(uint256 nodeId) view returns (uint256 totalEarned, uint256 teamSize, uint256 directRefs, uint256 level)",
    "function getIncomeBreakdown(uint256 nodeId) view returns (uint256 direct, uint256 matrix, uint256 pool, uint256 pending)",
    "function getLevelWiseTeamStats(uint256 _nodeId) view returns (uint256[10] freeUsers, uint256[10] paidUsers, uint256[10] teamSize, uint256[10] treasuryGenerated, uint256[10] treasuryUsed, uint256[10] conversions, uint256[10] rewardsDistributed)",
    "function getFreeStats() view returns (uint256 totalFree, uint256 totalUpgraded, uint256 conversionRate)"
  ];
  const view = await ethers.getContractAt(NFEGLOBAL_VIEWS_ABI, viewAddr);
  const pool = await ethers.getContractAt("RewardPool", poolAddr);
  
  const nId = await core.nodeId(user);
  console.log(`Node ID: ${nId.toString()}`);
  if (nId === 0n) return;
  
  console.log("Calling view.getNodeStats...");
  const viewStats = await view.getNodeStats(nId).catch(err => { console.error("viewStats failed:", err.message); return null; });
  
  console.log("Calling core.getNodeStats...");
  const coreStats = await core.getNodeStats(nId).catch(err => { console.error("coreStats failed:", err.message); return null; });
  console.log("coreStats:", coreStats ? coreStats.toString() : "null");
  
  console.log("Calling core.nodes...");
  const nodeRaw = await core.nodes(nId).catch(err => { console.error("nodeRaw failed:", err.message); return null; });
  console.log("nodeRaw:", nodeRaw ? nodeRaw.toString() : "null");
  
  console.log("Calling pool.getPoolViewHelper...");
  const poolData = await pool.getPoolViewHelper(nId).catch(err => { console.error("poolData failed:", err.message); return null; });
  console.log("poolData:", poolData ? poolData.toString() : "null");
  
  console.log("Done queries.");
}

main().catch(console.error);
