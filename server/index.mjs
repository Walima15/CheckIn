import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(__dirname, "..", "data", "store.json");
const port = Number(process.env.PORT || 3001);

function emptyStore() {
  return { profiles: {}, views: {} };
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function profileMessage(address, displayName) {
  return `CheckIn profile\n${address.toLowerCase()}\n${displayName}`;
}

const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "checkin-metadata" });
});

app.get("/api/profile/:address", (req, res) => {
  const address = req.params.address.toLowerCase();
  if (!ethers.isAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const store = readStore();
  res.json({ profile: store.profiles[address] || null });
});

app.post("/api/profiles", (req, res) => {
  const addresses = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
  const store = readStore();
  const profiles = {};
  for (const value of addresses.slice(0, 100)) {
    if (typeof value !== "string" || !ethers.isAddress(value)) continue;
    const key = value.toLowerCase();
    if (store.profiles[key]) profiles[key] = store.profiles[key];
  }
  res.json({ profiles });
});

app.put("/api/profile/:address", (req, res) => {
  const address = req.params.address;
  const displayName = String(req.body?.displayName || "").trim();
  const signature = String(req.body?.signature || "");

  if (!ethers.isAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  if (displayName.length < 2 || displayName.length > 32 || /[\r\n]/.test(displayName)) {
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

  const store = readStore();
  const key = address.toLowerCase();
  store.profiles[key] = { displayName, updatedAt: Date.now() };
  writeStore(store);
  res.json({ profile: store.profiles[key] });
});

app.post("/api/analytics/view", (req, res) => {
  const eventId = String(req.body?.eventId || "");
  if (!/^\d+$/.test(eventId)) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }
  const store = readStore();
  store.views[eventId] = (store.views[eventId] || 0) + 1;
  writeStore(store);
  res.json({ views: store.views[eventId] });
});

app.get("/api/analytics", (_req, res) => {
  res.json(readStore().views || {});
});

app.listen(port, "127.0.0.1", () => {
  console.log(`CheckIn metadata server on http://127.0.0.1:${port}`);
});
