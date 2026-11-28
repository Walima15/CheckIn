import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY?.trim();
const accounts = privateKey ? [privateKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    fuji: {
      url: process.env.AVALANCHE_TESTNET_RPC || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts,
    },
  },
  mocha: {
    timeout: 60_000,
  },
  etherscan: {
    // Per-network key keeps Hardhat on this explorer's API. A single string
    // would switch the plugin to Etherscan v2, which does not index Fuji.
    apiKey: {
      fuji: process.env.ROUTESCAN_API_KEY?.trim() || "routescan",
    },
    customChains: [
      {
        network: "fuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api",
          browserURL: "https://testnet.snowtrace.io",
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
};

export default config;
