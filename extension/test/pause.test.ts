import { beforeEach, describe, expect, it } from "vitest";
import { BASE } from "../../core/test/helpers";

// An in-memory chrome.storage.local, enough for storage.ts.
let data: Record<string, unknown> = {};
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (key: string) => (key in data ? { [key]: structuredClone(data[key]) } : {}),
      set: async (items: Record<string, unknown>) => { Object.assign(data, structuredClone(items)); },
      remove: async (keys: string[]) => { for (const k of keys) delete data[k]; },
    },
  },
};

const pause = await import("../src/pause");
const mode = await import("../src/mode");
const store = await import("../src/storage");
const { buildView } = await import("../src/dashboard/data");

// BASE is 2026-09-01 00:00 UTC; tests run in UTC.
const H = 3_600_000;
const NOW = BASE + 15 * H; // 2026-09-01 15:00

beforeEach(() => { data = {}; });

describe("pause (pure)", () => {
  it("ends after an hour, at the next midnight, or never", () => {
    expect(pause.pauseEnd("hour", NOW)).toBe(NOW + H);
    expect(pause.pauseEnd("tomorrow", NOW)).toBe(BASE + 24 * H);
    expect(pause.pauseEnd("resume", NOW)).toBeNull();
  });

  it("is paused until its end, or for good when it has none", () => {
    expect(pause.isPaused(null, NOW)).toBe(false);
    expect(pause.isPaused({ since: NOW, until: NOW + H }, NOW + H - 1)).toBe(true);
    expect(pause.isPaused({ since: NOW, until: NOW + H }, NOW + H)).toBe(false);
    expect(pause.isPaused({ since: NOW, until: null }, NOW + 100 * H)).toBe(true);
  });

  it("moves a pause that ran out into the log, and forgets periods older than two weeks", () => {
    const old = { start: NOW - 20 * 24 * H, end: NOW - 19 * 24 * H };
    expect(pause.settle({ since: NOW, until: NOW + H }, [old], NOW + 2 * H)).toEqual({
      pause: null, log: [{ start: NOW, end: NOW + H }],
    });
    const active = { since: NOW, until: null };
    expect(pause.settle(active, [], NOW + H).pause).toBe(active);
  });

  it("counts paused time inside a range, the current pause included", () => {
    const log = [{ start: NOW - 3 * H, end: NOW - 2 * H }];
    expect(pause.pausedMs(log, null, NOW - 10 * H, NOW)).toBe(H);
    expect(pause.pausedMs(log, null, NOW - 2.5 * H, NOW)).toBe(H / 2); // clipped to the range
    expect(pause.pausedMs(log, { since: NOW - H, until: null }, NOW - 10 * H, NOW)).toBe(2 * H);
  });
});

describe("pause (storage)", () => {
  it("starts, reports itself, and resumes into the log", async () => {
    await pause.start("hour", NOW);
    expect(await pause.current(NOW + 1)).toEqual({ since: NOW, until: NOW + H });
    await pause.resume(NOW + H / 2);
    expect(await pause.current(NOW + H / 2)).toBeNull();
    expect(await store.get("pauseLog")).toEqual([{ start: NOW, end: NOW + H / 2 }]);
  });

  it("settles a pause that ran out when it's next read", async () => {
    await pause.start("hour", NOW);
    expect(await pause.current(NOW + 2 * H)).toBeNull();
    expect(await store.get("pause")).toBeNull();
    expect(await store.get("pauseLog")).toEqual([{ start: NOW, end: NOW + H }]);
  });

  it("needs the parent PIN only in Child mode with a PIN set", async () => {
    expect(await pause.needsPin()).toBe(false); // Child mode, no PIN yet
    await mode.setPin("4821", "4821");
    expect(await pause.needsPin()).toBe(true);
    await mode.switchTo("parent");
    expect(await pause.needsPin()).toBe(false);
  });

  it("ends when the mode changes, so a Parent-mode pause can't carry into Child mode", async () => {
    await mode.switchTo("parent");
    await pause.start("resume");
    await mode.switchTo("child");
    expect(await pause.current()).toBeNull();
  });
});

describe("dashboard", () => {
  const input = { mode: "parent" as const, now: NOW, range: "today" as const, profiles: {}, hourly: {}, nudgeLog: {}, privacyFlags: {} };

  it("shows paused time and explains the gap, even when nothing else happened", () => {
    const v = buildView({ ...input, pauseLog: [{ start: NOW - 3 * H, end: NOW - H }], pause: { since: NOW - H / 2, until: null } });
    expect(v.paused).toEqual({ minutes: 150, now: true, until: null });
    expect(v.insights).toEqual(["Tracking was paused for 2.5 hours, so nothing from that time is counted."]);
  });

  it("says nothing about pausing when there was none", () => {
    expect(buildView(input).paused).toEqual({ minutes: 0, now: false, until: null });
  });
});
