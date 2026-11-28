import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useParams } from "react-router-dom";
import { addresses, requireContracts } from "@/config/network";
import { PageTitle, Panel } from "@/components/ui";
import { useChainTick } from "@/hooks/useChainTick";
import { useTx } from "@/hooks/TxContext";
import { useWallet } from "@/hooks/WalletContext";
import { getSignedContracts, loadAttendees, loadEvent } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import type { AttendeeRow, ChainEvent } from "@/types";
import { formatDateTime, formatTicketCode, percent, shortAddress } from "@/utils/format";

export default function OrganizerEvent() {
  const { id = "" } = useParams();
  const wallet = useWallet();
  const { openTx } = useTx();
  const tick = useChainTick();
  const [event, setEvent] = useState<ChainEvent | null>(null);
  const [rows, setRows] = useState<AttendeeRow[]>([]);
  const [bonus, setBonus] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!/^\d+$/.test(id)) return;
    let cancelled = false;
    Promise.all([loadEvent(BigInt(id)), loadAttendees(BigInt(id))])
      .then(([nextEvent, attendees]) => {
        if (cancelled) return;
        setEvent(nextEvent);
        setRows(attendees);
      })
      .catch((err) => {
        if (!cancelled) setError(parseTxError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  async function issue(row: AttendeeRow) {
    if (!event) return;
    const points = Number(bonus[row.ticketId.toString()] || "0");
    if (!Number.isInteger(points) || points < 1 || points > 100) {
      setError("Extra bonus must be a whole number from 1 to 100.");
      return;
    }
    setError("");
    try {
      requireContracts();
      const session = await wallet.ensureFuji();
      if (session.address.toLowerCase() !== event.organizer.toLowerCase()) {
        throw new Error("Only the event organizer can issue rewards.");
      }
      const { tickets } = await getSignedContracts(session.provider);
      openTx({
        title: "Issue reward",
        type: "Organizer bonus",
        amountAvax: "0",
        to: addresses.tickets,
        summary: [
          { label: "Ticket", value: formatTicketCode(row.ticketId) },
          { label: "Points", value: String(points) },
        ],
        estimateGas: () => tickets.issueBonus.estimateGas(row.ticketId, points),
        send: async () => {
          const gas = await tickets.issueBonus.estimateGas(row.ticketId, points);
          return tickets.issueBonus(row.ticketId, points, { gasLimit: (gas * 12n) / 10n });
        },
      });
    } catch (err) {
      setError(parseTxError(err));
    }
  }

  if (!event) return <p className="text-sm text-muted">{error || "Loading attendees…"}</p>;
  const denied = wallet.address && wallet.address.toLowerCase() !== event.organizer.toLowerCase();

  return (
    <div>
      <PageTitle title={event.name} />
      <Link to="/organizer" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">Back to dashboard</Link>
      <h1 className="mt-3 break-words font-display text-3xl font-bold leading-tight sm:text-4xl">{event.name}</h1>
      <p className="mt-2 text-muted">
        {event.sold.toString()} sold · {event.checkedIn.toString()} checked in · {percent(event.checkedIn, event.sold)} attendance
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
        <Link className="inline-flex min-h-11 items-center" to={`/checkin?event=${event.id.toString()}`}>Scan QR codes</Link>
        <Link className="inline-flex min-h-11 items-center" to={`/events/${event.id.toString()}/edit`}>Edit event</Link>
      </div>
      {denied ? <p className="mt-4 text-sm text-accent">Connect the organizer wallet to verify and reward attendees.</p> : null}
      {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}
      <div className="mt-6 grid gap-3 md:hidden">
        {rows.length === 0 ? <p className="text-sm text-muted">No tickets sold yet.</p> : null}
        {rows.map((row) => (
          <Panel key={row.ticketId.toString()} className="p-4">
            <dl className="grid gap-3 text-sm">
              <AttendeeField label="Ticket" value={formatTicketCode(row.ticketId)} />
              <AttendeeField label="Wallet" value={shortAddress(row.owner)} />
              <AttendeeField label="Status" value={row.checkedIn ? "Checked In" : "Valid"} />
              <AttendeeField label="Checked in" value={row.checkedIn ? formatDateTime(row.checkedInAt) : "—"} />
            </dl>
            <div className="mt-3">
              <p className="text-sm text-muted">Bonus</p>
              <div className="mt-1">
                <BonusControl row={row} denied={Boolean(denied)} bonus={bonus} setBonus={setBonus} onIssue={issue} />
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <div className="mt-6 hidden overflow-x-auto rounded-3xl border border-line md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Ticket</th>
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Checked in</th>
              <th className="px-4 py-3 font-medium">Bonus</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-muted" colSpan={5}>No tickets sold yet.</td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.ticketId.toString()} className="border-t border-line">
                <td className="px-4 py-3 font-semibold">{formatTicketCode(row.ticketId)}</td>
                <td className="px-4 py-3">{shortAddress(row.owner)}</td>
                <td className="px-4 py-3">{row.checkedIn ? "Checked In" : "Valid"}</td>
                <td className="px-4 py-3">{row.checkedIn ? formatDateTime(row.checkedInAt) : "—"}</td>
                <td className="px-4 py-3">
                  <BonusControl row={row} denied={Boolean(denied)} bonus={bonus} setBonus={setBonus} onIssue={issue} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Panel className="mt-4">
        <p className="text-sm text-muted">The event bonus set at creation is issued automatically during check-in. The extra bonus here can be issued once per ticket.</p>
      </Panel>
    </div>
  );
}

function AttendeeField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  );
}

function BonusControl({
  row,
  denied,
  bonus,
  setBonus,
  onIssue,
}: {
  row: AttendeeRow;
  denied: boolean;
  bonus: Record<string, string>;
  setBonus: Dispatch<SetStateAction<Record<string, string>>>;
  onIssue: (row: AttendeeRow) => void;
}) {
  if (row.checkedIn && !row.bonusClaimed && !denied) {
    return (
      <div className="flex gap-2">
        <input
          className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base md:w-24 md:rounded-lg"
          value={bonus[row.ticketId.toString()] || ""}
          onChange={(input) => setBonus((current) => ({ ...current, [row.ticketId.toString()]: input.target.value }))}
          placeholder="10"
          inputMode="numeric"
        />
        <button className="inline-flex min-h-11 shrink-0 items-center px-2 font-semibold text-accent" type="button" onClick={() => onIssue(row)}>
          Issue
        </button>
      </div>
    );
  }
  return <span className="text-muted">{row.bonusClaimed ? "Issued" : "Check in first"}</span>;
}
