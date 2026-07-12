const { ethers } = require("hardhat");

async function main() {
  const [owner, feeRec] = await ethers.getSigners();

  console.log("==========================================================");
  console.log("  200 USERS × FULL TIER 18 UPGRADE SIMULATION");
  console.log("==========================================================");

  // ── Step 1: Deploy & Link All Contracts ──
  console.log("\n--- Step 1: Deploying & Linking Contracts ---");

  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();

  const ViewsFactory = await ethers.getContractFactory("aipcoreViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();

  const CoreFactory = await ethers.getContractFactory("aipcore", {
    libraries: { aipcoreViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    owner.address, feeRec.address, ethers.ZeroAddress,
    owner.address, owner.address, owner.address
  );
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();

  // Deploy AIPCoreViewsContract
  const VCFactory = await ethers.getContractFactory("AIPCoreViewsContract");
  const viewsContract = await VCFactory.deploy();
  await viewsContract.waitForDeployment();
  await core.setViewsContract(await viewsContract.getAddress());
  const coreI = await ethers.getContractAt("contracts/Iaipcore.sol:Iaipcore", coreAddr);

  const PoolFactory = await ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555n);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();

  await core.setAddr(0, feeRec.address, 0);
  await core.setAddr(1, poolAddr, 0);
  await core.setAddr(11, oracleAddr, 0);
  await core.setPriceBounds(100n * 100000000n, 10000000n * 100000000n);
  await oracle.setPrice(600n * 100000000n);
  console.log(`Core: ${coreAddr} | Pool: ${poolAddr} | Price: $600/BNB`);
  console.log("✅ All contracts deployed and linked.\n");

  // ── Solvency checker ──
  async function checkSolvency(label) {
    const bal = await ethers.provider.getBalance(coreAddr);
    const treas = await core.totalTreasuryBalance();
    const pend = await core.totalPendingRewards();
    const liab = treas + pend;
    const ok = bal >= liab;
    console.log(`[Solvency: ${label}]`);
    console.log(`  Balance: ${ethers.formatEther(bal)} BNB | Liabilities: ${ethers.formatEther(liab)} BNB | Surplus: ${ethers.formatEther(bal - liab)} BNB`);
    if (ok) {
      console.log(`  ✅ SOLVENT\n`);
    } else {
      throw new Error(`❌ INSOLVENT!`);
    }
    return { bal, treas, pend, liab };
  }

  await checkSolvency("Initial");

  // ── Step 2: Register 200 Users ──
  const userCount = 200;
  console.log(`--- Step 2: Registering ${userCount} Users ---`);
  const wallets = [];
  const nodeIds = [];
  const fundHex = ethers.toBeHex(ethers.parseEther("2000")); // 2000 BNB each (enough for all 18 tiers)

  for (let i = 0; i < userCount; i++) {
    const pkey = ethers.keccak256(ethers.toBeHex(i + 1, 32));
    const w = new ethers.Wallet(pkey, ethers.provider);
    wallets.push(w);
    await ethers.provider.send("hardhat_setBalance", [w.address, fundHex]);
  }

  const regFee = await core.getRegistrationFee();
  for (let i = 0; i < userCount; i++) {
    const sponsor = i === 0 ? 55555n : nodeIds[Math.floor(Math.random() * nodeIds.length)];
    await core.connect(wallets[i]).createNode(sponsor, { value: regFee });
    const nid = await core.nodeId(wallets[i].address);
    nodeIds.push(nid);
    if ((i + 1) % 50 === 0) console.log(`  Registered ${i + 1} / ${userCount}`);
  }
  console.log(`✅ All ${userCount} users registered.\n`);
  await checkSolvency("After Registration");

  // ── Step 3: Upgrade ALL users Tier 1→18 ──
  console.log(`--- Step 3: Upgrading ALL ${userCount} users to Tier 18 ---`);

  const tierCosts = [];
  for (let t = 0; t < 18; t++) {
    tierCosts.push(await coreI.getTierCost(t));
  }
  const totalPerUser = tierCosts.reduce((a, b) => a + b, 0n);
  console.log(`Total cost per user: ${ethers.formatEther(totalPerUser)} BNB`);
  console.log(`Total for ${userCount} users: ${ethers.formatEther(totalPerUser * BigInt(userCount))} BNB\n`);

  // Gas sampling
  const gasPerTier = new Array(18).fill(0n);
  const gasSamples = new Array(18).fill(0);

  for (let tier = 1; tier <= 18; tier++) {
    const tierStart = Date.now();
    const cost = tierCosts[tier - 1];
    let failCount = 0;

    for (let i = 0; i < userCount; i++) {
      try {
        const tx = await core.connect(wallets[i]).unlockTier(nodeIds[i], tier, { value: cost });
        // Only sample gas for first 5 users per tier to save memory
        if (gasSamples[tier - 1] < 5) {
          const receipt = await tx.wait();
          gasPerTier[tier - 1] += receipt.gasUsed;
          gasSamples[tier - 1]++;
        }
      } catch (err) {
        failCount++;
        if (failCount <= 2) {
          console.log(`  ⚠️ User ${i} Tier ${tier}: ${err.message?.slice(0, 100)}`);
        }
      }
    }

    const elapsed = ((Date.now() - tierStart) / 1000).toFixed(1);
    const avgGas = gasSamples[tier - 1] > 0 ? gasPerTier[tier - 1] / BigInt(gasSamples[tier - 1]) : 0n;
    console.log(`  Tier ${String(tier).padStart(2)}: ${userCount - failCount}/${userCount} ✅ | Gas: ${avgGas} | ${elapsed}s${failCount > 0 ? ` | ⚠️ ${failCount} fail` : ''}`);

    // Solvency checks at milestones
    if ([1, 3, 6, 9, 12, 15, 18].includes(tier)) {
      await checkSolvency(`Tier ${tier}`);
    }
  }

  // ── Step 4: Verify Final State ──
  console.log("--- Step 4: Final State Verification ---");

  // Check ALL nodes are at Tier 18
  let tier18Count = 0;
  let notTier18 = [];
  for (let i = 0; i < userCount; i++) {
    const node = await core.nodes(nodeIds[i]);
    if (Number(node.tier) === 18) {
      tier18Count++;
    } else {
      notTier18.push({ id: nodeIds[i], tier: Number(node.tier) });
    }
  }
  console.log(`\nNodes at Tier 18: ${tier18Count} / ${userCount}`);
  if (notTier18.length > 0 && notTier18.length <= 10) {
    notTier18.forEach(n => console.log(`  Node ${n.id}: Tier ${n.tier}`));
  } else if (notTier18.length > 10) {
    console.log(`  ${notTier18.length} nodes not at Tier 18 (showing first 5):`);
    notTier18.slice(0, 5).forEach(n => console.log(`  Node ${n.id}: Tier ${n.tier}`));
  }

  if (tier18Count === userCount) {
    console.log("✅ ALL users confirmed at Tier 18!");
  } else {
    console.log(`⚠️ ${userCount - tier18Count} users did not reach Tier 18`);
  }

  // Treasury stats
  let treasuryNodes = 0;
  let treasuryTotal = 0n;
  for (let i = 0; i < userCount; i++) {
    const bal = await core.treasuryBalance(nodeIds[i]);
    if (bal > 0n) {
      treasuryNodes++;
      treasuryTotal += bal;
    }
  }
  console.log(`\nNodes with treasury balance: ${treasuryNodes}`);
  console.log(`Total treasury held: ${ethers.formatEther(treasuryTotal)} BNB`);

  // Genesis
  const genesis = await core.nodes(55555n);
  const genesisTreasury = await core.treasuryBalance(55555n);
  console.log(`\nGenesis (55555): Tier ${genesis.tier} | Direct: ${genesis.directNodes} | Treasury: ${ethers.formatEther(genesisTreasury)} BNB`);

  // Queue processing
  console.log(`\nProcessing treasury queue...`);
  try {
    const tx = await core.connect(owner).processTreasuryQueue();
    const r = await tx.wait();
    console.log(`  ✅ Queue processed (gas: ${r.gasUsed})`);
  } catch (err) {
    console.log(`  Queue empty or nothing to process.`);
  }

  // ── Step 5: Gas Summary ──
  console.log("\n--- Gas Summary ---");
  console.log("┌──────────┬────────────────┬─────────────────────┐");
  console.log("│   Tier   │  Avg Gas Used  │   Tier Cost (BNB)   │");
  console.log("├──────────┼────────────────┼─────────────────────┤");
  for (let t = 0; t < 18; t++) {
    const avg = gasSamples[t] > 0 ? gasPerTier[t] / BigInt(gasSamples[t]) : 0n;
    console.log(`│  Tier ${String(t + 1).padStart(2)}  │  ${String(avg).padStart(12)}  │  ${ethers.formatEther(tierCosts[t]).padStart(17)}  │`);
  }
  console.log("└──────────┴────────────────┴─────────────────────┘");

  // ── Final ──
  const final = await checkSolvency("FINAL");

  console.log("==========================================================");
  console.log(`  🎉 ${userCount} USERS × TIER 18 SIMULATION COMPLETE!`);
  console.log(`  Users at Tier 18 : ${tier18Count} / ${userCount}`);
  console.log(`  Contract Balance : ${ethers.formatEther(final.bal)} BNB`);
  console.log(`  Total Liabilities: ${ethers.formatEther(final.liab)} BNB`);
  console.log(`  Surplus          : ${ethers.formatEther(final.bal - final.liab)} BNB`);
  console.log("==========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
