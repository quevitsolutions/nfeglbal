const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  const network = hre.network.name;
  const filename = `deployment_${network}.json`;
  const deploymentPath = path.join(__dirname, `../${filename}`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`❌ ${filename} not found! Run deploy.js first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log(`\n🚀 Deploying V3 Addons to ${network.toUpperCase()}...`);

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  const symbol = network === "polygon" ? "POL" : "BNB";
  console.log("Balance :", hre.ethers.formatEther(balance), `${symbol}\n`);

  // Calculate gas overrides for Polygon & BSC
  const feeData = await hre.ethers.provider.getFeeData();
  
  let currentGasPrice = 50000000n; // 0.05 Gwei default for BSC
  
  async function callWithRetry(fn) {
    try {
      const overrides = {};
      if (network === "polygon") {
        const priorityFee = 30000000000n; // 30 Gwei
        const baseFee = feeData.gasPrice ? feeData.gasPrice : 150000000000n;
        overrides.maxPriorityFeePerGas = priorityFee;
        overrides.maxFeePerGas = baseFee + priorityFee;
      } else if (network === "bsc") {
        overrides.gasPrice = currentGasPrice;
      }
      return await fn(overrides);
    } catch (err) {
      if (network === "bsc") {
        const msg = err.message.toLowerCase();
        if (msg.includes("underpriced") || msg.includes("low") || msg.includes("fee") || msg.includes("price")) {
          if (currentGasPrice === 50000000n) {
            console.log(`\n⚠️ Gas price 0.05 Gwei was rejected. Retrying with 0.1 Gwei...`);
            currentGasPrice = 100000000n; // 0.1 Gwei
            const overrides = { gasPrice: currentGasPrice };
            return await fn(overrides);
          }
        }
      }
      throw err;
    }
  }

  const coreAddr = deployment.contracts.aipcore;
  const poolAddr = deployment.contracts.RewardPool;
  const feeReceiver = process.env.FEE_RECEIVER_ADDRESS;
  const ownerAddr = process.env.OWNER_ADDRESS || deployment.deployer;

  if (!feeReceiver) {
    throw new Error("❌ Missing required environment variable: FEE_RECEIVER_ADDRESS");
  }

  console.log("Parameters:");
  console.log("  Core Engine   :", coreAddr);
  console.log("  Reward Pool   :", poolAddr);
  console.log("  Fee Receiver  :", feeReceiver);
  console.log("  Final Owner   :", ownerAddr);
  console.log("");

  // Attach core and pool contracts
  const core = await hre.ethers.getContractAt("aipcore", coreAddr);
  const pool = await hre.ethers.getContractAt("RewardPool", poolAddr);

  // 1. Deploy AIPCoreViewsContract
  process.stdout.write("1/7 Deploying AIPCoreViewsContract... ");
  const ViewsContractFactory = await hre.ethers.getContractFactory("AIPCoreViewsContract");
  const viewsContract = await callWithRetry(ov => ViewsContractFactory.deploy(ov));
  await viewsContract.waitForDeployment();
  const viewsContractAddr = await viewsContract.getAddress();
  console.log("✅ Deployed at:", viewsContractAddr);

  // 2. Deploy RewardPoolLeadership
  process.stdout.write("2/7 Deploying RewardPoolLeadership... ");
  const LeadershipFactory = await hre.ethers.getContractFactory("RewardPoolLeadership");
  const leadership = await callWithRetry(ov => LeadershipFactory.deploy(
    coreAddr,
    poolAddr,
    feeReceiver,
    deployer.address, // Owner initially
    ov
  ));
  await leadership.waitForDeployment();
  const leadershipAddr = await leadership.getAddress();
  console.log("✅ Deployed at:", leadershipAddr);

  // 3. Deploy FounderPool
  process.stdout.write("3/7 Deploying FounderPool... ");
  const FounderFactory = await hre.ethers.getContractFactory("FounderPool");
  const founderPool = await callWithRetry(ov => FounderFactory.deploy(
    coreAddr,
    poolAddr,
    feeReceiver,
    ov
  ));
  await founderPool.waitForDeployment();
  const founderPoolAddr = await founderPool.getAddress();
  console.log("✅ Deployed at:", founderPoolAddr);

  // 4. Deploy LeaderboardPool
  process.stdout.write("4/7 Deploying LeaderboardPool... ");
  const LeaderboardFactory = await hre.ethers.getContractFactory("LeaderboardPool");
  const leaderboardPool = await callWithRetry(ov => LeaderboardFactory.deploy(
    coreAddr,
    leadershipAddr,
    feeReceiver,
    ov
  ));
  await leaderboardPool.waitForDeployment();
  const leaderboardPoolAddr = await leaderboardPool.getAddress();
  console.log("✅ Deployed at:", leaderboardPoolAddr);

  // 5. Deploy NFEVestingVault
  process.stdout.write("5/7 Deploying NFEVestingVault... ");
  const VaultFactory = await hre.ethers.getContractFactory("NFEVestingVault");
  const vault = await callWithRetry(ov => VaultFactory.deploy(
    deployer.address, // Owner initially
    coreAddr,
    poolAddr,
    feeReceiver,
    ov
  ));
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("✅ Deployed at:", vaultAddr);

  // 6. Deploy NFECycleManager
  process.stdout.write("6/7 Deploying NFECycleManager... ");
  const CycleManagerFactory = await hre.ethers.getContractFactory("NFECycleManager");
  const cycleManager = await callWithRetry(ov => CycleManagerFactory.deploy(deployer.address, ov));
  await cycleManager.waitForDeployment();
  const cycleManagerAddr = await cycleManager.getAddress();
  console.log("✅ Deployed at:", cycleManagerAddr);

  // 7. Deploy NFERenewalEngine
  process.stdout.write("7/7 Deploying NFERenewalEngine... ");
  const RenewalEngineFactory = await hre.ethers.getContractFactory("NFERenewalEngine");
  const renewalEngine = await callWithRetry(ov => RenewalEngineFactory.deploy(
    deployer.address, // Owner initially
    coreAddr,
    vaultAddr,
    cycleManagerAddr,
    ov
  ));
  await renewalEngine.waitForDeployment();
  const renewalEngineAddr = await renewalEngine.getAddress();
  console.log("✅ Deployed at:", renewalEngineAddr);

  // ── Wiring & Connections ──────────────────────────────────────────────────
  console.log("\n🔗 Establishing linkages in contracts...");

  // Core setup
  process.stdout.write("  - Link viewsContract in Core... ");
  let tx = await callWithRetry(ov => core.setViewsContract(viewsContractAddr, ov));
  await tx.wait();
  console.log("✅");

  process.stdout.write("  - Link FounderPool in Core... ");
  tx = await callWithRetry(ov => core.setFounderPool(founderPoolAddr, ov));
  await tx.wait();
  console.log("✅");

  process.stdout.write("  - Link LeaderboardPool in Core... ");
  tx = await callWithRetry(ov => core.setLeaderboardPool(leaderboardPoolAddr, ov));
  await tx.wait();
  console.log("✅");

  process.stdout.write("  - Link Vesting Vault in Core... ");
  tx = await callWithRetry(ov => core.setVault(vaultAddr, ov));
  await tx.wait();
  console.log("✅");

  process.stdout.write("  - Link CycleManager in Core... ");
  tx = await callWithRetry(ov => core.setCycleManager(cycleManagerAddr, ov));
  await tx.wait();
  console.log("✅");

  process.stdout.write("  - Link RenewalEngine in Core... ");
  tx = await callWithRetry(ov => core.setRenewalEngine(renewalEngineAddr, ov));
  await tx.wait();
  console.log("✅");

  // RewardPool setup
  process.stdout.write("  - Link Leadership in RewardPool... ");
  tx = await callWithRetry(ov => pool.setLeadershipEngine(leadershipAddr, ov));
  await tx.wait();
  console.log("✅");

  process.stdout.write("  - Link Vault in RewardPool... ");
  tx = await callWithRetry(ov => pool.setVault(vaultAddr, ov));
  await tx.wait();
  console.log("✅");

  // Leadership setup
  process.stdout.write("  - Link FounderPool in Leadership... ");
  tx = await callWithRetry(ov => leadership.setFounderPool(founderPoolAddr, ov));
  await tx.wait();
  console.log("✅");

  process.stdout.write("  - Link LeaderboardPool in Leadership... ");
  tx = await callWithRetry(ov => leadership.setLeaderboardPool(leaderboardPoolAddr, ov));
  await tx.wait();
  console.log("✅");

  // CycleManager setup
  process.stdout.write("  - Link RenewalEngine in CycleManager... ");
  tx = await callWithRetry(ov => cycleManager.setRenewalEngine(renewalEngineAddr, ov));
  await tx.wait();
  console.log("✅");

  // Vault setup
  process.stdout.write("  - Link RenewalEngine in VestingVault... ");
  tx = await callWithRetry(ov => vault.setRenewalEngine(renewalEngineAddr, ov));
  await tx.wait();
  console.log("✅");

  // ── Transfer Ownership to Final Owner ─────────────────────────────────────
  if (ownerAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("\n👑 Transferring ownerships to final owner...");

    process.stdout.write("  - aipcore Core... ");
    tx = await callWithRetry(ov => core.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");

    process.stdout.write("  - RewardPool... ");
    tx = await callWithRetry(ov => pool.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");

    process.stdout.write("  - RewardPoolLeadership... ");
    tx = await callWithRetry(ov => leadership.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");

    process.stdout.write("  - FounderPool... ");
    tx = await callWithRetry(ov => founderPool.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");

    process.stdout.write("  - LeaderboardPool... ");
    tx = await callWithRetry(ov => leaderboardPool.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");

    process.stdout.write("  - NFEVestingVault... ");
    tx = await callWithRetry(ov => vault.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");

    process.stdout.write("  - NFECycleManager... ");
    tx = await callWithRetry(ov => cycleManager.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");

    process.stdout.write("  - NFERenewalEngine... ");
    tx = await callWithRetry(ov => renewalEngine.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");
  }

  // ── Save deployment info ──────────────────────────────────────────────────
  deployment.contracts.AIPCoreViewsContract = viewsContractAddr;
  deployment.contracts.RewardPoolLeadership = leadershipAddr;
  deployment.contracts.FounderPool = founderPoolAddr;
  deployment.contracts.LeaderboardPool = leaderboardPoolAddr;
  deployment.contracts.NFEVestingVault = vaultAddr;
  deployment.contracts.NFECycleManager = cycleManagerAddr;
  deployment.contracts.NFERenewalEngine = renewalEngineAddr;

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\n💾 Saved V3 Addons to hardhat/${filename}\n`);
  console.log("🎉 V3 ADDONS DEPLOYMENT COMPLETE!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Addons deployment failed:", err.message);
    process.exit(1);
  });
