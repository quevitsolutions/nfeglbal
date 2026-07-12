require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
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
            revertStrings: "default"
          }
        }
      }
    ],
    // Keep revert strings for the local hardhat network so tests can match reason strings
    overrides: {
      "contracts/aipcore.sol": { 
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
          evmVersion: "shanghai" 
        } 
      },
      "contracts/aipcoreStorage.sol": { 
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
          evmVersion: "shanghai" 
        } 
      },
      "contracts/NFEGovernance.sol": { 
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
          evmVersion: "shanghai" 
        } 
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 56,
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000,
      initialBaseFeePerGas: 0,
      gasPrice: 0,
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
      gasPrice: 50000000, // 0.05 Gwei (user requirement: try 0.05 first)
    },
    polygon: {
      url: "https://polygon-bor-rpc.publicnode.com",
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

