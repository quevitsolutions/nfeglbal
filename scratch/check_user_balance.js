import { ethers } from 'ethers';

const RPC_URL = "https://bsc-dataseed.binance.org/";
const AIPCORE_ADDRESS = '0xE82239361FBE54731CFF90D8c2036a33743fFd4d';
const USER_ADDRESS = '0xD975e406ceDd3992D9D233C0C0c7fB87C2942CCf';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // We can query the balance of the user
  const balance = await provider.getBalance(USER_ADDRESS);
  console.log(`User Address: ${USER_ADDRESS}`);
  console.log(`User BNB Balance: ${ethers.formatEther(balance)} BNB`);

  // Check block number
  const blockNumber = await provider.getBlockNumber();
  console.log(`Current Block: ${blockNumber}`);
}

main();
