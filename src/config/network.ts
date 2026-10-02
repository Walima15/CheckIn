import deployed from "./deployed.json";

export const FUJI_CHAIN_ID = 43113;
export const FUJI_CHAIN_HEX = "0xA869";

export const FUJI_PARAMS = {
  chainId: FUJI_CHAIN_HEX,
  chainName: "Avalanche Fuji Testnet",
  nativeCurrency: {
    name: "AVAX",
    symbol: "AVAX",
    decimals: 18,
  },
  rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
  blockExplorerUrls: ["https://testnet.snowtrace.io/"],
};

export const RPC_URL =
  import.meta.env.VITE_AVALANCHE_TESTNET_RPC?.trim() || "https://api.avax-test.network/ext/bc/C/rpc";

function pick(envValue: string | undefined, fileValue: string) {
  const fromEnv = envValue?.trim();
  return fromEnv || fileValue || "";
}

export const addresses = {
  events: pick(import.meta.env.VITE_CHECKIN_EVENTS_CONTRACT, deployed.events),
  tickets: pick(import.meta.env.VITE_CHECKIN_TICKETS_CONTRACT, deployed.tickets),
  rewards: pick(import.meta.env.VITE_CHECKIN_REWARDS_CONTRACT, deployed.rewards),
};

export const deployBlock = Number(import.meta.env.VITE_DEPLOY_BLOCK || deployed.deployBlock || 0);

export function isConfiguredAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export const contractsConfigured =
  isConfiguredAddress(addresses.events) &&
  isConfiguredAddress(addresses.tickets) &&
  isConfiguredAddress(addresses.rewards);

export function requireContracts() {
  if (!contractsConfigured) {
    throw new Error("Deploy the CheckIn contracts to Avalanche Testnet before sending a transaction.");
  }
}

export function txUrl(hash: string) {
  return `https://testnet.snowtrace.io/tx/${hash}`;
}

export function addressUrl(address: string) {
  return `https://testnet.snowtrace.io/address/${address}`;
}

export function nftUrl(tokenId: string | number | bigint) {
  return `https://testnet.snowtrace.io/token/${addresses.tickets}?a=${tokenId.toString()}`;
}
