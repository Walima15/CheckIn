export async function loadProfiles(addresses: string[]) {
  const unique = [...new Set(addresses.map((address) => address.toLowerCase()))];
  if (unique.length === 0) return {};
  try {
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: unique }),
    });
    if (!response.ok) return {};
    const data = (await response.json()) as { profiles?: Record<string, { displayName?: string }> };
    const names: Record<string, string> = {};
    for (const [address, profile] of Object.entries(data.profiles || {})) {
      if (profile.displayName) names[address.toLowerCase()] = profile.displayName;
    }
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

export function profileMessage(address: string, displayName: string) {
  return `CheckIn profile\n${address.toLowerCase()}\n${displayName}`;
}

export async function loadViews() {
  try {
    const response = await fetch("/api/analytics");
    if (!response.ok) return {};
    return (await response.json()) as Record<string, number>;
  } catch {
    return {};
  }
}

export function recordView(eventId: string) {
  fetch("/api/analytics/view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  }).catch(() => undefined);
}
