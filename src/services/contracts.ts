import { ethers } from "ethers";
import type { BrowserProvider, ContractRunner, EventLog, Log, TransactionReceipt } from "ethers";
import eventsAbi from "@/contracts/abi/CheckInEvents.json";
import ticketsAbi from "@/contracts/abi/CheckInTickets.json";
import rewardsAbi from "@/contracts/abi/CheckInRewards.json";
import { addresses, contractsConfigured, deployBlock } from "@/config/network";
import { fujiProvider } from "@/services/provider";
import type { ActivityItem, AttendeeRow, AttendanceProof, ChainEvent, RewardRecord, TicketRecord } from "@/types";

const eventsInterface = new ethers.Interface(eventsAbi);
const ticketsInterface = new ethers.Interface(ticketsAbi);

function asAbi(abi: unknown) {
  return abi as ethers.InterfaceAbi;
}

function eventLogs(logs: Array<Log | EventLog>) {
  return logs.filter((log): log is EventLog => "args" in log);
}

export function eventsContract(runner: ContractRunner = fujiProvider) {
  return new ethers.Contract(addresses.events, asAbi(eventsAbi), runner);
}

export function ticketsContract(runner: ContractRunner = fujiProvider) {
  return new ethers.Contract(addresses.tickets, asAbi(ticketsAbi), runner);
}

export function rewardsContract(runner: ContractRunner = fujiProvider) {
  return new ethers.Contract(addresses.rewards, asAbi(rewardsAbi), runner);
}

export async function getSignedContracts(provider: BrowserProvider) {
  const signer = await provider.getSigner();
  return {
    signer,
    events: eventsContract(signer),
    tickets: ticketsContract(signer),
    rewards: rewardsContract(signer),
  };
}

export function parseEvent(value: ethers.Result | Record<string, unknown>): ChainEvent {
  const event = value as Record<string, unknown>;
  return {
    id: BigInt(event.id as bigint),
    organizer: String(event.organizer),
    name: String(event.name),
    description: String(event.description),
    imageURI: String(event.imageURI),
    startTime: BigInt(event.startTime as bigint),
    endTime: BigInt(event.endTime as bigint),
    venue: String(event.venue),
    location: String(event.location),
    category: String(event.category),
    priceWei: BigInt(event.priceWei as bigint),
    maxSupply: BigInt(event.maxSupply as bigint),
    sold: BigInt(event.sold as bigint),
    checkedIn: BigInt(event.checkedIn as bigint),
    revenueWei: BigInt(event.revenueWei as bigint),
    bonusPoints: BigInt(event.bonusPoints as bigint),
    active: Boolean(event.active),
    transfersAllowed: Boolean(event.transfersAllowed),
    demo: Boolean(event.demo),
  };
}

export async function loadEvents() {
  if (!contractsConfigured) return [];
  const list = await eventsContract().getAllEvents();
  return (list as ethers.Result[]).map((item) => parseEvent(item));
}

export async function loadEvent(id: bigint) {
  return parseEvent(await eventsContract().eventInfo(id));
}

export async function loadTicket(ticketId: bigint): Promise<TicketRecord> {
  const result = await ticketsContract().getTicket(ticketId);
  const event = await loadEvent(BigInt(result.eventId));
  return {
    ticketId,
    eventId: BigInt(result.eventId),
    owner: String(result.owner),
    purchasedAt: BigInt(result.purchasedAt),
    checkedIn: Boolean(result.checkedIn),
    checkedInAt: BigInt(result.checkedInAt),
    event,
  };
}

export async function loadOwnedTickets(owner: string) {
  const ids = (await ticketsContract().ticketsOf(owner)) as bigint[];
  const tickets: TicketRecord[] = [];
  for (const id of ids) {
    tickets.push(await loadTicket(BigInt(id)));
  }
  return tickets.sort((a, b) => (a.ticketId < b.ticketId ? 1 : -1));
}

export async function loadAttendees(eventId: bigint): Promise<AttendeeRow[]> {
  const result = await ticketsContract().getEventAttendees(eventId);
  const rewards = rewardsContract();
  const rows: AttendeeRow[] = [];
  const ids = result.ids as bigint[];
  for (let i = 0; i < ids.length; i++) {
    const ticketId = BigInt(ids[i]);
    rows.push({
      ticketId,
      owner: String(result.owners[i]),
      purchasedAt: BigInt(result.purchasedAt[i]),
      checkedIn: Boolean(result.checkedIn[i]),
      checkedInAt: BigInt(result.checkedInAt[i]),
      bonusClaimed: Boolean(await rewards.bonusClaimed(ticketId)),
    });
  }
  return rows;
}

export async function loadRewardSummary(account: string) {
  const rewards = rewardsContract();
  const [points, checkInCount, history] = await Promise.all([
    rewards.points(account),
    rewards.checkInCount(account),
    rewards.getHistory(account),
  ]);
  const records: RewardRecord[] = (history as Array<Record<string, unknown>>).map((item) => ({
    eventId: BigInt(item.eventId as bigint),
    ticketId: BigInt(item.ticketId as bigint),
    points: BigInt(item.points as bigint),
    timestamp: BigInt(item.timestamp as bigint),
    reason: String(item.reason),
  }));

  const names = ["First Ticket", "First Check-in", "Regular", "Community", "Explorer", "Dedicated"];
  const unlocked = await Promise.all(names.map((name) => rewards.hasAchievement(account, name)));
  const achievements = names.filter((_, index) => Boolean(unlocked[index]));

  const proofs: AttendanceProof[] = [];
  for (const record of records) {
    if (record.reason !== "Successful check-in") continue;
    const proof = await rewards.getProof(record.ticketId);
    let eventName = `Event #${record.eventId}`;
    try {
      eventName = (await loadEvent(record.eventId)).name;
    } catch {
      // The event call can fail if the id is no longer readable.
    }
    proofs.push({
      eventId: BigInt(proof.eventId),
      ticketId: BigInt(proof.ticketId),
      attendee: String(proof.attendee),
      organizer: String(proof.organizer),
      timestamp: BigInt(proof.timestamp),
      valid: Boolean(proof.valid),
      eventName,
    });
  }

  return {
    points: BigInt(points),
    checkInCount: BigInt(checkInCount),
    history: records,
    achievements,
    proofs,
  };
}

export async function logStartBlock() {
  if (deployBlock > 0) return deployBlock;
  const latest = await fujiProvider.getBlockNumber();
  return Math.max(0, latest - 100_000);
}

export async function loadActivity(account: string): Promise<ActivityItem[]> {
  const start = await logStartBlock();
  const tickets = ticketsContract();
  const rewards = rewardsContract();
  const events = eventsContract();
  const [purchases, checkins, rewardLogs, created, received, sent] = await Promise.all([
    tickets.queryFilter(tickets.filters.TicketPurchased(null, null, account), start),
    tickets.queryFilter(tickets.filters.TicketCheckedIn(null, null, account), start),
    rewards.queryFilter(rewards.filters.RewardIssued(account), start),
    events.queryFilter(events.filters.EventCreated(null, account), start),
    tickets.queryFilter(tickets.filters.TicketTransferred(null, null, account), start),
    tickets.queryFilter(tickets.filters.TicketTransferred(null, account, null), start),
  ]);

  const items: ActivityItem[] = [
    ...eventLogs(purchases).map((log) => ({
      id: `${log.transactionHash}-buy-${log.index}`,
      kind: "Ticket purchase",
      title: "Ticket purchased",
      detail: `Ticket ${log.args.ticketId.toString()} · Event ${log.args.eventId.toString()}`,
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
    })),
    ...eventLogs(checkins).map((log) => ({
      id: `${log.transactionHash}-in-${log.index}`,
      kind: "Check-in",
      title: "Checked in",
      detail: `Ticket ${log.args.ticketId.toString()}`,
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
    })),
    ...eventLogs(rewardLogs).map((log) => ({
      id: `${log.transactionHash}-reward-${log.index}`,
      kind: "Reward",
      title: `${log.args.points.toString()} points`,
      detail: String(log.args.reason),
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
    })),
    ...eventLogs(created).map((log) => ({
      id: `${log.transactionHash}-event-${log.index}`,
      kind: "Create event",
      title: "Event created",
      detail: String(log.args.name),
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
    })),
    ...eventLogs(received).map((log) => ({
      id: `${log.transactionHash}-received-${log.index}`,
      kind: "Transfer",
      title: "Ticket received",
      detail: `Ticket ${log.args.ticketId.toString()}`,
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
    })),
    ...eventLogs(sent).map((log) => ({
      id: `${log.transactionHash}-out-${log.index}`,
      kind: "Transfer",
      title: "Ticket sent",
      detail: `Ticket ${log.args.ticketId.toString()}`,
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
    })),
  ];

  return items.sort((a, b) => b.blockNumber - a.blockNumber);
}

export async function loadOrganizerFeed(eventIds: bigint[]) {
  if (eventIds.length === 0) return [];
  const start = await logStartBlock();
  const tickets = ticketsContract();
  const logs = await tickets.queryFilter(tickets.filters.TicketPurchased(), start);
  const wanted = new Set(eventIds.map((id) => id.toString()));
  return eventLogs(logs)
    .filter((log) => wanted.has(log.args.eventId.toString()))
    .map((log) => ({
      id: `${log.transactionHash}-${log.index}`,
      kind: "Sale",
      title: `Ticket ${log.args.ticketId.toString()} sold`,
      detail: `${ethers.formatEther(log.args.priceWei)} AVAX · Event ${log.args.eventId.toString()}`,
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
    }))
    .sort((a, b) => b.blockNumber - a.blockNumber);
}

export async function findProofTx(account: string, ticketId: bigint) {
  const start = await logStartBlock();
  const rewards = rewardsContract();
  const logs = await rewards.queryFilter(rewards.filters.ProofOfAttendanceCreated(null, null, account), start);
  const match = eventLogs(logs).find((log) => BigInt(log.args.ticketId) === ticketId);
  return match?.transactionHash;
}

export function decodeTicketId(receipt: TransactionReceipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = ticketsInterface.parseLog(log);
      if (parsed?.name === "TicketPurchased") return BigInt(parsed.args.ticketId);
    } catch {
      // Ignore logs from other contracts.
    }
  }
  return null;
}

export function decodeEventId(receipt: TransactionReceipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = eventsInterface.parseLog(log);
      if (parsed?.name === "EventCreated") return BigInt(parsed.args.eventId);
    } catch {
      // Ignore logs from other contracts.
    }
  }
  return null;
}

export function ticketQrValue(ticketId: bigint) {
  return JSON.stringify({
    v: 1,
    network: "avalanche-testnet",
    chainId: 43113,
    tickets: addresses.tickets,
    ticketId: ticketId.toString(),
  });
}

export function parseTicketQr(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "Enter a ticket ID or scan a QR code." };

  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as { chainId?: number; tickets?: string; ticketId?: string };
      if (data.chainId !== 43113) return { error: "This QR code is not for Avalanche Testnet." };
      if (!data.tickets || data.tickets.toLowerCase() !== addresses.tickets.toLowerCase()) {
        return { error: "This QR code belongs to a different ticket contract." };
      }
      return { ticketId: BigInt(data.ticketId || "0") };
    } catch {
      return { error: "This QR code could not be read." };
    }
  }

  const match = trimmed.match(/(\d+)/);
  if (!match) return { error: "Unrecognized ticket code." };
  const ticketId = BigInt(match[1]);
  if (ticketId <= 0n) return { error: "Unrecognized ticket code." };
  return { ticketId };
}
