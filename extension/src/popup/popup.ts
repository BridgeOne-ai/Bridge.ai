// Toolbar popup: the Parent/Child switch (mode.ts), pausing, then Parent mode's feelings over the last 7
// days as 5-step meters, or Child mode's protection summary for today. Labels and counts only, never text.
import type { Topic } from "../../../core/src/types";
import * as store from "../storage";
import type { Mode } from "../storage";
import * as mode from "../mode";
import * as pause from "../pause";
import type { PrivacyEntry } from "../days";
import { dayKey, shiftDay } from "../../../core/src/time";
import { TOPIC_LABEL, feelingGroup } from "../ui/topics";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SEGMENTS = 5;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// One feeling: name and count, and one segment per mention (all five lit at 5 or more).
function meter(t: Topic, count: number, when: string) {
  const row = el("div", `row ${feelingGroup(t)}`);
  const top = el("div", "top");
  top.append(el("span", undefined, TOPIC_LABEL[t]), el("span", "n", `×${count}`));
  const bar = el("div", "bar");
  const on = Math.min(count, SEGMENTS);
  for (let i = 0; i < SEGMENTS; i++) bar.append(el("i", i < on ? "on" : undefined));
  row.setAttribute("aria-label", `${TOPIC_LABEL[t]}: ${count} ${when}`);
  row.append(top, bar);
  return row;
}

// Child mode: what was held back today. Counts only, so a parent opening the popup learns nothing more
// than the dashboard would show them.
function protectionToday(flags: PrivacyEntry[]): HTMLElement[] {
  const n = (f: (e: PrivacyEntry) => boolean) => flags.filter(f).length;
  const gate = (e: PrivacyEntry) => e.findings.includes("unsafe") || e.findings.includes("ai_relationship");
  const rows: [string, number][] = [
    ["Held back as unsafe or a chatbot relationship", n((e) => gate(e) && !e.sent)],
    ["Personal info paused", n((e) => !gate(e))],
    ["Sent with the details removed", n((e) => !!e.hidden)],
    ["Sent after a parent approved", n((e) => !!e.approved)],
  ];
  return rows.map(([label, count]) => {
    const row = el("div", "row other");
    const top = el("div", "top");
    top.append(el("span", undefined, label), el("span", "n", String(count)));
    row.append(top);
    return row;
  });
}

async function render() {
  const [settings, profiles, model, paused, consent, privacyFlags] = await Promise.all([
    store.get("settings"), store.get("profiles"), store.get("modelStatus"), pause.current(), store.get("consent"), store.get("privacyFlags"),
  ]);
  const child = settings.mode === "child";
  // Before setup only the way to finish it is shown: Bridge.ai isn't doing anything yet.
  const ready = store.hasConsent(consent);
  $("setup").hidden = ready;
  $("ready").hidden = !ready;
  if (!ready) return;
  $("mode-parent").setAttribute("aria-checked", String(!child));
  $("mode-child").setAttribute("aria-checked", String(child));

  $("paused").hidden = !paused;
  $("pause-open").hidden = !!paused || !$("pause-menu").hidden;
  if (paused) {
    $("paused-title").textContent = paused.until === null
      ? "Tracking paused"
      : `Tracking paused until ${new Date(paused.until).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
    $("paused-note").textContent = child
      ? "Feelings and time aren't recorded. Unsafe messages are still held back."
      : "Feelings and time aren't recorded. Privacy checks still run.";
  }

  const today = dayKey(Date.now());
  if (child) {
    $("title").textContent = "Protection today";
    $("feelings").replaceChildren(...protectionToday(privacyFlags[today] ?? []));
    $("note").textContent = "Nothing you write leaves this computer. A parent sees only what was held back, never your words.";
  } else {
    const from = shiftDay(today, 6);
    const counts = new Map<Topic, number>();
    for (const p of Object.values(profiles)) {
      for (const day of p?.days.filter((d) => d.date >= from && d.date <= today) ?? []) {
        for (const [t, n] of Object.entries(day.topicCounts) as [Topic, number][]) counts.set(t, (counts.get(t) ?? 0) + n);
      }
    }
    const sorted = [...counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    $("title").textContent = "Your feelings this week";
    $("feelings").replaceChildren(...sorted.map(([t, n]) => meter(t, n, "this week")));
    if (!sorted.length) $("feelings").append(el("div", "empty", "Nothing picked up this week yet."));
    $("note").textContent = "This stays on this computer. Nothing is shared.";
  }

  $("model").hidden = model.state === "ready";
  $("model").textContent = model.state === "loading"
    ? `Setting up the on-device model (one-time download)… ${model.progress}%`
    : model.state === "error" ? "The on-device model couldn't load, so only the built-in phrase checks are running." : "";

  $("dashboard").textContent = child ? "Parent dashboard" : "My dashboard";
  $("reset").hidden = child;
}

// ---- switching modes ----

// What the PIN form is for: leaving or entering Child mode, or starting a pause in Child mode.
let pending: { need: "new-pin" | "pin"; then: () => Promise<void> } | null = null;

function showPinForm(p: typeof pending) {
  pending = p;
  $("pin").hidden = !p;
  $("pin-error").textContent = "";
  $<HTMLInputElement>("pin-1").value = "";
  $<HTMLInputElement>("pin-2").value = "";
  if (!p) return;
  $("pin-2").hidden = p.need !== "new-pin";
  $("pin-label").textContent = p.need === "new-pin"
    ? "Choose a parent PIN (at least 4 digits). It's needed to leave Child mode."
    : "Parent PIN";
  $("pin-1").focus();
}

async function choose(to: Mode) {
  const need = await mode.needs(to);
  if (need === "nothing") {
    showPinForm(null);
    await mode.switchTo(to);
  } else {
    showPinForm({ need, then: () => mode.switchTo(to) });
  }
}
$("mode-parent").addEventListener("click", () => void choose("parent"));
$("mode-child").addEventListener("click", () => void choose("child"));
$("pin-cancel").addEventListener("click", () => showPinForm(null));

$("pin").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pending) return;
  const pin = $<HTMLInputElement>("pin-1").value;
  const result = pending.need === "new-pin" ? await mode.setPin(pin, $<HTMLInputElement>("pin-2").value) : await mode.unlock(pin);
  if (!result.ok) {
    $("pin-error").textContent = result.message;
    return;
  }
  const { then } = pending;
  showPinForm(null);
  await then();
});

// ---- pausing ----

function showPauseMenu(open: boolean) {
  $("pause-menu").hidden = !open;
  $("pause-open").hidden = open;
}
$("pause-open").addEventListener("click", () => { showPinForm(null); showPauseMenu(true); });
$("pause-cancel").addEventListener("click", () => showPauseMenu(false));
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-pause]")) {
  b.addEventListener("click", async () => {
    const choice = b.dataset.pause as pause.PauseChoice;
    showPauseMenu(false);
    if (await pause.needsPin()) showPinForm({ need: "pin", then: () => pause.start(choice) });
    else await pause.start(choice);
  });
}
$("resume").addEventListener("click", () => void pause.resume());

// ---- buttons ----

// The dashboard page reads this browser's data directly; in Child mode it asks for the PIN.
$("dashboard").addEventListener("click", () => void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") }));

$("finish-setup").addEventListener("click", () => void chrome.runtime.openOptionsPage());

$("reset").addEventListener("click", async () => {
  if (!confirm("Delete this browser's Bridge.ai data (feelings, levels, usage)? Your settings stay.")) return;
  await store.resetData();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.profiles || changes.settings || changes.modelStatus || changes.pause || changes.consent || changes.privacyFlags) void render();
});
void render();
