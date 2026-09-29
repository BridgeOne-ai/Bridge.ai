// Options: Parent/Child mode and the parent PIN, the account Child mode syncs to, and settings.
// In Child mode with a PIN set, everything below the mode section needs the PIN first.
import type { ToWorker } from "../messages";
import * as store from "../storage";
import * as mode from "../mode";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);

let unlocked = false; // this page only; closing it locks again

async function render() {
  const [settings, lock] = await Promise.all([store.get("settings"), store.get("lock")]);
  const child = settings.mode === "child";
  $("mode-now").innerHTML = child ? "<b>Child mode</b> is on." : "<b>Parent mode</b> is on.";
  $("mode-about").textContent = child
    ? "Messages that look dangerous are held back before the chatbot gets them, personal info is paused, and the week's topics (never words) are shared with the parent dashboard."
    : "Bridge.ai tracks your own feelings in AI chats, on this computer only. Nothing is shared and no message is blocked.";
  $("no-pin").hidden = !child || !!lock;
  $("to-parent").hidden = !child;
  $("to-child").hidden = child;

  const gated = child && !!lock && !unlocked;
  $("locked").hidden = !gated;
  $("unlocked").hidden = gated;
  $("account").hidden = !child;
  for (const e of document.querySelectorAll<HTMLElement>(".child-only")) e.hidden = !child;

  input("nudges").checked = settings.nudgesEnabled;
  input("strict").checked = settings.privacyStrict;
  input("api").value = settings.apiUrl;
  input("child").value = settings.childId;
  $("device").textContent = await store.deviceId();
  await showAuth();
  await showSyncStatus();
  await showModel();
}

// Updated on its own, so download progress doesn't reset fields someone is editing.
async function showModel() {
  const model = await store.get("modelStatus");
  $("model").textContent = model.state === "ready"
    ? `Ready, running on this computer (${model.device === "webgpu" ? "graphics card" : "processor"}). Messages are read here and never sent anywhere.`
    : model.state === "loading"
    ? `Downloading the model once (about 200 MB): ${model.progress}%. Until then, only the built-in phrase checks run.`
    : `Couldn't load the model (${model.message}), so only the built-in phrase checks run. It tries again on the next message.`;
}

// ---- mode and PIN (mode.ts) ----

// One form for every PIN step: `current` asks for the existing PIN, `fresh` for a new one (twice).
let onPin: ((current: string, fresh: string, again: string) => Promise<mode.Unlock>) | null = null;
function pinForm(opts: { current: boolean; fresh: boolean; run: typeof onPin } | null) {
  onPin = opts?.run ?? null;
  $("pin").hidden = !opts;
  $("pin-error").textContent = "";
  for (const id of ["pin-1", "pin-2", "pin-3"]) input(id).value = "";
  if (!opts) return;
  $("pin-label").textContent = "Parent PIN";
  for (const id of ["pin-label", "pin-1"]) $(id).hidden = !opts.current;
  for (const id of ["pin-2-label", "pin-2", "pin-3-label", "pin-3"]) $(id).hidden = !opts.fresh;
  input(opts.current ? "pin-1" : "pin-2").focus();
}

$("pin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const result = await onPin?.(input("pin-1").value, input("pin-2").value, input("pin-3").value);
  if (result && !result.ok) { $("pin-error").textContent = result.message; return; }
  unlocked = true; // they just entered or chose the PIN, so don't ask again on this page
  pinForm(null);
  await render();
});
$("pin-cancel").addEventListener("click", () => pinForm(null));

async function switchTo(to: store.Mode) {
  const need = await mode.needs(to);
  const done = async (r: mode.Unlock) => { if (r.ok) await mode.switchTo(to); return r; };
  if (need === "nothing") { pinForm(null); await mode.switchTo(to); return render(); }
  if (need === "new-pin") pinForm({ current: false, fresh: true, run: async (_c, p, again) => done(await mode.setPin(p, again)) });
  else pinForm({ current: true, fresh: false, run: async (c) => done(await mode.unlock(c)) });
}
$("to-parent").addEventListener("click", () => void switchTo("parent"));
$("to-child").addEventListener("click", () => void switchTo("child"));

$("change-pin").addEventListener("click", async () => {
  const hasPin = !!(await store.get("lock"));
  pinForm({
    current: hasPin, fresh: true,
    run: async (current, fresh, again) => {
      const ok = await mode.unlock(current); // no PIN yet: always ok
      return ok.ok ? mode.setPin(fresh, again) : ok;
    },
  });
});

$("unlock").addEventListener("submit", async (e) => {
  e.preventDefault();
  const result = await mode.unlock(input("unlock-pin").value);
  input("unlock-pin").value = "";
  $("unlock-error").textContent = result.ok ? "" : result.message;
  if (result.ok) { unlocked = true; await render(); }
});

// ---- account (api/auth.py). Logs in with the settings' API URL, so save a changed URL first. ----

async function showAuth() {
  const auth = await store.get("auth");
  $("logged-out").hidden = !!auth;
  $("logged-in").hidden = !auth;
  $("who").textContent = auth?.email ?? "";
}

async function authRequest(path: "login" | "signup") {
  const { apiUrl } = await store.get("settings");
  $("auth-out").textContent = "…";
  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/auth/${path}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: input("email").value.trim(), password: input("password").value }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      $("auth-out").textContent = typeof body.detail === "string" ? body.detail : "Enter a valid email and a password of at least 8 characters";
      return;
    }
    await store.set("auth", { token: body.token, email: body.email });
    input("password").value = "";
    $("auth-out").textContent = "";
    await showAuth();
    const msg: ToWorker = { type: "sync-now" };
    void chrome.runtime.sendMessage(msg).catch(() => {});
  } catch (e) {
    $("auth-out").textContent = `API unreachable at ${apiUrl} (${String(e)})`;
  }
}

$("login").addEventListener("click", () => void authRequest("login"));
$("signup").addEventListener("click", () => void authRequest("signup"));
$("logout").addEventListener("click", async () => {
  const [{ apiUrl }, auth] = await Promise.all([store.get("settings"), store.get("auth")]);
  if (auth) {
    await fetch(`${apiUrl.replace(/\/+$/, "")}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${auth.token}` } }).catch(() => {});
  }
  await store.set("auth", null);
  await showAuth();
});

async function showSyncStatus() {
  const st = await store.get("syncStatus");
  $("sync-out").textContent = st ? `${st.ok ? "OK" : "Failed"}, ${new Date(st.at).toLocaleTimeString()}: ${st.message}` : "not synced yet";
}
$("sync").addEventListener("click", () => {
  $("sync-out").textContent = "…";
  const msg: ToWorker = { type: "sync-now" };
  void chrome.runtime.sendMessage(msg).catch(() => {});
});

// ---- settings ----

$("save").addEventListener("click", async () => {
  const current = await store.get("settings");
  const d = store.DEFAULTS.settings;
  await store.set("settings", {
    mode: current.mode,
    nudgesEnabled: input("nudges").checked,
    privacyStrict: input("strict").checked,
    apiUrl: input("api").value.trim() || d.apiUrl,
    childId: input("child").value.trim() || d.childId,
  });
  $("saved").textContent = "Saved";
  setTimeout(() => ($("saved").textContent = ""), 1500);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.syncStatus) void showSyncStatus();
  if (changes.modelStatus) void showModel();
  if (changes.settings || changes.lock || changes.auth) void render();
});
void render();
