import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addresses, addressUrl, contractsConfigured } from "@/config/network";
import { EventCover } from "@/components/EventCover";
import { TxBanner } from "@/components/TxBanner";
import { Button, PageTitle, Panel } from "@/components/ui";
import { useChainTick } from "@/hooks/useChainTick";
import { useTx } from "@/hooks/TxContext";
import { useWallet } from "@/hooks/WalletContext";
import { decodeTicketId, loadEvent } from "@/services/contracts";
import { getSignedContracts } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import { loadProfiles, recordView } from "@/services/metadata";
import type { ChainEvent } from "@/types";
import { formatAvax, formatDate, formatTime, shortAddress } from "@/utils/format";

export default function EventDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const tick = useChainTick();
  const wallet = useWallet();
  const { openTx } = useTx();
  const [event, setEvent] = useState<ChainEvent | null>(null);
  const [organizerName, setOrganizerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!/^\d+$/.test(id)) {
      setLoading(false);
      setError("Event not found.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadEvent(BigInt(id))
      .then(async (value) => {
        if (cancelled) return;
        setEvent(value);
        const names = await loadProfiles([value.organizer]);
        setOrganizerName(names[value.organizer.toLowerCase()] || shortAddress(value.organizer));
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(parseTxError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    recordView(id);
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  async function buy() {
    if (!event) return;
    setError("");
    try {
      if (!contractsConfigured) throw new Error("Deploy the contracts before buying a ticket.");
      const session = await wallet.ensureFuji();
      const { tickets } = await getSignedContracts(session.provider);
      const value = event.priceWei;
      openTx({
        title: "Buy ticket",
        type: "Ticket purchase",
        amountAvax: formatAvax(value),
        to: addresses.tickets,
        summary: [
          { label: "Event", value: event.name },
          { label: "Your wallet", value: shortAddress(session.address) },
        ],
        estimateGas: () => tickets.buyTicket.estimateGas(event.id, { value }),
        send: async () => {
          const gas = await tickets.buyTicket.estimateGas(event.id, { value });
          return tickets.buyTicket(event.id, { value, gasLimit: (gas * 12n) / 10n });
        },
        onSuccess: (receipt) => {
          const ticketId = decodeTicketId(receipt);
          navigate(ticketId ? `/tickets/${ticketId.toString()}?tx=${receipt.hash}` : `/tickets?tx=${receipt.hash}`);
        },
      });
    } catch (err) {
      setError(parseTxError(err));
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading event from Avalanche…</p>;
  if (!event) return <Panel><p>{error || "Event not found."}</p></Panel>;

  const remaining = event.maxSupply - event.sold;
  const soldOut = remaining === 0n || !event.active;

  return (
    <div>
      <PageTitle title={event.name} />
      <TxBanner />
      <div className="overflow-hidden rounded-[2rem] border border-line bg-surface">
        <EventCover src={event.imageURI} category={event.category} name={event.name} className="h-64 sm:h-80" />
        <div className="grid gap-8 p-6 lg:grid-cols-[1.4fr_0.8fr] sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{event.category}</p>
            <h1 className="mt-2 font-display text-4xl font-bold">{event.name}</h1>
            <p className="mt-4 whitespace-pre-wrap text-muted">{event.description}</p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Organizer" value={organizerName} />
              <Detail label="Date" value={formatDate(event.startTime)} />
              <Detail label="Time" value={`${formatTime(event.startTime)} – ${formatTime(event.endTime)}`} />
              <Detail label="Venue" value={event.venue} />
              <Detail label="Location" value={event.location} />
              <Detail label="Blockchain network" value="Avalanche Testnet · C-Chain" />
            </dl>
            <p className="mt-6 text-sm font-semibold">Powered by Avalanche C-Chain</p>
            {event.demo ? <p className="mt-2 text-sm text-warn">This is a demo event published on testnet.</p> : null}
          </div>
          <Panel>
            <p className="text-sm text-muted">Ticket price</p>
            <p className="font-display text-4xl font-bold">{formatAvax(event.priceWei)} AVAX</p>
            <p className="mt-2 text-sm">{remaining.toString()} of {event.maxSupply.toString()} available</p>
            <p className="mt-4 break-all text-xs text-muted">Contract {addresses.tickets || "not configured"}</p>
            <a className="mt-2 block text-sm text-accent" href={addressUrl(event.organizer)} target="_blank" rel="noreferrer">
              Organizer on explorer
            </a>
            <p className="mt-4 text-xs text-muted">Avalanche Testnet · Testnet AVAX only — No real funds are required.</p>
            {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
            <Button className="mt-5 w-full" disabled={soldOut} onClick={buy}>
              {soldOut ? (event.active ? "Sold out" : "Sales paused") : "Buy Ticket"}
            </Button>
            {wallet.address?.toLowerCase() === event.organizer.toLowerCase() ? (
              <Link className="mt-3 block text-center text-sm font-semibold" to={`/events/${event.id.toString()}/edit`}>
                Edit event
              </Link>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
