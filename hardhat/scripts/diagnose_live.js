/**
 * LIVE TESTNET REGISTRATION DIAGNOSTICS
 * 
 * Queries the deployed contract on BSC Testnet to identify:
 * 1. Current genesis state (tier, totalMatrixNodes, wallet, totalNodes)
 * 2. Any existing registered nodes
 * 3. Exact registration fee required
 * 4. Whether the 3rd registration has a BFS queue overflow risk
 * 5. Oracle price freshness
 * 6. MatrixChildCount at genesis / critical nodes
 * 7. Contract balance vs reserved balance
 */
const hre = require("hardhat");
const { ethers } = hre;

const DEPLOYMENT = {
  BNBPriceOracle: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526", // Real Chainlink BNB/USD
  nfeglobal: "0x5eF34F466e083cC5d0C9B76A94A19a65B2a0dCB1",
  rewardPool: "0xd7a11c03F40D8A74Dc58a8441498f05a210D027A",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  const core = await ethers.getContractAt(
    "nfeglobal",
    DEPLOYMENT.nfeglobal,
    deployer
  );
  
  const oracle = await ethers.getContractAt(
    "BNBPriceOracle",
    DEPLOYMENT.BNBPriceOracle,
    deployer
  );

  console.log("\n=============================================");
  console.log("  LIVE TESTNET CONTRACT STATE DIAGNOSTICS");
  console.log("=============================================\n");

  // 1. Basic contract state
  const totalNodes = await core.totalNodes();
  const bnbPrice = await core.bnbPrice();
  const lastPriceUpdate = await core.lastPriceUpdate();
  const defaultRefer = await core.defaultRefer();
  const regFee = await core.getTierCost(0);

  console.log("=== GLOBAL STATE ===");
  console.log("defaultRefer:", defaultRefer.toString());
  console.log("totalNodes:", totalNodes.toString());
  console.log("bnbPrice:", ethers.formatUnits(bnbPrice, 8), "USD");
  console.log("lastPriceUpdate:", new Date(Number(lastPriceUpdate) * 1000).toISOString());
  console.log("priceAge:", Math.round((Date.now()/1000 - Number(lastPriceUpdate)) / 3600), "hours old");
  console.log("registrationFee:", ethers.formatEther(regFee), "BNB");

  // 2. Oracle state
  console.log("\n=== ORACLE STATE ===");
  try {
    const [, oraclePrice, , oracleUpdatedAt] = await oracle.latestRoundData();
    console.log("Oracle price:", ethers.formatUnits(oraclePrice, 8), "USD");
    console.log("Oracle updatedAt:", new Date(Number(oracleUpdatedAt) * 1000).toISOString());
    
    // Check price deviation
    const deviation = oraclePrice > bnbPrice
      ? (oraclePrice - bnbPrice) * 10000n / bnbPrice
      : (bnbPrice - oraclePrice) * 10000n / bnbPrice;
    console.log("Price deviation from contract:", Number(deviation)/100, "%");
    if (deviation > 2000n) {
      console.log("⚠️  WARNING: Oracle price deviation > 20%! _syncOraclePrice() will REJECT this update!");
    } else {
      console.log("✅ Price deviation within 20% threshold");
    }
  } catch(e) {
    console.log("Oracle read error:", e.message);
  }

  // 3. Genesis node state
  console.log("\n=== GENESIS NODE (55555) ===");
  const genesis = await core.nodes(55555);
  console.log("wallet:", genesis.wallet);
  console.log("tier:", genesis.tier.toString());
  console.log("directNodes:", genesis.directNodes.toString());
  console.log("totalMatrixNodes:", genesis.totalMatrixNodes.toString());
  console.log("matrixChildCount:", (await core.matrixChildCount(55555)).toString());
  console.log("joinedAt:", new Date(Number(genesis.joinedAt) * 1000).toISOString());

  // 4. BFS queue risk assessment
  const matrixChildCount = await core.matrixChildCount(55555);
  const genesisSubtreeSize = genesis.totalMatrixNodes;
  const bfsQueueSize = genesisSubtreeSize + 1n;
  console.log("\n=== BFS QUEUE RISK ASSESSMENT (Genesis as sponsor) ===");
  console.log(`If a new user registers with genesis as sponsor:`);
  console.log(`  Genesis subtree size (totalMatrixNodes): ${genesisSubtreeSize}`);
  console.log(`  BFS queue allocated: ${bfsQueueSize} slots`);
  console.log(`  Genesis direct matrix children: ${matrixChildCount}`);
  
  if (matrixChildCount >= 2n) {
    console.log(`  ⚠️  Genesis binary matrix is FULL (2 direct children) — BFS will expand to children's children`);
    // Risk: BFS enqueues genesis (slot0) + 2 children (slots1,2) = tail=3
    // Then for each full child, enqueues 2 more... total slots needed = all nodes in subtree
    // Queue size = subtreeSize+1 which is EXACT. Should be fine unless undercounting.
    console.log(`  Required slots for BFS = ${genesisSubtreeSize} (subtree) + 1 (root) = ${bfsQueueSize}`);
    console.log(`  ✅ Queue exactly matches subtree — OK in theory`);
  } else {
    console.log(`  ✅ Genesis matrix has free slots — BFS finds slot immediately (no overflow risk)`);
  }

  // 5. Check deployed nodes
  console.log("\n=== REGISTERED NODES ===");
  const globalNodes = [];
  // nodes mapping is by index, check the global count
  for (let nodeId = 55555; nodeId <= 55555 + Number(totalNodes); nodeId++) {
    const n = await core.nodes(nodeId);
    if (n.nodeId > 0n) {
      console.log(`NodeId=${n.nodeId}, wallet=${n.wallet}, tier=${n.tier}, sponsor=${n.sponsor}, matrixParent=${n.matrixParent}, directNodes=${n.directNodes}, totalMatrixNodes=${n.totalMatrixNodes}`);
      globalNodes.push(n);
    }
  }

  // 6. Contract balance invariant check
  console.log("\n=== CONTRACT BALANCE CHECK ===");
  const balance = await ethers.provider.getBalance(DEPLOYMENT.nfeglobal);
  const missed = await core.totalMissedRewards();
  const pending = await core.totalPendingRewards();
  console.log("Contract balance:", ethers.formatEther(balance), "BNB");
  console.log("totalMissedRewards:", ethers.formatEther(missed), "BNB");
  console.log("totalPendingRewards:", ethers.formatEther(pending), "BNB");
  console.log("Reserved:", ethers.formatEther(missed + pending), "BNB");
  console.log("Available:", ethers.formatEther(balance > missed + pending ? balance - missed - pending : 0n), "BNB");
  
  if (balance >= missed + pending) {
    console.log("✅ Balance invariant holds — no fund leakage");
  } else {
    console.log("❌ CRITICAL: Balance < reserved! Funds are missing!");
  }

  // 7. Simulate what would happen if 3rd user registers now
  console.log("\n=== 3RD REGISTRATION FEASIBILITY ===");
  const currentNodes = Number(totalNodes);
  console.log(`Currently ${currentNodes} node(s) registered (including genesis)`);
  
  if (currentNodes < 3) {
    console.log(`${3 - currentNodes} more registration(s) needed to reach 3rd user`);
    console.log(`Current registration fee: ${ethers.formatEther(regFee)} BNB`);
    
    // Check if there are nodes with queued matrixParent issues
    for (const n of globalNodes) {
      if (n.nodeId == 55555n) continue;
      const childCount = await core.matrixChildCount(n.nodeId);
      console.log(`\nNodeId=${n.nodeId}: matrixChildCount=${childCount}, totalMatrixNodes=${n.totalMatrixNodes}`);
      if (childCount >= 2n) {
        const bfsQ = n.totalMatrixNodes + 1n;
        console.log(`  Matrix FULL for ${n.nodeId}. BFS queue for next registration = ${bfsQ}`);
      }
    }
  }

  // 8. Check RewardPool.registerNode access
  console.log("\n=== REWARDPOOL INTERFACE CHECK ===");
  const rewardPool = await ethers.getContractAt("RewardPool", DEPLOYMENT.rewardPool, deployer);
  try {
    const genesisPool = await rewardPool.nodePool(55555);
    console.log("Genesis pool tier:", genesisPool.toString());
    
    // Check if nfeglobal is an authorized caller in RewardPool
    const isEngine = await rewardPool.authorizedCallers(DEPLOYMENT.nfeglobal);
    console.log("nfeglobal is authorized caller in RewardPool:", isEngine);
    if (!isEngine) {
      console.log("⚠️  WARNING: nfeglobal is NOT an authorized caller in RewardPool!");
      console.log("   This means registerNode() calls from nfeglobal will be REJECTED!");
      console.log("   HOWEVER: nfeglobal does NOT call registerNode() internally — it only emits PoolCheckRequired event.");
      console.log("   This is NOT a blocking issue for createNode().");
    }
  } catch(e) {
    console.log("RewardPool check error:", e.message);
  }
  
  console.log("\n=== DIAGNOSIS COMPLETE ===");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
  });
