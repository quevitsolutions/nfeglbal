const axios = require("axios");

async function main() {
  const apiKey = "6RDAKJA74DPRFCMA4Z2FUDM9TVQ7M88KT1";
  const address = "0x3125B4d0d4250132140d91F0800521905A4580fa";
  const targetContract = "0xFe5dc74f5C7285cc8d61461934A9028c01DebC95".toLowerCase();
  
  console.log(`Fetching transactions for deployer: ${address} on BSC Testnet (via Etherscan V2 API)...`);
  
  const url = `https://api-testnet.bscscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
  
  try {
    const response = await axios.get(url);
    if (response.data.status !== "1") {
      console.error("Etherscan V2 API Error:", response.data.message);
      console.log("Response:", response.data);
      return;
    }
    
    const txs = response.data.result;
    console.log(`Found ${txs.length} transactions.`);
    
    let found = false;
    for (const tx of txs) {
      if (tx.contractAddress && tx.contractAddress.toLowerCase() === targetContract) {
        console.log("\n🎯 FOUND CREATION TRANSACTION!");
        console.log("Tx Hash:", tx.hash);
        console.log("Block Number:", tx.blockNumber);
        console.log("Timestamp:", new Date(parseInt(tx.timeStamp) * 1000).toISOString());
        console.log("From:", tx.from);
        console.log("To:", tx.to);
        console.log("Contract Address Created:", tx.contractAddress);
        found = true;
        break;
      }
      
      if (tx.to && tx.to.toLowerCase() === targetContract) {
        console.log(`\nℹ️ Found interaction with RewardPool at Tx: ${tx.hash}`);
      }
    }
    
    if (!found) {
      console.log("\nNo direct contract creation transaction found in normal tx list. Checking internal txs...");
      const internalUrl = `https://api-testnet.bscscan.com/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
      const internalRes = await axios.get(internalUrl);
      if (internalRes.data.status === "1") {
        const internalTxs = internalRes.data.result;
        for (const tx of internalTxs) {
          if (tx.contractAddress && tx.contractAddress.toLowerCase() === targetContract) {
            console.log("\n🎯 FOUND CREATION IN INTERNAL TRANSACTION!");
            console.log("Tx Hash:", tx.hash);
            console.log("Block Number:", tx.blockNumber);
            console.log("From:", tx.from);
            console.log("To:", tx.to);
            console.log("Contract Address Created:", tx.contractAddress);
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      console.log("\nNo creation transaction found associated with deployer. Let's list internal txs of RewardPool itself to find its creation.");
      const poolUrl = `https://api-testnet.bscscan.com/api?module=account&action=txlistinternal&txhash=&address=${targetContract}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`;
      const poolRes = await axios.get(poolUrl);
      if (poolRes.data.status === "1") {
        const poolTxs = poolRes.data.result;
        console.log(`RewardPool has ${poolTxs.length} internal transactions.`);
        if (poolTxs.length > 0) {
          console.log("First internal transaction details:");
          console.log(poolTxs[0]);
        }
      }
    }
    
  } catch (error) {
    console.error("API request failed:", error.message);
  }
}

main();
