import { ethers } from "ethers";
import { CONTRACTS, RPC_NODES } from "../src/config/constants.js";
import { AIPCORE_ABI } from "../contracts/abi.js";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
  const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, provider);
  
  const nodeId = 55560;
  console.log(`Checking Node #${nodeId} info...`);
  
  try {
    const node = await core.nodes(nodeId);
    console.log("Raw node:", node);
    
    // Let's print array values or keys if any
    if (Array.isArray(node)) {
      node.forEach((val, idx) => console.log(`[${idx}]:`, val?.toString()));
    } else {
      for (const key in node) {
        console.log(`${key}:`, node[key]?.toString());
      }
    }

    const cost = await core.getTierCost(1); // Cost for Tier 2 (index 1)
    console.log(`Cost for Tier 2: ${ethers.formatEther(cost)} BNB`);
  } catch (e) {
    console.error("Failed to fetch node info:", e);
  }
}

main();
