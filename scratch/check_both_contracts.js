import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";

const ABI = [
  "function totalNodes() view returns (uint256)",
  "function _nextId() view returns (uint256)"
];

async function checkContract(address) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(address, ABI, provider);
  try {
    const total = await contract.totalNodes();
    const nextId = await contract._nextId();
    console.log(`Contract ${address} - Total Nodes: ${total.toString()}, Next ID: ${nextId.toString()}`);
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
