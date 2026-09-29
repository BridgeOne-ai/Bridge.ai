// Switching between Parent and Child mode, shared by the popup and the Options page. Turning Child mode
// on never needs the PIN (it only adds protection); turning it off, or changing its settings, does.
import { checkPin, makeLock } from "./lock";
import * as store from "./storage";
import type { Mode } from "./storage";

export type Unlock = { ok: true } | { ok: false; message: string };

// Needed before leaving Child mode or changing its settings. No PIN set yet: always unlocked.
export async function unlock(pin: string): Promise<Unlock> {
  const lock = await store.get("lock");
  if (!lock) return { ok: true };
  const result = await checkPin(lock, pin, await store.get("pinAttempts"));
  await store.set("pinAttempts", result.attempts);
  if (result.ok) return { ok: true };
  return {
    ok: false,
    message: result.retryAt ? `Too many tries. Try again at ${new Date(result.retryAt).toLocaleTimeString()}.` : "That PIN isn't right.",
  };
}

// What the user has to do before switching to `to`.
export async function needs(to: Mode): Promise<"nothing" | "new-pin" | "pin"> {
  const [{ mode }, lock] = await Promise.all([store.get("settings"), store.get("lock")]);
  if (to === mode) return "nothing";
  if (to === "child") return lock ? "nothing" : "new-pin";
  return lock ? "pin" : "nothing";
}

export async function setPin(pin: string, again: string): Promise<Unlock> {
  if (pin !== again) return { ok: false, message: "The two PINs don't match." };
  try {
    await store.set("lock", await makeLock(pin));
    await store.set("pinAttempts", { failures: 0, until: 0 });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Call after needs(to) is satisfied (setPin or unlock succeeded).
export async function switchTo(to: Mode): Promise<void> {
  await store.set("settings", { ...(await store.get("settings")), mode: to });
}
