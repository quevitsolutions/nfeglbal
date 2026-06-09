const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // 1. Deploy BNBPriceOracle
  console.log("Deploying BNBPriceOracle...");
  const BNBPriceOracle = await hre.ethers.getContractFactory("BNBPriceOracle");
  const oracle = await BNBPriceOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("BNBPriceOracle deployed to:", oracleAddress);

  // 2. Deploy nfeglobalViews Library
  console.log("Deploying nfeglobalViews Library...");
  const nfeglobalViews = await hre.ethers.getContractFactory("nfeglobalViews");
  const views = await nfeglobalViews.deploy();
  await views.waitForDeployment();
  const viewsAddress = await views.getAddress();
  console.log("nfeglobalViews deployed to:", viewsAddress);

  // 3. Deploy nfeglobal (NFEGlobal) with nfeglobalViews linked
  console.log("Deploying nfeglobal (NFEGlobal)...");
  const nfeglobal = await hre.ethers.getContractFactory("nfeglobal", {
    libraries: {
      nfeglobalViews: viewsAddress,
    },
  });

  const firstUser = deployer.address; // Genesis Node Wallet
  const feeReceiver = deployer.address; // Platform fee receiver
  const owner = deployer.address;
  const oracleAdmin = deployer.address;
  const matrixAdmin = deployer.address;

  // Constructor requires 6 args: _firstUser, _feeReceiver, _rewardPool (address(0) initially), _owner, _oracleAdmin, _matrixAdmin
  const core = await nfeglobal.deploy(
    firstUser,
    feeReceiver,
    hre.ethers.ZeroAddress, // Set RewardPool to zero initially
    owner,
    oracleAdmin,
    matrixAdmin
  );
  await core.waitForDeployment();
  const coreAddress = await core.getAddress();
  console.log("nfeglobal deployed to:", coreAddress);

  // 4. Deploy RewardPool
  console.log("Deploying RewardPool...");
  const RewardPool = await hre.ethers.getContractFactory("RewardPool");
  // Constructor requires 3 args: _engine, _owner, _genesisNodeId (36999)
  const pool = await RewardPool.deploy(
    coreAddress,
    owner,
    36999
  );
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("RewardPool deployed to:", poolAddress);

  // 5. Connect and Link Contracts
  console.log("Linking RewardPool to nfeglobal...");
  // Call setAddr(1, poolAddress, 0)
  let tx = await core.setAddr(1, poolAddress, 0);
  await tx.wait();
  console.log("RewardPool linked successfully.");

  console.log("Linking BNBPriceOracle to nfeglobal...");
  // Call setAddr(11, oracleAddress, 0)
  tx = await core.setAddr(11, oracleAddress, 0);
  await tx.wait();
  console.log("BNBPriceOracle linked successfully.");

  console.log("\n=================== DEPLOYMENT SUMMARY ===================");
  console.log("BNBPriceOracle:     ", oracleAddress);
  console.log("nfeglobalViews Library:   ", viewsAddress);
  console.log("nfeglobal (NFEGlobal):", coreAddress);
  console.log("RewardPool:         ", poolAddress);
  console.log("==========================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
