import { Link } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";
import { EventCover } from "@/components/EventCover";
import type { ChainEvent } from "@/types";
import { formatAvax, formatDate, formatTime } from "@/utils/format";

export function EventCard({
  name,
  image,
  organizer,
  date,
  time,
  location,
  price,
  remaining,
  category,
  href,
  badge,
  action = "Buy Ticket",
}: {
  name: string;
  image?: string;
  organizer: string;
  date: string;
  time: string;
  location: string;
  price: string;
  remaining: string;
  category: string;
  href: string;
  badge?: string;
  action?: string;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <div className="relative h-44">
        <EventCover src={image} category={category} name={name} className="h-44" />
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">{category}</span>
          {badge ? <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-black">{badge}</span> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-bold leading-tight">{name}</h3>
        <p className="mt-1 text-sm text-muted">{organizer}</p>
        <div className="mt-4 space-y-1.5 text-sm text-muted">
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4" /> {date} · {time}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> {location}
          </p>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-lg font-semibold">{price} AVAX</p>
            <p className="text-xs text-muted">{remaining} tickets remaining</p>
          </div>
        </div>
        <Link
          to={href}
          className="mt-5 inline-flex items-center justify-center rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white"
        >
          {action}
        </Link>
      </div>
    </article>
  );
}

export function ChainEventCard({ event, organizer }: { event: ChainEvent; organizer: string }) {
  const remaining = event.maxSupply - event.sold;
  return (
    <EventCard
      name={event.name}
      image={event.imageURI}
      organizer={organizer}
      date={formatDate(event.startTime)}
      time={`${formatTime(event.startTime)} – ${formatTime(event.endTime)}`}
      location={event.location}
      price={formatAvax(event.priceWei)}
      remaining={remaining.toString()}
      category={event.category}
      href={`/events/${event.id.toString()}`}
      badge={event.demo ? "Demo" : event.active ? undefined : "Paused"}
      action={remaining === 0n ? "Sold out" : "Buy Ticket"}
    />
  );
}
