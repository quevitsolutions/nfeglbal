const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  if (network !== "bsc") {
    throw new Error("This script should only be run on BSC mainnet network.");
  }

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  console.log("Using deployer address:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "BNB");

  let currentGasPrice = 50000000n; // 0.05 Gwei default for BSC

  async function callWithRetry(fn) {
    try {
      return await fn({ gasPrice: currentGasPrice });
    } catch (err) {
      const msg = err.message.toLowerCase();
      if (msg.includes("underpriced") || msg.includes("low") || msg.includes("fee") || msg.includes("price")) {
        if (currentGasPrice === 50000000n) {
          console.log(`\n⚠️ Gas price 0.05 Gwei was rejected. Retrying with 0.1 Gwei...`);
          currentGasPrice = 100000000n; // 0.1 Gwei
          return await fn({ gasPrice: currentGasPrice });
        }
      }
      throw err;
    }
  }

  // Deployed addresses
  const rewardPoolAddr = "0x25917BBA1E158280aF5C7E08377ba7e6808cA67a";
  const leadershipAddr = "0xC00Ff91f31d4dbC775eBFfeD94A123A52a3b46b0";
  const vaultAddr = "0xc58aB1190B60CB379a0E5920ba6317Db24d71Bbb";

  const pool = await hre.ethers.getContractAt("RewardPool", rewardPoolAddr, deployer);
  const leadership = await hre.ethers.getContractAt("RewardPoolLeadership", leadershipAddr, deployer);
  const vault = await hre.ethers.getContractAt("NFEVestingVault", vaultAddr, deployer);

  console.log("\n🔗 Commencing stage linkages on BSC Mainnet...");

  // 1. Link Leadership in RewardPool
  process.stdout.write("  - Link Leadership in RewardPool... ");
  let tx = await callWithRetry(ov => pool.setLeadershipEngine(leadershipAddr, ov));
  await tx.wait();
  console.log("✅");

  // 2. Link Vault in RewardPool
  process.stdout.write("  - Link Vault in RewardPool... ");
  tx = await callWithRetry(ov => pool.setVault(vaultAddr, ov));
  await tx.wait();
  console.log("✅");

  // 3. Link RewardPool in Leadership
  process.stdout.write("  - Link RewardPool in RewardPoolLeadership... ");
  tx = await callWithRetry(ov => leadership.setRewardPool(rewardPoolAddr, ov));
  await tx.wait();
  console.log("✅");

  // 4. Link RewardPool in VestingVault
  process.stdout.write("  - Link RewardPool in VestingVault... ");
  tx = await callWithRetry(ov => vault.setRewardPool(rewardPoolAddr, ov));
  await tx.wait();
  console.log("✅");

  console.log("\n🎉 All 4 linkage transactions executed successfully!");

  // Save complete configuration back to deployment_bsc.json
  const filename = "deployment_bsc.json";
  const deploymentPath = path.join(__dirname, `../${filename}`);
  let deployment = {};
  if (fs.existsSync(deploymentPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }

  deployment.contracts = deployment.contracts || {};
  deployment.contracts.AIPCoreViewsContract = "0xecD1e4eD289585143aB6c4f08103a4f7d898Eb33";
  deployment.contracts.RewardPoolLeadership = leadershipAddr;
  deployment.contracts.FounderPool = "0x5C352a36987D0F556429e975AAfe1efE2735fa32";
  deployment.contracts.LeaderboardPool = "0x8d20C9734e1b4D94b0DfD05D6DA517efd95D51FB";
  deployment.contracts.NFEVestingVault = vaultAddr;
  deployment.contracts.NFECycleManager = "0x690c953A2FD0Ed2829746456c55fE7A298114Ede";
  deployment.contracts.NFERenewalEngine = "0x303d7fa59fc3Ec6DC9FF3C4a3940881b6B0cd064";

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`💾 Saved complete configuration to: ${filename}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Linkage failed:", err.message);
    process.exit(1);
  });
