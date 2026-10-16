// Visitor demo only: the one simulated ride after going online — the offer,
// the Contracted Services Agreement, the drive and the closing line. Built
// from the website simulation's pieces (route map, booking-card fields, trip
// rows, Contracted Services card). Nothing here is real or saved.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Clock, CornerUpLeft, CornerUpRight, Flag, Navigation, Undo2, User } from "lucide-react";
import { MapboxMap, type RouteStep } from "@/components/MapboxMap";
import { ContractedServicesCard, DisplayField, Pill, Row, csaAgreementText, formatTime } from "@/components/SmartRateBooking";
import { BrandText } from "@/components/BrandText";
import { DEMO_RIDE, DRIVE_VIEW } from "@/lib/demo";
import { cn } from "@/lib/utils";

export type RidePhase = "offer" | "csa" | "drive" | "thanks";

/** One short, soft two-note chime made with Web Audio (no audio file). Silent if audio isn't available. */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    for (const [freq, at] of [[880, 0], [1318.5, 0.12]] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now + at);
      osc.stop(now + 0.95);
    }
    window.setTimeout(() => { ctx.close().catch(() => {}); }, 1200);
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
  phase, operatorName, acceptedAt, poNumber, progress, reduced, onAccept,
}: {
  phase: RidePhase;
  operatorName: string;
  acceptedAt: number | null;
  poNumber: string | null;
  progress: number;
  reduced: boolean;
  onAccept: () => void;
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
  useEffect(() => {
    if (phase !== "csa") return;
    csaRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
    setMagnify(true);
  }, [phase, reduced]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [phase === "offer" || phase === "drive" || phase === "thanks" ? phase : null]);

  if (phase === "thanks") {
    return (
      <div className="mx-auto flex min-h-[70svh] max-w-3xl items-center justify-center px-6 text-center">
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
        : "mx-auto max-w-3xl px-4 py-4 md:px-8"}
      style={inGuidance ? ({ "--guide-logo": `${bottomPx - 60}px` } as React.CSSProperties) : undefined}
    >
      {phase === "offer" && (
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-glow">
          <span className={cn("h-2 w-2 rounded-full bg-success", !reduced && "animate-pulse")} /> New ride request
        </div>
      )}
      {/* The same map through every step, so the route stays drawn. */}
      <MapboxMap
        className={inGuidance ? "h-full w-full [&>div]:rounded-none" : "h-[40svh] min-h-[200px] w-full"}
        pickupAddress={r.pickup}
        dropoffAddress={r.dropoff}
        tripProgress={phase === "drive" ? progress : null}
        onRouteSteps={guidance ? setSteps : undefined}
        driveView={inGuidance ? { bottomPx, reduced } : null}
      />

      {phase === "offer" ? (
        <div data-testid="demo-offer" className="mt-4 rounded-3xl border border-border bg-gradient-surface p-5 shadow-elevated">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Where to?</div>
          <div className="mt-3 space-y-2">
            <DisplayField icon={<span className="h-2.5 w-2.5 rounded-full bg-primary-glow" />} label="Pickup" value={r.pickup} />
            <DisplayField icon={<span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />} label="Drop-off" value={r.dropoff} />
          </div>
          <div data-testid="demo-offer-pickup-distance" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Navigation className="h-3.5 w-3.5" /> Pickup is {r.pickupMi.toFixed(1)} mi from you
          </div>

          {/* Where the website shows the Operator, the Operator sees the Customer. */}
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-primary font-display text-lg font-semibold text-primary-foreground">
                {r.customer.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span data-testid="demo-offer-customer" className="font-medium">{r.customer}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary-glow">
                    <User className="h-3 w-3" /> Customer
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-primary-glow"><BrandText>Smart+Rate™ · locked</BrandText></div>
                <div data-testid="demo-offer-total" className="mt-1 font-display text-4xl font-semibold">${r.rate.total.toFixed(2)}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                ×{r.rate.multiplier.toFixed(2)} multiplier<br />
                100% to operator
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Row k="Base" v={`$${r.rate.base.toFixed(2)}`} />
              <Row k="Distance" v={`$${r.rate.distance.toFixed(2)}`} />
              <Row k="Fuel index" v={`+$${r.rate.fuelAdj.toFixed(2)}`} />
              <Row k="Peak time" v={`+$${r.rate.peakAdj.toFixed(2)}`} />
              <Row k="Weekend" v={`+$${r.rate.weekendAdj.toFixed(2)}`} />
              <Row k="Event" v={`+$${r.rate.eventAdj.toFixed(2)}`} />
            </div>
          </div>

          <button
            onClick={onAccept}
            className={cn(
              "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-glow",
              !reduced && "animate-verify-attention",
            )}
          >
            Accept ride · ${r.rate.total.toFixed(2)} <ArrowRight className="h-4 w-4" />
          </button>
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
