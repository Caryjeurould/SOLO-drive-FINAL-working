import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_MS = 15000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"] as const;

/** The "Download the app" popup: opens after 15s with no activity, at most once
 *  per page visit. Opening it manually (`openPopup`, or `markShown` for a popup
 *  owned elsewhere, e.g. AppShell's nav) counts as that one showing, so the
 *  idle timer won't reopen it after the visitor has already seen and closed it.
 *  `initiallyOpen` (e.g. ?openDownloads=true) opens it immediately and skips the timer. */
export function useIdleDownloadPopup({ initiallyOpen = false }: { initiallyOpen?: boolean } = {}) {
  const [showPopup, setShowPopup] = useState(initiallyOpen);
  const shownRef = useRef(initiallyOpen);

  useEffect(() => {
    if (shownRef.current) return;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (shownRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (shownRef.current) return;
        shownRef.current = true;
        setShowPopup(true);
      }, IDLE_MS);
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);

  const markShown = useCallback(() => {
    shownRef.current = true;
  }, []);

  const openPopup = useCallback(() => {
    shownRef.current = true;
    setShowPopup(true);
  }, []);

  const closePopup = useCallback(() => setShowPopup(false), []);

  return { showPopup, openPopup, closePopup, markShown };
}
