import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { DownloadPopup } from "@/components/DownloadPopup";
import { AppShell } from "@/components/AppShell";
import { ArrowRight, ShieldCheck, Gauge, Sparkles, Clock, FileLock2, MapPin } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding";

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
  const operatorTo = onb.status === "approved" ? "/operator" : "/operator/onboarding";
  const operatorLabel = onb.status === "approved" ? "Operator Dashboard" : onb.status === "in_progress" ? "Resume Onboarding" : "Become an Operator";
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

            <div className="relative">
              <div className="absolute -inset-8 bg-gradient-primary opacity-20 blur-3xl" />
              <div className="relative rounded-3xl border border-border bg-card/80 p-6 backdrop-blur-2xl shadow-elevated animate-float">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Smart Rate</div>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Locked</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-semibold tracking-tight">$24.80</span>
                  <span className="text-xs text-muted-foreground">est. fare</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Chip icon={<MapPin className="h-3 w-3" />}>4.2 mi · 14 min</Chip>
                  <Chip icon={<Clock className="h-3 w-3" />}>Peak ×1.25</Chip>
                  <Chip icon={<Sparkles className="h-3 w-3" />}>Fuel ×1.08</Chip>
                  <Chip icon={<ShieldCheck className="h-3 w-3" />}>Verified driver</Chip>
                </div>

                <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Operator gets</span>
                    <span className="font-semibold text-success">$24.80 (100%)</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full bg-gradient-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Pillar
            icon={<Gauge className="h-5 w-5" />}
            title="Operator Guardrails"
            body="50-hour weekly cap, monthly subscription gate, and a 'Go Online' switch that simply won't lie to your customers."
          />
          <Pillar
            icon={<FileLock2 className="h-5 w-5" />}
            title="Document Vault"
            body="Insurance, license, background checks. Customers can verify with one tap before they get in your car."
          />
          <Pillar
            icon={<Sparkles className="h-5 w-5" />}
            title="Smart Rate Engine"
            body="Distance, fuel index, peak hours, weekends, special events. One non-negotiable price both sides see up front."
          />
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

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-muted-foreground">
      {icon}
      <span className="truncate">{children}</span>
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
