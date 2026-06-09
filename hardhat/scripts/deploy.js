const hre = require("hardhat");

// ── RESUME CONFIG ────────────────────────────────────────────────────────────
// nfeglobalViews library is immutable — reuse across deployments to save gas.
const EXISTING_VIEWS = {
  bscTestnet: "0xeb5C38B2dD7F6c6F0641E605C7AE5a47AF9E31b7",
  bsc: "", // Leave blank to deploy fresh on Mainnet
  polygon: "", // Leave blank to deploy fresh on Polygon Mainnet
};

// ── CHAINLINK NATIVE/USD FEED ADDRESSES ──────────────────────────────────────
// These are the official Chainlink AggregatorV3 feeds — no wrapper needed.
const CHAINLINK_FEEDS = {
  bscTestnet: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526", // BSC Testnet BNB/USD
  bsc:        "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", // BSC Mainnet BNB/USD
  polygon:    "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0", // Polygon Mainnet POL/USD
};

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const network = hre.network.name;
  console.log("\n🚀 Deploying NFEGLOBAL contracts to", network);
  console.log("Deployer:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "BNB\n");

  if (balance === 0n) {
    throw new Error(`❌ Insufficient BNB: Wallet balance is 0`);
  }

  // ── STEP 0: Resolve Roles (Genesis, Fee Receiver, Owner, Admins) ───────────
  let genesisUserAddr;
  let feeReceiverAddr;
  let ownerAddr;
  let oracleAdminAddr;
  let matrixAdminAddr;

  if (network === "hardhat") {
    // For local testing, assign different accounts to each role
    genesisUserAddr = signers[1].address;
    feeReceiverAddr = signers[2].address;
    ownerAddr = signers[3].address;
    oracleAdminAddr = signers[4].address;
    matrixAdminAddr = signers[5].address;
  } else {
    // Read from environment variables for live networks
    genesisUserAddr = process.env.GENESIS_USER_ADDRESS;
    feeReceiverAddr = process.env.FEE_RECEIVER_ADDRESS;
    ownerAddr = process.env.OWNER_ADDRESS || deployer.address;
    oracleAdminAddr = process.env.ORACLE_ADMIN_ADDRESS || deployer.address;
    matrixAdminAddr = process.env.MATRIX_ADMIN_ADDRESS || deployer.address;

    if (!genesisUserAddr || !feeReceiverAddr) {
      throw new Error("❌ Missing required environment variables on live network: GENESIS_USER_ADDRESS and FEE_RECEIVER_ADDRESS must be set.");
    }

    if (genesisUserAddr.toLowerCase() === deployer.address.toLowerCase() ||
        feeReceiverAddr.toLowerCase() === deployer.address.toLowerCase() ||
        genesisUserAddr.toLowerCase() === feeReceiverAddr.toLowerCase()) {
      throw new Error("❌ Addresses must be different: Genesis User, Fee Receiver, and Deployer must all be distinct accounts.");
    }
  }

  console.log("Roles Configured:");
  console.log("  Genesis User:", genesisUserAddr);
  console.log("  Fee Receiver:", feeReceiverAddr);
  console.log("  Owner       :", ownerAddr);
  console.log("  Oracle Admin:", oracleAdminAddr);
  console.log("  Matrix Admin:", matrixAdminAddr);
  console.log("");

  // ── STEP 1: Resolve Chainlink BNB/USD feed ────────────────────────────────
  let chainlinkFeed;
  if (network === "hardhat") {
    process.stdout.write("1/3 Deploying mock BNBPriceOracle for local network... ");
    const MockOracleFactory = await hre.ethers.getContractFactory("BNBPriceOracle");
    const mockOracle = await MockOracleFactory.deploy();
    await mockOracle.waitForDeployment();
    chainlinkFeed = await mockOracle.getAddress();
    console.log("✅ Deployed at:", chainlinkFeed);
  } else {
    chainlinkFeed = CHAINLINK_FEEDS[network];
    if (!chainlinkFeed) {
      throw new Error(`❌ No Chainlink BNB/USD feed configured for network: ${network}`);
    }
    console.log("1/3 Chainlink BNB/USD feed:", chainlinkFeed, `(${network})`);
  }

  // ── STEP 2: nfeglobalViews library ────────────────────────────────────────
  let viewsAddr;
  const existingViewsAddr = EXISTING_VIEWS[network];
  if (existingViewsAddr && existingViewsAddr !== "") {
    viewsAddr = existingViewsAddr;
    console.log("2/3 nfeglobalViews     ♻️  (reusing existing):", viewsAddr);
  } else {
    process.stdout.write("2/3 Deploying nfeglobalViews... ");
    const ViewsFactory = await hre.ethers.getContractFactory("nfeglobalViews");
    const views = await ViewsFactory.deploy();
    await views.waitForDeployment();
    viewsAddr = await views.getAddress();
    console.log("✅", viewsAddr);
  }

  // ── STEP 3: nfeglobal (Core Engine) ───────────────────────────────────────
  process.stdout.write("3/3 Deploying nfeglobal Core... ");
  const CoreFactory = await hre.ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    genesisUserAddr,        // _firstUser (Genesis)
    feeReceiverAddr,        // _feeReceiver
    hre.ethers.ZeroAddress, // _rewardPool (linked in Step 5)
    deployer.address,       // _owner (deployer initially to allow setup)
    oracleAdminAddr,        // _oracleAdmin
    matrixAdminAddr         // _matrixAdmin
  );
  await core.waitForDeployment();
  
  // Deploy and link MigrationHelper
  const HelperFactory = await (typeof hre !== 'undefined' ? hre.ethers : ethers).getContractFactory("MigrationHelper");
  const helper = await HelperFactory.deploy();
  await helper.waitForDeployment();
  await core.setMigrationHelper(await helper.getAddress());

  const coreAddr = await core.getAddress();
  console.log("✅", coreAddr);

  // ── STEP 4: RewardPool ─────────────────────────────────────────────────────
  process.stdout.write("4/4 Deploying RewardPool... ");
  const PoolFactory = await hre.ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(
    coreAddr,         // _engine = nfeglobal
    deployer.address, // _owner (deployer initially to allow setup)
    55555             // _genesisNodeId
  );
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("✅", poolAddr);

  // ── STEP 4.5: Governance ──────────────────────────────────────────────────
  process.stdout.write("4.5/4 Deploying Governance... ");
  const GovFactory = await hre.ethers.getContractFactory("Governance");
  const governance = await GovFactory.deploy(coreAddr);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log("✅", govAddr);

  // ── STEP 5: Link RewardPool → nfeglobal ───────────────────────────────────
  process.stdout.write("\n🔗 Linking RewardPool... ");
  let tx = await core.setAddr(1, poolAddr, 0);
  await tx.wait();
  console.log("✅");

  // ── STEP 5.5: Link Governance → nfeglobal ────────────────────────────────
  process.stdout.write("🔗 Linking Governance... ");
  tx = await core.setGovernance(govAddr);
  await tx.wait();
  console.log("✅");

  // ── STEP 6: Link Chainlink BNB/USD feed → nfeglobal ───────────────────────
  process.stdout.write("🔗 Linking Chainlink BNB/USD feed... ");
  tx = await core.setAddr(11, chainlinkFeed, 0);
  await tx.wait();
  console.log("✅");

  // ── STEP 7: Transfer Ownership to final Owner address ─────────────────────
  if (ownerAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    process.stdout.write("👑 Transferring core ownership to final owner... ");
    tx = await core.transferOwnership(ownerAddr);
    await tx.wait();
    console.log("✅");

    process.stdout.write("👑 Transferring RewardPool ownership to final owner... ");
    tx = await pool.transferOwnership(ownerAddr);
    await tx.wait();
    console.log("✅");
  }

  // ── FINAL BALANCE ──────────────────────────────────────────────────────────
  const finalBalance = await deployer.provider.getBalance(deployer.address);
  console.log("\nRemaining balance:", hre.ethers.formatEther(finalBalance), "BNB");

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log("\n============================================================");
  console.log("  ... DEPLOYMENT COMPLETE —", network.toUpperCase());
  console.log("============================================================");
  console.log("  Chainlink BNB/USD feed:", chainlinkFeed);
  console.log("  nfeglobalViews Lib   : ", viewsAddr);
  console.log("  nfeglobal Core       : ", coreAddr);
  console.log("  RewardPool           : ", poolAddr);
  console.log("  Governance           : ", govAddr);
  console.log("============================================================");
  console.log("\n📋 Update these in: src/config/constants.js & server/index.js\n");

  const fs = require("fs");
  const output = {
    network,
    chainId: network === "bsc" ? 56 : 97,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ChainlinkBNBUSD: chainlinkFeed,
      nfeglobalViews: viewsAddr,
      nfeglobal: coreAddr,
      RewardPool: poolAddr,
      Governance: govAddr,
    }
  };
  fs.writeFileSync("deployment.json", JSON.stringify(output, null, 2));
  console.log("💾 Saved to hardhat/deployment.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Deployment failed:", err.message);
    process.exit(1);
  });
