import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function verifyContract(address: string, constructorArguments: string[]) {
  const attempts: { label: string; run: () => Promise<void> }[] = [
    {
      label: "Routescan / Snowtrace",
      run: () =>
        run("verify:etherscan", {
          address,
          constructorArgsParams: constructorArguments,
          libraries: {},
        }),
    },
    {
      label: "Sourcify",
      run: () => run("verify:sourcify", { address, libraries: {} }),
    },
  ];
  for (const attempt of attempts) {
    try {
      await attempt.run();
      console.log(`Verified ${address} on ${attempt.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already verified/i.test(message)) {
        console.log(`Already verified ${address} on ${attempt.label}`);
        continue;
      }
      console.error(`Could not verify ${address} on ${attempt.label}: ${message}`);
    }
  }
}

async function main() {
  if (network.name === "fuji" && network.config.chainId !== 43113) {
    throw new Error("Refusing to deploy: Fuji must be chain ID 43113.");
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deploying to ${network.name} with ${deployer.address}`);
  console.log(`Balance ${ethers.formatEther(balance)} AVAX`);
  if (balance === 0n) {
    throw new Error(
      `Deployer ${deployer.address} has 0 AVAX on ${network.name}. Fund that address with Fuji testnet AVAX, then rerun. See DEPLOYMENT.md.`
    );
  }

  const Events = await ethers.getContractFactory("CheckInEvents");
  const events = await Events.deploy();
  await events.waitForDeployment();
  const eventsDeploy = await events.deploymentTransaction()?.wait();

  const Rewards = await ethers.getContractFactory("CheckInRewards");
  const rewards = await Rewards.deploy();
  await rewards.waitForDeployment();

  const Tickets = await ethers.getContractFactory("CheckInTickets");
  const tickets = await Tickets.deploy(await events.getAddress(), await rewards.getAddress());
  await tickets.waitForDeployment();

  const ticketsAddress = await tickets.getAddress();
  await (await events.setTicketsContract(ticketsAddress)).wait();
  await (await rewards.setTicketsContract(ticketsAddress)).wait();
  await (await events.renounceOwnership()).wait();
  await (await rewards.renounceOwnership()).wait();

  const addresses = {
    network: network.name,
    chainId: Number(network.config.chainId ?? 0),
    events: await events.getAddress(),
    tickets: ticketsAddress,
    rewards: await rewards.getAddress(),
    deployBlock: eventsDeploy?.blockNumber ?? 0,
    deployer: deployer.address,
  };

  fs.mkdirSync("deployments", { recursive: true });
  const file = path.join("deployments", `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(addresses, null, 2));
  console.log(`Saved ${file}`);

  if (network.name === "fuji") {
    const frontendFile = path.join("src", "config", "deployed.json");
    fs.mkdirSync(path.dirname(frontendFile), { recursive: true });
    fs.writeFileSync(frontendFile, JSON.stringify(addresses, null, 2));
    console.log(`Updated ${frontendFile}`);
  }

  console.log(addresses);
  console.log("Ownership of the wiring functions has been renounced.");
  if (addresses.chainId === 43113) {
    console.log(`Events: https://testnet.snowtrace.io/address/${addresses.events}`);
    console.log(`Tickets: https://testnet.snowtrace.io/address/${addresses.tickets}`);
    console.log(`Rewards: https://testnet.snowtrace.io/address/${addresses.rewards}`);
    console.log("Waiting for the explorer to index the contracts before verification...");
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    await verifyContract(addresses.events, []);
    await verifyContract(addresses.rewards, []);
    await verifyContract(addresses.tickets, [addresses.events, addresses.rewards]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
