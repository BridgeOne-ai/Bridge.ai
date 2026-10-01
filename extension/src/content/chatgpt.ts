// ChatGPT: privacy guard, safety gate and turns labeled by the on-device model, plus the common heartbeat.
import type { ToWorker } from "../messages";
import { markInteraction } from "./heartbeat";
import { afterSetup, startCommon } from "./common";
import { isActive } from "./active";
import { startProtection } from "./protect";
import { toWorker } from "./send";
import { SELECTORS, startChatgptAdapter } from "../adapters/chatgpt";

afterSetup(() => {
  const site = startCommon();
  if (site) {
    startProtection(site, SELECTORS);
    startChatgptAdapter((turn) => {
      if (!isActive()) return; // turned off since this tab opened
      markInteraction();
      // Shape only, never the text (open DevTools on the ChatGPT tab to see these).
      console.info(`[Bridge.ai] captured ${turn.role} message: ${turn.text.length} chars (${turn.id})`);
      const msg: ToWorker = { type: "turn", turn };
      toWorker(msg);
    });
  }
});
