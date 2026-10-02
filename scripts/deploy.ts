import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  if (network.name === "fuji" && network.config.chainId !== 43113) {
    throw new Error("Refusing to deploy: Fuji must be chain ID 43113.");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to ${network.name} with ${deployer.address}`);

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
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
