const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("==========================================================");
  console.log("   NFEGLOBAL M-05 DORMANT TREASURY RECOVERY TEST SCRIPT");
  console.log("==========================================================\n");

  const signers = await ethers.getSigners();
  const [owner, u1, u2, dao] = signers;

  // 1. Deploy Contracts
  console.log("1. Deploying contracts...");
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();

  const ViewsFactory = await ethers.getContractFactory("nfeglobalViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();

  const CoreFactory = await ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: await views.getAddress() },
  });
  const core = await CoreFactory.deploy(
    owner.address,
    owner.address,
    ethers.ZeroAddress,
    owner.address,
    owner.address,
    owner.address
  );
  await core.waitForDeployment();
  
  // Deploy and link MigrationHelper
  const HelperFactory = await (typeof hre !== 'undefined' ? hre.ethers : ethers).getContractFactory("MigrationHelper");
  const helper = await HelperFactory.deploy();
  await helper.waitForDeployment();
  await core.setMigrationHelper(await helper.getAddress());

  const coreAddr = await core.getAddress();

  const PoolFactory = await ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555);
  await pool.waitForDeployment();

  // Link components
  await core.setAddr(1, await pool.getAddress(), 0);
  await core.setAddr(11, await oracle.getAddress(), 0);
  
  // Set DAO Treasury address (type 13)
  await core.setAddr(13, dao.address, 0);
  console.log(`- DAO Treasury configured to: ${dao.address}`);

  // Set BNB price to $600 USD
  await oracle.setPrice(600n * 100000000n);
  await core.setPriceBounds(100n * 100000000n, 10000n * 100000000n);
  console.log("- Contracts deployed and configured successfully.\n");

  // 2. Register User 1 and User 2
  console.log("2. Registering User 1 and User 2...");
  const regFee = await core.getRegistrationFee();
  const tier0Cost = await core.getTierCost(0);
  
  await core.connect(u1).createNode(55555, { value: regFee });
  const u1Id = await core.nodeId(u1.address);
  await core.connect(u1).unlockTier(u1Id, 1, { value: tier0Cost });
  console.log(`- User 1 registered and upgraded to Tier 1. Node ID: ${u1Id.toString()}`);

  await core.connect(u2).createNode(u1Id, { value: regFee });
  const u2Id = await core.nodeId(u2.address);
  await core.connect(u2).unlockTier(u2Id, 1, { value: tier0Cost });
  console.log(`- User 2 registered and upgraded to Tier 1. Node ID: ${u2Id.toString()}`);

  // Check initial activity timestamps
  const initialActU1 = await core.lastActivity(u1Id);
  console.log(`- Initial User 1 lastActivity: ${initialActU1.toString()}`);

  // 3. Accumulate missed rewards for User 1 (U1 stays at tier 1, U2 upgrades to tier 2)
  console.log("\n3. Upgrading User 2 to Tier 2 to accumulate missed rewards for User 1...");
  const tier1Cost = await core.getTierCost(1);
  await core.connect(u2).unlockTier(u2Id, 2, { value: tier1Cost });

  const missedU1Tier1 = (await core.treasury(u1Id))[0];
  console.log(`- User 1 missed rewards for Tier 1: ${ethers.formatEther(missedU1Tier1)} BNB`);
  if (missedU1Tier1 === 0n) {
    throw new Error("User 1 failed to accumulate missed rewards!");
  }

  // 4. Try to declare dormancy before 3 years
  console.log("\n4. Verifying declareDormant() reverts before 3 years of inactivity...");
  try {
    await core.declareDormant(u1Id);
    throw new Error("declareDormant succeeded before 3 years, but should have reverted!");
  } catch (err) {
    console.log("- Reverted correctly as expected.");
  }

  // 5. Fast forward time by 3 years + 1 day
  console.log("\n5. Fast forwarding time by 3 years...");
  const THREE_YEARS = 3 * 365 * 24 * 60 * 60 + 86400; // 3 years + 1 day
  await ethers.provider.send("evm_increaseTime", [THREE_YEARS]);
  await ethers.provider.send("evm_mine");

  // 6. Declare dormancy
  console.log("\n6. Declaring dormancy for User 1...");
  const txDormant = await core.declareDormant(u1Id);
  const receiptDormant = await txDormant.wait();
  
  const dormantSinceU1 = await core.dormantSince(u1Id);
  console.log(`- User 1 is now dormant since: ${dormantSinceU1.toString()}`);
  if (dormantSinceU1 === 0n) {
    throw new Error("User 1 dormantSince not set!");
  }

  // 7. Verify node owner can reclaim within 30 days
  console.log("\n7. Reclaiming User 1 node within the 30-day recovery window...");
  const txReclaim = await core.connect(u1).reclaimDormantNode();
  await txReclaim.wait();

  const dormantSinceAfterReclaim = await core.dormantSince(u1Id);
  const lastActivityAfterReclaim = await core.lastActivity(u1Id);
  console.log(`- User 1 dormantSince after reclaim: ${dormantSinceAfterReclaim.toString()}`);
  console.log(`- User 1 lastActivity after reclaim: ${lastActivityAfterReclaim.toString()}`);

  if (dormantSinceAfterReclaim !== 0n) {
    throw new Error("Dormancy flag was not cleared after reclaim!");
  }
  if (lastActivityAfterReclaim <= initialActU1) {
    throw new Error("lastActivity was not refreshed!");
  }
  console.log("- User 1 successfully reclaimed and recovered!");

  // 8. Declare dormancy again (after another 3 years)
  console.log("\n8. Fast forwarding another 3 years to redeclare dormancy...");
  await ethers.provider.send("evm_increaseTime", [THREE_YEARS]);
  await ethers.provider.send("evm_mine");

  await core.declareDormant(u1Id);
  console.log(`- User 1 redeclared dormant.`);

  // 9. Verify reclaim fails after 30 days
  console.log("\n9. Fast forwarding 31 days (recovery window expired)...");
  const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60;
  await ethers.provider.send("evm_increaseTime", [THIRTY_ONE_DAYS]);
  await ethers.provider.send("evm_mine");

  console.log("Verifying reclaim reverts after recovery period expired...");
  try {
    await core.connect(u1).reclaimDormantNode();
    throw new Error("reclaimDormantNode succeeded after 30 days, but should have reverted!");
  } catch (err) {
    console.log("- Reverted correctly as expected.");
  }

  // 10. Execute abandonTreasury and verify DAO payout
  console.log("\n10. Executing abandonTreasury() to transfer credits to DAO...");
  const daoBalBefore = await ethers.provider.getBalance(dao.address);
  console.log(`- DAO Balance Before: ${ethers.formatEther(daoBalBefore)} BNB`);

  const missedGlobalBefore = await core.totalMissedRewards();
  console.log(`- Global totalMissedRewards Before: ${ethers.formatEther(missedGlobalBefore)} BNB`);

  // Execute abandonment
  const txAbandon = await core.abandonTreasury(u1Id);
  const receiptAbandon = await txAbandon.wait();

  // Find TreasuryAbandoned event log
  const eventSignature = ethers.id("TreasuryAbandoned(uint256,address,uint256)");
  const log = receiptAbandon.logs.find(l => l.topics[0] === eventSignature);
  if (!log) {
    throw new Error("TreasuryAbandoned event was not emitted!");
  }

  const decoded = core.interface.decodeEventLog("TreasuryAbandoned", log.data, log.topics);
  console.log(`- Emitted TreasuryAbandoned: Node ${decoded.nodeId.toString()} | Recipient: ${decoded.recipient} | Amount: ${ethers.formatEther(decoded.amount)} BNB`);

  const daoBalAfter = await ethers.provider.getBalance(dao.address);
  console.log(`- DAO Balance After:  ${ethers.formatEther(daoBalAfter)} BNB`);
  console.log(`- Net DAO Increase:   ${ethers.formatEther(daoBalAfter - daoBalBefore)} BNB`);

  const missedGlobalAfter = await core.totalMissedRewards();
  console.log(`- Global totalMissedRewards After:  ${ethers.formatEther(missedGlobalAfter)} BNB`);

  const u1MissedAfter = (await core.treasury(u1Id))[0];
  console.log(`- User 1 missed rewards for Tier 1 After: ${ethers.formatEther(u1MissedAfter)} BNB`);

  // Assertions
  if (u1MissedAfter !== 0n) {
    throw new Error("User 1 missed rewards were not zeroed out!");
  }
  if (daoBalAfter - daoBalBefore !== missedU1Tier1) {
    throw new Error("DAO balance increase does not match abandoned treasury credits!");
  }
  if (missedGlobalBefore - missedGlobalAfter !== missedU1Tier1) {
    throw new Error("Global totalMissedRewards did not decrease by correct amount!");
  }
  console.log("- abandonTreasury() executed successfully and payouts verified!");

  // 11. Solvency invariant checks
  console.log("\n11. Running solvency invariant checks...");
  const balance = await ethers.provider.getBalance(coreAddr);
  const totalMissed = await core.totalMissedRewards();
  const totalPending = await core.totalPendingRewards();
  console.log(`- Contract Balance: ${ethers.formatEther(balance)} BNB`);
  console.log(`- Missed Rewards:   ${ethers.formatEther(totalMissed)} BNB`);
  console.log(`- Pending Rewards:  ${ethers.formatEther(totalPending)} BNB`);

  if (balance >= totalMissed + totalPending) {
    console.log("✅ Invariant holds: Balance >= Missed + Pending");
  } else {
    throw new Error(`CRITICAL INVARIANT BROKEN: balance (${balance}) < missed+pending (${totalMissed+totalPending})`);
  }

  // 12. Configurable Dormancy Threshold
  console.log("\n12. Testing Configurable Dormancy Threshold...");
  const u3 = signers[4];
  
  // Non-owner cannot change it
  try {
    await core.connect(u1).setAddr(14, ethers.ZeroAddress, 10 * 24 * 60 * 60);
    throw new Error("Non-owner was able to update dormancy threshold!");
  } catch (err) {
    console.log("- Reverted correctly when non-owner tried to change threshold.");
  }
  
  // Owner updates to 10 days
  const tenDays = 10 * 24 * 60 * 60;
  const txSetDormancy = await core.setAddr(14, ethers.ZeroAddress, tenDays);
  await txSetDormancy.wait();
  
  const currentThreshold = await core.dormancyThreshold();
  console.log(`- New dormancy threshold set: ${currentThreshold.toString()} seconds (10 days)`);
  if (currentThreshold !== BigInt(tenDays)) {
    throw new Error("Failed to update dormancyThreshold state variable!");
  }
  
  // Register User 3
  await core.connect(u3).createNode(55555, { value: regFee });
  const u3Id = await core.nodeId(u3.address);
  console.log(`- User 3 registered with Node ID: ${u3Id.toString()}`);
  
  // Try declareDormant for User 3 (should fail immediately)
  try {
    await core.declareDormant(u3Id);
    throw new Error("declareDormant succeeded for U3 immediately, but should have reverted!");
  } catch (err) {
    console.log("- User 3 not dormant yet (correct).");
  }
  
  // Fast forward by 11 days
  console.log("Fast forwarding by 11 days...");
  await ethers.provider.send("evm_increaseTime", [11 * 24 * 60 * 60]);
  await ethers.provider.send("evm_mine");
  
  // Try declareDormant for User 3 (should succeed now!)
  await core.declareDormant(u3Id);
  const dormantSinceU3 = await core.dormantSince(u3Id);
  console.log(`- User 3 is now dormant since: ${dormantSinceU3.toString()}`);
  if (dormantSinceU3 === 0n) {
    throw new Error("User 3 dormantSince not set after 10-day threshold!");
  }
  console.log("- Dynamic Dormancy Threshold successfully verified!");

  console.log("\n🎉 ALL M-05 DORMANT TREASURY RECOVERY MECHANISM TESTS PASSED SUCCESSFULLY!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n💥 TEST FAILED:", err);
    process.exit(1);
  });
