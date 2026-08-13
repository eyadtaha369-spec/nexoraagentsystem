// electron-builder's extraResources copier silently drops any folder literally
// named "node_modules" (confirmed by minimal repro), even though our .output
// server needs its own node_modules (e.g. tslib) to run. This afterPack hook
// copies it back in after packaging, straight into the already-packaged app.
const { existsSync, cpSync } = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, ".output", "server", "node_modules");
  if (!existsSync(src)) {
    console.warn("[after-pack] .output/server/node_modules not found — nothing to restore.");
    return;
  }

  // mac apps nest resources under Contents/Resources; win/linux use resources/ directly.
  const resourcesDir =
    context.electronPlatformName === "darwin"
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(context.appOutDir, "resources");

  const dest = path.join(resourcesDir, "app-server", "server", "node_modules");
  cpSync(src, dest, { recursive: true });
  console.log(`[after-pack] restored server node_modules -> ${dest}`);
};
