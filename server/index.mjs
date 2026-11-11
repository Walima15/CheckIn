import express from "express";
import { realpathSync } from "fs";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { firestoreTargetLabel, getDb } from "./firebase.mjs";

const port = Number(process.env.PORT || 3001);
const db = getDb();
const EVENT_ID = /^[0-9]{1,78}$/;

export function profileMessage(address, displayName) {
  return `CheckIn profile\n${address.toLowerCase()}\n${displayName}`;
}

function invalidDisplayName(displayName) {
  return displayName.length < 2 || displayName.length > 32 || /[\r\n]/.test(displayName);
}

const app = express();
app.use(express.json({ limit: "32kb" }));

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "checkin-metadata" });
});

app.get("/api/profile/:address", wrap(async (req, res) => {
  const address = req.params.address.toLowerCase();
  if (!ethers.isAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const snap = await db.collection("profiles").doc(address).get();
  res.json({ profile: snap.exists ? snap.data() : null });
}));

app.post("/api/profiles", wrap(async (req, res) => {
  const addresses = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
  const keys = [];
  for (const value of addresses.slice(0, 100)) {
    if (typeof value !== "string" || !ethers.isAddress(value)) continue;
    const key = value.toLowerCase();
    if (!keys.includes(key)) keys.push(key);
  }

  const profiles = {};
  if (keys.length > 0) {
    const refs = keys.map((key) => db.collection("profiles").doc(key));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) profiles[snap.id] = snap.data();
    }
  }
  res.json({ profiles });
}));

app.put("/api/profile/:address", wrap(async (req, res) => {
  const address = req.params.address;
  const displayName = String(req.body?.displayName || "").trim();
  const signature = String(req.body?.signature || "");

  if (!ethers.isAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  if (invalidDisplayName(displayName)) {
    res.status(400).json({ error: "Display name must be 2-32 characters." });
    return;
  }

  let recovered;
  try {
    recovered = ethers.verifyMessage(profileMessage(address, displayName), signature);
  } catch {
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    res.status(401).json({ error: "Signature does not match this wallet." });
    return;
  }

  const profile = { displayName, updatedAt: Date.now() };
  await db.collection("profiles").doc(address.toLowerCase()).set(profile);
  res.json({ profile });
}));

app.post("/api/analytics/view", wrap(async (req, res) => {
  const eventId = String(req.body?.eventId || "");
  if (!EVENT_ID.test(eventId)) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }
  const ref = db.collection("views").doc(eventId);
  const views = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.get("count")) || 0 : 0;
    const next = current + 1;
    tx.set(ref, { count: next });
    return next;
  });
  res.json({ views });
}));

app.get("/api/analytics", wrap(async (_req, res) => {
  const snap = await db.collection("views").get();
  const views = {};
  snap.forEach((item) => {
    const count = item.get("count");
    if (typeof count === "number") views[item.id] = count;
  });
  res.json(views);
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: "Could not reach the database." });
});

export { app };

async function waitForEmulator() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return;
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  console.warn(`Firestore emulator at ${url} did not respond. Profile and view requests will fail until it is up.`);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  await waitForEmulator();
  app.listen(port, "127.0.0.1", () => {
    console.log(`CheckIn metadata server on http://127.0.0.1:${port} (Firestore ${firestoreTargetLabel()})`);
  });
}
