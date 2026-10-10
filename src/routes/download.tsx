import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, MapPin, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [{ title: "Get the App — SOLO.drive" }],
  }),
  component: DownloadPage,
});

/** The old shared install page. SOLO.drive is now two separate apps, so this
 *  page offers the two choices; each card goes to that app's own install page.
 *  It links no manifest itself, so it can't install either app directly. */
function DownloadPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />
      <div className="relative mx-auto max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Car className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-3xl font-semibold">
              SOLO<span className="text-gradient">.drive</span>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Independent Operator Platform</div>
          </div>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-3xl border border-border bg-card/80 p-8 shadow-elevated backdrop-blur-2xl">
          <h2 className="font-display text-2xl font-semibold text-center">Get the SOLO.drive App</h2>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Install directly from your browser — no App Store needed!
          </p>

          <div className="mt-6 space-y-3">
            <Link
              to="/operator/download"
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                <Car className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Operator App</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">For Operators — run your logistics business</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>

            <Link
              to="/customer/download"
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-success/40 hover:bg-success/5"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-success shadow-glow">
                <MapPin className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Customer App</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">For Customers — transparent pricing, verified owner operators</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/customer/login" className="text-primary-glow hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
