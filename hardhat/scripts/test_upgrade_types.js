const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("==========================================================");
  console.log("          SIMULATING ALL TIER UPGRADE PATHS");
  console.log("==========================================================\n");

  const signers = await ethers.getSigners();
  const owner = signers[0];
  const u1 = signers[1];
  const u2 = signers[2];
  const u3 = signers[3];
  const u4 = signers[4];
  
  // Deploy price oracle
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  await oracle.setPrice(600n * 100000000n); // $600 BNB price

  // Deploy Views
  const ViewsFactory = await ethers.getContractFactory("aipcoreViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();

  // Deploy Core
  const CoreFactory = await ethers.getContractFactory("aipcore", {
    libraries: { aipcoreViews: viewsAddr },
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
  console.log("Contracts deployed and configured.\n");

  // Fund users
  const fundAmount = "0x" + (100n * 10n**18n).toString(16); // 100 BNB
  await ethers.provider.send("hardhat_setBalance", [u1.address, fundAmount]);
  await ethers.provider.send("hardhat_setBalance", [u2.address, fundAmount]);
  await ethers.provider.send("hardhat_setBalance", [u3.address, fundAmount]);
  await ethers.provider.send("hardhat_setBalance", [u4.address, fundAmount]);

  const regFee = await core.getTierCost(0);

  // ------------------------------------------------------------------------
  // PATH 1: Manual Multi-Tier Upgrade (unlockTier)
  // ------------------------------------------------------------------------
  console.log("--- PATH 1: Manual Multi-Tier Upgrade (unlockTier) ---");
  await core.connect(u1).createNode(55555, { value: regFee });
  const u1Id = await core.nodeId(u1.address);
  await core.connect(u1).unlockTier(u1Id, 1, { value: await core.getUpgradeCost(0, 1) });
  console.log(`User 1 registered. Node ID: ${u1Id.toString()}, Initial Tier: 1`);

  // We want to upgrade User 1 from Tier 1 to Tier 5
  const costTo5 = await core.getUpgradeCost(1, 4); // 4 levels (to Tier 5)
  console.log(`Upgrade cost to Tier 5: ${ethers.formatEther(costTo5)} BNB`);

  const tx1 = await core.connect(u1).unlockTier(u1Id, 5, { value: costTo5 });
  await tx1.wait();
  
  let node1 = await core.getNode(u1Id);
  console.log(`User 1 Tier after unlockTier: ${node1.tier.toString()} (Expected: 5)`);
  if (node1.tier !== 5n) throw new Error("unlockTier failed!");
  console.log("PATH 1 Passed.\n");

  // ------------------------------------------------------------------------
  // PATH 2: Manual Single-Tier Upgrade (selfUpgrade)
  // ------------------------------------------------------------------------
  console.log("--- PATH 2: Manual Single-Tier Upgrade (selfUpgrade) ---");
  await core.connect(u2).createNode(55555, { value: regFee });
  const u2Id = await core.nodeId(u2.address);
  await core.connect(u2).unlockTier(u2Id, 1, { value: await core.getUpgradeCost(0, 1) });
  console.log(`User 2 registered. Node ID: ${u2Id.toString()}, Initial Tier: 1`);

  const costTo2 = await core.getTierCost(1); // Cost to upgrade Tier 1 -> 2
  console.log(`Upgrade cost to Tier 2: ${ethers.formatEther(costTo2)} BNB`);

  const tx2 = await core.connect(u2).selfUpgrade({ value: costTo2 });
  await tx2.wait();

  let node2 = await core.getNode(u2Id);
  console.log(`User 2 Tier after selfUpgrade: ${node2.tier.toString()} (Expected: 2)`);
  if (node2.tier !== 2n) throw new Error("selfUpgrade failed!");
  console.log("PATH 2 Passed.\n");

  // ------------------------------------------------------------------------
  // PATH 3: Automated Treasury-Funded Upgrade (processTreasuryQueue)
  // ------------------------------------------------------------------------
  console.log("--- PATH 3: Automated Treasury-Funded Upgrade (Queue) ---");
  // Register User 3 under User 2 (User 2 is Tier 2)
  await core.connect(u3).createNode(u2Id, { value: regFee });
  const u3Id = await core.nodeId(u3.address);
  await core.connect(u3).unlockTier(u3Id, 1, { value: await core.getUpgradeCost(0, 1) });
  console.log(`User 3 registered under User 2. Node ID: ${u3Id.toString()}, Tier: 1`);

  // Register User 4 under User 3 (User 3 is Tier 1)
  await core.connect(u4).createNode(u3Id, { value: regFee });
  const u4Id = await core.nodeId(u4.address);
  await core.connect(u4).unlockTier(u4Id, 1, { value: await core.getUpgradeCost(0, 1) });
  console.log(`User 4 registered under User 3. Node ID: ${u4Id.toString()}, Tier: 1`);

  // We upgrade User 4 to Tier 10. User 3 is Tier 1, so User 3 will miss the Tier 2 through Tier 10 layer rewards.
  // This will accumulate a large treasury balance in User 3 and trigger auto-enqueue.
  console.log("Upgrading User 4 to Tier 10...");
  const u4Cost = await core.getUpgradeCost(1, 9); // 9 levels (to Tier 10)
  await core.connect(u4).unlockTier(u4Id, 10, { value: u4Cost });

  const u3Treasury = await core.treasuryBalance(u3Id);
  const u3InQueue = await core.inTreasuryQueue(u3Id);
  console.log(`User 3 Treasury Balance: ${ethers.formatEther(u3Treasury)} BNB`);
  console.log(`User 3 In Queue Status:  ${u3InQueue.toString()} (Expected: true)`);
  if (!u3InQueue) throw new Error("User 3 should be enqueued!");

  // Call processTreasuryQueue. This should upgrade User 3 from Tier 1 -> Tier 2.
  console.log("Processing treasury queue...");
  await core.processTreasuryQueue();

  let node3 = await core.getNode(u3Id);
  let u3TreasuryAfter = await core.treasuryBalance(u3Id);
  let u3InQueueAfter = await core.inTreasuryQueue(u3Id);
  console.log(`User 3 Tier after queue run:      ${node3.tier.toString()} (Expected: 2)`);
  console.log(`User 3 Treasury Balance remaining: ${ethers.formatEther(u3TreasuryAfter)} BNB`);
  console.log(`User 3 In Queue Status remaining:  ${u3InQueueAfter.toString()}`);
  if (node3.tier !== 2n) throw new Error("Queue auto-upgrade failed!");
  console.log("PATH 3 Passed.\n");

  // ------------------------------------------------------------------------
  // PATH 4: Discounted Manual Upgrade (Treasury + Wallet Funds)
  // ------------------------------------------------------------------------
  console.log("--- PATH 4: Discounted Manual Upgrade (Treasury + Wallet) ---");
  // User 3 is Tier 2, wants to upgrade to Tier 3.
  const costTo3 = await core.getTierCost(2); // cost to upgrade from Tier 2 -> 3
  console.log(`Cost to upgrade to Tier 3: ${ethers.formatEther(costTo3)} BNB`);
  
  const u3TreasuryBeforeUpgrade = u3TreasuryAfter;
  console.log(`User 3 Treasury Balance:   ${ethers.formatEther(u3TreasuryBeforeUpgrade)} BNB`);

  // The required wallet contribution is costTo3 - u3TreasuryBeforeUpgrade.
  const neededBnb = costTo3 > u3TreasuryBeforeUpgrade ? costTo3 - u3TreasuryBeforeUpgrade : 0n;
  console.log(`Required BNB to send from wallet: ${ethers.formatEther(neededBnb)} BNB`);

  const walletBalBefore = await ethers.provider.getBalance(u3.address);
  // Call selfUpgrade and send exactly neededBnb (plus gas)
  const tx4 = await core.connect(u3).selfUpgrade({ value: neededBnb });
  await tx4.wait();
  const walletBalAfter = await ethers.provider.getBalance(u3.address);

  node3 = await core.getNode(u3Id);
  u3TreasuryAfter = await core.treasuryBalance(u3Id);
  const expectedTreasuryAfter = u3TreasuryBeforeUpgrade > costTo3 ? u3TreasuryBeforeUpgrade - costTo3 : 0n;
  
  console.log(`User 3 Tier after selfUpgrade:    ${node3.tier.toString()} (Expected: 3)`);
  console.log(`User 3 Treasury Balance after:    ${ethers.formatEther(u3TreasuryAfter)} BNB (Expected: ${ethers.formatEther(expectedTreasuryAfter)})`);
  
  // Wallet balance decrease should be approximately neededBnb (excluding gas fee)
  const actualSent = walletBalBefore - walletBalAfter;
  console.log(`Actual wallet balance reduction:  ${ethers.formatEther(actualSent)} BNB`);
  
  if (node3.tier !== 3n || u3TreasuryAfter !== expectedTreasuryAfter) {
    throw new Error("Discounted manual upgrade failed!");
  }
  console.log("PATH 4 Passed.\n");

  console.log("==========================================================");
  console.log("     ALL TIER UPGRADE PATH SIMULATIONS COMPLETED!");
  console.log("==========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n💥 SIMULATION FAILED:", err);
    process.exit(1);
  });
