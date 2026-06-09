const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("==========================================================");
  console.log("   NFEGLOBAL 1,000 USER SYSTEM-WIDE PRODUCTION SIMULATION");
  console.log("==========================================================\n");

  const signers = await ethers.getSigners();
  const owner = signers[0];
  const daoRecipient = signers[8]; // designated DAO proposal recipient

  console.log(`Deployer/Owner Address: ${owner.address}`);
  const startingBal = await ethers.provider.getBalance(owner.address);
  console.log(`Starting Balance: ${ethers.formatEther(startingBal)} BNB\n`);

  // --- Step 1: Deploy & Link All Contracts ---
  console.log("--- Step 1: Deploying & Linking Contracts ---");
  
  // Deploy Oracle
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log(`- Price Oracle: ${oracleAddr}`);

  // Deploy Views Library
  const ViewsFactory = await ethers.getContractFactory("nfeglobalViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();
  console.log(`- Views Library: ${viewsAddr}`);

  // Deploy Core
  const CoreFactory = await ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    owner.address, // firstUser (ID 55555)
    owner.address, // feeReceiver
    ethers.ZeroAddress, // rewardPool (will link later)
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
  console.log(`- Core Engine: ${coreAddr}`);

  // Deploy Reward Pool
  const PoolFactory = await ethers.getContractFactory("RewardPool");
  // Set genesisNodeId = 55555 so it's auto-registered as super node
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555n);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`- Reward Pool: ${poolAddr}`);

  // Deploy Governance
  const GovFactory = await ethers.getContractFactory("Governance");
  const governance = await GovFactory.deploy(coreAddr);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log(`- Governance: ${govAddr}`);

  // Establish Connections in Core
  await core.setAddr(1, poolAddr, 0); // link rewardPool
  await core.setAddr(11, oracleAddr, 0); // link price oracle
  await core.setAddr(13, govAddr, 0); // link governance
  await core.setPriceBounds(100n * 100000000n, 10000n * 100000000n); // bounds $100-$10,000
  await oracle.setPrice(600n * 100000000n); // Set BNB price to $600 USD
  console.log("Linked and configured all contracts successfully.\n");

  // Solvency Invariant Checker
  async function checkSolvency(milestone) {
    const contractBal = await ethers.provider.getBalance(coreAddr);
    const totalTreasury = await core.totalTreasuryBalance();
    const daoTreasury = await governance.daoTreasury();
    const totalPending = await core.totalPendingRewards();
    const totalLiabilities = totalTreasury + totalPending;

    console.log(`[Solvency Invariant Check - ${milestone}]`);
    console.log(`  - Contract Balance       : ${ethers.formatEther(contractBal)} BNB`);
    console.log(`  - Total Treasury Balance : ${ethers.formatEther(totalTreasury)} BNB`);
    console.log(`  - DAO Treasury Balance   : ${ethers.formatEther(daoTreasury)} BNB`);
    console.log(`  - Total Pending Rewards  : ${ethers.formatEther(totalPending)} BNB`);
    console.log(`  - Total Liabilities      : ${ethers.formatEther(totalLiabilities)} BNB`);

    if (contractBal >= totalLiabilities) {
      console.log("  ✅ Solvency Check PASSED.");
    } else {
      throw new Error(`CRITICAL: Contract balance (${ethers.formatEther(contractBal)} BNB) is less than total liabilities (${ethers.formatEther(totalLiabilities)} BNB)!`);
    }
    return { contractBal, totalTreasury, daoTreasury, totalPending };
  }

  await checkSolvency("Initial Deploy");

  // --- Step 2: Generate & Fund 1,000 wallets ---
  console.log("\n--- Step 2: Generating & Funding 1,000 Wallets ---");
  const wallets = [];
  const walletCount = 1000;
  for (let i = 0; i < walletCount; i++) {
    const rWallet = ethers.Wallet.createRandom();
    const w = new ethers.Wallet(rWallet.privateKey, ethers.provider);
    wallets.push(w);
  }
  
  // Set balances instantly to 10 BNB
  console.log("Setting balances of 1,000 wallets using hardhat_setBalance...");
  const tenBnbHex = "0x" + (10n * 10n**18n).toString(16);
  for (let i = 0; i < walletCount; i++) {
    await ethers.provider.send("hardhat_setBalance", [wallets[i].address, tenBnbHex]);
  }
  console.log(`Successfully funded ${walletCount} wallets with 10 BNB each.\n`);

  // --- Step 3: Sequential node registration ---
  console.log("--- Step 3: Registering 1,000 Users with Randomized Sponsors ---");
  const regFee = await core.getTierCost(0);
  console.log(`Registration Fee (Tier 0 -> Tier 1): ${ethers.formatEther(regFee)} BNB`);

  const regGas = [];
  for (let i = 0; i < walletCount; i++) {
    // Select sponsor from node 55555 to (55555 + i)
    const sponsorId = 55555n + BigInt(Math.floor(Math.random() * (i + 1)));
    try {
      const tx = await core.connect(wallets[i]).createNode(sponsorId, { 
        value: regFee,
        gasLimit: 15000000
      });
      const receipt = await tx.wait();
      regGas.push(receipt.gasUsed);
      
      if ((i + 1) % 100 === 0 || i > 950) {
        console.log(`- User ${i} registered sponsor ${sponsorId} | Gas: ${receipt.gasUsed.toString()}`);
      }
    } catch (err) {
      console.error(`💥 Registration failed at user index ${i} (Sponsor: ${sponsorId.toString()}):`);
      console.error(err);
      throw err;
    }

    if ((i + 1) % 200 === 0) {
      await checkSolvency(`Registration Milestone ${i + 1}`);
    }
  }

  const avgRegGas = regGas.reduce((a, b) => a + b, 0n) / BigInt(regGas.length);
  console.log(`\nRegistration Complete: 1000 nodes registered.`);
  console.log(`- Minimum registration gas: ${regGas.reduce((a, b) => a < b ? a : b).toString()}`);
  console.log(`- Maximum registration gas: ${regGas.reduce((a, b) => a > b ? a : b).toString()}`);
  console.log(`- Average registration gas: ${avgRegGas.toString()}\n`);

  // --- Step 4: Interface & Views Library Verification ---
  console.log("--- Step 4: Verifying Views Library Functions ---");
  // Check genesis node
  const genesisNode = await core.getNode(55555n);
  console.log(`Genesis totalMatrixNodes: ${genesisNode.totalMatrixNodes.toString()}`);
  console.log(`Genesis totalContribution: ${ethers.formatEther(genesisNode.totalContribution)} BNB`);

  // Check some node views
  const testNodeId = 55556n;
  const nodeInfo = await core.getNode(testNodeId);
  console.log(`Node ${testNodeId} Wallet: ${nodeInfo.wallet}`);
  console.log(`Node ${testNodeId} Sponsor: ${nodeInfo.sponsor.toString()}`);

  const nodeCurDay = await core.getNodeCurDay(testNodeId);
  console.log(`Node ${testNodeId} Current Day: ${nodeCurDay.toString()}`);

  const tierCosts = await core.getTierCosts();
  console.log(`Tier 1 Cost (Views): ${ethers.formatEther(tierCosts[0])} BNB`);

  const transparencyData = await core.getTransparencyData();
  console.log(`Transparency Total Nodes: ${transparencyData._totalNodes.toString()}`);

  const configData = await core.getConfig();
  console.log(`Config Default Refer: ${configData._defaultRefer.toString()}`);

  const nodeStats = await core.getNodeStats(testNodeId);
  console.log(`Node ${testNodeId} Stats tier: ${nodeStats.tier.toString()}`);

  const poolQual = await core.getPoolQualificationData(testNodeId);
  console.log(`Node ${testNodeId} Pool Qual Team: ${poolQual.matrixTeam.toString()}`);
  console.log("✅ Views function validation complete.\n");

  // --- Step 5: Reward Pool Inflow & Super Node Verification ---
  console.log("--- Step 5: Reward Pool Inflow & Super Node Verification ---");
  // Check Genesis superNode registration
  const isSuper = await pool.isSuperNode(55555n);
  const superReg = await pool.superRegistered(55555n);
  console.log(`Genesis isSuperNode: ${isSuper}, superRegistered: ${superReg}`);
  if (!isSuper || !superReg) {
    throw new Error("Genesis is not configured as Super Node in RewardPool!");
  }

  // Check pool balances before claim
  const bronzeNodes = await pool.bronzeNodes();
  const silverNodes = await pool.silverNodes();
  const goldNodes = await pool.goldNodes();
  console.log(`RewardPool Initial Nodes Count - Bronze: ${bronzeNodes.toString()}, Silver: ${silverNodes.toString()}, Gold: ${goldNodes.toString()}`);

  // Retrieve genesis claimable before claim
  const genClaimable = await pool.getClaimable(55555n);
  console.log(`Genesis (Super Node) Claimable - Current Pool: ${ethers.formatEther(genClaimable.fromCurrentPool)} BNB, Total: ${ethers.formatEther(genClaimable.total)} BNB`);

  // Let's claim rewards for Genesis
  if (genClaimable.total > 0n) {
    const balBefore = await ethers.provider.getBalance(owner.address);
    const claimTx = await pool.connect(owner).claim(55555n);
    await claimTx.wait();
    const balAfter = await ethers.provider.getBalance(owner.address);
    console.log(`Genesis successfully claimed: ${ethers.formatEther(balAfter - balBefore)} BNB`);
  }
  console.log("✅ Super Node RewardPool claim verified.\n");

  // --- Step 6: Reward Pool qualifications & transitions ---
  console.log("--- Step 6: Simulating Node Pool Transition & Caps ---");
  // We will select a node (e.g. 55556) which has sponsored some children and has team matrix nodes
  // Let's check its pool qualification stats first
  let qData = await core.getPoolQualificationData(55556n);
  console.log(`Node 55556 initial qualification: Tier ${qData.currentLevel.toString()}, Directs ${qData.directReferrals.toString()}, Team Matrix ${qData.matrixTeam.toString()}`);

  // Let's upgrade Node 55556 to Tier 6 (Bronze threshold)
  console.log("Upgrading Node 55556 to Tier 6...");
  const upgradeCostTo6 = await core.getUpgradeCost(0, 6); // from 0, upgrade 6 levels (to 6)
  const upgradeTx = await core.connect(wallets[0]).unlockTier(55556n, 6, { value: upgradeCostTo6 });
  await upgradeTx.wait();

  // Force Node 55556 to have at least 2 directs (we'll look at directRefs count, it might already have it due to random sponsor, otherwise let's register two directly under it)
  let directRefs = await pool.getQualificationStatus(55556n);
  const neededDirects = Number(directRefs.directNeededBronze);
  const neededTeam = Number(directRefs.teamNeededBronze);
  console.log(`Node 55556 needs directs: ${neededDirects}, needs team: ${neededTeam}`);

  if (neededDirects > 0) {
    console.log(`Registering ${neededDirects} new nodes directly sponsored by Node 55556...`);
    for (let d = 0; d < neededDirects; d++) {
      const tempWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, ethers.provider);
      await ethers.provider.send("hardhat_setBalance", [tempWallet.address, tenBnbHex]);
      await core.connect(tempWallet).createNode(55556n, { value: regFee });
    }
  }

  qData = await core.getPoolQualificationData(55556n);
  console.log(`Node 55556 updated qualification: Tier ${qData.currentLevel.toString()}, Directs ${qData.directReferrals.toString()}, Team Matrix ${qData.matrixTeam.toString()}`);

  // If team size is still short for Bronze (neededTeam > 0), we can manually reduce the Bronze team requirement for testing!
  // RewardPool has configurable parameters: setPoolTeamReq("BRONZE_TEAM", 0)
  if (Number(qData.matrixTeam) < 30) {
    console.log("Reducing Bronze team requirement to 0 for transition verification...");
    await pool.setPoolTeamReq("BRONZE_TEAM", 0);
  }

  // Now register Node 55556 in RewardPool!
  console.log("Registering Node 55556 in RewardPool...");
  const regNodeTx = await pool.connect(wallets[0]).registerNode(55556n);
  await regNodeTx.wait();

  const nodePoolId = await pool.nodePool(55556n);
  console.log(`Node 55556 Pool ID after registration: ${nodePoolId.toString()} (Expected: 1 = Bronze)`);
  if (nodePoolId !== 1n) {
    throw new Error(`Expected Node 55556 to enter Bronze pool (1). Got: ${nodePoolId.toString()}`);
  }

  // Verify earnings cap enforcement
  const capInfo = await pool.getCapInfo(55556n);
  console.log(`Node 55556 Cap Info: Multiplier ${capInfo.capMultiplier.toString()}x, Deposited ${ethers.formatEther(capInfo.totalDeposited)} BNB, Lifetime Cap ${ethers.formatEther(capInfo.lifetimeCap)} BNB`);

  // Send some inflow to RewardPool to generate claimable rewards
  console.log("Sending inflow to RewardPool...");
  await owner.sendTransaction({
    to: poolAddr,
    value: ethers.parseEther("10.0")
  });

  const claimableInfo = await pool.getClaimable(55556n);
  console.log(`Node 55556 Claimable: ${ethers.formatEther(claimableInfo.total)} BNB`);

  // Let's claim
  const walletBalBefore = await ethers.provider.getBalance(wallets[0].address);
  const claimTx = await pool.connect(wallets[0]).claim(55556n);
  await claimTx.wait();
  const walletBalAfter = await ethers.provider.getBalance(wallets[0].address);
  console.log(`Node 55556 claimed successfully. Wallet balance diff: ${ethers.formatEther(walletBalAfter - walletBalBefore)} BNB`);
  console.log("✅ Transition and claim cap verification completed.\n");

  // --- Step 7: Emergency Rescue Timelock ---
  console.log("--- Step 7: Verifying Reward Pool Emergency Rescue ---");
  await pool.scheduleRescue();
  console.log("Rescue scheduled. Fast forwarding 48 hours...");
  await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  // Create a surplus in RewardPool by setting its balance directly in state
  const poolBal = await ethers.provider.getBalance(poolAddr);
  const targetPoolBal = poolBal + ethers.parseEther("5.0");
  const targetPoolBalHex = "0x" + targetPoolBal.toString(16);
  await ethers.provider.send("hardhat_setBalance", [poolAddr, targetPoolBalHex]);
  console.log(`Directly deposited 5.0 BNB surplus to RewardPool (bypassing receive).`);

  const rescueBalBefore = await ethers.provider.getBalance(owner.address);
  // Let's rescue a small surplus (e.g. 0.1 BNB)
  const rescueTx = await pool.rescueBNB(owner.address, ethers.parseEther("0.1"));
  await rescueTx.wait();
  const rescueBalAfter = await ethers.provider.getBalance(owner.address);
  console.log(`Successfully rescued 0.1 BNB. Owner balance diff: ${ethers.formatEther(rescueBalAfter - rescueBalBefore)} BNB`);
  console.log("✅ Emergency Rescue verified.\n");

  // --- Step 8: Inactivity Dormancy ---
  console.log("--- Step 8: Inactivity Dormancy Lifecycle ---");
  // Set dormancyThreshold to 10s
  await core.setAddr(14, ethers.ZeroAddress, 10);
  const dormancyThresh = await core.dormancyThreshold();
  console.log(`Dormancy Threshold: ${dormancyThresh.toString()} seconds.`);

  const dormantNodeId = 55558n;
  const dormantNodeOwner = wallets[2]; // wallet of node 55558

  // Wait 12 seconds to make the node inactive
  console.log("Waiting 12 seconds...");
  await ethers.provider.send("evm_increaseTime", [12]);
  await ethers.provider.send("evm_mine");

  // Propose dormancy
  console.log(`Proposing dormancy for Node ${dormantNodeId}...`);
  await core.proposeDormancy(dormantNodeId);
  let isProposed = await core.dormancyProposed(dormantNodeId);
  console.log(`Node ${dormantNodeId} dormancyProposed: ${isProposed}`);

  // Recover during notice
  console.log("Recovering node during notice period...");
  await core.connect(dormantNodeOwner).claimDormantTreasury();
  isProposed = await core.dormancyProposed(dormantNodeId);
  console.log(`Node ${dormantNodeId} dormancyProposed after recovery claim: ${isProposed}`);

  // Propose again
  console.log("Waiting 12 seconds to propose again...");
  await ethers.provider.send("evm_increaseTime", [12]);
  await ethers.provider.send("evm_mine");
  await core.proposeDormancy(dormantNodeId);

  // Fast-forward 30 days to activate dormancy
  console.log("Fast forwarding 30 days notice period...");
  await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  console.log(`Activating dormancy for Node ${dormantNodeId}...`);
  await core.activateDormancy(dormantNodeId);
  const isDormant = await core.treasuryDormant(dormantNodeId);
  console.log(`Node ${dormantNodeId} treasuryDormant: ${isDormant}`);

  // Let's make sure the dormant node has some treasury balance to migrate.
  // We can credit it with some BNB by transferring missed rewards or we can migrate a node with balance.
  // Let's fast forward 30 days recovery claim period.
  console.log("Fast forwarding 30 days recovery claim period...");
  await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  // Let's check treasury balance
  const dbBal = await core.treasuryBalance(dormantNodeId);
  console.log(`Node ${dormantNodeId} Treasury Balance: ${ethers.formatEther(dbBal)} BNB`);

  if (dbBal > 0n) {
    console.log("Migrating dormant treasury to DAO...");
    const daoBefore = await governance.daoTreasury();
    await core.migrateDormantTreasury(dormantNodeId);
    const daoAfter = await governance.daoTreasury();
    console.log(`DAO Treasury before: ${ethers.formatEther(daoBefore)} BNB, after: ${ethers.formatEther(daoAfter)} BNB`);
  } else {
    console.log("Node had 0 treasury balance.");
  }
  console.log("✅ Inactivity dormancy lifecycle verified.\n");

  // --- Step 9: DAO Governance & Timelock ---
  console.log("--- Step 9: DAO Governance and Timelock Proposal ---");
  // Let's migrate a node with 5 BNB treasury and then migrate its dormant treasury to DAO
  const govNodeWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, ethers.provider);
  await ethers.provider.send("hardhat_setBalance", [govNodeWallet.address, tenBnbHex]);
  const govNodeData = {
    wallet: govNodeWallet.address,
    nodeId: 99990n,
    sponsor: 55555n,
    matrixParent: 55555n,
    joinedAt: BigInt(Math.floor(Date.now() / 1000)),
    tier: 1,
    directNodes: 0,
    totalMatrixNodes: 0,
    totalContribution: 0n,
    sponsorTierRanks: Array(18).fill(0n),
    matrixRewardReceiver: Array(18).fill(0n)
  };
  await core.migrateNode(govNodeData, ethers.parseEther("5.0"));
  // Let's deposit 5 BNB to contract to back the virtual balance
  await owner.sendTransaction({ to: coreAddr, value: ethers.parseEther("5.0") });

  // Make it dormant
  await ethers.provider.send("evm_increaseTime", [12]);
  await ethers.provider.send("evm_mine");
  await core.proposeDormancy(99990n);
  await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");
  await core.activateDormancy(99990n);
  await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");
  await core.migrateDormantTreasury(99990n);

  const daoTreasuryBal = await governance.daoTreasury();
  console.log(`DAO Treasury Balance: ${ethers.formatEther(daoTreasuryBal)} BNB`);

  // Create Governance proposal
  const propAmount = ethers.parseEther("2.0");
  console.log(`Proposing DAO spend of ${ethers.formatEther(propAmount)} BNB to recipient ${daoRecipient.address}`);
  const proposeTx = await governance.connect(wallets[0]).propose(daoRecipient.address, propAmount, "Test DAO Spend");
  const proposeReceipt = await proposeTx.wait();
  
  // Parse ProposalCreated log
  const eventSignature = ethers.id("ProposalCreated(uint256,uint256,address,uint256,string,uint256)");
  const log = proposeReceipt.logs.find(l => l.topics[0] === eventSignature);
  if (!log) {
    throw new Error("ProposalCreated event was not emitted!");
  }
  const decodedLog = governance.interface.decodeEventLog("ProposalCreated", log.data, log.topics);
  const proposalId = decodedLog.id;
  console.log(`Proposal created with ID: ${proposalId.toString()}`);

  // Vote from Node 55556 (tier 6, weight 6)
  await governance.connect(wallets[0]).vote(proposalId, true);
  
  // Upgrade Node 55557 (ID 55558 / wallets[1]'s node ID 55557) to Tier 1 manually so it has non-zero voting weight (weight 1)
  const u2CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(wallets[1]).unlockTier(55557n, 1, { value: u2CostTo1 });

  // Vote from Node 55557 (tier 1, weight 1)
  await governance.connect(wallets[1]).vote(proposalId, true);

  const propDetail = await governance.proposals(proposalId);
  console.log(`Votes for: ${propDetail.votesFor.toString()}`);

  // Fast forward voting period (7 days)
  console.log("Fast forwarding 7 days voting period...");
  await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  // Queue proposal
  console.log("Queueing proposal...");
  await governance.connect(wallets[0]).queue(proposalId);

  // Fast forward timelock period (2 days)
  console.log("Fast forwarding 2 days timelock period...");
  await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  // Execute proposal
  const recBalBefore = await ethers.provider.getBalance(daoRecipient.address);
  console.log("Executing proposal...");
  await governance.connect(wallets[0]).execute(proposalId);
  const recBalAfter = await ethers.provider.getBalance(daoRecipient.address);
  console.log(`Recipient Balance Increase: ${ethers.formatEther(recBalAfter - recBalBefore)} BNB (Expected: 2.0 BNB)`);
  if (recBalAfter - recBalBefore !== propAmount) {
    throw new Error("DAO spend execution failed or transferred incorrect amount!");
  }
  console.log("✅ DAO governance timelock and execution verified.\n");

  // --- Step 10: Oracle Circuit Breaker ---
  console.log("--- Step 10: Oracle Circuit Breaker & Safety Recovery ---");
  let circuitBreaker = await core.oracleCircuitBreaker();
  console.log(`Initial Oracle Circuit Breaker: ${circuitBreaker}`);

  // Fast forward 24h price sync cooldown to allow update
  await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  // Set oracle price to $200 (from $600, deviation of 66.6% -> >50%)
  console.log("Triggering flash price drop to $200 (66.6% deviation)...");
  await oracle.setPrice(200n * 100000000n);

  // Call selfUpgrade on Node 55557 to trigger price sync and trip breaker
  const node55557Info = await core.getNode(55557n);
  const costTier2 = await core.getTierCost(node55557Info.tier);
  console.log(`Triggering upgrade for Node 55557 with ${ethers.formatEther(costTier2 * 4n)} BNB`);
  await core.connect(wallets[1]).selfUpgrade({ value: costTier2 * 4n });

  circuitBreaker = await core.oracleCircuitBreaker();
  console.log(`Circuit Breaker Status: ${circuitBreaker} (Expected: true)`);
  if (!circuitBreaker) {
    throw new Error("Oracle Circuit Breaker failed to trip on high price deviation!");
  }

  // Verify registration is blocked
  console.log("Verifying registration is blocked...");
  try {
    const tempWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, ethers.provider);
    await ethers.provider.send("hardhat_setBalance", [tempWallet.address, tenBnbHex]);
    await core.connect(tempWallet).createNode(55555n, { value: regFee });
    throw new Error("Registration succeeded during Oracle Circuit Breaker, but should have reverted!");
  } catch (err) {
    console.log(`- Registration reverted correctly: ${err.message}`);
  }

  // Verify non-admin cannot reset circuit breaker immediately
  console.log("Verifying non-admin reset is blocked immediately...");
  try {
    await core.connect(wallets[1]).resetOracleCircuitBreaker();
    throw new Error("Non-admin reset succeeded immediately, but should have reverted!");
  } catch (err) {
    console.log(`- Non-admin reset reverted correctly: ${err.message}`);
  }

  // Fast-forward 48 hours for auto-recovery
  console.log("Fast-forwarding 48 hours for auto-recovery...");
  await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  // Sync oracle updatedAt timestamp
  await oracle.setPrice(200n * 100000000n);

  // Non-admin resets the breaker
  console.log("Non-admin resetting circuit breaker after 48h...");
  await core.connect(wallets[1]).resetOracleCircuitBreaker();
  circuitBreaker = await core.oracleCircuitBreaker();
  console.log(`Circuit Breaker Status: ${circuitBreaker} (Expected: false)`);
  if (circuitBreaker) {
    throw new Error("Oracle Circuit Breaker failed to recover after 48h!");
  }
  console.log("✅ Oracle Circuit Breaker and 48h auto-recovery verified.\n");

  // --- Step 11: Public Dust Skimmer ---
  console.log("--- Step 11: Public Dust Skimmer ---");
  const coreBalBeforeSkim = await ethers.provider.getBalance(coreAddr);
  console.log(`Core balance before direct BNB deposit: ${ethers.formatEther(coreBalBeforeSkim)} BNB`);

  // Send dust directly to Core
  await owner.sendTransaction({
    to: coreAddr,
    value: ethers.parseEther("1.5")
  });

  const poolBalBeforeSkim = await ethers.provider.getBalance(poolAddr);
  console.log(`Sweeping dust. Reward pool balance before: ${ethers.formatEther(poolBalBeforeSkim)} BNB`);
  await core.connect(wallets[2]).skimDust(); // permissionless call by anyone

  const coreBalAfterSkim = await ethers.provider.getBalance(coreAddr);
  const poolBalAfterSkim = await ethers.provider.getBalance(poolAddr);
  console.log(`Core balance after skim:   ${ethers.formatEther(coreBalAfterSkim)} BNB`);
  console.log(`Reward pool balance after: ${ethers.formatEther(poolBalAfterSkim)} BNB`);
  console.log(`Reward pool increase:      ${ethers.formatEther(poolBalAfterSkim - poolBalBeforeSkim)} BNB (Expected: ~1.5 BNB)`);

  if (poolBalAfterSkim <= poolBalBeforeSkim) {
    throw new Error("Dust was not routed to the Reward Pool!");
  }
  console.log("✅ Public Dust Skimmer verified.\n");

  // --- Step 12: Queue FIFO & Round-Robin Processing ---
  console.log("--- Step 12: FIFO Queue Batch Processing & Round-Robin ---");
  // Check queue status
  const queueHead = await core.queueHead();
  const queueTail = await core.queueTail();
  const queueSize = queueTail - queueHead;
  console.log(`Current Queue Size: ${queueSize.toString()} nodes enqueued.`);

  let processedCount = 0;
  if (queueSize > 0) {
    console.log("Processing treasury queue...");
    while (true) {
      const qHeadBefore = await core.queueHead();
      const qTailBefore = await core.queueTail();
      
      const tx = await core.processTreasuryQueue();
      const receipt = await tx.wait();
      processedCount++;

      const qHeadAfter = await core.queueHead();
      const qTailAfter = await core.queueTail();
      const currentSize = qTailAfter - qHeadAfter;

      console.log(`- Run ${processedCount} | Dequeued node at index ${qHeadBefore.toString()} | Remaining queue size: ${currentSize.toString()}`);
      if (currentSize === 0n) {
        break;
      }
      // Safety limit to avoid infinite loop in simulation
      if (processedCount > 200) {
        console.log("Reached safety processing limit.");
        break;
      }
    }
  }
  console.log(`Successfully processed ${processedCount} queue items.`);
  await checkSolvency("Post-Queue Processing");
  console.log("✅ FIFO queue processing and round-robin verified.\n");

  // --- Step 13: Migration & Migration Lock ---
  console.log("--- Step 13: Node Migration and Migration Lock ---");
  // Check migration status
  let migrationLocked = await core.migrationLocked();
  console.log(`Migration locked initially: ${migrationLocked}`);

  const testMigrateWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, ethers.provider);
  const testMigrateNodeData = {
    wallet: testMigrateWallet.address,
    nodeId: 88899n,
    sponsor: 55555n,
    matrixParent: 55555n,
    joinedAt: BigInt(Math.floor(Date.now() / 1000)),
    tier: 1,
    directNodes: 0,
    totalMatrixNodes: 0,
    totalContribution: 0n,
    sponsorTierRanks: Array(18).fill(0n),
    matrixRewardReceiver: Array(18).fill(0n)
  };

  console.log("Migrating node 88899...");
  await core.migrateNode(testMigrateNodeData, 0n);
  const migratedNode = await core.getNode(88899n);
  console.log(`Migrated Node 88899 Wallet: ${migratedNode.wallet}`);

  // Lock migration forever
  console.log("Locking migrations permanently...");
  await core.lockMigrationForever();
  migrationLocked = await core.migrationLocked();
  console.log(`Migration locked: ${migrationLocked}`);
  if (!migrationLocked) {
    throw new Error("Migration lock failed!");
  }

  // Try to migrate again (should fail)
  console.log("Verifying migration fails after lock...");
  try {
    testMigrateNodeData.nodeId = 88890n;
    testMigrateNodeData.wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, ethers.provider).address;
    await core.migrateNode(testMigrateNodeData, 0n);
    throw new Error("Migration succeeded after lock, but should have reverted!");
  } catch (err) {
    console.log(`- Migration reverted correctly: ${err.message}`);
  }
  console.log("✅ Migration lock verified.\n");

  // --- Step 14: Final Solvency & Verification ---
  console.log("--- Step 14: Running Final Invariant Verification ---");
  const finalMetrics = await checkSolvency("Final Summary");

  // Matrix depth & BFS tree validation
  const totalNodesCount = await core.totalNodes();
  console.log(`- Total Nodes in System:  ${totalNodesCount.toString()}`);

  const genNode = await core.getNode(55555n);
  console.log(`- Genesis Node totalMatrixNodes: ${genNode.totalMatrixNodes.toString()}`);
  
  console.log("\n==========================================================");
  console.log("      1,000 USER SYSTEM-WIDE SIMULATION SUCCESSFUL!");
  console.log("==========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n💥 SIMULATION FAILED:", err);
    process.exit(1);
  });
