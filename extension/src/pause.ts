// Pause: tracking stops for a while. While paused the service worker records nothing (no labels,
// feelings, time on AI, nudges or privacy log). Protections that record nothing keep working: the
// privacy guard, and the safety gate (which still holds messages back in Child mode).
// Starting a pause in Child mode needs the parent PIN; resuming never does (it only turns tracking back
// on). Past pauses are kept as periods, so the dashboard can show the gap instead of a silent stretch.
import { nextDay, startOfDay } from "../../core/src/time";
import * as store from "./storage";

export interface Pause { since: number; until: number | null } // until null: until someone resumes
export interface PausePeriod { start: number; end: number }

// Long enough for the dashboard's 7-day view.
const KEEP_MS = 14 * 24 * 60 * 60_000;

// The popup's choices (popup.html data-pause).
export type PauseChoice = "hour" | "tomorrow" | "resume";

export function pauseEnd(choice: PauseChoice, now: number): number | null {
  if (choice === "hour") return now + 60 * 60_000;
  if (choice === "tomorrow") return nextDay(startOfDay(now));
  return null;
}

export const isPaused = (p: Pause | null, now: number): p is Pause => !!p && (p.until === null || now < p.until);

// Moves a pause that has run out into the log, and drops periods too old to show.
export function settle(p: Pause | null, log: PausePeriod[], now: number): { pause: Pause | null; log: PausePeriod[] } {
  const keep = (periods: PausePeriod[]) => periods.filter((x) => x.end > now - KEEP_MS);
  if (p?.until == null || now < p.until) return { pause: p, log: keep(log) };
  return { pause: null, log: keep([...log, { start: p.since, end: p.until }]) };
}

// Paused time inside [from, to), the current pause included.
export function pausedMs(log: PausePeriod[], p: Pause | null, from: number, to: number): number {
  const periods = p ? [...log, { start: p.since, end: Math.min(p.until ?? to, to) }] : log;
  return periods.reduce((n, x) => n + Math.max(0, Math.min(x.end, to) - Math.max(x.start, from)), 0);
}

// ---- chrome.storage ----

// The active pause, or null. Settles an expired one on the way.
export async function current(now = Date.now()): Promise<Pause | null> {
  const [p, log] = await Promise.all([store.get("pause"), store.get("pauseLog")]);
  const s = settle(p, log, now);
  if (s.pause !== p) await Promise.all([store.set("pause", s.pause), store.set("pauseLog", s.log)]);
  return isPaused(s.pause, now) ? s.pause : null;
}

// Starting a pause in Child mode needs the parent PIN (when one is set), like leaving Child mode.
export async function needsPin(): Promise<boolean> {
  const [{ mode }, lock] = await Promise.all([store.get("settings"), store.get("lock")]);
  return mode === "child" && !!lock;
}

// Call after needsPin() is satisfied.
export async function start(choice: PauseChoice, now = Date.now()): Promise<void> {
  await resume(now);
  await store.set("pause", { since: now, until: pauseEnd(choice, now) });
}

export async function resume(now = Date.now()): Promise<void> {
  const p = await store.get("pause");
  if (!p) return;
  const log = await store.get("pauseLog");
  const end = Math.min(p.until ?? now, now);
  await store.set("pauseLog", end > p.since ? [...log, { start: p.since, end }] : log);
  await store.set("pause", null);
}
