import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addresses, requireContracts } from "@/config/network";
import { EventForm } from "@/components/EventForm";
import { Button, PageTitle, Panel } from "@/components/ui";
import { useTx } from "@/hooks/TxContext";
import { useWallet } from "@/hooks/WalletContext";
import { getSignedContracts, loadEvent } from "@/services/contracts";
import { formFromEvent, toUpdateInput, validateEventForm, type EventFormValues } from "@/services/eventForm";
import { parseTxError } from "@/services/errors";
import type { ChainEvent } from "@/types";

export default function EditEvent() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const wallet = useWallet();
  const { openTx } = useTx();
  const [event, setEvent] = useState<ChainEvent | null>(null);
  const [values, setValues] = useState<EventFormValues | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!/^\d+$/.test(id)) return;
    loadEvent(BigInt(id))
      .then((value) => {
        setEvent(value);
        setValues(formFromEvent(value));
      })
      .catch((err) => setError(parseTxError(err)));
  }, [id]);

  async function save() {
    if (!event || !values) return;
    const problem = validateEventForm(values, Number(event.sold));
    setError(problem || "");
    if (problem) return;
    try {
      requireContracts();
      const session = await wallet.ensureFuji();
      if (session.address.toLowerCase() !== event.organizer.toLowerCase()) {
        throw new Error("Only the event organizer can edit this event.");
      }
      const { events } = await getSignedContracts(session.provider);
      const input = toUpdateInput(values);
      openTx({
        title: "Update event",
        type: "Edit event",
        amountAvax: "0",
        to: addresses.events,
        summary: [{ label: "Event", value: input.name }],
        estimateGas: () => events.updateEvent.estimateGas(event.id, input),
        send: async () => {
          const gas = await events.updateEvent.estimateGas(event.id, input);
          return events.updateEvent(event.id, input, { gasLimit: (gas * 12n) / 10n });
        },
        onSuccess: (receipt) => navigate(`/events/${event.id.toString()}?tx=${receipt.hash}`),
      });
    } catch (err) {
      setError(parseTxError(err));
    }
  }

  const denied = event && wallet.address && wallet.address.toLowerCase() !== event.organizer.toLowerCase();

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Edit Event" />
      <h1 className="font-display text-4xl font-bold">Edit Event</h1>
      {denied ? <p className="mt-4 text-sm text-accent">Only the organizer wallet can change this event.</p> : null}
      {values ? (
        <Panel className="mt-6">
          <EventForm values={values} onChange={setValues} showActive showDemo={false} />
          {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}
          <Button className="mt-5" onClick={save} disabled={Boolean(denied)}>
            Save on Avalanche
          </Button>
        </Panel>
      ) : (
        <p className="mt-4 text-sm text-muted">{error || "Loading event…"}</p>
      )}
    </div>
  );
}
