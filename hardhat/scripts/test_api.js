const axios = require("axios");

async function main() {
  const apiKey = "6RDAKJA74DPRFCMA4Z2FUDM9TVQ7M88KT1";
  const address = "0x3125B4d0d4250132140d91F0800521905A4580fa";
  const url = `https://api-testnet.bscscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
  
  try {
    const response = await axios.get(url);
    console.log("Entire Response:", response.data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
