export type ChainEvent = {
  id: bigint;
  organizer: string;
  name: string;
  description: string;
  imageURI: string;
  startTime: bigint;
  endTime: bigint;
  venue: string;
  location: string;
  category: string;
  priceWei: bigint;
  maxSupply: bigint;
  sold: bigint;
  checkedIn: bigint;
  revenueWei: bigint;
  bonusPoints: bigint;
  active: boolean;
  transfersAllowed: boolean;
  demo: boolean;
};

export type TicketRecord = {
  ticketId: bigint;
  eventId: bigint;
  owner: string;
  purchasedAt: bigint;
  checkedIn: boolean;
  checkedInAt: bigint;
  event: ChainEvent;
};

export type RewardRecord = {
  eventId: bigint;
  ticketId: bigint;
  points: bigint;
  timestamp: bigint;
  reason: string;
};

export type AttendanceProof = {
  eventId: bigint;
  ticketId: bigint;
  attendee: string;
  organizer: string;
  timestamp: bigint;
  valid: boolean;
  txHash?: string;
  eventName?: string;
};

export type ActivityItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  hash: string;
  blockNumber: number;
};

export type AttendeeRow = {
  ticketId: bigint;
  owner: string;
  purchasedAt: bigint;
  checkedIn: boolean;
  checkedInAt: bigint;
  bonusClaimed: boolean;
};
