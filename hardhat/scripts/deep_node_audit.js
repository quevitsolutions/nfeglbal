/**
 * DEEP NODE 55557 ANALYSIS
 * - Why does 55557 have directNodes=0 but they registered node 55558?
 * - Check if 55558 even exists
 * - Check if the totalNodes count == 3 means genesis+55556+55557
 * - Test a fresh 3rd registration attempt via the sponsor chain
 */
const hre = require("hardhat");
const { ethers } = hre;

const AIPCORE = "0x8078E36DCd2049526b799F779B8B48464fDcFEd7";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address, "Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  const core = await ethers.getContractAt("aipcore", AIPCORE, deployer);
  
  console.log("\n=== CURRENT CONTRACT STATE ===");
  const totalNodes = await core.totalNodes();
  console.log("totalNodes:", totalNodes.toString(), "(genesis+2 registered = 3 total)");
  
  // Enumerate known nodes
  for (let id = 55555; id <= 55560; id++) {
    const n = await core.nodes(id);
    if (n.nodeId > 0n) {
      console.log(`\nNode ${id}:`);
      console.log(`  wallet: ${n.wallet}`);
      console.log(`  nodeId: ${n.nodeId}`);
      console.log(`  sponsor: ${n.sponsor}`);
      console.log(`  matrixParent: ${n.matrixParent}`);
      console.log(`  tier: ${n.tier}`);
      console.log(`  directNodes: ${n.directNodes}`);
      console.log(`  totalMatrixNodes: ${n.totalMatrixNodes}`);
      const childCount = await core.matrixChildCount(id);
      console.log(`  matrixChildCount: ${childCount}`);
      const missedTotal = await core.getPendingUpgradeRewards(id);
      console.log(`  pendingUpgradeRewards: ${ethers.formatEther(missedTotal)} BNB`);
    }
  }

  // Check by wallet addresses
  console.log("\n=== NODE ID LOOKUPS BY WALLET ===");
  const deployer55556Wallet = "0xb601B5ff90AE25d37094fD91D3f025A2a5AB8B60";
  const deployer55557Wallet = "0x77E103F0fAee309D3D50a7F0F1da8f83e35011ad";
  
  const id56 = await core.nodeId(deployer55556Wallet);
  const id57 = await core.nodeId(deployer55557Wallet);
  console.log(`Wallet 55556's owner nodeId: ${id56}`);
  console.log(`Wallet 55557's owner nodeId: ${id57}`);
  
  // KEY DIAGNOSTIC: Can 55557 sponsor a new registration?
  console.log("\n=== BFS ANALYSIS FOR NEXT REGISTRATION ===");
  console.log("Scenario: New user registers with sponsor=55556");
  const n55556 = await core.nodes(55556);
  const childCount55556 = await core.matrixChildCount(55556);
  console.log(`Node 55556: totalMatrixNodes=${n55556.totalMatrixNodes}, matrixChildCount=${childCount55556}`);
  console.log(`BFS queue size if 55556 is sponsor: ${n55556.totalMatrixNodes + 1n}`);
  
  if (childCount55556 >= 2n) {
    console.log("⚠️  55556 matrix is FULL - BFS will look at children");
    // Check children
    const children55556 = await core.getMatrixDirect(55556);
    console.log(`Children of 55556:`, children55556.map(c => c.toString()));
  } else {
    console.log(`✅ 55556 has space (${childCount55556}/2) — next registration can be placed directly here`);
  }
  
  console.log("\nScenario: New user registers with sponsor=55555 (genesis)");
  const n55555 = await core.nodes(55555);
  const childCount55555 = await core.matrixChildCount(55555);
  console.log(`Node 55555: totalMatrixNodes=${n55555.totalMatrixNodes}, matrixChildCount=${childCount55555}`);
  console.log(`BFS queue size if 55555 is sponsor: ${n55555.totalMatrixNodes + 1n}`);
  
  // Get the matrix tree structure
  console.log("\n=== MATRIX TREE STRUCTURE ===");
  const children55555 = await core.getMatrixDirect(55555);
  console.log(`Genesis (55555) children:`, children55555.map(c => c.toString()));
  
  for (const childId of children55555) {
    if (childId > 0n) {
      const childrenOfChild = await core.getMatrixDirect(childId);
      console.log(`  Node ${childId} children:`, childrenOfChild.map(c => c.toString()));
      for (const grandChildId of childrenOfChild) {
        if (grandChildId > 0n) {
          const childrenOfGrandChild = await core.getMatrixDirect(grandChildId);
          console.log(`    Node ${grandChildId} children:`, childrenOfGrandChild.map(c => c.toString()));
        }
      }
    }
  }

  // KEY CHECK: Registration fee and what happens if we try to register
  const regFee = await core.getTierCost(0);
  console.log("\n=== REGISTRATION FEE CHECK ===");
  console.log(`Current regFee: ${ethers.formatEther(regFee)} BNB`);
  
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  if (deployerBalance >= regFee) {
    console.log(`✅ Deployer has enough BNB (${ethers.formatEther(deployerBalance)}) to test registration`);
  } else {
    console.log(`❌ Deployer balance (${ethers.formatEther(deployerBalance)}) < regFee (${ethers.formatEther(regFee)})`);
  }
  
  // IDENTIFY THE ROOT BUG: check whether node 55557 can be found by nodeId
  console.log("\n=== CHECKING IF 55557 WALLET HAS nodeId MAPPING ===");
  const nodeOf55557Wallet = await core.nodeId(deployer55557Wallet);
  console.log(`core.nodeId(${deployer55557Wallet}) = ${nodeOf55557Wallet}`);
  
  if (nodeOf55557Wallet == 55557n) {
    console.log("✅ 55557 wallet is properly registered with nodeId=55557");
    console.log("The 3rd registration (node 55557) IS done successfully on chain.");
    console.log("\n🔍 CONCLUSION: The registration itself succeeded. Issue is likely:");
    console.log("   1. Frontend not detecting the node (stale data / wrong address)");
    console.log("   2. The user tried to register a 4th wallet (not the 3rd wallet)");
    console.log("   3. Gas estimation failure preventing the TX from submitting");
  } else if (nodeOf55557Wallet == 0n) {
    console.log("❌ 55557 wallet has nodeId=0! Registration FAILED silently!");
    console.log("   The node exists in nodes[55557] but nodeId mapping is broken!");
  }
  
  // Try to call getNode for 55557
  try {
    const n55557Full = await core.getNode(55557);
    console.log("\ngetNode(55557) succeeds:", n55557Full.wallet, "tier:", n55557Full.tier);
  } catch(e) {
    console.log("\n❌ getNode(55557) FAILS:", e.message);
  }
  
  // Check reward history for 55557 to confirm registration happened
  try {
    const income = await core.getIncome(55557, 10);
    console.log(`\nNode 55557 has ${income.length} reward events (registration generates events)`);
    for (const ev of income) {
      console.log(`  Event: fromId=${ev.id}, amount=${ethers.formatEther(ev.amount)}, type=${ev.rewardType}, isMissed=${ev.isMissed}`);
    }
  } catch(e) {
    console.log("Error reading income:", e.message);
  }

  console.log("\n=== FRESH REGISTRATION TEST (DRY RUN) ===");
  console.log("Estimating gas for a 4th registration under genesis...");
  try {
    const gasEst = await core.createNode.estimateGas(55555, { value: regFee });
    console.log(`Gas estimate for createNode(55555): ${gasEst.toString()} gas`);
    console.log("✅ Gas estimation succeeded — registration should work!");
  } catch(e) {
    console.log(`❌ Gas estimation FAILED: ${e.message}`);
    if (e.data) {
      try {
        const decoded = core.interface.parseError(e.data);
        console.log("Decoded error:", decoded);
      } catch {}
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
  });
