const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const tenBnbHex = ethers.toBeHex(ethers.parseEther("10"));

  console.log("==========================================================");
  console.log("      5,000 USER ICE SYSTEM-WIDE SIMULATION (SEQUENTIAL)");
  console.log("==========================================================");

  // --- Step 1: Deploy & Link All Contracts ---
  console.log("\n--- Step 1: Deploying & Linking Contracts ---");

  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log(`- Mock Price Oracle: ${oracleAddr}`);

  const ViewsFactory = await ethers.getContractFactory("aipcoreViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();
  console.log(`- Views Library: ${viewsAddr}`);

  const CoreFactory = await ethers.getContractFactory("aipcore", {
    libraries: { aipcoreViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    owner.address, owner.address, ethers.ZeroAddress,
    owner.address, owner.address, owner.address
  );
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();
  console.log(`- Core Contract: ${coreAddr}`);

  // Deploy and link AIPCoreViewsContract
  const ViewsContractFactory = await ethers.getContractFactory("AIPCoreViewsContract");
  const viewsContract = await ViewsContractFactory.deploy();
  await viewsContract.waitForDeployment();
  await core.setViewsContract(await viewsContract.getAddress());

  // Create core instance with full interface ABI (routes getTierCost via fallback)
  const coreWithViews = await ethers.getContractAt("contracts/Iaipcore.sol:Iaipcore", coreAddr);

  const PoolFactory = await ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555n);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`- Reward Pool: ${poolAddr}`);

  const VaultFactory = await ethers.getContractFactory("NFEVestingVault");
  const vestingVault = await VaultFactory.deploy(owner.address, coreAddr, poolAddr, owner.address);
  await vestingVault.waitForDeployment();
  const vaultAddr = await vestingVault.getAddress();
  console.log(`- Vesting Vault: ${vaultAddr}`);

  const CMFactory = await ethers.getContractFactory("NFECycleManager");
  const cycleManager = await CMFactory.deploy(owner.address);
  await cycleManager.waitForDeployment();
  const cmAddr = await cycleManager.getAddress();
  console.log(`- Cycle Manager: ${cmAddr}`);

  const REFactory = await ethers.getContractFactory("NFERenewalEngine");
  const renewalEngine = await REFactory.deploy(owner.address, coreAddr, vaultAddr, cmAddr);
  await renewalEngine.waitForDeployment();
  const engineAddr = await renewalEngine.getAddress();
  console.log(`- Renewal Engine: ${engineAddr}`);

  console.log("Configuring contracts...");
  await core.connect(owner).setGovernor(owner.address);
  await core.connect(owner).setVault(vaultAddr);
  await core.connect(owner).setCycleManager(cmAddr);
  await core.connect(owner).setRenewalEngine(engineAddr);
  await core.connect(owner).setAddr(1, poolAddr, 0);
  await core.connect(owner).setAddr(11, oracleAddr, 0);
  await core.connect(owner).setPriceBounds(100n * 100000000n, 10000n * 100000000n);
  await vestingVault.connect(owner).setRenewalEngine(engineAddr);
  await cycleManager.connect(owner).setRenewalEngine(engineAddr);
  await oracle.setPrice(300n * 100000000n);

  // Zero-out the registration fee so unfunded wallets can register
  await core.connect(owner).setRegistrationFeeUSD(0);

  console.log("Linked and configured all contracts successfully.\n");

  // Solvency Invariant Checker
  async function checkSolvency(milestone) {
    const coreBal = await ethers.provider.getBalance(coreAddr);
    const vaultBal = await ethers.provider.getBalance(vaultAddr);
    const totalTreasury = await core.totalTreasuryBalance();
    const totalPending = await core.totalPendingRewards();
    const totalLiabilities = totalTreasury + totalPending;

    console.log(`[Solvency Invariant Check - ${milestone}]`);
    console.log(`  - Core Balance           : ${ethers.formatEther(coreBal)} BNB`);
    console.log(`  - Vault Balance          : ${ethers.formatEther(vaultBal)} BNB`);
    console.log(`  - Total Treasury Balance : ${ethers.formatEther(totalTreasury)} BNB`);
    console.log(`  - Total Pending Rewards  : ${ethers.formatEther(totalPending)} BNB`);
    console.log(`  - Total Liabilities      : ${ethers.formatEther(totalLiabilities)} BNB`);

    if (coreBal >= totalLiabilities) {
      console.log("  ✅ Solvency Check PASSED.");
    } else {
      throw new Error(`CRITICAL: Core balance (${ethers.formatEther(coreBal)} BNB) < liabilities (${ethers.formatEther(totalLiabilities)} BNB)!`);
    }
  }

  await checkSolvency("Initial Deploy");

  // --- Step 2: Sequential Registration of 5,000 Users ---
  console.log("\n--- Step 2: Registering 5,000 Users (Sequential, Zero Gas) ---");
  const walletCount = 5000;
  const registeredNodeIds = [55555n]; // Genesis is seed sponsor
  let totalGas = 0n;
  let sampleCount = 0;

  for (let i = 0; i < walletCount; i++) {
    const pkey = ethers.keccak256(ethers.toBeHex(i, 32));
    const wallet = new ethers.Wallet(pkey, ethers.provider);

    const sponsorId = registeredNodeIds[Math.floor(Math.random() * registeredNodeIds.length)];

    const tx = await core.connect(wallet).createNode(sponsorId, {
      value: 0,
      gasPrice: 0,
      gasLimit: 5000000,
    });

    const nodeId = 55556n + BigInt(i);
    registeredNodeIds.push(nodeId);

    const receipt = await tx.wait();
    // Sample gas for first 100 only
    if (i < 100) {
      totalGas += receipt.gasUsed;
      sampleCount++;
    }

    if (global.gc && i % 200 === 0) global.gc();

    if (i > 0 && i % 2000 === 0) {
      console.log(`  - Registered ${i} / ${walletCount} users...`);
    }
  }

  console.log(`Registration Complete: ${walletCount} nodes registered.`);
  console.log(`- Sampled avg gas (first 100): ${sampleCount > 0 ? totalGas / BigInt(sampleCount) : 0n}`);

  await checkSolvency("Registration Complete");

  // --- Step 3: Upgrade 500 unique nodes to Tier 1 ---
  console.log("\n--- Step 3: Upgrading 500 nodes to Tier 1 ---");
  let upgradeGas = 0n;
  let upgradeSampleCount = 0;
  const upgradeCount = 500;
  const upgradedSet = new Set(); // deduplicate: skip already-upgraded nodes
  let upgradesCompleted = 0;
  let attempts = 0;
  const maxAttempts = upgradeCount * 10; // safety valve

  while (upgradesCompleted < upgradeCount && attempts < maxAttempts) {
    attempts++;
    const idx = Math.floor(Math.random() * walletCount);
    const nodeId = registeredNodeIds[idx + 1]; // +1 to skip Genesis

    // Skip if we've already upgraded this node in this loop
    if (upgradedSet.has(Number(nodeId))) continue;

    // Check on-chain tier to skip nodes already at Tier >= 1
    const nodeData = await core.nodes(nodeId);
    // nodes() returns a tuple; tier is the 6th field (index 5)
    if (nodeData.tier >= 1n) {
      upgradedSet.add(Number(nodeId));
      continue;
    }

    const pkey = ethers.keccak256(ethers.toBeHex(idx, 32));
    const wallet = new ethers.Wallet(pkey, ethers.provider);

    // Fund wallet and get cost fresh each iteration (price may drift)
    const cost = await coreWithViews.getTierCost(0);
    await ethers.provider.send("hardhat_setBalance", [wallet.address, tenBnbHex]);

    // Let Hardhat auto-estimate gas — block limit is 100M, no artificial cap
    const tx = await core.connect(wallet).unlockTier(nodeId, 1, { value: cost, gasLimit: 15000000 });
    const receipt = await tx.wait();

    upgradedSet.add(Number(nodeId));
    upgradesCompleted++;

    if (upgradesCompleted <= 20) {
      upgradeGas += receipt.gasUsed;
      upgradeSampleCount++;
    }

    if (upgradesCompleted % 100 === 0) {
      console.log(`  - Upgraded ${upgradesCompleted} / ${upgradeCount} nodes...`);
    }

    if (global.gc && upgradesCompleted % 100 === 0) global.gc();
  }

  console.log(`Completed ${upgradesCompleted} upgrades (${attempts} attempts).`);
  console.log(`- Sampled avg upgrade gas: ${upgradeSampleCount > 0 ? upgradeGas / BigInt(upgradeSampleCount) : 0n}`);

  await checkSolvency("Upgrades Complete");

  // --- Step 4: Time Travel 360 days ---
  console.log("\n--- Step 4: Fast-forwarding 360 days ---");
  await ethers.provider.send("evm_increaseTime", [360 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");

  const testNodeId = registeredNodeIds[11];
  const isActiveBefore = await cycleManager.isActive(testNodeId);
  console.log(`Node ${testNodeId} active after 360d: ${isActiveBefore} (Expected: false)`);

  const batchExpireIds = registeredNodeIds.slice(1, 101); // skip Genesis
  const txExpire = await cycleManager.connect(owner).batchCheckAndExpire(batchExpireIds);
  await txExpire.wait();
  console.log("✅ Batch expired 100 nodes via keeper.");

  // --- Step 5: 3-Priority Renewal Simulation ---
  console.log("\n--- Step 5: 3-Priority Renewal Simulation ---");
  const renewalCost = await renewalEngine.getRenewalCost();

  let nodeTreasury = 0n;
  for (let i = 1; i < registeredNodeIds.length; i++) {
    const id = registeredNodeIds[i];
    const bal = await core.treasuryBalance(id);
    if (bal >= renewalCost) { nodeTreasury = id; break; }
  }

  let nodeVault = 0n;
  for (let i = 1; i < registeredNodeIds.length; i++) {
    const id = registeredNodeIds[i];
    if (id === nodeTreasury) continue;
    const bal = await vestingVault.getVestedBalance(id);
    if (bal >= renewalCost) { nodeVault = id; break; }
  }

  let nodeWalletId = 0n;
  for (let i = 1; i < registeredNodeIds.length; i++) {
    const id = registeredNodeIds[i];
    if (id !== nodeTreasury && id !== nodeVault) { nodeWalletId = id; break; }
  }

  if (nodeTreasury > 0n) {
    const idx = registeredNodeIds.indexOf(nodeTreasury) - 1;
    const wallet = new ethers.Wallet(ethers.keccak256(ethers.toBeHex(idx, 32)), ethers.provider);
    await ethers.provider.send("hardhat_setBalance", [wallet.address, tenBnbHex]);
    console.log(`Renewing Node ${nodeTreasury} via Treasury (P1)...`);
    const tx = await renewalEngine.connect(wallet).renewFor(nodeTreasury, { value: 0 });
    const r = await tx.wait();
    console.log(`  - Gas: ${r.gasUsed}, Active: ${await cycleManager.isActive(nodeTreasury)}`);
  } else {
    console.log("Skipping Treasury renewal (no qualifying node).");
  }

  if (nodeVault > 0n) {
    const idx = registeredNodeIds.indexOf(nodeVault) - 1;
    const wallet = new ethers.Wallet(ethers.keccak256(ethers.toBeHex(idx, 32)), ethers.provider);
    await ethers.provider.send("hardhat_setBalance", [wallet.address, tenBnbHex]);
    console.log(`Renewing Node ${nodeVault} via Vault (P2)...`);
    const tx = await renewalEngine.connect(wallet).renewFor(nodeVault, { value: 0 });
    const r = await tx.wait();
    console.log(`  - Gas: ${r.gasUsed}, Active: ${await cycleManager.isActive(nodeVault)}`);
  } else {
    console.log("Skipping Vault renewal (no qualifying node).");
  }

  if (nodeWalletId > 0n) {
    const idx = registeredNodeIds.indexOf(nodeWalletId) - 1;
    const pkey = ethers.keccak256(ethers.toBeHex(idx, 32));
    const wallet = new ethers.Wallet(pkey, ethers.provider);
    await ethers.provider.send("hardhat_setBalance", [wallet.address, tenBnbHex]);
    console.log(`Renewing Node ${nodeWalletId} via Wallet (P3)...`);
    const tx = await renewalEngine.connect(wallet).renewFor(nodeWalletId, { value: renewalCost });
    const r = await tx.wait();
    console.log(`  - Gas: ${r.gasUsed}, Active: ${await cycleManager.isActive(nodeWalletId)}`);
  } else {
    console.log("Skipping Wallet renewal.");
  }

  await checkSolvency("Post-Renewals");

  // --- Step 6: Governance Timelock ---
  console.log("\n--- Step 6: Governance & Dormancy Sweeps ---");
  const GovFactory = await ethers.getContractFactory("NFEGovernance");
  const governance = await GovFactory.deploy(coreAddr, owner.address);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log(`- Governance: ${govAddr}`);

  await core.connect(owner).setGovernor(govAddr);

  const calldata = core.interface.encodeFunctionData("setDormancyPeriod", [365n * 24n * 3600n]);
  const txProp = await governance.connect(owner).propose(coreAddr, calldata, "Set dormancy 365d");
  const rProp = await txProp.wait();
  const ev = rProp.logs.map(l => { try { return governance.interface.parseLog(l); } catch { return null; } })
    .find(e => e && e.name === "ProposalCreated");
  const propId = ev.args.proposalId;

  await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 10]);
  await ethers.provider.send("evm_mine");
  await governance.connect(owner).execute(propId);
  console.log(`Dormancy configured: ${await core.dormancyPeriod()} seconds`);

  // --- Step 7: Final Solvency Check ---
  console.log("\n--- Step 7: Final System Verification ---");
  await checkSolvency("Simulation Final");

  console.log("\n==========================================================");
  console.log("      5,000 USER ICE SIMULATION COMPLETED SUCCESSFULLY!");
  console.log("==========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
