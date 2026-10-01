// Builds the extension into dist/.
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  target: "chrome120",
  sourcemap: true,
  logLevel: "info",
  alias: { "@bridge/core": "../core/src/index.ts" },
};

const entries = [
  { in: "src/background/service-worker.ts", out: "background", format: "esm" },
  { in: "src/content/gemini.ts", out: "content-gemini", format: "iife" },
  { in: "src/content/chatgpt.ts", out: "content-chatgpt", format: "iife" },
  { in: "src/content/session-only.ts", out: "content-session", format: "iife" },
  { in: "src/offscreen/offscreen.ts", out: "offscreen", format: "iife" },
  // A module worker: ONNX Runtime loads its WASM glue with import().
  { in: "src/model/worker.ts", out: "model-worker", format: "esm" },
  { in: "src/popup/popup.ts", out: "popup", format: "iife" },
  { in: "src/options/options.ts", out: "options", format: "iife" },
  { in: "src/approve/approve.ts", out: "approve", format: "iife" },
  { in: "src/dashboard/dashboard.ts", out: "dashboard", format: "iife" },
  // The dashboard's styles, with its fonts (Inter, JetBrains Mono) bundled next to it.
  { in: "src/dashboard/dashboard.css", out: "dashboard", ext: "css" },
];

// ONNX Runtime's WASM build, the one Transformers.js loads (model/worker.ts points it here). Taken from
// the onnxruntime-web that Transformers.js itself depends on, so the versions always match.
const require = createRequire(join(process.cwd(), "../core/package.json"));
const ortDist = dirname(require.resolve("onnxruntime-web", { paths: [dirname(require.resolve("@huggingface/transformers"))] }));
const ORT_FILES = ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"];

function copyStatic() {
  cpSync("static", "dist", { recursive: true });
  mkdirSync("dist/ort", { recursive: true });
  for (const f of ORT_FILES) cpSync(join(ortDist, f), `dist/ort/${f}`);
}

const copyPlugin = { name: "copy-static", setup: (b) => b.onEnd(copyStatic) };

// Start clean, so files from removed entries don't linger in dist/.
if (!watch) rmSync("dist", { recursive: true, force: true });

const contexts = await Promise.all(
  entries.map((e) =>
    esbuild.context({
      ...common, entryPoints: [e.in], outfile: `dist/${e.out}.${e.ext ?? "js"}`, format: e.format, plugins: [copyPlugin],
      loader: { ".woff2": "file", ".woff": "file" }, assetNames: "fonts/[name]-[hash]",
    }),
  ),
);

if (watch) {
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("watching");
} else {
  await Promise.all(contexts.map((c) => c.rebuild()));
  await Promise.all(contexts.map((c) => c.dispose()));
  console.log("built dist/");
}
