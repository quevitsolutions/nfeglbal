const hre = require("hardhat");

async function main() {
  console.log("🚀 Verifying U1 tier after upgrades...\n");

  const sigs = await hre.ethers.getSigners();
  const [owner, u1, u2, u3, u4] = sigs;
  
  const OracleFactory = await hre.ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  await oracle.setPrice(500n * 100000000n);

  const ViewsFactory = await hre.ethers.getContractFactory("nfeglobalViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();

  const CoreFactory = await hre.ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: await views.getAddress() },
  });
  const core = await CoreFactory.deploy(
    owner.address, owner.address, hre.ethers.ZeroAddress, owner.address, owner.address, owner.address
  );
  await core.waitForDeployment();
  
  // Deploy and link MigrationHelper
  const HelperFactory = await (typeof hre !== 'undefined' ? hre.ethers : ethers).getContractFactory("MigrationHelper");
  const helper = await HelperFactory.deploy();
  await helper.waitForDeployment();
  await core.setMigrationHelper(await helper.getAddress());

  await core.setAddr(11, await oracle.getAddress(), 0);
  await core.setPriceBounds(10n * 100000000n, 100000n * 100000000n);

  const regFee = await core.getTierCost(0);
  await core.connect(u1).createNode(55555, { value: regFee });
  const u1Id = await core.nodeId(u1.address);

  await core.connect(u2).createNode(u1Id, { value: regFee });
  const u2Id = await core.nodeId(u2.address);

  await core.connect(u3).createNode(u2Id, { value: regFee });
  const u3Id = await core.nodeId(u3.address);

  await core.connect(u4).createNode(u2Id, { value: regFee });
  const u4Id = await core.nodeId(u4.address);

  const tier1Cost = await core.getTierCost(1);

  console.log("Upgrading U3 to tier 2...");
  await core.connect(u3).unlockTier(u3Id, 2, { value: tier1Cost });

  console.log("Upgrading U4 to tier 2...");
  await core.connect(u4).unlockTier(u4Id, 2, { value: tier1Cost });

  const n1 = await core.getNode(u1Id);
  console.log(`U1 Tier: ${n1.tier}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
