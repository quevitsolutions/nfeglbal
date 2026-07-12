const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { ethers } = require("hardhat");

async function main() {
  const buildInfoDir = path.join(__dirname, "../artifacts/build-info");
  const files = fs.readdirSync(buildInfoDir);
  const buildInfoFile = files.find(f => f.endsWith(".json"));
  if (!buildInfoFile) {
    console.error("No build-info file found!");
    return;
  }
  const buildInfoPath = path.join(buildInfoDir, buildInfoFile);
  console.log("Loading build-info from:", buildInfoPath);
  
  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
  
  // Extract compiler version
  const solcLongVersion = buildInfo.solcLongVersion;
  console.log("Compiler version:", solcLongVersion);
  
  // Extract standard compiler input
  const input = buildInfo.input;
  const inputString = JSON.stringify(input);
  console.log("Input JSON size (chars):", inputString.length);

  // Load deployment info
  const network = hre.network.name;
  const filename = `deployment_${network}.json`;
  const deploymentPath = path.join(__dirname, `../${filename}`);
  if (!fs.existsSync(deploymentPath)) {
    console.error(`${filename} not found!`);
    return;
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  // API parameters
  const apiKey = network === "polygon" 
    ? (process.env.POLYGONSCAN_API_KEY || "")
    : (process.env.BSCSCAN_API_KEY || "6RDAKJA74DPRFCMA4Z2FUDM9TVQ7M88KT1");
  const contractAddress = deployment.contracts.RewardPool;
  const contractName = "contracts/RewardPool.sol:RewardPool";
  
  // Dynamically encode constructor arguments
  const engineAddress = deployment.contracts.aipcore;
  const ownerAddress = deployment.deployer;
  const genesisNodeId = 55555;
  
  const encoder = new ethers.AbiCoder();
  const constructorArgs = encoder.encode(
    ["address", "address", "uint256"],
    [engineAddress, ownerAddress, genesisNodeId]
  ).slice(2); // remove 0x

  console.log("Target RewardPool Address:", contractAddress);
  console.log("Encoded arguments:", constructorArgs);

  const chainId = network === "polygon" ? 137 : (network === "bsc" ? 56 : 97);
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}`;
  console.log("Submitting standard-json-input verification to:", url);

  const params = new URLSearchParams();
  params.append("apikey", apiKey);
  params.append("module", "contract");
  params.append("action", "verifysourcecode");
  params.append("contractaddress", contractAddress);
  params.append("sourceCode", inputString);
  params.append("codeformat", "solidity-standard-json-input");
  params.append("contractname", contractName);
  params.append("compilerversion", "v" + solcLongVersion);
  params.append("constructorArguements", constructorArgs);

  try {
    const response = await axios.post(url, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    console.log("Response:", response.data);
    if (response.data.status === "1") {
      const guid = response.data.result;
      console.log(`\n🎉 Verification submitted successfully! GUID: ${guid}`);
      console.log("Polling status in 10 seconds...");
      
      // Poll status
      await new Promise(resolve => setTimeout(resolve, 10000));
      const statusUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`;
      const statusRes = await axios.get(statusUrl);
      console.log("Status check response:", statusRes.data);
    } else {
      console.error("\n❌ Submission failed:", response.data.result);
    }
  } catch (error) {
    console.error("API error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
