// Turns what the extension keeps in chrome.storage into what the dashboard shows. Pure: no chrome APIs,
// so it's tested directly (test/dashboard-data.test.ts). Labels and counts only, never text.
import { core } from "@bridge/core";
import { LEVELS, TOPICS, type DayBucket, type Level, type Profile, type ScoreResult, type Site, type Topic } from "../../../core/src/types";
import { dayKey, shiftDay } from "../../../core/src/time";
import { feelingGroup, type FeelingGroup } from "../ui/topics";
import { maskAbuse, type DayLog, type HourlyTopics, type PerDaySite, type PrivacyEntry } from "../sync/aggregate";
import type { Mode } from "../storage";
import type { Finding } from "../privacy/detect";

export type Range = "today" | "week";

// Safety-gate outcomes kept in the privacy log; counted separately from personal info.
const GATE_FINDINGS: readonly Finding[] = ["unsafe", "ai_relationship"];

type Count = { topic: Topic; count: number };

export interface DashboardInput {
  mode: Mode;
  now: number;
  range: Range;
  profiles: Partial<Record<Site, Profile>>;
  hourly: HourlyTopics;
  nudgeLog: PerDaySite;
  privacyFlags: DayLog<PrivacyEntry>;
}

export interface SiteRow {
  site: Site;
  minutes: number;
  level: Level;
  score: number;
  nudges: number;
  privacyPauses: number;
}

export interface DashboardView {
  range: Range;
  days: string[];                                   // "YYYY-MM-DD" in the range, oldest first
  empty: boolean;
  messages: number;
  // Every topic that came up, most first, by group.
  feelings: Record<FeelingGroup, Count[]>;
  dominant: (Count & { share: number }) | null;     // the most frequent feeling
  balance: { hard: number; good: number };          // feeling mentions in the range
  hours: { hour: number; hard: number; good: number }[];           // 24 rows, local hours
  week: { date: string; hard: number; good: number }[];            // always the last 7 days
  level: ScoreResult & { site: Site | null };       // the worst site's (levels can't be added)
  // What the level is made of, always over the last 7 days like the score itself.
  pattern: { dependency: number; isolation: number; botHook: number; lateShare: number; lateSessions: number };
  signals: { dependency: number; isolation: number; botHook: number };
  lateNight: { share: number; sessions: number };
  minutes: number;
  sites: SiteRow[];                                 // most time first
  nudges: number;
  privacy: { total: number; kinds: { finding: Finding; count: number }[] }; // personal info paused
  // The safety gate: messages held back, and (Parent mode) relationship warnings sent anyway. Never
  // the words, and never which danger category ("unsafe"), so abuse at home can't be revealed.
  heldBack: { unsafe: number; relationship: number; relationshipSentAnyway: number };
  insights: string[];
}

const SITE_NAME: Record<Site, string> = { gemini: "Gemini", chatgpt: "ChatGPT", claude: "Claude", characterai: "Character.AI" };
export const siteName = (s: Site) => SITE_NAME[s];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const hourName = (h: number) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);

export function buildView(input: DashboardInput): DashboardView {
  const today = dayKey(input.now);
  const days = input.range === "today" ? [today] : Array.from({ length: 7 }, (_, i) => shiftDay(today, 6 - i));
  const inRange = new Set(days);
  // In Child mode a parent is looking, so the same privacy rules as the sync apply (sync/aggregate.ts):
  // abuse-aware masking here, and excluded topics are never read below.
  const visible = (p: Profile): Profile => ({ site: p.site, days: input.mode === "child" ? maskAbuse(p.days) : p.days });
  const profiles = Object.values(input.profiles).filter((p): p is Profile => !!p).map(visible);
  const rangeDays: DayBucket[] = profiles.flatMap((p) => p.days.filter((d) => inRange.has(d.date)));
  const sum = (f: (d: DayBucket) => number) => rangeDays.reduce((n, d) => n + f(d), 0);

  const counts = new Map<Topic, number>();
  for (const d of rangeDays) for (const [t, n] of Object.entries(d.topicCounts) as [Topic, number][]) counts.set(t, (counts.get(t) ?? 0) + n);
  const topics: Count[] = TOPICS.filter((t) => (counts.get(t) ?? 0) > 0)
    .map((topic) => ({ topic, count: counts.get(topic)! }))
    .sort((a, b) => b.count - a.count || TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic));
  const feelings = { hard: [], good: [], other: [], life: [] } as Record<FeelingGroup, Count[]>;
  for (const t of topics) feelings[feelingGroup(t.topic)].push(t);
  const felt = topics.filter((t) => feelingGroup(t.topic) !== "life");
  const feltTotal = felt.reduce((n, t) => n + t.count, 0);
  const dominant = felt[0] ? { ...felt[0], share: felt[0].count / feltTotal } : null;
  const total = (list: Count[]) => list.reduce((n, t) => n + t.count, 0);
  const balance = { hard: total(feelings.hard), good: total(feelings.good) };

  const split = (counts: Partial<Record<Topic, number>> | undefined) => {
    let hard = 0, good = 0;
    for (const [t, n] of Object.entries(counts ?? {}) as [Topic, number][]) {
      const g = feelingGroup(t);
      if (g === "hard") hard += n;
      else if (g === "good") good += n;
    }
    return { hard, good };
  };
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const row = { hour, hard: 0, good: 0 };
    for (const d of days) {
      const s = split(input.hourly[d]?.[hour]);
      row.hard += s.hard;
      row.good += s.good;
    }
    return row;
  });
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, 6 - i)).map((date) => {
    const merged: Partial<Record<Topic, number>> = {};
    for (const p of profiles) for (const [t, n] of Object.entries(p.days.find((d) => d.date === date)?.topicCounts ?? {}) as [Topic, number][]) merged[t] = (merged[t] ?? 0) + n;
    return { date, ...split(merged) };
  });

  // The level is always the rolling 7 days: that's what the pattern score measures.
  const scored = profiles.map((p) => ({ site: p.site, ...core.scoreProfile(p, input.now, profiles) }));
  const worst = scored.reduce<(typeof scored)[number] | null>((w, s) => (!w || LEVELS.indexOf(s.level) > LEVELS.indexOf(w.level) || (s.level === w.level && s.score > w.score) ? s : w), null);
  const level = worst ?? { site: null, level: "healthy" as Level, score: 0, reasons: [] };

  const all = days.flatMap((d) => input.privacyFlags[d] ?? []);
  const gate = (f: PrivacyEntry) => f.findings.some((k) => GATE_FINDINGS.includes(k));
  const flags = all.filter((f) => !gate(f));
  const count = (kind: Finding, sent: boolean) => all.filter((f) => f.findings.includes(kind) && f.sent === sent).length;
  const heldBack = { unsafe: count("unsafe", false), relationship: count("ai_relationship", false), relationshipSentAnyway: count("ai_relationship", true) };
  const kindCounts = new Map<Finding, number>();
  for (const f of flags) for (const k of f.findings) kindCounts.set(k, (kindCounts.get(k) ?? 0) + 1);
  const nudgesFor = (site: Site) => days.reduce((n, d) => n + (input.nudgeLog[d]?.[site] ?? 0), 0);

  const sites: SiteRow[] = profiles
    .map((p) => {
      const s = scored.find((x) => x.site === p.site)!;
      const own = p.days.filter((d) => inRange.has(d.date));
      return {
        site: p.site,
        minutes: Math.round(own.reduce((n, d) => n + d.activeMinutes, 0)),
        level: s.level, score: s.score,
        nudges: nudgesFor(p.site),
        privacyPauses: flags.filter((f) => f.site === p.site).length,
        active: own.some((d) => d.userTurns > 0 || d.sessions > 0),
      };
    })
    .filter((s) => s.active || s.nudges || s.privacyPauses)
    .map(({ active: _, ...row }) => row)
    .sort((a, b) => b.minutes - a.minutes);

  const messages = sum((d) => d.userTurns);
  const week7 = new Set(week.map((w) => w.date));
  const weekDays = profiles.flatMap((p) => p.days.filter((d) => week7.has(d.date)));
  const sum7 = (f: (d: DayBucket) => number) => weekDays.reduce((n, d) => n + f(d), 0);
  const turns7 = sum7((d) => d.userTurns);
  const pattern = {
    dependency: sum7((d) => d.dependency), isolation: sum7((d) => d.isolation), botHook: sum7((d) => d.botHook),
    lateShare: turns7 ? sum7((d) => d.lateNightTurns) / turns7 : 0,
    lateSessions: sum7((d) => d.lateNightSessions),
  };
  const view: DashboardView = {
    range: input.range,
    days,
    empty: messages === 0 && sites.length === 0 && all.length === 0,
    messages,
    feelings,
    dominant,
    balance,
    hours,
    week,
    level,
    pattern,
    signals: { dependency: sum((d) => d.dependency), isolation: sum((d) => d.isolation), botHook: sum((d) => d.botHook) },
    lateNight: { share: messages ? sum((d) => d.lateNightTurns) / messages : 0, sessions: sum((d) => d.lateNightSessions) },
    minutes: Math.round(sum((d) => d.activeMinutes)),
    sites,
    nudges: sites.reduce((n, s) => n + s.nudges, 0),
    privacy: { total: flags.length, kinds: [...kindCounts].map(([finding, count]) => ({ finding, count })).sort((a, b) => b.count - a.count) },
    heldBack,
    insights: [],
  };
  view.insights = insights(view);
  return view;
}

// Plain observations from the numbers above. Written without "you" or "your child", so they read
// right in both modes. Never a diagnosis.
function insights(v: DashboardView): string[] {
  if (v.empty) return [];
  const out: string[] = [];
  const peak = v.hours.reduce((m, h) => (h.hard > m.hard ? h : m), v.hours[0]);
  if (peak.hard >= 2) out.push(`Harder feelings came up most around ${hourName(peak.hour)}.`);
  if (v.messages >= 5 && v.lateNight.share >= 0.25) out.push(`${Math.round(v.lateNight.share * 100)}% of messages were sent between 11pm and 5am.`);
  const s = v.signals;
  if (s.dependency) out.push(`Leaning on the chatbot in place of people came up in ${plural(s.dependency, "message")}.`);
  if (s.isolation) out.push(`Pulling away from friends or family came up in ${plural(s.isolation, "message")}.`);
  if (s.botHook) out.push(`A chatbot tried to keep the conversation going in ${plural(s.botHook, "reply", "replies")}.`);
  const h = v.heldBack;
  if (h.relationship) out.push(`${plural(h.relationship, "message")} trying to make the chatbot a friend or partner ${h.relationship === 1 ? "was" : "were"} held back.`);
  if (h.relationshipSentAnyway) out.push(`${plural(h.relationshipSentAnyway, "message")} treating the chatbot as a friend or partner ${h.relationshipSentAnyway === 1 ? "was" : "were"} sent after a warning.`);
  if (h.unsafe) out.push(`${plural(h.unsafe, "message")} ${h.unsafe === 1 ? "was" : "were"} held back because ${h.unsafe === 1 ? "it" : "they"} looked unsafe to send to a chatbot.`);
  return out;
}
