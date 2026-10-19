// Visitor demo only: the one simulated ride after going online — the offer,
// the Contracted Services Agreement, the drive and the closing line. Built
// from the website simulation's pieces (route map, booking-card fields, trip
// rows, Contracted Services card). Nothing here is real or saved.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Clock, CornerUpLeft, CornerUpRight, Flag, Navigation, Undo2, User, X } from "lucide-react";
import { MapboxMap, type RouteStep } from "@/components/MapboxMap";
import { ContractedServicesCard, Pill, Row, csaAgreementText, formatTime } from "@/components/SmartRateBooking";
import { BrandText } from "@/components/BrandText";
import { DEMO_RIDE, DRIVE_VIEW } from "@/lib/demo";
import { cn } from "@/lib/utils";

export type RidePhase = "request" | "offer" | "pickup" | "csa" | "drive" | "complete" | "thanks";

/** The car and its route on the way to the pickup (the Customer screens' green). */
const PICKUP_GREEN = "#00c57c";

/** Two short, soft beeps with a short gap, made with Web Audio (no audio file). Silent if audio isn't available or is blocked. */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Two soft beeps (0.18 s each) with a short gap.
    for (const at of [0, 0.32]) {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.07, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.18);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 988;
      osc.connect(gain);
      osc.start(now + at);
      osc.stop(now + at + 0.2);
    }
    window.setTimeout(() => { ctx.close().catch(() => {}); }, 900);
  } catch {
    // No sound; the offer still shows.
  }
}

/** The turn arrow for a Directions maneuver. */
function turnIcon(step: RouteStep) {
  if (step.type === "arrive") return Flag;
  const m = step.modifier;
  if (m === "uturn") return Undo2;
  if (m === "slight left") return ArrowUpLeft;
  if (m === "slight right") return ArrowUpRight;
  if (m.endsWith("left")) return CornerUpLeft;
  if (m.endsWith("right")) return CornerUpRight;
  return ArrowUp;
}

/** Distance to the next turn: miles, or feet (by 50) under 0.1 mi. */
function turnDistance(mi: number) {
  return mi >= 0.1 ? `${mi.toFixed(1)} mi` : `${Math.round((mi * 5280) / 50) * 50} ft`;
}

export function DemoRideScreen({
  phase, operatorName, acceptedAt, poNumber, progress, reduced, leaving, onAccept, onDecline,
}: {
  phase: RidePhase;
  operatorName: string;
  acceptedAt: number | null;
  poNumber: string | null;
  progress: number;
  reduced: boolean;
  /** The last step is fading out before the reset. */
  leaving: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const r = DEMO_RIDE;
  const left = phase === "drive" ? 1 - progress : 1;
  const arrival = acceptedAt != null ? formatTime(acceptedAt + (r.operatorEtaMin + r.tripMin) * 60_000).toLowerCase() : "—";
  const milesLeft = `${(r.tripMi * left).toFixed(1)} mi`;
  const minutesLeft = `${Math.max(0, Math.ceil(r.tripMin * left - 1e-9))} min`;

  // The "guidance" drive (DRIVE_VIEW): full-screen navigation. The turn-by-turn
  // steps come from the same Mapbox Directions route the map draws; the car
  // sits just above the bottom card, which is measured for that.
  const guidance = DRIVE_VIEW === "guidance";
  const inGuidance = guidance && phase === "drive";
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [bottomPx, setBottomPx] = useState(220);
  useLayoutEffect(() => {
    if (!inGuidance) return;
    const measure = () => { if (bottomRef.current) setBottomPx(Math.round(bottomRef.current.getBoundingClientRect().height + 12 + 64)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [inGuidance]);
  const dropoffStreet = r.dropoff.split(",")[0];
  // The next maneuver ahead of the car; distances scaled to the trip's miles so they agree with the bottom card.
  const nextIdx = steps.length ? (() => { const i = steps.findIndex((s, k) => k > 0 && s.startFrac > progress + 1e-9); return i < 0 ? steps.length - 1 : i; })() : -1;
  const next = nextIdx >= 0 ? steps[nextIdx] : null;
  const TurnIcon = next ? turnIcon(next) : Navigation;
  const turnStreet = !next || next.type === "arrive" ? dropoffStreet
    : next.name || steps.slice(nextIdx + 1).find((s) => s.name)?.name || dropoffStreet; // no name: the next road
  const turnRef = next && next.type !== "arrive" && next.name ? next.ref.split(";")[0] : "";
  const turnMi = next ? Math.max(0, next.startFrac - progress) * r.tripMi : r.tripMi * left;

  // The Contracted Services card grows big, then settles back (the website's
  // magnify; with reduced motion only its glow).
  const csaRef = useRef<HTMLDivElement>(null);
  const [magnify, setMagnify] = useState(false);
  // Each step fades in, then holds before anything on it starts (DEMO_RIDE.phaseFadeMs + phaseHoldMs).
  const lead = r.phaseFadeMs + r.phaseHoldMs;
  useEffect(() => {
    if (phase !== "csa") return;
    const t = window.setTimeout(() => {
      csaRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
      setMagnify(true);
    }, lead);
    return () => window.clearTimeout(t);
  }, [phase, reduced, lead]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [phase === "csa" ? null : phase]);

  // The offer fills the screen under the header (fixed, so nothing scrolls):
  // the map takes whatever height the rows and Accept leave. Accept counts down
  // the auto-accept time (DEMO_RIDE.autoAcceptMs, run by the dashboard) as a
  // fill with the seconds shown; with reduced motion the fill moves per second.
  const offer = phase === "offer";
  // On the way to pickup: the car drives the Directions route from the
  // Operator's start to the pickup over DEMO_RIDE.pickupLegMs (after the fade-in
  // and hold), then "Arrived at pickup"; quarter steps with reduced motion.
  const pickupLeg = phase === "pickup";
  const fullScreen = offer || pickupLeg;
  const [legP, setLegP] = useState(0);
  useEffect(() => {
    if (!pickupLeg) return;
    const start = performance.now() + lead;
    let raf = 0;
    const tick = () => {
      const p = Math.max(0, Math.min(1, (performance.now() - start) / r.pickupLegMs));
      setLegP(reduced && p < 1 ? Math.floor(p * 4) / 4 : p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setLegP(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pickupLeg, reduced, lead, r.pickupLegMs]);
  const arrived = pickupLeg && legP >= 1;
  // Which route the map has drawn ("leg" = start → pickup, "trip" = pickup →
  // drop-off): the car is only placed once its route is in.
  const routeKey = pickupLeg ? "leg" : "trip";
  const routeKeyRef = useRef(routeKey);
  routeKeyRef.current = routeKey;
  const [routeIn, setRouteIn] = useState<string | null>(null);
  const onSteps = (s: RouteStep[]) => { setSteps(s); setRouteIn(routeKeyRef.current); };
  useEffect(() => { setSteps([]); setRouteIn(null); }, [routeKey]);
  const [headerPx, setHeaderPx] = useState(64);
  useLayoutEffect(() => {
    const measure = () => setHeaderPx(document.querySelector("header")?.getBoundingClientRect().height ?? 64);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  // The countdown starts after the offer's fade-in and hold, like the auto-accept timer.
  const [offerMs, setOfferMs] = useState(0);
  useEffect(() => {
    if (!offer) return;
    const start = Date.now() + lead;
    setOfferMs(0);
    const t = window.setInterval(() => setOfferMs(Math.max(0, Math.min(r.autoAcceptMs, Date.now() - start))), 100);
    return () => window.clearInterval(t);
  }, [offer, r.autoAcceptMs, lead]);
  const secondsLeft = Math.ceil((r.autoAcceptMs - offerMs) / 1000);
  const fill = (reduced ? Math.floor(offerMs / 1000) * 1000 : offerMs) / r.autoAcceptMs;
  // Side gutters: 16px on phones, the content centred at max-w-3xl on wide screens.
  const gutter = "max(16px, calc((100vw - 48rem) / 2 + 16px))";

  // The fade between steps: a curtain in the page's background colour that clears
  // over 0.4 s each time the step changes (and closes before the reset). Below the
  // header, except on the full-screen drive.
  const curtain = (
    <div
      key={leaving ? "leaving" : phase}
      data-testid="demo-curtain"
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-[65] bg-background", leaving ? "demo-curtain-out" : "demo-curtain-in")}
      style={{ top: inGuidance ? 0 : headerPx }}
    />
  );

  if (phase === "request") {
    return (
      <div className="mx-auto flex min-h-[70svh] max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        {curtain}
        <div className="relative flex h-16 w-16 items-center justify-center">
          {!reduced && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow"><Navigation className="h-6 w-6" /></span>
        </div>
        <div data-testid="demo-request">
          <div className="text-xs uppercase tracking-[0.2em] text-primary-glow">Incoming ride request</div>
          <div className="mt-2 font-display text-2xl font-semibold">{r.customer}</div>
          <div className="mt-1 text-sm text-muted-foreground">Pickup {r.pickupMi.toFixed(1)} mi away</div>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="mx-auto flex min-h-[70svh] max-w-3xl flex-col items-center justify-center gap-3 px-6 text-center">
        {curtain}
        <div data-testid="demo-complete">
          <div className="text-xs uppercase tracking-[0.2em] text-success">Trip complete</div>
          <div className="mt-3 text-sm text-muted-foreground">You earned</div>
          <div data-testid="demo-complete-fare" className="font-display text-5xl font-semibold">${r.rate.total.toFixed(2)}</div>
          <div className="mt-2 text-sm text-muted-foreground">100% to operator · {r.customer} · {r.tripMi.toFixed(1)} mi</div>
        </div>
      </div>
    );
  }

  if (phase === "thanks") {
    return (
      <div className="mx-auto flex min-h-[70svh] max-w-3xl items-center justify-center px-6 text-center">
        {curtain}
        <p data-testid="demo-thanks" className="font-display text-2xl font-semibold leading-snug">
          Thanks for experiencing the SOLO.drive DEMO
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="demo-ride"
      data-phase={phase}
      data-view={guidance ? "guidance" : "classic"}
      className={inGuidance
        // The Mapbox logo moves up to just above the bottom card.
        ? "fixed inset-x-0 top-0 z-[60] h-[100svh] overflow-hidden bg-background [&_.mapboxgl-ctrl-bottom-left]:!bottom-[var(--guide-logo)]"
        : fullScreen
          ? "fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 overflow-hidden bg-background pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          : "mx-auto max-w-3xl px-4 py-4 md:px-8"}
      style={inGuidance
        ? ({ "--guide-logo": `${bottomPx - 60}px` } as React.CSSProperties)
        : fullScreen ? { top: headerPx, paddingLeft: gutter, paddingRight: gutter } : undefined}
    >
      {curtain}
      {offer && (
        <>
          {/* On the map: the request label (top left) and Decline (top right). */}
          <div className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-primary-glow backdrop-blur" style={{ top: 20, left: `calc(${gutter} + 8px)` }}>
            <span className={cn("h-1.5 w-1.5 rounded-full bg-success", !reduced && "animate-pulse")} /> New ride request
          </div>
          <button
            type="button"
            data-testid="demo-offer-decline"
            onClick={onDecline}
            className="absolute z-10 inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-secondary"
            style={{ top: 16, right: `calc(${gutter} + 8px)` }}
          >
            <X className="h-3.5 w-3.5" /> Decline
          </button>
        </>
      )}
      {/* The same map through every step. The offer and the agreement show the
          trip (the offer with the Operator's car parked at its start); on the way
          to pickup the map draws start → pickup in green; the drive, pickup →
          drop-off again. */}
      <MapboxMap
        className={inGuidance ? "h-full w-full [&>div]:rounded-none" : fullScreen ? "min-h-[96px] w-full flex-1" : "h-[40svh] min-h-[200px] w-full"}
        pickupAddress={pickupLeg ? r.operatorStart : r.pickup}
        dropoffAddress={pickupLeg ? r.pickup : r.dropoff}
        startCarAddress={offer ? r.operatorStart : null}
        routeColor={pickupLeg ? PICKUP_GREEN : undefined}
        tripProgress={phase === "drive" ? (routeIn === "trip" ? progress : null) : pickupLeg ? (routeIn === "leg" ? legP : null) : null}
        onRouteSteps={onSteps}
        resizeWithContainer
        driveView={inGuidance ? { bottomPx, reduced } : null}
      />

      {phase === "offer" ? (
        <div data-testid="demo-offer" className="flex shrink-0 flex-col gap-2">
          <div className="rounded-xl border border-border bg-surface px-3 py-1.5 text-[13px]">
            <div data-testid="demo-offer-pickup" className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary-glow" />
              <span className="w-[52px] shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">Pickup</span>
              <span className="truncate">{r.pickup}</span>
            </div>
            <div data-testid="demo-offer-dropoff" className="mt-1 flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
              <span className="w-[52px] shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">Drop-off</span>
              <span className="truncate">{r.dropoff}</span>
            </div>
          </div>
          <div data-testid="demo-offer-trip" className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" /> {r.tripMi.toFixed(1)} mi · {r.tripMin} min</span>
            <span data-testid="demo-offer-pickup-distance" className="inline-flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5" /> Pickup {r.pickupMi.toFixed(1)} mi · {r.operatorEtaMin} min</span>
          </div>

          {/* Where the website shows the Operator, the Operator sees the Customer. */}
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary font-display text-sm font-semibold text-primary-foreground">
              {r.customer.charAt(0)}
            </div>
            <span data-testid="demo-offer-customer" className="text-sm font-medium">{r.customer}</span>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Verified ✓</span>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-primary-glow"><BrandText>Smart+Rate™ · locked</BrandText></div>
                <div data-testid="demo-offer-total" className="font-display text-3xl font-semibold leading-tight">${r.rate.total.toFixed(2)}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                ×{r.rate.multiplier.toFixed(2)} multiplier<br />
                100% to operator
              </div>
            </div>
            <div data-testid="demo-offer-breakdown" className="mt-1.5 grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
              <Row k="Base" v={`$${r.rate.base.toFixed(2)}`} />
              <Row k="Distance" v={`$${r.rate.distance.toFixed(2)}`} />
              <Row k="Fuel index" v={`+$${r.rate.fuelAdj.toFixed(2)}`} />
              <Row k="Peak time" v={`+$${r.rate.peakAdj.toFixed(2)}`} />
              <Row k="Weekend" v={`+$${r.rate.weekendAdj.toFixed(2)}`} />
              <Row k="Event" v={`+$${r.rate.eventAdj.toFixed(2)}`} />
            </div>
          </div>

          {/* Accept, with the auto-accept countdown as a fill and the seconds left. */}
          <button
            type="button"
            data-testid="demo-offer-accept"
            onClick={onAccept}
            className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow"
          >
            <span data-testid="demo-offer-countdown-fill" aria-hidden="true" className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${fill * 100}%` }} />
            <span className="relative">Accept · ${r.rate.total.toFixed(2)}</span>
            <ArrowRight className="relative h-4 w-4" />
            <span data-testid="demo-offer-countdown" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/25 px-2 py-0.5 text-xs tabular-nums">{secondsLeft}s</span>
          </button>
        </div>
      ) : pickupLeg ? (
        <div data-testid="demo-pickup" className="flex shrink-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <div data-testid="demo-pickup-title" className="font-display text-xl font-semibold">{arrived ? "Arrived at pickup" : "On the way to pickup"}</div>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-success">{arrived ? "Arrived" : "En route"}</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary font-display text-sm font-semibold text-primary-foreground">
              {r.customer.charAt(0)}
            </div>
            <span data-testid="demo-pickup-customer" className="text-sm font-medium">{r.customer}</span>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Verified ✓</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary-glow" />
            <span className="w-[52px] shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">Pickup</span>
            <span data-testid="demo-pickup-address" className="truncate">{r.pickup}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/5 px-3 py-2.5">
            <span className="text-[10px] uppercase tracking-widest text-success">To pickup</span>
            <span data-testid="demo-pickup-countdown" className="font-display text-2xl font-semibold tabular-nums">
              {(r.pickupMi * (1 - legP)).toFixed(1)} mi · {Math.max(0, Math.ceil(r.operatorEtaMin * (1 - legP) - 1e-9))} min
            </span>
          </div>
        </div>
      ) : inGuidance ? (
        <>
          {/* Top: the next turn — arrow, street, distance to it. */}
          <div data-testid="guide-turn" className="absolute inset-x-3 rounded-3xl border border-primary/30 bg-[#15122a]/95 p-4 shadow-elevated backdrop-blur" style={{ top: "max(12px, env(safe-area-inset-top))" }}>
            <div key={nextIdx} className={cn("flex items-center gap-4", !reduced && "animate-in fade-in duration-300")}>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                <TurnIcon className="h-10 w-10" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div data-testid="guide-turn-distance" className="font-display text-3xl font-semibold leading-none">{turnDistance(turnMi)}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span data-testid="guide-turn-street" className="line-clamp-2 text-xl font-semibold leading-tight">{turnStreet}</span>
                  {turnRef && <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">{turnRef}</span>}
                </div>
              </div>
            </div>
          </div>
          {/* Bottom: time left, miles left and the arrival time; the customer and the fare. */}
          <div ref={bottomRef} data-testid="guide-bottom" className="absolute inset-x-3 rounded-3xl border border-border bg-card/95 px-5 py-4 shadow-elevated backdrop-blur" style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div data-testid="guide-time" className="font-display text-4xl font-semibold leading-none text-success">{minutesLeft}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-base text-muted-foreground">
              <span data-testid="guide-miles" className="font-medium text-foreground">{milesLeft}</span>
              <span>·</span>
              <span>Arrival <span data-testid="guide-arrival" className="font-medium text-[#22d3ee]">{arrival}</span></span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Customer <span data-testid="guide-customer" className="font-medium text-foreground">{r.customer}</span></span>
              <span data-testid="guide-fare" className="font-medium text-foreground">${r.rate.total.toFixed(2)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div data-testid="demo-trip-rows" className="mt-4 grid gap-3 sm:grid-cols-3">
            <Pill icon={<Navigation className="h-3.5 w-3.5" />} label="Distance" value={milesLeft} />
            <Pill icon={<Clock className="h-3.5 w-3.5" />} label="Trip ETA" value={minutesLeft} />
            <Pill icon={<Flag className="h-3.5 w-3.5" />} label="Arrival" value={arrival} valueClassName="text-[#22d3ee]" />
          </div>
          {phase === "csa" && (
            <ContractedServicesCard
              cardRef={csaRef}
              className={cn("mt-6 scroll-mb-6 scroll-mt-24", magnify && "animate-csa-magnify relative z-10")}
              style={magnify ? ({ "--csa-scale": window.innerWidth < 640 ? "1.035" : "1.12" } as React.CSSProperties) : undefined}
              onAnimationEnd={(e) => { if (e.target === e.currentTarget) setMagnify(false); }}
              confirmation={acceptedAt != null && poNumber ? { at: acceptedAt, poNumber, operatorEtaMin: r.operatorEtaMin } : null}
              text={csaAgreementText(r.customer, operatorName, r.rate.total)}
            />
          )}
        </>
      )}
    </div>
  );
}
