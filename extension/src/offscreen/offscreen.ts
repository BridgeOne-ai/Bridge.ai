// Hosts the model worker (model/worker.ts). An offscreen document can only use chrome.runtime, so it
// just relays: service worker requests go to the worker, and its answers and status come back.
import type { ModelReply, ToOffscreen, ToWorker } from "../messages";
import type { WorkerIn, WorkerOut } from "../model/worker";

const worker = new Worker("model-worker.js", { type: "module" });
const waiting = new Map<number, (reply: ModelReply) => void>();
let nextId = 0;

worker.addEventListener("message", (e: MessageEvent<WorkerOut>) => {
  if ("status" in e.data) {
    const msg: ToWorker = { type: "model-status", status: e.data.status };
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }
  waiting.get(e.data.id)?.(e.data.reply);
  waiting.delete(e.data.id);
});

chrome.runtime.onMessage.addListener((msg: ToOffscreen, _sender, sendResponse) => {
  if (msg?.target !== "model") return false;
  const id = nextId++;
  waiting.set(id, sendResponse);
  worker.postMessage({ id, req: msg.req } satisfies WorkerIn);
  return true; // answered asynchronously
});
