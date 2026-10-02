import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { contractsConfigured } from "@/config/network";
import { useWallet } from "@/hooks/WalletContext";
import { WalletMenu } from "@/components/WalletMenu";
import { Button } from "@/components/ui";
import { cx } from "@/utils/format";
import { useEffect } from "react";

const links = [
  { to: "/events", label: "Events" },
  { to: "/tickets", label: "My Tickets" },
  { to: "/rewards", label: "Rewards" },
  { to: "/organizer", label: "Organizer" },
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
      <div className="bg-accent px-4 py-2 text-center text-sm font-medium text-white">
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
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="font-display text-2xl font-extrabold tracking-tight">
            CheckIn
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
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
            <button className="rounded-full border border-line p-2" onClick={toggleTheme} type="button" aria-label="Toggle color theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="hidden sm:block">
              <WalletMenu />
            </div>
            <button className="rounded-full border border-line p-2 md:hidden" onClick={() => setOpen((value) => !value)} type="button" aria-label="Open menu">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {open ? (
          <div className="space-y-3 border-t border-line px-4 py-4 md:hidden">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className="block text-sm font-medium">
                {link.label}
              </NavLink>
            ))}
            <WalletMenu />
          </div>
        ) : null}
      </header>
      {!contractsConfigured ? (
        <div className="mx-auto mt-4 max-w-6xl px-4">
          <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
            Contracts are not configured yet. You can explore the interface and sample events. Deploy to Avalanche Testnet before buying a ticket.
          </div>
        </div>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-xl font-bold">CheckIn</p>
            <p className="mt-2 text-sm text-muted">Blockchain-powered event ticketing and attendance verification built on Avalanche.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Explore</p>
            <div className="mt-2 grid gap-1 text-muted">
              <NavLink to="/events">Events</NavLink>
              <NavLink to="/create">Create Event</NavLink>
              <NavLink to="/checkin">Check In</NavLink>
              <NavLink to="/rewards">Rewards</NavLink>
            </div>
          </div>
          <div className="text-sm text-muted">
            <p className="font-semibold text-ink">Avalanche Testnet</p>
            <p className="mt-2">Testnet AVAX only — No real funds are required.</p>
            <p className="mt-2">CheckIn is an independent testnet MVP. Ticket ownership, check-in, attendance, and rewards are verified on the Avalanche C-Chain.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
