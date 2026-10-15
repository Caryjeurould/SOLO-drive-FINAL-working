import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";

const configPath =
  ".vercel/output/functions/__server.func/.vc-config.json";

const config = JSON.parse(readFileSync(configPath, "utf8"));
config.runtime = "nodejs22.x";
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("[patch] Set Vercel function runtime → nodejs22.x");

// Nitro gives each file in server/routes its own Vercel function as a symlink
// to __server.func. The Vercel CLI doesn't upload symlinks from Windows, so the
// deploy fails on a function that doesn't exist. The main server function
// already serves those paths (after the password wall), so drop such routes
// and the links.
const outputConfigPath = ".vercel/output/config.json";
const output = JSON.parse(readFileSync(outputConfigPath, "utf8"));
const fnDir = (dest) => `.vercel/output/functions${dest}.func`;
const isLink = (path) => { try { return lstatSync(path).isSymbolicLink(); } catch { return false; } };
const missing = (dest) => isLink(fnDir(dest)) || !existsSync(fnDir(dest)) || readdirSync(fnDir(dest)).length === 0;
const before = output.routes.length;
output.routes = output.routes.filter((r) => !(r.dest && r.dest !== "/__server" && r.src === r.dest && missing(r.dest)));
if (output.routes.length !== before) {
  writeFileSync(outputConfigPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`[patch] Removed ${before - output.routes.length} route(s) to missing functions → served by __server`);
}
const prune = (dir) => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${name.name}`;
    if (name.isSymbolicLink()) { unlinkSync(p); continue; }
    if (!name.isDirectory() || name.name === "__server.func") continue;
    if (!name.name.endsWith(".func")) prune(p);
    if (readdirSync(p).length === 0) rmSync(p, { recursive: true });
  }
};
prune(".vercel/output/functions");
