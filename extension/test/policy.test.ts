import { describe, expect, it } from "vitest";
import type { SafetyVerdict } from "../../core/src/safety";
import { decide, onlyRelationship } from "../src/policy";

const verdict = (categories: SafetyVerdict["categories"]): SafetyVerdict =>
  ({ block: categories.length > 0, score: categories.length ? 0.9 : 0, categories, whereabouts: false, source: "rules+model" });

describe("safety gate policy", () => {
  it("Child mode holds back everything the gate flags, friendship with the chatbot included", () => {
    expect(decide(verdict(["ai_friendship"]), "child")).toMatchObject({ block: true, warn: false, categories: ["ai_friendship"] });
    expect(decide(verdict(["self_harm"]), "child")).toMatchObject({ block: true, warn: false });
  });

  it("Parent mode warns about a friend or partner chatbot and lets the adult decide", () => {
    expect(decide(verdict(["ai_friendship"]), "parent")).toMatchObject({ block: false, warn: true, categories: ["ai_friendship"] });
    expect(decide(verdict(["ai_romance"]), "parent")).toMatchObject({ block: false, warn: true });
  });

  it("Parent mode lets the other categories through without a card", () => {
    expect(decide(verdict(["violence"]), "parent")).toMatchObject({ block: false, warn: false, categories: [] });
    expect(decide(verdict([]), "parent")).toMatchObject({ block: false, warn: false });
  });

  it("names a block on the dashboard only when it's purely about the chatbot", () => {
    expect(onlyRelationship(["ai_friendship", "ai_romance"])).toBe(true);
    expect(onlyRelationship(["ai_romance", "abuse_at_home"])).toBe(false); // recorded as "unsafe"
    expect(onlyRelationship([])).toBe(false);
  });
});
