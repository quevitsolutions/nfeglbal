import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";

const ABI = [
  "function nodeId(address user) view returns (uint256)",
  "function owner() view returns (address)"
];

async function checkContract(address) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(address, ABI, provider);
  const user = "0xD975e406ceDd3992D9D233C0C0c7fB87C2942CCf";
  try {
    const owner = await contract.owner();
    const nId = await contract.nodeId(user);
    console.log(`Contract ${address} - Owner: ${owner}, User Node ID: ${nId.toString()}`);
  } catch (e) {
    console.log(`Contract ${address} - Failed:`, e.message);
  }
}

async function main() {
  console.log("Checking contract 1 (NFEGLOBAL):");
  await checkContract("0xE82239361FBE54731CFF90D8c2036a33743fFd4d");

  console.log("\nChecking contract 2 (aipcore hub):");
  await checkContract("0xB6CbD70147835D4eA93B4a768D8e101B6E9A420f");
}

main();
