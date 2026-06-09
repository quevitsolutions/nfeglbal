const axios = require("axios");

async function main() {
  const apiKey = "6RDAKJA74DPRFCMA4Z2FUDM9TVQ7M88KT1";
  const guid = "uwge1fssuiiwls2v1tsxpdtcwtn2kxiucvtfyiqssispraucb5";
  
  const statusUrl = `https://api.etherscan.io/v2/api?chainid=97&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`;
  console.log("Checking verification status for GUID:", guid);
  
  try {
    const statusRes = await axios.get(statusUrl);
    console.log("Status check response:", statusRes.data);
  } catch (err) {
    console.error("API error:", err.message);
  }
}

main();
