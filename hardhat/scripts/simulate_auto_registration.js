const hre = require("hardhat");

async function main() {
  console.log("===============================================================");
  console.log("SIMULATING AUTOMATIC REWARD POOL REGISTRATION & ENROLLMENT");
  console.log("===============================================================");

  // 1. Deploy contracts
  console.log("\n1. Deploying Smart Contracts...");
  const OracleFactory = await hre.ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  console.log(`- BNBPriceOracle deployed to: ${await oracle.getAddress()}`);

  const ViewsFactory = await hre.ethers.getContractFactory("nfeglobalViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  console.log(`- nfeglobalViews library deployed to: ${await views.getAddress()}`);

  const CoreFactory = await hre.ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: await views.getAddress() },
  });
  const signers = await hre.ethers.getSigners();
  const owner = signers[0];
  const user = signers[1];

  const core = await CoreFactory.deploy(
    owner.address,
    owner.address,
    hre.ethers.ZeroAddress,
    owner.address,
    owner.address,
    owner.address
  );
  await core.waitForDeployment();
  console.log(`- nfeglobal Core deployed to: ${await core.getAddress()}`);

  const PoolFactory = await hre.ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(
    await core.getAddress(),
    owner.address,
    55555n
  );
  await pool.waitForDeployment();
  console.log(`- RewardPool deployed to: ${await pool.getAddress()}`);

  // 2. Setup connections
  console.log("\n2. Linking Contracts & Configuring Parameters...");
  await core.setAddr(1, await pool.getAddress(), 0); // link RewardPool
  await core.setAddr(11, await oracle.getAddress(), 0); // link Oracle
  await oracle.setPrice(600n * 100000000n); // Set BNB price to $600
  await core.setPriceBounds(100n * 100000000n, 10000000n * 100000000n);
  
  // Set Bronze Pool requirements: Tier >= 6, Directs = 0, Team = 0
  await pool.setPoolTierThreshold("BRONZE_TIER", 6n);
  await pool.setPoolDirectReq("BRONZE_DIRECT", 0n);
  await pool.setPoolTeamReq("BRONZE_TEAM", 0n);
  console.log("Configured Bronze Pool: Tier >= 6, Directs >= 0, Team >= 0");

  // 3. Register Node
  console.log("\n3. Creating Node #55556...");
  const regFee = await core.getRegistrationFee();
  await core.connect(user).createNode(55555, { value: regFee });
  const nodeId = await core.nodeId(user.address);
  console.log(`- User registered successfully. Node ID: ${nodeId.toString()}`);

  let currentPool = await pool.nodePool(nodeId);
  console.log(`- Initial Pool ID in RewardPool: ${currentPool.toString()} (Expected: 0)`);
  if (currentPool === 0n) {
    console.log("✅ Correct. Tier 0 node is not registered in the RewardPool.");
  } else {
    throw new Error("Incorrect initial pool.");
  }

  // 4. Upgrade Node through Tiers 1 to 5
  console.log("\n4. Upgrading Node from Tier 0 to Tier 5...");
  for (let t = 1; t <= 5; t++) {
    const cost = await core.getTierCost(t - 1);
    await core.connect(user).unlockTier(nodeId, t, { value: cost });
    
    // Check pool status
    currentPool = await pool.nodePool(nodeId);
    console.log(`- Upgraded to Tier ${t}. RewardPool ID: ${currentPool.toString()} (Expected: 0)`);
    if (currentPool !== 0n) {
      throw new Error(`Incorrect pool ID at Tier ${t}`);
    }
  }
  console.log("✅ Correct. Upgrades below Tier 6 did not trigger pool enrollment (reverts bypassed safely).");

  // 5. Upgrade Node to Tier 6 (Automatic Pool Registration Trigger)
  console.log("\n5. Upgrading Node to Tier 6...");
  const costTier6 = await core.getTierCost(5);
  
  // Measure gas used for the automatic registration trigger upgrade transaction
  const tx = await core.connect(user).unlockTier(nodeId, 6, { value: costTier6 });
  const receipt = await tx.wait();
  
  console.log(`- Upgrade transaction executed successfully. Gas used: ${receipt.gasUsed.toString()} units.`);

  // Verify pool membership
  currentPool = await pool.nodePool(nodeId);
  console.log(`- RewardPool ID after Tier 6 upgrade: ${currentPool.toString()} (Expected: 1)`);
  if (currentPool === 1n) {
    console.log("🎉 SUCCESS! Node 55556 was AUTOMATICALLY registered into the Bronze RewardPool (ID 1) during the upgrade transaction!");
  } else {
    throw new Error("AUTOMATIC REGISTRATION FAILED: Node not in Bronze RewardPool.");
  }

  console.log("\nSimulation Completed Successfully! ✨");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Simulation Failed:", error);
    process.exit(1);
  });
