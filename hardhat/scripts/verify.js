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
  console.log(`\n🔍 Verifying NFEGlobal contracts on ${deployment.network.toUpperCase()}...\n`);

  const {
    nfeglobalViews: viewsAddr,
    nfeglobal: coreAddr,
    RewardPool: poolAddr,
    NFEGovernance: govAddr,
  } = deployment.contracts;

  const genesisUser  = process.env.GENESIS_USER_ADDRESS;
  const feeReceiver  = process.env.FEE_RECEIVER_ADDRESS;
  const ownerAddr    = process.env.OWNER_ADDRESS || deployment.deployer;
  const oracleAdmin  = process.env.ORACLE_ADMIN_ADDRESS || deployment.deployer;
  const matrixAdmin  = process.env.MATRIX_ADMIN_ADDRESS || deployment.deployer;

  const tryVerify = async (label, address, constructorArguments, libraries) => {
    console.log(`\n--- ${label} ---`);
    console.log(`    Address: ${address}`);
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments,
        libraries,
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

  // 1. nfeglobalViews (library — no constructor args)
  await tryVerify("nfeglobalViews", viewsAddr, []);

  // 2. nfeglobal Core (linked library + 6 constructor args)
  await tryVerify(
    "nfeglobal Core",
    coreAddr,
    [
      genesisUser,               // _firstUser
      feeReceiver,               // _feeReceiver
      hre.ethers.ZeroAddress,    // _rewardPool (zero at deploy; linked after)
      ownerAddr,                 // _owner (deployer initially)
      oracleAdmin,               // _oracleAdmin
      matrixAdmin,               // _matrixAdmin
    ],
    { nfeglobalViews: viewsAddr }
  );

  // 3. RewardPool
  await tryVerify("RewardPool", poolAddr, [
    coreAddr,    // _engine
    ownerAddr,   // _owner
    55555,       // _genesisNodeId
  ]);

  // 4. NFEGovernance
  await tryVerify("NFEGovernance", govAddr, [coreAddr, ownerAddr]);

  const explorerUrl = deployment.network === "polygon"
    ? "https://polygonscan.com"
    : (deployment.network === "bscTestnet" ? "https://testnet.bscscan.com" : "https://bscscan.com");

  console.log("\n============================================================");
  console.log("🎉 VERIFICATION COMPLETE —", deployment.network.toUpperCase());
  console.log("============================================================");
  console.log(`  nfeglobalViews : ${explorerUrl}/address/${viewsAddr}#code`);
  console.log(`  nfeglobal Core : ${explorerUrl}/address/${coreAddr}#code`);
  console.log(`  RewardPool     : ${explorerUrl}/address/${poolAddr}#code`);
  console.log(`  Governance     : ${explorerUrl}/address/${govAddr}#code`);
  console.log("============================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Verification script failed:", err.message);
    process.exit(1);
  });
