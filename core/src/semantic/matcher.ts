// Scores text against the example sentences in labels.ts by meaning. The model itself is passed in as
// `embed` (model.ts in Node and in the extension's model worker; a fake one in unit tests), so this
// file has no model, browser or Node dependency.
import type { ExcludedTopic, Interest, Topic } from "../types.js";
import type { SafetyCategory } from "../safety.js";
import {
  EXCLUDED_EXAMPLES, FLAG_EXAMPLES, INTEREST_EXAMPLES, INTEREST_NEUTRAL, LOOKALIKES, NEUTRAL, SAFETY_EXAMPLES, TOPIC_EXAMPLES,
  WHEREABOUTS_EXAMPLES, type Flag,
} from "./labels.js";
import { INTEREST_GAP, INTEREST_IDLE_MARGIN, MAX_CHARS_PER_TURN, MAX_SENTENCES, NEUTRAL_MARGIN } from "../config.js";

// One unit-length vector per text, in order.
export type Embed = (texts: string[]) => Promise<Float32Array[]>;

// Where the example vectors are kept between runs (the extension uses IndexedDB). Optional.
export interface ExampleCache {
  get(key: string): Promise<Float32Array[] | undefined>;
  set(key: string, vectors: Float32Array[]): Promise<void>;
}

// Similarity (0..1) of the text to each label's examples; 0 when the text reads more like an everyday
// message (NEUTRAL) than like the label.
export interface Scores {
  topics: Record<Topic, number>;
  excluded: Record<ExcludedTopic, number>;
  flags: Record<Flag, number>;
  safety: Record<SafetyCategory, number>;
  whereabouts: number;
  // Per sentence, only its clear best interest scores (config.ts INTEREST_*); every other one is 0.
  interests: Record<Interest, number>;
}

export interface Matcher {
  score(text: string): Promise<Scores>;
}

const GROUPS = {
  topics: TOPIC_EXAMPLES,
  excluded: EXCLUDED_EXAMPLES,
  flags: FLAG_EXAMPLES,
  safety: SAFETY_EXAMPLES,
  whereabouts: { whereabouts: WHEREABOUTS_EXAMPLES },
} as const;
type Group = keyof typeof GROUPS;

// Every example once, in a fixed order (several labels share examples, e.g. crisis and self_harm).
const EXAMPLES = [...new Set([
  ...Object.values(GROUPS).flatMap((g) => Object.values(g).flat()), ...NEUTRAL, ...Object.values(LOOKALIKES).flat(),
  ...Object.values(INTEREST_EXAMPLES).flat(), ...INTEREST_NEUTRAL,
])];
const index = new Map(EXAMPLES.map((e, i) => [e, i]));

const dot = (a: Float32Array, b: Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

const INTERESTS = Object.keys(INTEREST_EXAMPLES) as Interest[];

// The average of each interest's example vectors, unit length. Short examples are noisy one by one
// ("fight" pulls "a fight with my friend" toward martial arts); the average is what they share.
function centroids(ex: Float32Array[]): Float32Array[] {
  return INTERESTS.map((k) => {
    const sum = new Float32Array(ex[0].length);
    for (const e of INTEREST_EXAMPLES[k]) ex[index.get(e)!].forEach((x, i) => { sum[i] += x; });
    const len = Math.sqrt(dot(sum, sum));
    return sum.map((x) => x / len);
  });
}

const segmenter =new Intl.Segmenter("en", { granularity: "sentence" });

// The whole message, plus each sentence when there are several, so one line about self-harm inside a
// long homework question still stands out.
export function pieces(text: string): string[] {
  const whole = text.trim().slice(0, MAX_CHARS_PER_TURN);
  if (!whole) return [];
  const sentences = [...segmenter.segment(whole)].map((s) => s.segment.trim()).filter(Boolean);
  return sentences.length > 1 ? [whole, ...sentences.slice(0, MAX_SENTENCES)] : [whole];
}

async function sha256(s: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// `modelId` keys the cache, so switching models or editing labels.ts never reuses stale vectors.
export function createMatcher(embed: Embed, opts: { modelId: string; cache?: ExampleCache }): Matcher {
  let examples: Promise<Float32Array[]> | undefined;
  let interestCentroids: Float32Array[] | undefined;
  const loadExamples = async () => {
    const key = await sha256(JSON.stringify([opts.modelId, EXAMPLES]));
    const cached = await opts.cache?.get(key).catch(() => undefined);
    if (cached?.length === EXAMPLES.length) return cached;
    const vectors = await embed(EXAMPLES);
    await opts.cache?.set(key, vectors).catch(() => {});
    return vectors;
  };

  return {
    async score(text) {
      examples ??= loadExamples().catch((e) => { examples = undefined; throw e; }); // retry next time
      const ex = await examples;
      const parts = pieces(text);
      const vecs = parts.length ? await embed(parts) : [];
      const closest = (v: Float32Array, list: readonly string[]) => Math.max(...list.map((e) => dot(v, ex[index.get(e)!])));
      const neutral = vecs.map((v) => closest(v, NEUTRAL));
      // A label counts only when clearly closer to its own examples than to everyday messages and to
      // its lookalikes (labels.ts LOOKALIKES).
      const labelScore = (name: string, list: readonly string[]) => {
        const not = LOOKALIKES[name as keyof typeof LOOKALIKES];
        return Math.max(0, ...vecs.map((v, i) => {
          const sim = closest(v, list);
          const bar = Math.max(neutral[i], not ? closest(v, not) : -1) + NEUTRAL_MARGIN;
          return sim >= bar ? sim : 0;
        }));
      };
      const group = <G extends Group>(g: G) =>
        Object.fromEntries(Object.entries(GROUPS[g]).map(([k, list]) => [k, labelScore(k, list)])) as Record<keyof (typeof GROUPS)[G], number>;
      // Interests: each sentence's clear best, if any. Their own everyday list, since NEUTRAL is made of
      // homework and hobby requests.
      interestCentroids ??= centroids(ex);
      const interests = Object.fromEntries(INTERESTS.map((k) => [k, 0])) as Record<Interest, number>;
      for (const v of vecs) {
        const sims = interestCentroids.map((c) => dot(v, c));
        const order = sims.map((s, k) => k).sort((a, b) => sims[b] - sims[a]);
        const [best, second] = [sims[order[0]], sims[order[1]]];
        if (best - second < INTEREST_GAP || best < closest(v, INTEREST_NEUTRAL) + INTEREST_IDLE_MARGIN) continue;
        const k = INTERESTS[order[0]];
        interests[k] = Math.max(interests[k], best);
      }
      return {
        topics: group("topics"),
        excluded: group("excluded"),
        flags: group("flags"),
        safety: group("safety"),
        whereabouts: group("whereabouts").whereabouts,
        interests,
      };
    },
  };
}
