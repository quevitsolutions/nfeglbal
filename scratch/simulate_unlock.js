import { ethers } from "ethers";
import { CONTRACTS, RPC_NODES } from "../src/config/constants.js";
import { AIPCORE_ABI } from "../contracts/abi.js";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
  const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, provider);
  
  const nodeId = 55560;
  const toTier = 2;
  const userAddress = "0xf220DC8E6CDdB7CddCb628043C969d4F09Ded25E";
  
  console.log(`Simulating unlockTier(${nodeId}, ${toTier}) from ${userAddress}...`);
  
  try {
    const cost = await core.getTierCost(1); // Index 1 is Tier 2 cost
    console.log(`Cost: ${ethers.formatEther(cost)} BNB (${cost.toString()} wei)`);
    
    // Use callStatic / staticCall
    const result = await provider.call({
      to: CONTRACTS.AIPCORE,
      from: userAddress,
      data: core.interface.encodeFunctionData("unlockTier", [nodeId, toTier]),
      value: cost
    });
    
    console.log("Success! Static call returned raw data:", result);
  } catch (e) {
    console.error("Simulation failed!");
    if (e.data) {
      console.log("Revert data:", e.data);
      try {
        const decodedError = core.interface.parseError(e.data);
        console.log("Decoded error:", decodedError);
      } catch (err) {
        console.log("Could not parse error custom type:", err.message);
      }
    } else {
      console.error(e);
    }
  }
}

main();
