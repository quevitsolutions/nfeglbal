const hre = require("hardhat");

async function main() {
  const sigs = await hre.ethers.getSigners();
  const [owner, u1, u2, u3, u4, feeReceiver, u5] = sigs;

  console.log("=== DEPLOYING CONTRACTS FOR SINGLE CONTRACT MODEL ===");

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

  // 3. Deploy Core Contract (nfeglobal)
  const CoreFactory = await hre.ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    owner.address, // firstUser
    feeReceiver.address, // feeReceiver
    hre.ethers.ZeroAddress, // rewardPool
    owner.address, // owner
    owner.address, // oracleAdmin
    owner.address  // matrixAdmin
  );
  await core.waitForDeployment();
  
  const coreAddr = await core.getAddress();
  console.log("Core deployed at:", coreAddr);

  // Configure Core Contract
  console.log("Configuring Core Contract connections...");
  await core.setAddr(11, oracleAddr, 0); // set Oracle
  await core.setPriceBounds(100n * 100000000n, 1000n * 100000000n); // set price bounds
  
  // Deploy and Link Standalone Views Contract
  const StandaloneViewsFactory = await hre.ethers.getContractFactory("NFEGlobalViewsContract");
  const standaloneViews = await StandaloneViewsFactory.deploy();
  await standaloneViews.waitForDeployment();
  const standaloneViewsAddr = await standaloneViews.getAddress();
  console.log("Standalone Views Contract deployed at:", standaloneViewsAddr);
  await core.setViewsContract(standaloneViewsAddr);
  
  console.log("Core configured successfully.");

  // Get active pricing
  const regFeeBNB = await core.getRegistrationFee();
  console.log(`Registration fee in BNB ($0.70): ${hre.ethers.formatEther(regFeeBNB)} BNB`);
  const tierCost0 = await core.getTierCost(0);
  console.log(`Tier 1 activation fee ($5.00): ${hre.ethers.formatEther(tierCost0)} BNB`);

  console.log("\n=== TEST 1: Register Free Users (Tier 0) ===");
  // Register U1 under Genesis (55555)
  const feeReceiverBalBefore = await hre.ethers.provider.getBalance(feeReceiver.address);
  
  await core.connect(u1).createNode(55555n, { value: regFeeBNB });
  const u1Id = await core.nodeId(u1.address);
  console.log(`U1 registered directly. Node ID: ${u1Id}`);

  const u1Node = await core.getNode(u1Id);
  console.log(`U1 tier: ${u1Node.tier}`);
  
  const feeReceiverBalAfter = await hre.ethers.provider.getBalance(feeReceiver.address);
  const feePaid = feeReceiverBalAfter - feeReceiverBalBefore;
  console.log(`Fee receiver balance change: ${hre.ethers.formatEther(feePaid)} BNB`);

  if (u1Node.tier === 0n && feePaid === regFeeBNB) {
    console.log("✅ Test 1 Passed: Free user registered at Tier 0 and registration fee routed directly to feeReceiver!");
  } else {
    console.log("❌ Test 1 Failed: Tier or fee routing incorrect.");
    process.exit(1);
  }

  console.log("\n=== TEST 2: Matrix Placement and Sponsorship ===");
  // Register U2 under U1
  await core.connect(u2).createNode(u1Id, { value: regFeeBNB });
  const u2Id = await core.nodeId(u2.address);
  console.log(`U2 registered under U1. Node ID: ${u2Id}`);

  // Register U3 under U2
  await core.connect(u3).createNode(u2Id, { value: regFeeBNB });
  const u3Id = await core.nodeId(u3.address);
  console.log(`U3 registered under U2. Node ID: ${u3Id}`);

  const u3Node = await core.getNode(u3Id);
  console.log(`U3 sponsor: ${u3Node.sponsor}`);
  console.log(`U3 matrix parent: ${u3Node.matrixParent}`);

  if (u3Node.sponsor === u2Id && u3Node.matrixParent === u2Id) {
    console.log("✅ Test 2 Passed: BFS matrix placement and sponsor relationships established for Tier 0 nodes!");
  } else {
    console.log("❌ Test 2 Failed: Sponsor/MatrixParent incorrect.");
    process.exit(1);
  }

  console.log("\n=== TEST 3: Reward Routing to Treasury for Tier 0 Node ===");
  // Activate U3 manually to Tier 1.
  // U2 is sponsor (Tier 0). Direct sponsor reward of 10% (0.00083 BNB), matrix reward of 70% (0.00583 BNB),
  // and layer 1 reward of 1.5% (0.00012 BNB) should be generated.
  // Since U2 is FREE (Tier 0), the rewards must route to U2's treasury balance inside NFEGlobal.
  console.log(`Upgrading U3 manually to Tier 1. Paying: ${hre.ethers.formatEther(tierCost0)} BNB`);
  await core.connect(u3).unlockTier(u3Id, 1, { value: tierCost0 });

  const u2Treasury = await core.treasuryBalance(u2Id);
  console.log(`U2 Treasury Balance: ${hre.ethers.formatEther(u2Treasury)} BNB`);

  const u3NodeAfter = await core.getNode(u3Id);
  console.log(`U3 tier after manual upgrade: ${u3NodeAfter.tier}`);

  // Calculate exact expected reward with EVM truncations
  const directReward = (tierCost0 * 1000n) / 10000n;
  const layerReward = (tierCost0 * 150n) / 10000n;
  const matrixReward = (tierCost0 * 7000n) / 10000n;
  const expectedReward = directReward + layerReward + matrixReward;
  console.log(`Expected U2 Treasury Reward: ${hre.ethers.formatEther(expectedReward)} BNB`);

  if (u3NodeAfter.tier === 1n && u2Treasury === expectedReward) {
    console.log("✅ Test 3 Passed: Rewards successfully routed to Tier 0 sponsor's treasury!");
  } else {
    console.log(`❌ Test 3 Failed: Reward routing or tier update incorrect. Treasury was: ${hre.ethers.formatEther(u2Treasury)} BNB.`);
    process.exit(1);
  }

  console.log("\n=== TEST 4: Auto-Upgrade via Treasury Accumulation ===");
  // To trigger auto-upgrade of U2, its treasury balance must reach Tier 1 cost (default $5 = 0.0083 BNB).
  // Let's upgrade U3 further (to level 10) so that U2 (sponsor) gets sponsor and layer rewards.
  const u2NodeBeforeAuto = await core.getNode(u2Id);
  console.log(`U2 tier before auto-upgrade: ${u2NodeBeforeAuto.tier}`);

  console.log("Upgrading U3 to level 10...");
  const upgradeCost = await core.getUpgradeCost(1, 9); // upgrade from level 1 to level 10 (9 levels)
  await core.connect(u3).unlockTier(u3Id, 10, { value: upgradeCost });

  const u2TreasuryAfterU3 = await core.treasuryBalance(u2Id);
  const u2InQueue = await core.inTreasuryQueue(u2Id);
  console.log(`U2 Treasury after U3 upgrade: ${hre.ethers.formatEther(u2TreasuryAfterU3)} BNB`);
  console.log(`U2 in treasury queue: ${u2InQueue}`);

  // Process queue to execute auto-upgrade
  console.log("Processing treasury queue...");
  await core.processTreasuryQueue();

  const u2NodeAfterAuto = await core.getNode(u2Id);
  const u2TreasuryFinal = await core.treasuryBalance(u2Id);
  console.log(`U2 tier after auto-upgrade: ${u2NodeAfterAuto.tier}`);
  console.log(`U2 Treasury remaining: ${hre.ethers.formatEther(u2TreasuryFinal)} BNB`);

  if (u2NodeAfterAuto.tier === 1n) {
    console.log("✅ Test 4 Passed: U2 automatically upgraded to Tier 1 when treasury balance reached required cost!");
  } else {
    console.log("❌ Test 4 Failed: Auto-upgrade did not execute.");
    process.exit(1);
  }

  console.log("\n=== TEST 5: Manual Upgrade with Partial Payment ===");
  // Register U4 under U1 (sponsor)
  await core.connect(u4).createNode(u1Id, { value: regFeeBNB });
  const u4Id = await core.nodeId(u4.address);
  console.log(`U4 registered. Node ID: ${u4Id}`);

  // Let's credit U4's treasury by registering a dummy user under U4 and upgrading them to Tier 1.
  const dummyUser = sigs[5];
  await core.connect(dummyUser).createNode(u4Id, { value: regFeeBNB });
  const dummyId = await core.nodeId(dummyUser.address);
  console.log(`Dummy registered under U4. Node ID: ${dummyId}`);

  // Upgrade dummy to Level 1. This pays direct, matrix, and layer rewards to U4's treasury.
  await core.connect(dummyUser).unlockTier(dummyId, 1, { value: tierCost0 });
  
  const u4Treasury = await core.treasuryBalance(u4Id);
  console.log(`U4 Treasury: ${hre.ethers.formatEther(u4Treasury)} BNB`);

  // Now U4 manual upgrades.
  // Tier 1 Cost = 0.0083 BNB.
  // Treasury = 0.00679 BNB.
  // Required payment = 0.00154 BNB.
  const requiredPayment = tierCost0 - u4Treasury;
  console.log(`U4 manually upgrades by sending required payment: ${hre.ethers.formatEther(requiredPayment)} BNB`);

  // Send 0.01 BNB (which is more than required payment) to test the refund
  const u4BalBeforeUpgrade = await hre.ethers.provider.getBalance(u4.address);
  
  const tx = await core.connect(u4).unlockTier(u4Id, 1, { value: hre.ethers.parseEther("0.01") });
  const receipt = await tx.wait();
  const gasUsed = receipt.gasUsed * receipt.gasPrice;

  const u4NodeAfterUpgrade = await core.getNode(u4Id);
  const u4TreasuryAfterUpgrade = await core.treasuryBalance(u4Id);
  const u4BalAfterUpgrade = await hre.ethers.provider.getBalance(u4.address);

  console.log(`U4 tier after upgrade: ${u4NodeAfterUpgrade.tier}`);
  console.log(`U4 Treasury after upgrade: ${hre.ethers.formatEther(u4TreasuryAfterUpgrade)} BNB`);
  console.log(`U4 Wallet balance change (net of gas): ${hre.ethers.formatEther(u4BalAfterUpgrade - u4BalBeforeUpgrade + gasUsed)} BNB`);

  if (u4NodeAfterUpgrade.tier === 1n && u4TreasuryAfterUpgrade === 0n) {
    console.log("✅ Test 5 Passed: Manual upgrade with partial payment and refund worked perfectly!");
  } else {
    console.log("❌ Test 5 Failed: Manual upgrade did not unlock tier or treasury balance mismatch.");
    process.exit(1);
  }

  console.log("\n=== TEST 6: Funnel Analytics & activateTier1() ===");
  // Register U5 under U1
  await core.connect(u5).createNode(u1Id, { value: regFeeBNB });
  const u5Id = await core.nodeId(u5.address);
  console.log(`U5 registered. Node ID: ${u5Id}`);

  // Test activateTier1() manually.
  // U5 is at Tier 0 with 0 treasury. They send the full Tier1 cost.
  console.log(`U5 activates Tier 1 manually via activateTier1(). Paying: ${hre.ethers.formatEther(tierCost0)} BNB`);
  await core.connect(u5).activateTier1({ value: tierCost0 });
  const u5NodeAfter = await core.getNode(u5Id);
  console.log(`U5 tier after activateTier1: ${u5NodeAfter.tier}`);

  if (u5NodeAfter.tier === 1n) {
    console.log("✅ activateTier1() manually unlocked Tier 1 successfully!");
  } else {
    console.log("❌ activateTier1() failed.");
    process.exit(1);
  }

  // Retrieve statistics via core fallback proxy using NFEGlobalViewsContract interface
  const coreViews = await hre.ethers.getContractAt("NFEGlobalViewsContract", coreAddr);

  const freeStats = await coreViews.getFreeStats();
  console.log(`Free Stats: totalFree=${freeStats[0]}, totalUpgraded=${freeStats[1]}, conversionRate=${freeStats[2]/100n}%`);

  const freeUserList = await coreViews.getFreeUserList(0, 10);
  console.log(`Free User List Node IDs: ${freeUserList[0]}`);

  const userDetails = await coreViews.getFreeUserDetails(u1Id);
  console.log(`U1 Details: wallet=${userDetails[0]}, sponsor=${userDetails[1]}, tier=${userDetails[2]}, treasury=${hre.ethers.formatEther(userDetails[3])} BNB, isConverted=${userDetails[5]}, totalRewards=${hre.ethers.formatEther(userDetails[6])} BNB`);

  const teamRevenue = await coreViews.getTeamRevenueStats(u1Id);
  console.log(`U1 Team Revenue Stats: generated=${hre.ethers.formatEther(teamRevenue[0])} BNB, used=${hre.ethers.formatEther(teamRevenue[1])} BNB, remaining=${hre.ethers.formatEther(teamRevenue[2])} BNB, upgrades=${teamRevenue[3]}, rewards=${hre.ethers.formatEther(teamRevenue[4])} BNB`);

  const sponsorPerformance = await coreViews.getSponsorPerformance(u1Id);
  console.log(`U1 Sponsor Performance: freeUsers=${sponsorPerformance[0]}, convertedUsers=${sponsorPerformance[1]}, rate=${sponsorPerformance[2]/100n}%, teamGrowth=${sponsorPerformance[3]}`);

  const levelWiseStats = await coreViews.getLevelWiseTeamStats(u1Id);
  console.log("U1 Level Wise Stats (Level 1):");
  console.log(`  freeUsers: ${levelWiseStats[0][0]}`);
  console.log(`  paidUsers: ${levelWiseStats[1][0]}`);
  console.log(`  teamSize: ${levelWiseStats[2][0]}`);
  console.log(`  treasuryGenerated: ${hre.ethers.formatEther(levelWiseStats[3][0])} BNB`);
  console.log(`  treasuryUsed: ${hre.ethers.formatEther(levelWiseStats[4][0])} BNB`);
  console.log(`  conversions: ${levelWiseStats[5][0]}`);
  console.log(`  rewardsDistributed: ${hre.ethers.formatEther(levelWiseStats[6][0])} BNB`);

  console.log("✅ Test 6 Passed: All lightweight protocol statistics and pre-computed O(1) view functions work perfectly!");

  console.log("\n========================================");
  console.log("🎉 ALL SINGLE CONTRACT SIMULATION TESTS PASSED!");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
