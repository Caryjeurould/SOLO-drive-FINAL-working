import { readFileSync, writeFileSync } from "fs";

const configPath =
  ".vercel/output/functions/__server.func/.vc-config.json";

const config = JSON.parse(readFileSync(configPath, "utf8"));
config.runtime = "nodejs22.x";
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("[patch] Set Vercel function runtime → nodejs22.x");
