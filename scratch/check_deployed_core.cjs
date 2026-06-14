const hre = require("hardhat");

async function main() {
  const oldCore = "0x89C394B2f7d35F9e798d881DD05a6Acfa42107D7";
  const newCore = "0x6776bFaBAA7043c08c5f21310e117CA4B6281e17";

  const abi = [
    "function cycleManager() view returns (address)",
    "function renewalEngine() view returns (address)",
    "function founderPool() view returns (address)",
    "function leaderboardPool() view returns (address)",
    "function incomeVault() view returns (address)",
    "function viewsContract() view returns (address)",
    "function rewardPool() view returns (address)",
    "function governor() view returns (address)"
  ];

  console.log("Checking OLD Core:", oldCore);
  try {
    const contract = new hre.ethers.Contract(oldCore, abi, hre.ethers.provider);
    console.log("  - rewardPool:", await contract.rewardPool());
    console.log("  - governor:", await contract.governor());
    console.log("  - cycleManager:", await contract.cycleManager());
    console.log("  - renewalEngine:", await contract.renewalEngine());
    console.log("  - founderPool:", await contract.founderPool());
    console.log("  - leaderboardPool:", await contract.leaderboardPool());
    console.log("  - incomeVault:", await contract.incomeVault());
    console.log("  - viewsContract:", await contract.viewsContract());
  } catch (e) {
    console.error("  Error querying old core:", e.message);
  }

  console.log("\nChecking NEW Core:", newCore);
  try {
    const contract = new hre.ethers.Contract(newCore, abi, hre.ethers.provider);
    console.log("  - rewardPool:", await contract.rewardPool());
    console.log("  - governor:", await contract.governor());
    console.log("  - cycleManager:", await contract.cycleManager());
    console.log("  - renewalEngine:", await contract.renewalEngine());
    console.log("  - founderPool:", await contract.founderPool());
    console.log("  - leaderboardPool:", await contract.leaderboardPool());
    console.log("  - incomeVault:", await contract.incomeVault());
    console.log("  - viewsContract:", await contract.viewsContract());
  } catch (e) {
    console.error("  Error querying new core:", e.message);
  }
}

main().catch(console.error);
