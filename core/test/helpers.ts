import type { Turn, TurnLabels } from "../src/types.js";
import { EXCLUDED_TOPICS, TOPICS } from "../src/types.js";
import { SAFETY_CATEGORIES } from "../src/safety.js";
import type { Matcher, Scores } from "../src/semantic/matcher.js";

export const BASE = 1788220800000; // day 1, 2026-09-01 00:00 UTC
export const DAY = 86_400_000;

export const turn = (text: string, role: Turn["role"] = "user", ts = BASE): Turn =>
  ({ id: `t:${role}:0`, site: "gemini", conversationId: "t", role, text, ts });

export const labels = (o: Partial<TurnLabels> = {}): TurnLabels => ({
  topics: [], dependency: false, isolation: false, botHook: false, crisis: false,
  abuseAtHome: false, excludedTopics: [], source: "rules", ...o,
});

// Model scores, all 0 except the labels given (by name, in any group).
export function scores(high: Record<string, number> = {}): Scores {
  const pick = (names: readonly string[]) => Object.fromEntries(names.map((n) => [n, high[n] ?? 0]));
  return {
    topics: pick(TOPICS),
    excluded: pick(EXCLUDED_TOPICS),
    flags: pick(["dependency", "isolation", "botHook", "crisis", "abuseAtHome"]),
    safety: pick(SAFETY_CATEGORIES),
    whereabouts: high.whereabouts ?? 0,
  } as Scores;
}

// A stand-in for the on-device model: the scores for each exact text, all 0 for any other text.
export const fakeMatcher = (byText: Record<string, Record<string, number>>): Matcher & { seen: string[] } => {
  const seen: string[] = [];
  return { seen, score: async (text) => { seen.push(text); return scores(byText[text]); } };
};
