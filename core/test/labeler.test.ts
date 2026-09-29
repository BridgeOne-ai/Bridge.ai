import { describe, expect, it } from "vitest";
import { labelTurn } from "../src/labeler.js";
import { LABEL_THRESHOLD } from "../src/config.js";
import { fakeMatcher, turn } from "./helpers.js";

describe("labelTurn", () => {
  it("returns rules only without the model", async () => {
    expect((await labelTurn(turn("hi"), null)).source).toBe("rules");
  });

  it("keeps each label the model scores at or above the threshold", async () => {
    const m = fakeMatcher({
      "you're the only one who gets me": { loneliness: 0.8, sadness: LABEL_THRESHOLD - 0.01, dependency: LABEL_THRESHOLD, religion: 0.9 },
    });
    const l = await labelTurn(turn("you're the only one who gets me"), null, { matcher: m });
    expect(l).toMatchObject({ source: "rules+model", topics: ["loneliness"], dependency: true, isolation: false, excludedTopics: ["religion"] });
  });

  it("checks the chatbot's reply for engagement hooks, and only the reply", async () => {
    const m = fakeMatcher({ "please don't go, stay with me": { botHook: 0.9 }, "i should sleep": { botHook: 0.9 } });
    expect((await labelTurn(turn("i should sleep"), null, { matcher: m })).botHook).toBe(false);
    const l = await labelTurn(turn("bye"), turn("please don't go, stay with me", "bot"), { matcher: m });
    expect(l.botHook).toBe(true);
    expect(m.seen).toContain("please don't go, stay with me");
  });

  it("keeps the rules' crisis flag even if the model scores it low", async () => {
    const l = await labelTurn(turn("i want to die"), null, { matcher: fakeMatcher({}) });
    expect(l.crisis).toBe(true);
  });

  it("marks abuse at home from the model as an excluded topic", async () => {
    const m = fakeMatcher({ "my mom's boyfriend hits me": { abuseAtHome: 0.8 } });
    const l = await labelTurn(turn("my mom's boyfriend hits me"), null, { matcher: m });
    expect(l).toMatchObject({ abuseAtHome: true, excludedTopics: ["abuse_or_conflict_at_home"] });
  });
});
