// Typed helpers over chrome.storage.local. No key ever holds message text, and nothing here is ever
// sent anywhere: Bridge.ai has no server.
import type { Profile, ScoreResult, Site, TurnLabels } from "../../core/src/types";
import type { DayLog, HourlyTopics, PerDaySite, PrivacyEntry } from "./days";
import type { ModelStatus } from "./messages";
import type { PinAttempts, PinLock } from "./lock";
import type { Pause, PausePeriod } from "./pause";

// Parent mode: an adult tracks their own feelings. No message is blocked.
// Child mode: protection. Risky messages are held back; a parent can approve some with the PIN.
export type Mode = "parent" | "child";

export interface Settings {
  mode: Mode;
  nudgesEnabled: boolean;
}

// What the person agreed to on the setup screen (options.html). Bump CONSENT_VERSION when what
// Bridge.ai reads or keeps changes, so everyone is asked again (Chrome Web Store disclosure policy).
export const CONSENT_VERSION = 1;
export interface Consent { at: number; version: number; mode: Mode }

export interface Store {
  settings: Settings;
  // Setup finished. Until then nothing is read on any chat site.
  consent: Consent | null;
  profiles: Partial<Record<Site, Profile>>;
  state: Partial<Record<Site, ScoreResult & { updatedAt: number }>>;
  sessions: { current: Partial<Record<Site, { start: number; lastBeat: number }>> };
  nudges: { date: string; countToday: number; nudgedSessionStarts: number[] };
  debug: { recentLabels: { ts: number; site: Site; labels: TurnLabels }[] };
  // For the dashboard (days.ts). Topic labels and counts, never text.
  hourly: HourlyTopics;
  nudgeLog: PerDaySite;
  privacyFlags: DayLog<PrivacyEntry>;  // each privacy pause: kinds of info, never the values
  // Parent PIN (lock.ts). Its own keys, so saving settings never replaces them.
  lock: PinLock | null;
  pinAttempts: PinAttempts;
  modelStatus: ModelStatus;
  // Tracking paused (pause.ts): the active pause, and past ones so the dashboard can show the gap.
  pause: Pause | null;
  pauseLog: PausePeriod[];
}

export const DEFAULTS: Store = {
  // Child until someone chooses: installed on a child's browser and forgotten, protection is on.
  settings: { mode: "child", nudgesEnabled: true },
  consent: null,
  profiles: {},
  state: {},
  sessions: { current: {} },
  nudges: { date: "", countToday: 0, nudgedSessionStarts: [] },
  debug: { recentLabels: [] },
  hourly: {},
  nudgeLog: {},
  privacyFlags: {},
  lock: null,
  pinAttempts: { failures: 0, until: 0 },
  modelStatus: { state: "loading", progress: 0 },
  pause: null,
  pauseLog: [],
};

// Keys from versions that synced to a server (account, sync status, device id). Removed on update.
export const OLD_KEYS = ["auth", "syncStatus", "device"];

export async function get<K extends keyof Store>(key: K): Promise<Store[K]> {
  const got = (await chrome.storage.local.get(key))[key] as Store[K] | undefined;
  if (key === "settings") {
    // New fields get defaults, and fields from older versions (the sync's API URL, child id) are dropped.
    const s = { ...DEFAULTS.settings, ...(got as Partial<Settings> | undefined) };
    return { mode: s.mode, nudgesEnabled: s.nudgesEnabled } as Store[K];
  }
  return got ?? structuredClone(DEFAULTS[key]);
}

export async function set<K extends keyof Store>(key: K, value: Store[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// Feelings, levels and usage. Settings, setup and the PIN stay.
export async function resetData(): Promise<void> {
  await chrome.storage.local.remove(["profiles", "state", "sessions", "nudges", "debug", "hourly", "nudgeLog", "privacyFlags", "pauseLog"]);
}

export const hasConsent = (c: Consent | null): c is Consent => !!c && c.version === CONSENT_VERSION;
