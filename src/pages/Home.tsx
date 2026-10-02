import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Gift, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { ChainEventCard } from "@/components/EventCard";
import { EventCard } from "@/components/EventCard";
import { PageTitle, Panel } from "@/components/ui";
import { demoEvents, demoWindow } from "@/data/demoEvents";
import { useChainTick } from "@/hooks/useChainTick";
import { useWallet } from "@/hooks/WalletContext";
import { loadEvents } from "@/services/contracts";
import { loadProfiles } from "@/services/metadata";
import type { ChainEvent } from "@/types";
import { formatDate, formatTime, shortAddress } from "@/utils/format";
import { useEffect, useState } from "react";

const steps = [
  { n: "1", title: "Discover", body: "Find an event." },
  { n: "2", title: "Buy", body: "Purchase a digital ticket using testnet AVAX." },
  { n: "3", title: "Check In", body: "Scan your ticket at the event." },
  { n: "4", title: "Earn", body: "Receive Proof of Attendance and rewards." },
  { n: "5", title: "Connect", body: "Stay connected to future experiences." },
];

export default function Home() {
  const wallet = useWallet();
  const tick = useChainTick();
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadEvents()
      .then(async (list) => {
        setEvents(list);
        setNames(await loadProfiles(list.map((event) => event.organizer)));
      })
      .catch(() => setEvents([]));
  }, [tick]);

  const featured = [...events].sort((a, b) => (a.startTime < b.startTime ? -1 : 1)).slice(0, 3);

  return (
    <div>
      <PageTitle title="CheckIn" />
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-12 sm:px-10 sm:py-16">
        <div className="grid-fade pointer-events-none absolute inset-0" />
        <div className="relative max-w-3xl">
          <p className="inline-flex rounded-full border border-line bg-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
            Avalanche Testnet
          </p>
          <h1 className="mt-5 font-display text-6xl font-extrabold tracking-tight sm:text-7xl">CheckIn</h1>
          <p className="mt-3 font-display text-2xl font-semibold sm:text-3xl">Buy. Attend. Earn. Connect.</p>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Blockchain-powered event ticketing and attendance verification built on Avalanche.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/events" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
              Explore Events
            </Link>
            <Link to="/create" className="rounded-full border border-line bg-bg px-5 py-3 text-sm font-semibold">
              Create Event
            </Link>
            {wallet.address ? (
              <Link to="/tickets" className="rounded-full border border-line px-5 py-3 text-sm font-semibold">
                {shortAddress(wallet.address)}
              </Link>
            ) : (
              <button
                className="rounded-full border border-line px-5 py-3 text-sm font-semibold"
                type="button"
                onClick={() => wallet.connect().catch(() => undefined)}
              >
                Connect Wallet
              </button>
            )}
          </div>
          <p className="mt-6 text-sm text-muted">
            Wallet: {wallet.address ? `${shortAddress(wallet.address)} · ${wallet.isFuji ? "Avalanche Testnet" : "switch network"}` : "not connected"}
          </p>
        </div>
      </section>

      <section id="how" className="mt-16">
        <h2 className="font-display text-3xl font-bold">How It Works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {steps.map((step) => (
            <Panel key={step.n}>
              <p className="font-display text-3xl font-extrabold text-accent">{step.n}</p>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-3xl font-bold">Featured Events</h2>
          <Link to="/events" className="inline-flex items-center gap-1 text-sm font-semibold">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {featured.length > 0
            ? featured.map((event) => (
                <ChainEventCard
                  key={event.id.toString()}
                  event={event}
                  organizer={names[event.organizer.toLowerCase()] || shortAddress(event.organizer)}
                />
              ))
            : demoEvents.slice(0, 3).map((event, index) => {
                const window = demoWindow(event);
                return (
                  <EventCard
                    key={event.name}
                    name={event.name}
                    image={event.imageURI}
                    organizer="Sample organizer"
                    date={formatDate(Math.floor(window.start.getTime() / 1000))}
                    time={`${formatTime(Math.floor(window.start.getTime() / 1000))} – ${formatTime(Math.floor(window.end.getTime() / 1000))}`}
                    location={event.location}
                    price={event.priceAvax}
                    remaining={String(event.maxSupply)}
                    category={event.category}
                    href={`/create?sample=${index}`}
                    badge="Sample"
                    action="Preview sample"
                  />
                );
              })}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-3xl font-bold">Why CheckIn?</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Reason icon={<Ticket className="h-5 w-5" />} title="A ticket you can verify" body="Each ticket is an ERC-721 on Avalanche. Ownership comes from the contract, not a screenshot." />
          <Reason icon={<QrCode className="h-5 w-5" />} title="One check-in" body="Organizers scan a QR code. The contract rejects a second check-in for the same ticket." />
          <Reason icon={<Gift className="h-5 w-5" />} title="Attendance that stays" body="A successful check-in writes Proof of Attendance and testnet reward points." />
        </div>
      </section>

      <section id="organizers" className="mt-16 grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl font-bold">For Organizers</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>Create an event and set the price in testnet AVAX.</li>
            <li>Watch tickets sell to real wallet addresses.</li>
            <li>Scan QR codes and check attendees in on-chain.</li>
            <li>See sales, attendance, and check-in rate.</li>
          </ul>
          <Link to="/create" className="mt-5 inline-flex text-sm font-semibold text-accent">
            Create Event
          </Link>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl font-bold">For Attendees</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>Connect Core Wallet and stay on Avalanche Testnet.</li>
            <li>Buy a ticket and keep it in My Tickets.</li>
            <li>Show the QR code at the door.</li>
            <li>Collect Proof of Attendance and points.</li>
          </ul>
          <Link to="/events" className="mt-5 inline-flex text-sm font-semibold text-accent">
            Explore Events
          </Link>
        </Panel>
      </section>

      <section className="mt-16">
        <Panel className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold">Blockchain Verification</h2>
            <p className="mt-3 text-muted">Powered by Avalanche C-Chain. The contract is the source of truth for ownership, payment, check-in, and rewards.</p>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex gap-2"><ShieldCheck className="h-5 w-5 text-accent" /> Purchases require a wallet signature.</li>
              <li className="flex gap-2"><BadgeCheck className="h-5 w-5 text-accent" /> Check-in is stored with the ticket.</li>
              <li className="flex gap-2"><Gift className="h-5 w-5 text-accent" /> Rewards are testnet points, not a cash token.</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-dashed border-line bg-bg p-6">
            <p className="text-xs uppercase tracking-wide text-muted">Ticket</p>
            <p className="mt-2 font-display text-2xl font-bold">CHK-000123</p>
            <p className="mt-4 text-sm">Zambia Web3 Builders Meetup</p>
            <p className="text-sm text-muted">Status: Valid until the organizer scans it.</p>
          </div>
        </Panel>
      </section>

      <section id="rewards" className="mt-16">
        <h2 className="font-display text-3xl font-bold">Rewards</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Point label="Ticket purchase" value="10 pts" />
          <Point label="Successful check-in" value="50 pts" />
          <Point label="Event participation" value="25 pts" />
          <Point label="Organizer bonus" value="Variable" />
        </div>
      </section>

      <section className="mt-16 rounded-[2rem] bg-accent px-6 py-12 text-white sm:px-10">
        <h2 className="font-display text-4xl font-extrabold">Ready for the next event?</h2>
        <p className="mt-3 max-w-xl text-white/85">Create an event or buy a ticket with testnet AVAX. Nothing here moves mainnet funds.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/events" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
            Explore Events
          </Link>
          <Link to="/create" className="rounded-full border border-white/40 px-5 py-3 text-sm font-semibold">
            Create Event
          </Link>
        </div>
      </section>
    </div>
  );
}

function Reason({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Panel>
      <div className="mb-3 text-accent">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </Panel>
  );
}

function Point({ label, value }: { label: string; value: string }) {
  return (
    <Panel>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </Panel>
  );
}
