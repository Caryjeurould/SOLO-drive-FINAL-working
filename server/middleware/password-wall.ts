import {
  defineEventHandler,
  getCookie,
  setCookie,
  readBody,
  sendRedirect,
  html,
} from "h3";

const COOKIE_NAME = "solo-auth";
const PASSWORD = process.env.APP_PASSWORD ?? "SOLOM3$";

// /icons/, the two app manifests and /sw.js are the installable-app files:
// browsers fetch them without the password cookie, and they hold no private
// content. Everything else stays behind the wall.
const EXEMPT_PREFIXES = ["/assets/", "/_build/", "/_nitro/", "/icons/"];
const EXEMPT_EXACT = new Set(["/favicon.ico", "/favicon.svg", "/robots.txt", "/operator.webmanifest", "/customer.webmanifest", "/sw.js"]);

export default defineEventHandler(async (event) => {
  const path = event.path ?? "/";

  if (
    EXEMPT_EXACT.has(path) ||
    EXEMPT_PREFIXES.some((p) => path.startsWith(p))
  ) {
    return;
  }

  if (getCookie(event, COOKIE_NAME) === "ok") return;

  if (event.method === "POST" && path === "/__auth") {
    const body = await readBody<{ password?: string }>(event);
    if (body?.password === PASSWORD) {
      setCookie(event, COOKIE_NAME, "ok", {
        httpOnly: true,
        secure: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
        path: "/",
      });
      return sendRedirect(event, "/", 302);
    }
    return html(passwordHtml(true));
  }

  return html(passwordHtml(false));
});

function passwordHtml(error: boolean): string {
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
      <label for="pw">Password</label>
      <input id="pw" name="password" type="password" autofocus autocomplete="current-password" placeholder="••••••••">
      ${error ? '<p class="error">&#10005; Incorrect password. Please try again.</p>' : ""}
      <button type="submit">Continue &rarr;</button>
    </form>
  </div>
</body>
</html>`;
}
