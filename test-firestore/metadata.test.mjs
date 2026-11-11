import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { after, before, test } from "node:test";
import { Wallet } from "ethers";
import { deleteApp, initializeApp } from "firebase/app";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  setDoc,
  terminate,
} from "firebase/firestore";
import { getDb } from "../server/firebase.mjs";
import { app, profileMessage } from "../server/index.mjs";
import { seedFirestore } from "../scripts/seed-firestore.mjs";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "checkin-local";
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portText] = emulatorHost.split(":");

const clientApp = initializeApp(
  {
    apiKey: "demo-api-key",
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:checkin",
  },
  "metadata-test",
);
const clientDb = getFirestore(clientApp);
connectFirestoreEmulator(clientDb, host, Number(portText || 8080));

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  await terminate(clientDb);
  await deleteApp(clientApp);
  await getDb().terminate();
});

async function expectPermissionDenied(promise) {
  try {
    await promise;
  } catch (error) {
    assert.match(String(error.code), /permission-denied/);
    return;
  }
  assert.fail("expected permission-denied");
}

test("health stays the metadata service", async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "checkin-metadata" });
});

test("display names require a matching wallet signature and are readable by id", async () => {
  const wallet = Wallet.createRandom();
  const address = wallet.address;
  const displayName = "Ada";
  const signature = await wallet.signMessage(profileMessage(address, displayName));

  const badName = await fetch(`${base}/api/profile/${address}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "A", signature }),
  });
  assert.equal(badName.status, 400);
  assert.equal((await badName.json()).error, "Display name must be 2-32 characters.");

  const newline = await fetch(`${base}/api/profile/${address}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Ada\nLovelace", signature }),
  });
  assert.equal(newline.status, 400);

  const mismatch = await fetch(`${base}/api/profile/${address}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName,
      signature: await Wallet.createRandom().signMessage(profileMessage(address, displayName)),
    }),
  });
  assert.equal(mismatch.status, 401);
  assert.equal((await mismatch.json()).error, "Signature does not match this wallet.");

  const invalidAddress = await fetch(`${base}/api/profile/not-a-wallet`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, signature }),
  });
  assert.equal(invalidAddress.status, 400);
  assert.equal((await invalidAddress.json()).error, "Invalid address");

  const saved = await fetch(`${base}/api/profile/${address}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, signature }),
  });
  assert.equal(saved.status, 200);
  const body = await saved.json();
  assert.equal(body.profile.displayName, displayName);
  assert.equal(typeof body.profile.updatedAt, "number");

  const read = await fetch(`${base}/api/profile/${address.toUpperCase()}`);
  assert.equal(read.status, 200);
  assert.equal((await read.json()).profile.displayName, displayName);

  const missing = await fetch(`${base}/api/profile/${Wallet.createRandom().address}`);
  assert.deepEqual(await missing.json(), { profile: null });

  const batch = await fetch(`${base}/api/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses: [address, "nope", address] }),
  });
  const batched = await batch.json();
  assert.equal(batched.profiles[address.toLowerCase()].displayName, displayName);
  assert.equal(Object.keys(batched.profiles).length, 1);

  const snap = await getDoc(doc(clientDb, "profiles", address.toLowerCase()));
  assert.equal(snap.get("displayName"), displayName);

  await expectPermissionDenied(
    setDoc(doc(clientDb, "profiles", address.toLowerCase()), {
      displayName: "Eve",
      updatedAt: Date.now(),
    }),
  );
  const unchanged = await getDoc(doc(clientDb, "profiles", address.toLowerCase()));
  assert.equal(unchanged.get("displayName"), displayName);

  await expectPermissionDenied(deleteDoc(doc(clientDb, "profiles", address.toLowerCase())));
  await expectPermissionDenied(getDocs(collection(clientDb, "profiles")));
});

test("page views increment by one from the client and from the API", async () => {
  const eventId = String(7_000_000 + Math.floor(Math.random() * 1_000_000));
  const ref = doc(clientDb, "views", eventId);

  await setDoc(ref, { count: increment(1) }, { merge: true });
  assert.equal((await getDoc(ref)).get("count"), 1);

  await expectPermissionDenied(setDoc(ref, { count: increment(5) }, { merge: true }));
  await expectPermissionDenied(setDoc(ref, { count: increment(1), extra: true }, { merge: true }));
  await expectPermissionDenied(setDoc(doc(clientDb, "views", "event-1"), { count: 1 }));
  await expectPermissionDenied(deleteDoc(ref));
  assert.equal((await getDoc(ref)).get("count"), 1);

  const posted = await fetch(`${base}/api/analytics/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });
  assert.equal(posted.status, 200);
  assert.equal((await posted.json()).views, 2);

  const bad = await fetch(`${base}/api/analytics/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: "abc" }),
  });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, "Invalid event id");

  const analytics = await fetch(`${base}/api/analytics`);
  const views = await analytics.json();
  assert.equal(views[eventId], 2);

  const listed = await getDocs(collection(clientDb, "views"));
  const found = listed.docs.find((item) => item.id === eventId);
  assert.equal(found?.get("count"), 2);
});

test("seed imports a previous file store and ignores invalid rows", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "checkin-seed-"));
  const storePath = path.join(dir, "store.json");
  const wallet = Wallet.createRandom();
  writeFileSync(
    storePath,
    JSON.stringify({
      profiles: {
        [wallet.address]: { displayName: "Zed", updatedAt: 1700000000000 },
        "not-an-address": { displayName: "Skip", updatedAt: 1 },
      },
      views: { 42: 3, nope: 9, 8: -1 },
    }),
  );

  const result = await seedFirestore(storePath);
  assert.deepEqual(result, { profiles: 1, views: 1 });

  const profile = await fetch(`${base}/api/profile/${wallet.address}`);
  assert.equal((await profile.json()).profile.displayName, "Zed");
  const views = await fetch(`${base}/api/analytics`);
  assert.equal((await views.json())["42"], 3);

  const again = await seedFirestore(storePath);
  assert.deepEqual(again, { profiles: 1, views: 1 });
  const still = await fetch(`${base}/api/analytics`);
  assert.equal((await still.json())["42"], 3);
});
