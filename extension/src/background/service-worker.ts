import { Mutex } from "async-mutex";
import { core } from "@bridge/core";
import { LEVELS, type Level, type Site, type Turn, type TurnLabels } from "../../../core/src/types";
import { dayKey, isLateNight } from "../../../core/src/time";
import { addActiveMinutes, startSession } from "../../../core/src/profile";
import { checkSafety } from "../../../core/src/safety";
import { decide, type GateDecision } from "../policy";
import type { ModelReply, ModelRequest, ToContent, ToOffscreen, ToWorker } from "../messages";
import * as store from "../storage";
import * as pause from "../pause";
import { pruneDays } from "../days";
import NUDGES from "../ui/nudges.json";
import type { Finding } from "../privacy/detect";
import type { PauseOutcome } from "../ui/privacy";

const PENDING_MS = 60_000;
const SESSION_IDLE_MS = 10 * 60_000;
const LATE_NIGHT_MIN_MS = 60 * 60_000;
const NUDGES_PER_DAY = 3;
// Heartbeats come every 30 s while the user is active. A longer gap (laptop asleep, tab in the
// background) is not counted as time on AI.
const MAX_BEAT_GAP_MS = 2 * 60_000;
// The user is waiting on Send, so the safety gate gives the model less time than labeling.
const SAFETY_TIMEOUT_MS = 5_000;
const LABEL_TIMEOUT_MS = 30_000;

// Text lives only here, in memory, until the turn is labeled.
const pending = new Map<string, { user: Turn; tabId?: number; timer: ReturnType<typeof setTimeout> }>();

// Every read-change-write of chrome.storage runs under this lock. Heartbeats, turns and the
// session alarm otherwise interleave across awaits and overwrite each other's updates.
// Entry points take the lock; the helpers they call assume it is held (never lock twice).
const storageLock = new Mutex();
const locked = <T>(fn: () => Promise<T>) => storageLock.runExclusive(fn);

// Created on every worker start, not only onInstalled: alarms added in an update don't exist otherwise.
// Chrome rejects with "No SW" if the extension is reloaded mid-startup; the next start retries.
void chrome.alarms.get("sessions").then((a) => a ?? chrome.alarms.create("sessions", { periodInMinutes: 1 })).catch(() => {});
// From versions that synced to a server: their alarm and their account, sync status and device id.
void chrome.alarms.clear("sync").catch(() => {});
void chrome.storage.local.remove(store.OLD_KEYS).catch(() => {});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "sessions") void locked(async () => { await closeIdleSessions(Date.now()); await pause.current(); });
});

// First install opens the Options page: setup (consent, Parent or Child mode) comes before anything is read.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) void chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg: ToWorker, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (msg.type === "turn") void onTurn(msg.turn, tabId);
  if (msg.type === "heartbeat") void locked(() => onHeartbeat(msg.site, msg.ts, msg.interacting, tabId));
  if (msg.type === "privacy-pause") void locked(() => onPrivacyPause(msg.site, msg.what, msg.findings, msg.outcome));
  if (msg.type === "model-status") void store.set("modelStatus", msg.status);
  // RPC: the content script waits for this answer before the message may reach the chatbot.
  if (msg.type === "safety-check") {
    void safetyCheck(msg.site, msg.text).then(sendResponse);
    return true; // keeps the channel open for the async sendResponse
  }
  if (msg.type === "parent-approval") {
    void askParent(msg.site, msg.what, msg.findings).then(sendResponse);
    return true;
  }
  if (msg.type === "approval-details") {
    sendResponse(approvals.get(msg.id)?.details ?? null);
    return false;
  }
  // Only the approval window may answer (not a content script on a chat page).
  if (msg.type === "approval-result" && sender.url?.startsWith(chrome.runtime.getURL("approve.html"))) {
    answerApproval(msg.id, msg.approved);
  }
  return false;
});

// ---- on-device model (model/worker.ts, hosted by the offscreen document) ----

let creating: Promise<void> | undefined;
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  if (contexts.length) return;
  // Two callers at once would both try to create it, and Chrome allows only one.
  creating ??= chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: "Runs Bridge.ai's on-device text model in a Web Worker, so messages never leave the computer.",
  }).finally(() => { creating = undefined; });
  await creating;
}

// null when the model isn't ready (first download still running), fails, or takes too long: callers
// then use the phrase rules, which always work.
async function askModel<K extends ModelRequest["kind"]>(req: Extract<ModelRequest, { kind: K }>, timeoutMs: number): Promise<ModelReply<K>> {
  try {
    await ensureOffscreen();
    const msg: ToOffscreen = { target: "model", req };
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), timeoutMs));
    return ((await Promise.race([chrome.runtime.sendMessage(msg), timeout])) ?? null) as ModelReply<K>;
  } catch (e) {
    console.warn(`[Bridge.ai] model unavailable: ${String(e)}`);
    return null;
  }
}

// Starts the model (and its one-time download) as soon as the extension runs, not on the first message.
void askModel({ kind: "warmup" }, 1_000);

// ---- mode (Parent or Child, see storage.ts) ----

// "II" on the toolbar icon while tracking is paused, and a "!" until setup is finished.
async function showBadge() {
  const [{ mode }, consent, paused] = await Promise.all([store.get("settings"), store.get("consent"), store.get("pause")]);
  if (pause.isPaused(paused, Date.now())) {
    const until = paused.until === null ? "until resumed" : `until ${new Date(paused.until).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
    await chrome.action.setBadgeText({ text: "II" });
    await chrome.action.setBadgeBackgroundColor({ color: "#5f6368" });
    await chrome.action.setTitle({ title: `Bridge.ai: tracking paused ${until}` });
    return;
  }
  const ready = store.hasConsent(consent);
  await chrome.action.setBadgeText({ text: ready ? "" : "!" });
  await chrome.action.setBadgeBackgroundColor({ color: "#c05621" });
  await chrome.action.setTitle({ title: ready ? `Bridge.ai (${mode} mode)` : "Bridge.ai: finish setup to turn it on" });
}
void showBadge();
chrome.storage.onChanged.addListener((changes) => { if (changes.consent || changes.settings || changes.pause) void showBadge(); });

// Nothing is recorded before setup is finished (consent), or while paused (pause.ts). Content scripts
// don't read anything before consent either; this is the second check.
const paused = async () => {
  const [consent, p] = await Promise.all([store.get("consent"), store.get("pause")]);
  return !store.hasConsent(consent) || pause.isPaused(p, Date.now());
};

// ---- safety gate (core/src/safety.ts) ----

// What each mode does with the verdict is in policy.ts.
async function safetyCheck(site: Site, text: string): Promise<GateDecision> {
  const [settings, fromModel] = await Promise.all([store.get("settings"), askModel({ kind: "safety", site, text }, SAFETY_TIMEOUT_MS)]);
  const verdict = fromModel ?? (await checkSafety(text, { site }));
  // Categories and score only, never the text.
  console.info(`[Bridge.ai] safety gate on ${site} (${settings.mode} mode): ${verdict.block ? "unsafe" : "ok"} score=${verdict.score.toFixed(2)} via ${verdict.source}`, verdict.categories);
  return decide(verdict, settings.mode);
}

function send(tabId: number | undefined, msg: ToContent) {
  if (tabId !== undefined) chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

// ---- turns ----

// Pair by tab, not conversationId: in a new Gemini chat the user turn has id "new" and the
// reply has the real /app/<id>, because the URL changes after sending.
const pairKey = (turn: Turn, tabId?: number) => (tabId !== undefined ? `tab:${tabId}` : `conv:${turn.conversationId}`);

async function onTurn(turn: Turn, tabId?: number) {
  if (await paused()) return;
  const key = pairKey(turn, tabId);
  if (turn.role === "user") {
    const prev = pending.get(key);
    if (prev) { clearTimeout(prev.timer); void processTurn(prev.user, null, prev.tabId); }
    const timer = setTimeout(() => {
      const p = pending.get(key);
      pending.delete(key);
      if (p) void processTurn(p.user, null, p.tabId);
    }, PENDING_MS);
    pending.set(key, { user: turn, tabId, timer });
    return;
  }
  const p = pending.get(key);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(key);
  await processTurn(p.user, turn, p.tabId);
}

async function processTurn(user: Turn, bot: Turn | null, tabId: number | undefined) {
  // Label outside the lock: the model can take a moment and must not stall heartbeats.
  const labels = (await askModel({ kind: "label", user, bot }, LABEL_TIMEOUT_MS)) ?? (await core.labelTurn(user, bot));
  // Labels only, never the text (open the service worker's DevTools from chrome://extensions to see these).
  console.info(`[Bridge.ai] labeled ${user.site} turn via ${labels.source}:`, labels);
  if (labels.crisis) console.warn(`[Bridge.ai] crisis signal on ${user.site} (never synced as text)`);
  await locked(() => recordTurn(user, labels, tabId));
}

async function recordTurn(user: Turn, labels: TurnLabels, tabId: number | undefined) {
  if (await paused()) return; // paused while this turn was being labeled
  const site = user.site;
  const profiles = await store.get("profiles");
  profiles[site] = core.updateProfile(profiles[site] ?? core.emptyProfile(site), labels, user.ts);
  const result = core.scoreProfile(profiles[site]!, Date.now(), Object.values(profiles));
  const state = await store.get("state");
  const previous = state[site]?.level ?? "healthy";
  state[site] = { ...result, updatedAt: Date.now() };
  console.info(`[Bridge.ai] ${site} level ${previous} -> ${result.level} (score ${result.score.toFixed(1)})`, result.reasons);
  await store.set("profiles", profiles);
  await store.set("state", state);

  const debug = await store.get("debug");
  debug.recentLabels = [{ ts: user.ts, site, labels }, ...debug.recentLabels].slice(0, 20);
  await store.set("debug", debug);

  // Hourly topic counts for the parent dashboard. A turn with abuse-at-home signals adds no topics:
  // its topics are part of an excluded disclosure (privacy rule 1).
  if (!labels.abuseAtHome && labels.topics.length) {
    const hourly = pruneDays(await store.get("hourly"), user.ts);
    const hour = ((hourly[dayKey(user.ts)] ??= {})[new Date(user.ts).getHours()] ??= {});
    for (const t of labels.topics) hour[t] = (hour[t] ?? 0) + 1;
    await store.set("hourly", hourly);
  }

  if (LEVELS.indexOf(result.level) > LEVELS.indexOf(previous) && (result.level === "watch" || result.level === "concerning")) {
    await maybeNudge(site, tabId, result.level);
  }
}

// ---- sessions ----

async function onHeartbeat(site: Site, ts: number, interacting: boolean, tabId?: number) {
  await closeIdleSessions(ts);
  if (!interacting || (await paused())) return;
  const [sessions, profiles] = await Promise.all([store.get("sessions"), store.get("profiles")]);
  let profile = profiles[site] ?? core.emptyProfile(site);
  let cur = sessions.current[site];
  if (!cur) {
    // Counted when it opens (not when it closes), so the dashboard is current during a session.
    cur = { start: ts, lastBeat: ts };
    profile = startSession(profile, ts);
  } else {
    const gap = ts - cur.lastBeat;
    if (gap > 0 && gap <= MAX_BEAT_GAP_MS) profile = addActiveMinutes(profile, ts, gap / 60_000);
    cur.lastBeat = ts;
  }
  sessions.current[site] = cur;
  profiles[site] = profile;
  await Promise.all([store.set("sessions", sessions), store.set("profiles", profiles)]);

  if (isLateNight(cur.start) && ts - cur.start >= LATE_NIGHT_MIN_MS) {
    const level = (await store.get("state"))[site]?.level ?? "healthy";
    await maybeNudge(site, tabId, level);
  }
}

async function closeIdleSessions(now: number) {
  const sessions = await store.get("sessions");
  const closed = (Object.keys(sessions.current) as Site[]).filter((s) => now - sessions.current[s]!.lastBeat > SESSION_IDLE_MS);
  if (!closed.length) return;
  const profiles = await store.get("profiles");
  const state = await store.get("state");
  // Minutes and the session itself were already counted live (onHeartbeat); just end it.
  for (const site of closed) {
    delete sessions.current[site];
    profiles[site] ??= core.emptyProfile(site);
    state[site] = { ...core.scoreProfile(profiles[site]!, now, Object.values(profiles)), updatedAt: now };
  }
  await store.set("sessions", sessions);
  await store.set("profiles", profiles);
  await store.set("state", state);
}

// ---- nudges ----

async function maybeNudge(site: Site, tabId: number | undefined, level: Level) {
  const settings = await store.get("settings");
  if (!settings.nudgesEnabled || level === "crisis") return;
  const sessionStart = (await store.get("sessions")).current[site]?.start;
  const nudges = await store.get("nudges");
  const today = dayKey(Date.now());
  if (nudges.date !== today) Object.assign(nudges, { date: today, countToday: 0, nudgedSessionStarts: [] });
  if (sessionStart !== undefined && nudges.nudgedSessionStarts.includes(sessionStart)) return;
  if (nudges.countToday >= NUDGES_PER_DAY) return;

  const variant = nudges.countToday % NUDGES.length;
  nudges.countToday += 1;
  if (sessionStart !== undefined) nudges.nudgedSessionStarts.push(sessionStart);
  await store.set("nudges", nudges);
  const log = pruneDays(await store.get("nudgeLog"), Date.now());
  (log[today] ??= {})[site] = (log[today]?.[site] ?? 0) + 1;
  await store.set("nudgeLog", log);
  send(tabId, { type: "show-nudge", variant });
}

// ---- privacy guard (privacy/guard.ts) ----

const OUTCOME_LOG: Record<PauseOutcome, string> = { held: "held back", hidden: "sent with details hidden", sent: "sent anyway" };

async function onPrivacyPause(site: Site, what: "message" | "file", findings: Finding[], outcome: PauseOutcome) {
  if (await paused()) return;
  const { mode } = await store.get("settings");
  // In Child mode, anything sent as typed was approved by a parent with the PIN.
  const approved = mode === "child" && outcome === "sent";
  console.info(`[Bridge.ai] privacy pause on ${site}: ${what} with [${findings}], ${approved ? "sent after a parent approved" : OUTCOME_LOG[outcome]}`);
  const now = Date.now();
  const log = pruneDays(await store.get("privacyFlags"), now);
  (log[dayKey(now)] ??= []).push({
    hour: new Date(now).getHours(), site, what, findings, sent: outcome === "sent", hidden: outcome === "hidden", ...(approved && { approved }),
  });
  await store.set("privacyFlags", log);
}

// ---- parent approval (Child mode): "Ask a parent to send" ----

// The PIN is typed in Bridge.ai's own window (approve.html), never on the chat page, where the site's
// scripts could read the keys. One request at a time; a new one replaces the old.
const APPROVAL_TIMEOUT_MS = 3 * 60_000;
let nextApproval = 1;
const approvals = new Map<number, {
  details: { site: Site; what: "message" | "file"; findings: Finding[] };
  resolve: (ok: boolean) => void;
  windowId?: number;
}>();

function answerApproval(id: number, approved: boolean) {
  const a = approvals.get(id);
  if (!a) return;
  approvals.delete(id);
  a.resolve(approved);
  if (a.windowId !== undefined) void chrome.windows.remove(a.windowId).catch(() => {});
}

async function askParent(site: Site, what: "message" | "file", findings: Finding[]): Promise<boolean> {
  if ((await store.get("settings")).mode !== "child") return false; // only Child mode asks a parent
  for (const id of [...approvals.keys()]) answerApproval(id, false);
  const id = nextApproval++;
  const answer = new Promise<boolean>((resolve) => approvals.set(id, { details: { site, what, findings }, resolve }));
  try {
    const win = await chrome.windows.create({ url: `approve.html?id=${id}`, type: "popup", width: 460, height: 440, focused: true });
    const a = approvals.get(id);
    if (a) a.windowId = win.id;
  } catch {
    answerApproval(id, false);
  }
  setTimeout(() => answerApproval(id, false), APPROVAL_TIMEOUT_MS);
  return answer;
}

// Closing the window is a "no".
chrome.windows.onRemoved.addListener((windowId) => {
  for (const [id, a] of approvals) if (a.windowId === windowId) answerApproval(id, false);
});
