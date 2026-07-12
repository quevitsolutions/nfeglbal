const hre = require("hardhat");

// ── RESUME CONFIG ────────────────────────────────────────────────────────────
// aipcoreViews library is immutable — reuse across deployments to save gas.
const EXISTING_VIEWS = {
  bscTestnet: "0xeb5C38B2dD7F6c6F0641E605C7AE5a47AF9E31b7",
  bsc: "", // Fresh deploy
  polygon: "0xFE9F449E74AA28ef832eCb1917266C68Ab6BEC70", // Reuse deployed library
};

// core engine contract can also be reused if deployment failed mid-way.
const EXISTING_CORE = {
  bscTestnet: "",
  bsc: "", // Resuming core deployment
  polygon: "0xA0DE5adE595a43838d1a883D441ea5f0829d66b1",
};

// ── CHAINLINK NATIVE/USD FEED ADDRESSES ──────────────────────────────────────
// These are the official Chainlink AggregatorV3 feeds — no wrapper needed.
const CHAINLINK_FEEDS = {
  bscTestnet: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526", // BSC Testnet BNB/USD
  bsc:        "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", // BSC Mainnet BNB/USD
  polygon:    "0xAB594600376ec9fD91F8e8851f0c0738969d7cfd", // Polygon Mainnet POL/USD
};

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const network = hre.network.name;
  console.log("\n🚀 Deploying AIPCORE contracts to", network);
  console.log("Deployer:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  const symbol = network === "polygon" ? "POL" : "BNB";
  console.log("Balance:", hre.ethers.formatEther(balance), `${symbol}\n`);

  if (balance === 0n) {
    throw new Error(`❌ Insufficient ${symbol}: Wallet balance is 0`);
  }

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

  // ── STEP 0: Resolve Roles (Genesis, Fee Receiver, Owner, Admins) ───────────
  let genesisUserAddr;
  let feeReceiverAddr;
  let ownerAddr;
  let oracleAdminAddr;
  let matrixAdminAddr;

  if (network === "hardhat" || network === "localhost") {
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
  if (network === "hardhat" || network === "localhost") {
    process.stdout.write("1/3 Deploying mock BNBPriceOracle for local network... ");
    const MockOracleFactory = await hre.ethers.getContractFactory("BNBPriceOracle");
    const mockOracle = await callWithRetry(ov => MockOracleFactory.deploy(ov));
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

  // ── STEP 2: aipcoreViews library ────────────────────────────────────────
  let viewsAddr;
  const existingViewsAddr = EXISTING_VIEWS[network];
  if (existingViewsAddr && existingViewsAddr !== "") {
    viewsAddr = existingViewsAddr;
    console.log("2/3 aipcoreViews     ♻️  (reusing existing):", viewsAddr);
  } else {
    process.stdout.write("2/3 Deploying aipcoreViews... ");
    const ViewsFactory = await hre.ethers.getContractFactory("aipcoreViews");
    const views = await callWithRetry(ov => ViewsFactory.deploy(ov));
    await views.waitForDeployment();
    viewsAddr = await views.getAddress();
    console.log("✅", viewsAddr);
  }

  // ── STEP 3: aipcore (Core Engine) ───────────────────────────────────────
  let core;
  let coreAddr;
  const existingCoreAddr = EXISTING_CORE[network];
  if (existingCoreAddr && existingCoreAddr !== "") {
    coreAddr = existingCoreAddr;
    console.log("3/3 aipcore Core     ♻️  (reusing existing):", coreAddr);
    const CoreFactory = await hre.ethers.getContractFactory("aipcore", {
      libraries: { aipcoreViews: viewsAddr },
    });
    core = CoreFactory.attach(coreAddr);
  } else {
    process.stdout.write("3/3 Deploying aipcore Core... ");
    const CoreFactory = await hre.ethers.getContractFactory("aipcore", {
      libraries: { aipcoreViews: viewsAddr },
    });
    core = await callWithRetry(ov => CoreFactory.deploy(
      genesisUserAddr,        // _firstUser (Genesis)
      feeReceiverAddr,        // _feeReceiver
      hre.ethers.ZeroAddress, // _rewardPool (linked in Step 5)
      deployer.address,       // _owner (deployer initially to allow setup)
      oracleAdminAddr,        // _oracleAdmin
      matrixAdminAddr,        // _matrixAdmin
      { ...ov, gasLimit: 7000000 }
    ));
    await core.waitForDeployment();
    coreAddr = await core.getAddress();
    console.log("✅", coreAddr);
  }

  // ── STEP 4: RewardPool ─────────────────────────────────────────────────────
  process.stdout.write("4/4 Deploying RewardPool... ");
  const PoolFactory = await hre.ethers.getContractFactory("RewardPool");
  const pool = await callWithRetry(ov => PoolFactory.deploy(
    coreAddr,         // _engine = aipcore
    deployer.address, // _owner (deployer initially to allow setup)
    55555,            // _genesisNodeId
    { ...ov, gasLimit: 6000000 }
  ));
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("✅", poolAddr);

  // ── STEP 5: Link RewardPool → aipcore ───────────────────────────────────
  process.stdout.write("\n🔗 Linking RewardPool... ");
  let tx = await callWithRetry(ov => core.setAddr(1, poolAddr, 0, ov));
  await tx.wait();
  console.log("✅");

  // ── STEP 5.5: Deploy NFEGovernance ─────────────────────────────────────────
  process.stdout.write("5.5/5.5 Deploying NFEGovernance... ");
  const GovFactory = await hre.ethers.getContractFactory("NFEGovernance");
  const governance = await callWithRetry(ov => GovFactory.deploy(
    coreAddr,   // _nfe core contract
    ownerAddr,  // _governor address (final owner)
    { ...ov, gasLimit: 2500000 }
  ));
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log("✅", govAddr);

  // ── STEP 5.9: Set Price Bounds (Polygon only) ─────────────────────────────
  if (network === "polygon") {
    process.stdout.write("🔗 Setting price bounds for Polygon POL... ");
    tx = await callWithRetry(ov => core.setPriceBounds(5000000n, 1000000000n, ov)); // $0.05 to $10.00
    await tx.wait();
    console.log("✅");
  }

  // ── STEP 6: Link Chainlink BNB/USD feed → aipcore ───────────────────────
  process.stdout.write("🔗 Linking Chainlink BNB/USD feed... ");
  tx = await callWithRetry(ov => core.setAddr(11, chainlinkFeed, 0, ov));
  await tx.wait();
  console.log("✅");

  // ── STEP 6.1: Reset Oracle Circuit Breaker (Polygon only) ─────────────────
  if (network === "polygon") {
    process.stdout.write("🔗 Resetting oracle circuit breaker after initial price sync... ");
    tx = await callWithRetry(ov => core.resetOracleCircuitBreaker(ov));
    await tx.wait();
    console.log("✅");
  }

  // ── STEP 6.5: Link NFEGovernance as Governor in Core ──────────────────────
  process.stdout.write("🔗 Linking NFEGovernance as Governor in Core... ");
  tx = await callWithRetry(ov => core.setGovernor(govAddr, ov));
  await tx.wait();
  console.log("✅");

  // ── STEP 7: Transfer Ownership to final Owner address ─────────────────────
  // Commeted out here: Core and Pool ownership transfers are deferred to the end of deploy_v3_addons.js
  // to allow the deployer EOA to execute linkage transactions during the addons setup.
  /*
  if (ownerAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    process.stdout.write("👑 Transferring core ownership to final owner... ");
    tx = await callWithRetry(ov => core.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");

    process.stdout.write("👑 Transferring RewardPool ownership to final owner... ");
    tx = await callWithRetry(ov => pool.transferOwnership(ownerAddr, ov));
    await tx.wait();
    console.log("✅");
  }
  */

  // ── FINAL BALANCE ──────────────────────────────────────────────────────────
  const finalBalance = await deployer.provider.getBalance(deployer.address);
  console.log("\nRemaining balance:", hre.ethers.formatEther(finalBalance), symbol);

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log("\n============================================================");
  console.log("  ... DEPLOYMENT COMPLETE —", network.toUpperCase());
  console.log("============================================================");
  console.log("  Chainlink BNB/USD feed:", chainlinkFeed);
  console.log("  aipcoreViews Lib   : ", viewsAddr);
  console.log("  aipcore Core       : ", coreAddr);
  console.log("  RewardPool           : ", poolAddr);
  console.log("  NFEGovernance        : ", govAddr);

  console.log("============================================================");
  console.log("\n📋 Update these in: src/config/constants.js & server/index.js\n");

  const fs = require("fs");
  const output = {
    network,
    chainId: network === "bsc" ? 56 : (network === "polygon" ? 137 : 97),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ChainlinkBNBUSD: chainlinkFeed,
      aipcoreViews: viewsAddr,
      aipcore: coreAddr,
      RewardPool: poolAddr,
      NFEGovernance: govAddr,
    }
  };
  const filename = `deployment_${network}.json`;
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`💾 Saved to hardhat/${filename}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Deployment failed:", err.message);
    process.exit(1);
  });
