import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { OperatorGate } from "@/components/OperatorGate";
import {
  Power, Clock, CalendarCheck, AlertTriangle, FileLock2, ShieldCheck,
  TrendingUp, DollarSign, CheckCircle2, FileText, ArrowRight, Loader2, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOperatorProfile } from "@/hooks/useOperatorProfile";
import { useWeeklyTrips, useRecentTrips, computeDailyHours, computeWeeklyEarnings } from "@/hooks/useTrips";
import { useDocuments, DOCUMENT_REQUIREMENTS } from "@/hooks/useDocuments";
import { useActiveShift, useGoOnline, useGoOffline, useLocationPing } from "@/hooks/useOperatorShift";
import type { ShiftServiceType } from "@/hooks/useOperatorShift";

export const Route = createFileRoute("/operator")({
  head: () => ({
    meta: [
      { title: "Operator Dashboard — SOLO.drive" },
      { name: "description", content: "Manage your independent operator status, weekly hours, subscription, and verified documents." },
    ],
  }),
  component: OperatorDashboardGated,
});

function OperatorDashboardGated() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Child routes (/operator/onboarding, /operator/vault) handle their own layout —
  // render Outlet so they mount correctly instead of being blocked by this component.
  if (pathname !== "/operator") return <Outlet />;
  return <OperatorGate><OperatorDashboard /></OperatorGate>;
}

function OperatorDashboard() {
  const [serviceType, setServiceType] = useState<ShiftServiceType>("both");
  const { data: activeShift, isLoading: shiftLoading } = useActiveShift();
  const goOnline = useGoOnline();
  const goOffline = useGoOffline();
  const locationAvailable = useLocationPing(activeShift?.id);
  const online = !!activeShift;

  const { data: operator, isLoading: opLoading } = useOperatorProfile();
  const { data: weeklyTrips = [], isLoading: tripsLoading } = useWeeklyTrips();
  const { data: recentTrips = [], isLoading: recentLoading } = useRecentTrips(5);
  const { data: documents = [], isLoading: docsLoading } = useDocuments();

  const isLoading = opLoading || tripsLoading || docsLoading || shiftLoading;

  const handleToggleOnline = () => {
    if (online && activeShift) {
      goOffline.mutate(activeShift.id);
    } else if (!online) {
      goOnline.mutate(serviceType);
    }
  };

  const hoursCap = 50;
  const dailyHours = computeDailyHours(weeklyTrips);
  const hoursLogged = dailyHours.reduce((s, h) => s + h, 0);
  const hoursLeft = hoursCap - hoursLogged;
  const subActive = operator?.subscription_active ?? false;
  const docsVerified = DOCUMENT_REQUIREMENTS.filter((req) =>
    req.docTypeIds.every((typeId) => documents.some((d) => d.document_type === typeId && d.verified))
  ).length;
  const docsTotal = DOCUMENT_REQUIREMENTS.length;
  const canGoOnline = subActive && hoursLeft > 0 && docsVerified === docsTotal;

  const { total: weekEarnings, avg: avgFare, count: tripCount } = computeWeeklyEarnings(weeklyTrips);

  const displayName = operator?.name
    ? operator.name.split(" ")[0]
    : operator?.email?.split("@")[0] ?? "Operator";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[80vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operator Console</div>
            <h1 className="mt-1 font-display text-4xl font-semibold">{greeting}, {displayName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {subActive ? "Subscription active · Flat quarterly rate" : "Subscription inactive"}
            </p>
          </div>
          <Link
            to="/operator/vault"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm hover:bg-secondary"
          >
            <FileLock2 className="h-4 w-4" /> Document Vault
          </Link>
        </header>

        {/* Go online card */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className={cn("h-3 w-3 rounded-full", online ? "bg-success animate-pulse" : "bg-muted-foreground/40")} />
                  <span className="font-display text-3xl font-semibold">{online ? "Online & accepting" : "Offline"}</span>
                </div>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {canGoOnline
                    ? "All guardrails clear. You're free to accept rides."
                    : "Resolve the blockers below to enable service."}
                </p>

                {online ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 capitalize text-primary-glow">
                      {activeShift?.service_type === "both" ? "Rideshare + Delivery" : activeShift?.service_type}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {locationAvailable ? "Location tracking" : "Location unavailable"}
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["rideshare", "delivery", "both"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setServiceType(t)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs capitalize transition-colors",
                          serviceType === t
                            ? "border-primary/40 bg-primary/10 text-primary-glow"
                            : "border-border bg-surface text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        {t === "both" ? "Rideshare + Delivery" : t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                disabled={!canGoOnline || goOnline.isPending || goOffline.isPending}
                onClick={handleToggleOnline}
                className={cn(
                  "group relative flex h-28 w-28 items-center justify-center rounded-full border transition-all",
                  canGoOnline
                    ? online
                      ? "border-destructive/40 bg-destructive/10 text-destructive shadow-[0_0_60px_-10px_oklch(0.65_0.22_25/0.7)]"
                      : "border-primary/40 bg-gradient-primary text-primary-foreground shadow-glow hover:scale-105"
                    : "cursor-not-allowed border-border bg-muted text-muted-foreground/60",
                )}
              >
                {goOnline.isPending || goOffline.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Power className="h-8 w-8" />
                )}
                <span className="absolute -bottom-7 text-[10px] uppercase tracking-widest">
                  {online ? "Tap to stop" : "Go online"}
                </span>
              </button>
            </div>

            {/* Guardrails */}
            <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
              <Guardrail
                ok={subActive}
                icon={<CalendarCheck className="h-4 w-4" />}
                label="Subscription"
                value={subActive ? "Active" : "Lapsed"}
              />
              <Guardrail
                ok={hoursLeft > 0}
                icon={<Clock className="h-4 w-4" />}
                label="Weekly hours"
                value={`${Math.max(0, hoursLeft).toFixed(1)}h left`}
              />
              <Guardrail
                ok={docsVerified === docsTotal}
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Documents"
                value={`${docsVerified}/${docsTotal} verified`}
              />
            </div>
          </div>

          {/* Hours meter */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Weekly cap</div>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">FMCSA · 50h</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-semibold">{hoursLogged.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ {hoursCap}h online</span>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-primary transition-all"
                style={{ width: `${Math.min((hoursLogged / hoursCap) * 100, 100)}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-7 gap-1.5">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
                const h = dailyHours[i];
                const maxH = Math.max(...dailyHours, 1);
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-muted">
                      <div className="w-full bg-gradient-primary" style={{ height: `${(h / maxH) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Earnings */}
        <section className="mt-6 grid gap-6 md:grid-cols-3">
          <KPI icon={<DollarSign className="h-4 w-4" />} label="This week" value={`$${weekEarnings.toFixed(2)}`} />
          <KPI icon={<TrendingUp className="h-4 w-4" />} label="Avg fare" value={`$${avgFare.toFixed(2)}`} />
          <KPI icon={<CheckCircle2 className="h-4 w-4" />} label="Trips" value={String(tripCount)} />
        </section>

        {/* Subscription block + recent trips */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl border border-border bg-gradient-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Quarterly access</div>
                <div className="mt-1 font-display text-2xl">$600 <span className="text-sm text-muted-foreground">/ quarter</span></div>
              </div>
              <span className={cn(
                "rounded-full px-3 py-1 text-xs",
                subActive ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
              )}>
                {subActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {["Zero per-ride commission", "Smart Rate engine", "Document vault & verification", "Customer trust shield"].map((b) => (
                <div key={b} className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" /> {b}
                </div>
              ))}
            </div>
            <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm hover:bg-secondary">
              Manage billing <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">Recent trips</h3>
              <span className="text-xs text-muted-foreground">Last {recentTrips.length}</span>
            </div>
            {recentLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentTrips.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center gap-2 py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No trips yet. Go online to start accepting rides.</p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-border">
                {recentTrips.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <div className="font-medium">
                        {t.pickup ?? "—"} → {t.dropoff ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.distance != null ? `${t.distance.toFixed(1)} mi` : "—"}
                      </div>
                    </div>
                    <div className="font-display text-base">
                      {t.fare != null ? `$${t.fare.toFixed(2)}` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Guardrail({ ok, icon, label, value }: { ok: boolean; icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-2xl border p-3",
      ok ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
    )}>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
        {ok ? icon : <AlertTriangle className="h-4 w-4" />}
      </div>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">{icon}</div>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
