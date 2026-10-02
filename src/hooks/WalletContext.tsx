import { BrowserProvider, ethers } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FUJI_CHAIN_HEX, FUJI_CHAIN_ID, FUJI_PARAMS } from "@/config/network";
import { parseTxError } from "@/services/errors";

const STORAGE_KEY = "checkin.connected";

type Session = {
  provider: BrowserProvider;
  address: string;
  chainId: number;
  balance: bigint | null;
};

type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  balance: bigint | null;
  provider: BrowserProvider | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  isFuji: boolean;
  connect: () => Promise<Session>;
  disconnect: () => Promise<void>;
  switchToFuji: () => Promise<void>;
  ensureFuji: () => Promise<Session>;
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function getInjected() {
  const ethereum = window.ethereum;
  if (!ethereum) return null;
  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    return ethereum.providers.find((provider) => provider.isAvalanche) ?? ethereum.providers[0];
  }
  return ethereum;
}

async function readSession(injected = getInjected(), requestAccounts = false): Promise<Session | null> {
  if (!injected) return null;
  const method = requestAccounts ? "eth_requestAccounts" : "eth_accounts";
  const accounts = (await injected.request({ method })) as string[];
  if (!accounts[0]) return null;
  const provider = new BrowserProvider(injected as ethers.Eip1193Provider);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const address = ethers.getAddress(accounts[0]);
  const balance = chainId === FUJI_CHAIN_ID ? await provider.getBalance(address) : null;
  return { provider, address, chainId, balance };
}

async function switchInjected(injected: EthereumProvider) {
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

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  const apply = useCallback((session: Session | null) => {
    sessionRef.current = session;
    setAddress(session?.address ?? null);
    setChainId(session?.chainId ?? null);
    setBalance(session?.balance ?? null);
    setProvider(session?.provider ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const session = await readSession();
    if (session) apply(session);
  }, [apply]);

  useEffect(() => {
    setHasWallet(Boolean(getInjected()));
    if (localStorage.getItem(STORAGE_KEY) !== "1") return;
    readSession()
      .then((session) => {
        if (session) apply(session);
      })
      .catch(() => undefined);
  }, [apply]);

  useEffect(() => {
    const injected = getInjected();
    if (!injected?.on) return;

    const onAccounts = (value: unknown) => {
      const accounts = Array.isArray(value) ? value : [];
      if (!accounts[0]) {
        apply(null);
        localStorage.removeItem(STORAGE_KEY);
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
  }, [apply, refresh]);

  const connect = useCallback(async () => {
    const injected = getInjected();
    if (!injected) throw new Error("Install the Core Wallet extension, then refresh this page.");
    setConnecting(true);
    setError(null);
    try {
      const session = await readSession(injected, true);
      if (!session) throw new Error("Core Wallet did not return an account.");
      localStorage.setItem(STORAGE_KEY, "1");
      apply(session);
      return session;
    } catch (err) {
      const message = parseTxError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setConnecting(false);
    }
  }, [apply]);

  const switchToFuji = useCallback(async () => {
    const injected = getInjected();
    if (!injected) throw new Error("Install the Core Wallet extension, then refresh this page.");
    setError(null);
    try {
      await switchInjected(injected);
      const session = await readSession(injected);
      if (session) apply(session);
    } catch (err) {
      const message = parseTxError(err);
      setError(message);
      throw new Error(message);
    }
  }, [apply]);

  const ensureFuji = useCallback(async () => {
    const injected = getInjected();
    if (!injected) throw new Error("Install the Core Wallet extension, then refresh this page.");
    let session = sessionRef.current;
    if (!session) session = await connect();
    if (session.chainId !== FUJI_CHAIN_ID) {
      await switchToFuji();
      session = (await readSession(injected)) ?? session;
      apply(session);
    }
    if (session.chainId !== FUJI_CHAIN_ID) {
      throw new Error("Please switch to Avalanche Testnet");
    }
    return session;
  }, [apply, connect, switchToFuji]);

  const disconnect = useCallback(async () => {
    const injected = getInjected();
    try {
      await injected?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some wallets keep the site permission. CheckIn still forgets the session.
    }
    localStorage.removeItem(STORAGE_KEY);
    apply(null);
  }, [apply]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      balance,
      provider,
      connecting,
      error,
      hasWallet,
      isFuji: chainId === FUJI_CHAIN_ID,
      connect,
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
      hasWallet,
      connect,
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
