export type CheckInAccount = {
  displayName: string;
  createdAt: number;
};

export const ACCOUNT_STORAGE_KEY = "checkin.account";

type AccountStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function validateDisplayName(value: string): string {
  const displayName = value.trim();
  if (displayName.length < 2 || displayName.length > 32 || /[\r\n]/.test(displayName)) {
    throw new Error("Display name must be 2-32 characters.");
  }
  return displayName;
}

export function readStoredAccount(storage: Pick<Storage, "getItem"> = localStorage): CheckInAccount | null {
  try {
    const raw = storage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckInAccount>;
    if (!parsed || typeof parsed.displayName !== "string") return null;
    const displayName = validateDisplayName(parsed.displayName);
    return { displayName, createdAt: Number(parsed.createdAt) || Date.now() };
  } catch {
    return null;
  }
}

export function writeStoredAccount(
  displayName: string,
  storage: Pick<Storage, "setItem"> = localStorage,
  now = Date.now(),
): CheckInAccount {
  const account = { displayName: validateDisplayName(displayName), createdAt: now };
  storage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
  return account;
}

export function clearStoredAccount(storage: Pick<Storage, "removeItem"> = localStorage) {
  storage.removeItem(ACCOUNT_STORAGE_KEY);
}

export function memoryAccountStorage(): AccountStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
