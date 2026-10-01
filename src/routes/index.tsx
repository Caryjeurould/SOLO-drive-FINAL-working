import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { DownloadPopup } from "@/components/DownloadPopup";
import { AppShell } from "@/components/AppShell";
import { SmartRateBooking } from "@/components/SmartRateBooking";
import {
  ArrowRight, ShieldCheck, Gauge, Sparkles, Building2, Truck, FileSignature, DollarSign,
} from "lucide-react";
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

      <section className="relative overflow-hidden bg-gradient-hero">
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

      {/* Marketplace model */}
      <section className="border-t-2 border-border bg-background">
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
        </div>

        <div className="mx-auto mt-12 max-w-[1600px] px-4 pb-20 md:px-8 md:pb-28">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Pillar
              icon={<Building2 className="h-5 w-5" />}
              title="Entity Declaration"
              body="An Operator must operate as a registered business entity (LLC, C-Corp, S-Corp), and not as an individual gig worker."
            />
            <Pillar
              icon={<ShieldCheck className="h-5 w-5" />}
              title="(Bus) Indemnity Ins"
              body="An Operator is required to maintain $500,000–$1,000,000 Indemnity coverage that protects their individual business or entity to operate on SOLO.drive."
            />
            <Pillar
              icon={<Truck className="h-5 w-5" />}
              title="(Comm) Vehicle Ins"
              body="An Operator must maintain their state's minimum commercial vehicle insurance requirements to operate their business on the SOLO.drive platform."
            />
            <Pillar
              icon={<FileSignature className="h-5 w-5" />}
              title="Contracted Svs Agreement (CSA)"
              body="SOLO.drive requires each independent Operator to acknowledge and agree to the Contracted Svs Agreement (CSA) and maintain all required insurance policies."
            />
            <Pillar
              icon={<Gauge className="h-5 w-5" />}
              title="Operator Rules & Guardrails"
            />
            <Pillar
              icon={<Sparkles className="h-5 w-5" />}
              title="Smart-Rate Pricing"
            />
          </div>
        </div>
      </section>

      {/* Customer hero */}
      <section className="relative overflow-hidden border-t-2 border-border bg-gradient-hero">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary-glow">
                <Sparkles className="h-3 w-3" /> Zero commission · Flat $499.99 / month
              </span>
              <h2 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
                Your fleet of one.<br />
                <span className="text-gradient">Owned, not rented.</span>
              </h2>
              <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
                SOLO.drive is the plug-and-play platform for independent taxi and delivery operators.
                No per-ride commissions. Transparent Smart Rate pricing. Verified credentials your customers can actually see.
              </p>
            </div>

            <div className="mx-auto w-full max-w-sm">
              <SmartRateBooking layout="preview" />
            </div>
          </div>
        </div>
      </section>

      {/* Why book with SOLO.drive */}
      <section className="border-t-2 border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Why Book with SOLO.drive
            </h2>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              Every ride is a direct contract with a verified independent Operator — transparent pricing, no
              middleman, no surprises.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-20 md:px-8 md:pb-28">
          <div className="grid gap-6 sm:grid-cols-3">
            <Pillar
              icon={<DollarSign className="h-5 w-5" />}
              title="Transparent Pricing"
              size="lg"
            />
            <Pillar
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Verified Operators"
              size="lg"
            />
            <Pillar
              icon={<Sparkles className="h-5 w-5" />}
              title="No Surge Surprises"
              size="lg"
            />
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

function Pillar({
  icon,
  title,
  body,
  size = "sm",
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  size?: "sm" | "lg";
}) {
  return (
    <div
      className={cn(
        "group flex flex-col items-center rounded-2xl border border-border bg-gradient-surface text-center shadow-card transition-transform hover:-translate-y-1",
        size === "lg" ? "min-h-[320px] p-8" : "min-h-[280px] p-6",
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">{icon}</div>
      <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
      {body && <p className="mt-2 text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}
