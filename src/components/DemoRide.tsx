// Visitor demo only: the one simulated ride after going online — the offer,
// the Contracted Services Agreement, the drive and the closing line. Built
// from the website simulation's pieces (route map, booking-card fields, trip
// rows, Contracted Services card). Nothing here is real or saved.
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, Flag, Navigation, User } from "lucide-react";
import { MapboxMap } from "@/components/MapboxMap";
import { ContractedServicesCard, DisplayField, Pill, Row, csaAgreementText, formatTime } from "@/components/SmartRateBooking";
import { BrandText } from "@/components/BrandText";
import { DEMO_RIDE } from "@/lib/demo";
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
    <div data-testid="demo-ride" data-phase={phase} className="mx-auto max-w-3xl px-4 py-4 md:px-8">
      {phase === "offer" && (
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-glow">
          <span className={cn("h-2 w-2 rounded-full bg-success", !reduced && "animate-pulse")} /> New ride request
        </div>
      )}
      {/* The same map through every step, so the route stays drawn. */}
      <MapboxMap
        className="h-[40svh] min-h-[200px] w-full"
        pickupAddress={r.pickup}
        dropoffAddress={r.dropoff}
        tripProgress={phase === "drive" ? progress : null}
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
      ) : (
        <>
          <div data-testid="demo-trip-rows" className="mt-4 grid gap-3 sm:grid-cols-3">
            <Pill icon={<Navigation className="h-3.5 w-3.5" />} label="Distance" value={`${(r.tripMi * left).toFixed(1)} mi`} />
            <Pill icon={<Clock className="h-3.5 w-3.5" />} label="Trip ETA" value={`${Math.max(0, Math.ceil(r.tripMin * left - 1e-9))} min`} />
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
