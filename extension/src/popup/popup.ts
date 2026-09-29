// Toolbar popup: the Parent/Child switch (mode.ts), then feelings as 5-step meters. Parent mode shows the
// last 7 days; Child mode shows today, plus Sync now. Labels only, never text.
import type { Topic } from "../../../core/src/types";
import * as store from "../storage";
import type { Mode } from "../storage";
import * as mode from "../mode";
import type { ToWorker } from "../messages";
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

async function render() {
  const [settings, profiles, model] = await Promise.all([store.get("settings"), store.get("profiles"), store.get("modelStatus")]);
  const child = settings.mode === "child";
  $("mode-parent").setAttribute("aria-checked", String(!child));
  $("mode-child").setAttribute("aria-checked", String(child));

  const today = dayKey(Date.now());
  const from = child ? today : shiftDay(today, 6);
  const counts = new Map<Topic, number>();
  for (const p of Object.values(profiles)) {
    for (const day of p?.days.filter((d) => d.date >= from && d.date <= today) ?? []) {
      for (const [t, n] of Object.entries(day.topicCounts) as [Topic, number][]) counts.set(t, (counts.get(t) ?? 0) + n);
    }
  }
  const sorted = [...counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  $("title").textContent = child ? "Feelings today" : "Your feelings this week";
  const when = child ? "today" : "this week";
  $("feelings").replaceChildren(...sorted.map(([t, n]) => meter(t, n, when)));
  if (!sorted.length) $("feelings").append(el("div", "empty", `Nothing picked up ${when} yet.`));
  $("note").textContent = child
    ? "Your parent sees topics and how often, never your words."
    : "This stays on this computer. Nothing is shared.";

  $("model").hidden = model.state === "ready";
  $("model").textContent = model.state === "loading"
    ? `Setting up the on-device model (one-time download)… ${model.progress}%`
    : model.state === "error" ? "The on-device model couldn't load, so only the built-in phrase checks are running." : "";

  $("dashboard").textContent = child ? "Parent dashboard" : "My dashboard";
  $("reset").hidden = child;
  $("sync-now").hidden = !child;
}

// ---- switching modes ----

let pending: { to: Mode; need: "new-pin" | "pin" } | null = null;

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
    showPinForm({ to, need });
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
  const { to } = pending;
  showPinForm(null);
  await mode.switchTo(to);
});

// ---- buttons ----

// The dashboard page reads this browser's data directly; in Child mode it asks for the PIN.
$("dashboard").addEventListener("click", () => void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") }));

$("reset").addEventListener("click", async () => {
  if (!confirm("Delete this browser's Bridge.ai data (feelings, levels, usage)? Your settings stay.")) return;
  await store.resetData();
});

// The Sync button shows what happened, then goes back to its label.
const syncBtn = $<HTMLButtonElement>("sync-now");
let restore: ReturnType<typeof setTimeout> | undefined;
function flash(text: string) {
  clearTimeout(restore);
  syncBtn.textContent = text;
  syncBtn.disabled = false;
  restore = setTimeout(() => { syncBtn.textContent = "Sync now"; }, 2500);
}

syncBtn.addEventListener("click", async () => {
  if (!(await store.get("auth"))) return flash("Log in first (Options)");
  clearTimeout(restore);
  syncBtn.textContent = "Syncing…";
  syncBtn.disabled = true;
  const msg: ToWorker = { type: "sync-now" };
  void chrome.runtime.sendMessage(msg).catch(() => flash("Couldn't sync"));
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.profiles || changes.settings || changes.modelStatus) void render();
  const status = changes.syncStatus?.newValue as { ok: boolean } | undefined;
  if (status && syncBtn.disabled) flash(status.ok ? "Synced ✓" : "Sync failed");
});
void render();
