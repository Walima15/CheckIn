import raw from "../../data/demo-events.json";

export type DemoEvent = {
  name: string;
  description: string;
  imageURI: string;
  daysFromNow: number;
  durationHours: number;
  venue: string;
  location: string;
  category: string;
  priceAvax: string;
  maxSupply: number;
  bonusPoints: number;
  transfersAllowed: boolean;
};

export const demoEvents = raw as DemoEvent[];

export function demoWindow(item: DemoEvent) {
  const startMs = Date.now() + item.daysFromNow * 24 * 60 * 60 * 1000;
  const start = new Date(startMs);
  start.setHours(item.durationHours >= 6 ? 9 : 18, 0, 0, 0);
  const end = new Date(start.getTime() + item.durationHours * 60 * 60 * 1000);
  return { start, end };
}
