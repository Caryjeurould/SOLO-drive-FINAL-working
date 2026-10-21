import { useEffect, useSyncExternalStore } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Car } from "lucide-react";
import { appForPath, getInstalledAppKind } from "@/lib/pwa";
import { CODE_LEFT_COOKIE, useIsVisitor } from "@/lib/site-role";
import { useDemoState } from "@/lib/demo";

/** A computer: a wide screen with a mouse and no touch screen at all. A phone,
 *  also turned sideways, has a touch screen, so it never counts. */
const COMPUTER_QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";
function isComputer() {
  return window.matchMedia(COMPUTER_QUERY).matches && !window.matchMedia("(any-pointer: coarse)").matches && navigator.maxTouchPoints === 0;
}
function subscribeComputer(onChange: () => void) {
  const mq = window.matchMedia(COMPUTER_QUERY);
  mq.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/** Demo pages that only make sense once the name screen has started the demo. */
const NEEDS_START = new Set(["/operator", "/operator/vault"]);

/** Set once per page load: the extra history entry that keeps Back inside the demo. */
let backEntryAdded = false;

/**
 * The visitor demo (the Operator pages with the visitor password), in the
 * installed app or a phone's browser tab:
 * - no pull-to-refresh or overscroll bounce (a refresh would wipe the demo);
 * - in a browser tab, Back does nothing (one extra history entry, so even the
 *   first page's Back stays in the demo);
 * - after a reload, the later pages go back to the name screen.
 * Returns true on a computer, where only "open on your phone" is shown.
 */
export function useVisitorDemo(): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const navigate = useNavigate();
  const started = useDemoState().started;
  const active = useIsVisitor() && appForPath(pathname) === "operator";
  const computer = useSyncExternalStore(subscribeComputer, isComputer, () => false);

  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.add("visitor-demo");
    return () => document.documentElement.classList.remove("visitor-demo");
  }, [active]);

  useEffect(() => {
    if (!active || getInstalledAppKind() !== null) return;
    const unblock = router.history.block({ blockerFn: ({ action }) => action === "BACK", enableBeforeUnload: false });
    if (!backEntryAdded) {
      backEntryAdded = true;
      router.history.push(router.history.location.href, router.history.location.state);
    }
    return unblock;
  }, [active, router]);

  useEffect(() => {
    if (active && !started && NEEDS_START.has(pathname)) navigate({ to: "/operator/demo", replace: true });
  }, [active, started, pathname, navigate]);

  return active && computer;
}

/** How often at most the page tells the server the visitor is still active. */
const ALIVE_EVERY_MS = 60 * 1000;
/** Renewed this long before the end (the browser drops the cookie at the end itself). */
const RENEW_BEFORE_MS = 10 * 1000;

/** Signed in with a temporary access code: the visitor's taps, scrolls and key
 *  presses keep the opening alive (the server renews its cookie, at most once a
 *  minute); when it ends (30 idle minutes, or the code's 48 hours) the page
 *  reloads and the server shows the password page again. The time left always
 *  comes from the server, so the phone's clock doesn't matter. Nothing is saved
 *  and the database is never asked. */
export function useCodeSessionEnd() {
  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${CODE_LEFT_COOKIE}=(\\d+)(?:;|$)`));
    if (!m) return;
    let end = 0;
    let timer = 0;
    let lastPing = 0;
    let lastActivity = Date.now();
    let pinging = false;
    const reload = () => window.location.reload();
    const schedule = (left: number) => {
      end = Date.now() + left + 500; // a moment past the end, so the server sees it ended
      window.clearTimeout(timer);
      timer = window.setTimeout(due, Math.max(left - RENEW_BEFORE_MS, 0));
    };
    const reloadAtEnd = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(reload, Math.max(end - Date.now(), 0));
    };
    const ping = async () => {
      if (pinging) return;
      pinging = true;
      lastPing = Date.now();
      try {
        // How long ago the last tap was, so the 30 idle minutes count from it.
        const idle = Date.now() - lastActivity;
        const r = await fetch("/__alive", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idle }) });
        const left = r.ok ? Number((await r.json()).left) : 0;
        if (left > 0) schedule(left);
        else reload();
      } catch {
        reloadAtEnd(); // offline for a moment: the opening still ends on time
      } finally {
        pinging = false;
      }
    };
    // Just before the end: if the visitor was active since the last renewal, renew
    // (from that activity); otherwise the opening ends.
    function due() {
      if (lastActivity > lastPing) void ping();
      else reloadAtEnd();
    }
    const active = () => {
      lastActivity = Date.now();
      if (Date.now() >= end) reload();
      else if (Date.now() - lastPing >= ALIVE_EVERY_MS) void ping();
    };
    // Back from sleep or a hidden tab after the end: straight to the password page.
    const back = () => { if (document.visibilityState === "visible" && Date.now() >= end) reload(); };
    schedule(Number(m[1]));
    void ping(); // opening (or reloading) the page counts as activity
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const e of events) window.addEventListener(e, active, { capture: true, passive: true });
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    window.addEventListener("focus", back);
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, active, { capture: true });
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("pageshow", back);
      window.removeEventListener("focus", back);
    };
  }, []);
}

/** The visitor demo on a computer: one centred line on the dark background. */
export function OpenOnPhone() {
  return (
    <div data-testid="open-on-phone" className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
          <Car className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="font-display text-3xl font-semibold">
          SOLO<span className="text-gradient">.drive</span>
        </div>
      </div>
      <p className="text-lg text-foreground">Please open this link on your phone.</p>
    </div>
  );
}
