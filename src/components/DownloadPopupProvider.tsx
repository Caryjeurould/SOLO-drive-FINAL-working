import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { DownloadPopup } from "@/components/DownloadPopup";
import { getInstalledAppKind } from "@/lib/pwa";

const IDLE_MS = 15000;

/** The install pages already are the downloads — no pop-up over them. */
const NO_POPUP_PATHS = new Set(["/download", "/operator/download", "/customer/download"]);

/** Set once the visitor closes the pop-up; it then stays away for the rest of
 *  this browser visit (sessionStorage, plus an in-memory copy for browsers
 *  where storage is unavailable). */
const DISMISSED_KEY = "solo.downloadPopupDismissed";
let dismissedInMemory = false;
function wasDismissed(): boolean {
  if (dismissedInMemory) return true;
  try { return sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
}
function rememberDismissed() {
  dismissedInMemory = true;
  try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch {}
}

/** Never on an install page or inside an installed app (Operator or Customer). */
function popupBlockedAt(pathname: string): boolean {
  return NO_POPUP_PATHS.has(pathname) || getInstalledAppKind() !== null;
}

/** Everything that counts as the visitor being active. Listened to on window
 *  in the capture phase, so scrolls inside any element (and the homepage's
 *  section snapping / nav-tab scrolling) count too, and nothing on the page
 *  can stop an event from reaching us. */
const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "pointerdown", "click", "keydown",
  "wheel", "scroll", "touchstart", "touchmove",
] as const;

const DownloadPopupContext = createContext<{ openPopup: () => void }>({ openPopup: () => {} });

/** Opens the shared "SOLO.drive Downloads" pop-up (e.g. from a button). */
export const useDownloadPopup = () => useContext(DownloadPopupContext);

/**
 * One site-wide "SOLO.drive Downloads" pop-up with one idle timer, mounted
 * once at the app root so it persists across page navigation.
 *
 * It opens after 15s with no activity anywhere on the site; any activity
 * restarts the 15s countdown from zero. While it's open the timer is stopped
 * and activity is ignored. It never shows on the install pages or inside an
 * installed app. Once the visitor closes it, the idle timer doesn't bring it
 * back for the rest of the visit; opening it on purpose (openPopup, e.g. the
 * /customer booking flow) still works.
 */
export function DownloadPopupProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (wasDismissed() || popupBlockedAt(pathRef.current)) return;
      openRef.current = true;
      setOpen(true);
    }, IDLE_MS);
  }, []);

  const openPopup = useCallback(() => {
    if (popupBlockedAt(pathRef.current)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    openRef.current = true;
    setOpen(true);
  }, []);

  const closePopup = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    restartTimer();
  }, [restartTimer]);

  // The visitor closed it (✕ or backdrop): no idle pop-up for the rest of the visit.
  const dismissPopup = useCallback(() => {
    rememberDismissed();
    closePopup();
  }, [closePopup]);

  // The pop-up lives at the app root, so it would otherwise stay open over the
  // next page — e.g. after following its own link to /download. Close it on
  // any page change (which, like any close, restarts the idle countdown).
  const lastPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;
    if (openRef.current) closePopup();
  }, [pathname, closePopup]);

  useEffect(() => {
    const onActivity = () => {
      if (!openRef.current) restartTimer();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { capture: true, passive: true }));
    if (!openRef.current) restartTimer();
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [restartTimer]);

  return (
    <DownloadPopupContext.Provider value={{ openPopup }}>
      {children}
      {open && <DownloadPopup onClose={dismissPopup} />}
    </DownloadPopupContext.Provider>
  );
}
