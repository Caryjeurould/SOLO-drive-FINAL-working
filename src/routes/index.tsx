import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { DownloadPopup } from "@/components/DownloadPopup";
import { AppShell } from "@/components/AppShell";
import { ArrowRight, ShieldCheck, Gauge, Sparkles, Building2, Truck, FileSignature } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const openDownloads = search.openDownloads === true || search.openDownloads === "true";
    // Only include the key when true — an always-present key (even `false`)
    // makes TanStack Router treat a bare "/" as needing a canonical-URL
    // redirect to "/?openDownloads=false" on every single homepage hit.
    return openDownloads ? { openDownloads: true as const } : {};
  },
  head: () => ({
    meta: [
      { title: "SOLO.drive — The Independent Operator Platform" },
      { name: "description", content: "Run your own taxi or delivery business. Zero commission. Flat monthly fee. Smart Rate AI pricing built in." },
      { property: "og:title", content: "SOLO.drive — Independent Operator PWA" },
      { property: "og:description", content: "A business-in-a-box for solo drivers. No middleman. No per-ride cuts." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [onb] = useOnboarding();
  const { openDownloads = false } = Route.useSearch();
  const [showPopup, setShowPopup] = useState(openDownloads);

  useEffect(() => {
    if (openDownloads) return;
    const timer = setTimeout(() => setShowPopup(true), 15000);
    return () => clearTimeout(timer);
  }, [openDownloads]);

  // Defaults to dark on first render (server and client agree, so no hydration
  // mismatch) then randomizes client-side after mount — "random per page load"
  // without the server/client disagreeing on the very first paint.
  const [heroVariant, setHeroVariant] = useState<"light" | "dark">("dark");
  useEffect(() => {
    setHeroVariant(Math.random() < 0.5 ? "light" : "dark");
  }, []);

  const operatorTo = onb.status === "approved" ? "/operator" : "/operator/onboarding";
  const operatorLabel = onb.status === "approved" ? "Operator Dashboard" : onb.status === "in_progress" ? "Resume Onboarding" : "Become an Operator";

  const isLight = heroVariant === "light";
  const now = new Date();
  const dashboardHeader = `${now.toLocaleDateString("en-US", { weekday: "long" })} · ${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()} · Dashboard`;
  const hoursThisWeek = 42.7;
  const hoursCap = 50;

  return (
    <AppShell>
      {showPopup && <DownloadPopup onClose={() => setShowPopup(false)} />}

      {/* Marketplace model */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              How SOLO.drive is Different
            </h2>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              SOLO.drive is a technology marketplace, not a transportation company — it facilitates a series of
              direct contracts between independent Operators and Customers, each ride and/or delivery a separate
              agreement.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Pillar
              icon={<Building2 className="h-5 w-5" />}
              title="Entity Declaration"
              body="Operators must operate as a valid registered business entity, not as an individual gig worker."
            />
            <Pillar
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Business Liability/Indemnity Insurance"
              body="$500,000–$1,000,000 coverage requirement."
            />
            <Pillar
              icon={<Truck className="h-5 w-5" />}
              title="Commercial Vehicle Insurance"
              body="Required and separate from personal auto coverage."
            />
            <Pillar
              icon={<FileSignature className="h-5 w-5" />}
              title="Individual Contract Acknowledgment"
              body="Every Operator agrees to the platform's terms to operate as an independent business, maintain all required insurance policies when operating their business on SOLO.drive, and treat every ride as its own separate contract."
            />
            <Pillar
              icon={<Gauge className="h-5 w-5" />}
              title="Operator Guardrails"
              body="50-hour weekly cap, monthly subscription gate, and a 'Go Online' switch that simply won't lie to your customers."
            />
            <Pillar
              icon={<Sparkles className="h-5 w-5" />}
              title="Smart Rate Engine & 100% Commission"
              body="Distance, fuel index, peak hours, weekends, special events, one non-negotiable price both sides see up front. Zero commission — Operators keep 100%."
            />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border/60 bg-gradient-hero">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary-glow">
                <Sparkles className="h-3 w-3" /> Zero commission · Flat $499.99 / month
              </span>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
                Your fleet of one.<br />
                <span className="text-gradient">Owned, not rented.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
                SOLO.drive is the plug-and-play platform for independent taxi and delivery operators.
                No per-ride commissions. Transparent Smart Rate pricing. Verified credentials your customers can actually see.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setShowPopup(true)}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
                >
                  {operatorLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <Link
                  to="/customer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface/60 px-6 py-3.5 text-sm font-medium text-foreground backdrop-blur-xl transition-colors hover:bg-surface"
                >
                  Book a ride
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
                <Stat value="0%" label="Commission" />
                <Stat value="50h" label="Weekly cap" />
                <Stat value="$499.99" label="Per month" />
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute -inset-8 bg-gradient-primary opacity-20 blur-3xl" />
              {/* Framed like a cropped phone screen — rounded top edge, bezel
                  border on top/sides only, no bottom bezel or dead space below
                  the content so it reads as a mid-screen crop, not a full card. */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-t-[2.5rem] border-t-2 border-x-2 pb-3 pt-6 px-6 backdrop-blur-2xl shadow-elevated animate-float",
                  isLight ? "border-neutral-300 bg-white/95" : "border-border/70 bg-card/80",
                )}
              >
                <div className={cn("text-[11px] uppercase tracking-widest", isLight ? "text-neutral-500" : "text-muted-foreground")}>
                  {dashboardHeader}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary font-display text-lg font-semibold text-primary-foreground">
                    M
                  </div>
                  <div className="leading-tight">
                    <div className={cn("font-medium", isLight ? "text-neutral-900" : "text-foreground")}>Marcus Rogers</div>
                    <div className={cn("text-xs", isLight ? "text-neutral-500" : "text-muted-foreground")}>
                      Toyota Camry '20 · Rogers Transport LLC
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={isLight ? "text-neutral-500" : "text-muted-foreground"}>Commercial ins</span>
                    <span className={cn("font-semibold", isLight ? "text-green-600" : "text-green-400")}>Valid</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={isLight ? "text-neutral-500" : "text-muted-foreground"}>Indemnity ins</span>
                    <span className={cn("font-semibold", isLight ? "text-green-600" : "text-green-400")}>Valid</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className={isLight ? "text-neutral-500" : "text-muted-foreground"}>Declared shift</span>
                  <span className={isLight ? "text-neutral-900" : "text-foreground"}>3:00am – 3:00pm</span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className={isLight ? "text-neutral-500" : "text-muted-foreground"}>Hours this week</span>
                    <span className={isLight ? "text-neutral-900" : "text-foreground"}>{hoursThisWeek} / {hoursCap}h cap</span>
                  </div>
                  <div className={cn("mt-1.5 h-1.5 w-full overflow-hidden rounded-full", isLight ? "bg-neutral-200" : "bg-muted")}>
                    <div
                      className={cn("h-full", isLight ? "bg-green-600" : "bg-green-400")}
                      style={{ width: `${(hoursThisWeek / hoursCap) * 100}%` }}
                    />
                  </div>
                  <div className={cn("mt-1 text-[10px]", isLight ? "text-neutral-500" : "text-muted-foreground")}>
                    {(hoursCap - hoursThisWeek).toFixed(1)}h remaining before weekly cap
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", isLight ? "text-neutral-900" : "text-foreground")}>$1,375.00</span>
                  <span className={isLight ? "text-xs text-neutral-500" : "text-xs text-muted-foreground"}>this week</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", isLight ? "text-amber-600/80" : "text-amber-300/80")}>$71,500.00</span>
                  <span className={isLight ? "text-xs text-neutral-500" : "text-xs text-muted-foreground"}>YTD earnings</span>
                </div>

                <div className="mt-4 flex justify-center">
                  <button className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-500">
                    Go online
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </AppShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Pillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-gradient-surface p-6 shadow-card transition-transform hover:-translate-y-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">{icon}</div>
      <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
