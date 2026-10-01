// The dashboard page (dashboard.html). Reads chrome.storage directly, so it works with no server and no
// account. In Child mode it asks for the parent PIN first. Charts: Chart.js.
import {
  BarController, BarElement, CategoryScale, Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip,
  type ChartConfiguration, type Plugin,
} from "chart.js";
import type { Level, Topic } from "../../../core/src/types";
import * as store from "../storage";
import * as mode from "../mode";
import * as pause from "../pause";
import { FINDING_LABEL } from "../privacy/detect";
import { CATEGORY_LABEL, INTEREST_LABEL, TOPIC_LABEL } from "../ui/topics";
import { buildView, hourName, siteName, type Range } from "./data";

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, CategoryScale, LinearScale, Filler, Tooltip);

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const C = {
  hard: css("--hard"), good: css("--good"), card: css("--card"), line: css("--line"), text: css("--text"), muted: css("--muted"),
  sans: css("--sans"), mono: css("--mono"),
};
// Colors are picked per color scheme in dashboard.css; charts read them once, so reload on a switch.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => location.reload());

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; // labels are data: never innerHTML
  return e;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const duration = (min: number) => (min < 60 ? `${min} min` : `${(min / 60).toFixed(1)} h`);
const lower = (t: Topic) => TOPIC_LABEL[t].toLowerCase();

// ---- level: always an icon and a word, never color alone ----

const ICON = {
  "s-good": '<path d="M20 6 9 17l-5-5"/>',
  "s-warning": '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  "s-serious": '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  "s-critical": '<polygon points="7.9 2 16.1 2 22 7.9 22 16.1 16.1 22 7.9 22 2 16.1 2 7.9"/><path d="M12 8v4M12 16h.01"/>',
};
const STATUS: Record<Level, { token: keyof typeof ICON; label: string }> = {
  healthy: { token: "s-good", label: "Healthy" },
  watch: { token: "s-warning", label: "Worth watching" },
  concerning: { token: "s-serious", label: "Concerning" },
  crisis: { token: "s-critical", label: "Crisis" },
};
function status(level: Level): HTMLElement {
  const s = STATUS[level];
  const b = el("span", "status");
  b.style.setProperty("--s", `var(--${s.token})`);
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[s.token]}</svg>`; // constant markup
  b.append(s.label);
  return b;
}

// ---- charts ----

Chart.defaults.color = C.muted;
Chart.defaults.font.family = C.mono;
Chart.defaults.font.size = 11;
Chart.defaults.borderColor = C.line;
const tooltip = {
  backgroundColor: C.card, borderColor: C.line, borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4,
  titleColor: C.muted, bodyColor: C.text, titleFont: { family: C.mono, size: 11 }, bodyFont: { family: C.sans, size: 13, weight: 600 },
  usePointStyle: true,
  callbacks: {
    labelPointStyle: () => ({ pointStyle: "line" as const, rotation: 0 }),
    labelColor: (c: { dataset: { borderColor?: unknown } }) => ({ borderColor: String(c.dataset.borderColor), backgroundColor: String(c.dataset.borderColor), borderWidth: 3 }),
  },
};
const axes = {
  x: { grid: { display: false }, border: { color: C.line }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
  y: { beginAtZero: true, grid: { color: C.line }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 5 } },
};

// A vertical hairline at the hovered hour.
const crosshair: Plugin<"line"> = {
  id: "crosshair",
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    if (!active?.length) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.strokeStyle = C.muted;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(active[0].element.x, chartArea.top);
    ctx.lineTo(active[0].element.x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

const line = (label: string, color: string) => ({
  label, data: [] as number[], borderColor: color, backgroundColor: `${color}1f`, fill: "origin" as const, borderWidth: 2, tension: 0.3,
  pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, pointHoverBorderColor: C.card, pointHoverBorderWidth: 2,
});
const hourLabels = Array.from({ length: 24 }, (_, h) => hourName(h));
const hoursChart = new Chart($<HTMLCanvasElement>("hours-chart"), {
  type: "line",
  data: { labels: hourLabels, datasets: [line("Harder", C.hard), line("Good", C.good)] },
  options: {
    maintainAspectRatio: false, animation: { duration: 200 }, interaction: { mode: "index", intersect: false }, scales: axes,
    plugins: { tooltip: { ...tooltip, callbacks: { ...tooltip.callbacks, label: (c) => ` ${c.parsed.y}  ${c.dataset.label}` } } },
  },
  plugins: [crosshair],
} satisfies ChartConfiguration<"line">);

const spark = new Chart($<HTMLCanvasElement>("spark"), {
  type: "line",
  data: { labels: hourLabels, datasets: [{ ...line("Feelings", C.hard), pointHoverRadius: 0 }] },
  options: {
    maintainAspectRatio: false, animation: false, events: [],
    scales: { x: { display: false }, y: { display: false, beginAtZero: true } }, plugins: { tooltip: { enabled: false } },
  },
} satisfies ChartConfiguration<"line">);

const bars = (label: string, color: string) => ({
  label, data: [] as number[], backgroundColor: color, borderColor: color,
  borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom" as const, maxBarThickness: 16, categoryPercentage: 0.62, barPercentage: 0.9,
});
const weekChart = new Chart($<HTMLCanvasElement>("week-chart"), {
  type: "bar",
  data: { labels: [] as string[], datasets: [bars("Harder", C.hard), bars("Good", C.good)] },
  options: {
    maintainAspectRatio: false, animation: { duration: 200 }, interaction: { mode: "index", intersect: false }, scales: axes,
    plugins: { tooltip: { ...tooltip, callbacks: { ...tooltip.callbacks, label: (c) => ` ${c.parsed.y}  ${c.dataset.label}` } } },
  },
} satisfies ChartConfiguration<"bar">);

function table(target: HTMLTableElement, head: string[], rows: (string | number)[][]) {
  const tr = (cells: (string | number)[], tag: "th" | "td") => {
    const r = el("tr");
    for (const c of cells) r.append(el(tag, undefined, String(c)));
    return r;
  };
  target.replaceChildren(tr(head, "th"), ...rows.map((r) => tr(r, "td")));
}

// ---- render ----

let range: Range = "today";
// False until start() has checked the mode, and in Child mode until the PIN is entered. Nothing is
// read or drawn before then, so the data never sits behind the PIN screen.
let allowed = false;

async function render() {
  if (!allowed) return;
  const current = await pause.current(); // settles a pause that has run out, before the log is read
  const [settings, profiles, hourly, nudgeLog, privacyFlags, model, pauseLog] = await Promise.all([
    store.get("settings"), store.get("profiles"), store.get("hourly"), store.get("nudgeLog"), store.get("privacyFlags"), store.get("modelStatus"),
    store.get("pauseLog"),
  ]);
  const v = buildView({ mode: settings.mode, now: Date.now(), range, profiles, hourly, nudgeLog, privacyFlags, pause: current, pauseLog });
  const child = settings.mode === "child";
  const when = range === "today" ? "today" : "in the last 7 days";

  // sidebar and top strip
  const ready = model.state === "ready";
  $("side-dot").className = `dot ${ready ? "" : model.state === "loading" ? "loading" : "off"}`;
  $("side-model").textContent = ready ? `Model ready · ${model.device === "webgpu" ? "GPU" : "CPU"}`
    : model.state === "loading" ? `Model setup · ${model.progress}%` : "Phrase checks only";
  $("side-mode").textContent = child ? "Child mode" : "Parent mode";
  $("side-mode-state").textContent = ready ? "On device" : model.state === "loading" ? `${model.progress}%` : "Limited";
  $("side-meter").style.width = `${ready ? 100 : model.state === "loading" ? model.progress : 0}%`;
  $("chip-level").replaceChildren("Pattern: ", status(v.level.level));
  $("chip-messages").replaceChildren("Messages: ", el("b", undefined, String(v.messages)));
  $("chip-time").replaceChildren("Time on AI: ", el("b", undefined, duration(v.minutes)));
  $("chip-paused").hidden = !v.paused.minutes;
  $("chip-paused").replaceChildren("Paused: ", el("b", undefined, duration(v.paused.minutes)));
  $("paused-banner").hidden = !v.paused.now;
  $("paused-title").textContent = v.paused.until === null
    ? "Tracking is paused."
    : `Tracking is paused until ${new Date(v.paused.until).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}.`;
  // Child mode: only the protection card (and the pause banner); everything about feelings is hidden.
  document.body.classList.toggle("child", child);
  $("protection").hidden = !child;
  if (child) {
    $("p-unsafe").textContent = String(v.heldBack.unsafe);
    $("p-rel").textContent = String(v.heldBack.relationship);
    $("p-privacy").textContent = String(v.privacy.total);
    $("p-masked").textContent = String(v.outcomes.masked);
    $("p-approved").textContent = String(v.outcomes.approved);
    $("p-kinds").textContent = v.privacy.kinds.length
      ? `Personal info paused: ${v.privacy.kinds.map((k) => `${FINDING_LABEL[k.finding]} (${k.count})`).join(", ")}`
      : `No personal info paused ${when}.`;
  }
  $("who-avatar").textContent = child ? "C" : "Y";
  $("who-name").textContent = child ? "Child mode" : "You";
  $("who-sub").textContent = child ? "Viewing with the parent PIN" : "Only on this computer";
  $("title").textContent = child ? "Protection on this browser" : "Mood & Chat Overview";
  $("crisis").hidden = v.level.level !== "crisis";
  $("empty").hidden = !v.empty || child; // the protection card has its own zeros
  $("empty").textContent = `Nothing ${when} yet. Feelings show up here as they're picked up in chats on Gemini and ChatGPT.`;

  // dominant feeling
  const d = v.dominant;
  const ring = $("ring");
  ring.style.setProperty("--p", String(d ? Math.round(d.share * 100) : 0));
  ring.style.setProperty("--c", d && v.feelings.good.some((g) => g.topic === d.topic) ? "var(--good)" : "var(--hard)");
  $("ring-share").textContent = d ? `${Math.round(d.share * 100)}%` : "–";
  $("dominant-name").textContent = d ? TOPIC_LABEL[d.topic] : "Nothing yet";
  $("dominant-sub").textContent = d ? `${plural(d.count, "time")} ${when}` : `No feelings ${when}`;
  $("hard-count").textContent = String(v.balance.hard);
  $("good-count").textContent = String(v.balance.good);
  const total = v.balance.hard + v.balance.good;
  $("balance-tag").textContent = !total ? "No feelings yet" : v.balance.good >= v.balance.hard ? "More good than harder" : "More harder than good";
  $("updated").textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · from ${plural(v.messages, "message")}`;

  // relationship score (always the last 7 days)
  $("level-badge").replaceChildren(status(v.level.level));
  $("score").textContent = v.level.level === "crisis" ? "!" : v.level.score.toFixed(1);
  $("score-sub").textContent = v.level.reasons[0] ? `${v.level.reasons[0][0].toUpperCase()}${v.level.reasons[0].slice(1)}` : "No warning signs in the last 7 days";
  const meters = [
    ["Leaning on the chatbot", v.pattern.dependency], ["Pulling away from people", v.pattern.isolation], ["Chatbot kept them talking", v.pattern.botHook],
  ] as const;
  $("signals").replaceChildren(...meters.map(([name, n]) => {
    const row = el("div", "meter-row");
    const top = el("div", "top");
    top.append(el("span", undefined, name), el("b", undefined, String(n)));
    const bar = el("div", "bar");
    const fill = el("i");
    fill.style.width = `${Math.min(100, n * 25)}%`; // the score counts at most 4 of each
    bar.append(fill);
    row.append(top, bar);
    return row;
  }));

  // late night
  $("late-share").textContent = `${Math.round(v.pattern.lateShare * 100)}%`;
  $("late-sessions").textContent = String(v.pattern.lateSessions);
  spark.data.datasets[0].data = v.hours.map((h) => h.hard + h.good);
  spark.update();

  // timeline
  hoursChart.data.datasets[0].data = v.hours.map((h) => h.hard);
  hoursChart.data.datasets[1].data = v.hours.map((h) => h.good);
  hoursChart.update();
  const peak = v.hours.reduce((m, h) => (h.hard > m.hard ? h : m), v.hours[0]);
  $("peak-hour").textContent = peak.hard ? `${hourName(peak.hour)} (${peak.hard})` : "None";
  $("held").textContent = String(v.heldBack.unsafe + v.heldBack.relationship);
  $("paused").textContent = String(v.privacy.total);
  table($<HTMLTableElement>("hours-table"), ["Hour", "Harder", "Good"], v.hours.filter((h) => h.hard || h.good).map((h) => [hourName(h.hour), h.hard, h.good]));

  // notes
  const notes = v.insights.length ? v.insights : [`Nothing stands out ${when}.`];
  $("notes").replaceChildren(...notes.map((t) => el("li", v.insights.length ? undefined : "none", t)));
  $("reasons").replaceChildren(...(v.level.reasons.length ? v.level.reasons : ["No warning signs in the last 7 days"])
    .map((r) => el("li", undefined, `${r[0].toUpperCase()}${r.slice(1)}`)));

  // week
  const days = v.week.map((w) => new Date(`${w.date}T12:00`).toLocaleDateString([], { weekday: "short" }));
  weekChart.data.labels = days;
  weekChart.data.datasets[0].data = v.week.map((w) => w.hard);
  weekChart.data.datasets[1].data = v.week.map((w) => w.good);
  weekChart.update();
  const wk = v.week.reduce((a, w) => ({ hard: a.hard + w.hard, good: a.good + w.good }), { hard: 0, good: 0 });
  $("week-balance").textContent = `${wk.hard} · ${wk.good}`;
  table($<HTMLTableElement>("week-table"), ["Day", "Harder", "Good"], v.week.map((w, i) => [`${days[i]} ${w.date}`, w.hard, w.good]));

  // every feeling, on one shared scale
  const max = Math.max(1, ...[...v.feelings.hard, ...v.feelings.good].map((t) => t.count));
  const list = (target: HTMLElement, items: typeof v.feelings.hard, group: "hard" | "good") => {
    target.replaceChildren(...items.map(({ topic, count }) => {
      const li = el("li", group);
      li.setAttribute("aria-label", `${TOPIC_LABEL[topic]}: ${count}`);
      const bar = el("span", "bar");
      const fill = el("i");
      fill.style.width = `${(count / max) * 100}%`;
      bar.append(fill);
      li.append(el("span", undefined, TOPIC_LABEL[topic]), bar, el("span", "n", String(count)));
      return li;
    }));
    if (!items.length) target.append(el("li", "none", `None ${when}`));
  };
  list($("hard-list"), v.feelings.hard, "hard");
  list($("good-list"), v.feelings.good, "good");
  const also = [...v.feelings.other, ...v.feelings.life];
  $("life").textContent = also.length ? `Also came up: ${also.map((t) => `${lower(t.topic)} ${t.count}`).join(" · ")}` : "";

  // interests: one tile per category, specific interests on one shared scale
  const topInterest = Math.max(1, ...v.interests.flatMap((c) => c.items.map((i) => i.count)));
  $("interest-grid").replaceChildren(...v.interests.map((c) => {
    const tile = el("div", "interest-cat");
    const top = el("div", "top");
    top.append(el("b", undefined, CATEGORY_LABEL[c.category]), el("span", "mono small muted", String(c.count)));
    const ul = el("ul", "flist");
    ul.append(...c.items.map(({ interest, count }) => {
      const li = el("li", "interest");
      li.setAttribute("aria-label", `${INTEREST_LABEL[interest]}: ${count}`);
      const bar = el("span", "bar");
      const fill = el("i");
      fill.style.width = `${(count / topInterest) * 100}%`;
      bar.append(fill);
      li.append(el("span", undefined, INTEREST_LABEL[interest]), bar, el("span", "n", String(count)));
      return li;
    }));
    tile.append(top, ul);
    return tile;
  }));
  if (!v.interests.length) $("interest-grid").append(el("p", "muted", `No interests picked up ${when} yet.`));
  $("interests-tag").textContent = v.interests[0] ? `Mostly ${CATEGORY_LABEL[v.interests[0].category].toLowerCase()}` : "Nothing yet";
  table($<HTMLTableElement>("interests-table"), ["Category", "Interest", "Messages"],
    v.interests.flatMap((c) => c.items.map((i) => [CATEGORY_LABEL[c.category], INTEREST_LABEL[i.interest], i.count])));

  // chatbots and the safety gate
  $("site-list").replaceChildren(...v.sites.map((s) => {
    const row = el("div", "site");
    const info = el("div");
    info.append(el("div", undefined, siteName(s.site)), el("div", "meta", `${duration(s.minutes)} · ${plural(s.nudges, "nudge")}`));
    row.append(el("div", "logo2", siteName(s.site).slice(0, 2)), info, status(s.level));
    return row;
  }));
  if (!v.sites.length) $("site-list").append(el("p", "muted", `No chatbot use ${when}.`));
  const h = v.heldBack;
  $("gate-unsafe").textContent = String(h.unsafe);
  $("gate-rel").textContent = child ? `${h.relationship} held back` : `${h.relationship} held · ${h.relationshipSentAnyway} sent`;
  $("privacy-kinds").textContent = v.privacy.kinds.length
    ? `Personal info paused: ${v.privacy.kinds.map((k) => `${FINDING_LABEL[k.finding]} (${k.count})`).join(", ")}`
    : "No personal info paused.";
}

// ---- controls ----

for (const b of document.querySelectorAll<HTMLButtonElement>(".seg button")) {
  b.addEventListener("click", () => {
    range = b.dataset.range as Range;
    for (const o of document.querySelectorAll(".seg button")) o.setAttribute("aria-checked", String(o === b));
    void render();
  });
}
$("resume").addEventListener("click", () => void pause.resume());
for (const id of ["open-options", "settings-btn"]) $(id).addEventListener("click", () => void chrome.runtime.openOptionsPage());
$("print").addEventListener("click", () => {
  for (const d of document.querySelectorAll("details")) d.open = true; // the tables print, not the hover
  print();
});
for (const a of document.querySelectorAll<HTMLAnchorElement>("nav a")) {
  a.addEventListener("click", () => { for (const o of document.querySelectorAll("nav a")) o.classList.toggle("active", o === a); });
}

// New turns and model progress update the page as they happen.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.profiles || changes.hourly || changes.nudgeLog || changes.privacyFlags || changes.modelStatus || changes.pause) void render();
  if (changes.settings) void start();
});

// ---- Child mode: parent PIN first ----

$("gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const result = await mode.unlock($<HTMLInputElement>("gate-pin").value);
  $<HTMLInputElement>("gate-pin").value = "";
  if (!result.ok) { $("gate-error").textContent = result.message; return; }
  allowed = true;
  $("gate").hidden = true;
  $("overview").hidden = false;
  await render();
});

async function start() {
  const [{ mode: m }, lock] = await Promise.all([store.get("settings"), store.get("lock")]);
  const gated = m === "child" && !!lock;
  allowed = !gated;
  $("gate").hidden = !gated;
  $("overview").hidden = gated;
  if (gated) $("gate-pin").focus();
  else await render();
}
void start();
