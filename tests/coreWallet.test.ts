import { describe, expect, it } from "vitest";
import { memoryAccountStorage, readStoredAccount, writeStoredAccount } from "@/services/account";
import {
  canClaimRewards,
  claimBlockMessage,
  coreDownloadTarget,
  discoverWallets,
  isCoreWallet,
  pickWallet,
  readSavedWalletKind,
  walletsForRestore,
  WALLET_KIND_STORAGE_KEY,
  type Eip1193Like,
  type Eip6963AnnounceDetail,
} from "@/services/coreWallet";

function provider(flags: Partial<Eip1193Like> = {}): Eip1193Like {
  return { request: async () => [], ...flags };
}

function announce(name: string, rdns: string, injected: Eip1193Like): Eip6963AnnounceDetail {
  return { info: { uuid: rdns, name, icon: "", rdns }, provider: injected };
}

describe("Core Wallet detection", () => {
  it("treats window.avalanche as Core even when MetaMask owns window.ethereum", () => {
    const core = provider();
    const metamask = provider({ isMetaMask: true });
    const ethereum = provider({ isMetaMask: true, providers: [metamask, core] });

    const found = discoverWallets({ avalanche: core, ethereum });

    expect(found.core?.provider).toBe(core);
    expect(found.core?.name).toBe("Core Wallet");
    expect(found.others.map((item) => item.provider)).toEqual([metamask]);
    expect(pickWallet(found, "core")?.provider).toBe(core);
    expect(pickWallet(found, "other")?.provider).toBe(metamask);
    expect(pickWallet(found, "auto")?.provider).toBe(core);
  });

  it("identifies Core through isAvalanche, Core rdns, and the Core name", () => {
    expect(isCoreWallet({ provider: provider({ isAvalanche: true }) })).toBe(true);
    expect(isCoreWallet({ provider: provider({ isCoreWallet: true }) })).toBe(true);
    expect(isCoreWallet({ rdns: "app.core" })).toBe(true);
    expect(isCoreWallet({ rdns: "app.core.extension" })).toBe(true);
    expect(isCoreWallet({ name: "Core Wallet" })).toBe(true);
    expect(isCoreWallet({ provider: provider({ isMetaMask: true }), rdns: "io.metamask", name: "MetaMask" })).toBe(false);
  });

  it("uses the EIP-6963 Core provider instead of an injected MetaMask", () => {
    const core = provider();
    const metamask = provider({ isMetaMask: true });
    const found = discoverWallets({
      ethereum: metamask,
      announced: [announce("Core", "app.core", core)],
    });

    expect(found.core?.provider).toBe(core);
    expect(found.others[0]?.provider).toBe(metamask);
    expect(pickWallet(found, "core")?.provider).not.toBe(metamask);
  });

  it("keeps a provider that sets both isMetaMask and isAvalanche on the Core path", () => {
    const core = provider({ isMetaMask: true, isAvalanche: true });
    const found = discoverWallets({ ethereum: core });

    expect(found.core?.provider).toBe(core);
    expect(found.others).toHaveLength(0);
  });

  it("restores only the wallet kind that was saved", () => {
    const core = provider({ isAvalanche: true });
    const metamask = provider({ isMetaMask: true });
    const found = discoverWallets({
      avalanche: core,
      ethereum: provider({ providers: [metamask, core] }),
    });

    expect(walletsForRestore(found, "core").map((item) => item.provider)).toEqual([core]);
    expect(walletsForRestore(found, "other").map((item) => item.provider)).toEqual([metamask]);
    expect(pickWallet(found, "auto", "other")?.provider).toBe(metamask);
  });

  it("prefers MetaMask among other injected wallets", () => {
    const rabby = provider();
    const metamask = provider({ isMetaMask: true });
    const found = discoverWallets({
      announced: [announce("Rabby", "io.rabby", rabby), announce("MetaMask", "io.metamask", metamask)],
    });

    expect(pickWallet(found, "other")?.provider).toBe(metamask);
  });
});

describe("reward claims", () => {
  it("allows a claim only for a connected Core Wallet", () => {
    expect(canClaimRewards("core")).toBe(true);
    expect(canClaimRewards("other")).toBe(false);
    expect(canClaimRewards(null)).toBe(false);
    expect(claimBlockMessage("other", "MetaMask")).toContain("MetaMask");
    expect(claimBlockMessage("other", "MetaMask")).toContain("claimed to a Core Wallet");
    expect(claimBlockMessage(null)).toContain("claimed to a Core Wallet");
  });
});

describe("Core install links", () => {
  it("sends desktop browsers to core.app and phones to the Core app stores", () => {
    expect(coreDownloadTarget("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
    expect(coreDownloadTarget("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(coreDownloadTarget("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
  });
});

describe("saved wallet kind", () => {
  it("reads only core or other from storage", () => {
    const storage = memoryAccountStorage();
    expect(readSavedWalletKind(storage)).toBeNull();
    storage.setItem(WALLET_KIND_STORAGE_KEY, "core");
    expect(readSavedWalletKind(storage)).toBe("core");
    storage.setItem(WALLET_KIND_STORAGE_KEY, "other");
    expect(readSavedWalletKind(storage)).toBe("other");
    storage.setItem(WALLET_KIND_STORAGE_KEY, "metamask");
    expect(readSavedWalletKind(storage)).toBeNull();
  });
});

describe("CheckIn account", () => {
  it("stores a display name without a wallet", () => {
    const storage = memoryAccountStorage();
    const account = writeStoredAccount("  Ada  ", storage, 10);
    expect(account).toEqual({ displayName: "Ada", createdAt: 10 });
    expect(readStoredAccount(storage)).toEqual(account);
  });

  it("rejects a display name that is too short", () => {
    expect(() => writeStoredAccount("A", memoryAccountStorage())).toThrow(/2-32/);
  });
});
