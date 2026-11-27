import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { addressUrl } from "@/config/network";
import { useWallet } from "@/hooks/WalletContext";
import { formatAvax, shortAddress } from "@/utils/format";
import { Button } from "@/components/ui";

export function WalletMenu() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  if (!wallet.address) {
    if (!wallet.account) {
      return (
        <Link to="/signup" className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white">
          Sign up
        </Link>
      );
    }
    return (
      <div className="relative" ref={panel}>
        <button
          className="rounded-full border border-line bg-surface px-3 py-2 text-left text-sm"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className="block font-semibold">{wallet.account.displayName}</span>
          <span className="block text-xs text-muted">CheckIn account</span>
        </button>
        {open ? (
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="text-xs uppercase tracking-wide text-muted">Signed in</p>
            <p className="mt-1 font-semibold">{wallet.account.displayName}</p>
            <div className="mt-3 grid gap-2">
              <Link className="text-sm font-medium text-accent" to="/signup" onClick={() => setOpen(false)}>
                Connect a wallet
              </Link>
              <button className="text-left text-sm text-muted" type="button" onClick={() => wallet.signOutAccount()}>
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={panel}>
      <button
        className="rounded-full border border-line bg-surface px-3 py-2 text-left text-sm"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="block font-semibold">{shortAddress(wallet.address)}</span>
        <span className="block text-xs text-muted">{wallet.isFuji ? "Avalanche Testnet" : "Wrong network"}</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted">Connected wallet</p>
          <p className="mt-1 font-semibold">{shortAddress(wallet.address)}</p>
          <p className="text-sm text-muted">{wallet.walletLabel ?? "Browser wallet"}</p>
          {wallet.account ? (
            <>
              <p className="mt-3 text-xs uppercase tracking-wide text-muted">CheckIn account</p>
              <p className="font-semibold">{wallet.account.displayName}</p>
            </>
          ) : null}
          <p className="mt-3 text-xs uppercase tracking-wide text-muted">Network</p>
          <p className="font-semibold">{wallet.isFuji ? "Avalanche Testnet" : "Please switch to Avalanche Testnet"}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-muted">Balance</p>
          <p className="font-semibold">{wallet.isFuji && wallet.balance !== null ? `${formatAvax(wallet.balance)} AVAX` : "—"}</p>
          {!wallet.isFuji ? (
            <Button className="mt-4 w-full" onClick={() => wallet.switchToFuji().catch((error) => setMessage(error.message))}>
              Switch to Avalanche Testnet
            </Button>
          ) : (
            <Button className="mt-4 w-full" variant="secondary" onClick={() => wallet.switchToFuji().catch((error) => setMessage(error.message))}>
              Switch Network
            </Button>
          )}
          <div className="mt-3 grid gap-2">
            <a className="text-sm font-medium text-accent" href={addressUrl(wallet.address)} target="_blank" rel="noreferrer">
              View Wallet
            </a>
            <Link className="text-sm font-medium" to="/activity" onClick={() => setOpen(false)}>
              Transaction history
            </Link>
            <button className="text-left text-sm text-muted" type="button" onClick={() => wallet.disconnect()}>
              Disconnect
            </button>
          </div>
          {message ? <p className="mt-2 text-xs text-accent">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
