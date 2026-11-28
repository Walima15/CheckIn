import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Calendar, Gift, LayoutGrid, Menu, Moon, Sun, Ticket, X } from "lucide-react";
import { contractsConfigured } from "@/config/network";
import { useWallet } from "@/hooks/WalletContext";
import { WalletMenu } from "@/components/WalletMenu";
import { Button } from "@/components/ui";
import { cx } from "@/utils/format";
import { useEffect } from "react";

const links = [
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/tickets", label: "My Tickets", icon: Ticket },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/organizer", label: "Organizer", icon: LayoutGrid },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const location = useLocation();
  const wallet = useWallet();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("checkin.theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <div className="min-h-screen">
      <div className="bg-accent px-4 py-2.5 text-balance text-center text-sm font-medium leading-snug text-white [padding-top:max(0.625rem,env(safe-area-inset-top))]">
        Avalanche Testnet · Testnet AVAX only — No real funds are required.
      </div>
      {wallet.address && !wallet.isFuji ? (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-warn/15 px-4 py-2 text-sm">
          <span>Please switch to Avalanche Testnet</span>
          <Button className="px-3 py-1.5" onClick={() => wallet.switchToFuji()}>
            Switch to Avalanche Testnet
          </Button>
        </div>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 md:gap-3 md:py-3">
          <NavLink to="/" className="shrink-0 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            CheckIn
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cx("rounded-full px-3 py-2 text-sm font-medium", isActive ? "bg-surface-2" : "text-muted hover:text-ink")
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line md:h-9 md:w-9" onClick={toggleTheme} type="button" aria-label="Toggle color theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <WalletMenu />
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line md:hidden"
              onClick={() => setOpen((value) => !value)}
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="grid gap-1 border-t border-line px-3 py-3 md:hidden" aria-label="Menu">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cx("flex min-h-11 items-center rounded-2xl px-3 text-base font-medium", isActive ? "bg-surface-2" : "")
                }
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/create" className="flex min-h-11 items-center rounded-2xl px-3 text-base font-medium">
              Create Event
            </NavLink>
            <NavLink to="/checkin" className="flex min-h-11 items-center rounded-2xl px-3 text-base font-medium">
              Check In
            </NavLink>
          </nav>
        ) : null}
      </header>
      {!contractsConfigured ? (
        <div className="mx-auto mt-4 max-w-6xl px-4">
          <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm leading-relaxed">
            Contracts are not configured yet. You can explore the interface and sample events. Deploy to Avalanche Testnet before buying a ticket.
          </div>
        </div>
      ) : null}
      <main className="mx-auto min-w-0 max-w-6xl px-4 pb-28 pt-6 md:py-8">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-line pb-24 md:pb-0">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-xl font-bold">CheckIn</p>
            <p className="mt-2 text-sm text-muted">Blockchain-powered event ticketing and attendance verification built on Avalanche.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Explore</p>
            <div className="mt-2 grid text-muted">
              <NavLink className="flex min-h-11 items-center md:min-h-0" to="/events">Events</NavLink>
              <NavLink className="flex min-h-11 items-center md:min-h-0" to="/create">Create Event</NavLink>
              <NavLink className="flex min-h-11 items-center md:min-h-0" to="/checkin">Check In</NavLink>
              <NavLink className="flex min-h-11 items-center md:min-h-0" to="/rewards">Rewards</NavLink>
            </div>
          </div>
          <div className="text-sm text-muted">
            <p className="font-semibold text-ink">Avalanche Testnet</p>
            <p className="mt-2">Testnet AVAX only — No real funds are required.</p>
            <p className="mt-2">CheckIn is an independent testnet MVP. Ticket ownership, check-in, attendance, and rewards are verified on the Avalanche C-Chain.</p>
          </div>
        </div>
      </footer>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-4">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cx(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium leading-tight",
                    isActive ? "text-accent" : "text-muted",
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {link.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
