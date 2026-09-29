// Shared by every content script: heartbeat and nudge UI.
import type { Site } from "../../../core/src/types";
import type { ToContent } from "../messages";
import { siteFromHost, startHeartbeat } from "./heartbeat";
import { mountShadow } from "../ui/shadow";
import { showNudge } from "../ui/nudge";

export function startCommon(): Site | null {
  const site = siteFromHost();
  if (!site) return null;
  const root = mountShadow();
  startHeartbeat(site);
  chrome.runtime.onMessage.addListener((msg: ToContent) => {
    if (msg.type === "show-nudge") showNudge(root, msg.variant);
  });
  return site;
}
