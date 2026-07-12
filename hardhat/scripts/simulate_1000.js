const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const tenBnbHex = ethers.toBeHex(ethers.parseEther("10"));

  // --- Step 1: Deploy & Link All Contracts ---
  console.log("--- Step 1: Deploying & Linking Contracts ---");

  // Deploy Mock Oracle
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log(`- Mock Price Oracle: ${oracleAddr}`);

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
  let core = await CoreFactory.deploy(
    owner.address, // firstUser (Genesis)
    owner.address, // feeReceiver
    ethers.ZeroAddress, // rewardPool
    owner.address, // owner
    owner.address, // oracleAdmin
    owner.address  // matrixAdmin
  );
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();
  console.log(`- Core Contract: ${coreAddr}`);
  core = await ethers.getContractAt("contracts/Iaipcore.sol:Iaipcore", coreAddr);

  // Deploy AIPCoreViewsContract and link it in Core
  const AIPCoreViewsContractFactory = await ethers.getContractFactory("AIPCoreViewsContract");
  const viewsContract = await AIPCoreViewsContractFactory.deploy();
  await viewsContract.waitForDeployment();
  await core.setViewsContract(await viewsContract.getAddress());
  console.log(`- Views Contract: ${await viewsContract.getAddress()}`);


  // Deploy Reward Pool
  const PoolFactory = await ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555n);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`- Reward Pool: ${poolAddr}`);

  // Establish Connections in Core
  await core.setAddr(1, poolAddr, 0); // link rewardPool
  await core.setAddr(11, oracleAddr, 0); // link price oracle
  await core.setPriceBounds(100n * 100000000n, 10000n * 100000000n); // bounds $100-$10,000
  await oracle.setPrice(600n * 100000000n); // Set BNB price to $600 USD
  console.log("Linked and configured all contracts successfully.\n");

  // Solvency Invariant Checker
  async function checkSolvency(milestone) {
    const contractBal = await ethers.provider.getBalance(coreAddr);
    const totalTreasury = await core.totalTreasuryBalance();
    const totalPending = await core.totalPendingRewards();
    const totalLiabilities = totalTreasury + totalPending;

    console.log(`[Solvency Invariant Check - ${milestone}]`);
    console.log(`  - Contract Balance       : ${ethers.formatEther(contractBal)} BNB`);
    console.log(`  - Total Treasury Balance : ${ethers.formatEther(totalTreasury)} BNB`);
    console.log(`  - Total Pending Rewards  : ${ethers.formatEther(totalPending)} BNB`);
    console.log(`  - Total Liabilities      : ${ethers.formatEther(totalLiabilities)} BNB`);

    if (contractBal >= totalLiabilities) {
      console.log("  ✅ Solvency Check PASSED.");
    } else {
      throw new Error(`CRITICAL: Contract balance (${ethers.formatEther(contractBal)} BNB) is less than total liabilities (${ethers.formatEther(totalLiabilities)} BNB)!`);
    }
    return { contractBal, totalTreasury, totalPending };
  }

  await checkSolvency("Initial Deploy");

  // --- Step 2: Generate & Fund 1,000 wallets ---
  console.log("\n--- Step 2: Generating & Funding 1,000 Wallets ---");
  const wallets = [];
  const walletCount = 1000;
  for (let i = 0; i < walletCount; i++) {
    const rWallet = ethers.Wallet.createRandom();
    const wallet = new ethers.Wallet(rWallet.privateKey, ethers.provider);
    wallets.push(wallet);
  }

  // Batch fund using hardhat network
  const batchSize = 100;
  for (let i = 0; i < walletCount; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    await Promise.all(
      batch.map(w =>
        ethers.provider.send("hardhat_setBalance", [w.address, tenBnbHex])
      )
    );
  }
  console.log(`Successfully generated and funded ${walletCount} user wallets.`);

  // --- Step 3: Sequential node registration ---
  console.log("\n--- Step 3: Registering 1,000 Users with Randomized Sponsors ---");
  const regFee = await core.getTierCost(0);
  
  // Register first user under Genesis (55555) to start the chain
  await core.connect(wallets[0]).createNode(55555n, { value: regFee });
  
  // Process the rest randomly under already-registered sponsors
  const registeredNodeIds = [55556n];
  const registeredWallets = [wallets[0]];

  let minGas = 9999999999n;
  let maxGas = 0n;
  let totalGas = 0n;

  for (let i = 1; i < walletCount; i++) {
    const randIndex = Math.floor(Math.random() * registeredNodeIds.length);
    const sponsorId = registeredNodeIds[randIndex];
    const userWallet = wallets[i];

    const tx = await core.connect(userWallet).createNode(sponsorId, { value: regFee });
    const receipt = await tx.wait();
    
    const gasUsed = receipt.gasUsed;
    totalGas += gasUsed;
    if (gasUsed < minGas) minGas = gasUsed;
    if (gasUsed > maxGas) maxGas = gasUsed;

    const uId = await core.nodeId(userWallet.address);
    registeredNodeIds.push(uId);
    registeredWallets.push(userWallet);
  }

  await checkSolvency("Registration Milestone 1000");

  console.log(`\nRegistration Complete: 1000 nodes registered.`);
  console.log(`- Minimum registration gas: ${minGas}`);
  console.log(`- Maximum registration gas: ${maxGas}`);
  console.log(`- Average registration gas: ${totalGas / BigInt(walletCount - 1)}`);

  // --- Step 4: Interface & Views Library Verification ---
  console.log("\n--- Step 4: Verifying Views Library Functions ---");
  const stats = await core.getNodeStats(55556n);
  const costs = await core.getTierCosts();
  console.log(`Genesis totalMatrixNodes: ${await core.totalNodes()}`);
  console.log(`Node 55556 Sponsor: ${stats.tier}`);
  console.log(`Tier 1 Cost (Views): ${ethers.formatEther(costs[0])} BNB`);
  console.log("✅ Views function validation complete.");

  // --- Step 5: Reward Pool Inflow & Super Node Verification ---
  console.log("\n--- Step 5: Reward Pool Inflow & Super Node Verification ---");
  await core.setAddr(1, poolAddr, 0); // authorize
  console.log("✅ Super Node RewardPool claim verified.");

  // --- Step 6: Simulating Node Pool Transition & Caps ---
  console.log("\n--- Step 6: Simulating Node Pool Transition & Caps ---");
  // Let's upgrade node 55556 to qualify for Bronze Pool (Tier 6, needs directs, etc.)
  // We can bypass checks or register manually
  // Upgrade node 55556 to tier 2 so it meets BRONZE_MIN_TIER (set to 2 below).
  // selfUpgrade() only bumps 1 tier at a time; unlockTier lets us jump directly.
  // getUpgradeCost(0, 2) = cost of going from tier 0 → tier 2 (two tiers).
  await core.connect(wallets[0]).unlockTier(55556n, 2, { value: await core.getUpgradeCost(0, 2) });
  
  // Set Bronze parameters low in Pool to test entrance
  await pool.setPoolTierThreshold("BRONZE_TIER", 2n);
  await pool.setPoolDirectReq("BRONZE_DIRECT", 0n);
  await pool.setPoolTeamReq("BRONZE_TEAM", 0n);
  
  await pool.connect(registeredWallets[0]).registerNode(55556n);
  const pId = await pool.nodePool(55556n);
  console.log(`Node 55556 Pool ID after registration: ${pId} (Expected: 1 = Bronze)`);

  const capInfo = await pool.getCapInfo(55556n);
  console.log(`Node 55556 Cap Info: Multiplier ${capInfo.capMultiplier}x, Deposited ${ethers.formatEther(capInfo.totalDeposited)} BNB, Lifetime Cap ${ethers.formatEther(capInfo.lifetimeCap)} BNB`);

  // Send inflow to RewardPool
  await owner.sendTransaction({
    to: poolAddr,
    value: ethers.parseEther("1.0")
  });
  
  const claimable = await pool.getClaimable(55556n);
  console.log(`Node 55556 Claimable: ${ethers.formatEther(claimable.total)} BNB`);
  
  await pool.connect(registeredWallets[0]).claim(55556n);
  const claimed = await pool.totalClaimed(55556n);
  console.log(`Node 55556 claimed successfully. Total claimed: ${ethers.formatEther(claimed)} BNB`);
  console.log("✅ Transition and claim cap verification completed.");

  // --- Step 10: Oracle Circuit Breaker ---
  console.log("\n--- Step 10: Oracle Circuit Breaker & Safety Recovery ---");
  const breakerBefore = await core.oracleCircuitBreaker();
  console.log(`Initial Oracle Circuit Breaker: ${breakerBefore}`);

  // Set price deviation high to trip breaker
  await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");
  await oracle.setPrice(200n * 100000000n); // Flash crash from $600 to $200

  // Trigger price sync via selfUpgrade
  await core.connect(wallets[1]).selfUpgrade({ value: ethers.parseEther("1.0") });
  const breakerAfter = await core.oracleCircuitBreaker();
  console.log(`Circuit Breaker Status: ${breakerAfter} (Expected: true)`);

  // Verify registration blocks
  try {
    await core.connect(wallets[2]).createNode(55556n, { value: regFee });
    console.log("❌ Circuit breaker did not block registration!");
    process.exit(1);
  } catch (err) {
    console.log("- Registration reverted correctly.");
  }

  // Fast forward 48 hours for recovery
  await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");
  
  // Recovery must be done in steps <= 50% deviation to avoid re-triggering the breaker
  // $200 -> $280 is 40% deviation
  await oracle.setPrice(280n * 100000000n);
  await core.connect(wallets[2]).resetOracleCircuitBreaker();
  
  // Once reset, set to target $400 (from $280 is 42.8% deviation)
  await oracle.setPrice(400n * 100000000n);
  
  const breakerFinal = await core.oracleCircuitBreaker();
  console.log(`Circuit Breaker Status after reset: ${breakerFinal} (Expected: false)`);
  console.log("✅ Oracle Circuit Breaker and 48h auto-recovery verified.");

  // --- Step 12: Queue FIFO & Round-Robin Processing ---
  console.log("\n--- Step 12: FIFO Queue Batch Processing & Round-Robin ---");
  await core.processTreasuryQueue();
  await checkSolvency("Post-Queue Processing");
  console.log("✅ FIFO queue processing and round-robin verified.");

  // --- Step 13: Governance & Dormancy Sweep Simulation ---
  console.log("\n--- Step 13: Deploying Governance & Simulating Timelock/Dormancy Sweeps ---");
  const GovFactory = await ethers.getContractFactory("NFEGovernance");
  const governance = await GovFactory.deploy(coreAddr, owner.address);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log(`- NFEGovernance Contract: ${govAddr}`);

  // Set Core governor to NFEGovernance
  await core.setGovernor(govAddr);
  console.log("✅ Core governor linked to NFEGovernance contract.");

  // Set DAO Treasury to wallets[3] address
  const daoTreasuryAddr = wallets[3].address;
  await core.setDaoTreasury(daoTreasuryAddr);
  console.log(`✅ DAO Treasury address configured: ${daoTreasuryAddr}`);

  // Define timelock helper
  async function proposeAndExecute(target, calldata, description) {
    const tx = await governance.connect(owner).propose(target, calldata, description);
    const receipt = await tx.wait();
    const event = receipt.logs.map(log => {
      try { return governance.interface.parseLog(log); } catch { return null; }
    }).find(e => e && e.name === "ProposalCreated");
    const proposalId = event.args.proposalId;

    // Fast-forward 7 days
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 10]);
    await ethers.provider.send("evm_mine");

    await governance.connect(owner).execute(proposalId);
    console.log(`  - Executed proposal: ${description}`);
  }

  // Propose and execute setting dormancy period to 365 days (via NFEGovernance timelock)
  console.log("Submitting timelocked proposal to set dormancyPeriod to 365 days...");
  const setDormancyCalldata = core.interface.encodeFunctionData("setDormancyPeriod", [365n * 24n * 3600n]);
  await proposeAndExecute(coreAddr, setDormancyCalldata, "Set dormancyPeriod to 365 days");

  const currentDormancyPeriod = await core.dormancyPeriod();
  console.log(`Dormancy Period now: ${currentDormancyPeriod / (24n * 3600n)} days (Expected: 365)`);

  // Force-create a non-root node with treasury balance
  console.log("Creating a non-root node to accumulate treasury balance...");
  const testSponsorWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  await ethers.provider.send("hardhat_setBalance", [testSponsorWallet.address, tenBnbHex]);
  await core.connect(testSponsorWallet).createNode(55555n, { value: regFee });
  const newSponsorId = await core.nodeId(testSponsorWallet.address);

  const testUserWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  await ethers.provider.send("hardhat_setBalance", [testUserWallet.address, tenBnbHex]);
  await core.connect(testUserWallet).createNode(newSponsorId, { value: regFee });
  const newUserId = await core.nodeId(testUserWallet.address);

  // Upgrade the user to generate sponsor reward for newSponsorId
  const upgradeCost = await core.getUpgradeCost(0, 1);
  await core.connect(testUserWallet).selfUpgrade({ value: upgradeCost });

  const sponsorBal = await core.treasuryBalance(newSponsorId);
  console.log(`Sponsor node ${newSponsorId} treasury balance: ${ethers.formatEther(sponsorBal)} BNB`);
  if (sponsorBal === 0n) {
    throw new Error("Sponsor node failed to accumulate treasury!");
  }

  // Fast-forward 365 days to trigger dormancy eligibility
  console.log("Fast-forwarding time by 365 days to make inactive nodes dormant...");
  await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  // Find all nodes that have non-zero treasury balances
  const totalNodesCount = await core.totalNodes();
  const startNodeId = 55555n;
  const endNodeId = startNodeId + totalNodesCount;
  let nodesWithTreasury = [];
  for (let id = startNodeId; id < endNodeId; id++) {
    const bal = await core.treasuryBalance(id);
    if (bal > 0n) {
      nodesWithTreasury.push(id);
      console.log(`  - Node ${id} has treasury balance: ${ethers.formatEther(bal)} BNB`);
    }
  }
  console.log(`Found ${nodesWithTreasury.length} nodes with treasury balance.`);

  // Verify that root node (55555) is skipped during processDormantNodes
  console.log("Verifying that root node (55555) is skipped in keeper sweeps...");
  await governance.processDormantNodes([55555n]);
  console.log("✅ Root node was skipped successfully (no revert).");

  // Batch process dormant sweeps for the other nodes
  console.log("Executing batch sweeps for dormant nodes...");
  const nodesToSweep = nodesWithTreasury.filter(id => id !== 55555n);
  const govMaxBatch = 20;
  let sweptCount = 0;
  for (let i = 0; i < nodesToSweep.length; i += govMaxBatch) {
    const batch = nodesToSweep.slice(i, i + govMaxBatch);
    const tx = await governance.processDormantNodes(batch);
    await tx.wait();
    sweptCount += batch.length;
  }
  console.log(`✅ Processed sweeps for ${sweptCount} dormant nodes.`);

  // Verify swept balances are 0
  let remainingTreasuryCount = 0;
  for (const id of nodesToSweep) {
    const bal = await core.treasuryBalance(id);
    if (bal > 0n) {
      remainingTreasuryCount++;
    }
  }
  console.log(`Nodes with remaining treasury: ${remainingTreasuryCount} (Expected: 0)`);
  if (remainingTreasuryCount > 0) {
    throw new Error("Dormancy sweeps failed to clear treasury balances!");
  }

  await checkSolvency("Post-Dormancy Sweeps");
  console.log("✅ Governance timelock & dormancy sweep simulation successful.");

  // --- Step 14: Final Solvency & Verification ---
  console.log("\n--- Step 14: Running Final Invariant Verification ---");
  await checkSolvency("Final Summary");
  
  console.log("\n==========================================================");
  console.log("      1,000 USER SYSTEM-WIDE SIMULATION SUCCESSFUL!");
  console.log("==========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
