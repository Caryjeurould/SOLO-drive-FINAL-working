// Temporary visitor access codes for the Operator demo.
//
// The only way into public.access_codes (row security on, no policies): this
// function uses the project's service role. Callers prove themselves with a
// key whose SHA-256 is below — the site's server key may only sign in with a
// code; the admin key (scripts/access-codes.mjs) may also create, list,
// cancel and rename. Codes themselves are never stored, only a slow hash.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SERVER_KEY_SHA256 = "ee496481b999b5810566c22e91408e48b8e76f44cebeaedbdab10a3422735498";
const ADMIN_KEY_SHA256 = "eb9025ecdf3f00eb7999371c270ba34c07199db0e367922ec1adf1e3e868cf45";

const OPENINGS = 2;
const OPENING_MS = 30 * 60 * 1000; // one sign-in lasts about 30 minutes
const ACTIVE_MS = 48 * 60 * 60 * 1000; // from the first sign-in
const UNUSED_MS = 7 * 24 * 60 * 60 * 1000; // a code never used

// 8 characters, uppercase letters and digits without 0, O, 1, I or L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

/** A slow, fixed-salt hash, so a code can be looked up but not recovered. */
async function codeHash(code: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("solo-drive:access-code:v1"), iterations: 100_000 }, key, 256));
}

const normalize = (code: unknown) => (typeof code === "string" ? code.toUpperCase().replace(/[\s-]/g, "") : "");

function newCode(): string {
  let out = "";
  while (out.length < 8) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 248 && out.length < 8) out += ALPHABET[b % ALPHABET.length]; // 248 = 8 × 31, no bias
    }
  }
  return out;
}

type Row = { code_hash: string; label: string; openings_used: number; created_at: string; first_signin_at: string | null; status: string };

/** The status as of now (a code past its dates reads "expired") and when it stops working. */
function current(r: Row, now: number): { status: string; expires: number | null } {
  const first = r.first_signin_at ? Date.parse(r.first_signin_at) : null;
  const expires = first === null ? Date.parse(r.created_at) + UNUSED_MS : first + ACTIVE_MS;
  if (r.status !== "active") return { status: r.status, expires: r.status === "used" ? Math.min(expires, now) : expires };
  return { status: now >= expires ? "expired" : "active", expires };
}

async function signIn(code: string) {
  if (!CODE_RE.test(code)) return { ok: false };
  const h = await codeHash(code);
  const { data: r } = await db.from("access_codes").select("*").eq("code_hash", h).maybeSingle<Row>();
  if (!r) return { ok: false };
  const now = Date.now();
  const c = current(r, now);
  if (c.status !== "active" || r.openings_used >= OPENINGS) {
    if (r.status === "active") await db.from("access_codes").update({ status: c.status === "active" ? "used" : c.status }).eq("code_hash", h);
    return { ok: false };
  }
  const n = r.openings_used + 1;
  const first = r.first_signin_at ?? new Date(now).toISOString();
  // Counted only if nobody else counted the same opening at the same moment.
  const { data: done } = await db.from("access_codes")
    .update({ openings_used: n, first_signin_at: first, status: n >= OPENINGS ? "used" : "active" })
    .eq("code_hash", h).eq("openings_used", r.openings_used).eq("status", "active").select("code_hash");
  if (!done?.length) return { ok: false };
  return { ok: true, opening: n, expires: Math.min(now + OPENING_MS, Date.parse(first) + ACTIVE_MS) };
}

async function admin(body: Record<string, unknown>) {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  switch (body.action) {
    case "create": {
      if (!label || label.length > 60) return { ok: false, error: "A label of 1-60 characters is needed." };
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const { error } = await db.from("access_codes").insert({ code_hash: await codeHash(code), label });
        if (!error) return { ok: true, label, code };
        if (error.code === "23505" && error.message.includes("label")) return { ok: false, error: `A code labeled "${label}" already exists.` };
        if (error.code !== "23505") return { ok: false, error: error.message };
      }
      return { ok: false, error: "Could not make a new code; try again." };
    }
    case "list": {
      const { data, error } = await db.from("access_codes").select("*").order("created_at");
      if (error) return { ok: false, error: error.message };
      const now = Date.now();
      return { ok: true, codes: (data as Row[]).map((r) => { const c = current(r, now); return { label: r.label, openings_used: r.openings_used, status: c.status, created_at: r.created_at, first_signin_at: r.first_signin_at, expires: c.expires && new Date(c.expires).toISOString() }; }) };
    }
    case "cancel": {
      const { data, error } = await db.from("access_codes").update({ status: "cancelled" }).eq("label", label).select("label");
      if (error) return { ok: false, error: error.message };
      return data.length ? { ok: true, label } : { ok: false, error: `No code labeled "${label}".` };
    }
    case "rename": {
      const to = typeof body.to === "string" ? body.to.trim() : "";
      if (!to || to.length > 60) return { ok: false, error: "A new label of 1-60 characters is needed." };
      const { data, error } = await db.from("access_codes").update({ label: to }).eq("label", label).select("label");
      if (error) return { ok: false, error: error.code === "23505" ? `A code labeled "${to}" already exists.` : error.message };
      return data.length ? { ok: true, label: to } : { ok: false, error: `No code labeled "${label}".` };
    }
  }
  return { ok: false, error: "Unknown action." };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const key = await sha256(req.headers.get("x-codes-key") ?? "");
  const isAdmin = key === ADMIN_KEY_SHA256;
  if (!isAdmin && key !== SERVER_KEY_SHA256) return json({ ok: false }, 401);
  const body = await req.json().catch(() => ({}));
  if (body?.action === "signin") return json(await signIn(normalize(body.code)));
  if (!isAdmin) return json({ ok: false }, 403);
  return json(await admin(body));
});
