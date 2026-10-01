// Parent approval window (approve.html), opened by the service worker when a child asks to send
// something as typed in Child mode. The PIN is checked here, in Bridge.ai's own page, so the chat site
// never sees it. Shows the kind of information only, never the message.
import type { Site } from "../../../core/src/types";
import type { ToWorker } from "../messages";
import type { Finding } from "../privacy/detect";
import { FINDING_LABEL } from "../privacy/detect";
import * as mode from "../mode";
import * as store from "../storage";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SITE_NAME: Record<Site, string> = { gemini: "Gemini", chatgpt: "ChatGPT", claude: "Claude", characterai: "Character.AI" };
const listOf = (items: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(items);

const id = Number(new URLSearchParams(location.search).get("id"));
const answer = (approved: boolean) => {
  const msg: ToWorker = { type: "approval-result", id, approved };
  void chrome.runtime.sendMessage(msg).catch(() => {}).finally(() => window.close());
};

function expired(text: string) {
  $("what").textContent = text;
  $("form").hidden = true;
}

async function start() {
  const details = (await chrome.runtime.sendMessage({ type: "approval-details", id } satisfies ToWorker)) as
    { site: Site; what: "message" | "file"; findings: Finding[] } | null;
  if (!details) return expired("This request has ended. Ask again from the chat if it's still needed.");
  if (!(await store.get("lock"))) return expired("No parent PIN is set yet. Set one in Bridge.ai's options first.");
  const thing = details.what === "file" ? "a file" : "a message";
  const about = listOf(details.findings.map((f) => FINDING_LABEL[f]));
  $("what").textContent = `${thing[0].toUpperCase()}${thing.slice(1)} on ${SITE_NAME[details.site]} was held back for: ${about}. Send it as typed?`;
  $("pin").focus();
}

$("deny").addEventListener("click", () => answer(false));
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const result = await mode.unlock($<HTMLInputElement>("pin").value);
  $<HTMLInputElement>("pin").value = "";
  if (result.ok) return answer(true);
  $("error").textContent = result.message;
});

void start();
