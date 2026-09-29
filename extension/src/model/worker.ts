// The on-device model. A Web Worker started by the offscreen document (offscreen/offscreen.ts), because
// ONNX Runtime loads its WASM with import(), which Chrome doesn't allow in extension service workers.
// Message text arrives here, is scored in memory, and only labels go back. Nothing here stores text or
// sends it anywhere: the only network use is the one-time model download from Hugging Face.
import { env } from "@huggingface/transformers";
import { createStore, get, set } from "idb-keyval";
import { labelTurn } from "../../../core/src/labeler";
import { checkSafety } from "../../../core/src/safety";
import { createMatcher, type Matcher } from "../../../core/src/semantic/matcher";
import { loadEmbedder } from "../../../core/src/semantic/model";
import { MODEL_ID } from "../../../core/src/config";
import type { ModelReply, ModelRequest, ModelStatus } from "../messages";

// Worker ⇄ offscreen document protocol.
export type WorkerIn = { id: number; req: ModelRequest };
export type WorkerOut = { id: number; reply: ModelReply } | { status: ModelStatus };

// ONNX Runtime's WASM ships inside the extension (build.mjs copies it to dist/ort/): an extension
// may not run code from a CDN, which is where Transformers.js would fetch it from otherwise.
const ort = (file: string) => new URL(`/ort/${file}`, self.location.origin).href;
env.backends.onnx.wasm!.wasmPaths = { mjs: ort("ort-wasm-simd-threaded.asyncify.mjs"), wasm: ort("ort-wasm-simd-threaded.asyncify.wasm") };
// Otherwise Transformers.js re-serves those files from a blob: URL, which an extension may not import.
// (It skips that itself when it sees chrome.*, but a worker has no chrome.*.) They're local anyway.
env.useWasmCache = false;
// Transformers.js asks for a "high-performance" GPU. Chrome ignores that on Windows and logs a warning
// on every load (crbug.com/369219127), which shows up on chrome://extensions as an error. Ask for none.
if (env.backends.onnx.webgpu) env.backends.onnx.webgpu.powerPreference = undefined;
env.allowLocalModels = false; // the model comes from the Hugging Face Hub once, then the browser cache

// Example vectors (semantic/labels.ts) take a while to compute on a slow machine, so they're kept.
const idb = createStore("bridge-model", "examples");
const cache = { get: (k: string) => get<Float32Array[]>(k, idb), set: (k: string, v: Float32Array[]) => set(k, v, idb) };

const status = (s: ModelStatus) => postMessage({ status: s } satisfies WorkerOut);

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return !!(await gpu?.requestAdapter().catch(() => null));
}

async function load(): Promise<Matcher> {
  const onProgress = (p: number) => status({ state: "loading", progress: Math.round(p) });
  status({ state: "loading", progress: 0 });
  let device: "webgpu" | "wasm" = (await hasWebGpu()) ? "webgpu" : "wasm";
  let embed;
  try {
    embed = await loadEmbedder({ device, onProgress });
  } catch (e) {
    if (device === "wasm") throw e;
    console.warn(`[Bridge.ai] WebGPU model failed, using WASM: ${String(e)}`);
    device = "wasm";
    embed = await loadEmbedder({ device, onProgress });
  }
  // The WebGPU and WASM builds are different files, so each keeps its own example vectors.
  const matcher = createMatcher(embed, { modelId: `${MODEL_ID}:${device}`, cache });
  await matcher.score("hello"); // computes (or loads) the example vectors now, not on the first message
  status({ state: "ready", device });
  return matcher;
}

let matcher: Matcher | null = null;
let loading: Promise<void> | null = null;
function start() {
  loading ??= load()
    .then((m) => { matcher = m; })
    .catch((e) => {
      loading = null; // the next request tries again (for example, after coming back online)
      console.warn(`[Bridge.ai] model failed to load: ${String(e)}`);
      status({ state: "error", message: String(e instanceof Error ? e.message : e) });
    });
}

async function answer(req: ModelRequest): Promise<ModelReply> {
  start();
  if (req.kind === "warmup") return true;
  if (!matcher) return null; // still downloading: the service worker uses the phrase rules meanwhile
  if (req.kind === "label") return labelTurn(req.user, req.bot, { matcher });
  return checkSafety(req.text, { site: req.site, matcher });
}

addEventListener("message", (e: MessageEvent<WorkerIn>) => {
  const { id, req } = e.data;
  answer(req)
    .catch((err) => { console.warn(`[Bridge.ai] model ${req.kind} failed: ${String(err)}`); return null; })
    .then((reply) => postMessage({ id, reply } satisfies WorkerOut));
});
