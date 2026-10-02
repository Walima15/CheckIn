import { useEffect, useState } from "react";
import { txUrl } from "@/config/network";
import { Button, EmptyState, PageTitle, Panel } from "@/components/ui";
import { useChainTick } from "@/hooks/useChainTick";
import { useWallet } from "@/hooks/WalletContext";
import { loadActivity } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import type { ActivityItem } from "@/types";

export default function Activity() {
  const wallet = useWallet();
  const tick = useChainTick();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!wallet.address) return;
    let cancelled = false;
    loadActivity(wallet.address)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((err) => {
        if (!cancelled) setError(parseTxError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [wallet.address, tick]);

  return (
    <div>
      <PageTitle title="Activity" />
      <h1 className="font-display text-4xl font-bold">Transaction history</h1>
      <p className="mt-2 text-muted">Purchases, check-ins, rewards, and events for this wallet on Avalanche Testnet.</p>
      {!wallet.address ? (
        <div className="mt-6">
          <EmptyState title="Connect Core Wallet" body="History is read from Avalanche logs for your address." action={<Button onClick={() => wallet.connect().catch((err) => setError(err.message))}>Connect Wallet</Button>} />
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          {items.length === 0 && !error ? <Panel><p className="text-sm text-muted">No transactions for this wallet yet.</p></Panel> : null}
          {items.map((item) => (
            <Panel key={item.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">{item.kind}</p>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted">{item.detail}</p>
              </div>
              <a className="text-sm font-semibold text-accent" href={txUrl(item.hash)} target="_blank" rel="noreferrer">
                View on Avalanche Explorer
              </a>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
