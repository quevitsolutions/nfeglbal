const https = require("https");

const CORE_ADDRESS   = "0x4ea93b8Cd18b66c027AdBaa63CCF06B240dA1dFA";
const DEPLOYER       = "0x0Bc4218A25C44403A05DbF778F90e7D41499Aa02";
const BSC_RPC        = "https://bsc-dataseed1.binance.org/";
const BSCSCAN_KEY    = "6RDAKJA74DPRFCMA4Z2FUDM9TVQ7M88KT1";

// ── simple JSON-RPC helper ────────────────────────────────────────────────────
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

// ── BscScan API v2 helper ─────────────────────────────────────────────────────
function bscscanV2(params) {
  const qs = new URLSearchParams({ ...params, chainid: "56", apikey: BSCSCAN_KEY }).toString();
  const url = `https://api.etherscan.io/v2/api?${qs}`;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" NFE Global — Core Engine Creation Lookup");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" Contract :", CORE_ADDRESS);
  console.log(" Deployer :", DEPLOYER);
  console.log();

  // ── 1. Confirm code exists at address ────────────────────────────────────
  const code = await rpc("eth_getCode", [CORE_ADDRESS, "latest"]);
  if (!code || code === "0x") {
    console.error("❌ No bytecode found at address — wrong network?");
    process.exit(1);
  }
  console.log(`✅ Bytecode confirmed at ${CORE_ADDRESS} (${(code.length - 2) / 2} bytes)`);

  // ── 2. Binary search for creation block ──────────────────────────────────
  const latestHex = await rpc("eth_blockNumber", []);
  const latest = parseInt(latestHex, 16);
  console.log(`\n🔍 Current BSC block: ${latest.toLocaleString()}`);
  console.log("🔍 Binary-searching for creation block (this takes ~15 seconds)...");

  let lo = 0, hi = latest, creationBlock = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midHex = "0x" + mid.toString(16);
    const c = await rpc("eth_getCode", [CORE_ADDRESS, midHex]);
    if (c && c !== "0x") {
      creationBlock = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  if (!creationBlock) {
    console.error("❌ Could not locate creation block via binary search.");
    process.exit(1);
  }

  // ── 3. Get block timestamp ────────────────────────────────────────────────
  const blockHex = "0x" + creationBlock.toString(16);
  const block = await rpc("eth_getBlockByNumber", [blockHex, false]);
  const timestamp = parseInt(block.timestamp, 16);
  const deployedAt = new Date(timestamp * 1000);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🎯 CORE ENGINE DEPLOYMENT DETAILS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Block Number  : ${creationBlock.toLocaleString()}`);
  console.log(`  Block Hash    : ${block.hash}`);
  console.log(`  Timestamp     : ${timestamp} (Unix)`);
  console.log(`  Date/Time UTC : ${deployedAt.toUTCString()}`);
  console.log(`  Date/Time ISO : ${deployedAt.toISOString()}`);
  console.log(`  BscScan Link  : https://bscscan.com/address/${CORE_ADDRESS}`);
  console.log(`  Block Link    : https://bscscan.com/block/${creationBlock}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── 4. Find the actual creation tx in the block ───────────────────────────
  console.log("\n🔍 Fetching full block to find creation transaction...");
  const fullBlock = await rpc("eth_getBlockByNumber", [blockHex, true]);
  const txs = fullBlock.transactions || [];
  console.log(`   Block contains ${txs.length} transactions`);

  let creationTx = null;
  for (const tx of txs) {
    // Contract creation tx has no "to" field
    if (!tx.to && tx.from && tx.from.toLowerCase() === DEPLOYER.toLowerCase()) {
      // Get the receipt to confirm the created address
      const receipt = await rpc("eth_getTransactionReceipt", [tx.hash]);
      if (receipt && receipt.contractAddress &&
          receipt.contractAddress.toLowerCase() === CORE_ADDRESS.toLowerCase()) {
        creationTx = { tx, receipt };
        break;
      }
    }
  }

  if (creationTx) {
    console.log("\n  ✅ CREATION TRANSACTION FOUND:");
    console.log(`  Tx Hash       : ${creationTx.tx.hash}`);
    console.log(`  From (Deployer): ${creationTx.tx.from}`);
    console.log(`  Gas Used      : ${parseInt(creationTx.receipt.gasUsed, 16).toLocaleString()}`);
    console.log(`  Status        : ${creationTx.receipt.status === "0x1" ? "✅ SUCCESS" : "❌ FAILED"}`);
    console.log(`  BscScan Tx    : https://bscscan.com/tx/${creationTx.tx.hash}`);
  } else {
    console.log("\n  ⚠️  Creation tx not found in block txs (may be internal). Checking all txs from deployer...");
    for (const tx of txs) {
      if (tx.from && tx.from.toLowerCase() === DEPLOYER.toLowerCase()) {
        const receipt = await rpc("eth_getTransactionReceipt", [tx.hash]);
        if (receipt && receipt.contractAddress) {
          console.log(`  Contract created: ${receipt.contractAddress} via tx ${tx.hash}`);
        }
      }
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
