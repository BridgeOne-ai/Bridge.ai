// Per-day logs kept in chrome.storage for the dashboard. Counts, timing and kinds of info only: never
// text or values, and never sent anywhere.
import type { Site, Topic } from "../../core/src/types";
import { dayKey, shiftDay } from "../../core/src/time";
import type { Finding } from "./privacy/detect";

// Per local day, per hour ("0".."23"), per topic.
export type HourlyTopics = Record<string, Record<string, Partial<Record<Topic, number>>>>;
// Per local day, per site.
export type PerDaySite = Record<string, Partial<Record<Site, number>>>;
// Per local day, a list of events.
export type DayLog<T> = Record<string, T[]>;
// One privacy pause or safety-gate hold. approved: Child mode, sent after a parent entered the PIN.
export interface PrivacyEntry {
  hour: number; site: Site; what: "message" | "file"; findings: Finding[]; sent: boolean; hidden?: boolean; approved?: boolean;
}

// Keeps the last `keep` days of a per-day record (the dashboard shows at most 7).
export function pruneDays<T>(rec: Record<string, T>, now: number, keep = 14): Record<string, T> {
  const oldest = shiftDay(dayKey(now), keep - 1);
  return Object.fromEntries(Object.entries(rec).filter(([d]) => d >= oldest));
}
