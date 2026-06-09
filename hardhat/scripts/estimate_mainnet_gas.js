const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Estimating deployment gas on network:", hre.network.name);
  console.log("Deployer address:", deployer.address);

  // 1. nfeglobalViews
  const ViewsFactory = await hre.ethers.getContractFactory("nfeglobalViews");
  const viewsDeployTx = await ViewsFactory.getDeployTransaction();
  const viewsGas = await deployer.provider.estimateGas(viewsDeployTx);
  console.log(`- nfeglobalViews: ${viewsGas.toString()} gas`);

  // We mock a dummy views address to estimate Core deployment
  const mockViewsAddr = "0xeb5C38B2dD7F6c6F0641E605C7AE5a47AF9E31b7";

  // 2. nfeglobal (Core Engine)
  const CoreFactory = await hre.ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: mockViewsAddr },
  });
  const coreDeployTx = await CoreFactory.getDeployTransaction(
    deployer.address,       // _firstUser (Genesis)
    deployer.address,       // _feeReceiver
    hre.ethers.ZeroAddress, // _rewardPool
    deployer.address,       // _owner
    deployer.address,       // _oracleAdmin
    deployer.address        // _matrixAdmin
  );
  const coreGas = await deployer.provider.estimateGas(coreDeployTx);
  console.log(`- nfeglobal Core: ${coreGas.toString()} gas`);

  // We mock a dummy core address to estimate RewardPool & Governance
  const mockCoreAddr = "0xda0d24aAd1685F59614c1a347826fA1100aBd9F6";

  // 3. RewardPool
  const PoolFactory = await hre.ethers.getContractFactory("RewardPool");
  const poolDeployTx = await PoolFactory.getDeployTransaction(
    mockCoreAddr,         // _engine
    deployer.address,     // _owner
    55555                 // _genesisNodeId
  );
  const poolGas = await deployer.provider.estimateGas(poolDeployTx);
  console.log(`- RewardPool: ${poolGas.toString()} gas`);

  // 4. Governance
  const GovFactory = await hre.ethers.getContractFactory("Governance");
  const govDeployTx = await GovFactory.getDeployTransaction(mockCoreAddr);
  const govGas = await deployer.provider.estimateGas(govDeployTx);
  console.log(`- Governance: ${govGas.toString()} gas`);

  // 5. Setup Transactions (Links)
  // We estimate setting up addresses.
  // core.setAddr(1, poolAddr, 0)
  // core.setGovernance(govAddr)
  // core.setAddr(11, chainlinkFeed, 0)
  // These usually cost around 50k to 100k gas each. Let's add a fixed 250k gas for setup.
  const setupGas = 250000n;
  console.log(`- Setup/linking: ${setupGas.toString()} gas`);

  const totalGas = BigInt(viewsGas) + BigInt(coreGas) + BigInt(poolGas) + BigInt(govGas) + setupGas;
  console.log(`\n=================================================`);
  console.log(`Total Estimated Gas: ${totalGas.toString()} units`);
  console.log(`=================================================`);

  // Gas Prices to calculate
  const pricesGwei = [1, 3, 5];
  console.log("\nEstimated cost in BNB at different Gas Prices:");
  for (const gwei of pricesGwei) {
    const costInWei = totalGas * BigInt(gwei * 10 ** 9);
    const costInBNB = hre.ethers.formatEther(costInWei);
    console.log(`- At ${gwei} Gwei: ${costInBNB} BNB`);
  }
}

main().catch((err) => {
  console.error(error);
  process.exitCode = 1;
});
