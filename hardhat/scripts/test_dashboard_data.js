const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const coreAddr = "0x8f21F8458D19743932540a2E62FFd20AEc89cb72";
  const viewAddr = "0xeb5C38B2dD7F6c6F0641E605C7AE5a47AF9E31b7";
  const poolAddr = "0xB2B9D8e20682f5B9ee66505e549e199D9790DE0e";
  
  const user = "0xf220dc8e6cddb7cddcb628043c969d4f09ded25e";
  
  const core = await ethers.getContractAt("nfeglobal", coreAddr);
  const view = await ethers.getContractAt("nfeglobalViews", viewAddr);
  const pool = await ethers.getContractAt("RewardPool", poolAddr);
  
  const nId = await core.nodeId(user);
  console.log(`Node ID: ${nId.toString()}`);
  if (nId === 0n) return;
  
  console.log("Calling view.getNodeStats...");
  const viewStats = await view.getNodeStats(nId).catch(err => { console.error("viewStats failed:", err.message); return null; });
  
  console.log("Calling core.getNodeStats...");
  const coreStats = await core.getNodeStats(nId).catch(err => { console.error("coreStats failed:", err.message); return null; });
  
  console.log("Calling core.nodes...");
  const nodeRaw = await core.nodes(nId).catch(err => { console.error("nodeRaw failed:", err.message); return null; });
  
  console.log("Calling pool.getPoolViewHelper...");
  const poolData = await pool.getPoolViewHelper(nId).catch(err => { console.error("poolData failed:", err.message); return null; });
  
  console.log("Done queries.");
}

main().catch(console.error);
