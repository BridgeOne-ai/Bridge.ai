import type { ToWorker } from "../messages";
import { markInteraction } from "./heartbeat";
import { afterSetup, startCommon } from "./common";
import { isActive } from "./active";
import { startProtection } from "./protect";
import { toWorker } from "./send";
import { SELECTORS, startGeminiAdapter } from "../adapters/gemini";

afterSetup(() => {
  const site = startCommon();
  if (site) {
    startProtection(site, SELECTORS);
    startGeminiAdapter((turn) => {
      if (!isActive()) return; // turned off since this tab opened
      markInteraction();
      // Shape only, never the text (open DevTools on the Gemini tab to see these).
      console.info(`[Bridge.ai] captured ${turn.role} message: ${turn.text.length} chars (${turn.id})`);
      const msg: ToWorker = { type: "turn", turn };
      toWorker(msg);
    });
  }
});
