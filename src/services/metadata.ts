import { collection, doc, getDoc, getDocs, increment, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const ADDRESS = /^0x[a-f0-9]{40}$/;
const EVENT_ID = /^[0-9]{1,78}$/;

export function profileMessage(address: string, displayName: string) {
  return `CheckIn profile\n${address.toLowerCase()}\n${displayName}`;
}

export async function loadProfiles(addresses: string[]) {
  const unique: string[] = [];
  for (const value of addresses.slice(0, 100)) {
    if (typeof value !== "string") continue;
    const address = value.toLowerCase();
    if (!ADDRESS.test(address) || unique.includes(address)) continue;
    unique.push(address);
  }
  if (unique.length === 0) return {};
  try {
    const names: Record<string, string> = {};
    await Promise.all(
      unique.map(async (address) => {
        const snap = await getDoc(doc(db, "profiles", address));
        const displayName = snap.get("displayName");
        if (typeof displayName === "string" && displayName) names[address] = displayName;
      }),
    );
    return names;
  } catch {
    return {};
  }
}

export async function saveProfile(address: string, displayName: string, signature: string) {
  const response = await fetch(`/api/profile/${address}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, signature }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not save the display name.");
  return data;
}

export async function loadViews() {
  try {
    const snap = await getDocs(collection(db, "views"));
    const views: Record<string, number> = {};
    snap.forEach((item) => {
      const count = item.get("count");
      if (typeof count === "number" && Number.isFinite(count)) views[item.id] = count;
    });
    return views;
  } catch {
    return {};
  }
}

export function recordView(eventId: string) {
  if (!EVENT_ID.test(eventId)) return;
  setDoc(doc(db, "views", eventId), { count: increment(1) }, { merge: true }).catch(() => undefined);
}
