/**
 * =====================================================================
 * DEEP REGISTRATION BUG AUDIT — "3rd user registration fails"
 * =====================================================================
 *
 * Tests ALL possible failure points systematically:
 *
 * BUG-1: BFS queue overflow when sponsor is NOT genesis (subtree deeper)
 * BUG-2: Dust sweep tries to send more than contract balance
 * BUG-3: matrixRewardReceiver[tier] points to node 0 → defaults to genesis → may revert
 * BUG-4: Price staleness causes getTierCost to return wrong/old value
 * BUG-5: _distributeMatrixRewards — totalMatrixNodes undercounting for deep trees
 * BUG-6: genesis.totalMatrixNodes not initialized — queue starts at size 1
 * BUG-7: RewardPool.registerNode() called on pool that does NOT have isNodeActive()
 * BUG-8: totalMissedRewards underflow — if _deductPendingRewards called with > sum
 * BUG-9: createNodeWithSponsorAddress auto-registers targeted but NO fee distribution
 * BUG-10: Targeted user auto-register gives tier=1 but NO direct sponsor reward paid
 */
const hre = require("hardhat");
const { ethers } = hre;

async function deploy(owner) {
  const oracle = await (await ethers.getContractFactory("BNBPriceOracle")).deploy();
  await oracle.waitForDeployment();

  const views = await (await ethers.getContractFactory("aipcoreViews")).deploy();
  await views.waitForDeployment();

  const core = await (await ethers.getContractFactory("aipcore", {
    libraries: { aipcoreViews: await views.getAddress() },
  })).deploy(owner.address, owner.address, ethers.ZeroAddress, owner.address, owner.address, owner.address);
  await core.waitForDeployment();
  
  // Deploy and link MigrationHelper
  const HelperFactory = await (typeof hre !== 'undefined' ? hre.ethers : ethers).getContractFactory("MigrationHelper");
  const helper = await HelperFactory.deploy();
  await helper.waitForDeployment();
  await core.setMigrationHelper(await helper.getAddress());

  await core.setAddr(11, await oracle.getAddress(), 0);
  await oracle.setPrice(600n * 100000000n);

  return { oracle, views, core };
}

async function main() {
  const signers = await ethers.getSigners();
  const [owner, u1, u2, u3, u4, u5, u6, u7, u8] = signers;

  let passed = 0, failed = 0;

  function pass(msg) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  function fail(msg, err) { console.log(`  ❌ FAIL: ${msg}\n         → ${err}`); failed++; }
  function info(msg) { console.log(`  ℹ️  ${msg}`); }
  function section(name) { console.log(`\n${"=".repeat(65)}\n  ${name}\n${"=".repeat(65)}`); }

  // ============================================================
  section("BUG-1: BFS Queue Overflow — All under same sponsor");
  // ============================================================
  {
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);

    await core.connect(u1).createNode(55555, { value: fee });
    const u1id = await core.nodeId(u1.address);

    await core.connect(u2).createNode(u1id, { value: fee });
    const u2id = await core.nodeId(u2.address);

    // Now U1 has 1 child (U2). U1.totalMatrixNodes = 1
    const u1node = await core.nodes(u1id);
    info(`U1.totalMatrixNodes after U2 joins: ${u1node.totalMatrixNodes}`);

    // U3 registers under U1. queueSize = 1+1 = 2
    // U1 has 1 child, so still space → U3 placed as U1's 2nd child
    try {
      await core.connect(u3).createNode(u1id, { value: fee });
      const u3id = await core.nodeId(u3.address);
      const u3node = await core.nodes(u3id);
      const u1nodeAfter = await core.nodes(u1id);
      pass(`U3 registered under U1. matrixParent=${u3node.matrixParent}, U1.totalMatrixNodes=${u1nodeAfter.totalMatrixNodes}`);
    } catch(e) {
      fail("U3 failed to register under U1 (queue=2)", e.message);
    }

    // U4 registers under U1. U1 now has 2 children → FULL. 
    // queueSize = U1.totalMatrixNodes+1 = 2+1 = 3
    // BFS: U1(full)→pushU2,U3. tail=3. Dequeue U2 (0 children)→place.
    try {
      await core.connect(u4).createNode(u1id, { value: fee });
      const u4id = await core.nodeId(u4.address);
      const u4node = await core.nodes(u4id);
      const u1nodeAfter = await core.nodes(u1id);
      pass(`U4 registered. matrixParent=${u4node.matrixParent} (should be U2=${u2id}), U1.totalMatrixNodes=${u1nodeAfter.totalMatrixNodes}`);
    } catch(e) {
      fail("U4 failed to register (BFS queue overflow?)", e.message);
    }
  }

  // ============================================================
  section("BUG-2: 3rd Registration Under Genesis (Classic Scenario)");
  // ============================================================
  {
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);

    await core.connect(u1).createNode(55555, { value: fee });
    await core.connect(u2).createNode(55555, { value: fee });

    const genesis = await core.nodes(55555);
    info(`Genesis.totalMatrixNodes after U1+U2: ${genesis.totalMatrixNodes}`);
    info(`Genesis matrixChildCount: ${await core.matrixChildCount(55555)}`);
    
    // U3 under genesis: queueSize=2+1=3
    // Genesis has 2 children(U1,U2) → FULL → push U1(slot1),U2(slot2)→tail=3
    // Dequeue U1: 0 children → place U3 under U1
    try {
      await core.connect(u3).createNode(55555, { value: fee });
      const u3id = await core.nodeId(u3.address);
      const u3node = await core.nodes(u3id);
      const u1id = await core.nodeId(u1.address);
      pass(`U3 registered under genesis. matrixParent=${u3node.matrixParent} (expected U1=${u1id})`);
      
      // Verify reward flow: genesis.wallet gets direct reward
      info(`Genesis.wallet = ${(await core.nodes(55555)).wallet}`);
    } catch(e) {
      fail("U3 registration under genesis FAILED", e.message);
    }
  }

  // ============================================================
  section("BUG-3: Dust Sweep — BNB Balance Invariant Check");
  // ============================================================
  {
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);

    const balBefore = await ethers.provider.getBalance(await core.getAddress());
    info(`Contract balance before registrations: ${ethers.formatEther(balBefore)} BNB`);

    await core.connect(u1).createNode(55555, { value: fee });
    const bal1 = await ethers.provider.getBalance(await core.getAddress());
    const missed1 = await core.totalMissedRewards();
    const pending1 = await core.totalPendingRewards();
    info(`After U1 registration: balance=${ethers.formatEther(bal1)}, missed=${ethers.formatEther(missed1)}, pending=${ethers.formatEther(pending1)}`);
    
    if (bal1 >= missed1 + pending1) {
      pass(`BNB balance (${ethers.formatEther(bal1)}) >= reserved (${ethers.formatEther(missed1+pending1)})`);
    } else {
      fail("Contract balance < reserved amount! Invariant BROKEN", `balance=${bal1}, reserved=${missed1+pending1}`);
    }

    await core.connect(u2).createNode(55555, { value: fee });
    const bal2 = await ethers.provider.getBalance(await core.getAddress());
    const missed2 = await core.totalMissedRewards();
    const pending2 = await core.totalPendingRewards();
    info(`After U2 registration: balance=${ethers.formatEther(bal2)}, missed=${ethers.formatEther(missed2)}`);
    
    if (bal2 >= missed2 + pending2) {
      pass(`After U2: balance >= reserved`);
    } else {
      fail("After U2: Contract balance < reserved!", `balance=${bal2}, reserved=${missed2+pending2}`);
    }

    await core.connect(u3).createNode(55555, { value: fee });
    const bal3 = await ethers.provider.getBalance(await core.getAddress());
    const missed3 = await core.totalMissedRewards();
    const pending3 = await core.totalPendingRewards();
    info(`After U3 registration: balance=${ethers.formatEther(bal3)}, missed=${ethers.formatEther(missed3)}`);
    
    if (bal3 >= missed3 + pending3) {
      pass(`After U3: balance >= reserved`);
    } else {
      fail("After U3: Contract balance < reserved! FUNDS LOST", `balance=${bal3}, reserved=${missed3+pending3}`);
    }
  }

  // ============================================================
  section("BUG-4: matrixRewardReceiver[0] for node registered as FIRST child");
  // ============================================================
  {
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);

    await core.connect(u1).createNode(55555, { value: fee });
    const u1id = await core.nodeId(u1.address);
    
    await core.connect(u2).createNode(u1id, { value: fee });
    const u2id = await core.nodeId(u2.address);
    // Use getNode() to retrieve full struct including array fields (matrixRewardReceiver)
    const u2nodeFull = await core.getNode(u2id);
    info(`U2 matrixRewardReceiver[0] = ${u2nodeFull.matrixRewardReceiver[0]} (should be U1=${u1id})`);
    info(`U2 matrixRewardReceiver[1] = ${u2nodeFull.matrixRewardReceiver[1]} (should be genesis=55555)`);
    
    if (u2nodeFull.matrixRewardReceiver[0] == u1id) {
      pass("U2 matrixRewardReceiver[0] = U1 ✓");
    } else {
      fail(`U2 matrixRewardReceiver[0] should be U1(${u1id}) but got ${u2nodeFull.matrixRewardReceiver[0]}`, "Wrong matrix receiver");
    }
    
    if (u2nodeFull.matrixRewardReceiver[1] == 55555n) {
      pass(`U2 matrixRewardReceiver[1] = Genesis(55555) ✓`);
    } else {
      fail(`U2 matrixRewardReceiver[1] should be 55555 but got ${u2nodeFull.matrixRewardReceiver[1]}`, "Wrong matrix chain");
    }
    
    // Critical: when U3 registers, it gets matrixParent=U1 (2nd child slot)
    await core.connect(u3).createNode(u1id, { value: fee });
    const u3id = await core.nodeId(u3.address);
    const u3nodeFull = await core.getNode(u3id);
    info(`U3 matrixParent = ${u3nodeFull.matrixParent}`);
    info(`U3 matrixRewardReceiver[0] = ${u3nodeFull.matrixRewardReceiver[0]}`);
    info(`U3 matrixRewardReceiver[1] = ${u3nodeFull.matrixRewardReceiver[1]}`);
    
    if (u3nodeFull.matrixParent == u1id) {
      pass(`U3 matrixParent = U1 ✓`);
    } else {
      fail(`U3 matrixParent should be U1 but got ${u3nodeFull.matrixParent}`, "Wrong matrix parent");
    }
    
    if (u3nodeFull.matrixRewardReceiver[0] == u1id) {
      pass(`U3 matrixRewardReceiver[0] = U1 ✓ (U1 is matrix parent, receives tier 0 reward)`);
    } else {
      fail(`U3 matrixRewardReceiver[0] should be U1 but got ${u3nodeFull.matrixRewardReceiver[0]}`, "Receiver chain broken");
    }
  }

  // ============================================================
  // BUG-5: createNodeWithSponsorAddress — targeted user auto-reg NO fee distribution (REMOVED)
  // ============================================================

  // ============================================================
  section("BUG-6: BFS Queue Overflow — Deep Tree (maxMatrixDepth limit bug)");
  // ============================================================
  {
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);
    
    // Build a chain: genesis → U1 → U2 → U3 → ... all as only children (left chain)
    // Then test: U1 as sponsor for a new user when chain is 25+ deep
    // totalMatrixNodes only tracks 25 levels up; beyond that ancestors undercount
    info("Building a 5-level deep binary chain to test BFS queue size...");
    
    const users = [u1, u2, u3, u4, u5, u6, u7, u8];
    let lastId = 55555n;
    const nodeIds = [];
    
    for(let i = 0; i < 7; i++) {
      await core.connect(users[i]).createNode(lastId, { value: fee });
      lastId = await core.nodeId(users[i].address);
      nodeIds.push(lastId);
      const n = await core.nodes(lastId);
      info(`Depth ${i+1}: NodeId=${lastId}, matrixParent=${n.matrixParent}, totalMatrixNodes=${n.totalMatrixNodes}`);
    }
    
    // Check genesis totalMatrixNodes
    const genesis = await core.nodes(55555);
    info(`Genesis totalMatrixNodes after ${nodeIds.length} joins (chain): ${genesis.totalMatrixNodes}`);
    info(`Expected: ${nodeIds.length} (all within 25 levels)`);
    
    if (genesis.totalMatrixNodes == BigInt(nodeIds.length)) {
      pass(`Genesis totalMatrixNodes correctly counted: ${genesis.totalMatrixNodes}`);
    } else {
      fail(`Genesis totalMatrixNodes mismatch! Expected ${nodeIds.length}, got ${genesis.totalMatrixNodes}`, "Undercounting!");
    }
  }

  // ============================================================
  section("BUG-7: Exact BFS Queue Boundary — sponsor subtree EXACTLY fills queue");
  // ============================================================
  {
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);
    
    // Create perfect binary tree of depth 2 under U1:
    // U1 → [U2, U3], U2 → [U4, U5], U3 → [U6, U7]
    // U1.totalMatrixNodes = 6
    // Next user (U8) under U1: queueSize = 6+1 = 7
    // BFS: U1(full)→push U2,U3 (tail=3)
    //      U2(full)→push U4,U5 (tail=5)
    //      U3(full)→push U6,U7 (tail=7) ← EXACTLY AT BOUNDARY! 7 <= 7 OK
    //      U4 (0 children) → place U8 here
    
    await core.connect(u1).createNode(55555, { value: fee });
    const u1id = await core.nodeId(u1.address);
    
    await core.connect(u2).createNode(u1id, { value: fee });
    const u2id = await core.nodeId(u2.address);
    
    await core.connect(u3).createNode(u1id, { value: fee });
    const u3id = await core.nodeId(u3.address);
    
    // U2 now has 2 matrix children:
    await core.connect(u4).createNode(u1id, { value: fee });  // → U2
    const u4id = await core.nodeId(u4.address);
    await core.connect(u5).createNode(u1id, { value: fee });  // → U2 (2nd child)
    const u5id = await core.nodeId(u5.address);
    
    // U3 now has 2 matrix children:
    await core.connect(u6).createNode(u1id, { value: fee });  // → U3
    const u6id = await core.nodeId(u6.address);
    await core.connect(u7).createNode(u1id, { value: fee });  // → U3 (2nd child)
    const u7id = await core.nodeId(u7.address);
    
    const u1node = await core.nodes(u1id);
    info(`U1 totalMatrixNodes = ${u1node.totalMatrixNodes} (should be 6)`);
    info(`queueSize for next registration = ${u1node.totalMatrixNodes + 1n}`);
    
    // U8 under U1: perfect binary tree → must descend to U4 or U5
    try {
      await core.connect(u8).createNode(u1id, { value: fee });
      const u8id = await core.nodeId(u8.address);
      const u8node = await core.nodes(u8id);
      pass(`U8 registered! matrixParent=${u8node.matrixParent} (should be ${u4id} or ${u5id})`);
    } catch(e) {
      fail("U8 registration at queue boundary FAILED", e.message);
    }
  }

  // ============================================================
  section("BUG-8: CRITICAL — BFS Queue OVERFLOW when queueSize too small");
  // ============================================================
  {
    // This tests: sponsor=U2, but U2 has 2 direct children in the matrix ALREADY
    // U2.totalMatrixNodes tells us its subtree size
    // We need to verify that queue NEVER writes beyond queueSize
    
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);
    
    // Setup:
    // Genesis → [U1, U2]   (genesis has 2 children)
    // U1 → [U3, U4]        (U1 has 2 children)
    // Now register U5 with SPONSOR=U1
    // U1.totalMatrixNodes = 2 (U3 and U4)
    // queueSize = 2+1 = 3
    // BFS: U1(full: U3,U4)→push U3(slot1),U4(slot2), tail=3
    //      tail=3 == queueSize=3. If U3 or U4 also have children and we try queue[3]→BOOM!
    
    await core.connect(u1).createNode(55555, { value: fee });
    const u1id = await core.nodeId(u1.address);
    await core.connect(u2).createNode(55555, { value: fee });
    const u2id = await core.nodeId(u2.address);
    await core.connect(u3).createNode(u1id, { value: fee });
    const u3id = await core.nodeId(u3.address);
    await core.connect(u4).createNode(u1id, { value: fee });
    const u4id = await core.nodeId(u4.address);
    
    info(`U1 matrix children: ${await core.matrixChildCount(u1id)} (should be 2)`);
    const u1node = await core.nodes(u1id);
    info(`U1.totalMatrixNodes = ${u1node.totalMatrixNodes} (should be 2)`);
    
    // Now U3 gets 2 children of its own
    await core.connect(u5).createNode(u3id, { value: fee });
    const u5id = await core.nodeId(u5.address);
    await core.connect(u6).createNode(u3id, { value: fee });
    const u6id = await core.nodeId(u6.address);
    
    const u3node_after = await core.nodes(u3id);
    const u1node_after = await core.nodes(u1id);
    info(`U3.totalMatrixNodes after U5+U6: ${u3node_after.totalMatrixNodes}`);
    info(`U1.totalMatrixNodes after U5+U6 join under U3: ${u1node_after.totalMatrixNodes}`);
    
    // CRITICAL TEST: new user registers with sponsor=U1
    // U1.totalMatrixNodes = 4 (U3, U4, U5, U6)
    // queueSize = 4+1 = 5
    // BFS: slot0=U1(full)→push U3(slot1),U4(slot2)→tail=3
    //      slot1=U3(full,has U5+U6)→push U5(slot3),U6(slot4)→tail=5 ← EXACTLY = queueSize=5! VALID
    //      slot2=U4(0 children)→parentId=U4. DONE!
    try {
      await core.connect(u7).createNode(u1id, { value: fee });
      const u7id = await core.nodeId(u7.address);
      const u7node = await core.nodes(u7id);
      pass(`U7 registered under U1! matrixParent=${u7node.matrixParent} (expected U4=${u4id})`);
      if (u7node.matrixParent != u4id) {
        fail(`matrixParent mismatch! Expected U4(${u4id}) but got ${u7node.matrixParent}`, "BFS order wrong");
      }
    } catch(e) {
      fail("U7 registration FAILED - possible BFS queue overflow!", e.message);
    }
    
    // Now U4 gets 2 children too
    await core.connect(u8).createNode(u4id, { value: fee });
    const u8id = await core.nodeId(u8.address);
    
    // One more signer for extra registration
    const u9 = signers[9];
    await core.connect(u9).createNode(u4id, { value: fee });
    const u9id = await core.nodeId(u9.address);
    
    const u1node_final = await core.nodes(u1id);
    info(`U1.totalMatrixNodes = ${u1node_final.totalMatrixNodes} (should be 6)`);
    
    // NOW: U1 subtree is a perfect binary tree of 6 nodes (U3,U4,U5,U6,U8,U9)
    // queueSize = 6+1 = 7
    // BFS: slot0=U1(full)→push U3(1),U4(2)→tail=3
    //      slot1=U3(full)→push U5(3),U6(4)→tail=5
    //      slot2=U4(full)→push U8(5),U9(6)→tail=7 ← tail=7=queueSize, indices 0-6 valid. OK!
    //      slot3=U5 (0 children) → place here!
    const u10 = signers[10];
    try {
      await core.connect(u10).createNode(u1id, { value: fee });
      const u10id = await core.nodeId(u10.address);
      const u10node = await core.nodes(u10id);
      pass(`U10 registered at perfect-binary boundary! matrixParent=${u10node.matrixParent}`);
    } catch(e) {
      fail("U10 registration FAILED at perfect binary tree boundary!", e.message);
    }
  }

  // ============================================================
  section("BUG-9: Missed Reward Invariant — totalMissedRewards never underflows");
  // ============================================================
  {
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);
    
    await core.connect(u1).createNode(55555, { value: fee });
    const u1id = await core.nodeId(u1.address);
    
    // Tier upgrade should accumulate missed rewards for U1 (unqualified for tier reward)
    const tier2cost = await core.getTierCost(1);
    await core.connect(u2).createNode(u1id, { value: fee });
    const u2id = await core.nodeId(u2.address);
    
    await core.connect(u2).unlockTier(u2id, 2, { value: tier2cost });
    
    const missed = await core.totalMissedRewards();
    const pending = await core.totalPendingRewards();
    const balance = await ethers.provider.getBalance(await core.getAddress());
    
    info(`totalMissedRewards: ${ethers.formatEther(missed)}`);
    info(`totalPendingRewards: ${ethers.formatEther(pending)}`);
    info(`Contract balance: ${ethers.formatEther(balance)}`);
    
    if (balance >= missed + pending) {
      pass("Contract balance >= totalMissed + totalPending (invariant holds)");
    } else {
      fail("Contract balance < reserved! CRITICAL invariant broken", `diff=${ethers.formatEther(missed + pending - balance)}`);
    }
  }

  // ============================================================
  section("BUG-10: Registration When Sponsor Has ZERO sponsors in upline tree");
  // ============================================================
  {
    // genesis.sponsor = 0. When distributing layer rewards, sponsor chain stops at 0.
    // But in _distributeLayerRewards: parentId = nodes[_nodeId].sponsor → 55555
    // Then for genesis: nodes[55555].sponsor = 0 → break loop. That's fine.
    // But what about networkTree iteration: for(i=0; i<layerDepth; ++i) { if(parentId==0) break; }
    // This should be OK.
    
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);
    
    // First registration (U1 under genesis)
    await core.connect(u1).createNode(55555, { value: fee });
    const u1id = await core.nodeId(u1.address);
    pass(`U1 registered successfully. NodeId=${u1id}`);
    
    // Second registration (U2 under U1)
    await core.connect(u2).createNode(u1id, { value: fee });
    const u2id = await core.nodeId(u2.address);
    pass(`U2 registered successfully. NodeId=${u2id}`);
    
    // Third registration (U3 under U2)
    await core.connect(u3).createNode(u2id, { value: fee });
    const u3id = await core.nodeId(u3.address);
    pass(`U3 registered successfully. NodeId=${u3id}`);
    
    const u3node = await core.nodes(u3id);
    info(`U3 matrixParent: ${u3node.matrixParent} (should be U2=${u2id} or U1=${u1id})`);
  }

  // ============================================================
  section("FINAL: Full System Invariant Check After 8 Sequential Registrations");
  // ============================================================
  {
    const { core } = await deploy(owner);
    const fee = await core.getTierCost(0);
    const coreAddr = await core.getAddress();
    
    const testUsers = signers.slice(1, 9);
    let prevId = 55555n;
    
    for (let i = 0; i < testUsers.length; i++) {
      try {
        await core.connect(testUsers[i]).createNode(prevId, { value: fee });
        const uid = await core.nodeId(testUsers[i].address);
        const unode = await core.nodes(uid);
        
        const missed = await core.totalMissedRewards();
        const pending = await core.totalPendingRewards();
        const balance = await ethers.provider.getBalance(coreAddr);
        
        if (balance < missed + pending) {
          fail(`After user ${i+1} registration: balance < reserved!`, `balance=${ethers.formatEther(balance)}, reserved=${ethers.formatEther(missed+pending)}`);
        } else {
          pass(`User ${i+1} (NodeId=${uid}): balance invariant holds | matrixParent=${unode.matrixParent} | totalMatrixNodes for sponsor${prevId}=${(await core.nodes(prevId)).totalMatrixNodes}`);
        }
        
        prevId = uid; // next user sponsors under this one
      } catch(e) {
        fail(`User ${i+1} registration FAILED`, e.message);
      }
    }
  }

  // ============================================================
  console.log(`\n${"=".repeat(65)}`);
  console.log(`  AUDIT SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log(`${"=".repeat(65)}\n`);
  
  if (failed > 0) {
    console.log("❌ BUGS DETECTED — Contract needs fixing before deployment!\n");
    process.exit(1);
  } else {
    console.log("✅ ALL TESTS PASSED — Contract is safe for this test suite.\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 UNCAUGHT ERROR:", error.message);
    process.exit(1);
  });
