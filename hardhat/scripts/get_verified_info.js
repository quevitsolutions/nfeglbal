const axios = require("axios");

async function main() {
  const apiKey = "6RDAKJA74DPRFCMA4Z2FUDM9TVQ7M88KT1";
  const address = "0xbd076cC53AbaeC543EF6caC34050cf8290D3D1C5"; // verified nfeglobal
  
  // Use V2 API to be safe, or try both
  const urlV2 = `https://api.etherscan.io/v2/api?chainid=97&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  const urlV1 = `https://api-testnet.bscscan.com/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  
  console.log("Fetching verified source code for:", address);
  
  try {
    const res = await axios.get(urlV1);
    console.log("V1 Response Status:", res.data.status, res.data.message);
    if (res.data.status === "1") {
      const info = res.data.result[0];
      console.log("CompilerVersion:", info.CompilerVersion);
      console.log("OptimizationUsed:", info.OptimizationUsed);
      console.log("Runs:", info.Runs);
      console.log("ConstructorArguments:", info.ConstructorArguments);
      console.log("EVMVersion:", info.EVMVersion);
      console.log("Library:", info.Library);
    } else {
      console.log("V1 Result:", res.data.result);
      
      console.log("Trying V2...");
      const resV2 = await axios.get(urlV2);
      console.log("V2 Response Status:", resV2.data.status, resV2.data.message);
      if (resV2.data.status === "1") {
        const info = resV2.data.result[0];
        console.log("CompilerVersion:", info.CompilerVersion);
        console.log("OptimizationUsed:", info.OptimizationUsed);
        console.log("Runs:", info.Runs);
        console.log("ConstructorArguments:", info.ConstructorArguments);
        console.log("EVMVersion:", info.EVMVersion);
        console.log("Library:", info.Library);
      } else {
        console.log("V2 Result:", resV2.data.result);
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
