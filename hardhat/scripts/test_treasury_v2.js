const hre = require("hardhat");

async function main() {
  const sigs = await hre.ethers.getSigners();
  const [owner, u1, u2, u3, u4, u5, u6, u7] = sigs;

  console.log("=== DEPLOYING CONTRACTS ===");
  // 1. Deploy Price Oracle
  const OracleFactory = await hre.ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  await oracle.setPrice(600n * 100000000n); // $600 BNB price
  console.log("Oracle deployed at:", oracleAddr, "($600 BNB)");

  // 2. Deploy Views Library
  const ViewsFactory = await hre.ethers.getContractFactory("nfeglobalViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();
  console.log("Views Library deployed at:", viewsAddr);

  // 3. Deploy Core Contract
  const CoreFactory = await hre.ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    owner.address, // firstUser
    owner.address, // feeReceiver
    hre.ethers.ZeroAddress, // rewardPool
    owner.address, // owner
    owner.address, // oracleAdmin
    owner.address  // matrixAdmin
  );
  await core.waitForDeployment();
  
  // Deploy and link MigrationHelper
  const HelperFactory = await (typeof hre !== 'undefined' ? hre.ethers : ethers).getContractFactory("MigrationHelper");
  const helper = await HelperFactory.deploy();
  await helper.waitForDeployment();
  await core.setMigrationHelper(await helper.getAddress());

  const coreAddr = await core.getAddress();
  console.log("Core deployed at:", coreAddr);

  // Configure Oracle and price bounds
  await core.setAddr(11, oracleAddr, 0);
  await core.setPriceBounds(100n * 100000000n, 1000n * 100000000n);

  // 4. Deploy DAO Treasury
  const DaoTreasuryFactory = await hre.ethers.getContractFactory("DaoTreasury");
  const daoTreasury = await DaoTreasuryFactory.deploy(owner.address, coreAddr);
  await daoTreasury.waitForDeployment();
  const daoTreasuryAddr = await daoTreasury.getAddress();
  console.log("DaoTreasury deployed at:", daoTreasuryAddr);

  // Configure DaoTreasury in Core
  await core.setAddr(13, daoTreasuryAddr, 0);
  console.log("Core contract configured with DaoTreasury");

  console.log("\n=== REGISTERING INITIAL NODES ===");
  const regFee = await core.getTierCost(0);
  console.log(`Registration fee (Tier 0): ${hre.ethers.formatEther(regFee)} BNB`);

  // Register U1 under Genesis (55555)
  await core.connect(u1).createNode(55555, { value: regFee });
  const u1Id = await core.nodeId(u1.address);
  console.log(`U1 registered. Node ID: ${u1Id}`);

  // Register U2 under U1
  await core.connect(u2).createNode(u1Id, { value: regFee });
  const u2Id = await core.nodeId(u2.address);
  console.log(`U2 registered. Node ID: ${u2Id}`);

  // Register U3 under U2
  await core.connect(u3).createNode(u2Id, { value: regFee });
  const u3Id = await core.nodeId(u3.address);
  console.log(`U3 registered. Node ID: ${u3Id}`);

  // Register U4 under U2
  await core.connect(u4).createNode(u2Id, { value: regFee });
  const u4Id = await core.nodeId(u4.address);
  console.log(`U4 registered. Node ID: ${u4Id}`);


  console.log("\n=== TEST 1: Missed rewards accumulation in Global Treasury ===");
  const tier1Cost = await core.getTierCost(1);
  console.log(`Tier 1 upgrade cost: ${hre.ethers.formatEther(tier1Cost)} BNB`);

  // Upgrade U3 to Tier 2 (level 2) - sponsor U2 gets sponsor reward, but U1 is not qualified (still Tier 1)
  // Layer distribution to U1 is missed because U1 tier < U3 tier (1 < 2).
  console.log("Upgrading U3 to Tier 2...");
  await core.connect(u3).unlockTier(u3Id, 2, { value: tier1Cost });

  let u1Treasury = await core.treasury(u1Id);
  console.log(`U1 Treasury BNB: ${hre.ethers.formatEther(u1Treasury.bnbAmount)} BNB`);
  console.log(`U1 Treasury USD: ${hre.ethers.formatEther(u1Treasury.usdValue)} USD`);

  // U1 should have accumulated missed rewards from U3 upgrade (should be 3.575 USD)
  if (u1Treasury.bnbAmount > 0n && u1Treasury.usdValue > 0n) {
    console.log("✅ Test 1 Passed: Missed rewards successfully accumulated into global treasury!");
  } else {
    console.log("❌ Test 1 Failed: Missed rewards did not accumulate.");
    process.exit(1);
  }


  console.log("\n=== TEST 2: Same-transaction enqueuing and auto-upgrade ===");
  // InQueue should be false before threshold
  let inQueueBefore = await core.inQueue(u1Id);
  console.log(`U1 inQueue before threshold: ${inQueueBefore}`);

  // Upgrade U4 to Tier 2. This will distribute more missed rewards to U1.
  console.log("Upgrading U4 to Tier 2 to accumulate more missed rewards for U1...");
  await core.connect(u4).unlockTier(u4Id, 2, { value: tier1Cost });

  u1Treasury = await core.treasury(u1Id);
  console.log(`U1 Treasury BNB after U4 upgrade: ${hre.ethers.formatEther(u1Treasury.bnbAmount)} BNB`);
  console.log(`U1 Treasury USD after U4 upgrade: ${hre.ethers.formatEther(u1Treasury.usdValue)} USD`);

  const u1Node = await core.getNode(u1Id);
  console.log(`U1 tier after U4 upgrade: ${u1Node.tier}`);

  // U1 should have auto-upgraded to Tier 2 since its treasury reached 7.15 USD, crossing the $5.00 USD threshold
  if (u1Node.tier === 2n) {
    console.log("✅ Test 2 Passed: Node correctly enqueued and auto-upgraded in the same transaction!");
  } else {
    console.log("❌ Test 2 Failed: Node was not auto-upgraded.");
    process.exit(1);
  }


  console.log("\n=== TEST 3: Requeueing and multi-tier queue processing ===");
  // Register U5 under U1 (U1 is Tier 2 now)
  await core.connect(u5).createNode(u1Id, { value: regFee });
  const u5Id = await core.nodeId(u5.address);
  console.log(`U5 registered. Node ID: ${u5Id}`);

  // Upgrade U5 to Tier 10 in a single transaction. U1 will miss rewards for Tier 2 ($10), Tier 3 ($20), Tier 4 ($40), Tier 5 ($80), Tier 6 ($160), Tier 7 ($320), Tier 8 ($640), and Tier 9 ($1280).
  // Total missed USD from U5 upgrade will accumulate in U1's treasury.
  console.log("Upgrading U5 to Tier 10 in a single transaction...");
  const upgradeCost = await core.getUpgradeCost(1, 9); // from tier 1, 9 levels (to tier 10)
  await core.connect(u5).unlockTier(u5Id, 10, { value: upgradeCost });

  u1Treasury = await core.treasury(u1Id);
  console.log(`U1 Treasury BNB after U5 upgrades: ${hre.ethers.formatEther(u1Treasury.bnbAmount)} BNB`);
  console.log(`U1 Treasury USD after U5 upgrades: ${hre.ethers.formatEther(u1Treasury.usdValue)} USD`);

  let u1NodeAfterUpgrade = await core.getNode(u1Id);
  console.log(`U1 tier immediately after U5 upgrade: ${u1NodeAfterUpgrade.tier}`);

  // U1 should have been enqueued, upgraded to Tier 3, and requeued in the same transaction
  let u1InQueue = await core.inQueue(u1Id);
  console.log(`U1 inQueue immediately after U5 upgrade: ${u1InQueue}`);
  
  if (u1NodeAfterUpgrade.tier === 3n && u1InQueue) {
    console.log("✅ Test 3 Passed: Node was successfully enqueued, upgraded by 1 tier, and requeued in the same transaction!");
  } else {
    console.log(`❌ Test 3 Failed: Tier is ${u1NodeAfterUpgrade.tier} (expected 3), inQueue is ${u1InQueue} (expected true)`);
    process.exit(1);
  }

  // Process queue once manually. This will upgrade U1 from Tier 3 to Tier 4.
  // U1 should NOT be requeued because its remaining treasury (10.40 USD) is < Tier 4 price ($40 USD)
  console.log("Processing treasury queue manually...");
  await core.processTreasuryQueue();
  
  let u1NodeAfterManual = await core.getNode(u1Id);
  console.log(`U1 tier after manual processing: ${u1NodeAfterManual.tier}`);
  let u1InQueueAfterManual = await core.inQueue(u1Id);
  console.log(`U1 inQueue after manual processing: ${u1InQueueAfterManual}`);

  if (u1NodeAfterManual.tier === 4n && !u1InQueueAfterManual) {
    console.log("✅ Test 3 Passed: Manual queue processing successfully upgraded node to Tier 4 and removed it from queue!");
  } else {
    console.log(`❌ Test 3 Failed: Tier is ${u1NodeAfterManual.tier} (expected 4), inQueue is ${u1InQueueAfterManual} (expected false)`);
    process.exit(1);
  }


  console.log("\n=== TEST 4: Tier 18 boundary rules ===");
  // Let's unlock U1 all the way to Tier 18
  console.log("Unlocking U1 to Tier 18...");
  await core.connect(u1).unlockTier(u1Id, 18, { value: hre.ethers.parseEther("1200") });

  const u1NodeTier18 = await core.getNode(u1Id);
  console.log(`U1 tier: ${u1NodeTier18.tier}`);
  u1Treasury = await core.treasury(u1Id);
  console.log(`U1 Treasury BNB: ${hre.ethers.formatEther(u1Treasury.bnbAmount)} BNB`);
  console.log(`U1 Treasury USD: ${hre.ethers.formatEther(u1Treasury.usdValue)} USD`);

  // Verify treasury is cleared on reaching Tier 18
  if (u1Treasury.bnbAmount === 0n && u1Treasury.usdValue === 0n) {
    console.log("✅ Test 4 Passed: Treasury successfully cleared upon reaching Tier 18!");
  } else {
    console.log("❌ Test 4 Failed: Treasury not cleared on Tier 18.");
    process.exit(1);
  }

  // Verify that Tier 18 node is not in queue
  let u1InQueueTier18 = await core.inQueue(u1Id);
  if (!u1InQueueTier18) {
    console.log("✅ Test 4 Passed: Tier 18 node is not enqueued.");
  } else {
    console.log("❌ Test 4 Failed: Tier 18 node remained in queue.");
    process.exit(1);
  }


  console.log("\n=== TEST 5: Dormancy and Abandonment to DaoTreasury ===");
  // Register U6 under Genesis (55555)
  await core.connect(u6).createNode(55555, { value: regFee });
  const u6Id = await core.nodeId(u6.address);
  console.log(`U6 registered. Node ID: ${u6Id}`);

  // Generate some treasury missed rewards for U6
  // Register U7 under U6, and upgrade U7 to Tier 2
  await core.connect(u7).createNode(u6Id, { value: regFee });
  const u7Id = await core.nodeId(u7.address);
  await core.connect(u7).unlockTier(u7Id, 2, { value: tier1Cost });

  const u6TreasuryBefore = await core.treasury(u6Id);
  console.log(`U6 treasury before dormancy: ${hre.ethers.formatEther(u6TreasuryBefore.bnbAmount)} BNB`);

  if (u6TreasuryBefore.bnbAmount === 0n) {
    console.log("❌ Test 5 Failed: U6 didn't accumulate missed rewards.");
    process.exit(1);
  }

  // Declare U6 dormant
  console.log("Declaring U6 dormant...");
  const threshold = await core.dormancyThreshold();
  await hre.network.provider.send("evm_increaseTime", [Number(threshold) + 10]);
  await hre.network.provider.send("evm_mine");

  await core.declareDormant(u6Id);
  const dormantSince = await core.dormantSince(u6Id);
  console.log(`U6 dormant since timestamp: ${dormantSince}`);

  // Fast forward past the claim period (30 days)
  const claimPeriod = await core.CLAIM_PERIOD();
  await hre.network.provider.send("evm_increaseTime", [Number(claimPeriod) + 10]);
  await hre.network.provider.send("evm_mine");

  // Get balance of DaoTreasury contract before abandonment
  const daoBalBefore = await hre.ethers.provider.getBalance(daoTreasuryAddr);
  console.log(`DaoTreasury balance before: ${hre.ethers.formatEther(daoBalBefore)} BNB`);

  // Abandon treasury
  console.log("Abandoning treasury for U6...");
  const tx = await core.abandonTreasury(u6Id);
  await tx.wait();

  // Get balance of DaoTreasury contract after abandonment
  const daoBalAfter = await hre.ethers.provider.getBalance(daoTreasuryAddr);
  console.log(`DaoTreasury balance after: ${hre.ethers.formatEther(daoBalAfter)} BNB`);

  const u6TreasuryAfter = await core.treasury(u6Id);
  console.log(`U6 treasury after abandonment: ${hre.ethers.formatEther(u6TreasuryAfter.bnbAmount)} BNB`);

  const received = daoBalAfter - daoBalBefore;
  console.log(`Received by DaoTreasury: ${hre.ethers.formatEther(received)} BNB`);

  if (received === u6TreasuryBefore.bnbAmount && u6TreasuryAfter.bnbAmount === 0n) {
    console.log("✅ Test 5 Passed: Abandoned treasury successfully transferred to DaoTreasury!");
  } else {
    console.log("❌ Test 5 Failed: Balance transfer incorrect.");
    process.exit(1);
  }

  console.log("\n========================================");
  console.log("🎉 ALL TREASURY V2 TESTS PASSED SUCCESSFULLY!");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
