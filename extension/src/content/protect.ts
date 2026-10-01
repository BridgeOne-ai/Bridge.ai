// Privacy guard + safety gate for a site with a message box (Gemini, ChatGPT).
import type { Site } from "../../../core/src/types";
import type { ToWorker } from "../messages";
import { toWorker } from "./send";
import { isActive } from "./active";
import { startPrivacyGuard } from "../privacy/guard";
import { mountShadow } from "../ui/shadow";
import * as store from "../storage";
import { checkSafety } from "../../../core/src/safety";
import { decide, type GateDecision } from "../policy";

export function startProtection(site: Site, selectors: { composer: string; sendButton: string }): void {
  // Settings can't be read from a tab cut off from the extension (reloaded), so fall back to the defaults.
  const settings = () => store.get("settings").catch(() => store.DEFAULTS.settings);
  startPrivacyGuard({
    root: mountShadow(),
    selectors,
    isActive,
    isChild: async () => (await settings()).mode === "child",
    // The service worker opens the approval window and answers once a parent decides. No answer (the
    // extension was reloaded) is a "no".
    askParent: async (what, findings) => {
      if (!chrome.runtime?.id) return false;
      const msg: ToWorker = { type: "parent-approval", site, what, findings };
      return (await chrome.runtime.sendMessage(msg).catch(() => false)) === true;
    },
    report: (what, findings, outcome) => {
      const msg: ToWorker = { type: "privacy-pause", site, what, findings, outcome };
      toWorker(msg);
    },
    // RPC to the service worker, which asks the on-device model.
    checkSafety: async (text) => {
      const msg: ToWorker = { type: "safety-check", site, text };
      // If the worker can't answer (extension reloaded, error) or takes too long, the phrase rules
      // decide here, so the user is never left with an unsent message and no card.
      const local = async (): Promise<GateDecision> => decide(await checkSafety(text, { site }), (await settings()).mode);
      const fromWorker = chrome.runtime?.id
        ? chrome.runtime.sendMessage(msg).catch(() => null)
        : Promise.resolve(null);
      const timeout = new Promise((r) => setTimeout(() => r(null), 8000));
      const verdict = (await Promise.race([fromWorker, timeout])) as GateDecision | null;
      const result = verdict && typeof verdict.block === "boolean" ? verdict : await local();
      console.info(`[Bridge.ai] safety gate: ${result.block ? "blocked" : "allowed"} (score ${result.score.toFixed(2)}, via ${verdict ? result.source : "phrase rules in the page"})`);
      return result;
    },
  });
}
