const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function main() {
  const address = "0x9f64054Ea5F8fD7A5626Aa20F4Ac1b82B3c33346";
  const apiKey = "6RDAKJA74DPRFCMA4Z2FUDM9TVQ7M88KT1"; // From verify_reward_pool_api.js
  const url = `https://api.etherscan.io/v2/api?chainid=56&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;

  console.log("Fetching source code from BscScan for address:", address);
  try {
    const response = await axios.get(url);
    if (response.data && response.data.status === "1") {
      const result = response.data.result[0];
      const sourceCode = result.SourceCode;
      const contractName = result.ContractName;
      console.log("Contract Name:", contractName);
      
      const outputPath = path.join(__dirname, "RewardPool_Verified.sol");
      fs.writeFileSync(outputPath, sourceCode);
      console.log("Saved verified source code to:", outputPath);
    } else {
      console.error("Failed to fetch source code:", response.data.message || response.data.result);
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
