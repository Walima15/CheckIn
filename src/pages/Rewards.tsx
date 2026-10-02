import { useEffect, useState } from "react";
import { txUrl } from "@/config/network";
import { Button, EmptyState, PageTitle, Panel } from "@/components/ui";
import { useChainTick } from "@/hooks/useChainTick";
import { useWallet } from "@/hooks/WalletContext";
import { findProofTx, loadRewardSummary } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import type { AttendanceProof, RewardRecord } from "@/types";
import { formatDateTime, shortAddress } from "@/utils/format";

const badges = [
  { name: "First Ticket", detail: "Purchase a ticket." },
  { name: "First Check-in", detail: "Check in to an event." },
  { name: "Regular", detail: "Attend 3 events." },
  { name: "Community", detail: "Attend 5 events." },
  { name: "Explorer", detail: "Earn 100 points." },
  { name: "Dedicated", detail: "Earn 250 points." },
];

export default function Rewards() {
  const wallet = useWallet();
  const tick = useChainTick();
  const [points, setPoints] = useState(0n);
  const [checkIns, setCheckIns] = useState(0n);
  const [history, setHistory] = useState<RewardRecord[]>([]);
  const [proofs, setProofs] = useState<AttendanceProof[]>([]);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!wallet.address) return;
    let cancelled = false;
    loadRewardSummary(wallet.address)
      .then(async (summary) => {
        if (cancelled) return;
        const withHash = await Promise.all(
          summary.proofs.map(async (proof) => ({
            ...proof,
            txHash: await findProofTx(wallet.address!, proof.ticketId).catch(() => undefined),
          })),
        );
        if (cancelled) return;
        setPoints(summary.points);
        setCheckIns(summary.checkInCount);
        setHistory([...summary.history].reverse());
        setProofs(withHash);
        setUnlocked(summary.achievements);
      })
      .catch((err) => {
        if (!cancelled) setError(parseTxError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [wallet.address, tick]);

  const purchases = history.filter((item) => item.reason === "Ticket purchase").length;

  return (
    <div>
      <PageTitle title="My Rewards" />
      <h1 className="font-display text-4xl font-bold">My Rewards</h1>
      <p className="mt-2 max-w-2xl text-muted">Testnet points for showing up. These are not a cash token and cannot be withdrawn as money.</p>
      {!wallet.address ? (
        <div className="mt-6">
          <EmptyState title="Connect Core Wallet" body="Rewards are read from your wallet's on-chain history." action={<Button onClick={() => wallet.connect().catch((err) => setError(err.message))}>Connect Wallet</Button>} />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Total points" value={points.toString()} />
            <Stat label="Events attended" value={checkIns.toString()} />
            <Stat label="Check-ins" value={checkIns.toString()} />
          </div>
          <p className="mt-3 text-sm text-muted">{purchases} ticket purchase{purchases === 1 ? "" : "s"} recorded for this wallet.</p>
          {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}

          <h2 className="mt-10 font-display text-2xl font-bold">Proof of Attendance</h2>
          <div className="mt-4 grid gap-4">
            {proofs.length === 0 ? <p className="text-sm text-muted">Check in to an event to earn Proof of Attendance.</p> : null}
            {proofs.map((proof) => (
              <Panel key={proof.ticketId.toString()}>
                <p className="font-semibold">You attended {proof.eventName}</p>
                <h3 className="mt-1 font-display text-2xl font-bold">Proof of Attendance</h3>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <Info label="Wallet address" value={shortAddress(proof.attendee)} />
                  <Info label="Event" value={proof.eventName || ""} />
                  <Info label="Date" value={formatDateTime(proof.timestamp)} />
                  <Info label="Transaction hash" value={proof.txHash || "Recorded on Avalanche"} />
                </dl>
                {proof.txHash ? (
                  <a className="mt-3 inline-block text-sm font-semibold text-accent" href={txUrl(proof.txHash)} target="_blank" rel="noreferrer">
                    View on Avalanche Explorer
                  </a>
                ) : null}
              </Panel>
            ))}
          </div>

          <h2 className="mt-10 font-display text-2xl font-bold">Achievement badges</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge) => {
              const owned = unlocked.includes(badge.name);
              return (
                <Panel key={badge.name} className={owned ? "" : "opacity-60"}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{owned ? "Unlocked" : "Locked"}</p>
                  <h3 className="mt-1 font-semibold">{badge.name}</h3>
                  <p className="text-sm text-muted">{badge.detail}</p>
                </Panel>
              );
            })}
          </div>

          <h2 className="mt-10 font-display text-2xl font-bold">Rewards history</h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-line">
            {history.length === 0 ? <p className="p-5 text-sm text-muted">No rewards yet.</p> : null}
            {history.map((item, index) => (
              <div key={`${item.ticketId}-${item.reason}-${index}`} className="flex items-center justify-between border-b border-line px-5 py-3 text-sm last:border-0">
                <div>
                  <p className="font-medium">{item.reason}</p>
                  <p className="text-muted">{formatDateTime(item.timestamp)}</p>
                </div>
                <p className="font-semibold">+{item.points.toString()}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold">{value}</p>
    </Panel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}
