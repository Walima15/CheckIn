import { ethers } from "ethers";
import type { ChainEvent } from "@/types";
import { formatAvax, toDateInput, toTimeInput } from "@/utils/format";

export type EventFormValues = {
  name: string;
  description: string;
  imageURI: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  location: string;
  category: string;
  price: string;
  maxSupply: string;
  bonusPoints: string;
  transfersAllowed: boolean;
  demo: boolean;
  active: boolean;
};

export function emptyEventForm(): EventFormValues {
  return {
    name: "",
    description: "",
    imageURI: "",
    date: "",
    startTime: "18:00",
    endTime: "21:00",
    venue: "",
    location: "",
    category: "Web3",
    price: "0.01",
    maxSupply: "100",
    bonusPoints: "0",
    transfersAllowed: true,
    demo: false,
    active: true,
  };
}

export function formFromEvent(event: ChainEvent): EventFormValues {
  const start = new Date(Number(event.startTime) * 1000);
  const end = new Date(Number(event.endTime) * 1000);
  return {
    name: event.name,
    description: event.description,
    imageURI: event.imageURI,
    date: toDateInput(start),
    startTime: toTimeInput(start),
    endTime: toTimeInput(end),
    venue: event.venue,
    location: event.location,
    category: event.category,
    price: formatAvax(event.priceWei, 6),
    maxSupply: event.maxSupply.toString(),
    bonusPoints: event.bonusPoints.toString(),
    transfersAllowed: event.transfersAllowed,
    demo: event.demo,
    active: event.active,
  };
}

export function validateEventForm(values: EventFormValues, sold = 0) {
  if (!values.name.trim() || values.name.trim().length > 100) return "Event name must be 1-100 characters.";
  if (/["\\]/.test(values.name) || /["\\]/.test(values.category)) {
    return "Remove quotes and backslashes from the name and category.";
  }
  if (values.description.trim().length > 1000) return "Description must be 1000 characters or less.";
  if (values.imageURI.trim().length > 500) return "Image URL must be 500 characters or less.";
  if (!values.venue.trim() || !values.location.trim()) return "Venue and location are required.";
  if (!values.category) return "Choose a category.";
  if (!values.date || !values.startTime || !values.endTime) return "Date, start time, and end time are required.";

  const supply = Number(values.maxSupply);
  if (!Number.isInteger(supply) || supply < 1 || supply > 100_000) return "Ticket supply must be a whole number from 1 to 100000.";
  if (supply < sold) return "Ticket supply cannot be lower than the number already sold.";

  const bonus = Number(values.bonusPoints || "0");
  if (!Number.isInteger(bonus) || bonus < 0 || bonus > 1000) return "Bonus points must be a whole number from 0 to 1000.";

  try {
    const price = ethers.parseEther(values.price.trim() || "0");
    if (price < 0n || price > ethers.parseEther("100")) return "Price must be between 0 and 100 testnet AVAX.";
  } catch {
    return "Enter a valid ticket price in testnet AVAX.";
  }

  try {
    toUnixRange(values.date, values.startTime, values.endTime);
  } catch (error) {
    return error instanceof Error ? error.message : "Enter a valid date and time.";
  }

  return null;
}

export function toUnixRange(date: string, startTime: string, endTime: string) {
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Enter a valid date and time.");
  }
  if (end <= start) throw new Error("End time must be after the start time on the same day.");
  return {
    startTime: BigInt(Math.floor(start.getTime() / 1000)),
    endTime: BigInt(Math.floor(end.getTime() / 1000)),
  };
}

export function toCreateInput(values: EventFormValues) {
  const range = toUnixRange(values.date, values.startTime, values.endTime);
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    imageURI: values.imageURI.trim(),
    startTime: range.startTime,
    endTime: range.endTime,
    venue: values.venue.trim(),
    location: values.location.trim(),
    category: values.category,
    priceWei: ethers.parseEther(values.price.trim() || "0"),
    maxSupply: BigInt(values.maxSupply),
    bonusPoints: BigInt(values.bonusPoints || "0"),
    transfersAllowed: values.transfersAllowed,
    demo: values.demo,
  };
}

export function toUpdateInput(values: EventFormValues) {
  const input = toCreateInput(values);
  return {
    name: input.name,
    description: input.description,
    imageURI: input.imageURI,
    startTime: input.startTime,
    endTime: input.endTime,
    venue: input.venue,
    location: input.location,
    category: input.category,
    priceWei: input.priceWei,
    maxSupply: input.maxSupply,
    bonusPoints: input.bonusPoints,
    active: values.active,
    transfersAllowed: input.transfersAllowed,
  };
}
