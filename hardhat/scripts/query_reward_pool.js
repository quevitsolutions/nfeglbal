const hre = require("hardhat");

async function main() {
  const address = "0x9f64054Ea5F8fD7A5626Aa20F4Ac1b82B3c33346";
  console.log("==========================================");
  console.log("Querying RewardPool at:", address);
  console.log("==========================================\n");

  const RewardPool = await hre.ethers.getContractFactory("RewardPool");
  const pool = RewardPool.attach(address);

  const query = async (name, fn) => {
    try {
      const res = await fn();
      console.log(`${name}:`, typeof res === "object" && res.toString ? res.toString() : res);
    } catch (e) {
      console.log(`${name}: ERROR -`, e.message);
    }
  };

  await query("Engine Address", () => pool.engine());
  await query("Owner Address", () => pool.owner());
  await query("Income Vault", () => pool.incomeVault());
  await query("Leadership Engine", () => pool.leadershipEngine());

  console.log("\n--- Threshold Requirements ---");
  await query("BRONZE_MIN_TIER", () => pool.BRONZE_MIN_TIER());
  await query("SILVER_MIN_TIER", () => pool.SILVER_MIN_TIER());
  await query("GOLD_MIN_TIER", () => pool.GOLD_MIN_TIER());

  await query("BRONZE_MIN_DIRECT", () => pool.BRONZE_MIN_DIRECT());
  await query("SILVER_MIN_DIRECT", () => pool.SILVER_MIN_DIRECT());
  await query("GOLD_MIN_DIRECT", () => pool.GOLD_MIN_DIRECT());

  await query("BRONZE_MIN_TEAM", () => pool.BRONZE_MIN_TEAM());
  await query("SILVER_MIN_TEAM", () => pool.SILVER_MIN_TEAM());
  await query("GOLD_MIN_TEAM", () => pool.GOLD_MIN_TEAM());

  console.log("\n--- Earnings Caps ---");
  await query("BRONZE_CAP_MULT", () => pool.BRONZE_CAP_MULT());
  await query("SILVER_CAP_MULT", () => pool.SILVER_CAP_MULT());
  await query("GOLD_CAP_MULT", () => pool.GOLD_CAP_MULT());

  console.log("\n--- Pool Dynamics & Balances ---");
  await query("Bronze Nodes Count", () => pool.bronzeNodes());
  await query("Silver Nodes Count", () => pool.silverNodes());
  await query("Gold Nodes Count", () => pool.goldNodes());

  await query("Bronze AccPerNode (scaled)", () => pool.bronzeAccPerNode());
  await query("Silver AccPerNode (scaled)", () => pool.silverAccPerNode());
  await query("Gold AccPerNode (scaled)", () => pool.goldAccPerNode());

  await query("Residual Bronze", () => pool.residualBronze());
  await query("Residual Silver", () => pool.residualSilver());
  await query("Residual Gold", () => pool.residualGold());

  await query("Total BNB Received (wei)", () => pool.totalReceived());
  await query("Total BNB Distributed (wei)", () => pool.totalDistributed());
  
  const balance = await hre.ethers.provider.getBalance(address);
  console.log("Contract BNB Balance:", hre.ethers.formatEther(balance), "BNB");
  console.log("==========================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

