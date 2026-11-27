export type WalletKind = "core" | "other";

export type Eip1193Like = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
  isAvalanche?: boolean;
  isMetaMask?: boolean;
  isCoreWallet?: boolean;
  providers?: Eip1193Like[];
};

export type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type Eip6963AnnounceDetail = {
  info: Eip6963ProviderInfo;
  provider: Eip1193Like;
};

export type DiscoveredWallet = {
  provider: Eip1193Like;
  kind: WalletKind;
  name: string;
  rdns?: string;
};

export type WalletDiscovery = {
  core: DiscoveredWallet | null;
  others: DiscoveredWallet[];
};

export type CoreDevice = "ios" | "android" | "desktop";

export const WALLET_CONNECTED_STORAGE_KEY = "checkin.connected";
export const WALLET_KIND_STORAGE_KEY = "checkin.walletKind";

export const CORE_LINKS = {
  desktop: "https://core.app/",
  ios: "https://apps.apple.com/app/core-crypto-wallet-nft/id6443683747",
  android: "https://play.google.com/store/apps/details?id=com.avaxwallet",
} as const;

export function readSavedWalletKind(storage: Pick<Storage, "getItem">): WalletKind | null {
  const value = storage.getItem(WALLET_KIND_STORAGE_KEY);
  return value === "core" || value === "other" ? value : null;
}

export function isCoreWallet(input: {
  provider?: Eip1193Like | null;
  rdns?: string;
  name?: string;
  fromAvalancheInjected?: boolean;
}): boolean {
  if (input.fromAvalancheInjected) return true;
  if (input.provider?.isAvalanche || input.provider?.isCoreWallet) return true;
  const rdns = input.rdns?.trim().toLowerCase() ?? "";
  if (rdns === "app.core" || rdns.startsWith("app.core.")) return true;
  const name = input.name?.trim().toLowerCase() ?? "";
  return name === "core" || name === "core wallet";
}

export function walletDisplayName(
  provider: Eip1193Like | null | undefined,
  info?: { name?: string; rdns?: string },
): string {
  if (isCoreWallet({ provider, rdns: info?.rdns, name: info?.name })) return "Core Wallet";
  const name = info?.name?.trim();
  if (name) return name;
  if (provider?.isMetaMask) return "MetaMask";
  return "Browser wallet";
}

export function coreDownloadTarget(userAgent: string): CoreDevice {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export function canClaimRewards(kind: WalletKind | null | undefined): boolean {
  return kind === "core";
}

export function claimBlockMessage(kind: WalletKind | null | undefined, walletLabel?: string | null): string {
  if (kind === "other") {
    const name = walletLabel?.trim() || "another wallet";
    return `You're connected with ${name}. CheckIn rewards are claimed to a Core Wallet, so this claim waits until Core is connected.`;
  }
  return "CheckIn rewards are claimed to a Core Wallet. Connect Core if it is installed, or create a Core Wallet, then claim.";
}

function preferredOther(others: DiscoveredWallet[]): DiscoveredWallet | null {
  return others.find((item) => item.rdns === "io.metamask" || item.name === "MetaMask") ?? others[0] ?? null;
}

export function pickWallet(
  discovery: WalletDiscovery,
  choice: "core" | "other" | "auto",
  saved: WalletKind | null = null,
): DiscoveredWallet | null {
  if (choice === "core") return discovery.core;
  if (choice === "other") return preferredOther(discovery.others);
  if (saved === "other") return preferredOther(discovery.others) ?? discovery.core;
  if (saved === "core") return discovery.core ?? preferredOther(discovery.others);
  return discovery.core ?? preferredOther(discovery.others);
}

export function walletsForRestore(discovery: WalletDiscovery, saved: WalletKind | null): DiscoveredWallet[] {
  if (saved === "core") return discovery.core ? [discovery.core] : [];
  if (saved === "other") {
    const other = preferredOther(discovery.others);
    return other ? [other] : [];
  }
  const list: DiscoveredWallet[] = [];
  if (discovery.core) list.push(discovery.core);
  const other = preferredOther(discovery.others);
  if (other) list.push(other);
  return list;
}

function ethereumProviders(ethereum: Eip1193Like | null | undefined): Eip1193Like[] {
  if (!ethereum) return [];
  const listed = Array.isArray(ethereum.providers) ? ethereum.providers.filter(Boolean) : [];
  if (listed.length > 0) return listed;
  return [ethereum];
}

function remember(list: DiscoveredWallet[], candidate: DiscoveredWallet) {
  if (list.some((item) => item.provider === candidate.provider)) return;
  list.push(candidate);
}

export function discoverWallets(snapshot: {
  avalanche?: Eip1193Like | null;
  ethereum?: Eip1193Like | null;
  announced?: Eip6963AnnounceDetail[];
}): WalletDiscovery {
  const found: DiscoveredWallet[] = [];

  if (snapshot.avalanche) {
    remember(found, {
      provider: snapshot.avalanche,
      kind: "core",
      name: "Core Wallet",
      rdns: "app.core",
    });
  }

  for (const detail of snapshot.announced ?? []) {
    if (!detail?.provider || !detail.info) continue;
    const core = isCoreWallet({
      provider: detail.provider,
      rdns: detail.info.rdns,
      name: detail.info.name,
    });
    remember(found, {
      provider: detail.provider,
      kind: core ? "core" : "other",
      name: walletDisplayName(detail.provider, detail.info),
      rdns: detail.info.rdns,
    });
  }

  for (const provider of ethereumProviders(snapshot.ethereum)) {
    const core = isCoreWallet({ provider }) || provider === snapshot.avalanche;
    remember(found, {
      provider,
      kind: core ? "core" : "other",
      name: walletDisplayName(provider),
    });
  }

  const cores = found.filter((item) => item.kind === "core");
  const coreProviders = new Set(cores.map((item) => item.provider));
  const core = cores.find((item) => item.provider === snapshot.avalanche) ?? cores[0] ?? null;
  const others = found.filter((item) => item.kind === "other" && !coreProviders.has(item.provider));
  const ordered = [...others].sort((a, b) => {
    const score = (item: DiscoveredWallet) => (item.rdns === "io.metamask" || item.name === "MetaMask" ? 0 : 1);
    return score(a) - score(b);
  });

  return { core, others: ordered };
}
