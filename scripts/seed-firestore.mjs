import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { getDb } from "../server/firebase.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultStorePath = path.join(__dirname, "..", "data", "store.json");
const EVENT_ID = /^[0-9]{1,78}$/;

function validName(displayName) {
  return displayName.length >= 2 && displayName.length <= 32 && !/[\r\n]/.test(displayName);
}

export async function seedFirestore(storePath = defaultStorePath) {
  const db = getDb();
  if (!fs.existsSync(storePath)) {
    console.log(
      "No off-chain seed file. Profiles and page views start empty. Demo events stay on Avalanche: npm run contracts:seed.",
    );
    return { profiles: 0, views: 0 };
  }

  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const profiles = [];
  for (const [address, profile] of Object.entries(store.profiles || {})) {
    if (!ethers.isAddress(address)) continue;
    const displayName = String(profile?.displayName || "").trim();
    if (!validName(displayName)) continue;
    const updatedAt = Number(profile?.updatedAt);
    profiles.push({
      id: address.toLowerCase(),
      data: { displayName, updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now() },
    });
  }

  const views = [];
  for (const [eventId, count] of Object.entries(store.views || {})) {
    if (!EVENT_ID.test(eventId)) continue;
    const value = Number(count);
    if (!Number.isInteger(value) || value < 0) continue;
    views.push({ id: eventId, data: { count: value } });
  }

  const writes = [
    ...profiles.map((item) => ({ collection: "profiles", ...item })),
    ...views.map((item) => ({ collection: "views", ...item })),
  ];

  for (let index = 0; index < writes.length; index += 400) {
    const batch = db.batch();
    for (const item of writes.slice(index, index + 400)) {
      batch.set(db.collection(item.collection).doc(item.id), item.data);
    }
    await batch.commit();
  }

  return { profiles: profiles.length, views: views.length };
}

if (process.argv[1] && process.argv[1].endsWith("seed-firestore.mjs")) {
  seedFirestore()
    .then((result) => {
      console.log(`Seeded ${result.profiles} profiles and ${result.views} page-view counters.`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
