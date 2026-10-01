// Shared by every content script: heartbeat, nudge UI, and the "Monitored by Bridge.ai" pill.
import type { Site } from "../../../core/src/types";
import type { ToContent } from "../messages";
import { siteFromHost, startHeartbeat } from "./heartbeat";
import { mountShadow } from "../ui/shadow";
import { showNudge } from "../ui/nudge";
import { showStatus, statusText } from "../ui/status";
import * as store from "../storage";
import { isPaused } from "../pause";
import { isActive, setActive } from "./active";

// Runs `start` once setup is finished (the consent screen in options.html). Until then Bridge.ai does
// nothing on the page: no reading, no checks, no time counted. Starts on its own when setup completes.
// Turned off later (consent withdrawn), it stops acting and removes its notice at once (active.ts).
export function afterSetup(start: () => void): void {
  let started = false;
  const go = (consent: store.Store["consent"]) => {
    const ok = store.hasConsent(consent);
    setActive(ok);
    // Hidden, not removed: turned back on, the same listeners and notice carry on.
    document.getElementById("bridge-root")?.style.setProperty("display", ok ? "" : "none");
    if (!ok || started) return;
    started = true;
    start();
  };
  void store.get("consent").then(go).catch(() => {}); // cut off from a reloaded extension: stay off
  chrome.storage.onChanged.addListener((changes) => { if (changes.consent) go(changes.consent.newValue ?? null); });
}

export function startCommon(): Site | null {
  const site = siteFromHost();
  if (!site) return null;
  const root = mountShadow();
  startHeartbeat(site);
  chrome.runtime.onMessage.addListener((msg: ToContent) => {
    if (msg.type === "show-nudge" && isActive()) showNudge(root, msg.variant);
  });

  let pauseEnds: ReturnType<typeof setTimeout> | undefined;
  const status = async () => {
    const [{ mode }, pause] = await Promise.all([store.get("settings"), store.get("pause")]);
    const paused = isPaused(pause, Date.now());
    showStatus(root, statusText(site, mode, paused), paused);
    // A timed pause ends on its own: show that too.
    clearTimeout(pauseEnds);
    if (paused && pause.until !== null) pauseEnds = setTimeout(() => void status().catch(() => {}), pause.until - Date.now() + 1_000);
  };
  void status().catch(() => {}); // extension reloaded under this tab: nothing to show
  chrome.storage.onChanged.addListener((changes) => { if (changes.settings || changes.pause) void status().catch(() => {}); });
  return site;
}
