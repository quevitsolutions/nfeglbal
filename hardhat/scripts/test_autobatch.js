const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("==========================================================");
  console.log("             TESTING CONFIGURABLE AUTO-BATCH");
  console.log("==========================================================\n");

  const signers = await ethers.getSigners();
  const owner = signers[0];
  const u1 = signers[1];
  const u2 = signers[2];
  const u3 = signers[3];
  const u4 = signers[4];
  const u5 = signers[5];
  const u6 = signers[6];

  // Deploy mock price oracle
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  await oracle.setPrice(600n * 100000000n); // $600 BNB price

  // Deploy views library
  const ViewsFactory = await ethers.getContractFactory("nfeglobalViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();

  // Deploy Core
  const CoreFactory = await ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: viewsAddr },
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
  const coreAddr = await core.getAddress();

  // Deploy RewardPool
  const PoolFactory = await ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555n);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();

  // Link components
  await core.setAddr(1, poolAddr, 0);
  await core.setAddr(11, oracleAddr, 0);
  await core.setPriceBounds(100n * 100000000n, 10000n * 100000000n);

  console.log("Contracts deployed and configured.");

  // Fund users
  const fundAmount = ethers.parseEther("200");
  await ethers.provider.send("hardhat_setBalance", [u1.address, ethers.toBeHex(fundAmount)]);
  await ethers.provider.send("hardhat_setBalance", [u2.address, ethers.toBeHex(fundAmount)]);
  await ethers.provider.send("hardhat_setBalance", [u3.address, ethers.toBeHex(fundAmount)]);
  await ethers.provider.send("hardhat_setBalance", [u4.address, ethers.toBeHex(fundAmount)]);
  await ethers.provider.send("hardhat_setBalance", [u5.address, ethers.toBeHex(fundAmount)]);
  await ethers.provider.send("hardhat_setBalance", [u6.address, ethers.toBeHex(fundAmount)]);

  // --- 1. Verify Default Value ---
  const defaultBatch = await core.autoBatch();
  console.log(`Initial autoBatch: ${defaultBatch.toString()} (Expected: 1)`);
  if (defaultBatch !== 1n) throw new Error("Default autoBatch should be 1");

  // --- 2. Verify setAutoBatch Bounds & Reverts ---
  console.log("\nChecking boundaries and access restrictions...");

  // Non-owner should revert
  try {
    await core.connect(u1).setAutoBatch(5);
    throw new Error("Non-owner was able to call setAutoBatch!");
  } catch (err) {
    if (err.message.includes("Non-owner was able")) throw err;
    console.log("✅ Reverted correctly on non-owner call.");
  }

  // Value 0 should revert
  try {
    await core.setAutoBatch(0);
    throw new Error("Batch of 0 was allowed!");
  } catch (err) {
    if (err.message.includes("Batch of 0 was allowed")) throw err;
    console.log("✅ Reverted correctly on 0 batch size.");
  }

  // Value 51 should revert
  try {
    await core.setAutoBatch(51);
    throw new Error("Batch of 51 was allowed!");
  } catch (err) {
    if (err.message.includes("Batch of 51 was allowed")) throw err;
    console.log("✅ Reverted correctly on >50 batch size.");
  }

  // --- 3. Verify Success and Event Emission ---
  const tx = await core.setAutoBatch(5);
  const receipt = await tx.wait();
  const updatedBatch = await core.autoBatch();
  console.log(`Updated autoBatch: ${updatedBatch.toString()} (Expected: 5)`);
  if (updatedBatch !== 5n) throw new Error("autoBatch should be 5");

  // Check event in logs
  let eventFound = false;
  for (const log of receipt.logs) {
    try {
      const parsedLog = core.interface.parseLog(log);
      if (parsedLog && parsedLog.name === "AutoBatchUpdated") {
        console.log(`✅ Event AutoBatchUpdated emitted with value: ${parsedLog.args.newBatch.toString()}`);
        eventFound = true;
      }
    } catch (_) {}
  }
  if (!eventFound) throw new Error("AutoBatchUpdated event not found in transaction logs!");

  // --- 4. Verify Batch Processing Size behavior ---
  console.log("\nVerifying batch queue behavior...");

  // Set autoBatch to 1 so that upgrades do not process the entire queue in the same transaction
  await core.setAutoBatch(1);

  // Register nodes
  const regFee = await core.getTierCost(0);
  const tierCost = await core.getTierCost(1);

  // Register three sponsor nodes under Genesis
  await core.connect(u1).createNode(55555, { value: regFee });
  const u1Id = await core.nodeId(u1.address);
  await core.connect(u1).unlockTier(u1Id, 1, { value: tierCost });

  await core.connect(u2).createNode(55555, { value: regFee });
  const u2Id = await core.nodeId(u2.address);
  await core.connect(u2).unlockTier(u2Id, 1, { value: tierCost });

  await core.connect(u3).createNode(55555, { value: regFee });
  const u3Id = await core.nodeId(u3.address);
  await core.connect(u3).unlockTier(u3Id, 1, { value: tierCost });

  // Now register one child node under each to generate missed rewards and enqueue the sponsors
  // U4 under U1
  await core.connect(u4).createNode(u1Id, { value: regFee });
  const u4Id = await core.nodeId(u4.address);
  await core.connect(u4).unlockTier(u4Id, 14, { value: await core.getUpgradeCost(0, 14) }); // triggers missed rewards on U1

  // U5 under U2
  await core.connect(u5).createNode(u2Id, { value: regFee });
  const u5Id = await core.nodeId(u5.address);
  await core.connect(u5).unlockTier(u5Id, 14, { value: await core.getUpgradeCost(0, 14) }); // triggers missed rewards on U2

  // U6 under U3
  await core.connect(u6).createNode(u3Id, { value: regFee });
  const u6Id = await core.nodeId(u6.address);
  await core.connect(u6).unlockTier(u6Id, 14, { value: await core.getUpgradeCost(0, 14) }); // triggers missed rewards on U3

  // Verify that all 3 sponsors are enqueued
  const u1NodeObj = await core.getNode(u1Id);
  const u2NodeObj = await core.getNode(u2Id);
  const u3NodeObj = await core.getNode(u3Id);
  const u1Treasury = await core.treasuryBalance(u1Id);
  const u2Treasury = await core.treasuryBalance(u2Id);
  const u3Treasury = await core.treasuryBalance(u3Id);
  
  console.log(`U1 Tier: ${u1NodeObj.tier.toString()}, Treasury: ${ethers.formatEther(u1Treasury)} BNB`);
  console.log(`U2 Tier: ${u2NodeObj.tier.toString()}, Treasury: ${ethers.formatEther(u2Treasury)} BNB`);
  console.log(`U3 Tier: ${u3NodeObj.tier.toString()}, Treasury: ${ethers.formatEther(u3Treasury)} BNB`);

  const u1Enqueued = await core.inTreasuryQueue(u1Id);
  const u2Enqueued = await core.inTreasuryQueue(u2Id);
  const u3Enqueued = await core.inTreasuryQueue(u3Id);

  console.log(`U1 Enqueued: ${u1Enqueued.toString()}, U2 Enqueued: ${u2Enqueued.toString()}, U3 Enqueued: ${u3Enqueued.toString()}`);
  if (!u1Enqueued || !u2Enqueued || !u3Enqueued) throw new Error("Sponsor nodes must be enqueued!");

  const qHeadBefore = await core.queueHead();
  const qTailBefore = await core.queueTail();
  console.log(`Queue size: ${Number(qTailBefore - qHeadBefore)} (Expected: 3)`);

  // Let's set autoBatch back to 1 temporarily to test processing only 1 item
  await core.setAutoBatch(1);
  console.log("Set autoBatch back to 1. Processing queue...");
  await core.processTreasuryQueue();

  const qHeadAfter1 = await core.queueHead();
  console.log(`QueueHead after 1-batch processing: ${qHeadAfter1.toString()} (Expected increment of 1: ${Number(qHeadBefore + 1n)})`);
  if (qHeadAfter1 !== qHeadBefore + 1n) throw new Error("Batch processing should have only processed 1 item!");

  // Now set autoBatch to 5 and process the remaining 2 enqueued items in a single run
  await core.setAutoBatch(5);
  console.log("Set autoBatch to 5. Processing queue...");
  await core.processTreasuryQueue();

  const qHeadAfter2 = await core.queueHead();
  console.log(`QueueHead after 5-batch processing: ${qHeadAfter2.toString()} (Expected to reach or exceed initial tail: ${qTailBefore.toString()})`);
  if (qHeadAfter2 < qTailBefore) throw new Error("Batch processing should have cleared the initial queue!");

  console.log("\n==========================================================");
  console.log("        CONFIGURABLE AUTO-BATCH TESTS PASSED SUCCESS!");
  console.log("==========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
