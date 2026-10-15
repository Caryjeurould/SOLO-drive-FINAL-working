import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BrandText } from "@/components/BrandText";
import { OperatorGate } from "@/components/OperatorGate";
import { appHead } from "@/lib/pwa";
import { PostTripReportPrompt } from "@/components/PostTripReportPrompt";
import { PanicButton } from "@/components/PanicButton";
import {
  Power, Clock, CalendarCheck, AlertTriangle, FileLock2, ShieldCheck,
  TrendingUp, DollarSign, CheckCircle2, FileText, ArrowRight, Loader2, MapPin, Navigation, Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { isVisitor, useIsVisitor } from "@/lib/site-role";
import { DEMO_JOBS, DEMO_WEEK, DEMO_WORK_DAYS, DEMO_WORK_WINDOW_HOURS, SIM_PICKUP_ADDRESS, SIM_ZOOM, useDemoState } from "@/lib/demo";
import { MapboxMap } from "@/components/MapboxMap";
import { Pill } from "@/components/SmartRateBooking";
import { CsaPopup } from "@/components/CsaPopup";
import { useOperatorProfile } from "@/hooks/useOperatorProfile";
import {
  useWeeklyTrips, useRecentTrips, computeDailyHours, computeDailyHoursFromSessions, computeWeeklyEarnings,
  DAILY_HOURS_CAP, WEEKLY_HOURS_CAP,
} from "@/hooks/useTrips";
import { useDocuments, DOCUMENT_REQUIREMENTS } from "@/hooks/useDocuments";
import { useActiveShift, useGoOnline, useGoOffline, useLocationPing, useWeeklyShifts } from "@/hooks/useOperatorShift";
import type { ShiftServiceType } from "@/hooks/useOperatorShift";

/** The most recent completed trip matched to this operator that they haven't
 *  given post-trip feedback on yet — drives the "How was your trip?" prompt. */
function useOperatorTripNeedingFeedback(operatorId: string | undefined) {
  return useQuery({
    queryKey: ["trip-requests", "needs-feedback", "operator", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      if (isVisitor()) return null; // demo: no live trips
      const { data, error } = await supabase
        .from("trip_requests")
        .select("id")
        .eq("matched_operator_id", operatorId!)
        .eq("status", "completed")
        .is("operator_feedback_at", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
  });
}

/** There's no dedicated live in-trip screen for Operators yet, so this is the
 *  closest real signal for "currently on an active trip" — the Panic button
 *  shows only when one actually exists, not just whenever the Operator is online. */
function useOperatorActiveTrip(operatorId: string | undefined) {
  return useQuery({
    queryKey: ["trip-requests", "active", "operator", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      if (isVisitor()) return null; // demo: no live trips
      const { data, error } = await supabase
        .from("trip_requests")
        .select("id, pickup_stops, dropoff_stops")
        .eq("matched_operator_id", operatorId!)
        .eq("status", "in_progress")
        .order("matched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; pickup_stops: { address?: string }[] | null; dropoff_stops: { address?: string }[] | null } | null;
    },
  });
}

export const Route = createFileRoute("/operator")({
  // Links only the Operator app's manifest (plus its iPhone icon/title);
  // every /operator/* page inherits it.
  head: () => ({
    meta: [
      { title: "Operator Dashboard — SOLO.drive" },
      { name: "description", content: "Manage your independent operator status, weekly hours, subscription, and verified documents." },
      ...appHead("operator").meta,
    ],
    links: appHead("operator").links,
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

/** Demo "Go online" map: the area it's centred on, kept in memory only while the
 *  demo is online (never stored, logged or sent anywhere). null center = the
 *  website simulation's pickup (No, or no geo data). */
type DemoArea = { center: [number, number] | null };
let demoOnlineArea: DemoArea | null = null;

/** The visitor's approximate area from the server (Vercel's IP geo headers), or null. Never the browser's GPS. */
async function fetchApproxArea(): Promise<[number, number] | null> {
  try {
    const r = await fetch("/api/approx-location", { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const j = (await r.json()) as { lat?: unknown; lng?: unknown };
    return typeof j.lat === "number" && typeof j.lng === "number" ? [j.lng, j.lat] : null;
  } catch {
    return null;
  }
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Scroll so `el` sits just under the sticky header. */
function scrollUnderHeader(el: HTMLElement | null) {
  if (!el) return;
  const header = document.querySelector("header")?.offsetHeight ?? 0;
  window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - header - 8), behavior: reducedMotion() ? "auto" : "smooth" });
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
  const { data: tripNeedingFeedback, refetch: refetchFeedbackTrip } = useOperatorTripNeedingFeedback(operator?.id);
  const { data: activeTrip } = useOperatorActiveTrip(operator?.id);
  const { data: weekShifts = [], isLoading: weekShiftsLoading } = useWeeklyShifts();

  const isLoading = opLoading || tripsLoading || docsLoading || shiftLoading || weekShiftsLoading;

  // Demo only: "Go online" first asks to use the visitor's location (for the
  // simulation map), then shows the map under the Online card.
  const [askLocation, setAskLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [demoArea, setDemoAreaState] = useState<DemoArea | null>(() => demoOnlineArea);
  const setDemoArea = (a: DemoArea | null) => { demoOnlineArea = a; setDemoAreaState(a); };
  const onlineCardRef = useRef<HTMLDivElement>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<"map" | "card" | null>(null);

  const stopDemo = (shiftId: string) => {
    setDemoArea(null);
    pendingScroll.current = "card";
    goOffline.mutate(shiftId);
  };
  const handleToggleOnline = () => {
    if (isVisitor()) {
      if (online && activeShift) {
        stopDemo(activeShift.id);
      } else if (!online) {
        setAskLocation(true);
      }
      return;
    }
    if (online && activeShift) {
      goOffline.mutate(activeShift.id);
    } else if (!online) {
      goOnline.mutate(serviceType);
    }
  };

  const demo = useIsVisitor();
  const chooseLocation = async (yes: boolean) => {
    setLocating(true);
    const center = yes ? await fetchApproxArea() : null;
    setLocating(false);
    setAskLocation(false);
    setDemoArea({ center });
    pendingScroll.current = "map";
    goOnline.mutate(serviceType);
  };
  // While the demo is online the dashboard shows only the status, the map and
  // the trip panel under it; Stop brings everything else back.
  const showMap = demo && online && !!demoArea;
  // Online: glide down to the map; stopped: back up to the Online card.
  useEffect(() => {
    if (pendingScroll.current === "map" && showMap) { pendingScroll.current = null; scrollUnderHeader(mapSectionRef.current); }
    else if (pendingScroll.current === "card" && !online) { pendingScroll.current = null; scrollUnderHeader(onlineCardRef.current); }
  }, [showMap, online]);
  const simulationArea = useMemo(
    () => (demoArea ? { center: demoArea.center, address: SIM_PICKUP_ADDRESS, zoom: SIM_ZOOM, cars: 12 } : null),
    [demoArea],
  );
  // Demo only: the job whose Contracted Services Agreement pop-up is open.
  const [csaJob, setCsaJob] = useState<number | null>(null);
  const closeCsa = useCallback(() => setCsaJob(null), []);
  const demoState = useDemoState();
  const csaOperator = demoState.first ? `${demoState.first} ${(demoState.last || "O")[0]}.` : "Demo O.";
  const hoursCap = WEEKLY_HOURS_CAP;
  // Demo: hours come from the online sessions (Go online → Stop), as they will
  // for real Operators; a day that isn't a demo work day gets no bar.
  const dailyHours = demo ? computeDailyHoursFromSessions(weekShifts, { workDays: DEMO_WORK_DAYS }) : computeDailyHours(weeklyTrips);
  const hoursLogged = Math.round(dailyHours.reduce((s, h) => s + h, 0) * 10) / 10;
  const hoursLeft = hoursCap - hoursLogged;
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayCapReached = demo && DEMO_WORK_DAYS[todayIndex] && dailyHours[todayIndex] >= DAILY_HOURS_CAP;
  const subActive = operator?.subscription_active ?? false;
  const docsVerified = DOCUMENT_REQUIREMENTS.filter((req) =>
    req.docTypeIds.every((typeId) => documents.some((d) => d.document_type === typeId && d.verified))
  ).length;
  const docsTotal = DOCUMENT_REQUIREMENTS.length;
  const accountActive = (operator?.status ?? "active") === "active";
  const canGoOnline = accountActive && subActive && hoursLeft > 0 && !todayCapReached && docsVerified === docsTotal;

  // Demo: going online stops by itself when the daily (10 h) or weekly (50 h) cap is reached.
  useEffect(() => {
    if (!demo || !activeShift || !DEMO_WORK_DAYS[todayIndex]) return;
    const closed = computeDailyHoursFromSessions(weekShifts.filter((s) => s.id !== activeShift.id), { workDays: DEMO_WORK_DAYS });
    const leftHours = Math.min(DAILY_HOURS_CAP - closed[todayIndex], WEEKLY_HOURS_CAP - closed.reduce((s, h) => s + h, 0));
    const ms = new Date(activeShift.started_at).getTime() + leftHours * 3_600_000 - Date.now();
    const t = setTimeout(() => stopDemo(activeShift.id), Math.max(0, ms));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, activeShift?.id, weekShifts, todayIndex]);

  const { total: weekEarnings, avg: avgFare, count: tripCount } = demo
    ? { total: DEMO_WEEK.earnings, avg: DEMO_WEEK.avgFare, count: DEMO_WEEK.trips }
    : computeWeeklyEarnings(weeklyTrips);
  const money = (n: number) =>
    demo ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${n.toFixed(2)}`;

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
        <header className={cn("flex flex-wrap items-end justify-between gap-4", showMap && "hidden")}>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operator Console</div>
            <h1 className="mt-1 font-display text-4xl font-semibold">{greeting}, {displayName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your business. Your hours. Your income.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {subActive ? "Subscription active · Flat monthly rate" : "Subscription inactive"}
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
        <section className={cn("grid gap-6", showMap ? "mt-2" : "mt-8 lg:grid-cols-[1.2fr_1fr]")}>
          <div className="flex min-w-0 flex-col gap-6">
          <div ref={onlineCardRef} className={cn("relative overflow-hidden rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated", showMap && "pb-12")}>
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className={cn("h-3 w-3 rounded-full", online ? "bg-success animate-pulse" : "bg-muted-foreground/40")} />
                  <span className="font-display text-3xl font-semibold">{online ? "Online & accepting" : "Offline"}</span>
                </div>
                <p className={cn("mt-2 max-w-md text-sm text-muted-foreground", showMap && "hidden")}>
                  {!accountActive
                    ? operator?.status === "terminated"
                      ? "Your account has been permanently terminated. Contact Compliance for details."
                      : "Your account is suspended. Contact Compliance to resolve this and resume service."
                    : canGoOnline
                      ? "All guardrails clear. You're free to accept rides."
                      : "Resolve the blockers below to enable service."}
                </p>

                {online ? (
                  <div className={cn("mt-4 flex flex-wrap items-center gap-2 text-xs", showMap && "hidden")}>
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

                {activeTrip && (
                  <div className="mt-4 max-w-[220px]">
                    <PanicButton
                      tripRequestId={activeTrip.id}
                      triggeredById={operator?.id ?? ""}
                      triggeredBy="operator"
                      pickupAddress={activeTrip.pickup_stops?.[0]?.address ?? null}
                      dropoffAddress={activeTrip.dropoff_stops?.[0]?.address ?? null}
                      fallbackLat={activeShift?.last_lat ?? null}
                      fallbackLng={activeShift?.last_lng ?? null}
                      className="w-full flex-row justify-center gap-2 py-2.5"
                    />
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
                      ? "border-success/40 bg-success/15 text-success shadow-[0_0_60px_-10px_oklch(0.72_0.18_160/0.7)]"
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

            {askLocation && !online && (
              <div role="dialog" aria-labelledby="demo-location-ask" className="relative mt-10 rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-card">
                <p id="demo-location-ask" className="text-sm">Permission requested to use your current location for simulation purposes only</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => chooseLocation(true)}
                    disabled={locating}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-primary px-5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
                  >
                    {locating && <Loader2 className="h-4 w-4 animate-spin" />} Yes
                  </button>
                  <button
                    onClick={() => chooseLocation(false)}
                    disabled={locating}
                    className="min-h-10 rounded-xl border border-border bg-surface px-5 text-sm hover:bg-secondary disabled:opacity-60"
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Guardrails */}
            <div className={cn("relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4", showMap && "hidden")}>
              <Guardrail
                ok={accountActive}
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Account"
                value={operator?.status === "terminated" ? "Terminated" : operator?.status === "suspended" ? "Suspended" : "Active"}
              />
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
                value={todayCapReached ? "Daily 10h reached" : `${Math.max(0, hoursLeft).toFixed(1)}h left`}
              />
              <Guardrail
                ok={docsVerified === docsTotal}
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Documents"
                value={`${docsVerified}/${docsTotal} verified`}
              />
            </div>
          </div>

          {/* Demo only, while online: the simulation map (the website's map and
              cars, street level), then the website trip card's rows and, where
              its Contracted Services card sits, "Waiting on request". */}
          {showMap && (
            <div ref={mapSectionRef} data-testid="online-map" className="rounded-3xl border border-border bg-card p-3 shadow-card sm:p-4">
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
                <span className="h-2 w-2 rounded-full bg-success motion-safe:animate-pulse" /> Online · Looking for requests
              </div>
              <MapboxMap className="h-[66svh] min-h-[340px] w-full sm:h-[72svh] sm:max-h-[780px]" simulationArea={simulationArea} />
              <div data-testid="online-trip-panel">
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Pill icon={<Navigation className="h-3.5 w-3.5" />} label="Distance" value="0.0 mi" />
                  <Pill icon={<Clock className="h-3.5 w-3.5" />} label="Trip ETA" value="0 min" />
                  <Pill icon={<Flag className="h-3.5 w-3.5" />} label="Arrival" value="—" />
                </div>
                <div data-testid="waiting-card" className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="waiting-dot h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" /> Waiting on request
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Hours meter */}
          <div className={cn("rounded-3xl border border-border bg-card p-6 shadow-card", showMap && "hidden")}>
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Hours online this week</div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {demo && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary-glow">
                    Declared work window · {DEMO_WORK_WINDOW_HOURS}h
                  </span>
                )}
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">FMCSA · 50h</span>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-semibold">{hoursLogged.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ {hoursCap}h</span>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-primary transition-all"
                style={{ width: `${Math.min((hoursLogged / hoursCap) * 100, 100)}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {Math.max(0, hoursLeft).toFixed(1)}h remaining before weekly cap
            </div>
            <div className="mt-5 text-xs text-muted-foreground">Hours by day (10h max)</div>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
                const h = dailyHours[i];
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-muted">
                      <div className="w-full bg-gradient-primary" style={{ height: `${Math.min(h / 10, 1) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d}</span>
                    {demo && (
                      <span className="text-[10px] text-muted-foreground">
                        {DEMO_WEEK.dailyEarnings[i] ? `$${Math.round(DEMO_WEEK.dailyEarnings[i])}` : "Off"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Earnings */}
        <section className={cn("mt-6 grid gap-6", demo ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3", showMap && "hidden")}>
          <KPI icon={<DollarSign className="h-4 w-4" />} label="Earnings this week" value={money(weekEarnings)} />
          <KPI icon={<TrendingUp className="h-4 w-4" />} label="Average fare" value={money(avgFare)} />
          <KPI
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Rides & deliveries this week"
            value={String(tripCount)}
            sub={demo ? `${DEMO_WEEK.rides} rides · ${DEMO_WEEK.deliveries} deliveries` : undefined}
          />
          {demo && (
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/5 p-5 shadow-card">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300/80">
                <CalendarCheck className="h-4 w-4" />
              </div>
              <div className="mt-3 font-display text-3xl font-semibold text-amber-300/80">{money(DEMO_WEEK.ytd)}</div>
              <div className="text-xs uppercase tracking-widest text-amber-300/60">Year to date</div>
            </div>
          )}
        </section>

        {/* Subscription block + recent trips */}
        <section className={cn("mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]", showMap && "hidden")}>
          <div className="min-w-0 rounded-3xl border border-border bg-gradient-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Monthly access</div>
                <div className="mt-1 font-display text-2xl">$499.99 <span className="text-sm text-muted-foreground">/ month</span></div>
              </div>
              <span className={cn(
                "rounded-full px-3 py-1 text-xs",
                subActive ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
              )}>
                {subActive ? "Active" : "Inactive"}
              </span>
            </div>
            {/* No billing/renewal date exists in the real operator data yet, so
                the billing cycle bar shows in the demo only. */}
            {demo && <BillingCycle daysPast={DEMO_WEEK.billingDaysPast} daysLeft={DEMO_WEEK.billingDaysLeft} />}
            <div className="mt-4 space-y-2 text-sm">
              {["Document vault & verification", "Customer trust shield"].map((b) => (
                <div key={b} className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" /> <BrandText>{b}</BrandText>
                </div>
              ))}
            </div>
            <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm hover:bg-secondary">
              Manage billing <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="min-w-0 rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">{demo ? "Recent rides & deliveries" : "Recent trips"}</h3>
              <span className="text-xs text-muted-foreground">Last {demo ? DEMO_JOBS.length : recentTrips.length}</span>
            </div>
            {demo ? (
              <div data-testid="demo-jobs" className="mt-4 max-h-80 divide-y divide-border overflow-y-auto overscroll-contain scroll-smooth pr-1">
                {DEMO_JOBS.map((j, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {/* The tag is the only way to open the pop-up (the row isn't tappable,
                            so scrolling never opens it). 44px touch area, same look. */}
                        <button
                          type="button"
                          onClick={() => setCsaJob(i)}
                          aria-label={`Contracted Services Agreement: ${j.kind}, ${j.when}`}
                          className="-my-3 flex h-11 shrink-0 items-center"
                        >
                          <span className={cn(
                            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
                            j.kind === "Ride" ? "bg-primary/15 text-primary-glow" : "bg-warning/15 text-warning",
                          )}>
                            <span className="csa-dot h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                            {j.kind}
                          </span>
                        </button>
                        <span className="truncate font-medium">{j.from} → {j.to}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {j.when} · {j.miles.toFixed(1)} mi · {j.minutes} min
                      </div>
                    </div>
                    <div className="font-display text-base">${j.fare.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : recentLoading ? (
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

      {demo && csaJob != null && DEMO_JOBS[csaJob] && (
        <CsaPopup job={DEMO_JOBS[csaJob]} operator={csaOperator} onClose={closeCsa} />
      )}

      {tripNeedingFeedback && (
        <PostTripReportPrompt
          tripRequestId={tripNeedingFeedback.id}
          role="operator"
          onDone={() => refetchFeedbackTrip()}
        />
      )}
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

/** The 30-day billing cycle as a "peppermint stick": days past are candy
 *  striped, days left are empty. The due date counts forward from today. */
function BillingCycle({ daysPast, daysLeft }: { daysPast: number; daysLeft: number }) {
  const due = new Date();
  due.setDate(due.getDate() + daysLeft);
  const dueText = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="mt-5" data-testid="billing-cycle">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Billing cycle</div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-border bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(daysPast / (daysPast + daysLeft)) * 100}%`,
            background: "repeating-linear-gradient(-45deg, var(--primary) 0 6px, oklch(0.95 0.03 290) 6px 12px)",
          }}
        />
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{daysPast} days past · {daysLeft} days left</div>
      <div className="text-xs text-muted-foreground">Next access fee $499.99 due {dueText}</div>
    </div>
  );
}

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">{icon}</div>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
