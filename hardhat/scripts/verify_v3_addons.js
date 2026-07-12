const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  const network = hre.network.name;
  const filename = `deployment_${network}.json`;
  const deploymentPath = path.join(__dirname, `../${filename}`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`❌ ${filename} not found!`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log(`\n🔍 Verifying AIPCore V3 Addons on ${deployment.network.toUpperCase()}...\n`);

  const {
    AIPCoreViewsContract: viewsContractAddr,
    RewardPoolLeadership: leadershipAddr,
    FounderPool: founderPoolAddr,
    LeaderboardPool: leaderboardPoolAddr,
    NFEVestingVault: vaultAddr,
    NFECycleManager: cycleManagerAddr,
    NFERenewalEngine: renewalEngineAddr,
    aipcore: coreAddr,
    RewardPool: poolAddr,
  } = deployment.contracts;

  const feeReceiver  = process.env.FEE_RECEIVER_ADDRESS;
  const ownerAddr    = process.env.OWNER_ADDRESS || deployment.deployer;

  const tryVerify = async (label, address, constructorArguments) => {
    console.log(`\n--- ${label} ---`);
    console.log(`    Address: ${address}`);
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments,
      });
      console.log(`✅ ${label} verified!`);
    } catch (e) {
      if (e.message.toLowerCase().includes("already verified")) {
        console.log(`ℹ️  ${label} already verified.`);
      } else {
        console.error(`❌ ${label} failed:`, e.message);
      }
    }
  };

  // 1. AIPCoreViewsContract
  if (viewsContractAddr) {
    await tryVerify("AIPCoreViewsContract", viewsContractAddr, []);
  }

  // 2. RewardPoolLeadership
  if (leadershipAddr) {
    await tryVerify("RewardPoolLeadership", leadershipAddr, [
      coreAddr,
      poolAddr,
      feeReceiver,
      deployment.deployer, // Original owner before transfer
    ]);
  }

  // 3. FounderPool
  if (founderPoolAddr) {
    await tryVerify("FounderPool", founderPoolAddr, [
      coreAddr,
      poolAddr,
      feeReceiver,
    ]);
  }

  // 4. LeaderboardPool
  if (leaderboardPoolAddr) {
    await tryVerify("LeaderboardPool", leaderboardPoolAddr, [
      coreAddr,
      leadershipAddr,
      feeReceiver,
    ]);
  }

  // 5. NFEVestingVault
  if (vaultAddr) {
    await tryVerify("NFEVestingVault", vaultAddr, [
      deployment.deployer, // Original owner before transfer
      coreAddr,
      poolAddr,
      feeReceiver,
    ]);
  }

  // 6. NFECycleManager
  if (cycleManagerAddr) {
    await tryVerify("NFECycleManager", cycleManagerAddr, [
      deployment.deployer, // Original owner before transfer
    ]);
  }

  // 7. NFERenewalEngine
  if (renewalEngineAddr) {
    await tryVerify("NFERenewalEngine", renewalEngineAddr, [
      deployment.deployer, // Original owner before transfer
      coreAddr,
      vaultAddr,
      cycleManagerAddr,
    ]);
  }

  console.log("\n============================================================");
  console.log("🎉 V3 ADDONS VERIFICATION COMPLETE —", deployment.network.toUpperCase());
  console.log("============================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Verification script failed:", err.message);
    process.exit(1);
  });
