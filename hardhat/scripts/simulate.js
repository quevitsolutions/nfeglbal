const hre = require("hardhat");

async function setPriceGradually(oracle, core, owner, targetPrice) {
  let currentPrice = 600n * 100000000n; // initial price is $600 (8 decimals)
  const target = BigInt(targetPrice) * 100000000n;
  const oracleAddr = await oracle.getAddress();
  console.log(`\n📈 Gradually increasing BNB price from $600 to $${targetPrice} to bypass deviation check...`);
  
  while (currentPrice < target) {
    currentPrice = (currentPrice * 115n) / 100n;
    if (currentPrice > target) {
      currentPrice = target;
    }
    
    // Set price on oracle
    await oracle.setPrice(currentPrice);
    
    // Fast forward time in Hardhat network by 10 seconds
    await hre.network.provider.send("evm_increaseTime", [10]);
    await hre.network.provider.send("evm_mine");
    
    // Force core contract to sync the price by re-linking the oracle address (type 11)
    await core.connect(owner).setAddr(11, oracleAddr, 0);
  }
  
  const finalPrice = await core.bnbPrice();
  console.log(`✅ BNB price successfully updated in core contract to: ${hre.ethers.formatUnits(finalPrice, 8)} USD`);
}

async function main() {
  const signers = await hre.ethers.getSigners();
  const owner = signers[0];
  const user1 = signers[1];
  const downlineSigners = signers.slice(2, 20); // 18 downline users (user2 to user19)
  
  console.log("Starting full upgrade logic simulation...");

  // 1. Deploy contracts
  console.log("\n--- Deploying Contracts ---");
  const OracleFactory = await hre.ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  console.log("BNBPriceOracle deployed to:", await oracle.getAddress());

  const ViewsFactory = await hre.ethers.getContractFactory("nfeglobalViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  console.log("nfeglobalViews library deployed to:", await views.getAddress());

  const CoreFactory = await hre.ethers.getContractFactory("nfeglobal", {
    libraries: { nfeglobalViews: await views.getAddress() },
  });
  const core = await CoreFactory.deploy(
    owner.address,
    owner.address,
    hre.ethers.ZeroAddress,
    owner.address,
    owner.address,
    owner.address
  );
  await core.waitForDeployment();
  
  console.log("nfeglobal Core deployed to:", await core.getAddress());

  const PoolFactory = await hre.ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(
    await core.getAddress(),
    owner.address,
    55555
  );
  await pool.waitForDeployment();
  console.log("RewardPool deployed to:", await pool.getAddress());

  // Link RewardPool and Oracle
  await core.setAddr(1, await pool.getAddress(), 0);
  await core.setAddr(11, await oracle.getAddress(), 0);
  console.log("Linked RewardPool and BNBPriceOracle to Core.");

  // Set BNB price to $600 (8 decimals)
  await oracle.setPrice(600n * 100000000n);
  console.log("BNB Price set to $600");

  // Set Price Bounds to support up to $10,000,000 BNB price
  await core.connect(owner).setPriceBounds(100n * 100000000n, 10000000n * 100000000n);
  console.log("Price bounds updated: Min $100, Max $10,000,000");

  // 2. Register Node #55556 (sponsor #55555)
  console.log("\n--- Registering Node #55556 (User 1, Sponsor #55555) ---");
  const regFee = await core.getRegistrationFee();
  const tier0Cost = await core.getTierCost(0);
  await core.connect(user1).createNode(55555, { value: regFee });
  const user1NodeId = await core.nodeId(user1.address);
  await core.connect(user1).unlockTier(user1NodeId, 1, { value: tier0Cost });
  console.log("User 1 registered and upgraded to Tier 1 with Node ID:", user1NodeId.toString());

  // 3. Register Downline Nodes sponsored by User 1
  const downlineNodeIds = [];
  
  for (let i = 0; i < downlineSigners.length; i++) {
    const signer = downlineSigners[i];
    await core.connect(signer).createNode(user1NodeId, { value: regFee });
    const nid = await core.nodeId(signer.address);
    await core.connect(signer).unlockTier(nid, 1, { value: tier0Cost });
    downlineNodeIds.push(nid);
    console.log(`User ${i + 2} registered and upgraded to Tier 1 with Node ID: ${nid.toString()}`);
  }

  const user2NodeId = downlineNodeIds[0];
  const user2 = downlineSigners[0];

  // 4. Try manual upgrade discount
  console.log("\n--- User 2 Upgrades to Tier 2 ---");
  const tier2Cost = await core.getTierCost(1);
  await core.connect(user2).unlockTier(user2NodeId, 2, { value: tier2Cost });
  console.log("User 2 successfully upgraded to Tier 2.");

  const user1MissedTier2 = await core.missedRewardsByTier(user1NodeId, 1);
  console.log("User 1 missed rewards for Tier 2:", hre.ethers.formatEther(user1MissedTier2), "BNB");

  console.log("\n--- User 2 Upgrades to Tier 3 ---");
  const tier3Cost = await core.getTierCost(2);
  await core.connect(user2).unlockTier(user2NodeId, 3, { value: tier3Cost });
  
  const user1MissedTier3 = await core.missedRewardsByTier(user1NodeId, 2);
  console.log("User 1 missed rewards for Tier 3:", hre.ethers.formatEther(user1MissedTier3), "BNB");

  const user1TotalPending = await core.getPendingUpgradeRewards(user1NodeId);
  console.log("User 1 total pending upgrade rewards (discount credit):", hre.ethers.formatEther(user1TotalPending), "BNB");

  // 5. User 1 manual upgrade with discount
  console.log("\n--- User 1 Manual Upgrade to Tier 2 with Discount ---");
  const user1StartBal = await hre.ethers.provider.getBalance(user1.address);
  console.log("User 1 balance before upgrade:", hre.ethers.formatEther(user1StartBal), "BNB");

  let valueToSend = 0n;
  if (user1MissedTier2 < tier2Cost) {
    valueToSend = tier2Cost - user1MissedTier2;
  }
  console.log("Net BNB user needs to send:", hre.ethers.formatEther(valueToSend), "BNB");

  const tx = await core.connect(user1).unlockTier(user1NodeId, 2, { value: valueToSend });
  const receipt = await tx.wait();
  const gasSpent = receipt.gasUsed * receipt.gasPrice;

  const user1EndBal = await hre.ethers.provider.getBalance(user1.address);
  console.log("User 1 balance after upgrade:", hre.ethers.formatEther(user1EndBal), "BNB");
  console.log("Actual BNB cost (including gas):", hre.ethers.formatEther(user1StartBal - user1EndBal), "BNB");
  console.log("Gas Spent:", hre.ethers.formatEther(gasSpent), "BNB");

  const node1Updated = await core.nodes(user1NodeId);
  console.log("User 1 node tier after upgrade:", node1Updated.tier.toString());

  console.log("\nSimulation Completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
