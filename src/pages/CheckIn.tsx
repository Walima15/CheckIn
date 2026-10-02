import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { addresses, requireContracts, txUrl } from "@/config/network";
import { Button, PageTitle, Panel, StatusPill } from "@/components/ui";
import { useTx } from "@/hooks/TxContext";
import { useWallet } from "@/hooks/WalletContext";
import { getSignedContracts, loadEvent, loadTicket, parseTicketQr } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import type { ChainEvent, TicketRecord } from "@/types";
import { formatTicketCode, shortAddress } from "@/utils/format";

export default function CheckIn() {
  const [params] = useSearchParams();
  const wallet = useWallet();
  const { openTx } = useTx();
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [scopedEvent, setScopedEvent] = useState<ChainEvent | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ hash: string; eventName: string } | null>(null);

  const eventFilter = params.get("event");

  useEffect(() => {
    if (!eventFilter || !/^\d+$/.test(eventFilter)) return;
    loadEvent(BigInt(eventFilter))
      .then(setScopedEvent)
      .catch((err) => setError(parseTxError(err)));
  }, [eventFilter]);

  useEffect(() => {
    if (!cameraOn) return;
    const scanner = new Html5Qrcode("checkin-reader");
    let stopped = false;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (stopped) return;
          stopped = true;
          scanner.stop().catch(() => undefined).finally(() => {
            setCameraOn(false);
            void lookup(text);
          });
        },
        () => undefined,
      )
      .catch((err: { message?: string }) => {
        setCameraError(err.message || "Camera unavailable. Enter the ticket ID instead.");
        setCameraOn(false);
      });
    return () => {
      stopped = true;
      scanner.stop().catch(() => undefined);
    };
    // lookup is recreated each render; the camera should only restart when toggled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  async function lookup(raw: string) {
    setError("");
    setDone(null);
    setTicket(null);
    const parsed = parseTicketQr(raw);
    if (!parsed.ticketId) {
      setError(parsed.error || "Could not read that ticket.");
      return;
    }
    try {
      const found = await loadTicket(parsed.ticketId);
      if (eventFilter && found.eventId.toString() !== eventFilter) {
        setError("This ticket is for a different event.");
        return;
      }
      setTicket(found);
    } catch (err) {
      setError(parseTxError(err));
    }
  }

  async function confirmCheckIn() {
    if (!ticket) return;
    setError("");
    try {
      requireContracts();
      const session = await wallet.ensureFuji();
      if (session.address.toLowerCase() !== ticket.event.organizer.toLowerCase()) {
        throw new Error("Only the event organizer can check this ticket in.");
      }
      if (ticket.checkedIn) throw new Error("This ticket has already been checked in.");
      const { tickets } = await getSignedContracts(session.provider);
      openTx({
        title: "Check in attendee",
        type: "Check-in and Proof of Attendance",
        amountAvax: "0",
        to: addresses.tickets,
        summary: [
          { label: "Ticket", value: formatTicketCode(ticket.ticketId) },
          { label: "Event", value: ticket.event.name },
          { label: "Attendee", value: shortAddress(ticket.owner) },
        ],
        estimateGas: () => tickets.checkIn.estimateGas(ticket.ticketId),
        send: async () => {
          const gas = await tickets.checkIn.estimateGas(ticket.ticketId);
          return tickets.checkIn(ticket.ticketId, { gasLimit: (gas * 12n) / 10n });
        },
        onSuccess: (receipt) => {
          setDone({ hash: receipt.hash, eventName: ticket.event.name });
          setTicket({ ...ticket, checkedIn: true, checkedInAt: BigInt(Math.floor(Date.now() / 1000)) });
        },
      });
    } catch (err) {
      setError(parseTxError(err));
    }
  }

  const organizerOk = ticket && wallet.address?.toLowerCase() === ticket.event.organizer.toLowerCase();

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Check In" />
      <h1 className="font-display text-4xl font-bold">Check In</h1>
      <p className="mt-2 text-muted">
        {scopedEvent ? `Checking in for ${scopedEvent.name}.` : "Scan an attendee QR code or enter a ticket ID."}
      </p>
      <Panel className="mt-6">
        {cameraOn ? <div id="checkin-reader" className="overflow-hidden rounded-2xl bg-black" /> : null}
        {cameraError ? <p className="mb-3 text-sm text-accent">{cameraError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setCameraError(""); setCameraOn((value) => !value); }}>
            {cameraOn ? "Stop camera" : "Start camera"}
          </Button>
        </div>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void lookup(manual);
          }}
        >
          <input
            className="w-full rounded-xl border border-line bg-bg px-3 py-2.5"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="CHK-000123 or raw ticket ID"
          />
          <Button type="submit" variant="secondary">Verify ticket</Button>
        </form>
        <p className="mt-3 text-xs text-muted">Camera access needs localhost or HTTPS. You can always type the ticket ID.</p>
      </Panel>

      {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}

      {ticket ? (
        <Panel className="mt-4">
          <dl className="grid gap-3 text-sm">
            <Line label="Ticket ID" value={formatTicketCode(ticket.ticketId)} />
            <Line label="Event" value={ticket.event.name} />
            <Line label="Wallet" value={shortAddress(ticket.owner)} />
            <div className="flex items-center justify-between">
              <dt className="text-muted">Status</dt>
              <StatusPill status={ticket.checkedIn ? "CHECKED IN" : "VALID"} />
            </div>
          </dl>
          {!ticket.checkedIn && organizerOk ? (
            <Button className="mt-5 w-full" onClick={confirmCheckIn}>CHECK IN ATTENDEE</Button>
          ) : null}
          {!wallet.address ? <p className="mt-4 text-sm">Connect the organizer wallet to check this attendee in.</p> : null}
          {wallet.address && !organizerOk ? <p className="mt-4 text-sm text-muted">The connected wallet is not the organizer for this event.</p> : null}
          {ticket.checkedIn && !done ? <p className="mt-4 font-semibold">ATTENDEE CHECKED IN</p> : null}
        </Panel>
      ) : null}

      {done ? (
        <Panel className="mt-4">
          <p className="font-display text-2xl font-bold text-good">✓ Check-in Successful</p>
          <p className="mt-2 font-semibold">Proof of Attendance issued</p>
          <p className="mt-1 text-sm text-muted">ATTENDEE CHECKED IN</p>
          <p className="mt-3 break-all text-sm">{done.hash}</p>
          <a className="mt-3 inline-block text-sm font-semibold text-accent" href={txUrl(done.hash)} target="_blank" rel="noreferrer">
            View on Avalanche Explorer
          </a>
        </Panel>
      ) : null}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
