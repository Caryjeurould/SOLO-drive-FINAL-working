// Installed-app (PWA) helpers.
import { useEffect, useRef, useState } from "react";

/** True when SOLO.drive is running as the installed app — launched from the
 *  home screen / app list rather than in a browser tab. Always false on the
 *  server, where this can't be known. */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iPhone/iPad home-screen apps
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** For pages that must exist only inside the installed app (Customer signup,
 *  Operator onboarding). Returns true once confirmed to be running as the
 *  installed app; otherwise calls `redirect` and stays false, so the page
 *  renders nothing in a browser tab. The check runs right after the first
 *  render — not in the route's beforeLoad — because redirecting during
 *  hydration makes React's first render disagree with the server's HTML. */
export function useInstalledAppOnly(redirect: () => void): boolean {
  const [allowed, setAllowed] = useState(false);
  const redirectRef = useRef(redirect);
  redirectRef.current = redirect;
  useEffect(() => {
    if (isInstalledApp()) setAllowed(true);
    else redirectRef.current();
  }, []);
  return allowed;
}

/** The browser's deferred install prompt (Chrome/Edge/Android). The browser
 *  fires `beforeinstallprompt` once per page load — often before the visitor
 *  has navigated to /download, and sometimes before this module has even
 *  loaded. A tiny inline script in the document head (routes/__root.tsx)
 *  catches it at that point (also suppressing the browser's own mini-bar, so
 *  our Install button is used) and stores it on window.__soloInstallPrompt;
 *  this module takes it from there, and /download reads it whenever it mounts. */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type PromptWindow = Window & { __soloInstallPrompt?: InstallPromptEvent | null };
let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  const w = window as PromptWindow;
  deferredPrompt = w.__soloInstallPrompt ?? null;
  window.addEventListener("solo:installprompt", () => {
    deferredPrompt = w.__soloInstallPrompt ?? null;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = w.__soloInstallPrompt = null;
    notify();
  });
}

export function getInstallPrompt() {
  return deferredPrompt;
}
export function clearInstallPrompt() {
  deferredPrompt = null;
  if (typeof window !== "undefined") (window as PromptWindow).__soloInstallPrompt = null;
  notify();
}
export function onInstallPromptChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Registers the minimal /sw.js (see public/sw.js) that makes the app installable. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker registration failed", err));
}
