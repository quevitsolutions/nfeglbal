const { ethers } = require("hardhat");

async function main() {
  const [owner, feeRec, devEOA] = await ethers.getSigners();
  const tenBnbHex = ethers.toBeHex(ethers.parseEther("10"));

  console.log("==========================================================");
  console.log("       STARTING 500-USER SYSTEM-WIDE SIMULATION (v3.0)   ");
  console.log("==========================================================");

  // --- Step 1: Deploy & Link All Contracts ---
  console.log("\n--- Step 1: Deploying & Linking Contracts ---");

  // Deploy Mock Oracle
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log(`- BNBPriceOracle: ${oracleAddr}`);

  // Deploy Views Library
  const ViewsFactory = await ethers.getContractFactory("aipcoreViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();
  console.log(`- Views Library: ${viewsAddr}`);

  // Deploy Core Contract
  const CoreFactory = await ethers.getContractFactory("aipcore", {
    libraries: { aipcoreViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    owner.address, // firstUser (Genesis)
    feeRec.address, // temporary EOA feeReceiver
    ethers.ZeroAddress, // rewardPool (linked later)
    owner.address, // owner
    owner.address, // oracleAdmin
    owner.address  // matrixAdmin
  );
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();
  console.log(`- Core Contract: ${coreAddr}`);

  // Deploy AIPCoreViewsContract and link it in Core
  const AIPCoreViewsContractFactory = await ethers.getContractFactory("AIPCoreViewsContract");
  const viewsContract = await AIPCoreViewsContractFactory.deploy();
  await viewsContract.waitForDeployment();
  await core.setViewsContract(await viewsContract.getAddress());
  console.log(`- Views Contract: ${await viewsContract.getAddress()}`);

  // Deploy RewardPool
  const PoolFactory = await ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555n);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`- RewardPool: ${poolAddr}`);

  // Deploy RewardPoolLeadership
  const LeadershipFactory = await ethers.getContractFactory("RewardPoolLeadership");
  const leadership = await LeadershipFactory.deploy(
    coreAddr,
    poolAddr,
    devEOA.address, // Fee receiver wallet (development share)
    owner.address
  );
  await leadership.waitForDeployment();
  const leadershipAddr = await leadership.getAddress();
  console.log(`- RewardPoolLeadership: ${leadershipAddr}`);

  // Deploy FounderPool
  const FounderPoolFactory = await ethers.getContractFactory("FounderPool");
  const founderPool = await FounderPoolFactory.deploy(
    coreAddr,
    poolAddr,
    devEOA.address
  );
  await founderPool.waitForDeployment();
  const founderPoolAddr = await founderPool.getAddress();
  console.log(`- FounderPool: ${founderPoolAddr}`);

  // Deploy LeaderboardPool
  const LeaderboardPoolFactory = await ethers.getContractFactory("LeaderboardPool");
  const leaderboardPool = await LeaderboardPoolFactory.deploy(
    coreAddr,
    leadershipAddr,
    devEOA.address
  );
  await leaderboardPool.waitForDeployment();
  const leaderboardPoolAddr = await leaderboardPool.getAddress();
  console.log(`- LeaderboardPool: ${leaderboardPoolAddr}`);

  // Establish Connections & Config
  await core.setAddr(0, feeRec.address, 0); // Keep feeReceiver in Core as EOA feeRec for safe fee capturing
  await core.setAddr(1, poolAddr, 0); // Link RewardPool in Core
  await core.setAddr(11, oracleAddr, 0); // Link Price Oracle in Core
  await core.setPriceBounds(100n * 100000000n, 10000000n * 100000000n); // Set price bounds
  await oracle.setPrice(300n * 100000000n); // Set BNB price to $300

  // Connect RewardPool to RewardPoolLeadership
  await pool.setLeadershipEngine(leadershipAddr);

  // Link pools in Core
  await core.setFounderPool(founderPoolAddr);
  await core.setLeaderboardPool(leaderboardPoolAddr);

  // Link pools in RewardPoolLeadership
  await leadership.setFounderPool(founderPoolAddr);
  await leadership.setLeaderboardPool(leaderboardPoolAddr);

  // Set pool requirements for testing active ranks early on
  await pool.connect(owner).setPoolTierThreshold("BRONZE_TIER", 1);
  await pool.connect(owner).setPoolDirectReq("BRONZE_DIRECT", 0);
  await pool.connect(owner).setPoolTeamReq("BRONZE_TEAM", 0);

  console.log("✅ Successfully deployed, linked, and configured all contracts.");

  // Solvency Invariant Checker
  async function checkSolvency(milestone) {
    const coreBal = await ethers.provider.getBalance(coreAddr);
    const poolBal = await ethers.provider.getBalance(poolAddr);
    const leadershipBal = await ethers.provider.getBalance(leadershipAddr);
    const founderPoolBal = await ethers.provider.getBalance(founderPoolAddr);
    const leaderboardPoolBal = await ethers.provider.getBalance(leaderboardPoolAddr);

    const totalTreasury = await core.totalTreasuryBalance();
    const totalPending = await core.totalPendingRewards();
    const totalLiabilities = totalTreasury + totalPending;

    console.log(`\n[Solvency & Balance Audit - ${milestone}]`);
    console.log(`  - Core Contract Balance    : ${ethers.formatEther(coreBal)} BNB`);
    console.log(`  - Core Total Liabilities   : ${ethers.formatEther(totalLiabilities)} BNB (Treasury: ${ethers.formatEther(totalTreasury)} + Pending: ${ethers.formatEther(totalPending)})`);
    console.log(`  - RewardPool Balance       : ${ethers.formatEther(poolBal)} BNB`);
    console.log(`  - Leadership Contract Bal  : ${ethers.formatEther(leadershipBal)} BNB`);
    console.log(`  - FounderPool Balance      : ${ethers.formatEther(founderPoolBal)} BNB`);
    console.log(`  - LeaderboardPool Balance  : ${ethers.formatEther(leaderboardPoolBal)} BNB`);

    if (coreBal < totalLiabilities) {
      throw new Error(`CRITICAL: Core contract balance (${ethers.formatEther(coreBal)} BNB) is less than total liabilities (${ethers.formatEther(totalLiabilities)} BNB)!`);
    }
    console.log("  ✅ Solvency Check PASSED.");
  }

  await checkSolvency("Initial Deploy");

  // --- Step 2: Generate & Fund 500 Wallets ---
  console.log("\n--- Step 2: Generating & Funding 500 Wallets ---");
  const wallets = [];
  const walletCount = 500;
  for (let i = 0; i < walletCount; i++) {
    const rWallet = ethers.Wallet.createRandom();
    const wallet = new ethers.Wallet(rWallet.privateKey, ethers.provider);
    wallets.push(wallet);
  }

  // Batch fund wallets with 10 BNB each
  const batchSize = 100;
  for (let i = 0; i < walletCount; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    await Promise.all(
      batch.map(w =>
        ethers.provider.send("hardhat_setBalance", [w.address, tenBnbHex])
      )
    );
  }
  console.log(`✅ Successfully generated and funded ${walletCount} user wallets.`);

  // --- Step 3: Register 500 Users with Randomized Sponsors ---
  console.log("\n--- Step 3: Registering 500 Users ---");
  const regFee = await core.getRegistrationFee();
  
  // Register first user under Genesis (55555) to start the chain
  await core.connect(wallets[0]).createNode(55555n, { value: regFee });
  const genesisNodeId = 55555n;
  const user1NodeId = await core.nodeId(wallets[0].address);
  console.log(`- Registered User 0 under Genesis. Node ID: ${user1NodeId.toString()}`);

  const registeredNodeIds = [user1NodeId];
  const registeredWallets = [wallets[0]];

  // We want to set up specific sponsors to satisfy Starter Builder (Pool 3) and Conversion Builder (Pool 4)
  // Sponsor A (user1NodeId) will sponsor 10 referrals that immediately upgrade to Tier 1 (qualifying Sponsor A for Pool 3)
  // Sponsor B (node at index 1) will sponsor 10 referrals that we register and upgrade later (qualifying Sponsor B for Pool 4)
  
  // Sponsor A direct registrations (10 referrals)
  const sponsorA = user1NodeId;
  const sponsorAWallets = [];
  const sponsorANodeIds = [];
  for (let i = 1; i <= 10; i++) {
    const userWallet = wallets[i];
    await core.connect(userWallet).createNode(sponsorA, { value: regFee });
    const uId = await core.nodeId(userWallet.address);
    registeredNodeIds.push(uId);
    registeredWallets.push(userWallet);
    sponsorAWallets.push(userWallet);
    sponsorANodeIds.push(uId);
  }
  console.log(`- Sponsor A (Node ${sponsorA}) sponsored 10 referrals.`);

  // Sponsor B direct registrations (10 referrals)
  const sponsorBWallet = wallets[11];
  await core.connect(sponsorBWallet).createNode(genesisNodeId, { value: regFee });
  const sponsorB = await core.nodeId(sponsorBWallet.address);
  registeredNodeIds.push(sponsorB);
  registeredWallets.push(sponsorBWallet);
  console.log(`- Registered Sponsor B (Node ${sponsorB}).`);

  const sponsorBWallets = [];
  const sponsorBNodeIds = [];
  for (let i = 12; i <= 21; i++) {
    const userWallet = wallets[i];
    await core.connect(userWallet).createNode(sponsorB, { value: regFee });
    const uId = await core.nodeId(userWallet.address);
    registeredNodeIds.push(uId);
    registeredWallets.push(userWallet);
    sponsorBWallets.push(userWallet);
    sponsorBNodeIds.push(uId);
  }
  console.log(`- Sponsor B (Node ${sponsorB}) sponsored 10 referrals.`);

  // Register remaining users under randomized sponsors
  let registeredCount = registeredNodeIds.length;
  for (let i = 22; i < walletCount; i++) {
    const randIndex = Math.floor(Math.random() * registeredNodeIds.length);
    const sponsorId = registeredNodeIds[randIndex];
    const userWallet = wallets[i];

    await core.connect(userWallet).createNode(sponsorId, { value: regFee });
    const uId = await core.nodeId(userWallet.address);
    registeredNodeIds.push(uId);
    registeredWallets.push(userWallet);
  }
  console.log(`- Registered remaining users. Total registered nodes: ${registeredNodeIds.length}`);

  // Check Free Recruiter Pool (Pool 9) members count:
  // Almost every sponsor that referred someone should qualify
  const pool9Members = await founderPool.poolMembers(9);
  console.log(`- Free Recruiter Pool (Pool 9) qualified members: ${pool9Members.toString()}`);

  // --- Step 4: Simulate Upgrades & Qualify for Bonus Pools ---
  console.log("\n--- Step 4: Simulating Upgrades & Bonus Pool Qualifications ---");

  // 1. Qualify Sponsor A (User 0) for Starter Builder Pool (Pool 3)
  // By upgrading its 10 referrals to Tier 1 on the same day as registration
  console.log("Upgrading Sponsor A referrals to Tier 1 on registration day...");
  const t1Cost = await core.getUpgradeCost(0, 1);
  for (let i = 0; i < 10; i++) {
    const userWallet = sponsorAWallets[i];
    const nodeId = sponsorANodeIds[i];
    await core.connect(userWallet).unlockTier(nodeId, 1, { value: t1Cost });
    await pool.connect(userWallet).registerNode(nodeId);
  }
  
  // Verify Sponsor A is qualified for Pool 3
  const sponsorAQualifiedP3 = await founderPool.isQualified(sponsorA, 3);
  console.log(`- Sponsor A (Node ${sponsorA}) qualified for Starter Builder Pool (Pool 3): ${sponsorAQualifiedP3}`);

  // 2. Qualify Sponsor B for Conversion Builder Pool (Pool 4)
  // By upgrading its 10 referrals to Tier 1 (simulating conversion)
  console.log("Upgrading Sponsor B referrals to Tier 1 (conversion) and registering in RewardPool...");
  for (let i = 0; i < 10; i++) {
    const userWallet = sponsorBWallets[i];
    const nodeId = sponsorBNodeIds[i];
    await core.connect(userWallet).unlockTier(nodeId, 1, { value: t1Cost });
    await pool.connect(userWallet).registerNode(nodeId);
  }

  // Verify Sponsor B is qualified for Pool 4
  const sponsorBQualifiedP4 = await founderPool.isQualified(sponsorB, 4);
  console.log(`- Sponsor B (Node ${sponsorB}) qualified for Conversion Builder Pool (Pool 4): ${sponsorBQualifiedP4}`);

  // 3. Qualify 5 users for Fast Activator Pool (Pool 2)
  // By upgrading them to Tier 5 within 24 hours (simulated instantly)
  console.log("Upgrading 5 users sequentially to Tier 5 to qualify for Fast Activator (Pool 2)...");
  const fastActivators = registeredNodeIds.slice(22, 27);
  const fastActivatorWallets = registeredWallets.slice(22, 27);
  for (let i = 0; i < 5; i++) {
    const nodeId = fastActivators[i];
    const wallet = fastActivatorWallets[i];
    for (let lvl = 0; lvl < 5; lvl++) {
      const cost = await core.getUpgradeCost(lvl, lvl + 1);
      await core.connect(wallet).unlockTier(nodeId, lvl + 1, { value: cost });
    }
  }

  const pool2Members = await founderPool.poolMembers(2);
  console.log(`- Fast Activator Pool (Pool 2) members count: ${pool2Members.toString()}`);

  // Check Starter Founder Pool (Pool 1) members count (includes Sponsor A referrals + Sponsor B referrals):
  const pool1Members = await founderPool.poolMembers(1);
  console.log(`- Starter Founder Pool (Pool 1) members count: ${pool1Members.toString()}`);

  // --- Step 5: Register and Upgrade Sponsors to Rank 1 & Get Leaderboard Points ---
  console.log("\n--- Step 5: Promoting Sponsors & Accumulating Leaderboard Points ---");

  // Register Sponsor A and B in RewardPool to make them eligible for Rank 1 (Founder)
  await pool.connect(wallets[0]).registerNode(sponsorA);
  await pool.connect(sponsorBWallet).registerNode(sponsorB);

  // Sync leadership status to make sure they are active Founders
  await leadership.syncLeadershipStatus(sponsorA);
  await leadership.syncLeadershipStatus(sponsorB);

  const sponsorARank = await leadership.rank(sponsorA);
  const sponsorBRank = await leadership.rank(sponsorB);
  console.log(`- Sponsor A Rank: ${sponsorARank.toString()} (Expected: 1 = Founder)`);
  console.log(`- Sponsor B Rank: ${sponsorBRank.toString()} (Expected: 1 = Founder)`);

  // Perform a personal upgrade for Sponsor A and Sponsor B to their next tier
  // This will record points and volume on the Founder Board since they are now active Founders!
  const nodeA = await core.nodes(sponsorA);
  const currentTierA = nodeA.tier;
  const targetTierA = currentTierA + 1n;
  console.log(`- Sponsor A current tier: ${currentTierA.toString()}. Upgrading to: ${targetTierA.toString()}`);
  const costA = await core.getUpgradeCost(currentTierA, targetTierA);
  await core.connect(wallets[0]).unlockTier(sponsorA, targetTierA, { value: costA });

  const nodeB = await core.nodes(sponsorB);
  const currentTierB = nodeB.tier;
  const targetTierB = currentTierB + 1n;
  console.log(`- Sponsor B current tier: ${currentTierB.toString()}. Upgrading to: ${targetTierB.toString()}`);
  const costB = await core.getUpgradeCost(currentTierB, targetTierB);
  await core.connect(sponsorBWallet).unlockTier(sponsorB, targetTierB, { value: costB });

  // --- Step 6: Route Platform Fees to RewardPoolLeadership ---
  console.log("\n--- Step 6: Routing Platform Fees & Verifying Leaderboard Rankings ---");
  const feeRecBalance = await ethers.provider.getBalance(feeRec.address);
  console.log(`- Accumulated EOA FeeReceiver balance: ${ethers.formatEther(feeRecBalance)} BNB`);

  // Send 100% of EOA feeReceiver balance to RewardPoolLeadership to trigger split
  await feeRec.sendTransaction({
    to: leadershipAddr,
    value: feeRecBalance
  });
  console.log("- Successfully forwarded platform fees to RewardPoolLeadership.");

  const sponsorAScore = await leaderboardPool.scores(sponsorA, 1);
  const sponsorBScore = await leaderboardPool.scores(sponsorB, 1);
  console.log(`- Sponsor A Leaderboard Score: ${sponsorAScore.toString()}`);
  console.log(`- Sponsor B Leaderboard Score: ${sponsorBScore.toString()}`);

  const founderBoard = await leaderboardPool.getBoard(1);
  console.log("Founder Board (Top 10):");
  for (let i = 0; i < 10; i++) {
    if (founderBoard[i].nodeId > 0n) {
      console.log(`  Rank ${i + 1}: Node ${founderBoard[i].nodeId.toString()} - Score ${founderBoard[i].score.toString()}`);
    }
  }

  // --- Step 7: Verify Claims & Cappings in Bonus Pools ---
  console.log("\n--- Step 7: Verifying Claims & Cappings in FounderPool ---");

  // Let's check a Starter Founder referral under Sponsor A
  const starterNodeId = sponsorANodeIds[0];
  const starterWallet = sponsorAWallets[0];

  const pendingP1 = await founderPool.getPendingRewards(starterNodeId, 1);
  console.log(`- Node ${starterNodeId} pending in Pool 1: ${ethers.formatEther(pendingP1)} BNB`);

  const balBefore = await ethers.provider.getBalance(starterWallet.address);
  const claimTx = await founderPool.connect(starterWallet).claim(starterNodeId, 1);
  const receipt = await claimTx.wait();
  const balAfter = await ethers.provider.getBalance(starterWallet.address);
  console.log(`- Node ${starterNodeId} claimed. Wallet balance changed by ${ethers.formatEther(balAfter - balBefore)} BNB`);

  // Starter Founder Pool cap is Tier 1 cost ($5 = 0.01666 BNB)
  // Check if they are still qualified after claim (should be false if they reached the cap)
  const stillQualified = await founderPool.isQualified(starterNodeId, 1);
  console.log(`- Still qualified in Pool 1? ${stillQualified}`);
  console.log(`- Total Claimed in Pool 1: ${ethers.formatEther(await founderPool.totalClaimed(starterNodeId, 1))} BNB`);

  // Let's claim from Free Recruiter Pool (Pool 9) for Sponsor A
  const pendingP9 = await founderPool.getPendingRewards(sponsorA, 9);
  console.log(`- Sponsor A pending in Pool 9: ${ethers.formatEther(pendingP9)} BNB`);
  if (pendingP9 > 0n) {
    const sponsorABalBefore = await ethers.provider.getBalance(wallets[0].address);
    await founderPool.connect(wallets[0]).claim(sponsorA, 9);
    const sponsorABalAfter = await ethers.provider.getBalance(wallets[0].address);
    console.log(`- Sponsor A claimed Pool 9. Wallet balance changed by ${ethers.formatEther(sponsorABalAfter - sponsorABalBefore)} BNB`);
  }

  // --- Step 8: Verify Claims in LeaderboardPool ---
  console.log("\n--- Step 8: Verifying LeaderboardPool Claims ---");
  const claimableLboardA = await leaderboardPool.claimableRewards(sponsorA);
  console.log(`- Sponsor A claimable leaderboard rewards: ${ethers.formatEther(claimableLboardA)} BNB`);
  
  if (claimableLboardA > 0n) {
    const balBefore = await ethers.provider.getBalance(wallets[0].address);
    await leaderboardPool.connect(wallets[0]).claim(sponsorA);
    const balAfter = await ethers.provider.getBalance(wallets[0].address);
    console.log(`- Sponsor A claimed leaderboard rewards. Wallet balance changed by ${ethers.formatEther(balAfter - balBefore)} BNB`);
  }

  // --- Step 9: Final Solvency Check ---
  await checkSolvency("Final Summary");

  console.log("\n==========================================================");
  console.log("       500 USER SYSTEM-WIDE SIMULATION COMPLETED SUCCESSFULLY!");
  console.log("==========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
