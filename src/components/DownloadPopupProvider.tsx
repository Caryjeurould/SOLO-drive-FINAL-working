import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DownloadPopup } from "@/components/DownloadPopup";

const IDLE_MS = 15000;

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
 * and activity is ignored; closing it starts a fresh 15s countdown. There's no
 * once-per-visit limit — every idle stretch of 15s brings it back.
 */
export function DownloadPopupProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      openRef.current = true;
      setOpen(true);
    }, IDLE_MS);
  }, []);

  const openPopup = useCallback(() => {
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
      {open && <DownloadPopup onClose={closePopup} />}
    </DownloadPopupContext.Provider>
  );
}
