import { ethers } from "ethers";

const RPC_NODES = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed3.binance.org/",
  "https://bsc-dataseed4.binance.org/",
];

const CONTRACTS = {
  AIPCORE: "0x4ea93b8Cd18b66c027AdBaa63CCF06B240dA1dFA"
};

const AIPCORE_ABI = [
  "function nodeId(address wallet) external view returns (uint256)",
  "function isFreeRegistered(uint256 id) external view returns (bool)"
];

async function main() {
  console.log("Initializing FallbackProvider...");
  const providers = RPC_NODES.map((url) => new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true }));
  const fallbackProvider = new ethers.FallbackProvider(providers);

  console.log("Instantiating Contract with static provider...");
  const baseProvider = new ethers.JsonRpcProvider(RPC_NODES[0]);
  const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, baseProvider);

  console.log("Connecting to FallbackProvider dynamically...");
  const coreConnected = core.connect(fallbackProvider);

  const address = "0xA237A82f0623b0214e49CE33ec55132D2f579053";
  console.log("Querying nodeId via connected contract...");
  const nid = await coreConnected.nodeId(address);
  console.log("Returned nodeId:", Number(nid));

  if (nid > 0n) {
    const isFree = await coreConnected.isFreeRegistered(nid);
    console.log("isFreeRegistered:", isFree);
  }
}

main().catch(err => console.error("Error:", err));
