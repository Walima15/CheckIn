import { ethers } from "ethers";

export const CATEGORIES = [
  "Technology",
  "Music",
  "Business",
  "Web3",
  "Education",
  "Community",
  "Sports",
  "Conferences",
] as const;

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function shortAddress(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTicketCode(id: bigint | number) {
  return `CHK-${id.toString().padStart(6, "0")}`;
}

export function formatAvax(wei: bigint, digits = 4) {
  const value = ethers.formatEther(wei);
  if (!value.includes(".")) return value;
  const [whole, fraction] = value.split(".");
  const trimmed = fraction.slice(0, digits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function formatDate(unix: bigint | number) {
  return new Date(Number(unix) * 1000).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(unix: bigint | number) {
  return new Date(Number(unix) * 1000).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(unix: bigint | number) {
  return `${formatDate(unix)} · ${formatTime(unix)}`;
}

export function percent(part: bigint, whole: bigint) {
  if (whole === 0n) return "0%";
  return `${(Number((part * 10000n) / whole) / 100).toFixed(1)}%`;
}

export type TicketStatus = "Valid" | "Checked In" | "Used";

export function ticketStatus(checkedIn: boolean, endTime: bigint): TicketStatus {
  if (!checkedIn) return "Valid";
  if (BigInt(Math.floor(Date.now() / 1000)) > endTime) return "Used";
  return "Checked In";
}

export function categoryGradient(category: string) {
  const map: Record<string, string> = {
    Technology: "from-sky-500 to-indigo-800",
    Music: "from-fuchsia-500 to-purple-900",
    Business: "from-amber-500 to-orange-800",
    Web3: "from-red-500 to-rose-950",
    Education: "from-emerald-500 to-teal-900",
    Community: "from-cyan-500 to-blue-900",
    Sports: "from-lime-500 to-green-900",
    Conferences: "from-orange-500 to-red-900",
  };
  return map[category] || "from-zinc-500 to-zinc-900";
}

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeInput(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
