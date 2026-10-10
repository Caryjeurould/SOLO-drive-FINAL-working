// Installed-app (PWA) helpers. SOLO.drive ships as TWO separate installable
// apps on one origin — the Operator app (scope /operator/) and the Customer app
// (scope /customer/) — each with its own manifest, name and icon. They share
// the backend but must never reach each other's pages.
import { useEffect, useRef, useState } from "react";

export type AppKind = "operator" | "customer";

export const APP = {
  operator: {
    manifest: "/operator.webmanifest",
    start: "/operator/start",
    install: "/operator/download",
    appleIcon: "/icons/operator-apple-touch-icon.png",
    appleTitle: "SOLO Operator",
  },
  customer: {
    manifest: "/customer.webmanifest",
    start: "/customer/start",
    install: "/customer/download",
    appleIcon: "/icons/customer-apple-touch-icon.png",
    appleTitle: "SOLO Customer",
  },
} as const;

/** Route `head()` links/meta that make a page belong to one app: its own
 *  manifest (only — never the other app's) plus its iPhone home-screen icon
 *  and title. Used by the /operator and /customer parent routes. */
export function appHead(kind: AppKind) {
  return {
    meta: [{ name: "apple-mobile-web-app-title", content: APP[kind].appleTitle }],
    links: [
      { rel: "manifest", href: APP[kind].manifest },
      { rel: "apple-touch-icon", href: APP[kind].appleIcon },
    ],
  };
}

/** Which app a path belongs to. The Operator app also owns the original
 *  Operator sign-in/sign-up URLs (/login, /signup), which it maps into its own
 *  scope (see appRedirectFor). Everything else (homepage, /download, /admin)
 *  belongs to neither installed app. */
export function appForPath(pathname: string): AppKind | null {
  if (pathname === "/operator" || pathname.startsWith("/operator/") || pathname === "/login" || pathname === "/signup") return "operator";
  if (pathname === "/customer" || pathname.startsWith("/customer/")) return "customer";
  return null;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iPhone/iPad home-screen apps
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const APP_KEY = "solo.installedApp";

/** Which installed app this window is, or null in a browser tab (and always
 *  on the server). Each app's manifest start_url carries ?app=operator|customer;
 *  the window remembers it for its session (sessionStorage is per window, so
 *  two installed apps never share it). Without the marker — e.g. an iPhone app
 *  added from its install page — the launch path decides. */
export function getInstalledAppKind(): AppKind | null {
  if (typeof window === "undefined" || !isStandalone()) return null;
  let stored: string | null = null;
  try { stored = sessionStorage.getItem(APP_KEY); } catch {}
  if (stored === "operator" || stored === "customer") return stored;
  const marker = new URLSearchParams(window.location.search).get("app");
  const kind: AppKind | null = marker === "operator" || marker === "customer" ? marker : appForPath(window.location.pathname);
  if (kind) try { sessionStorage.setItem(APP_KEY, kind); } catch {}
  return kind;
}

/** Inside an installed app: where to send a path that isn't this app's own
 *  page (the other app's pages, the homepage, /download, …), or null if the
 *  path is fine to show. The Operator app keeps its sign-in/sign-up inside its
 *  scope by mapping /login and /signup to /operator/login and /operator/signup;
 *  its own install page goes to its start screen (already installed). */
export function appRedirectFor(kind: AppKind, pathname: string): string | null {
  if (kind === "operator" && pathname === "/login") return "/operator/login";
  if (kind === "operator" && pathname === "/signup") return "/operator/signup";
  if (pathname === APP[kind].install) return APP[kind].start;
  return appForPath(pathname) === kind ? null : APP[kind].start;
}

/** For pages that must exist only inside ONE installed app (Customer signup →
 *  Customer app; Operator onboarding → Operator app). Returns true once
 *  confirmed to be running inside that app; otherwise calls `redirect` (a
 *  browser tab: same redirect as always; the other installed app is sent to
 *  its own start screen by the site-wide guard) and stays false, so nothing of
 *  the page renders. Runs right after the first render — not in beforeLoad —
 *  because redirecting during hydration makes React's first render disagree
 *  with the server's HTML. */
export function useInstalledAppOnly(kind: AppKind, redirect: () => void): boolean {
  const [allowed, setAllowed] = useState(false);
  const redirectRef = useRef(redirect);
  redirectRef.current = redirect;
  useEffect(() => {
    const current = getInstalledAppKind();
    if (current === kind) setAllowed(true);
    else if (current === null) redirectRef.current();
    // current is the other app: the site-wide guard redirects it to its start.
  }, [kind]);
  return allowed;
}

/** The browser's deferred install prompt (Chrome/Edge/Android). It fires once
 *  per page load for the manifest the page links at that moment — possibly
 *  before this module has loaded — so a tiny inline script in the document
 *  head (routes/__root.tsx) catches it and records which manifest it was for.
 *  Each install page only uses a prompt for its own app's manifest. */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type PromptWindow = Window & { __soloInstallPrompt?: InstallPromptEvent | null; __soloInstallManifest?: string | null };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("solo:installprompt", notify);
  window.addEventListener("appinstalled", () => {
    const w = window as PromptWindow;
    w.__soloInstallPrompt = w.__soloInstallManifest = null;
    notify();
  });
}

/** The pending install prompt for `kind`'s app, or null. */
export function getInstallPrompt(kind: AppKind): InstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  const w = window as PromptWindow;
  const forManifest = w.__soloInstallManifest ? new URL(w.__soloInstallManifest, window.location.href).pathname : null;
  return w.__soloInstallPrompt && forManifest === APP[kind].manifest ? w.__soloInstallPrompt : null;
}
export function clearInstallPrompt() {
  if (typeof window === "undefined") return;
  const w = window as PromptWindow;
  w.__soloInstallPrompt = w.__soloInstallManifest = null;
  notify();
}
export function onInstallPromptChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Registers the minimal /sw.js (see public/sw.js) that makes the apps installable. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker registration failed", err));
}
