import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addresses, requireContracts } from "@/config/network";
import { EventForm } from "@/components/EventForm";
import { Button, PageTitle, Panel } from "@/components/ui";
import { demoEvents, demoWindow } from "@/data/demoEvents";
import { useTx } from "@/hooks/TxContext";
import { useWallet } from "@/hooks/WalletContext";
import { decodeEventId, getSignedContracts } from "@/services/contracts";
import { emptyEventForm, toCreateInput, validateEventForm, type EventFormValues } from "@/services/eventForm";
import { parseTxError } from "@/services/errors";
import { toDateInput, toTimeInput } from "@/utils/format";

export default function CreateEvent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const wallet = useWallet();
  const { openTx } = useTx();
  const [values, setValues] = useState<EventFormValues>(emptyEventForm);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = params.get("sample");
    if (raw === null || !/^\d+$/.test(raw)) return;
    const index = Number(raw);
    const sample = demoEvents[index];
    if (!sample) return;
    const when = demoWindow(sample);
    setValues({
      ...emptyEventForm(),
      name: sample.name,
      description: sample.description,
      imageURI: sample.imageURI,
      date: toDateInput(when.start),
      startTime: toTimeInput(when.start),
      endTime: toTimeInput(when.end),
      venue: sample.venue,
      location: sample.location,
      category: sample.category,
      price: sample.priceAvax,
      maxSupply: String(sample.maxSupply),
      bonusPoints: String(sample.bonusPoints),
      transfersAllowed: sample.transfersAllowed,
      demo: true,
    });
  }, [params]);

  async function submit() {
    const problem = validateEventForm(values);
    setError(problem || "");
    if (problem) return;
    try {
      requireContracts();
      const session = await wallet.ensureFuji();
      const { events } = await getSignedContracts(session.provider);
      const input = toCreateInput(values);
      openTx({
        title: "Create event",
        type: "Create event",
        amountAvax: "0",
        to: addresses.events,
        summary: [
          { label: "Event", value: input.name },
          { label: "Ticket price", value: `${values.price} AVAX` },
          { label: "Supply", value: values.maxSupply },
        ],
        estimateGas: () => events.createEvent.estimateGas(input),
        send: async () => {
          const gas = await events.createEvent.estimateGas(input);
          return events.createEvent(input, { gasLimit: (gas * 12n) / 10n });
        },
        onSuccess: (receipt) => {
          const eventId = decodeEventId(receipt);
          navigate(eventId ? `/events/${eventId.toString()}?tx=${receipt.hash}` : `/organizer?tx=${receipt.hash}`);
        },
      });
    } catch (err) {
      setError(parseTxError(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Create Event" />
      <h1 className="font-display text-4xl font-bold">Create Event</h1>
      <p className="mt-2 text-muted">Your connected wallet becomes the organizer. Creation is a real Avalanche Testnet transaction.</p>
      <Panel className="mt-6">
        <EventForm values={values} onChange={setValues} />
        {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}
        <p className="mt-4 text-xs text-muted">Avalanche Testnet · Testnet AVAX only — No real funds are required. You only pay the network fee.</p>
        <Button className="mt-5" onClick={submit}>
          {wallet.address ? "Create on Avalanche" : "Connect Wallet"}
        </Button>
      </Panel>
    </div>
  );
}
