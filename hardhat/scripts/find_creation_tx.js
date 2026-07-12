const https = require("https");

const CORE_ADDRESS   = "0x4ea93b8Cd18b66c027AdBaa63CCF06B240dA1dFA";
const BSC_RPC        = "https://bsc-dataseed1.binance.org/";

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const req = https.request(BSC_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data).result); }
        catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const blockNumber = 104725729;
  const blockHex = "0x" + blockNumber.toString(16);
  const fullBlock = await rpc("eth_getBlockByNumber", [blockHex, true]);
  const txs = fullBlock.transactions || [];
  console.log(`Checking ${txs.length} transactions in block ${blockNumber}...`);

  for (const tx of txs) {
    const receipt = await rpc("eth_getTransactionReceipt", [tx.hash]);
    if (receipt) {
      if (receipt.contractAddress && receipt.contractAddress.toLowerCase() === CORE_ADDRESS.toLowerCase()) {
        console.log(`FOUND DIRECT CREATION:`);
        console.log(`Tx Hash: ${tx.hash}`);
        console.log(`From: ${tx.from}`);
        console.log(`To: ${tx.to}`);
        console.log(`Contract Address: ${receipt.contractAddress}`);
        return;
      }
      // Check logs for any hints or check if it was created internally
      // In some cases, we can search if the receipt has logs or if it's related
    }
  }
  console.log("Direct creation not found in transaction receipts. It might be created via internal transaction (CREATE/CREATE2 from another contract).");
}

main().catch(console.error);
