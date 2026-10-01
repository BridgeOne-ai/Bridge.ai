import { describe, expect, it } from "vitest";
import { core } from "@bridge/core";
import type { Profile } from "../../core/src/types";
import { BASE, DAY, labels } from "../../core/test/helpers";
import { buildView, type DashboardInput } from "../src/dashboard/data";

// BASE is 2026-09-01 00:00 UTC; tests run in UTC.
const NOW = BASE + 2 * DAY + 20 * 3_600_000; // 2026-09-03 20:00
const H = 3_600_000;

const withTurns = (...turns: [Parameters<typeof labels>[0], number][]): Profile =>
  turns.reduce((p, [l, ts]) => core.updateProfile(p, labels(l), ts), core.emptyProfile("gemini"));

const input = (o: Partial<DashboardInput>): DashboardInput => ({
  mode: "parent", now: NOW, range: "week", profiles: {}, hourly: {}, nudgeLog: {}, privacyFlags: {}, ...o,
});

describe("buildView", () => {
  it("is empty with no data, and says nothing stands out", () => {
    const v = buildView(input({}));
    expect(v).toMatchObject({ empty: true, messages: 0, dominant: null, insights: [] });
    expect(v.hours).toHaveLength(24);
    expect(v.week.map((w) => w.date)).toEqual(["2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("finds the most common feeling, and groups every topic as harder, good or an area of life", () => {
    const gemini = withTurns(
      [{ topics: ["stress", "school"] }, NOW - H], [{ topics: ["stress"] }, NOW - 2 * H], [{ topics: ["happiness", "school"] }, NOW - 3 * H],
    );
    const v = buildView(input({ profiles: { gemini } }));
    expect(v.dominant).toEqual({ topic: "stress", count: 2, share: 2 / 3 });
    expect(v.balance).toEqual({ hard: 2, good: 1 });
    expect(v.feelings).toEqual({
      hard: [{ topic: "stress", count: 2 }], good: [{ topic: "happiness", count: 1 }], other: [], life: [{ topic: "school", count: 2 }],
    });
  });

  it("'Today' counts only today; the 7-day view counts the week", () => {
    const gemini = withTurns([{ topics: ["sadness"] }, NOW - H], [{ topics: ["sadness"] }, NOW - 2 * DAY]);
    expect(buildView(input({ profiles: { gemini }, range: "today" })).balance.hard).toBe(1);
    expect(buildView(input({ profiles: { gemini }, range: "week" })).balance.hard).toBe(2);
  });

  it("splits each hour into hard feelings and happy moments", () => {
    const hourly = { "2026-09-03": { "23": { loneliness: 2, happiness: 1, school: 4 } }, "2026-09-02": { "23": { anger: 1 } } };
    const v = buildView(input({ hourly }));
    expect(v.hours[23]).toEqual({ hour: 23, hard: 3, good: 1 }); // school is an area of life, not a feeling
    expect(buildView(input({ hourly, range: "today" })).hours[23]).toEqual({ hour: 23, hard: 2, good: 1 });
  });

  it("Parent mode shows an adult their own crisis level", () => {
    const gemini = withTurns([{ crisis: true }, NOW - H]);
    expect(buildView(input({ profiles: { gemini }, mode: "parent" })).level.level).toBe("crisis");
  });

  it("Child mode shows only what was held back: no feelings, interests, time, hours or level", () => {
    const gemini = withTurns(
      [{ crisis: true, topics: ["sadness"], interests: ["soccer"] }, NOW - H],
      [{ abuseAtHome: true, excludedTopics: ["abuse_or_conflict_at_home"] }, NOW - DAY],
    );
    const hourly = { "2026-09-03": { "19": { sadness: 2 } } };
    const privacyFlags = { "2026-09-03": [
      { hour: 19, site: "gemini" as const, what: "message" as const, findings: ["unsafe" as const], sent: false },
      { hour: 19, site: "gemini" as const, what: "message" as const, findings: ["phone" as const], sent: false, hidden: true },
      { hour: 19, site: "gemini" as const, what: "message" as const, findings: ["email" as const], sent: true, approved: true },
    ] };
    const v = buildView(input({ profiles: { gemini }, hourly, privacyFlags, mode: "child" }));
    expect(v).toMatchObject({
      messages: 0, minutes: 0, sites: [], interests: [], dominant: null, level: { level: "healthy" },
      heldBack: { unsafe: 1, relationship: 0 }, outcomes: { masked: 1, approved: 1 }, privacy: { total: 2 },
    });
    expect(v.hours.every((h) => !h.hard && !h.good)).toBe(true);
    expect(JSON.stringify(v)).not.toMatch(/crisis|abuse|sadness|soccer/);
  });

  it("lists sites by time, with their nudges and privacy pauses in the range", () => {
    let gemini = withTurns([{ topics: ["school"] }, NOW - H]);
    gemini = core.recordSession(gemini, { site: "gemini", start: NOW - 2 * H, end: NOW - H });
    let chatgpt: Profile = { ...withTurns([{ topics: ["boredom"] }, NOW - H]), site: "chatgpt" };
    chatgpt = core.recordSession(chatgpt, { site: "chatgpt", start: NOW - 3 * H, end: NOW - 2.5 * H });
    const v = buildView(input({
      profiles: { gemini, chatgpt },
      nudgeLog: { "2026-09-03": { gemini: 1 } },
      privacyFlags: { "2026-09-03": [{ hour: 19, site: "chatgpt", what: "message", findings: ["phone", "email"], sent: false }] },
    }));
    expect(v.sites.map((s) => [s.site, s.minutes, s.nudges, s.privacyPauses])).toEqual([["gemini", 60, 1, 0], ["chatgpt", 30, 0, 1]]);
    expect(v.minutes).toBe(90);
    expect(v.privacy).toEqual({ total: 1, kinds: [{ finding: "phone", count: 1 }, { finding: "email", count: 1 }] });
  });

  it("notes late-night use and relationship signals without saying 'you' or 'your child'", () => {
    const late = BASE + 2 * DAY + 23.5 * H; // 2026-09-03 23:30, after NOW's hour but the same day
    const gemini = withTurns(...Array.from({ length: 5 }, (_, i) => [{ dependency: i < 2 }, late - i * 60_000] as [Parameters<typeof labels>[0], number]));
    const v = buildView(input({ profiles: { gemini }, now: late + H / 4 }));
    expect(v.lateNight.share).toBe(1);
    expect(v.insights).toContain("100% of messages were sent between 11pm and 5am.");
    expect(v.insights).toContain("Leaning on the chatbot in place of people came up in 2 messages.");
    expect(v.insights.join(" ")).not.toMatch(/\byou\b|\byour\b/i);
  });

  it("counts held-back messages apart from personal info, and never names a danger category", () => {
    const flag = { hour: 20, site: "chatgpt" as const, what: "message" as const, sent: false };
    const v = buildView(input({
      privacyFlags: { "2026-09-03": [
        { ...flag, findings: ["ai_relationship"] }, { ...flag, findings: ["ai_relationship"], sent: true },
        { ...flag, findings: ["unsafe"] }, { ...flag, findings: ["phone"] },
      ] },
    }));
    expect(v.heldBack).toEqual({ unsafe: 1, relationship: 1, relationshipSentAnyway: 1 });
    expect(v.privacy).toEqual({ total: 1, kinds: [{ finding: "phone", count: 1 }] });
    expect(v.insights).toContain("1 message trying to make the chatbot a friend or partner was held back.");
    expect(v.insights).toContain("1 message treating the chatbot as a friend or partner was sent after a warning.");
    expect(v.insights).toContain("1 message was held back because it looked unsafe to send to a chatbot.");
  });

  it("counts the newer feelings on the right side", () => {
    const gemini = withTurns([{ topics: ["gratitude", "calm", "exhaustion"] }, NOW - H], [{ topics: ["embarrassment", "curiosity"] }, NOW - 2 * H]);
    const v = buildView(input({ profiles: { gemini } }));
    expect(v.balance).toEqual({ hard: 2, good: 3 });
    expect(v.feelings.good.map((t) => t.topic)).toEqual(["calm", "gratitude", "curiosity"]);
  });

  it("the pattern section always covers the last 7 days, like the score", () => {
    const gemini = withTurns([{ dependency: true }, NOW - 2 * DAY], [{ topics: ["calm"] }, NOW - H]);
    const today = buildView(input({ profiles: { gemini }, range: "today" }));
    expect(today.signals.dependency).toBe(0);
    expect(today.pattern.dependency).toBe(1);
  });

  it("groups interests by category across chatbots, most first, for the chosen range", () => {
    const gemini = withTurns(
      [{ interests: ["soccer"] }, NOW - H], [{ interests: ["soccer", "math"] }, NOW - 2 * H], [{ interests: ["basketball"] }, NOW - 2 * DAY],
    );
    const chatgpt = { ...withTurns([{ interests: ["math"] }, NOW - H], [{ interests: ["physics"] }, NOW - 3 * H]), site: "chatgpt" as const };
    expect(buildView(input({ profiles: { gemini, chatgpt } })).interests).toEqual([ // a tie keeps the category order
      { category: "sports", count: 3, items: [{ interest: "soccer", count: 2 }, { interest: "basketball", count: 1 }] },
      { category: "studies", count: 3, items: [{ interest: "math", count: 2 }, { interest: "physics", count: 1 }] },
    ]);
    expect(buildView(input({ profiles: { gemini }, range: "today" })).interests).toEqual([
      { category: "sports", count: 2, items: [{ interest: "soccer", count: 2 }] },
      { category: "studies", count: 1, items: [{ interest: "math", count: 1 }] },
    ]);
  });
});
