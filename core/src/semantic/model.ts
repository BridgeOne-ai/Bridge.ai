// Loads the on-device embedding model with Transformers.js. Kept out of index.ts so the extension's
// service worker bundle doesn't pull the library in: only the model worker and the Node CLI import it.
import { pipeline, type ProgressInfo } from "@huggingface/transformers";
import { MODEL_DTYPE, MODEL_ID, QUERY_PREFIX } from "../config.js";
import type { Embed } from "./matcher.js";

const BATCH = 16;

export interface LoadOptions {
  device?: "webgpu" | "wasm" | "cpu"; // default: the library's choice for the platform
  onProgress?: (percent: number) => void; // first download only; later loads come from the cache
}

export async function loadEmbedder(opts: LoadOptions = {}): Promise<Embed> {
  const extract = await pipeline("feature-extraction", MODEL_ID, {
    dtype: MODEL_DTYPE,
    device: opts.device,
    // The browser's WASM runtime lacks the quantized Gather operator the default q4 file uses; the
    // model ships a variant without it for this.
    model_file_name: opts.device === "wasm" ? "model_no_gather" : undefined,
    progress_callback: (p: ProgressInfo) => { if (p.status === "progress_total") opts.onProgress?.(p.progress); },
  });
  return async (texts) => {
    const vectors: Float32Array[] = [];
    // In batches: one call with all ~300 label examples overflows the browser's 32-bit WASM memory.
    for (let start = 0; start < texts.length; start += BATCH) {
      const batch = texts.slice(start, start + BATCH).map((t) => QUERY_PREFIX + t);
      const out = await extract(batch, { pooling: "mean", normalize: true });
      const [n, d] = out.dims as [number, number];
      const data = out.data as Float32Array;
      for (let i = 0; i < n; i++) vectors.push(data.slice(i * d, (i + 1) * d));
    }
    return vectors;
  };
}
