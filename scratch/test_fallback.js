import { ethers } from "ethers";

const RPC_NODES = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed3.binance.org/",
  "https://bsc-dataseed4.binance.org/",
];

async function main() {
  console.log("Initializing FallbackProvider...");
  const providers = RPC_NODES.map((url, index) => {
    // In ethers v6, FallbackProvider takes an array of provider configurations or JsonRpcProvider objects directly.
    return new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true });
  });
  const fallbackProvider = new ethers.FallbackProvider(providers);

  console.log("Querying balance using FallbackProvider...");
  const address = "0xA237A82f0623b0214e49CE33ec55132D2f579053";
  const balance = await fallbackProvider.getBalance(address);
  console.log("Balance of", address, "is", ethers.formatEther(balance), "BNB");
}

main().catch(err => console.error("Error:", err));
