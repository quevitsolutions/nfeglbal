require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
        details: {
          yul: true,
          constantOptimizer: true,
          cse: true,
          deduplicate: true,
          peephole: true
        }
      },
      viaIR: true,
      evmVersion: "shanghai",
      metadata: {
        bytecodeHash: "none"
      },
      debug: {
        revertStrings: "strip"
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 56,
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000,
      accounts: {
        count: 100,
      }
    },
    bscTestnet: {
      url: "https://bsc-testnet.bnbchain.org",
      chainId: 97,
      accounts: [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`],
      gasPrice: 3000000000, // 3 Gwei
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`],
      gasPrice: 100000000, // 0.1 Gwei (100,000,000 wei)
    },
    polygon: {
      url: "https://polygon-rpc.com",
      chainId: 137,
      accounts: [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`],
    },
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY || "",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

