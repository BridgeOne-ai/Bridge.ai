import { describe, expect, it } from "vitest";
import { checkPin, LOCKOUT_MS, makeLock, MAX_FAILURES, validPin, type PinAttempts } from "../src/lock";

const fresh: PinAttempts = { failures: 0, until: 0 };

describe("parent PIN", () => {
  it("accepts the right PIN and never stores it", async () => {
    const lock = await makeLock("4821");
    expect(JSON.stringify(lock)).not.toContain("4821");
    expect(await checkPin(lock, "4821", fresh)).toMatchObject({ ok: true });
    expect(await checkPin(lock, "4822", fresh)).toMatchObject({ ok: false, attempts: { failures: 1 } });
  });

  it("salts each PIN, so the same PIN hashes differently", async () => {
    const [a, b] = await Promise.all([makeLock("4821"), makeLock("4821")]);
    expect(a.hash).not.toBe(b.hash);
  });

  it("needs at least 4 digits", async () => {
    expect(validPin("123")).toBe(false);
    expect(validPin("12a4")).toBe(false);
    expect(validPin("1234")).toBe(true);
    await expect(makeLock("12")).rejects.toThrow("at least 4 digits");
  });

  it(`locks out for a while after ${MAX_FAILURES} wrong tries, even for the right PIN`, async () => {
    const lock = await makeLock("4821");
    const now = 1_000_000;
    let attempts = fresh;
    for (let i = 0; i < MAX_FAILURES; i++) attempts = (await checkPin(lock, "0000", attempts, now)).attempts;
    expect(attempts.until).toBe(now + LOCKOUT_MS);
    expect(await checkPin(lock, "4821", attempts, now + 1000)).toMatchObject({ ok: false, retryAt: now + LOCKOUT_MS });
    expect(await checkPin(lock, "4821", attempts, now + LOCKOUT_MS + 1)).toMatchObject({ ok: true, attempts: fresh });
  });

  it("a right PIN clears earlier wrong tries", async () => {
    const lock = await makeLock("4821");
    const { attempts } = await checkPin(lock, "0000", fresh);
    expect((await checkPin(lock, "4821", attempts)).attempts).toEqual(fresh);
  });
});
