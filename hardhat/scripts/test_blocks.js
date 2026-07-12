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
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const r1 = await rpc("eth_getCode", [CORE_ADDRESS, "0x" + (104725728).toString(16)]);
  const r2 = await rpc("eth_getCode", [CORE_ADDRESS, "0x" + (104725729).toString(16)]);
  console.log("104725728 code response:", r1);
  console.log("104725729 code response:", r2);
}

main().catch(console.error);
