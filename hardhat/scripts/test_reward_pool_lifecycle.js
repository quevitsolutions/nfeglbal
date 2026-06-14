const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("==========================================================");
  console.log("  REWARD POOL LIFECYCLE: 3x, 10x, 25x PRODUCTION CAPS");
  console.log("==========================================================\n");

  const signers = await ethers.getSigners();
  const owner = signers[0];
  const userA = signers[1];
  
  // Deploy price oracle
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  await oracle.setPrice(600n * 100000000n); // $600 BNB price

  // Deploy Views
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
  //genesisNodeId = 55555n
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555n);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();

  // Link components
  await core.setAddr(1, poolAddr, 0);
  await core.setAddr(11, oracleAddr, 0);
  await core.setPriceBounds(100n * 100000000n, 10000n * 100000000n);
  console.log("Deployed and configured contracts.\n");

  // Adjust team requirement to 1 to simplify test tree
  await pool.setPoolTeamReq("BRONZE_TEAM", 1);
  await pool.setPoolTeamReq("SILVER_TEAM", 1);
  await pool.setPoolTeamReq("GOLD_TEAM", 1);
  console.log("Lowered team size requirements to 1.\n");

  // Fund userA and registrations
  const hugeBnbHex = "0x" + (50000n * 10n**18n).toString(16); // 50,000 BNB
  await ethers.provider.send("hardhat_setBalance", [userA.address, hugeBnbHex]);
  await ethers.provider.send("hardhat_setBalance", [owner.address, hugeBnbHex]);

  // Register User A (Node 55556)
  const regFee = await core.getTierCost(0);
  await core.connect(userA).createNode(55555n, { value: regFee });
  const nodeIdA = 55556n;
  console.log(`User A registered with Node ID: ${nodeIdA.toString()}`);

  // Register 10 directs under User A so directs qualification is met for Gold (needs 10 directs)
  console.log("Registering 10 direct referrals under User A (Node 55556)...");
  for (let i = 0; i < 10; i++) {
    const tempW = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, ethers.provider);
    await ethers.provider.send("hardhat_setBalance", [tempW.address, hugeBnbHex]);
    await core.connect(tempW).createNode(nodeIdA, { value: regFee });
  }
  
  let qual = await pool.getQualificationStatus(nodeIdA);
  console.log(`Direct Referrals count: ${qual.directRefs.toString()}\n`);

  // --- Test 1: Transition Unregistered -> Bronze (3x Cap) & Auto-Exit ---
  console.log("--- Test 1: Bronze Pool (3x Cap) Registration and Auto-Exit ---");
  console.log("Upgrading User A to Tier 6...");
  const costTo6 = await core.getUpgradeCost(0, 6); // upgrade 6 levels (to 6)
  await core.connect(userA).unlockTier(nodeIdA, 6, { value: costTo6 });

  console.log("Registering in RewardPool...");
  await pool.connect(userA).registerNode(nodeIdA);
  let curPool = await pool.nodePool(nodeIdA);
  console.log(`User A Pool ID: ${curPool.toString()} (Expected: 1 = Bronze)`);
  if (curPool !== 1n) throw new Error("Should be in Bronze pool!");

  let capInfo = await pool.getCapInfo(nodeIdA);
  console.log(`Bronze Cap Multiplier: ${capInfo.capMultiplier.toString()}x`);
  console.log(`User A total contribution (deposit): ${ethers.formatEther(capInfo.totalDeposited)} BNB`);
  console.log(`User A lifetime earnings cap:        ${ethers.formatEther(capInfo.lifetimeCap)} BNB`);

  // Send 50 BNB inflow to RewardPool. Bronze share (30%) is 15 BNB, exceeding the 3x cap (approx 3 BNB)
  console.log("Depositing 50 BNB inflow to RewardPool...");
  await owner.sendTransaction({
    to: poolAddr,
    value: ethers.parseEther("50.0")
  });

  let claimable = await pool.getClaimable(nodeIdA);
  console.log(`User A Claimable (raw Bronze): ${ethers.formatEther(claimable.total)} BNB (Capped to ${ethers.formatEther(capInfo.lifetimeCap)} BNB)`);

  console.log("Claiming Bronze rewards...");
  await pool.connect(userA).claim(nodeIdA);
  let totalClaimed = await pool.totalClaimed(nodeIdA);
  console.log(`User A total claimed: ${ethers.formatEther(totalClaimed)} BNB`);

  curPool = await pool.nodePool(nodeIdA);
  console.log(`User A Pool ID after claim: ${curPool.toString()} (Expected: 0 = Exited)`);
  if (curPool !== 0n) throw new Error("Node should have exited Bronze pool!");

  console.log("Verifying further claims revert...");
  try {
    await pool.connect(userA).claim(nodeIdA);
    throw new Error("Claim succeeded but should have reverted!");
  } catch (err) {
    console.log(`- Claim reverted correctly: ${err.message}`);
  }


  // --- Test 2: Transition Exited -> Silver (10x Cap) ---
  console.log("\n--- Test 2: Transitioning Exited -> Silver Pool (10x Cap) ---");
  console.log("Upgrading User A to Tier 10...");
  const costTo10 = await core.getUpgradeCost(6, 4); // upgrade 4 levels (to 10)
  await core.connect(userA).unlockTier(nodeIdA, 10, { value: costTo10 });

  console.log("Registering in RewardPool for Silver...");
  await pool.connect(userA).registerNode(nodeIdA);
  curPool = await pool.nodePool(nodeIdA);
  console.log(`User A Pool ID after transition: ${curPool.toString()} (Expected: 2 = Silver)`);
  if (curPool !== 2n) throw new Error("Should be in Silver pool!");

  capInfo = await pool.getCapInfo(nodeIdA);
  console.log(`Silver Cap Multiplier: ${capInfo.capMultiplier.toString()}x`);
  console.log(`User A total contribution (deposit): ${ethers.formatEther(capInfo.totalDeposited)} BNB`);
  console.log(`User A lifetime earnings cap:        ${ethers.formatEther(capInfo.lifetimeCap)} BNB`);
  console.log(`User A remaining cap capacity:       ${ethers.formatEther(capInfo.remaining)} BNB`);

  // Send 50 BNB inflow to RewardPool. Silver share (35%) is 17.5 BNB.
  // This is less than remaining capacity, so they should NOT exit.
  console.log("Depositing 50 BNB inflow to RewardPool...");
  await owner.sendTransaction({
    to: poolAddr,
    value: ethers.parseEther("50.0")
  });

  claimable = await pool.getClaimable(nodeIdA);
  console.log(`User A Claimable: ${ethers.formatEther(claimable.total)} BNB`);
  
  console.log("Claiming Silver rewards...");
  await pool.connect(userA).claim(nodeIdA);
  totalClaimed = await pool.totalClaimed(nodeIdA);
  console.log(`User A total claimed: ${ethers.formatEther(totalClaimed)} BNB`);

  curPool = await pool.nodePool(nodeIdA);
  console.log(`User A Pool ID after claim: ${curPool.toString()} (Expected: 2 = Still in Silver)`);
  if (curPool !== 2n) throw new Error("Node should still be in Silver pool!");


  // --- Test 3: Transition Silver -> Gold (25x Cap) & Auto-Exit ---
  console.log("\n--- Test 3: Transitioning Silver -> Gold Pool (25x Cap) and Auto-Exit ---");
  console.log("Upgrading User A to Tier 14...");
  const costTo14 = await core.getUpgradeCost(10, 4); // upgrade 4 levels (to 14)
  await core.connect(userA).unlockTier(nodeIdA, 14, { value: costTo14 });

  console.log("Registering in RewardPool for Gold...");
  await pool.connect(userA).registerNode(nodeIdA);
  curPool = await pool.nodePool(nodeIdA);
  console.log(`User A Pool ID after transition: ${curPool.toString()} (Expected: 3 = Gold)`);
  if (curPool !== 3n) throw new Error("Should be in Gold pool!");

  capInfo = await pool.getCapInfo(nodeIdA);
  console.log(`Gold Cap Multiplier: ${capInfo.capMultiplier.toString()}x`);
  console.log(`User A total contribution (deposit): ${ethers.formatEther(capInfo.totalDeposited)} BNB`);
  console.log(`User A lifetime earnings cap:        ${ethers.formatEther(capInfo.lifetimeCap)} BNB`);
  console.log(`User A remaining cap capacity:       ${ethers.formatEther(capInfo.remaining)} BNB`);

  // To trigger Gold auto-exit (cap ~ 1,700 BNB), we deposit 20,000 BNB inflow to RewardPool.
  // Gold share (35%) is 7,000 BNB. With 2 active Gold nodes, each gets 3,500 BNB, which exceeds the remaining cap.
  console.log("Depositing 20,000 BNB inflow to RewardPool...");
  const twentyFiveThousandBnbHex = "0x" + (25000n * 10n**18n).toString(16);
  await ethers.provider.send("hardhat_setBalance", [owner.address, twentyFiveThousandBnbHex]);
  await owner.sendTransaction({
    to: poolAddr,
    value: ethers.parseEther("20000.0")
  });

  claimable = await pool.getClaimable(nodeIdA);
  console.log(`User A Claimable: ${ethers.formatEther(claimable.total)} BNB`);

  console.log("Claiming Gold rewards...");
  await pool.connect(userA).claim(nodeIdA);
  totalClaimed = await pool.totalClaimed(nodeIdA);
  console.log(`User A total claimed: ${ethers.formatEther(totalClaimed)} BNB`);

  curPool = await pool.nodePool(nodeIdA);
  console.log(`User A Pool ID after claim: ${curPool.toString()} (Expected: 0 = Exited)`);
  if (curPool !== 0n) throw new Error("Node should have exited Gold pool!");


  // --- Test 4: Increase Deposit & Re-entry Cap Simulation ---
  console.log("\n--- Test 4: Deposit Increase and Pool Re-entry ---");
  console.log("Upgrading User A from Tier 14 to Tier 15 to increase deposit contribution...");
  const costTo15 = await core.getUpgradeCost(14, 1);
  await core.connect(userA).unlockTier(nodeIdA, 15, { value: costTo15 });

  console.log("Re-registering node in RewardPool...");
  await pool.connect(userA).registerNode(nodeIdA);
  curPool = await pool.nodePool(nodeIdA);
  console.log(`User A Pool ID after re-registration: ${curPool.toString()} (Expected: 3 = Gold)`);
  if (curPool !== 3n) throw new Error("Should have re-entered Gold pool!");

  capInfo = await pool.getCapInfo(nodeIdA);
  console.log(`User A new total contribution: ${ethers.formatEther(capInfo.totalDeposited)} BNB`);
  console.log(`User A new lifetime cap:        ${ethers.formatEther(capInfo.lifetimeCap)} BNB`);
  console.log(`User A total claimed so far:    ${ethers.formatEther(capInfo.claimed)} BNB`);
  console.log(`User A remaining cap capacity:  ${ethers.formatEther(capInfo.remaining)} BNB`);

  if (capInfo.remaining === 0n) {
    throw new Error("Remaining cap should be greater than zero after upgrade!");
  }

  console.log("Depositing more inflow to RewardPool...");
  await owner.sendTransaction({
    to: poolAddr,
    value: ethers.parseEther("100.0")
  });

  claimable = await pool.getClaimable(nodeIdA);
  console.log(`User A new Claimable: ${ethers.formatEther(claimable.total)} BNB`);

  console.log("Claiming new rewards...");
  const balBefore2 = await ethers.provider.getBalance(userA.address);
  await pool.connect(userA).claim(nodeIdA);
  const balAfter2 = await ethers.provider.getBalance(userA.address);
  const newTotalClaimed = await pool.totalClaimed(nodeIdA);

  console.log(`User A claimed (second run):    ${ethers.formatEther(balAfter2 - balBefore2)} BNB`);
  console.log(`User A total claimed overall:   ${ethers.formatEther(newTotalClaimed)} BNB`);

  console.log("\n==========================================================");
  console.log("     REWARD POOL LIFECYCLE SIMULATION COMPLETED SUCCESS!");
  console.log("==========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n💥 SIMULATION FAILED:", err);
    process.exit(1);
  });
