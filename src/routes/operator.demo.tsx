import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Car } from "lucide-react";
import { useInstalledAppOnly } from "@/lib/pwa";
import { isVisitor } from "@/lib/site-role";
import { DEMO_DEFAULT_NAME, startDemo } from "@/lib/demo";
import { DemoTag } from "@/components/DemoTag";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operator/demo")({
  // The visitor demo's first screen: the visitor's name, typed once, fills
  // every name in the demo. Like onboarding, it exists only inside the
  // installed Operator app (browser tabs go to the homepage with the
  // Downloads pop-up open), and only for visitors (see roleRedirectFor).
  ssr: false,
  head: () => ({ meta: [{ title: "Demo — SOLO.drive Operator" }] }),
  component: InstalledAppDemoStart,
});

function InstalledAppDemoStart() {
  const navigate = useNavigate();
  const allowed = useInstalledAppOnly("operator", () => navigate({ to: "/", search: { openDownloads: true }, replace: true }));
  return allowed && isVisitor() ? <DemoNameScreen /> : null;
}

/** The part of the screen the visitor can see (the visual viewport: smaller
 *  while the on-screen keyboard is open), or null before it is known. */
function useVisibleArea() {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const read = () => setArea(vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight });
    read();
    vv?.addEventListener("resize", read);
    vv?.addEventListener("scroll", read);
    window.addEventListener("resize", read);
    return () => {
      vv?.removeEventListener("resize", read);
      vv?.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, []);
  return area;
}

/** Below this visible height (the keyboard is open, or a very short screen) the
 *  name card moves to the top of what is visible, without the logo, so both
 *  names and Start Demo stay in view. */
const COMPACT_BELOW_PX = 520;

function DemoNameScreen() {
  const navigate = useNavigate();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const area = useVisibleArea();
  const compact = !!area && area.height < COMPACT_BELOW_PX;

  const begin = (firstName: string, lastName: string) => {
    startDemo(firstName, lastName);
    navigate({ to: "/operator/onboarding" });
  };

  return (
    <div className="demo-step-in min-h-screen bg-background px-4 py-12">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />
      {/* While compact, the card is pinned to the visible area (it follows the
          keyboard); otherwise centred as before. */}
      <div
        data-testid="demo-name-area"
        className={cn("mx-auto flex max-w-md flex-col", compact ? "fixed inset-x-0 z-10 overflow-y-auto px-4 py-3" : "relative min-h-[80vh] justify-center")}
        style={compact && area ? { top: area.top, height: area.height } : undefined}
      >
        <div className={cn("flex flex-col items-center gap-3 text-center", compact && "hidden")}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Car className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="font-display text-3xl font-semibold">
            SOLO<span className="text-gradient">.drive</span> Operator
          </div>
          <DemoTag />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); begin(first, last); }}
          className={cn("rounded-3xl border border-border bg-card/80 shadow-elevated backdrop-blur-2xl", compact ? "space-y-3 p-5" : "mt-8 space-y-4 p-8")}
        >
          <div>
            <h1 className="font-display text-xl font-semibold">Enter your first and last name</h1>
            <p className={cn("mt-1 text-sm text-muted-foreground", compact && "hidden")}>
              to personalize the demo. Sample data only and nothing is saved or stored.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="First name"
              aria-label="First name"
              autoComplete="off"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className="rounded-xl border border-border bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Last name"
              aria-label="Last name"
              autoComplete="off"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className="rounded-xl border border-border bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            data-testid="demo-name-start"
            className={cn("flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90", compact ? "py-3" : "py-4")}
          >
            Start Demo <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => begin("", "")}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Skip — use "{DEMO_DEFAULT_NAME.first} {DEMO_DEFAULT_NAME.last}"
          </button>
        </form>
      </div>
    </div>
  );
}
