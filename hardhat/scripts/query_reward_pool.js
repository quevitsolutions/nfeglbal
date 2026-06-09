const hre = require("hardhat");

async function main() {
  const address = "0x5EDC50d63687D9C33B0bD757843f02940b9e72cf";
  console.log("Querying RewardPool at:", address);

  // We can attach the RewardPool contract factory to this address
  const RewardPool = await hre.ethers.getContractFactory("RewardPool");
  const pool = RewardPool.attach(address);

  try {
    const engine = await pool.engine();
    console.log("engine():", engine);
  } catch (e) {
    console.error("Failed to query engine():", e.message);
  }

  try {
    const owner = await pool.owner();
    console.log("owner():", owner);
  } catch (e) {
    console.error("Failed to query owner():", e.message);
  }

  try {
    const bTeam = await pool.BRONZE_MIN_TEAM();
    const sTeam = await pool.SILVER_MIN_TEAM();
    const gTeam = await pool.GOLD_MIN_TEAM();
    console.log("BRONZE_MIN_TEAM:", bTeam.toString());
    console.log("SILVER_MIN_TEAM:", sTeam.toString());
    console.log("GOLD_MIN_TEAM:", gTeam.toString());
  } catch (e) {
    console.error("Failed to query team thresholds:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
