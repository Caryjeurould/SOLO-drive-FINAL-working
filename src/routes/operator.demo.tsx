import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Car } from "lucide-react";
import { useInstalledAppOnly } from "@/lib/pwa";
import { isVisitor } from "@/lib/site-role";
import { DEMO_DEFAULT_NAME, startDemo } from "@/lib/demo";
import { DemoTag } from "@/components/DemoTag";

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

function DemoNameScreen() {
  const navigate = useNavigate();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");

  const begin = (firstName: string, lastName: string) => {
    startDemo(firstName, lastName);
    navigate({ to: "/operator/onboarding" });
  };

  return (
    <div className="demo-step-in min-h-screen bg-background px-4 py-12">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />
      <div className="relative mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
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
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card/80 p-8 shadow-elevated backdrop-blur-2xl"
        >
          <div>
            <h1 className="font-display text-xl font-semibold">Enter your first and last name</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              to personalize the demo. Sample data only and nothing is saved or stored.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="First name"
              aria-label="First name"
              autoComplete="given-name"
              className="rounded-xl border border-border bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Last name"
              aria-label="Last name"
              autoComplete="family-name"
              className="rounded-xl border border-border bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-4 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90"
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
