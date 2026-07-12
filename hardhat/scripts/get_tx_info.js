const https = require("https");

const TX_HASH = "0xa1865c6bfe5e9c7471257b58b62fdabffbf0f09135796f5a223bdcfe420965db";
const BSC_RPC = "https://bsc-dataseed1.binance.org/";

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
  console.log("Fetching Tx Details for:", TX_HASH);
  const tx = await rpc("eth_getTransactionByHash", [TX_HASH]);
  if (!tx) {
    console.error("Transaction not found.");
    return;
  }
  const receipt = await rpc("eth_getTransactionReceipt", [TX_HASH]);
  
  const block = await rpc("eth_getBlockByNumber", [tx.blockNumber, false]);
  const timestamp = parseInt(block.timestamp, 16);
  const date = new Date(timestamp * 1000);

  console.log("\n=================== TRANSACTION DETAILS ===================");
  console.log(`Block Number   : ${parseInt(tx.blockNumber, 16)}`);
  console.log(`Block Hash     : ${tx.blockHash}`);
  console.log(`Timestamp      : ${timestamp} (${date.toUTCString()} / ${date.toISOString()})`);
  console.log(`From           : ${tx.from}`);
  console.log(`To             : ${tx.to}`);
  console.log(`Value          : ${parseInt(tx.value, 16)} wei`);
  console.log(`Gas Price      : ${parseInt(tx.gasPrice, 16) / 1e9} gwei`);
  console.log(`Gas Limit      : ${parseInt(tx.gas, 16)}`);
  console.log(`Input Length   : ${tx.input.length}`);
  console.log(`Input (Preview): ${tx.input.substring(0, 200)}...`);
  
  if (receipt) {
    console.log(`Status         : ${receipt.status === "0x1" ? "Success" : "Failed"}`);
    console.log(`Gas Used       : ${parseInt(receipt.gasUsed, 16)}`);
    console.log(`Created Address: ${receipt.contractAddress || "None (Not direct creation)"}`);
    console.log(`Logs Count     : ${receipt.logs.length}`);
    if (receipt.logs.length > 0) {
      console.log("\nLogs:");
      receipt.logs.forEach((log, index) => {
        console.log(`  Log #${index}:`);
        console.log(`    Address: ${log.address}`);
        console.log(`    Topics : ${JSON.stringify(log.topics)}`);
        console.log(`    Data   : ${log.data.substring(0, 100)}...`);
      });
    }
  }
}

main().catch(console.error);
