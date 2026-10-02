import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { txUrl } from "@/config/network";
import { TxBanner } from "@/components/TxBanner";
import { Button, EmptyState, PageTitle, Panel } from "@/components/ui";
import { useChainTick } from "@/hooks/useChainTick";
import { useWallet } from "@/hooks/WalletContext";
import { loadEvents, loadOrganizerFeed } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import { loadViews, profileMessage, saveProfile } from "@/services/metadata";
import type { ActivityItem, ChainEvent } from "@/types";
import { formatAvax, percent, shortAddress } from "@/utils/format";

export default function Organizer() {
  const wallet = useWallet();
  const tick = useChainTick();
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [views, setViews] = useState<Record<string, number>>({});
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadEvents()
      .then(async (list) => {
        if (cancelled) return;
        const mine = wallet.address
          ? list.filter((event) => event.organizer.toLowerCase() === wallet.address?.toLowerCase())
          : [];
        setEvents(mine);
        if (mine.length > 0) {
          setFeed(await loadOrganizerFeed(mine.map((event) => event.id)).catch(() => []));
        } else {
          setFeed([]);
        }
        setViews(await loadViews());
      })
      .catch((err) => {
        if (!cancelled) setError(parseTxError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [wallet.address, tick]);

  const sold = events.reduce((sum, event) => sum + event.sold, 0n);
  const checked = events.reduce((sum, event) => sum + event.checkedIn, 0n);
  const revenue = events.reduce((sum, event) => sum + event.revenueWei, 0n);

  async function saveName() {
    setError("");
    setNotice("");
    try {
      const session = await wallet.ensureFuji();
      const signer = await session.provider.getSigner();
      const signature = await signer.signMessage(profileMessage(session.address, displayName.trim()));
      await saveProfile(session.address, displayName.trim(), signature);
      setNotice("Display name saved. This is off-chain and does not control ticket ownership.");
    } catch (err) {
      setError(parseTxError(err));
    }
  }

  return (
    <div>
      <PageTitle title="Organizer Dashboard" />
      <TxBanner />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold">Organizer Dashboard</h1>
          <p className="mt-2 text-muted">Create an event with your wallet to become its organizer.</p>
        </div>
        <Link to="/create" className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white">Create Event</Link>
      </div>

      {!wallet.address ? (
        <div className="mt-6">
          <EmptyState title="Connect Core Wallet" body="Organizer tools use the wallet that created each event." action={<Button onClick={() => wallet.connect().catch((err) => setError(err.message))}>Connect Wallet</Button>} />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Total events" value={events.length.toString()} />
            <Stat label="Tickets sold" value={sold.toString()} />
            <Stat label="Revenue" value={`${formatAvax(revenue)} AVAX`} />
            <Stat label="Attendees" value={sold.toString()} />
            <Stat label="Check-in rate" value={percent(checked, sold)} />
          </div>
          {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}

          <h2 className="mt-10 font-display text-2xl font-bold">Your events</h2>
          <div className="mt-4 grid gap-4">
            {events.length === 0 ? <p className="text-sm text-muted">No events for {shortAddress(wallet.address)} yet.</p> : null}
            {events.map((event) => {
              const rate = event.sold === 0n ? "0%" : percent(event.checkedIn, event.sold);
              return (
                <Panel key={event.id.toString()}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl font-bold">{event.name}</h3>
                      <p className="text-sm text-muted">{event.demo ? "Demo event · " : ""}{event.location}</p>
                    </div>
                    <div className="flex gap-3 text-sm font-semibold">
                      <Link to={`/organizer/events/${event.id.toString()}`}>Attendees</Link>
                      <Link to={`/checkin?event=${event.id.toString()}`}>Scan</Link>
                      <Link to={`/events/${event.id.toString()}/edit`}>Edit</Link>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                    <Mini label="Tickets" value={event.maxSupply.toString()} />
                    <Mini label="Available" value={(event.maxSupply - event.sold).toString()} />
                    <Mini label="Sold" value={event.sold.toString()} />
                    <Mini label="Checked in" value={event.checkedIn.toString()} />
                    <Mini label="Revenue" value={`${formatAvax(event.revenueWei)} AVAX`} />
                    <Mini label="Attendance" value={rate} />
                  </dl>
                  <p className="mt-3 text-xs text-muted">Off-chain page views: {views[event.id.toString()] || 0}. Sales and check-ins above come from Avalanche.</p>
                </Panel>
              );
            })}
          </div>

          <h2 className="mt-10 font-display text-2xl font-bold">Recent transactions</h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-line">
            {feed.length === 0 ? <p className="p-5 text-sm text-muted">Ticket sales will appear here.</p> : null}
            {feed.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 text-sm last:border-0">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted">{item.detail}</p>
                </div>
                <a className="shrink-0 font-semibold text-accent" href={txUrl(item.hash)} target="_blank" rel="noreferrer">
                  View on Avalanche Explorer
                </a>
              </div>
            ))}
          </div>

          <Panel className="mt-10">
            <h2 className="font-display text-xl font-bold">Display name</h2>
            <p className="mt-1 text-sm text-muted">Signs a message in Core Wallet. It does not cost AVAX and does not reveal your seed phrase.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input className="w-full rounded-xl border border-line bg-bg px-3 py-2.5" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your organizer name" />
              <Button onClick={saveName}>Save</Button>
            </div>
            {notice ? <p className="mt-3 text-sm text-good">{notice}</p> : null}
          </Panel>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </Panel>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
