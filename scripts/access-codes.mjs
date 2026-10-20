// Temporary visitor access codes (the Operator demo).
//
//   npm run codes -- create "Friend 1"        makes a code and prints it ONCE
//   npm run codes -- list                     label, openings used, status, expiry
//   npm run codes -- cancel "Friend 1"
//   npm run codes -- rename "Friend 1" "Alex"
//
// Talks to the access-codes Edge Function with the admin key in .env.codes
// (CODES_ADMIN_KEY=…, never committed) and the project URL in .env.local.
import fs from "node:fs";

const envFile = (f) => {
  try {
    return Object.fromEntries(fs.readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
  } catch {
    return {};
  }
};
const env = { ...envFile(".env"), ...envFile(".env.local"), ...envFile(".env.codes"), ...process.env };
const KEY = env.CODES_ADMIN_KEY;
const URL_ = env.VITE_SUPABASE_URL && `${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/access-codes`;
if (!KEY || !URL_) {
  console.error("Needs CODES_ADMIN_KEY (in .env.codes) and VITE_SUPABASE_URL (in .env.local).");
  process.exit(1);
}

async function call(body) {
  const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", "x-codes-key": KEY }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (!j.ok) {
    console.error(j.error ?? `Refused (HTTP ${r.status}).`);
    process.exit(1);
  }
  return j;
}

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const [cmd, a, b] = process.argv.slice(2);

if (cmd === "create" && a) {
  const r = await call({ action: "create", label: a });
  console.log(`${r.label}: ${r.code}`);
  console.log("This is the only time the code is shown. Save it now.");
} else if (cmd === "list") {
  const { codes } = await call({ action: "list" });
  if (!codes.length) console.log("No codes yet.");
  else {
    const rows = [["Label", "Openings", "Status", "Expires"], ...codes.map((c) => [c.label, `${c.openings_used} of 2`, c.status, c.status === "active" ? when(c.expires) : "—"])];
    const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
    for (const r of rows) console.log(r.map((x, i) => x.padEnd(w[i])).join("   "));
  }
} else if (cmd === "cancel" && a) {
  await call({ action: "cancel", label: a });
  console.log(`Cancelled: ${a}`);
} else if (cmd === "rename" && a && b) {
  await call({ action: "rename", label: a, to: b });
  console.log(`Renamed: ${a} → ${b}`);
} else {
  console.log('Usage: npm run codes -- create "<label>" | list | cancel "<label>" | rename "<label>" "<new label>"');
  process.exit(cmd ? 1 : 0);
}
