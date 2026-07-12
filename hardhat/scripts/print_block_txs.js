const https = require("https");

const DEPLOYER       = "0x0Bc4218A25C44403A05DbF778F90e7D41499Aa02";
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

  let found = 0;
  for (const tx of txs) {
    if (tx.from && tx.from.toLowerCase() === DEPLOYER.toLowerCase()) {
      console.log(`\nTransaction ${found + 1} from Deployer:`);
      console.log(`Hash: ${tx.hash}`);
      console.log(`To: ${tx.to}`);
      console.log(`Value: ${parseInt(tx.value, 16)} wei`);
      console.log(`Input: ${tx.input.substring(0, 100)}...`);
      const receipt = await rpc("eth_getTransactionReceipt", [tx.hash]);
      if (receipt) {
        console.log(`Status: ${receipt.status}`);
        console.log(`Contract Created: ${receipt.contractAddress}`);
        console.log(`Logs count: ${receipt.logs ? receipt.logs.length : 0}`);
      }
      found++;
    }
  }
  if (found === 0) {
    console.log("No transactions from deployer found in block 104725729.");
  }
}

main().catch(console.error);
