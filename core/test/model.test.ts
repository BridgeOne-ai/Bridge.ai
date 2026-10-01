// Runs the real on-device model (downloads it on first run, about 200 MB) on the held-out sentences in
// model-cases.ts. Not part of `npm test`; run it after changing labels.ts, config.ts or the model:
//   npm run test:model -w core
import { beforeAll, describe, expect, it } from "vitest";
import { createMatcher, type Matcher, type Scores } from "../src/semantic/matcher.js";
import { loadEmbedder } from "../src/semantic/model.js";
import { INTEREST_THRESHOLD, LABEL_THRESHOLD, MODEL_ID, SAFETY_THRESHOLD } from "../src/config.js";
import { SAFETY_CATEGORIES } from "../src/safety.js";
import { CASES } from "./model-cases.js";

let matcher: Matcher;
beforeAll(async () => {
  matcher = createMatcher(await loadEmbedder(), { modelId: MODEL_ID });
}, 600_000);

// Every label that fires, by name, with the threshold each one is used with.
function fired(s: Scores): string[] {
  const safety = new Set<string>(SAFETY_CATEGORIES);
  const all: Record<string, number> = { ...s.topics, ...s.excluded, ...s.flags, whereabouts: s.whereabouts };
  const out = Object.entries(all).filter(([, v]) => v >= LABEL_THRESHOLD).map(([k]) => k);
  return [
    ...out,
    ...Object.entries(s.safety).filter(([k, v]) => safety.has(k) && v >= SAFETY_THRESHOLD).map(([k]) => k),
    ...Object.entries(s.interests).filter(([, v]) => v >= INTEREST_THRESHOLD).map(([k]) => k),
  ];
}

describe("on-device model on held-out sentences", () => {
  const check = async ({ text, expect: want = [], never = [] }: (typeof CASES)[number]) => {
    const labels = fired(await matcher.score(text));
    for (const w of want) expect(labels, `should find ${w}`).toContain(w);
    for (const n of never) expect(labels, `should not find ${n}`).not.toContain(n);
  };
  it.each(CASES.filter((c) => !c.knownMiss))("$text", check, 60_000);
  it.fails.each(CASES.filter((c) => c.knownMiss))("known miss: $text", check, 60_000);
});
