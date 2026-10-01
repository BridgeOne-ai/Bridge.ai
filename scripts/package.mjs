// Builds the extension and zips it for the website's Download button (GitHub Releases).
//   npm run package   →   release/bridge-ai-extension.zip  (the name the website links to)
//                         release/bridge-ai-<version>.zip   (the same, kept per version)
// The zip holds one folder, "bridge-ai", which is what people pick in Chrome's "Load unpacked".
// Source maps are left out: they double the size and aren't needed to run it.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "extension/dist");
const out = join(root, "release");
const folder = join(out, "bridge-ai");
const { version } = JSON.parse(readFileSync(join(root, "extension/static/manifest.json"), "utf8"));

execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
if (!existsSync(join(dist, "manifest.json"))) throw new Error("extension/dist has no manifest.json: the build failed");

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
cpSync(dist, folder, { recursive: true, filter: (src) => !src.endsWith(".map") });

const zip = (name) => {
  if (process.platform === "win32") {
    execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path bridge-ai -DestinationPath ${name} -Force`], { cwd: out, stdio: "inherit" });
  } else {
    execFileSync("zip", ["-qr", name, "bridge-ai"], { cwd: out, stdio: "inherit" });
  }
};
zip("bridge-ai-extension.zip");
zip(`bridge-ai-${version}.zip`);
rmSync(folder, { recursive: true });
console.log(`Packaged Bridge.ai ${version} → release/bridge-ai-extension.zip and release/bridge-ai-${version}.zip`);
