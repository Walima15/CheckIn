import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ethers } from "ethers";
import { addresses, requireContracts, txUrl } from "@/config/network";
import { TxBanner } from "@/components/TxBanner";
import { Button, PageTitle, Panel, StatusPill } from "@/components/ui";
import { useChainTick } from "@/hooks/useChainTick";
import { useTx } from "@/hooks/TxContext";
import { useWallet } from "@/hooks/WalletContext";
import { findProofTx, getSignedContracts, loadTicket, ticketQrValue } from "@/services/contracts";
import { rewardsContract } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import type { AttendanceProof, TicketRecord } from "@/types";
import { formatDateTime, formatTicketCode, shortAddress, ticketStatus } from "@/utils/format";

export default function TicketDetails() {
  const { id = "" } = useParams();
  const wallet = useWallet();
  const { openTx } = useTx();
  const tick = useChainTick();
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [proof, setProof] = useState<AttendanceProof | null>(null);
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!/^\d+$/.test(id)) {
      setError("Ticket not found.");
      return;
    }
    let cancelled = false;
    loadTicket(BigInt(id))
      .then(async (value) => {
        if (cancelled) return;
        setTicket(value);
        const record = await rewardsContract().getProof(value.ticketId);
        if (record.valid) {
          const hash = await findProofTx(value.owner, value.ticketId).catch(() => undefined);
          setProof({
            eventId: BigInt(record.eventId),
            ticketId: BigInt(record.ticketId),
            attendee: String(record.attendee),
            organizer: String(record.organizer),
            timestamp: BigInt(record.timestamp),
            valid: true,
            txHash: hash,
            eventName: value.event.name,
          });
        } else {
          setProof(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseTxError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  async function transfer() {
    if (!ticket) return;
    setError("");
    try {
      requireContracts();
      if (!ethers.isAddress(recipient)) throw new Error("Enter a valid wallet address.");
      const session = await wallet.ensureFuji();
      if (session.address.toLowerCase() !== ticket.owner.toLowerCase()) {
        throw new Error("Only the current owner can transfer this ticket.");
      }
      const { tickets } = await getSignedContracts(session.provider);
      const to = ethers.getAddress(recipient);
      openTx({
        title: "Transfer ticket",
        type: "Ticket transfer",
        amountAvax: "0",
        to: addresses.tickets,
        summary: [
          { label: "Ticket", value: formatTicketCode(ticket.ticketId) },
          { label: "Recipient", value: shortAddress(to) },
        ],
        estimateGas: () => tickets.transferFrom.estimateGas(session.address, to, ticket.ticketId),
        send: async () => {
          const gas = await tickets.transferFrom.estimateGas(session.address, to, ticket.ticketId);
          return tickets.transferFrom(session.address, to, ticket.ticketId, { gasLimit: (gas * 12n) / 10n });
        },
      });
    } catch (err) {
      setError(parseTxError(err));
    }
  }

  if (!ticket) return <p className="text-sm text-muted">{error || "Loading ticket…"}</p>;
  const status = ticketStatus(ticket.checkedIn, ticket.event.endTime);
  const mine = wallet.address?.toLowerCase() === ticket.owner.toLowerCase();

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <PageTitle title={formatTicketCode(ticket.ticketId)} />
      <div className="lg:col-span-2">
        <TxBanner />
      </div>
      <Panel className="text-center">
        <div className="mx-auto w-fit rounded-2xl bg-white p-4">
          <QRCodeSVG value={ticketQrValue(ticket.ticketId)} size={220} includeMargin />
        </div>
        <p className="mt-4 font-display text-2xl font-bold">{formatTicketCode(ticket.ticketId)}</p>
        <p className="text-sm text-muted">Show this QR code to the organizer.</p>
      </Panel>
      <div className="space-y-4">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Ticket</p>
              <h1 className="font-display text-3xl font-bold">{ticket.event.name}</h1>
            </div>
            <StatusPill status={status} />
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Event date" value={formatDateTime(ticket.event.startTime)} />
            <Info label="Venue" value={ticket.event.venue} />
            <Info label="Location" value={ticket.event.location} />
            <Info label="Owner wallet" value={shortAddress(ticket.owner)} />
            <Info label="Purchased" value={formatDateTime(ticket.purchasedAt)} />
            <Info label="Check-in status" value={ticket.checkedIn ? "Checked in" : "Not checked in"} />
          </dl>
          <Link className="mt-4 inline-block text-sm font-semibold text-accent" to={`/events/${ticket.eventId.toString()}`}>
            View event
          </Link>
        </Panel>

        {proof?.valid ? (
          <Panel>
            <p className="text-sm font-semibold text-good">You attended {proof.eventName}</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Proof of Attendance</h2>
            <dl className="mt-4 grid gap-2 text-sm">
              <Info label="Wallet address" value={shortAddress(proof.attendee)} />
              <Info label="Event" value={proof.eventName || ""} />
              <Info label="Date" value={formatDateTime(proof.timestamp)} />
              <Info label="Transaction hash" value={proof.txHash ? shortAddress(proof.txHash) : "Recorded on Avalanche"} />
            </dl>
            {proof.txHash ? (
              <a className="mt-3 inline-block text-sm font-semibold text-accent" href={txUrl(proof.txHash)} target="_blank" rel="noreferrer">
                View on Avalanche Explorer
              </a>
            ) : null}
          </Panel>
        ) : null}

        {mine && !ticket.checkedIn && ticket.event.transfersAllowed ? (
          <Panel>
            <h2 className="font-display text-xl font-bold">Transfer Ticket</h2>
            <p className="mt-1 text-sm text-muted">Transfers are blocked after check-in. The recipient receives ownership through a blockchain transaction.</p>
            <input
              className="mt-4 w-full rounded-xl border border-line bg-bg px-3 py-2.5"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="0x recipient wallet"
            />
            {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
            <Button className="mt-4" onClick={transfer}>Transfer Ticket</Button>
          </Panel>
        ) : null}
        {error && (ticket.checkedIn || !mine) ? <p className="text-sm text-accent">{error}</p> : null}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}
