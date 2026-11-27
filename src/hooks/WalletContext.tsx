import { BrowserProvider, ethers } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FUJI_CHAIN_HEX, FUJI_CHAIN_ID, FUJI_PARAMS } from "@/config/network";
import { clearStoredAccount, readStoredAccount, writeStoredAccount, type CheckInAccount } from "@/services/account";
import { parseTxError } from "@/services/errors";
import {
  discoverWallets,
  pickWallet,
  readSavedWalletKind,
  walletsForRestore,
  WALLET_CONNECTED_STORAGE_KEY,
  WALLET_KIND_STORAGE_KEY,
  type DiscoveredWallet,
  type Eip6963AnnounceDetail,
  type WalletDiscovery,
  type WalletKind,
} from "@/services/coreWallet";

type Session = {
  provider: BrowserProvider;
  injected: DiscoveredWallet["provider"];
  address: string;
  chainId: number;
  balance: bigint | null;
  kind: WalletKind;
  label: string;
};

type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  balance: bigint | null;
  provider: BrowserProvider | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  hasCore: boolean;
  hasOtherWallet: boolean;
  otherWalletName: string | null;
  walletKind: WalletKind | null;
  walletLabel: string | null;
  isCore: boolean;
  walletReady: boolean;
  isFuji: boolean;
  account: CheckInAccount | null;
  connect: () => Promise<Session>;
  connectCore: () => Promise<Session>;
  connectOther: () => Promise<Session>;
  createAccount: (displayName: string) => CheckInAccount;
  signOutAccount: () => void;
  disconnect: () => Promise<void>;
  switchToFuji: () => Promise<void>;
  ensureFuji: () => Promise<Session>;
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const emptyDiscovery: WalletDiscovery = { core: null, others: [] };

function scanWindow(announced: Eip6963AnnounceDetail[]): WalletDiscovery {
  return discoverWallets({
    avalanche: window.avalanche ?? null,
    ethereum: window.ethereum ?? null,
    announced,
  });
}

async function readSession(wallet: DiscoveredWallet, requestAccounts = false): Promise<Session | null> {
  const method = requestAccounts ? "eth_requestAccounts" : "eth_accounts";
  const accounts = (await wallet.provider.request({ method })) as string[];
  if (!accounts[0]) return null;
  const provider = new BrowserProvider(wallet.provider as ethers.Eip1193Provider);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const address = ethers.getAddress(accounts[0]);
  const balance = chainId === FUJI_CHAIN_ID ? await provider.getBalance(address) : null;
  return {
    provider,
    injected: wallet.provider,
    address,
    chainId,
    balance,
    kind: wallet.kind,
    label: wallet.name,
  };
}

async function switchInjected(injected: DiscoveredWallet["provider"]) {
  try {
    await injected.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: FUJI_CHAIN_HEX }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 4902) {
      await injected.request({
        method: "wallet_addEthereumChain",
        params: [FUJI_PARAMS],
      });
      return;
    }
    throw error;
  }
}

function missingWalletMessage(choice: "core" | "other" | "auto") {
  if (choice === "other") return "No other browser wallet was found.";
  if (choice === "core") return "Core Wallet is not installed in this browser.";
  return "Install the Core Wallet extension, then refresh this page.";
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<WalletDiscovery>(emptyDiscovery);
  const [walletKind, setWalletKind] = useState<WalletKind | null>(() => readSavedWalletKind(localStorage));
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [account, setAccount] = useState<CheckInAccount | null>(null);
  const [walletReady, setWalletReady] = useState(() => localStorage.getItem(WALLET_CONNECTED_STORAGE_KEY) !== "1");
  const sessionRef = useRef<Session | null>(null);
  const discoveryRef = useRef<WalletDiscovery>(emptyDiscovery);
  const announcedRef = useRef<Map<string, Eip6963AnnounceDetail>>(new Map());

  const apply = useCallback((session: Session | null) => {
    sessionRef.current = session;
    setAddress(session?.address ?? null);
    setChainId(session?.chainId ?? null);
    setBalance(session?.balance ?? null);
    setProvider(session?.provider ?? null);
    setWalletKind(session?.kind ?? null);
    setWalletLabel(session?.label ?? null);
  }, []);

  const publishDiscovery = useCallback((next: WalletDiscovery) => {
    discoveryRef.current = next;
    setDiscovery(next);
  }, []);

  const scan = useCallback(() => {
    publishDiscovery(scanWindow([...announcedRef.current.values()]));
  }, [publishDiscovery]);

  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    const session = await readSession(
      { provider: current.injected, kind: current.kind, name: current.label },
      false,
    );
    if (session) apply(session);
  }, [apply]);

  useEffect(() => {
    setAccount(readStoredAccount());
  }, []);

  useEffect(() => {
    function onAnnounce(event: Event) {
      const detail = (event as CustomEvent<Eip6963AnnounceDetail>).detail;
      if (!detail?.provider || !detail.info) return;
      const key = detail.info.uuid || detail.info.rdns || detail.info.name;
      if (!key) return;
      announcedRef.current.set(key, detail);
      scan();
    }
    function requestProviders() {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
      scan();
    }
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.addEventListener("focus", requestProviders);
    requestProviders();
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      window.removeEventListener("focus", requestProviders);
    };
  }, [scan]);

  useEffect(() => {
    const timer = window.setTimeout(() => setWalletReady(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (sessionRef.current) {
      setWalletReady(true);
      return;
    }
    if (localStorage.getItem(WALLET_CONNECTED_STORAGE_KEY) !== "1") {
      setWalletReady(true);
      return;
    }
    let cancelled = false;
    const saved = readSavedWalletKind(localStorage);
    walletsForRestore(discovery, saved)
      .reduce<Promise<Session | null>>(async (previous, candidate) => {
        const found = await previous;
        if (found) return found;
        try {
          return await readSession(candidate, false);
        } catch {
          return null;
        }
      }, Promise.resolve(null))
      .then((session) => {
        if (cancelled || sessionRef.current) return;
        if (session) {
          localStorage.setItem(WALLET_KIND_STORAGE_KEY, session.kind);
          apply(session);
          setWalletReady(true);
          return;
        }
        const waitingForCore = saved === "core" && !discovery.core;
        const waitingForOther = saved === "other" && discovery.others.length === 0;
        const waitingForAny = saved === null && !discovery.core && discovery.others.length === 0;
        if (!waitingForCore && !waitingForOther && !waitingForAny) setWalletReady(true);
      })
      .catch(() => {
        if (!cancelled) setWalletReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apply, discovery]);

  useEffect(() => {
    const injected = sessionRef.current?.injected;
    if (!injected?.on) return;

    const onAccounts = (value: unknown) => {
      const accounts = Array.isArray(value) ? value : [];
      if (!accounts[0]) {
        localStorage.removeItem(WALLET_CONNECTED_STORAGE_KEY);
        localStorage.removeItem(WALLET_KIND_STORAGE_KEY);
        apply(null);
        return;
      }
      void refresh();
    };
    const onChain = () => {
      void refresh();
    };

    injected.on("accountsChanged", onAccounts);
    injected.on("chainChanged", onChain);
    return () => {
      injected.removeListener?.("accountsChanged", onAccounts);
      injected.removeListener?.("chainChanged", onChain);
    };
  }, [address, apply, refresh, walletKind]);

  const connectChoice = useCallback(
    async (choice: "core" | "other" | "auto") => {
      scan();
      const candidate = pickWallet(discoveryRef.current, choice, readSavedWalletKind(localStorage));
      if (!candidate) throw new Error(missingWalletMessage(choice));
      setConnecting(true);
      setError(null);
      try {
        const session = await readSession(candidate, true);
        if (!session) {
          throw new Error(candidate.kind === "core" ? "Core Wallet did not return an account." : "The wallet did not return an account.");
        }
        localStorage.setItem(WALLET_CONNECTED_STORAGE_KEY, "1");
        localStorage.setItem(WALLET_KIND_STORAGE_KEY, session.kind);
        apply(session);
        setWalletReady(true);
        return session;
      } catch (err) {
        const message = parseTxError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setConnecting(false);
      }
    },
    [apply, scan],
  );

  const connect = useCallback(() => connectChoice("auto"), [connectChoice]);
  const connectCore = useCallback(() => connectChoice("core"), [connectChoice]);
  const connectOther = useCallback(() => connectChoice("other"), [connectChoice]);

  const switchToFuji = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) throw new Error("Connect a wallet first.");
    setError(null);
    try {
      await switchInjected(current.injected);
      const session = await readSession({ provider: current.injected, kind: current.kind, name: current.label });
      if (session) apply(session);
    } catch (err) {
      const message = parseTxError(err);
      setError(message);
      throw new Error(message);
    }
  }, [apply]);

  const ensureFuji = useCallback(async () => {
    let session = sessionRef.current;
    if (!session) session = await connect();
    if (session.chainId !== FUJI_CHAIN_ID) {
      await switchInjected(session.injected);
      const next = await readSession({ provider: session.injected, kind: session.kind, name: session.label });
      if (next) {
        apply(next);
        session = next;
      }
    }
    if (session.chainId !== FUJI_CHAIN_ID) {
      throw new Error("Please switch to Avalanche Testnet");
    }
    return session;
  }, [apply, connect]);

  const disconnect = useCallback(async () => {
    const injected = sessionRef.current?.injected;
    try {
      await injected?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some wallets keep the site permission. CheckIn still forgets the session.
    }
    localStorage.removeItem(WALLET_CONNECTED_STORAGE_KEY);
    localStorage.removeItem(WALLET_KIND_STORAGE_KEY);
    apply(null);
    setWalletReady(true);
  }, [apply]);

  const createAccount = useCallback((displayName: string) => {
    const next = writeStoredAccount(displayName);
    setAccount(next);
    return next;
  }, []);

  const signOutAccount = useCallback(() => {
    clearStoredAccount();
    setAccount(null);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      balance,
      provider,
      connecting,
      error,
      hasWallet: Boolean(discovery.core || discovery.others.length > 0),
      hasCore: Boolean(discovery.core),
      hasOtherWallet: discovery.others.length > 0,
      otherWalletName: discovery.others[0]?.name ?? null,
      walletKind: address ? walletKind : null,
      walletLabel: address ? walletLabel : null,
      isCore: walletKind === "core" && Boolean(address),
      walletReady,
      isFuji: chainId === FUJI_CHAIN_ID,
      account,
      connect,
      connectCore,
      connectOther,
      createAccount,
      signOutAccount,
      disconnect,
      switchToFuji,
      ensureFuji,
      refresh,
    }),
    [
      address,
      chainId,
      balance,
      provider,
      connecting,
      error,
      discovery,
      walletKind,
      walletLabel,
      walletReady,
      account,
      connect,
      connectCore,
      connectOther,
      createAccount,
      signOutAccount,
      disconnect,
      switchToFuji,
      ensureFuji,
      refresh,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
