import { ethers } from "ethers";
import { CONTRACTS, RPC_NODES } from "../src/config/constants.js";
import { NFEGLOBAL_ABI } from "../contracts/abi.js";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
  const core = new ethers.Contract(CONTRACTS.NFEGLOBAL, NFEGLOBAL_ABI, provider);
  
  const testIds = [55555, 55556, 55557, 55558, 55559, 55560];
  console.log("Checking missedRewardsByTier for Tier 1...");
  
  for (const id of testIds) {
    try {
      const missed = await core.missedRewardsByTier(id, 1);
      console.log(`Node #${id} missedRewardsByTier[1]: ${ethers.formatEther(missed)} BNB`);
    } catch (e) {
      console.log(`Node #${id} failed:`, e.message);
    }
  }
}

main();
