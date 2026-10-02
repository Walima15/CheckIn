import { ethers } from "ethers";
import eventsAbi from "@/contracts/abi/CheckInEvents.json";
import ticketsAbi from "@/contracts/abi/CheckInTickets.json";
import rewardsAbi from "@/contracts/abi/CheckInRewards.json";

const interfaces = [eventsAbi, ticketsAbi, rewardsAbi].map((abi) => new ethers.Interface(abi));

const friendly: Record<string, string> = {
  SoldOut: "This event is sold out.",
  IncorrectPayment: "The AVAX amount does not match the ticket price.",
  AlreadyCheckedIn: "This ticket has already been checked in.",
  NotOrganizer: "Only the event organizer can do that.",
  TransfersDisabled: "This event does not allow ticket transfers.",
  Inactive: "This event is not active.",
  NotFound: "That record was not found on Avalanche.",
  TicketNotFound: "That ticket was not found.",
  NotCheckedIn: "Check the attendee in before issuing a bonus.",
  BonusAlreadyIssued: "An extra bonus was already issued for this ticket.",
  InvalidInput: "Some of the event details are not valid.",
  SupplyTooLow: "Ticket supply cannot be lower than the number already sold.",
  PaymentFailed: "The organizer wallet could not receive the ticket payment.",
  InvalidBonus: "Extra bonus points must be between 1 and 100.",
  NotTickets: "That action is restricted to the ticket contract.",
  AlreadyRecorded: "Attendance was already recorded for this ticket.",
};

function errorData(err: unknown) {
  const value = err as {
    data?: unknown;
    error?: { data?: unknown };
    info?: { error?: { data?: unknown } };
  };
  const data = value.data ?? value.error?.data ?? value.info?.error?.data;
  return typeof data === "string" ? data : null;
}

export function parseTxError(err: unknown) {
  const value = err as { code?: number | string; shortMessage?: string; reason?: string; message?: string };
  if (value.code === 4001 || value.code === "ACTION_REJECTED") {
    return "You rejected the transaction in your wallet.";
  }

  const data = errorData(err);
  if (data) {
    for (const iface of interfaces) {
      try {
        const parsed = iface.parseError(data);
        if (parsed) return friendly[parsed.name] || parsed.name;
      } catch {
        // This ABI does not own the error.
      }
    }
  }

  const message = value.shortMessage || value.reason || value.message || "Transaction failed.";
  if (/user rejected|denied transaction/i.test(message)) return "You rejected the transaction in your wallet.";
  if (/insufficient funds/i.test(message)) return "Not enough testnet AVAX to cover the ticket and network fee.";
  return message;
}
