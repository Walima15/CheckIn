import { useEffect, useMemo, useState } from "react";
import { ChainEventCard, EventCard } from "@/components/EventCard";
import { inputClass, PageTitle } from "@/components/ui";
import { demoEvents, demoWindow } from "@/data/demoEvents";
import { useChainTick } from "@/hooks/useChainTick";
import { loadEvents } from "@/services/contracts";
import { parseTxError } from "@/services/errors";
import { loadProfiles } from "@/services/metadata";
import type { ChainEvent } from "@/types";
import { CATEGORIES, formatDate, formatTime, shortAddress } from "@/utils/format";

export default function Events() {
  const tick = useChainTick();
  const [events, setEvents] = useState<ChainEvent[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    let cancelled = false;
    loadEvents()
      .then(async (list) => {
        if (cancelled) return;
        setEvents(list);
        setNames(await loadProfiles(list.map((event) => event.organizer)));
      })
      .catch((err) => {
        if (!cancelled) {
          setEvents([]);
          setError(parseTxError(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (events || []).filter((event) => {
      const haystack = `${event.name} ${event.location} ${event.venue} ${event.category} ${event.organizer}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesCategory = category === "All" || event.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [events, query, category]);

  const samples = demoEvents
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => !(events || []).some((item) => item.name === event.name));

  return (
    <div>
      <PageTitle title="Events" />
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-4xl font-bold">Events</h1>
          <p className="mt-2 text-muted">Discover events and buy a ticket with testnet AVAX.</p>
        </div>
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, cities, venues" />
        <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          <option>All</option>
          {CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {error ? <p className="mb-4 text-sm text-accent">{error}</p> : null}
      {events === null ? <p className="text-sm text-muted">Loading events from Avalanche Testnet…</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((event) => (
          <ChainEventCard
            key={event.id.toString()}
            event={event}
            organizer={names[event.organizer.toLowerCase()] || shortAddress(event.organizer)}
          />
        ))}
      </div>
      {events && filtered.length === 0 ? <p className="mt-6 text-sm text-muted">No on-chain events match that search.</p> : null}

      {samples.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Sample events</h2>
          <p className="mt-2 text-sm text-muted">These are demo listings for the interface. They are not purchasable until an organizer publishes them on Avalanche Testnet.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {samples.map(({ event, index }) => {
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
      ) : null}
    </div>
  );
}
