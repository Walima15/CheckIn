import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { nftUrl } from "@/config/network";
import { TxBanner } from "@/components/TxBanner";
import { Button, EmptyState, PageTitle, Panel, StatusPill } from "@/components/ui";
import { useChainTick } from "@/hooks/useChainTick";
import { useWallet } from "@/hooks/WalletContext";
import { loadOwnedTickets } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import type { TicketRecord } from "@/types";
import { formatDate, formatTicketCode, shortAddress, ticketStatus } from "@/utils/format";

export default function MyTickets() {
  const wallet = useWallet();
  const tick = useChainTick();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet.address) return;
    let cancelled = false;
    setLoading(true);
    loadOwnedTickets(wallet.address)
      .then((list) => {
        if (!cancelled) setTickets(list);
      })
      .catch((err) => {
        if (!cancelled) setError(parseTxError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet.address, tick]);

  return (
    <div>
      <PageTitle title="My Tickets" />
      <TxBanner />
      <h1 className="font-display text-4xl font-bold">My Tickets</h1>
      <p className="mt-2 text-muted">Tickets owned by your connected wallet on Avalanche Testnet.</p>
      {!wallet.address ? (
        <div className="mt-6">
          <EmptyState
            title="Connect Core Wallet"
            body="Your tickets are read from the blockchain after you connect."
            action={<Button onClick={() => wallet.connect().catch((err) => setError(err.message))}>Connect Wallet</Button>}
          />
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}
      {loading ? <p className="mt-4 text-sm text-muted">Loading tickets…</p> : null}
      {wallet.address && !loading && tickets.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No tickets yet" body="Buy a ticket from the events marketplace. It will show up here after the transaction confirms." action={<Link to="/events" className="font-semibold text-accent">Explore Events</Link>} />
        </div>
      ) : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {tickets.map((ticket) => {
          const status = ticketStatus(ticket.checkedIn, ticket.event.endTime);
          return (
            <Panel key={ticket.ticketId.toString()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">{formatTicketCode(ticket.ticketId)}</p>
                  <h2 className="mt-1 font-display text-2xl font-bold">{ticket.event.name}</h2>
                </div>
                <StatusPill status={status} />
              </div>
              <dl className="mt-4 grid gap-2 text-sm">
                <Row label="Event date" value={formatDate(ticket.event.startTime)} />
                <Row label="Venue" value={ticket.event.venue} />
                <Row label="Owner wallet" value={shortAddress(ticket.owner)} />
                <Row label="Ticket status" value={status} />
                <Row label="Check-in status" value={ticket.checkedIn ? "Checked in" : "Not checked in"} />
              </dl>
              <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
                <Link to={`/tickets/${ticket.ticketId.toString()}`}>Open ticket</Link>
                <a href={nftUrl(ticket.ticketId)} target="_blank" rel="noreferrer">View on Explorer</a>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
