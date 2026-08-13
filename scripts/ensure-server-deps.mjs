// Nitro traces which node_modules the built server actually needs and copies
// just those into .output/server/node_modules. On some machines/platforms
// (seen on Windows) that tracer misses a package even though it's genuinely
// required at runtime (e.g. tslib, pulled in by @radix-ui's compiled output).
// This script is a safety net: after the build, force-copy a short list of
// known "easy to miss" packages from the project's own node_modules into the
// server bundle if they aren't already there.
import { existsSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverModules = join(root, ".output", "server", "node_modules");
const rootModules = join(root, "node_modules");

const REQUIRED = ["tslib"];

if (!existsSync(serverModules)) {
  console.warn("[ensure-server-deps] .output/server/node_modules not found — skipping (did the build run?).");
  process.exit(0);
}

for (const pkg of REQUIRED) {
  const dest = join(serverModules, pkg);
  const src = join(rootModules, pkg);
  if (existsSync(dest)) continue;
  if (!existsSync(src)) {
    console.error(`[ensure-server-deps] "${pkg}" is missing from both the server bundle and the project's own node_modules. Run "npm install ${pkg}" and rebuild.`);
    process.exitCode = 1;
    continue;
  }
  cpSync(src, dest, { recursive: true });
  console.log(`[ensure-server-deps] copied missing "${pkg}" into the server bundle.`);
}
