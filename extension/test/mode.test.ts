import { beforeEach, describe, expect, it } from "vitest";

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

const mode = await import("../src/mode");
const store = await import("../src/storage");

beforeEach(() => { data = {}; });

describe("switching modes", () => {
  it("starts in Child mode, so a forgotten install protects the child", async () => {
    expect((await store.get("settings")).mode).toBe("child");
  });

  it("needs a new PIN to turn Child mode on the first time, and none after that", async () => {
    await mode.switchTo("parent");
    expect(await mode.needs("child")).toBe("new-pin");
    expect(await mode.setPin("4821", "4812")).toMatchObject({ ok: false, message: "The two PINs don't match." });
    expect(await mode.setPin("4821", "4821")).toEqual({ ok: true });
    expect(await mode.needs("child")).toBe("nothing");
  });

  it("needs the PIN to leave Child mode once one is set", async () => {
    expect(await mode.needs("parent")).toBe("nothing"); // no PIN yet
    await mode.setPin("4821", "4821");
    expect(await mode.needs("parent")).toBe("pin");
    expect(await mode.unlock("1111")).toEqual({ ok: false, message: "That PIN isn't right." });
    expect(await mode.unlock("4821")).toEqual({ ok: true });
  });

  it("keeps the other settings when switching", async () => {
    await store.set("settings", { ...(await store.get("settings")), nudgesEnabled: false });
    await mode.switchTo("parent");
    expect(await store.get("settings")).toEqual({ mode: "parent", nudgesEnabled: false });
  });

  it("drops settings left over from versions that synced to a server", async () => {
    data.settings = { mode: "parent", nudgesEnabled: true, apiUrl: "http://localhost:8000", childId: "demo", privacyStrict: true };
    expect(await store.get("settings")).toEqual({ mode: "parent", nudgesEnabled: true });
  });
});
