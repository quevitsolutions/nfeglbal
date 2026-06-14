const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const tenBnbHex = ethers.toBeHex(ethers.parseEther("10"));

  console.log("Deploying mock price oracle...");
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();

  console.log("Deploying views library...");
  const ViewsFactory = await ethers.getContractFactory("nfeglobalViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();

  console.log("Deploying core contract...");
  const CoreFactory = await ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    owner.address, owner.address, ethers.ZeroAddress,
    owner.address, owner.address, owner.address
  );
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();

  console.log("Deploying reward pool...");
  const PoolFactory = await ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(coreAddr, owner.address, 55555n);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();

  console.log("Deploying vesting vault...");
  const VaultFactory = await ethers.getContractFactory("NFEVestingVault");
  const vestingVault = await VaultFactory.deploy(owner.address, coreAddr, poolAddr, owner.address);
  await vestingVault.waitForDeployment();
  const vaultAddr = await vestingVault.getAddress();

  console.log("Configuring contracts...");
  await core.connect(owner).setGovernor(owner.address);
  await core.connect(owner).setVault(vaultAddr);
  await core.connect(owner).setAddr(1, poolAddr, 0);
  await core.connect(owner).setAddr(11, oracleAddr, 0);
  await core.connect(owner).setPriceBounds(100n * 100000000n, 10000n * 100000000n);
  await oracle.setPrice(300n * 100000000n);
  await core.connect(owner).setRegistrationFeeUSD(0);

  console.log("Registering 5 users...");
  const registeredNodeIds = [55555n];
  const wallets = [];

  for (let i = 0; i < 5; i++) {
    const pkey = ethers.keccak256(ethers.toBeHex(i, 32));
    const wallet = new ethers.Wallet(pkey, ethers.provider);
    wallets.push(wallet);

    const sponsorId = registeredNodeIds[Math.floor(Math.random() * registeredNodeIds.length)];

    const tx = await core.connect(wallet).createNode(sponsorId, {
      value: 0,
      gasPrice: 0,
      gasLimit: 3000000,
    });
    await tx.wait();

    const nodeId = 55556n + BigInt(i);
    registeredNodeIds.push(nodeId);
    console.log(`Registered user ${i} with Node ID ${nodeId}`);
  }

  console.log("Attempting to upgrade user 0 (Node 55556) to Tier 1...");
  const nodeId = registeredNodeIds[1]; // Node 55556
  const wallet = wallets[0];
  const cost = await core.getTierCost(0);
  console.log(`Tier 1 cost is ${ethers.formatEther(cost)} BNB`);

  console.log(`Funding wallet ${wallet.address} with 10 BNB...`);
  await ethers.provider.send("hardhat_setBalance", [wallet.address, tenBnbHex]);

  try {
    console.log(`Calling unlockTier with gasLimit estimation first...`);
    const gasEst = await core.connect(wallet).unlockTier.estimateGas(nodeId, 1, { value: cost });
    console.log(`Estimated gas: ${gasEst.toString()}`);
    
    console.log("Sending transaction...");
    const tx = await core.connect(wallet).unlockTier(nodeId, 1, { value: cost });
    const receipt = await tx.wait();
    console.log(`Transaction succeeded! Gas used: ${receipt.gasUsed.toString()}`);
  } catch (err) {
    console.error("Transaction failed with error:", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
