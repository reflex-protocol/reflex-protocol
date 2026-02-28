import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env if .env.local doesn't exist

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const RPC_URL = process.env.SOMNIA_TESTNET_RPC_URL || "";

const config: HardhatUserConfig = {
  etherscan: {
    apiKey: {
      // Shannon Explorer is compatible with the Etherscan verification API.
      // API key value is arbitrary — the explorer accepts any non-empty string.
      somnia_testnet: process.env.SOMNIA_EXPLORER_API_KEY ?? "placeholder"
    },
    customChains: [
      {
        network: "somnia_testnet",
        chainId: 50312,
        urls: {
          apiURL: "https://shannon-explorer.somnia.network/api",
          browserURL: "https://shannon-explorer.somnia.network"
        }
      }
    ]
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  namedAccounts: {
    deployer: {
      default: 0
    }
  },
  networks: {
    hardhat: {},
    somnia_testnet: {
      url: RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deployments: "./deployments"
  }
};

export default config;
