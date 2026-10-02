import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import demoEvents from "../data/demo-events.json";

type DemoEvent = {
  name: string;
  description: string;
  imageURI: string;
  daysFromNow: number;
  durationHours: number;
  venue: string;
  location: string;
  category: string;
  priceAvax: string;
  maxSupply: number;
  bonusPoints: number;
  transfersAllowed: boolean;
};

async function main() {
  const deploymentPath = path.join("deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Missing ${deploymentPath}. Deploy first with npm run contracts:deploy.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as { events: string };
  const events = await ethers.getContractAt("CheckInEvents", deployment.events);
  const existing = await events.eventCount();

  if (existing > 0n && process.env.SEED_FORCE !== "1") {
    console.log(`Found ${existing} event(s). Set SEED_FORCE=1 to publish the demo set again.`);
    return;
  }

  const [organizer] = await ethers.getSigners();
  console.log(`Publishing demo events from ${organizer.address} on ${network.name}`);

  for (const item of demoEvents as DemoEvent[]) {
    const start = Math.floor(Date.now() / 1000) + item.daysFromNow * 24 * 60 * 60;
    const end = start + item.durationHours * 60 * 60;
    const tx = await events.createEvent({
      name: item.name,
      description: item.description,
      imageURI: item.imageURI,
      startTime: start,
      endTime: end,
      venue: item.venue,
      location: item.location,
      category: item.category,
      priceWei: ethers.parseEther(item.priceAvax),
      maxSupply: item.maxSupply,
      bonusPoints: item.bonusPoints,
      transfersAllowed: item.transfersAllowed,
      demo: true,
    });
    const receipt = await tx.wait();
    console.log(`Created "${item.name}" in ${receipt?.hash}`);
    if (network.config.chainId === 43113 && receipt?.hash) {
      console.log(`  https://testnet.snowtrace.io/tx/${receipt.hash}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
