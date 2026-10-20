import { useEffect, useSyncExternalStore } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Car } from "lucide-react";
import { appForPath, getInstalledAppKind } from "@/lib/pwa";
import { useIsVisitor } from "@/lib/site-role";
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
