// Options: setup and consent (nothing is read on any site before it), Parent/Child mode and the parent
// PIN, and settings. In Child mode with a PIN set, everything below the mode section needs the PIN first.
import * as store from "../storage";
import * as mode from "../mode";
import * as pause from "../pause";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);

let unlocked = false; // this page only; closing it locks again

async function render() {
  const [settings, lock, consent] = await Promise.all([store.get("settings"), store.get("lock"), store.get("consent")]);
  const ready = store.hasConsent(consent);
  $("setup").hidden = ready;
  $("main").hidden = !ready;
  await showModel();
  if (!ready) return renderSetup(!!lock);

  const child = settings.mode === "child";
  $("mode-now").innerHTML = child ? "<b>Child mode</b> is on." : "<b>Parent mode</b> is on.";
  $("mode-about").textContent = child
    ? "Messages that look risky are held back before the chatbot gets them, and a parent can approve some with the PIN. Nothing the child writes leaves this computer; a parent sees only what was held back."
    : "Bridge.ai tracks your own feelings in AI chats, on this computer only. Nothing is shared and no message is blocked.";
  $("no-pin").hidden = !child || !!lock;
  $("to-parent").hidden = !child;
  $("to-child").hidden = child;

  const gated = child && !!lock && !unlocked;
  $("locked").hidden = !gated;
  $("unlocked").hidden = gated;
  input("nudges").checked = settings.nudgesEnabled;
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

// ---- setup and consent ----

let hasLock = false;
const chosen = () => document.querySelector<HTMLInputElement>('input[name="who"]:checked')?.value as store.Mode | undefined;

function renderSetup(lock: boolean) {
  hasLock = lock;
  const who = chosen();
  // A PIN that already exists (Child mode was set up before) is asked for; otherwise Child mode makes one.
  $("setup-old-pin").hidden = !who || !lock;
  $("setup-new-pin").hidden = who !== "child" || lock;
  $<HTMLButtonElement>("start").disabled = !who || !input("agree").checked;
}
for (const el of document.querySelectorAll('input[name="who"], #agree')) el.addEventListener("change", () => renderSetup(hasLock));

$("start").addEventListener("click", async () => {
  const who = chosen();
  if (!who || !input("agree").checked) return;
  $("setup-error").textContent = "";
  if (hasLock) {
    const ok = await mode.unlock(input("setup-pin-old").value);
    input("setup-pin-old").value = "";
    if (!ok.ok) { $("setup-error").textContent = ok.message; return; }
  } else if (who === "child") {
    const made = await mode.setPin(input("setup-pin-1").value, input("setup-pin-2").value);
    if (!made.ok) { $("setup-error").textContent = made.message; return; }
  }
  unlocked = true;
  await mode.switchTo(who);
  await store.set("consent", { at: Date.now(), version: store.CONSENT_VERSION, mode: who });
  await render();
});

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

// ---- settings ----

$("save").addEventListener("click", async () => {
  const current = await store.get("settings");
  await store.set("settings", { ...current, nudgesEnabled: input("nudges").checked });
  $("saved").textContent = "Saved";
  setTimeout(() => ($("saved").textContent = ""), 1500);
});

// Withdraws consent: every chat tab stops (content scripts check it), and the kept data is deleted.
// In Child mode this section is only reachable with the PIN.
$("turn-off").addEventListener("click", async () => {
  if (!confirm("Turn Bridge.ai off and delete what it kept on this computer?")) return;
  await pause.resume();
  await store.resetData();
  await store.set("consent", null);
  await render();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.modelStatus) void showModel();
  if (changes.settings || changes.lock || changes.consent) void render();
});
void render();
