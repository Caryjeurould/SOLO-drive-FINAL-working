import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  defineEventHandler,
  getCookie,
  setCookie,
  readBody,
  sendRedirect,
  setResponseStatus,
  html,
} from "h3";
import { CODE_LEFT_COOKIE, ROLE_COOKIE, roleRedirectFor, type SiteRole } from "../../src/lib/site-role";

const COOKIE_NAME = "solo-auth";
const COOKIE_OPTIONS = {
  secure: true,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  sameSite: "lax",
  path: "/",
} as const;

// Two passwords, both only from Vercel settings: APP_PASSWORD (admin — the
// real site, as always) and VISITOR_PASSWORD (visitor — the Operator demo,
// database switched off). Without APP_PASSWORD the site fails closed: every
// request is refused (see below). Without VISITOR_PASSWORD, or if it's the
// same as APP_PASSWORD, there's no visitor sign-in.
const PASSWORD = process.env.APP_PASSWORD || null;
const VISITOR_PASSWORD =
  process.env.VISITOR_PASSWORD && process.env.VISITOR_PASSWORD !== PASSWORD ? process.env.VISITOR_PASSWORD : null;

// The cookie holds an HMAC of a fixed label keyed with the password, so it
// can't be guessed or forged without the password, and changing a password
// signs out everyone who used it. The admin value is unchanged from before,
// so admins stay signed in; the visitor value uses its own label.
const AUTH_TOKEN = PASSWORD ? createHmac("sha256", PASSWORD).update("solo-auth:v1").digest("hex") : null;
const VISITOR_TOKEN = VISITOR_PASSWORD
  ? createHmac("sha256", VISITOR_PASSWORD).update("solo-auth:v1:visitor").digest("hex")
  : null;

// Temporary access codes (visitors): checked and counted by the access-codes
// Supabase Edge Function, which alone can reach their table. A sign-in with a
// code gets a cookie signed here (keyed with APP_PASSWORD) that ends with the
// opening (about 30 minutes); it then gets the password page again. Without
// CODES_KEY there are no code sign-ins.
const CODES_KEY = process.env.CODES_KEY || null;
const CODES_URL = process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/access-codes` : null;
const CODE_SIGNING_KEY = PASSWORD ? createHmac("sha256", PASSWORD).update("solo-auth:v1:code").digest() : null;
/** 8 characters, uppercase letters and digits without 0, O, 1, I or L (typed in any case, spaces and dashes ignored). */
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;
const normalizeCode = (typed: string) => typed.toUpperCase().replace(/[\s-]/g, "");

const codeSignature = (body: string) => createHmac("sha256", CODE_SIGNING_KEY!).update(body).digest("base64url");
const codeToken = (opening: number, expires: number) => {
  const body = `c1.${opening}.${expires}`;
  return `${body}.${codeSignature(body)}`;
};
/** When a code sign-in's cookie ends (ms), or null if it isn't one, is forged or has ended. */
function codeSessionEnd(cookie: string): number | null {
  const m = /^(c1\.\d\.(\d{13}))\.([\w-]+)$/.exec(cookie);
  if (!m || !CODE_SIGNING_KEY || !safeEqual(m[3], codeSignature(m[1]))) return null;
  const end = Number(m[2]);
  return end > Date.now() ? end : null;
}

/** Asks the Edge Function to count an opening for this code. */
async function signInWithCode(code: string): Promise<{ opening: number; expires: number } | null> {
  if (!CODES_KEY || !CODES_URL || !CODE_SIGNING_KEY) return null;
  try {
    const r = await fetch(CODES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-codes-key": CODES_KEY },
      body: JSON.stringify({ action: "signin", code }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as { ok?: boolean; opening?: number; expires?: number };
    return r.ok && j.ok && typeof j.opening === "number" && typeof j.expires === "number" && j.expires > Date.now() ? { opening: j.opening, expires: j.expires } : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison (hashing first makes the lengths equal). */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

// /icons/, the two app manifests and /sw.js are the installable-app files:
// browsers fetch them without the password cookie, and they hold no private
// content. Everything else stays behind the wall.
const EXEMPT_PREFIXES = ["/assets/", "/_build/", "/_nitro/", "/icons/"];
const EXEMPT_EXACT = new Set(["/favicon.ico", "/favicon.svg", "/robots.txt", "/operator.webmanifest", "/customer.webmanifest", "/sw.js"]);

export default defineEventHandler(async (event) => {
  const path = event.path ?? "/";

  if (!PASSWORD || !AUTH_TOKEN) {
    setResponseStatus(event, 503);
    return "Site unavailable.";
  }

  if (
    EXEMPT_EXACT.has(path) ||
    EXEMPT_PREFIXES.some((p) => path.startsWith(p))
  ) {
    return;
  }

  const cookie = getCookie(event, COOKIE_NAME);
  const codeEnd = cookie?.startsWith("c1.") ? codeSessionEnd(cookie) : null;
  const role: SiteRole | null = !cookie
    ? null
    : safeEqual(cookie, AUTH_TOKEN)
      ? "admin"
      : (VISITOR_TOKEN && safeEqual(cookie, VISITOR_TOKEN)) || codeEnd !== null
        ? "visitor"
        : null;
  if (cookie?.startsWith("c1.") && codeEnd === null) {
    // The opening has ended: back to the password page, signed out.
    for (const name of [COOKIE_NAME, ROLE_COOKIE, CODE_LEFT_COOKIE]) setCookie(event, name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  }
  if (codeEnd !== null) {
    const left = codeEnd - Date.now();
    setCookie(event, CODE_LEFT_COOKIE, String(left), { ...COOKIE_OPTIONS, maxAge: Math.ceil(left / 1000) });
  }
  if (role) {
    // Tell the page which role it is (the signed cookie above is hidden
    // from page scripts). Rewritten whenever it doesn't match.
    if (getCookie(event, ROLE_COOKIE) !== role) setCookie(event, ROLE_COOKIE, role, COOKIE_OPTIONS);
    const to = roleRedirectFor(role, path);
    if (to) return sendRedirect(event, to, 302);
    return;
  }

  if (event.method === "POST" && path === "/__auth") {
    const body = await readBody<{ password?: string; next?: string }>(event);
    const next = safeNext(body?.next);
    const typed = typeof body?.password === "string" ? body.password : null;
    const token =
      typed !== null && safeEqual(typed, PASSWORD) ? AUTH_TOKEN :
      typed !== null && VISITOR_PASSWORD && VISITOR_TOKEN && safeEqual(typed, VISITOR_PASSWORD) ? VISITOR_TOKEN :
      null;
    if (token) {
      setCookie(event, COOKIE_NAME, token, { ...COOKIE_OPTIONS, httpOnly: true });
      setCookie(event, ROLE_COOKIE, token === AUTH_TOKEN ? "admin" : "visitor", COOKIE_OPTIONS);
      setCookie(event, CODE_LEFT_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
      return sendRedirect(event, next, 302);
    }
    // Something shaped like an access code: one opening of it (a visitor), or
    // only the plain "no longer active" line — never why.
    const code = typed === null ? "" : normalizeCode(typed);
    if (CODE_RE.test(code)) {
      const opening = await signInWithCode(code);
      if (!opening) return html(passwordHtml("code", next));
      const left = opening.expires - Date.now();
      const options = { ...COOKIE_OPTIONS, maxAge: Math.ceil(left / 1000) };
      setCookie(event, COOKIE_NAME, codeToken(opening.opening, opening.expires), { ...options, httpOnly: true });
      setCookie(event, ROLE_COOKIE, "visitor", options);
      setCookie(event, CODE_LEFT_COOKIE, String(left), options);
      return sendRedirect(event, next, 302);
    }
    return html(passwordHtml("password", next));
  }

  return html(passwordHtml(null, path));
});

/** Where to go after the password: back to the page that asked for it (so an
 *  installed app opened at its start screen returns there, not to the
 *  homepage), and only ever a path on this site. */
function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/(?![/\\])\S*$/.test(next) && !next.startsWith("/__auth") ? next : "/";
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function passwordHtml(error: "password" | "code" | null, next: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SOLO.drive</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Space Grotesk', system-ui, sans-serif;
      background: oklch(12% 0.04 265);
      color: oklch(92% 0.02 265);
      min-height: 100svh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: oklch(17% 0.04 265 / 0.85);
      border: 1px solid oklch(40% 0.06 265 / 0.3);
      border-radius: 16px;
      padding: 48px 40px;
      width: 100%;
      max-width: 400px;
      backdrop-filter: blur(16px);
      box-shadow: 0 32px 64px oklch(5% 0.04 265 / 0.7);
    }
    .logo {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 6px;
    }
    .logo span { color: oklch(70% 0.2 265); }
    .sub {
      font-size: 13px;
      color: oklch(58% 0.04 265);
      margin-bottom: 36px;
    }
    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: oklch(60% 0.06 265);
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      padding: 13px 16px;
      background: oklch(22% 0.04 265);
      border: 1px solid oklch(35% 0.06 265 / 0.6);
      border-radius: 10px;
      color: oklch(92% 0.02 265);
      font-family: inherit;
      font-size: 15px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      letter-spacing: 0.1em;
    }
    input[type="password"]:focus {
      border-color: oklch(62% 0.2 265);
      box-shadow: 0 0 0 3px oklch(62% 0.2 265 / 0.15);
    }
    .error {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      font-size: 13px;
      color: oklch(68% 0.18 25);
    }
    button {
      margin-top: 24px;
      width: 100%;
      padding: 14px;
      background: oklch(56% 0.22 265);
      border: none;
      border-radius: 10px;
      color: #fff;
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      letter-spacing: -0.01em;
    }
    button:hover { background: oklch(61% 0.24 265); }
    button:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SOLO<span>.drive</span></div>
    <p class="sub">Private preview — enter your access password.</p>
    <form method="POST" action="/__auth">
      <input type="hidden" name="next" value="${escapeAttr(safeNext(next))}">
      <label for="pw">Password</label>
      <input id="pw" name="password" type="password" autofocus autocomplete="current-password" placeholder="••••••••">
      ${error === "password" ? '<p class="error">&#10005; Incorrect password. Please try again.</p>' : error === "code" ? '<p class="error">This access code is no longer active. Please contact SOLO.drive.</p>' : ""}
      <button type="submit">Continue &rarr;</button>
    </form>
  </div>
</body>
</html>`;
}
