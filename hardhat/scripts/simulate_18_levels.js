const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const users = signers.slice(1, 20); // 19 users: users[0] to users[18]

  console.log("====================================================");
  console.log("STARTING 18-LEVEL MATRIX & REFERRAL GAS SIMULATION");
  console.log("====================================================");

  // 1. Deploy contracts
  console.log("\n--- Deploying Contracts ---");
  const OracleFactory = await ethers.getContractFactory("BNBPriceOracle");
  const oracle = await OracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("BNBPriceOracle deployed to:", oracleAddr);

  const ViewsFactory = await ethers.getContractFactory("aipcoreViews");
  const views = await ViewsFactory.deploy();
  await views.waitForDeployment();
  const viewsAddr = await views.getAddress();
  console.log("aipcoreViews library deployed to:", viewsAddr);

  const CoreFactory = await ethers.getContractFactory("aipcore", {
    libraries: { aipcoreViews: viewsAddr },
  });
  const core = await CoreFactory.deploy(
    deployer.address,       // _firstUser (Genesis)
    deployer.address,       // _feeReceiver
    ethers.ZeroAddress,     // _rewardPool (will link below)
    deployer.address,       // _owner
    deployer.address,       // _oracleAdmin
    deployer.address        // _matrixAdmin
  );
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();
  console.log("aipcore Core deployed to:", coreAddr);

  // Deploy and link AIPCoreViewsContract
  const ViewsContractFactory = await ethers.getContractFactory("AIPCoreViewsContract");
  const viewsContract = await ViewsContractFactory.deploy();
  await viewsContract.waitForDeployment();
  await core.setViewsContract(await viewsContract.getAddress());
  console.log("AIPCoreViewsContract deployed and linked.");

  // Create core instance with full interface ABI (routes getTierCost etc. via fallback)
  const coreWithViews = await ethers.getContractAt("contracts/Iaipcore.sol:Iaipcore", coreAddr);

  const PoolFactory = await ethers.getContractFactory("RewardPool");
  const pool = await PoolFactory.deploy(
    coreAddr,
    deployer.address,
    55555
  );
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("RewardPool deployed to:", poolAddr);

  // Link RewardPool and Oracle
  await core.setAddr(1, poolAddr, 0);
  await core.setAddr(11, oracleAddr, 0);
  console.log("Linked RewardPool and BNBPriceOracle to Core.");

  // Set BNB price to $600 (8 decimals)
  await oracle.setPrice(600n * 100000000n);
  console.log("BNB Price set to $600");

  // Fund all users with 1,000,000 BNB to make sure they have plenty of balance for upgrades
  console.log("\n--- Funding Test Accounts ---");
  for (let i = 0; i < users.length; i++) {
    const balanceWei = ethers.parseEther("1000000");
    const hexBalance = "0x" + balanceWei.toString(16);
    await hre.network.provider.send("hardhat_setBalance", [
      users[i].address,
      hexBalance
    ]);
  }
  console.log("All 19 test users funded with 1,000,000 BNB each.");

  // 2. Build the 18-level deep referral tree
  // Level 1: users[0] registers under 55555 (Genesis). Node ID = 55556
  // Level 2: users[1] registers under 55556. Node ID = 55557
  // ...
  // Level 18: users[17] registers under 55572. Node ID = 55573
  // User 19: users[18] registers under 55573. Node ID = 55574
  console.log("\n--- Building 18-Level Referral Hierarchy ---");
  const nodeIds = [55555n]; // nodeIds[0] = Genesis

  const regFee = await core.getRegistrationFee();
  const tier0Cost = await coreWithViews.getTierCost(0);
  console.log(`Registration fee: ${ethers.formatEther(regFee)} BNB`);

  // Register Level 1 to 17
  for (let i = 0; i < 17; i++) {
    const sponsorId = nodeIds[i];
    const user = users[i];
    const tx = await core.connect(user).createNode(sponsorId, { value: regFee });
    await tx.wait();
    const nid = await core.nodeId(user.address);
    await core.connect(user).unlockTier(nid, 1, { value: tier0Cost });
    nodeIds.push(nid);
    console.log(`Level ${i + 1} Node Registered and Upgraded to Tier 1: ID ${nid.toString()} (Sponsor: ${sponsorId.toString()})`);
  }

  // Verify parent chain for Level 17 (nodeIds[17])
  const level17NodeId = nodeIds[17];
  console.log(`Level 17 Node ID is: ${level17NodeId.toString()}`);

  // Now, register User 19 (users[18]) at Level 18 under Level 17 (nodeIds[17])
  // We will measure gas and count events for this transaction!
  console.log("\n--- REGISTERING USER 19 (AT LEVEL 18) ---");
  const user19 = users[18];
  const sponsor18 = level17NodeId;

  const regTx = await core.connect(user19).createNode(sponsor18, { value: regFee });
  const regReceipt = await regTx.wait();
  const user19NodeId = await core.nodeId(user19.address);
  await core.connect(user19).unlockTier(user19NodeId, 1, { value: tier0Cost });

  console.log(`User 19 registered and upgraded to Tier 1 successfully at Level 18 with Node ID: ${user19NodeId.toString()}`);
  console.log(`Gas Used for Registration: ${regReceipt.gasUsed.toString()} units`);

  // Let's count and analyze events in registration
  printEvents(regReceipt);

  // 3. User 19 Upgrades
  // Let's measure upgrade from Tier 1 to Tier 2 (first upgrade)
  console.log("\n--- UPGRADING USER 19 FROM TIER 1 TO TIER 2 ---");
  const tier2Cost = await coreWithViews.getTierCost(1);
  console.log(`Tier 2 Upgrade Cost: ${ethers.formatEther(tier2Cost)} BNB ($5 at $600/BNB)`);
  const upTx1 = await core.connect(user19).unlockTier(user19NodeId, 2, { value: tier2Cost });
  const upReceipt1 = await upTx1.wait();
  console.log(`Gas Used for Tier 2 Upgrade: ${upReceipt1.gasUsed.toString()} units`);
  printEvents(upReceipt1);

  // Let's measure upgrade from Tier 2 to Tier 18 one by one
  console.log("\n--- UPGRADING USER 19 FROM TIER 2 TO TIER 18 ONE BY ONE ---");
  for (let t = 3; t <= 18; t++) {
    console.log(`\n--- UPGRADING TO TIER ${t} ---`);
    const tierCost = await coreWithViews.getTierCost(t - 1);
    console.log(`Tier ${t} Upgrade Cost: ${ethers.formatEther(tierCost)} BNB`);
    const tx = await core.connect(user19).unlockTier(user19NodeId, t, { value: tierCost });
    const receipt = await tx.wait();
    console.log(`Gas Used for Tier ${t} Upgrade: ${receipt.gasUsed.toString()} units`);
    console.log(`Events count: ${receipt.logs.length}`);
    if (t === 3 || t === 18) {
      printEvents(receipt);
    }
  }

  console.log("\n====================================================");
  console.log("SIMULATION COMPLETE");
  console.log("====================================================");
}

function printEvents(receipt) {
  console.log(`\nEvents emitted in this transaction (Total: ${receipt.logs.length}):`);
  
  // Group events by name
  const counts = {};
  const eventDetails = [];
  
  for (const log of receipt.logs) {
    let name = "Unknown";
    let argsStr = "";
    try {
      const parsed = interfaceOfCore().parseLog(log);
      name = parsed.name;
      counts[name] = (counts[name] || 0) + 1;
      
      const cleanArgs = {};
      parsed.fragment.inputs.forEach((input, index) => {
        const argName = input.name || `arg${index}`;
        const val = parsed.args[index];
        cleanArgs[argName] = typeof val === 'bigint' ? val.toString() : val;
      });
      argsStr = JSON.stringify(cleanArgs);
    } catch (e) {
      name = "Log (" + log.topics[0] + ")";
      counts[name] = (counts[name] || 0) + 1;
    }
    eventDetails.push({ name, argsStr });
  }

  // Print summary counts
  console.log("Summary Counts:");
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  - ${name}: ${count}`);
  }

  // Print full event logs
  console.log("\nDetail Event Log:");
  eventDetails.forEach((ev, idx) => {
    console.log(`  [${idx + 1}] ${ev.name}: ${ev.argsStr}`);
  });
}

// A helper function to compile/get ABI interface
let cachedInterface = null;
function interfaceOfCore() {
  if (cachedInterface) return cachedInterface;
  const artifact = require("../artifacts/contracts/aipcore.sol/aipcore.json");
  cachedInterface = new ethers.Interface(artifact.abi);
  return cachedInterface;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
