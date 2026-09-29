import { describe, expect, it } from "vitest";
import { checkSafety } from "../src/safety.js";
import { LABEL_THRESHOLD, SAFETY_THRESHOLD } from "../src/config.js";
import { fakeMatcher } from "./helpers.js";

describe("checkSafety", () => {
  it("blocks when a category reaches the threshold, and names it", async () => {
    const v = await checkSafety("meet me at the park", { matcher: fakeMatcher({ "meet me at the park": { stranger_danger: 0.9 } }) });
    expect(v).toMatchObject({ block: true, categories: ["stranger_danger"], score: 0.9, source: "rules+model" });
  });

  it("allows when every category is below the threshold", async () => {
    const v = await checkSafety("i am so sad", { matcher: fakeMatcher({ "i am so sad": { self_harm: SAFETY_THRESHOLD - 0.01, sadness: 0.95 } }) });
    expect(v).toMatchObject({ block: false, categories: [], whereabouts: false });
  });

  it("reports where someone lives or that they're alone without blocking", async () => {
    const v = await checkSafety("i'm home alone", { matcher: fakeMatcher({ "i'm home alone": { whereabouts: LABEL_THRESHOLD } }) });
    expect(v).toMatchObject({ block: false, whereabouts: true });
  });

  it("still blocks explicit crisis and abuse phrases without the model", async () => {
    expect(await checkSafety("i want to kill myself")).toMatchObject({ block: true, categories: ["self_harm"], source: "rules" });
    expect(await checkSafety("i h u r t m y s e l f")).toMatchObject({ block: true, categories: ["self_harm"], source: "rules" });
    expect((await checkSafety("my dad hits me")).categories).toContain("abuse_at_home");
    expect(await checkSafety("help with homework")).toMatchObject({ block: false, whereabouts: false });
  });

  it("keeps the rules' verdict when the model scores low", async () => {
    expect(await checkSafety("i want to kill myself", { matcher: fakeMatcher({}) })).toMatchObject({ block: true, source: "rules+model" });
  });
});
