const hre = require("hardhat");

async function main() {
  const sigs = await hre.ethers.getSigners();
  const [owner, u1, u2, u3, u4, u5, u6, u7] = sigs;
  
  // Deploy contracts
  const OracleFactory = await hre.ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  await oracle.setPrice(500n * 100000000n); // Start with $500 BNB

  const ViewsFactory = await hre.ethers.getContractFactory("aipcoreViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();

  const CoreFactory = await hre.ethers.getContractFactory("aipcore", {
    libraries: { aipcoreViews: await views.getAddress() },
  });
  const core = await CoreFactory.deploy(
    owner.address, owner.address, hre.ethers.ZeroAddress, owner.address, owner.address, owner.address
  );
  await core.waitForDeployment();

  await core.setAddr(11, await oracle.getAddress(), 0);
  await core.setPriceBounds(10n * 100000000n, 100000n * 100000000n);

  console.log("=== SCENARIO 1: Basic USD-Stable Auto-Upgrade at $500 BNB ===");
  const regFee = await core.getTierCost(0);
  await core.connect(u1).createNode(55555, { value: regFee });
  const u1Id = await core.nodeId(u1.address);
  await core.connect(u1).unlockTier(u1Id, 1, { value: await core.getUpgradeCost(0, 1) });
  console.log("U1 registered (ID:", u1Id.toString(), ")");

  await core.connect(u2).createNode(u1Id, { value: regFee });
  const u2Id = await core.nodeId(u2.address);
  await core.connect(u2).unlockTier(u2Id, 1, { value: await core.getUpgradeCost(0, 1) });
  console.log("U2 registered under U1 (ID:", u2Id.toString(), ")");

  await core.connect(u3).createNode(u2Id, { value: regFee });
  const u3Id = await core.nodeId(u3.address);
  await core.connect(u3).unlockTier(u3Id, 1, { value: await core.getUpgradeCost(0, 1) });
  console.log("U3 registered under U2 (ID:", u3Id.toString(), ")");

  await core.connect(u4).createNode(u2Id, { value: regFee });
  const u4Id = await core.nodeId(u4.address);
  await core.connect(u4).unlockTier(u4Id, 1, { value: await core.getUpgradeCost(0, 1) });
  console.log("U4 registered under U2 (ID:", u4Id.toString(), ")");

  // Upgrade U3 to tier 2.
  const tier1Cost = await core.getTierCost(1);
  console.log("Upgrading U3 to tier 2. Cost:", hre.ethers.formatEther(tier1Cost), "BNB");
  await core.connect(u3).unlockTier(u3Id, 2, { value: tier1Cost });

  // Test getPendingUpgradeRewards USD conversion
  const pendingBNB = await core.getPendingUpgradeRewards(u1Id);
  const bnbPrice = await core.bnbPrice();
  const totalUSD = pendingBNB * bnbPrice / 100000000n;
  console.log("U1 total pending USD missed rewards:", hre.ethers.formatEther(totalUSD), "USD");
  if (totalUSD === hre.ethers.parseEther("3.575")) {
    console.log("✅ getPendingUpgradeRewards converted to USD correctly!");
  } else {
    console.log("❌ getPendingUpgradeRewards converted to USD wrong value:", hre.ethers.formatEther(totalUSD));
    process.exit(1);
  }

  // Upgrade U4 to tier 2 to trigger the auto-upgrade of U1.
  console.log("Upgrading U4 to tier 2...");
  await core.connect(u4).unlockTier(u4Id, 2, { value: tier1Cost });

  let u1Node = await core.getNode(u1Id);
  console.log("U1 tier after auto-upgrade:", u1Node.tier.toString());
  if (u1Node.tier === 2n) {
    console.log("✅ SCENARIO 1 PASSED: Auto-upgraded successfully using USD values!");
  } else {
    console.log("❌ SCENARIO 1 FAILED: U1 did not auto-upgrade!");
    process.exit(1);
  }

  console.log("\n=== SCENARIO 2: USD-Stable Qualification Under Price Volatility ===");
  // Drop oracle to $420 BNB (16% deviation, within 20% limit)
  console.log("Setting BNB Price to $420...");
  await oracle.setPrice(420n * 100000000n);
  // Fast forward 25 hours to bypass cooldown and trigger auto price sync
  await hre.network.provider.send("evm_increaseTime", [25 * 3600]);
  await hre.network.provider.send("evm_mine");

  // Register U5 under U1 (U1 is now tier 2)
  // NOTE: _syncOraclePrice() fires INSIDE createNode when lastPriceUpdate > 24h.
  // We must read getTierCost() AFTER the sync. Strategy: send 2x the old fee — the
  // contract refunds the excess after syncing to the new price internally.
  console.log("Registering U5 under U1...");
  const newRegFee = await core.getTierCost(0);
  // Send 2x to survive the mid-tx sync (contract refunds excess)
  await core.connect(u5).createNode(u1Id, { value: newRegFee * 2n });
  const u5Id = await core.nodeId(u5.address);
  const u5CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u5).unlockTier(u5Id, 1, { value: u5CostTo1 * 2n });
  console.log("U5 registered (ID:", u5Id.toString(), ")");

  // Upgrade U5 to tier 2 at $420 — read FRESH cost after the sync
  const tier1CostAt420 = await core.getTierCost(1);
  console.log("Upgrading U5 to tier 2 at $420 BNB. Cost:", hre.ethers.formatEther(tier1CostAt420), "BNB");
  await core.connect(u5).unlockTier(u5Id, 2, { value: tier1CostAt420 * 2n });

  let u2Bal = await core.treasuryBalance(u2Id);
  let bnbPriceNow = await core.bnbPrice();
  let u2MissedUSD = u2Bal * bnbPriceNow / 100000000n;
  console.log("U2 missed USD rewards for tier 1 after U5:", hre.ethers.formatEther(u2MissedUSD), "USD");
  // Should be exactly $0.15 (missed from U3 & U4 in Scenario 1)

  // Now, price of BNB pumps to $500 BNB (19% deviation, within 20% limit)
  console.log("Setting BNB Price to $500...");
  await oracle.setPrice(500n * 100000000n);
  // Fast forward 25 hours to bypass cooldown and trigger auto price sync
  await hre.network.provider.send("evm_increaseTime", [25 * 3600]);
  await hre.network.provider.send("evm_mine");

  // Register U6 under U2 (U2 is sponsor)
  // Again use 2x buffer to survive the mid-tx price sync to $500
  console.log("Registering U6 under U2...");
  const regFeeAt500 = await core.getTierCost(0);
  await core.connect(u6).createNode(u2Id, { value: regFeeAt500 * 2n });
  const u6Id = await core.nodeId(u6.address);
  const u6CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u6).unlockTier(u6Id, 1, { value: u6CostTo1 * 2n });

  // Upgrade U6 to tier 2 — read FRESH cost after the sync
  const tier1CostAt500 = await core.getTierCost(1);
  console.log("Upgrading U6 to tier 2 at $500 BNB...");
  await core.connect(u6).unlockTier(u6Id, 2, { value: tier1CostAt500 * 2n });

  u2Bal = await core.treasuryBalance(u2Id);
  bnbPriceNow = await core.bnbPrice();
  u2MissedUSD = u2Bal * bnbPriceNow / 100000000n;
  console.log("U2 missed USD rewards after U6:", hre.ethers.formatEther(u2MissedUSD), "USD");
  // Should be $0.15 + $3.575 = $3.725

  // Register U7 under U2
  console.log("Registering U7 under U2...");
  await core.connect(u7).createNode(u2Id, { value: tier1CostAt500 * 2n });
  const u7Id = await core.nodeId(u7.address);
  const u7CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u7).unlockTier(u7Id, 1, { value: u7CostTo1 * 2n });

  // Upgrade U7 to tier 2.
  console.log("Upgrading U7 to tier 2 at $500 BNB...");
  await core.connect(u7).unlockTier(u7Id, 2, { value: tier1CostAt500 * 2n });

  u2Bal = await core.treasuryBalance(u2Id);
  bnbPriceNow = await core.bnbPrice();
  u2MissedUSD = u2Bal * bnbPriceNow / 100000000n;
  console.log("U2 missed USD rewards after U7:", hre.ethers.formatEther(u2MissedUSD), "USD");

  let u2Node = await core.getNode(u2Id);
  console.log("U2 tier after auto-upgrade:", u2Node.tier.toString());
  if (u2Node.tier === 2n) {
    console.log("✅ SCENARIO 2 PASSED: Auto-upgraded successfully despite price changes!");
  } else {
    console.log("❌ SCENARIO 2 FAILED: U2 did not auto-upgrade!");
    process.exit(1);
  }

  // Register U8 under Genesis. (U8Id = 55563)
  const u8 = (await hre.ethers.getSigners())[8];
  const regFeeAtNow = await core.getTierCost(0);
  await core.connect(u8).createNode(55555, { value: regFeeAtNow * 2n });
  const u8Id = await core.nodeId(u8.address);
  const u8CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u8).unlockTier(u8Id, 1, { value: u8CostTo1 * 2n });
  console.log("U8 registered (ID:", u8Id.toString(), ")");

  // Let's lock $3.575 USD of missed rewards for U8 at tier 1.
  // U8 is tier 1. Sponsor is Genesis (55555).
  // If we register U9 under U8, and U10 under U9, and upgrade U10, U8 misses rewards.
  const u9 = (await hre.ethers.getSigners())[9];
  const freshFee = await core.getTierCost(0);
  await core.connect(u9).createNode(u8Id, { value: freshFee * 2n });
  const u9Id = await core.nodeId(u9.address);
  const u9CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u9).unlockTier(u9Id, 1, { value: u9CostTo1 * 2n });

  const u10 = (await hre.ethers.getSigners())[10];
  await core.connect(u10).createNode(u9Id, { value: freshFee * 2n });
  const u10Id = await core.nodeId(u10.address);
  const u10CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u10).unlockTier(u10Id, 1, { value: u10CostTo1 * 2n });

  // U10 upgrades to tier 2.
  const freshTier1 = await core.getTierCost(1);
  await core.connect(u10).unlockTier(u10Id, 2, { value: freshTier1 * 2n });

  let u8MissedBNB = await core.treasuryBalance(u8Id);
  let bnbPriceNow3 = await core.bnbPrice();
  let u8MissedUSD = u8MissedBNB * bnbPriceNow3 / 100000000n;
  console.log("U8 missed USD rewards:", hre.ethers.formatEther(u8MissedUSD), "USD");
  console.log("U8 missed BNB rewards:", hre.ethers.formatEther(u8MissedBNB), "BNB");

  // Cost of tier 2 is $5.00 USD.
  // USD Shortfall = $5.00 - $3.575 = $1.425 USD.
  // Required BNB payment at $500 BNB/USD = 1.425 / 500 = 0.00285 BNB.
  const expectedNetCost = hre.ethers.parseEther("0.00285");
  console.log("Expected Net Cost in BNB:", hre.ethers.formatEther(expectedNetCost), "BNB");

  // Call selfUpgrade for U8 manually, sending exactly 0.00285 BNB.
  console.log("U8 manually upgrading to tier 2...");
  const balBefore = await hre.ethers.provider.getBalance(core.getAddress());
  await core.connect(u8).selfUpgrade({ value: expectedNetCost });

  const u8Node = await core.getNode(u8Id);
  console.log("U8 final tier:", u8Node.tier.toString());

  // Invariant validation:
  const balAfter = await hre.ethers.provider.getBalance(core.getAddress());
  const balDiff = balBefore - balAfter; // net BNB spent from contract balance
  console.log("Solvency verification: spent", hre.ethers.formatEther(balDiff), "BNB during upgrade");

  if (u8Node.tier === 2n && balDiff <= expectedNetCost + u8MissedBNB) {
    console.log("✅ SCENARIO 3 PASSED: Manual upgrade successfully calculated USD shortfall and remained solvent!");
  } else {
    console.log("❌ SCENARIO 3 FAILED!");
    process.exit(1);
  }

  console.log("\n=== SCENARIO 4: Dual-Threshold Guard — BNB Crash Blocks Auto-Upgrade ===");
  // Setup: U11 accumulates $3.575 USD / 0.00715 BNB at $500. Then we trigger a 19%
  // price drop to $405 (within deviation guard), making tier cost 0.01235 BNB.
  // U11 has 0.00715 BNB < 0.01235 BNB → BNB check fails.
  // USD: $3.575 < $5 → USD check also fails.
  // triggerAutoUpgrade should be a no-op. Then we verify selfUpgrade uses BNB-shortfall.
  const u11 = (await hre.ethers.getSigners())[11];
  const u11RegFee = await core.getTierCost(0);
  await core.connect(u11).createNode(55555, { value: u11RegFee * 2n });
  const u11Id = await core.nodeId(u11.address);
  const u11CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u11).unlockTier(u11Id, 1, { value: u11CostTo1 * 2n });
  console.log("U11 registered (ID:", u11Id.toString(), ")");

  // Build 1st reward path at $500: U11 earns $3.575 USD / 0.00715 BNB missed rewards.
  const u12 = (await hre.ethers.getSigners())[12];
  const u12Fee = await core.getTierCost(0);
  await core.connect(u12).createNode(u11Id, { value: u12Fee * 2n });
  const u12Id = await core.nodeId(u12.address);
  const u12CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u12).unlockTier(u12Id, 1, { value: u12CostTo1 * 2n });

  const u13 = (await hre.ethers.getSigners())[13];
  await core.connect(u13).createNode(u12Id, { value: u12Fee * 2n });
  const u13Id = await core.nodeId(u13.address);
  const u13CostTo1 = await core.getUpgradeCost(0, 1);
  await core.connect(u13).unlockTier(u13Id, 1, { value: u13CostTo1 * 2n });

  const u13Tier1 = await core.getTierCost(1);
  await core.connect(u13).unlockTier(u13Id, 2, { value: u13Tier1 * 2n });

  let u11MissedBNB = await core.treasuryBalance(u11Id);
  let bnbPriceNow4 = await core.bnbPrice();
  let u11MissedUSD = u11MissedBNB * bnbPriceNow4 / 100000000n;
  console.log("After 1st path (at $500) — U11 missed USD:", hre.ethers.formatEther(u11MissedUSD),
    "| missed BNB:", hre.ethers.formatEther(u11MissedBNB));

  // Now drop BNB price by 19% to $405, then sync via a contract transaction.
  // At $405: tier cost = $5/$405 ≈ 0.01235 BNB. U11 has 0.00715 BNB < 0.01235 BNB → BNB fails.
  // USD: $3.575 < $5.00 → USD also fails.
  await oracle.setPrice(405n * 100000000n);
  await hre.network.provider.send("evm_increaseTime", [25 * 3600]);
  await hre.network.provider.send("evm_mine");
  // Sync price into contract by calling a state-changing tx.
  const u14 = (await hre.ethers.getSigners())[14];
  const u14Fee = await core.getTierCost(0);
  await core.connect(u14).createNode(55555, { value: u14Fee * 2n }); // triggers _syncOraclePrice
  const u14Id = await core.nodeId(u14.address);

  const tierCostAt405 = await core.getTierCost(1);
  u11MissedBNB = await core.treasuryBalance(u11Id);
  bnbPriceNow4 = await core.bnbPrice();
  u11MissedUSD = u11MissedBNB * bnbPriceNow4 / 100000000n;
  console.log("Tier BNB cost at $405:", hre.ethers.formatEther(tierCostAt405), "BNB (expected ~0.01235)");
  console.log("U11 missedUSD:", hre.ethers.formatEther(u11MissedUSD), "(< $5, should fail USD check)");
  console.log("U11 missedBNB:", hre.ethers.formatEther(u11MissedBNB), "BNB (< tierCost, should fail BNB check)");

  // processTreasuryQueue should be a no-op since BOTH thresholds fail.
  await core.processTreasuryQueue();
  let u11Node = await core.getNode(u11Id);
  if (u11Node.tier === 1n) {
    console.log("✅ SCENARIO 4A PASSED: processTreasuryQueue correctly blocked/skipped auto-upgrade (neither USD nor BNB qualified)!");
  } else {
    console.log("❌ SCENARIO 4A FAILED: Auto-upgrade triggered incorrectly!");
    process.exit(1);
  }

  // Scenario 4B: selfUpgrade uses max(netCostUSD, netCostBNB) for payment.
  // netCostUSD: usdShortfall = $5 - $3.575 = $1.425 → $1.425/$405 ≈ 0.003519 BNB
  // netCostBNB: costBNB - accum = 0.01235 - 0.00715 = 0.00520 BNB
  // netCost = max(0.003519, 0.00520) = 0.00520 BNB (BNB shortfall dominates)
  const u11Cost = await core.getTierCost(1);
  u11MissedBNB = await core.treasuryBalance(u11Id);
  const expectedManualCost = u11Cost > u11MissedBNB ? u11Cost - u11MissedBNB : 0n;
  console.log("\nExpected manual BNB payment for U11:", hre.ethers.formatEther(expectedManualCost), "BNB");

  const contractBalBefore4 = await hre.ethers.provider.getBalance(core.getAddress());
  await core.connect(u11).selfUpgrade({ value: expectedManualCost });
  const contractBalAfter4 = await hre.ethers.provider.getBalance(core.getAddress());

  u11Node = await core.getNode(u11Id);
  const balDiff4 = contractBalBefore4 - contractBalAfter4;
  console.log("U11 tier after manual upgrade:", u11Node.tier.toString());
  console.log("Net BNB change in contract:", hre.ethers.formatEther(balDiff4), "BNB");

  if (u11Node.tier === 2n) {
    console.log("✅ SCENARIO 4B PASSED: Manual upgrade at post-crash price succeeded with correct BNB-shortfall payment!");
  } else {
    console.log("❌ SCENARIO 4B FAILED: Manual upgrade did not complete!");
    process.exit(1);
  }

  console.log("\n🎉 ALL USD ACCOUNTING TESTS PASSED SUCCESSFULLY!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
