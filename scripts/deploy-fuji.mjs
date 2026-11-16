import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";

dotenv.config();

const rpc = process.env.AVALANCHE_TESTNET_RPC?.trim() || "https://api.avax-test.network/ext/bc/C/rpc";
const privateKey = process.env.PRIVATE_KEY?.trim();

if (!privateKey) {
  console.error("PRIVATE_KEY is missing. Copy .env.example to .env and set a Fuji testnet key.");
  console.error("Do not commit that file. See DEPLOYMENT.md.");
  process.exit(1);
}

let deployer;
try {
  deployer = new Wallet(privateKey);
} catch {
  console.error("PRIVATE_KEY is not a valid hex private key.");
  process.exit(1);
}

const provider = new JsonRpcProvider(rpc, 43113);
const network = await provider.getNetwork();
if (Number(network.chainId) !== 43113) {
  console.error(`Refusing to deploy. RPC chain id is ${network.chainId}, expected 43113.`);
  process.exit(1);
}

const balance = await provider.getBalance(deployer.address);
console.log(`Deployer ${deployer.address}`);
console.log(`Fuji balance ${formatEther(balance)} AVAX`);
console.log(`Explorer https://testnet.snowtrace.io/address/${deployer.address}`);

if (balance === 0n) {
  console.error("");
  console.error("This deployer has no Fuji AVAX, so the contracts were not deployed.");
  console.error("Send testnet AVAX (chain id 43113) to the address above, then rerun:");
  console.error("  npm run contracts:fuji");
  console.error("A normal faucet drip is enough. Do not send mainnet AVAX.");
  console.error("Faucet options and the current blocker are in DEPLOYMENT.md.");
  process.exit(1);
}

const child = spawn("npx", ["hardhat", "run", "scripts/deploy.ts", "--network", "fuji"], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Deploy stopped by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
