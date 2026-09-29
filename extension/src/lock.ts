// Parent PIN that keeps Child mode on: leaving Child mode, or changing its settings, needs it.
// Hashed with PBKDF2 (WebCrypto), so the PIN itself is never stored. It stops a child switching the
// protection off from the popup; like any extension, Bridge.ai can still be removed unless the browser is
// managed (Chrome's family or school policies).
export interface PinLock { salt: string; hash: string }
// Wrong tries in a row, and until when new tries are refused.
export interface PinAttempts { failures: number; until: number }

export const MIN_PIN_LENGTH = 4;
export const MAX_FAILURES = 5;
export const LOCKOUT_MS = 5 * 60_000;
const ITERATIONS = 210_000; // OWASP's PBKDF2-HMAC-SHA256 recommendation

const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return toBase64(new Uint8Array(bits));
}

export const validPin = (pin: string) => /^\d+$/.test(pin) && pin.length >= MIN_PIN_LENGTH;

export async function makeLock(pin: string): Promise<PinLock> {
  if (!validPin(pin)) throw new Error(`The PIN must be at least ${MIN_PIN_LENGTH} digits`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toBase64(salt), hash: await derive(pin, salt) };
}

export type PinResult =
  | { ok: true; attempts: PinAttempts }
  | { ok: false; attempts: PinAttempts; retryAt?: number }; // retryAt: locked out until then

// Checks `pin` and returns the new attempt count for the caller to store.
export async function checkPin(lock: PinLock, pin: string, attempts: PinAttempts, now = Date.now()): Promise<PinResult> {
  if (attempts.until > now) return { ok: false, attempts, retryAt: attempts.until };
  if ((await derive(pin, fromBase64(lock.salt))) === lock.hash) return { ok: true, attempts: { failures: 0, until: 0 } };
  const failures = attempts.failures + 1;
  const until = failures >= MAX_FAILURES ? now + LOCKOUT_MS : 0;
  return { ok: false, attempts: { failures: until ? 0 : failures, until }, retryAt: until || undefined };
}
