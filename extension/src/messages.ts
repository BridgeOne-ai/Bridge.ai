import type { Site, Turn, TurnLabels } from "../../core/src/types";
import type { SafetyVerdict } from "../../core/src/safety";
import type { Finding } from "./privacy/detect";
import type { PauseOutcome } from "./ui/privacy";

// content script / popup / options → service worker
export type ToWorker =
  | { type: "turn"; turn: Turn }
  | { type: "heartbeat"; site: Site; ts: number; interacting: boolean }
  // Child mode: may this be sent as typed? The service worker opens the parent approval window
  // (approve.html) and answers true once a parent enters the PIN there. Kinds of info only, never text.
  | { type: "parent-approval"; site: Site; what: "message" | "file"; findings: Finding[] }
  // approve.html: what is it asking about, and the parent's answer
  | { type: "approval-details"; id: number }
  | { type: "approval-result"; id: number; approved: boolean }
  // privacy guard paused a message or upload. Kinds of info only, never the values.
  | { type: "privacy-pause"; site: Site; what: "message" | "file"; findings: Finding[]; outcome: PauseOutcome }
  // safety gate RPC: may this message go to the chatbot? Answered with a SafetyVerdict. The text is
  // only scored by the on-device model and is never stored.
  | { type: "safety-check"; site: Site; text: string }
  // offscreen document → service worker: how the on-device model is doing
  | { type: "model-status"; status: ModelStatus };

// service worker → content script (chrome.tabs.sendMessage to the sender tab)
export type ToContent = { type: "show-nudge"; variant: number };

// service worker → offscreen document → model worker (model/worker.ts)
export type ModelRequest =
  | { kind: "label"; user: Turn; bot: Turn | null }
  | { kind: "safety"; site: Site; text: string }
  | { kind: "warmup" };
export type ModelAnswer = { label: TurnLabels; safety: SafetyVerdict; warmup: true };
export type ToOffscreen = { target: "model"; req: ModelRequest };
// null: the model isn't ready yet (still downloading, or failed), so the caller uses the phrase rules.
export type ModelReply<K extends ModelRequest["kind"] = ModelRequest["kind"]> = ModelAnswer[K] | null;

export type ModelStatus =
  | { state: "loading"; progress: number } // 0..100, first download only
  | { state: "ready"; device: "webgpu" | "wasm" }
  | { state: "error"; message: string };

export const SITE_BY_HOST: Record<string, Site> = {
  "chatgpt.com": "chatgpt",
  "claude.ai": "claude",
  "character.ai": "characterai",
  "gemini.google.com": "gemini",
};
