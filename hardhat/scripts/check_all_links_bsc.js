const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentPath = path.join(__dirname, "../deployment_bsc.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("❌ deployment_bsc.json not found!");
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const coreAddr = deployment.contracts.aipcore;
  const leadershipEngineAddr = deployment.contracts.RewardPoolLeadership;

  const coreAbi = [
    "function rewardPool() view returns (address)",
    "function governor() view returns (address)",
    "function cycleManager() view returns (address)",
    "function renewalEngine() view returns (address)",
    "function founderPool() view returns (address)",
    "function leaderboardPool() view returns (address)",
    "function incomeVault() view returns (address)",
    "function viewsContract() view returns (address)"
  ];

  const poolAbi = [
    "function leadershipEngine() view returns (address)",
    "function incomeVault() view returns (address)",
    "function engine() view returns (address)"
  ];

  const cycleManagerAbi = [
    "function renewalEngine() view returns (address)",
    "function owner() view returns (address)"
  ];

  const renewalEngineAbi = [
    "function core() view returns (address)",
    "function vestingVault() view returns (address)",
    "function cycleManager() view returns (address)",
    "function owner() view returns (address)"
  ];

  const vaultAbi = [
    "function core() view returns (address)",
    "function rewardPool() view returns (address)",
    "function renewalEngine() view returns (address)",
    "function owner() view returns (address)"
  ];

  const founderPoolAbi = [
    "function core() view returns (address)",
    "function rewardPool() view returns (address)",
    "function owner() view returns (address)"
  ];

  const leaderboardPoolAbi = [
    "function core() view returns (address)",
    "function leadershipEngine() view returns (address)",
    "function owner() view returns (address)"
  ];

  const leadershipAbi = [
    "function engine() view returns (address)",
    "function rewardPool() view returns (address)",
    "function founderPool() view returns (address)",
    "function leaderboardPool() view returns (address)",
    "function owner() view returns (address)"
  ];

  console.log("=== Querying linkages on BSC Mainnet ===\n");
  console.log("Core contract:", coreAddr);

  const core = new hre.ethers.Contract(coreAddr, coreAbi, hre.ethers.provider);

  const rewardPoolAddr = await core.rewardPool();
  const governorAddr = await core.governor();
  const cycleManagerAddr = await core.cycleManager();
  const renewalEngineAddr = await core.renewalEngine();
  const founderPoolAddr = await core.founderPool();
  const leaderboardPoolAddr = await core.leaderboardPool();
  const incomeVaultAddr = await core.incomeVault();
  const viewsContractAddr = await core.viewsContract();

  console.log("Core Linkages:");
  console.log("  - rewardPool        :", rewardPoolAddr);
  console.log("  - governor          :", governorAddr);
  console.log("  - cycleManager      :", cycleManagerAddr);
  console.log("  - renewalEngine     :", renewalEngineAddr);
  console.log("  - founderPool       :", founderPoolAddr);
  console.log("  - leaderboardPool   :", leaderboardPoolAddr);
  console.log("  - incomeVault (Vault):", incomeVaultAddr);
  console.log("  - viewsContract     :", viewsContractAddr);
  console.log("");

  // RewardPool Queries
  if (rewardPoolAddr !== hre.ethers.ZeroAddress) {
    console.log("RewardPool Linkages:");
    try {
      const pool = new hre.ethers.Contract(rewardPoolAddr, poolAbi, hre.ethers.provider);
      const engine = await pool.engine();
      const leadershipEngine = await pool.leadershipEngine();
      const incomeVault = await pool.incomeVault();
      console.log("  - engine            :", engine);
      console.log("  - leadershipEngine  :", leadershipEngine);
      console.log("  - incomeVault       :", incomeVault);

    } catch (e) {
      console.error("  Error querying RewardPool:", e.message);
    }
  }
  console.log("");

  // RewardPoolLeadership Queries
  console.log("RewardPoolLeadership Linkages:");
  try {
    const leadership = new hre.ethers.Contract(leadershipEngineAddr, leadershipAbi, hre.ethers.provider);
    console.log("  - engine            :", await leadership.engine());
    console.log("  - rewardPool        :", await leadership.rewardPool());
    console.log("  - founderPool       :", await leadership.founderPool());
    console.log("  - leaderboardPool   :", await leadership.leaderboardPool());
    console.log("  - owner             :", await leadership.owner());
  } catch (e) {
    console.error("  Error querying RewardPoolLeadership:", e.message);
  }
  console.log("");

  // CycleManager Queries
  if (cycleManagerAddr !== hre.ethers.ZeroAddress) {
    console.log("CycleManager Linkages:");
    try {
      const cycleManager = new hre.ethers.Contract(cycleManagerAddr, cycleManagerAbi, hre.ethers.provider);
      console.log("  - renewalEngine     :", await cycleManager.renewalEngine());
      console.log("  - owner             :", await cycleManager.owner());
    } catch (e) {
      console.error("  Error querying CycleManager:", e.message);
    }
  }
  console.log("");

  // RenewalEngine Queries
  if (renewalEngineAddr !== hre.ethers.ZeroAddress) {
    console.log("RenewalEngine Linkages:");
    try {
      const renewalEngine = new hre.ethers.Contract(renewalEngineAddr, renewalEngineAbi, hre.ethers.provider);
      console.log("  - core              :", await renewalEngine.core());
      console.log("  - vestingVault      :", await renewalEngine.vestingVault());
      console.log("  - cycleManager      :", await renewalEngine.cycleManager());
      console.log("  - owner             :", await renewalEngine.owner());
    } catch (e) {
      console.error("  Error querying RenewalEngine:", e.message);
    }
  }
  console.log("");

  // VestingVault Queries
  if (incomeVaultAddr !== hre.ethers.ZeroAddress) {
    console.log("VestingVault (IncomeVault) Linkages:");
    try {
      const vault = new hre.ethers.Contract(incomeVaultAddr, vaultAbi, hre.ethers.provider);
      console.log("  - core              :", await vault.core());
      console.log("  - rewardPool        :", await vault.rewardPool());
      console.log("  - renewalEngine     :", await vault.renewalEngine());
      console.log("  - owner             :", await vault.owner());
    } catch (e) {
      console.error("  Error querying VestingVault:", e.message);
    }
  }
  console.log("");

  // FounderPool Queries
  if (founderPoolAddr !== hre.ethers.ZeroAddress) {
    console.log("FounderPool Linkages:");
    try {
      const founderPool = new hre.ethers.Contract(founderPoolAddr, founderPoolAbi, hre.ethers.provider);
      console.log("  - core              :", await founderPool.core());
      console.log("  - rewardPool        :", await founderPool.rewardPool());
      console.log("  - owner             :", await founderPool.owner());
    } catch (e) {
      console.error("  Error querying FounderPool:", e.message);
    }
  }
  console.log("");

  // LeaderboardPool Queries
  if (leaderboardPoolAddr !== hre.ethers.ZeroAddress) {
    console.log("LeaderboardPool Linkages:");
    try {
      const leaderboardPool = new hre.ethers.Contract(leaderboardPoolAddr, leaderboardPoolAbi, hre.ethers.provider);
      console.log("  - core              :", await leaderboardPool.core());
      console.log("  - leadershipEngine  :", await leaderboardPool.leadershipEngine());
      console.log("  - owner             :", await leaderboardPool.owner());
    } catch (e) {
      console.error("  Error querying LeaderboardPool:", e.message);
    }
  }
  console.log("");

  const oldPoolAddr = "0x8c9eD734447ae7a54ba4466373a399668E1DE9A4";
  console.log("Old RewardPool (June 14th) Linkages:");
  try {
    const oldPool = new hre.ethers.Contract(oldPoolAddr, poolAbi, hre.ethers.provider);
    console.log("  - engine            :", await oldPool.engine());
    console.log("  - leadershipEngine  :", await oldPool.leadershipEngine());
    console.log("  - incomeVault       :", await oldPool.incomeVault());
  } catch (e) {
    console.error("  Error querying old RewardPool:", e.message);
  }
  console.log("");
}

main().catch(console.error);
