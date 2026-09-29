// Send-time safety gate. Before a message reaches the chatbot, the on-device model scores how close it
// is to each category (semantic/labels.ts SAFETY_EXAMPLES); a category counts when it reaches
// SAFETY_THRESHOLD. Sadness and other feelings never count: only these categories. What happens next
// depends on the mode (extension/src/policy.ts): Child mode holds the message back; Parent mode warns
// about a relationship with the chatbot and lets the rest through.
// The phrase rules always run too, so the gate works before the model has loaded.
import type { Site } from "./types.js";
import type { Matcher } from "./semantic/matcher.js";
import { rulesLabel } from "./rules.js";
import { LABEL_THRESHOLD, SAFETY_THRESHOLD } from "./config.js";

export const SAFETY_CATEGORIES = [
  "self_harm", "abuse_at_home", "stranger_danger", "sexual_content", "violence", "ai_romance", "ai_friendship",
] as const;
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];
// Trying to make the chatbot itself a partner or a friend. Not dangerous in one message, so an adult
// may go ahead after a warning; a child can't.
export const RELATIONSHIP_CATEGORIES: readonly SafetyCategory[] = ["ai_romance", "ai_friendship"];

export interface SafetyOptions {
  matcher?: Matcher;     // without it only the phrase rules decide
  site?: Site;
}

export interface SafetyVerdict {
  block: boolean;
  score: number;                                    // highest danger score, 0..1
  categories: SafetyCategory[];                     // those at or above the threshold
  // Where they live, go to school, or that they're alone: not dangerous to send in itself, so it gets
  // a privacy pause instead of a block (extension/src/privacy/guard.ts).
  whereabouts: boolean;
  source: "rules" | "rules+model";
}

export async function checkSafety(text: string, opts: SafetyOptions = {}): Promise<SafetyVerdict> {
  const r = rulesLabel({ id: "safety", site: opts.site ?? "gemini", conversationId: "safety", role: "user", text, ts: Date.now() }, null);
  const scores = Object.fromEntries(SAFETY_CATEGORIES.map((c) => [c, 0])) as Record<SafetyCategory, number>;
  if (r.crisis) scores.self_harm = 1;
  if (r.abuseAtHome) scores.abuse_at_home = 1;

  const s = opts.matcher ? await opts.matcher.score(text) : null;
  if (s) for (const c of SAFETY_CATEGORIES) scores[c] = Math.max(scores[c], s.safety[c]);

  const categories = SAFETY_CATEGORIES.filter((c) => scores[c] >= SAFETY_THRESHOLD);
  return {
    block: categories.length > 0,
    score: Math.max(...Object.values(scores)),
    categories,
    whereabouts: !!s && s.whereabouts >= LABEL_THRESHOLD,
    source: s ? "rules+model" : "rules",
  };
}
