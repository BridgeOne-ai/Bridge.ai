// Typed helpers over chrome.storage.local. No key ever holds message text.
import type { Profile, ScoreResult, Site, TurnLabels } from "../../core/src/types";
import type { DayLog, HourlyTopics, PerDaySite, PrivacyEntry } from "./sync/aggregate";
import type { ModelStatus } from "./messages";
import type { PinAttempts, PinLock } from "./lock";

// Parent mode: an adult tracks their own feelings. Nothing is synced and no message is blocked.
// Child mode: messages that look dangerous are held back and the week syncs to the parent dashboard.
export type Mode = "parent" | "child";

export interface Settings {
  mode: Mode;
  nudgesEnabled: boolean;
  privacyStrict: boolean; // child mode: personal info can't be sent at all (no "send anyway")
  apiUrl: string;         // child mode: sync API (api/main.py)
  childId: string;        // child mode: which child the remote dashboard shows, within the account
}

export interface Store {
  settings: Settings;
  profiles: Partial<Record<Site, Profile>>;
  state: Partial<Record<Site, ScoreResult & { updatedAt: number }>>;
  sessions: { current: Partial<Record<Site, { start: number; lastBeat: number }>> };
  nudges: { date: string; countToday: number; nudgedSessionStarts: number[] };
  debug: { recentLabels: { ts: number; site: Site; labels: TurnLabels }[] };
  // Aggregates kept only for sync (sync/aggregate.ts). Topic labels and counts, never text.
  hourly: HourlyTopics;
  nudgeLog: PerDaySite;
  privacyFlags: DayLog<PrivacyEntry>;  // each privacy pause: kinds of info, never the values
  // Random id for this browser install. Several devices can share one childId; the API adds them up.
  device: { id: string } | null;
  // Bridge.ai account this browser syncs to in Child mode (api/auth.py).
  auth: { token: string; email: string } | null;
  syncStatus: { at: number; ok: boolean; message: string } | null;
  // Parent PIN (lock.ts). Its own keys, so saving settings never replaces them.
  lock: PinLock | null;
  pinAttempts: PinAttempts;
  modelStatus: ModelStatus;
}

export const DEFAULTS: Store = {
  settings: {
    // Child until someone chooses: installed on a child's browser and forgotten, protection is on.
    mode: "child", nudgesEnabled: true, privacyStrict: false,
    apiUrl: "http://localhost:8000", childId: "demo",
  },
  profiles: {},
  state: {},
  sessions: { current: {} },
  nudges: { date: "", countToday: 0, nudgedSessionStarts: [] },
  debug: { recentLabels: [] },
  hourly: {},
  nudgeLog: {},
  privacyFlags: {},
  device: null,
  auth: null,
  syncStatus: null,
  lock: null,
  pinAttempts: { failures: 0, until: 0 },
  modelStatus: { state: "loading", progress: 0 },
};

export async function get<K extends keyof Store>(key: K): Promise<Store[K]> {
  const got = (await chrome.storage.local.get(key))[key] as Store[K] | undefined;
  if (key === "settings") return { ...DEFAULTS.settings, ...(got as Settings | undefined) } as Store[K]; // new fields get defaults
  return got ?? structuredClone(DEFAULTS[key]);
}

export async function set<K extends keyof Store>(key: K, value: Store[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// Feelings, levels and usage. The account, settings and PIN stay.
export async function resetData(): Promise<void> {
  await chrome.storage.local.remove(["profiles", "state", "sessions", "nudges", "debug", "hourly", "nudgeLog", "privacyFlags", "syncStatus"]);
}

// Creates this install's device id on first use.
export async function deviceId(): Promise<string> {
  const device = await get("device");
  if (device) return device.id;
  const id = crypto.randomUUID();
  await set("device", { id });
  return id;
}
