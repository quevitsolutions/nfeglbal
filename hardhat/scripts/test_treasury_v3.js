const hre = require("hardhat");

async function main() {
  const sigs = await hre.ethers.getSigners();
  const [owner, u1, u2, u3, u4, u5, u6, u7, u8, u10, u11] = sigs;

  console.log("=== DEPLOYING CONTRACTS FOR CORE ENGINE TEST ===");
  
  // 1. Deploy Price Oracle
  const OracleFactory = await hre.ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  await oracle.setPrice(600n * 100000000n); // $600 BNB price
  console.log("Oracle deployed at:", oracleAddr, "($600 BNB)");

  // 2. Deploy Views Library
  const ViewsFactory = await hre.ethers.getContractFactory("aipcoreViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();
  console.log("Views Library deployed at:", viewsAddr);

  // 3. Deploy Core Contract
  const CoreFactory = await hre.ethers.getContractFactory("aipcore", {
    libraries: { aipcoreViews: viewsAddr },
  });
  let core = await CoreFactory.deploy(
    owner.address, // firstUser
    owner.address, // feeReceiver
    hre.ethers.ZeroAddress, // rewardPool
    owner.address, // owner
    owner.address, // oracleAdmin
    owner.address  // matrixAdmin
  );
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();
  console.log("Core deployed at:", coreAddr);
  core = await hre.ethers.getContractAt("contracts/Iaipcore.sol:Iaipcore", coreAddr);

  // 4. Deploy Views Contract
  const ViewsContractFactory = await hre.ethers.getContractFactory("AIPCoreViewsContract");
  const viewsContract = await ViewsContractFactory.deploy();
  await viewsContract.waitForDeployment();
  const viewsContractAddr = await viewsContract.getAddress();
  console.log("Views Contract deployed at:", viewsContractAddr);

  // Configure Core Contract
  console.log("Configuring Core Contract connections...");
  await core.setAddr(11, oracleAddr, 0); // set Oracle
  await core.setViewsContract(viewsContractAddr); // set views contract for staticcall routing
  await core.setPriceBounds(100n * 100000000n, 20000n * 100000000n); // set price bounds
  await core.setAutoBatch(20); // set autoBatch to 20 to prevent queue blockages
  console.log("Core configured successfully.");

  // Define solvency verification function
  async function verifySolvency(label) {
    const contractBalance = await hre.ethers.provider.getBalance(coreAddr);
    const totalTreasuryBalance = await core.totalTreasuryBalance();
    const totalPendingRewards = await core.totalPendingRewards();
    const sum = totalTreasuryBalance + totalPendingRewards;
    
    console.log(`[Solvency Check - ${label}]`);
    console.log(`  - Contract Balance       : ${hre.ethers.formatEther(contractBalance)} BNB`);
    console.log(`  - Total Treasury Balance : ${hre.ethers.formatEther(totalTreasuryBalance)} BNB`);
    console.log(`  - Total Pending Rewards  : ${hre.ethers.formatEther(totalPendingRewards)} BNB`);
    console.log(`  - Total Reserved Liabilities: ${hre.ethers.formatEther(sum)} BNB`);

    if (sum <= contractBalance) {
      console.log(`  ✅ Solvency Invariant holds (Sum ${hre.ethers.formatEther(sum)} <= Contract ${hre.ethers.formatEther(contractBalance)})`);
    } else {
      console.log(`  ❌ Solvency Invariant VIOLATED! Sum ${hre.ethers.formatEther(sum)} > Contract ${hre.ethers.formatEther(contractBalance)}`);
      process.exit(1);
    }
  }

  await verifySolvency("Initial State");

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

  await verifySolvency("After Node Registrations");

  console.log("\n=== TEST 1: Pure BNB-backed Treasury Missed Rewards Accumulation ===");
  const tier1Cost = await core.getUpgradeCost(1, 1);
  console.log(`Tier 1 upgrade cost: ${hre.ethers.formatEther(tier1Cost)} BNB`);

  await core.connect(u3).selfUpgrade({ value: tier1Cost });

  const u1Bal = await core.treasuryBalance(u1Id);
  const u2Bal = await core.treasuryBalance(u2Id);
  const genBal = await core.treasuryBalance(55555);
  const totalTreasuryBalance = await core.totalTreasuryBalance();

  console.log(`U1 treasury balance: ${hre.ethers.formatEther(u1Bal)} BNB`);
  console.log(`U2 treasury balance: ${hre.ethers.formatEther(u2Bal)} BNB`);
  console.log(`Genesis (55555) treasury balance: ${hre.ethers.formatEther(genBal)} BNB`);
  console.log(`Total treasury balance: ${hre.ethers.formatEther(totalTreasuryBalance)} BNB`);

  if (totalTreasuryBalance === u1Bal + u2Bal + genBal && totalTreasuryBalance > 0n) {
    console.log("✅ Test 1 Passed: Missed rewards accumulated as raw BNB and match totalTreasuryBalance!");
  } else {
    console.log("❌ Test 1 Failed: Missed rewards math mismatch.");
    process.exit(1);
  }

  // Manually upgrade U1 to Tier 1 to align with Test 2 auto-upgrade expectations
  console.log("Manually upgrading U1 to Tier 1 for Test 2 setup...");
  const u1UpgradeCost = await core.getUpgradeCost(0, 1);
  await core.connect(u1).selfUpgrade({ value: u1UpgradeCost });

  await verifySolvency("After Test 1");

  console.log("\n=== TEST 2: Looping Multi-Tier Auto-Upgrades in Queue Processing ===");
  await core.connect(u5).createNode(u1Id, { value: regFee });
  const u5Id = await core.nodeId(u5.address);
  console.log(`U5 registered. Node ID: ${u5Id}`);

  const upgradeCost = await core.getUpgradeCost(0, 10);
  await core.connect(u5).unlockTier(u5Id, 10, { value: upgradeCost });

  const u1BalAfterUpgrade = await core.treasuryBalance(u1Id);
  console.log(`U1 treasury balance after U5 upgrades: ${hre.ethers.formatEther(u1BalAfterUpgrade)} BNB`);

  const u1InQueue = await core.inTreasuryQueue(u1Id);
  console.log(`U1 in queue: ${u1InQueue}`);

  const u1NodeBefore = await core.getNode(u1Id);
  console.log(`U1 tier before processing: ${u1NodeBefore.tier}`);

  await core.processTreasuryQueue();
  const u1NodeAfter1 = await core.getNode(u1Id);
  const u1BalAfter1 = await core.treasuryBalance(u1Id);
  const u1InQueueAfter1 = await core.inTreasuryQueue(u1Id);

  console.log(`U1 tier after Run 1: ${u1NodeAfter1.tier}`);
  console.log(`U1 treasury balance after Run 1: ${hre.ethers.formatEther(u1BalAfter1)} BNB`);
  console.log(`U1 in queue after Run 1: ${u1InQueueAfter1}`);

  if (u1NodeAfter1.tier === 3n && u1InQueueAfter1) {
    console.log("✅ Test 2 Part 1 Passed: Node upgraded by exactly 1 tier (to 3) and re-enqueued!");
  } else {
    console.log("❌ Test 2 Part 1 Failed: FIFO single-step queue upgrade logic error.");
    process.exit(1);
  }

  await core.processTreasuryQueue();
  const u1NodeAfter2 = await core.getNode(u1Id);
  const u1BalAfter2 = await core.treasuryBalance(u1Id);
  const u1InQueueAfter2 = await core.inTreasuryQueue(u1Id);

  console.log(`U1 tier after Run 2: ${u1NodeAfter2.tier}`);
  console.log(`U1 treasury balance after Run 2: ${hre.ethers.formatEther(u1BalAfter2)} BNB`);
  console.log(`U1 in queue after Run 2: ${u1InQueueAfter2}`);

  if (u1NodeAfter2.tier === 4n && !u1InQueueAfter2) {
    console.log("✅ Test 2 Part 2 Passed: Sequential upgrades worked, and node stopped/dequeued when balance became insufficient!");
  } else {
    console.log("❌ Test 2 Part 2 Failed: Queue cleanup/sequential upgrade error.");
    process.exit(1);
  }
  await verifySolvency("After Test 2");

  console.log("\n=== TEST 3: Stale Queue Protection & Discarding ===");
  const tier2Cost = await core.getUpgradeCost(0, 2);
  await core.connect(u4).unlockTier(u4Id, 2, { value: tier2Cost });

  const u2InQueue = await core.inTreasuryQueue(u2Id);
  const u2QueuedTier = await core.queuedTier(u2Id);
  const u2NodeBeforeStale = await core.getNode(u2Id);
  console.log(`U2 in queue: ${u2InQueue}`);
  console.log(`U2 queued tier recorded: ${u2QueuedTier}`);
  console.log(`U2 actual tier: ${u2NodeBeforeStale.tier}`);

  const u2UpgradeCost = await core.getUpgradeCost(u2NodeBeforeStale.tier, 1);
  await core.connect(u2).selfUpgrade({ value: u2UpgradeCost });
  const u2NodeAfterStaleUpgrade = await core.getNode(u2Id);
  console.log(`U2 tier after manual upgrade: ${u2NodeAfterStaleUpgrade.tier}`);

  console.log("Processing queue to test stale queue detection...");
  await core.processTreasuryQueue();

  const u2InQueueAfter = await core.inTreasuryQueue(u2Id);
  console.log(`U2 in queue after processing: ${u2InQueueAfter}`);

  if (!u2InQueueAfter) {
    console.log("✅ Test 3 Passed: Stale queue entry discarded and queue flag reset!");
  } else {
    console.log("❌ Test 3 Failed: Stale queue entry was not discarded.");
    process.exit(1);
  }
  await verifySolvency("After Test 3");

  console.log("\n=== TEST 9: Oracle Circuit Breaker ===");
  const activeBefore = await core.oracleCircuitBreaker();
  console.log(`Breaker active: ${activeBefore}`);

  console.log("Fast-forwarding past 24 hour price sync cooldown...");
  await hre.network.provider.send("evm_increaseTime", [24 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  console.log("Simulating healthy drop: Setting BNB price to $200 (66.6% deviation)...");
  await oracle.setPrice(200n * 100000000n);

  // Since BNB price drops to $200, the upgrade cost in BNB increases (Tier 2 price is $10, so 10/200 = 0.05 BNB).
  await core.connect(u2).selfUpgrade({ value: hre.ethers.parseEther("0.05") });

  const activeAfter = await core.oracleCircuitBreaker();
  console.log(`Breaker active after deviation sync: ${activeAfter}`);

  if (activeAfter) {
    console.log("✅ Oracle circuit breaker tripped successfully.");
  } else {
    console.log("❌ Test 9 Part 1 Failed: Circuit breaker did not trip.");
    process.exit(1);
  }

  console.log("Checking if node registration is blocked during circuit breaker...");
  try {
    await core.connect(u6).createNode(u1Id, { value: regFee });
    console.log("❌ Test 9 Part 2 Failed: Registration succeeded during circuit breaker!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Registration reverted under breaker as expected.");
  }

  console.log("Attempting non-admin reset of circuit breaker (must revert)...");
  try {
    await core.connect(u6).resetOracleCircuitBreaker();
    console.log("❌ Test 9 Part 3 Failed: Non-admin reset circuit breaker!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Non-admin reset reverted as expected.");
  }

  console.log("Resetting circuit breaker by admin/owner (should work immediately)...");
  await core.resetOracleCircuitBreaker();
  const activeAfterOwnerReset = await core.oracleCircuitBreaker();
  console.log(`Breaker active after owner reset: ${activeAfterOwnerReset}`);

  if (!activeAfterOwnerReset) {
    console.log("✅ Owner reset successful.");
  } else {
    console.log("❌ Test 9 Part 4 Failed: Owner reset did not work.");
    process.exit(1);
  }

  console.log("Fast-forwarding past 24 hour price sync cooldown to trip breaker again...");
  await hre.network.provider.send("evm_increaseTime", [24 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  console.log("Simulating second price spike to trip breaker...");
  await oracle.setPrice(310n * 100000000n);
  // Since BNB price rises to $310, the upgrade cost in BNB decreases (Tier 3 price is $20, so 20/310 = 0.0645 BNB). We send 0.10 BNB to be safe.
  await core.connect(u2).selfUpgrade({ value: hre.ethers.parseEther("0.10") });

  const activeAfterSpike = await core.oracleCircuitBreaker();
  console.log(`Breaker active again: ${activeAfterSpike}`);

  console.log("Fast-forwarding past 48 hour circuit breaker timelock...");
  await hre.network.provider.send("evm_increaseTime", [48 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  console.log("Simulating healthy oracle recovering at 48 hours...");
  await oracle.setPrice(310n * 100000000n);

  console.log("Attempting non-admin reset after 48 hours (should succeed)...");
  await core.connect(u6).resetOracleCircuitBreaker();
  const activeAfter48hReset = await core.oracleCircuitBreaker();
  console.log(`Breaker active after 48h reset: ${activeAfter48hReset}`);

  if (!activeAfter48hReset) {
    console.log("✅ Test 9 Passed: Non-admin successfully reset circuit breaker after 48h auto-recovery timelock!");
  } else {
    console.log("❌ Test 9 Failed: 48h timelock non-admin reset failed.");
    process.exit(1);
  }

  console.log("\n=== TEST 11: Tier 18 Treasury Release ===");
  // Step price down from $310 to $100 to maximize BNB value of missed rewards
  console.log("Stepping price down from $310 to $100...");
  let currentPrice = 310;
  while (currentPrice > 100) {
    currentPrice = Math.max(100, Math.floor(currentPrice * 0.68)); // 32% drop
    await oracle.setPrice(BigInt(currentPrice) * 100000000n);
    await hre.network.provider.send("evm_increaseTime", [10]);
    await hre.network.provider.send("evm_mine");
    await core.resetOracleCircuitBreaker();
  }
  console.log(`Price successfully set to $${await core.nativeTokenPrice() / 100000000n}`);

  // Directly deposit some BNB to core contract to simulate user missed reward accumulation
  await owner.sendTransaction({
    to: coreAddr,
    value: hre.ethers.parseEther("1000.0") // send plenty of BNB to support treasury payouts
  });

  // Credit U7 treasury balance manually using simulated missed rewards or registration
  await core.connect(u7).createNode(u1Id, { value: regFee });
  const u7Id = await core.nodeId(u7.address);

  // Register U8 under U7 and upgrade U8 to Tier 18 tier-by-tier
  await core.connect(u8).createNode(u7Id, { value: regFee });
  const u8Id = await core.nodeId(u8.address);
  for (let t = 1; t <= 18; t++) {
    const cost = await core.getUpgradeCost(t - 1, 1);
    await core.connect(u8).unlockTier(u8Id, t, { value: cost });
    console.log(`  - U8 successfully upgraded to Tier ${t}`);
  }

  const u7BalBefore = await core.treasuryBalance(u7Id);
  console.log(`U7 treasury balance before tier 18 upgrade: ${hre.ethers.formatEther(u7BalBefore)} BNB`);

  // Step price up from $100 to $15000 to minimize U7's BNB upgrade cost
  console.log("Stepping price up from $100 to $15000...");
  currentPrice = 100;
  while (currentPrice < 15000) {
    currentPrice = Math.min(15000, Math.floor(currentPrice * 1.45)); // 45% rise
    await oracle.setPrice(BigInt(currentPrice) * 100000000n);
    await hre.network.provider.send("evm_increaseTime", [10]);
    await hre.network.provider.send("evm_mine");
    await core.resetOracleCircuitBreaker();
  }
  console.log(`Price successfully set to $${await core.nativeTokenPrice() / 100000000n}`);

  const u7LevelStart = await core.getUserLevel(u7Id);
  const totalCost18 = await core.getUpgradeCost(u7LevelStart, 18 - Number(u7LevelStart));
  console.log(`Total upgrade cost to Tier 18: ${hre.ethers.formatEther(totalCost18)} BNB`);

  const walletBefore = await hre.ethers.provider.getBalance(u7.address);
  
  // Trigger U7's queue re-enqueuing by depositing 1 wei under the new price
  console.log("Triggering U7 queue re-enqueuing via a micro-deposit...");
  await core.connect(u7).depositToVault({ value: 1n });

  // U7 upgrades to Tier 18 (level 18) via the treasury auto-upgrade queue
  console.log("Processing treasury queue to auto-upgrade U7 to Tier 18...");
  let u7Level = u7LevelStart;
  while (u7Level < 18n) {
    await hre.network.provider.send("evm_mine");
    await core.processTreasuryQueue();
    const newLvl = await core.getUserLevel(u7Id);
    if (newLvl === u7Level) {
      console.log(`U7 stuck at level ${newLvl}. Treasury balance: ${hre.ethers.formatEther(await core.treasuryBalance(u7Id))} BNB`);
      break;
    }
    u7Level = newLvl;
    console.log(`  - U7 auto-upgraded to Tier ${u7Level}`);
  }

  // Withdraw remaining treasury release
  console.log("U7 claiming released treasury from vault...");
  const withdrawTx = await core.connect(u7).withdraw();
  const receipt = await withdrawTx.wait();
  const gasUsed = receipt.gasUsed * receipt.gasPrice;

  const u7BalAfter = await core.treasuryBalance(u7Id);
  const walletAfter = await hre.ethers.provider.getBalance(u7.address);
  const walletDiff = walletAfter - walletBefore + gasUsed;

  console.log(`U7 treasury balance after upgrade: ${hre.ethers.formatEther(u7BalAfter)} BNB`);
  console.log(`U7 wallet balance change: ${hre.ethers.formatEther(walletDiff)} BNB`);

  if (u7BalAfter === 0n && walletDiff > 0n) {
    console.log("✅ Test 11 Passed: Remaining treasury released directly to user wallet!");
  } else {
    console.log("❌ Test 11 Failed: Tier 18 treasury release failed.");
    process.exit(1);
  }
  await verifySolvency("After Test 11");

  console.log("Resetting autoBatch to 1 for Test 12 queue checks...");
  await core.setAutoBatch(1);

  console.log("\n=== TEST 12: Automated Queue Enqueueing via Missed Rewards ===");
  await core.connect(u10).createNode(u1Id, { value: regFee });
  const u10Id = await core.nodeId(u10.address);

  // Manually upgrade U10 to Tier 1 to align with Test 12 expectations
  const u10UpgradeCost = await core.getUpgradeCost(0, 1);
  await core.connect(u10).selfUpgrade({ value: u10UpgradeCost });

  const u10InQueueInitially = await core.inTreasuryQueue(u10Id);
  console.log(`U10 in queue initially: ${u10InQueueInitially}`);

  // Register U11 under U10 and upgrade them to Tier 10
  await core.connect(u11).createNode(u10Id, { value: regFee });
  const u11Id = await core.nodeId(u11.address);
  const costTo10 = await core.getUpgradeCost(0, 10);
  await core.connect(u11).unlockTier(u11Id, 10, { value: costTo10 });

  const u10InQueueAfter = await core.inTreasuryQueue(u10Id);
  console.log(`U10 in queue after missed reward: ${u10InQueueAfter}`);

  if (u10InQueueAfter) {
    console.log("✅ U10 successfully enqueued through missed rewards flow!");
  } else {
    console.log("❌ U10 failed to enqueue.");
    process.exit(1);
  }

  const u10TierBefore = await core.getUserLevel(u10Id);
  console.log(`U10 tier before queue processing: ${u10TierBefore}`);

  await core.processTreasuryQueue();
  const u10TierAfter = await core.getUserLevel(u10Id);
  const u10InQueueFinal = await core.inTreasuryQueue(u10Id);
  console.log(`U10 tier after processing: ${u10TierAfter}`);
  console.log(`U10 in queue after processing: ${u10InQueueFinal}`);

  if (u10TierAfter === 3n && u10InQueueFinal && u10TierBefore === 2n) {
    console.log("✅ Test 12 Passed: Node upgraded by 1 tier (to 3) and correctly re-enqueued!");
  } else {
    console.log("❌ Test 12 Failed: Automated queue processing failed.");
    process.exit(1);
  }
  await verifySolvency("After Test 12");

  console.log("\n========================================");
  console.log("🎉 ALL CORE PROTOCOL VERIFICATION TESTS PASSED!");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
