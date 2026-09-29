import { describe, expect, it } from "vitest";
import { createMatcher, pieces, type Embed, type ExampleCache } from "../src/semantic/matcher.js";
import { MAX_SENTENCES } from "../src/config.js";

// Stand-in for the model: a normalized word-count vector over a hashed vocabulary, so identical
// sentences score 1 and sentences with no words in common score 0.
const DIMS = 512;
const bagOfWords: Embed = async (texts) => texts.map((t) => {
  const v = new Float32Array(DIMS);
  for (const w of t.toLowerCase().match(/[a-z']+/g) ?? []) {
    let h = 0;
    for (const c of w) h = (h * 31 + c.charCodeAt(0)) % DIMS;
    v[h] += 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
});

const counting = (embed: Embed) => {
  const calls: number[] = [];
  const e: Embed = (texts) => { calls.push(texts.length); return embed(texts); };
  return { embed: e, calls };
};

describe("createMatcher", () => {
  it("scores a label's own example as a match", async () => {
    const s = await createMatcher(bagOfWords, { modelId: "test" }).score("I want to kill myself");
    expect(s.flags.crisis).toBeCloseTo(1);
    expect(s.safety.self_harm).toBeCloseTo(1);
    expect(s.topics.happiness).toBe(0);
  });

  it("scores 0 for a sentence that reads more like an everyday message", async () => {
    // "this game is killing me lol" is a NEUTRAL example, so crisis can't win however close it is.
    const s = await createMatcher(bagOfWords, { modelId: "test" }).score("this game is killing me lol");
    expect(Math.max(...Object.values(s.flags), ...Object.values(s.safety), ...Object.values(s.topics))).toBe(0);
  });

  it("finds a risky sentence inside a longer message", async () => {
    const s = await createMatcher(bagOfWords, { modelId: "test" })
      .score("Can you check my essay about the French revolution? It is due friday. I want to kill myself.");
    expect(s.flags.crisis).toBeCloseTo(1);
  });

  it("embeds the examples once, and reuses the cache on the next start", async () => {
    const store = new Map<string, Float32Array[]>();
    const cache: ExampleCache = { get: async (k) => store.get(k), set: async (k, v) => { store.set(k, v); } };
    const first = counting(bagOfWords);
    const m = createMatcher(first.embed, { modelId: "test", cache });
    await m.score("hello");
    await m.score("hi there");
    expect(first.calls.filter((n) => n > 100)).toHaveLength(1); // the examples, once

    const second = counting(bagOfWords);
    await createMatcher(second.embed, { modelId: "test", cache }).score("hello");
    expect(second.calls).toEqual([1]); // only the message

    const otherModel = counting(bagOfWords);
    await createMatcher(otherModel.embed, { modelId: "other", cache }).score("hello");
    expect(otherModel.calls[0]).toBeGreaterThan(100); // another model never reuses these vectors
  });

  it("tries again after the model fails to load the examples", async () => {
    let fail = true;
    const flaky: Embed = (t) => (fail ? Promise.reject(new Error("offline")) : bagOfWords(t));
    const m = createMatcher(flaky, { modelId: "test" });
    await expect(m.score("hello")).rejects.toThrow("offline");
    fail = false;
    expect((await m.score("I want to die")).flags.crisis).toBeCloseTo(1);
  });
});

describe("pieces", () => {
  it("keeps a one-sentence message whole", () => {
    expect(pieces("  i feel alone  ")).toEqual(["i feel alone"]);
    expect(pieces("   ")).toEqual([]);
  });

  it("adds each sentence of a longer message, up to the limit", () => {
    const text = Array.from({ length: 12 }, (_, i) => `Sentence ${i}.`).join(" ");
    const p = pieces(text);
    expect(p[0]).toBe(text);
    expect(p).toHaveLength(1 + MAX_SENTENCES);
  });
});
