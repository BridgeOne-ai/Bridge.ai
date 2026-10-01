// "Monitored by Bridge.ai" pill on every chatbot page Bridge.ai covers. Visible, not covert (docs/DESIGN.md):
// it shows what's happening for a few seconds, then shrinks to a shield that opens again on hover or focus.
// It never goes away completely, so nobody is watched without knowing it.
import type { Site } from "../../../core/src/types";
import type { Mode } from "../storage";
import { el } from "./shadow";

// Sites where messages are read (the others only count time: content/session-only.ts).
const READS: readonly Site[] = ["gemini", "chatgpt"];
const OPEN_MS = 6_000;

const SHIELD = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/>
  <path d="M9 12l2 2 4-4"/></svg>`;

export function statusText(site: Site, mode: Mode, paused: boolean): { title: string; line: string } {
  if (paused) return { title: "Bridge.ai is paused", line: "Nothing is recorded. Safety checks still run." };
  if (!READS.includes(site)) return { title: "Monitored by Bridge.ai", line: "Only time is counted here. Messages aren't read." };
  return mode === "child"
    ? { title: "Protected by Bridge.ai", line: "Nothing you write leaves this computer. A parent sees only what was held back." }
    : { title: "Monitored by Bridge.ai", line: "Privacy protected: your words never leave this computer." };
}

let collapse: ReturnType<typeof setTimeout> | undefined;

// Draws or updates the pill, opened for a moment so a change of state is noticed.
export function showStatus(root: ShadowRoot, text: { title: string; line: string }, paused: boolean): void {
  let pill = root.querySelector<HTMLElement>(".status");
  if (!pill) {
    pill = el("div", "status");
    pill.tabIndex = 0;
    pill.setAttribute("role", "status");
    const icon = el("span", "shield");
    icon.innerHTML = SHIELD; // constant markup, no page or user data
    const words = el("span", "words");
    words.append(el("b"), el("span", "line"));
    pill.append(icon, words);
    root.appendChild(pill);
  }
  pill.querySelector("b")!.textContent = text.title;
  pill.querySelector(".line")!.textContent = text.line;
  pill.setAttribute("aria-label", `${text.title}. ${text.line}`);
  pill.title = `${text.title}. ${text.line}`;
  pill.classList.toggle("paused", paused);
  pill.classList.add("open");
  clearTimeout(collapse);
  collapse = setTimeout(() => pill!.classList.remove("open"), OPEN_MS);
}
