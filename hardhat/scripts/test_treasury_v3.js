const hre = require("hardhat");

async function main() {
  const sigs = await hre.ethers.getSigners();
  const [owner, u1, u2, u3, u4, u5, u6, u7, daoRecipient] = sigs;

  console.log("=== DEPLOYING CONTRACTS FOR TREASURY V3 ===");
  
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

  // 4. Deploy Governance Contract
  const GovFactory = await hre.ethers.getContractFactory("Governance");
  const governance = await GovFactory.deploy(coreAddr);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log("Governance deployed at:", govAddr);

  // Configure Core Contract
  console.log("Configuring Core Contract connections...");
  await core.setAddr(11, oracleAddr, 0); // set Oracle
  await core.setPriceBounds(100n * 100000000n, 1000n * 100000000n); // set price bounds
  await core.setGovernance(govAddr); // set Governance
  console.log("Core configured successfully.");

  // Define solvency verification function
  async function verifySolvency(label) {
    const contractBalance = await hre.ethers.provider.getBalance(coreAddr);
    const totalTreasuryBalance = await core.totalTreasuryBalance();
    const daoTreasury = await governance.daoTreasury();
    const totalPendingRewards = await core.totalPendingRewards();
    const sum = totalTreasuryBalance + totalPendingRewards;
    
    console.log(`[Solvency Check - ${label}]`);
    console.log(`  - Contract Balance       : ${hre.ethers.formatEther(contractBalance)} BNB`);
    console.log(`  - Total Treasury Balance : ${hre.ethers.formatEther(totalTreasuryBalance)} BNB`);
    console.log(`  - DAO Treasury Balance   : ${hre.ethers.formatEther(daoTreasury)} BNB`);
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
  const tier1Cost = await core.getTierCost(1);
  console.log(`Tier 1 upgrade cost: ${hre.ethers.formatEther(tier1Cost)} BNB`);

  // U3 upgrades to Tier 2.
  // U2 (sponsor) gets sponsor reward.
  // U1 (referral layer parent) should get layer reward but is unqualified (still Tier 1, whereas U3 goes to Tier 2).
  // Therefore, the layer reward is missed by U1 and must be accumulated in U1's treasuryBalance.
  console.log("Upgrading U3 to Tier 2 (level 2)...");
  const costTo2 = await core.getUpgradeCost(0, 2);
  await core.connect(u3).unlockTier(u3Id, 2, { value: costTo2 });

  const u1BalBefore = await core.treasuryBalance(u1Id);
  const u2BalBefore = await core.treasuryBalance(u2Id);
  const ownerBalBefore = await core.treasuryBalance(55555n);
  const totalTreasuryBefore = await core.totalTreasuryBalance();
  console.log(`U1 treasury balance: ${hre.ethers.formatEther(u1BalBefore)} BNB`);
  console.log(`U2 treasury balance: ${hre.ethers.formatEther(u2BalBefore)} BNB`);
  console.log(`Genesis (55555) treasury balance: ${hre.ethers.formatEther(ownerBalBefore)} BNB`);
  console.log(`Total treasury balance: ${hre.ethers.formatEther(totalTreasuryBefore)} BNB`);

  const calculatedSum = u1BalBefore + u2BalBefore + ownerBalBefore;

  if (u1BalBefore > 0n && totalTreasuryBefore === calculatedSum) {
    console.log("✅ Test 1 Passed: Missed rewards accumulated as raw BNB and match totalTreasuryBalance!");
  } else {
    console.log("❌ Test 1 Failed: Rewards did not accumulate correctly in BNB or sum mismatch.");
    process.exit(1);
  }
  await verifySolvency("After Test 1");

  console.log("\n=== TEST 2: Looping Multi-Tier Auto-Upgrades in Queue Processing ===");
  // Upgrade U1 to Tier 1 manually so U1 is Tier 1 as expected by the comments/assertions
  const u1CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u1).unlockTier(u1Id, 1, { value: u1CostTo1 });

  // Register U5 under U1 (U1 is still Tier 1, but has some treasury balance)
  await core.connect(u5).createNode(u1Id, { value: regFee });
  const u5Id = await core.nodeId(u5.address);
  console.log(`U5 registered. Node ID: ${u5Id}`);

  // Upgrade U5 to Tier 10 in a single transaction.
  // U1 will miss rewards for Tier 2 through Tier 9 upgrades, generating a huge treasury balance.
  console.log("Upgrading U5 to Tier 10...");
  const upgradeCost = await core.getUpgradeCost(0, 10); // from tier 0, 10 levels (to 10)
  await core.connect(u5).unlockTier(u5Id, 10, { value: upgradeCost });

  const u1BalAfterU5 = await core.treasuryBalance(u1Id);
  const u1InQueue = await core.inTreasuryQueue(u1Id);
  const u1Node = await core.getNode(u1Id);
  console.log(`U1 treasury balance after U5 upgrades: ${hre.ethers.formatEther(u1BalAfterU5)} BNB`);
  console.log(`U1 in queue: ${u1InQueue}`);
  console.log(`U1 tier before processing: ${u1Node.tier}`);

  // Now process the queue. In the new queue model, each processTreasuryQueue() run upgrades by exactly 1 tier and re-enqueues if eligible.
  console.log("Processing treasury queue (Run 1)...");
  await core.processTreasuryQueue();

  let u1NodeAfterQueue = await core.getNode(u1Id);
  let u1BalAfterQueue = await core.treasuryBalance(u1Id);
  let u1InQueueAfterQueue = await core.inTreasuryQueue(u1Id);
  console.log(`U1 tier after Run 1: ${u1NodeAfterQueue.tier}`);
  console.log(`U1 treasury balance after Run 1: ${hre.ethers.formatEther(u1BalAfterQueue)} BNB`);
  console.log(`U1 in queue after Run 1: ${u1InQueueAfterQueue}`);

  if (u1NodeAfterQueue.tier === 3n && u1InQueueAfterQueue === true) {
    console.log("✅ Test 2 Part 1 Passed: Node upgraded by exactly 1 tier (to 3) and re-enqueued!");
  } else {
    console.log(`❌ Test 2 Part 1 Failed: Expected Tier 3 and enqueued. Got Tier ${u1NodeAfterQueue.tier}, Enqueued: ${u1InQueueAfterQueue}`);
    process.exit(1);
  }

  // Call it one more time. This should upgrade U1 to Tier 4.
  console.log("Processing treasury queue (Run 2)...");
  await core.processTreasuryQueue();

  u1NodeAfterQueue = await core.getNode(u1Id);
  u1BalAfterQueue = await core.treasuryBalance(u1Id);
  u1InQueueAfterQueue = await core.inTreasuryQueue(u1Id);
  console.log(`U1 tier after Run 2: ${u1NodeAfterQueue.tier}`);
  console.log(`U1 treasury balance after Run 2: ${hre.ethers.formatEther(u1BalAfterQueue)} BNB`);
  console.log(`U1 in queue after Run 2: ${u1InQueueAfterQueue}`);

  if (u1NodeAfterQueue.tier === 4n && u1InQueueAfterQueue === false) {
    console.log("✅ Test 2 Part 2 Passed: Sequential upgrades worked, and node stopped/dequeued when balance became insufficient!");
  } else {
    console.log(`❌ Test 2 Part 2 Failed: Expected Tier 4 and not enqueued. Got Tier ${u1NodeAfterQueue.tier}, Enqueued: ${u1InQueueAfterQueue}`);
    process.exit(1);
  }
  await verifySolvency("After Test 2");

  console.log("\n=== TEST 3: Stale Queue Protection & Discarding ===");
  // Trigger U2 to get enqueued
  // Upgrade U4 to Tier 3. U2 is Tier 1, so it will miss rewards and get enqueued.
  console.log("Upgrading U4 to Tier 3...");
  const u4NodeBefore = await core.getNode(u4Id);
  const u4Cost = await core.getUpgradeCost(u4NodeBefore.tier, 3n - u4NodeBefore.tier);
  await core.connect(u4).unlockTier(u4Id, 3, { value: u4Cost });

  const u2InQueue = await core.inTreasuryQueue(u2Id);
  const u2QueuedTier = await core.queuedTier(u2Id);
  const u2Node = await core.getNode(u2Id);
  console.log(`U2 in queue: ${u2InQueue}`);
  console.log(`U2 queued tier recorded: ${u2QueuedTier}`);
  console.log(`U2 actual tier: ${u2Node.tier}`);

  // Perform manual self-upgrade for U2. This updates its actual tier.
  console.log("U2 performs manual selfUpgrade...");
  const u2UpgradeCost = await core.getTierCost(u2Node.tier);
  await core.connect(u2).selfUpgrade({ value: u2UpgradeCost });

  const u2NodeAfterManual = await core.getNode(u2Id);
  console.log(`U2 tier after manual upgrade: ${u2NodeAfterManual.tier}`);

  // Now call processTreasuryQueue. It should detect that U2's queued tier does not match its actual tier.
  // It should discard U2 from the queue without executing auto-upgrade, and set inTreasuryQueue[u2Id] = false.
  console.log("Processing queue to test stale queue detection...");
  await core.processTreasuryQueue();

  const u2InQueueAfterProcessing = await core.inTreasuryQueue(u2Id);
  console.log(`U2 in queue after processing: ${u2InQueueAfterProcessing}`);

  if (!u2InQueueAfterProcessing) {
    console.log("✅ Test 3 Passed: Stale queue entry discarded and queue flag reset!");
  } else {
    console.log("❌ Test 3 Failed: Stale queue entry not discarded.");
    process.exit(1);
  }
  await verifySolvency("After Test 3");

  console.log("\n=== TEST 4: Inactivity Dormancy & Notice Claiming ===");
  // Configure dormancyThreshold to 10 seconds for fast testing
  await core.setAddr(14, hre.ethers.ZeroAddress, 10);
  const threshold = await core.dormancyThreshold();
  console.log(`Dormancy threshold configured to: ${threshold} seconds`);

  // Register U6 under Genesis (55555)
  await core.connect(u6).createNode(55555, { value: regFee });
  const u6Id = await core.nodeId(u6.address);
  console.log(`U6 registered. Node ID: ${u6Id}`);

  // Register U7 under U6
  await core.connect(u7).createNode(u6Id, { value: regFee });
  const u7Id = await core.nodeId(u7.address);

  // Upgrade U7 to Tier 2 to accumulate some missed rewards for U6
  const costTo2U7 = await core.getUpgradeCost(0, 2);
  await core.connect(u7).unlockTier(u7Id, 2, { value: costTo2U7 });
  const u6BalBefore = await core.treasuryBalance(u6Id);
  console.log(`U6 treasury balance before dormancy: ${hre.ethers.formatEther(u6BalBefore)} BNB`);

  // Wait 12 seconds to cross the dormancy threshold
  console.log("Fast-forwarding time by 12 seconds...");
  await hre.network.provider.send("evm_increaseTime", [12]);
  await hre.network.provider.send("evm_mine");

  // Propose dormancy (2-step process)
  console.log("Proposing U6 dormancy...");
  await core.proposeDormancy(u6Id);
  let isProposed = await core.dormancyProposed(u6Id);
  console.log(`U6 dormancy proposed: ${isProposed}`);

  // Claim within notice period
  console.log("U6 claims dormant treasury during notice period...");
  await core.connect(u6).claimDormantTreasury();
  isProposed = await core.dormancyProposed(u6Id);
  console.log(`U6 dormancy proposed after recovery claim: ${isProposed}`);

  if (!isProposed) {
    console.log("✅ Test 4 Passed: Dormancy proposed and successfully recovered during notice period!");
  } else {
    console.log("❌ Test 4 Failed: Dormancy reclaim failed.");
    process.exit(1);
  }
  await verifySolvency("After Test 4");

  console.log("\n=== TEST 5: Inactivity Dormancy & DAO Migration ===");
  // Wait another 12 seconds to become inactive again
  console.log("Fast-forwarding time by 12 seconds...");
  await hre.network.provider.send("evm_increaseTime", [12]);
  await hre.network.provider.send("evm_mine");

  console.log("Proposing U6 dormancy again...");
  await core.proposeDormancy(u6Id);

  // Fast-forward 30 days to activate dormancy
  console.log("Fast-forwarding past proposal notice period (30 days)...");
  await hre.network.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  console.log("Activating U6 dormancy...");
  await core.activateDormancy(u6Id);
  const isU6Dormant = await core.treasuryDormant(u6Id);
  console.log(`U6 dormant status: ${isU6Dormant}`);

  // Wait past recovery period (CLAIM_PERIOD = 30 days)
  const claimPeriod = await core.CLAIM_PERIOD();
  console.log(`Fast-forwarding past recovery period (${claimPeriod / 86400n} days)...`);
  await hre.network.provider.send("evm_increaseTime", [Number(claimPeriod) + 10]);
  await hre.network.provider.send("evm_mine");

  // Migrate to DAO Treasury
  console.log("Migrating U6 treasury to DAO...");
  const daoTreasuryBefore = await governance.daoTreasury();
  console.log(`DAO Treasury before migration: ${hre.ethers.formatEther(daoTreasuryBefore)} BNB`);

  await core.migrateDormantTreasury(u6Id);

  const u6BalAfter = await core.treasuryBalance(u6Id);
  const daoTreasuryAfter = await governance.daoTreasury();
  console.log(`U6 treasury balance after migration: ${hre.ethers.formatEther(u6BalAfter)} BNB`);
  console.log(`DAO Treasury after migration: ${hre.ethers.formatEther(daoTreasuryAfter)} BNB`);

  if (u6BalAfter === 0n && daoTreasuryAfter === daoTreasuryBefore + u6BalBefore) {
    console.log("✅ Test 5 Passed: Dormant treasury successfully migrated to the DAO treasury pool!");
  } else {
    console.log("❌ Test 5 Failed: Migration balance transfer incorrect.");
    process.exit(1);
  }
  await verifySolvency("After Test 5");

  console.log("\n=== TEST 6: Decentralized Governance & DAO Spending ===");
  // Propose spending DAO Treasury
  const spendAmt = daoTreasuryAfter / 2n;
  console.log(`Proposing to spend ${hre.ethers.formatEther(spendAmt)} BNB from DAO Treasury to recipient...`);
  
  // Propose (proposer must be an active node owner, e.g. u1)
  const proposeTx = await governance.connect(u1).propose(
    daoRecipient.address,
    spendAmt,
    "Funding project expansion"
  );
  const receipt = await proposeTx.wait();
  
  // Find ProposalCreated event
  const log = receipt.logs.find(x => x.fragment && x.fragment.name === 'ProposalCreated');
  const proposalId = log.args[0];
  console.log(`Proposal created with ID: ${proposalId}`);

  // Vote on proposal
  // Voter weight = node tier.
  // U1 (Tier is high due to Test 2 auto-upgrade) votes YES.
  const u1NodeInfo = await core.getNode(u1Id);
  console.log(`U1 Node Tier: ${u1NodeInfo.tier} (weight)`);
  await governance.connect(u1).vote(proposalId, true);

  // U2 votes YES.
  const u2NodeInfo = await core.getNode(u2Id);
  console.log(`U2 Node Tier: ${u2NodeInfo.tier} (weight)`);
  await governance.connect(u2).vote(proposalId, true);

  const propInfo = await governance.proposals(proposalId);
  console.log(`Proposal votesFor: ${propInfo.votesFor}`);

  // Fast forward voting period (7 days)
  console.log("Fast-forwarding voting period (7 days)...");
  await hre.network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  // Queue proposal (starts 2-day timelock and calls createDaoProposal in Core)
  console.log("Queueing proposal in timelock...");
  await governance.connect(u1).queue(proposalId);

  // Fast forward timelock period (2 days)
  console.log("Fast-forwarding timelock period (2 days)...");
  await hre.network.provider.send("evm_increaseTime", [2 * 24 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  // Check balances before execution
  const recipientBalBefore = await hre.ethers.provider.getBalance(daoRecipient.address);
  console.log(`Recipient balance before: ${hre.ethers.formatEther(recipientBalBefore)} BNB`);

  // Execute proposal
  console.log("Executing proposal...");
  await governance.connect(u1).execute(proposalId);

  const recipientBalAfter = await hre.ethers.provider.getBalance(daoRecipient.address);
  const daoTreasuryFinal = await governance.daoTreasury();
  console.log(`Recipient balance after: ${hre.ethers.formatEther(recipientBalAfter)} BNB`);
  console.log(`DAO Treasury final balance: ${hre.ethers.formatEther(daoTreasuryFinal)} BNB`);

  const diff = recipientBalAfter - recipientBalBefore;
  if (diff === spendAmt && daoTreasuryFinal === daoTreasuryAfter - spendAmt) {
    console.log("✅ Test 6 Passed: Timelocked proposal executed and BNB transferred successfully!");
  } else {
    console.log(`❌ Test 6 Failed: Recipient received ${hre.ethers.formatEther(diff)} (expected ${hre.ethers.formatEther(spendAmt)}).`);
    process.exit(1);
  }
  await verifySolvency("After Test 6");

  console.log("\n=== TEST 7: Governance spending restrictions / Solvency guard ===");
  // Verify that owner/admin cannot call createDaoProposal or executeDaoProposal directly
  console.log("Verifying direct createDaoProposal prevention by owner...");
  try {
    await core.createDaoProposal(daoRecipient.address, 1n, "Malicious attempt");
    console.log("❌ Test 7 Failed: Owner was able to call createDaoProposal directly!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Direct createDaoProposal reverted as expected.");
  }

  console.log("\n=== TEST 8: Public Dust Skimmer ===");
  // Send direct BNB to the core contract to simulate dust accumulation
  console.log("Sending 1.5 BNB dust directly to core contract...");
  await owner.sendTransaction({
    to: coreAddr,
    value: hre.ethers.parseEther("1.5")
  });
  
  const balanceBeforeSkim = await hre.ethers.provider.getBalance(coreAddr);
  console.log(`Core balance before skim: ${hre.ethers.formatEther(balanceBeforeSkim)} BNB`);
  
  // Set rewardPool address so we can track the sweep destination
  const mockRewardPool = u3.address;
  await core.setAddr(1, mockRewardPool, 0); // addrType 1 is rewardPool
  console.log(`Mock Reward Pool set to: ${mockRewardPool}`);
  
  const poolBalBefore = await hre.ethers.provider.getBalance(mockRewardPool);
  
  // Perform public permissionless skim
  console.log("Calling skimDust()...");
  await core.connect(u6).skimDust(); // callable by anyone
  
  const balanceAfterSkim = await hre.ethers.provider.getBalance(coreAddr);
  const poolBalAfter = await hre.ethers.provider.getBalance(mockRewardPool);
  console.log(`Core balance after skim: ${hre.ethers.formatEther(balanceAfterSkim)} BNB`);
  console.log(`Mock Reward Pool balance increase: ${hre.ethers.formatEther(poolBalAfter - poolBalBefore)} BNB`);
  
  const reserved = (await core.totalTreasuryBalance()) + (await core.totalPendingRewards());
  if (balanceAfterSkim === reserved && poolBalAfter - poolBalBefore >= hre.ethers.parseEther("1.49")) {
    console.log("✅ Test 8 Passed: Dust successfully skimmed and routed to Reward Pool!");
  } else {
    console.log("❌ Test 8 Failed: Skim balance mapping incorrect.");
    process.exit(1);
  }
  await verifySolvency("After Test 8");

  console.log("\n=== TEST 9: Oracle Circuit Breaker ===");
  // Query active circuit breaker status
  let breakerActive = await core.oracleCircuitBreaker();
  console.log(`Breaker active: ${breakerActive}`);
  
  // Fast forward past the 24h price update cooldown to allow syncing
  console.log("Fast-forwarding past 24 hour price sync cooldown...");
  await hre.network.provider.send("evm_increaseTime", [24 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  // Update oracle price with >50% price change (e.g. drop from $600 to $200)
  console.log("Simulating flash drop: Setting BNB price to $200 (66.6% deviation)...");
  await oracle.setPrice(200n * 100000000n);
  
  // Trigger price sync to trip breaker via a selfUpgrade
  console.log("Triggering price sync by performing U2 selfUpgrade...");
  const u2UpgradeCostTrip = await core.getTierCost(2); // calculated at $600
  // Since price drops to $200, actual cost is 3x higher. Send 4x to cover it and get refunded.
  await core.connect(u2).selfUpgrade({ value: u2UpgradeCostTrip * 4n });
  
  breakerActive = await core.oracleCircuitBreaker();
  console.log(`Breaker active after deviation sync: ${breakerActive}`);
  
  if (breakerActive) {
    console.log("✅ Oracle circuit breaker tripped successfully.");
  } else {
    console.log("❌ Test 9 Failed: Breaker did not trip.");
    process.exit(1);
  }
  
  // Verify updates/registrations are blocked
  console.log("Checking if node registration is blocked during circuit breaker...");
  try {
    await core.connect(u7).createNode(u1Id, { value: regFee });
    console.log("❌ Test 9 Failed: Registration did not revert under breaker!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Registration reverted under breaker as expected.");
  }
  
  // Verify non-admin cannot reset circuit breaker immediately
  console.log("Attempting non-admin reset of circuit breaker (must revert)...");
  try {
    await core.connect(u7).resetOracleCircuitBreaker();
    console.log("❌ Test 9 Failed: Non-admin was able to reset circuit breaker immediately!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Non-admin reset reverted as expected.");
  }

  // Reset breaker by owner (should work immediately)
  console.log("Resetting circuit breaker by admin/owner (should work immediately)...");
  await core.resetOracleCircuitBreaker();
  breakerActive = await core.oracleCircuitBreaker();
  console.log(`Breaker active after owner reset: ${breakerActive}`);
  if (breakerActive) {
    console.log("❌ Test 9 Failed: Owner reset failed.");
    process.exit(1);
  }
  console.log("✅ Owner reset successful.");

  // Trip the breaker again to test 48h auto-recovery
  console.log("Fast-forwarding past 24 hour price sync cooldown to trip breaker again...");
  await hre.network.provider.send("evm_increaseTime", [24 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  console.log("Simulating second price spike to trip breaker...");
  await oracle.setPrice(450n * 100000000n); // raise from 200 to 450 (125% deviation)
  
  // Trigger price sync
  await core.connect(u2).selfUpgrade({ value: hre.ethers.parseEther("200.0") });
  breakerActive = await core.oracleCircuitBreaker();
  console.log(`Breaker active again: ${breakerActive}`);
  if (!breakerActive) {
    console.log("❌ Test 9 Failed: Failed to trip breaker a second time.");
    process.exit(1);
  }

  // Verify non-admin still cannot reset it immediately
  try {
    await core.connect(u7).resetOracleCircuitBreaker();
    console.log("❌ Test 9 Failed: Non-admin was able to reset circuit breaker!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Non-admin reset reverted as expected.");
  }

  // Fast-forward 48 hours to trigger auto-recovery
  console.log("Fast-forwarding past 48 hour circuit breaker timelock...");
  await hre.network.provider.send("evm_increaseTime", [48 * 60 * 60 + 10]);
  await hre.network.provider.send("evm_mine");

  console.log("Simulating healthy oracle recovering at 48 hours...");
  await oracle.setPrice(450n * 100000000n); // update oracle updatedAt timestamp

  // Non-admin tries to reset now - should succeed
  console.log("Attempting non-admin reset after 48 hours (should succeed)...");
  await core.connect(u7).resetOracleCircuitBreaker();
  breakerActive = await core.oracleCircuitBreaker();
  console.log(`Breaker active after 48h reset: ${breakerActive}`);

  if (!breakerActive) {
    console.log("✅ Test 9 Passed: Non-admin successfully reset circuit breaker after 48h auto-recovery timelock!");
  } else {
    console.log("❌ Test 9 Failed: Non-admin reset after 48 hours failed.");
    process.exit(1);
  }

  console.log("\n=== TEST 11: Tier 18 Treasury Release ===");
  const u8 = sigs[9];
  const u8NodeData = {
    wallet: u8.address,
    nodeId: 88888n,
    sponsor: 55555n,
    matrixParent: 55555n,
    joinedAt: BigInt(Math.floor(Date.now() / 1000)),
    tier: 1,
    directNodes: 0,
    totalMatrixNodes: 0,
    totalContribution: 0n,
    sponsorTierRanks: Array(18).fill(0),
    matrixRewardReceiver: Array(18).fill(0)
  };
  
  console.log("Migrating U8 with 5000.0 BNB treasury balance...");
  await core.migrateNode(u8NodeData, hre.ethers.parseEther("5000.0"));
  
  // Deposit 5000.0 BNB to the contract to back the virtual treasury balance
  console.log("Depositing 5000.0 BNB to back the treasury...");
  await owner.sendTransaction({
    to: coreAddr,
    value: hre.ethers.parseEther("5000.0")
  });
  
  const u8BalBefore = await hre.ethers.provider.getBalance(u8.address);
  const totalCost = await core.getUpgradeCost(1, 17);
  console.log(`Total upgrade cost to Tier 18: ${hre.ethers.formatEther(totalCost)} BNB`);
  
  console.log("U8 upgrading to Tier 18...");
  await core.connect(u8).unlockTier(88888, 18, { value: 0 });
  
  const remainingExpected = hre.ethers.parseEther("5000.0") - totalCost;
  const u8TreasuryAfter = await core.treasuryBalance(88888n);
  const u8BalAfter = await hre.ethers.provider.getBalance(u8.address);
  
  console.log(`U8 treasury balance after upgrade: ${hre.ethers.formatEther(u8TreasuryAfter)} BNB`);
  console.log(`U8 wallet balance change: ${hre.ethers.formatEther(u8BalAfter - u8BalBefore)} BNB (Expected ~ ${hre.ethers.formatEther(remainingExpected)} BNB)`);
  
  if (u8TreasuryAfter === 0n && u8BalAfter > u8BalBefore) {
    console.log("✅ Test 11 Passed: Remaining treasury released directly to user wallet!");
  } else {
    console.log("❌ Test 11 Failed: Remaining treasury not released correctly.");
    process.exit(1);
  }
  await verifySolvency("After Test 11");

  console.log("\n=== TEST 12: Automated Queue Enqueueing via Missed Rewards ===");
  const u10 = sigs[11];
  const u10NodeId = 99996n;
  const u10NodeData = {
    wallet: u10.address,
    nodeId: u10NodeId,
    sponsor: 55555n,
    matrixParent: 55555n,
    joinedAt: BigInt(Math.floor(Date.now() / 1000)),
    tier: 1,
    directNodes: 0,
    totalMatrixNodes: 0,
    totalContribution: 0n,
    sponsorTierRanks: Array(18).fill(0),
    matrixRewardReceiver: Array(18).fill(0)
  };

  console.log("Migrating U10 with 0.5 BNB treasury...");
  await core.migrateNode(u10NodeData, hre.ethers.parseEther("0.5"));

  // Verify U10 is not enqueued initially
  let u10InQueue = await core.inTreasuryQueue(u10NodeId);
  console.log(`U10 in queue initially: ${u10InQueue}`);

  // Register U11 under U10
  const u11 = sigs[12];
  const regFeeU11 = await core.getTierCost(0);
  console.log("Registering U11 under U10...");
  await core.connect(u11).createNode(u10NodeId, { value: regFeeU11 * 2n });
  const u11Id = await core.nodeId(u11.address);

  // Upgrade U11 to tier 2. U10 is tier 1, so U10 will miss the tier 2 layer reward.
  // This will add to U10's treasury balance and trigger _enqueueIfEligible(U10).
  const costTo2U11 = await core.getUpgradeCost(0, 2);
  console.log("Upgrading U11 to tier 2...");
  await core.connect(u11).unlockTier(u11Id, 2, { value: costTo2U11 });

  // Verify U10 has been enqueued
  u10InQueue = await core.inTreasuryQueue(u10NodeId);
  console.log(`U10 in queue after missed reward: ${u10InQueue}`);
  
  if (u10InQueue) {
    console.log("✅ U10 successfully enqueued through missed rewards flow!");
  } else {
    console.log("❌ Test 12 Failed: U10 was not enqueued!");
    process.exit(1);
  }

  const u10TierBefore = (await core.getNode(u10NodeId)).tier;
  console.log(`U10 tier before queue processing: ${u10TierBefore}`);

  // Process queue - this should upgrade U10 by 1 tier and re-enqueue it since balance > next cost
  console.log("Processing queue...");
  await core.processTreasuryQueue();

  const u10TierAfter = (await core.getNode(u10NodeId)).tier;
  const u10InQueueAfter = await core.inTreasuryQueue(u10NodeId);
  console.log(`U10 tier after processing: ${u10TierAfter}`);
  console.log(`U10 in queue after processing: ${u10InQueueAfter}`);

  if (u10TierAfter === 3n && u10InQueueAfter === true) {
    console.log("✅ Test 12 Passed: Node upgraded by 1 tier (to 3) and correctly re-enqueued!");
  } else {
    console.log(`❌ Test 12 Failed: Expected Tier 3 and enqueued. Got Tier ${u10TierAfter}, Enqueued: ${u10InQueueAfter}`);
    process.exit(1);
  }
  await verifySolvency("After Test 12");

  console.log("\n=== TEST 10: Permanent Migration Locking ===");
  let migLocked = await core.migrationLocked();
  console.log(`Migration locked initially: ${migLocked}`);
  
  // Perform test migration before lock
  const dummyWallet = "0x" + "a".repeat(40);
  const testNodeData = {
    wallet: dummyWallet,
    nodeId: 99999n,
    sponsor: 55555n,
    matrixParent: 55555n,
    joinedAt: BigInt(Math.floor(Date.now() / 1000)),
    tier: 1,
    directNodes: 0,
    totalMatrixNodes: 0,
    totalContribution: 0n,
    sponsorTierRanks: Array(18).fill(0),
    matrixRewardReceiver: Array(18).fill(0)
  };
  
  console.log("Migrating node 99999 before lock...");
  await core.migrateNode(testNodeData, 0n);
  const migratedNode = await core.getNode(99999n);
  console.log(`Migrated node wallet: ${migratedNode.wallet}`);
  
  // Lock migration permanently
  console.log("Calling lockMigrationForever()...");
  await core.lockMigrationForever();
  migLocked = await core.migrationLocked();
  console.log(`Migration locked after function call: ${migLocked}`);
  
  // Try to migrate again - must revert
  console.log("Checking if future migrations revert...");
  testNodeData.nodeId = 88888n;
  testNodeData.wallet = "0x" + "b".repeat(40);
  try {
    await core.migrateNode(testNodeData, 0n);
    console.log("❌ Test 10 Failed: Migration did not revert after locking!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Migration reverted as expected.");
  }
  
  if (migLocked) {
    console.log("✅ Test 10 Passed: Permanent migration lock enforced!");
  } else {
    console.log("❌ Test 10 Failed: Migration not locked.");
    process.exit(1);
  }

  console.log("\n========================================");
  console.log("🎉 ALL NODEFLOW V2.1 HARDENING TESTS PASSED!");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
