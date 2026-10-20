// Visitor demo only: the one simulated ride after going online — the offer,
// the Contracted Services Agreement, the drive and the closing line. Built
// from the website simulation's pieces (route map, booking-card fields, trip
// rows, Contracted Services card). Nothing here is real or saved.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Clock, CornerUpLeft, CornerUpRight, Flag, MessageCircle, Navigation, Phone, Undo2, User, X } from "lucide-react";
import { DRIVE_INTRO_MS, MapboxMap, fetchDemoRide, type DemoRideRoutes, type PreparedView, type RouteStep } from "@/components/MapboxMap";
import { ContractedServicesCard, Pill, csaAgreementText, formatTime } from "@/components/SmartRateBooking";
import { BrandText } from "@/components/BrandText";
import { DEMO_RATE_ROWS, DEMO_RIDE, DRIVE_VIEW } from "@/lib/demo";
import { cn } from "@/lib/utils";

export type RidePhase = "request" | "offer" | "pickup" | "csa" | "drive" | "complete" | "thanks";

/** The route line on the way to the pickup (the Customer screens' green); the trip's is purple. */
const PICKUP_GREEN = "#00c57c";
const TRIP_PURPLE = "#7c5cff";
/** The offer countdown holds this long after the visitor last touched or scrolled the breakdown. */
const BREAKDOWN_HOLD_MS = 3000;
/** How long the Call / Message notice shows. */
const TOAST_MS = 2000;
/** Navigation: the least room between the bottom card and the car's centre (the car's rear half and the street pill). */
const CAR_ROOM_PX = 84;
/** Navigation: the street pill's top, below the car's centre (the tilted car's rear half and a gap). */
const PILL_BELOW_CAR_PX = 32;
/** Sample speed on the navigation screens (not real data). */
const SAMPLE_MPH = 35;

/** Two short beeps with a short gap, made with Web Audio (no audio file). Silent if audio isn't available or is blocked. */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Two clear beeps (0.18 s each) with a short gap; peak gain 0.4 keeps the sine well below clipping.
    for (const at of [0, 0.32]) {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.4, now + at + 0.02);
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
  /** Accept, or the countdown reaching zero (this screen runs the countdown). */
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
  const lead = r.phaseFadeMs + r.phaseHoldMs;
  const easeMs = reduced ? 0 : DRIVE_INTRO_MS;
  // On the way to pickup: the overview of the green route (DEMO_RIDE.pickupOverviewMs,
  // after the fade-in and hold), then — on the same map — the camera eases into the
  // drive's navigation view while the car drives the leg over DEMO_RIDE.pickupLegMs,
  // then "Arrived at pickup"; quarter steps with reduced motion. legNav: the move
  // has begun; legSettled: it has finished (the screen is then the navigation screen).
  const pickupLeg = phase === "pickup";
  const [legP, setLegP] = useState(0);
  const [legNav, setLegNav] = useState(false);
  const [legSettled, setLegSettled] = useState(false);
  useEffect(() => {
    setLegP(0);
    setLegNav(false);
    setLegSettled(false);
    if (!pickupLeg) return;
    const start = performance.now() + lead + r.pickupOverviewMs;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      if (guidance && now >= start) setLegNav(true);
      if (guidance && now >= start + easeMs) setLegSettled(true);
      const p = Math.max(0, Math.min(1, (now - start) / r.pickupLegMs));
      setLegP(reduced && p < 1 ? Math.floor(p * 4) / 4 : p);
      if (p < 1 || now < start + easeMs) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pickupLeg, guidance, reduced, lead, easeMs, r.pickupOverviewMs, r.pickupLegMs]);
  // The drive: the overview of the whole trip through the step's fade-in and hold,
  // then the camera eases into the navigation view as the car sets off.
  const [driveNav, setDriveNav] = useState(false);
  useEffect(() => {
    setDriveNav(false);
    if (phase !== "drive" || !guidance) return;
    const t = window.setTimeout(() => setDriveNav(true), lead);
    return () => window.clearTimeout(t);
  }, [phase, guidance, lead]);
  const arrived = pickupLeg && legP >= 1;
  const navLeg = pickupLeg && legNav;
  /** The camera follows the car (the navigation view, or the move into it). */
  const navOn = navLeg || (guidance && phase === "drive" && driveNav);
  /** The turn card and the bottom card are drawn (hidden until the camera has moved in). */
  const overlays = guidance && (phase === "drive" || navLeg);
  /** The screen is the full-screen navigation screen. */
  const guideLayout = guidance && (phase === "drive" || (pickupLeg && legSettled));
  /** The map fills the screen (on the pickup overview it shows only through its box, then opens up). */
  const fixedMap = guidance && (pickupLeg || phase === "drive");
  // The ride's routes (start → pickup, pickup → drop-off, with the trip's
  // turn-by-turn steps), fetched once when the request comes in, so every map
  // opens already drawn and framed.
  const [routes, setRoutes] = useState<DemoRideRoutes | null>(null);
  useEffect(() => {
    let live = true;
    fetchDemoRide({ start: r.operatorStart, pickup: r.pickup, dropoff: r.dropoff }).then((d) => { if (live) setRoutes(d); });
    return () => { live = false; };
  }, [r.operatorStart, r.pickup, r.dropoff]);
  // The navigation view follows the leg (to the pickup) or the trip (to the drop-off).
  const steps: RouteStep[] = (navLeg ? routes?.legSteps : routes?.tripSteps) ?? [];
  const navP = navLeg ? legP : progress;
  const navMi = navLeg ? r.pickupMi : r.tripMi;
  const navLeft = navLeg ? 1 - legP : left;
  const navMiles = `${(navMi * navLeft).toFixed(1)} mi`;
  const navMinutes = `${Math.max(0, Math.ceil((navLeg ? r.operatorEtaMin : r.tripMin) * navLeft - 1e-9))} min`;
  const navArrival = navLeg ? (acceptedAt != null ? formatTime(acceptedAt + r.operatorEtaMin * 60_000).toLowerCase() : "—") : arrival;
  const bottomRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  // The car sits low, about a quarter of the way up the open road between the
  // bottom card and the turn card (room left under it for the street pill), so
  // most of the screen is road ahead. cardPx: the bottom card's top, from the bottom.
  const [cardPx, setCardPx] = useState(160);
  const [bottomPx, setBottomPx] = useState(240);
  const [turnPx, setTurnPx] = useState(120);
  useLayoutEffect(() => {
    if (!overlays) return;
    const measure = () => {
      const b = bottomRef.current?.getBoundingClientRect(), t = turnRef.current?.getBoundingClientRect();
      if (!b || !t) return;
      const card = Math.round(window.innerHeight - b.top);
      setCardPx(card);
      setTurnPx(Math.round(t.bottom));
      setBottomPx(Math.round(card + Math.max(CAR_ROOM_PX, 0.25 * (b.top - t.bottom))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [overlays]);
  const endStreet = (navLeg ? r.pickup : r.dropoff).split(",")[0];
  // The next maneuver ahead of the car; distances scaled to the route's miles so they agree with the bottom card.
  const nextIdx = steps.length ? (() => { const i = steps.findIndex((s, k) => k > 0 && s.startFrac > navP + 1e-9); return i < 0 ? steps.length - 1 : i; })() : -1;
  const next = nextIdx >= 0 ? steps[nextIdx] : null;
  const TurnIcon = next ? turnIcon(next) : Navigation;
  const turnStreet = !next || next.type === "arrive" ? endStreet
    : next.name || steps.slice(nextIdx + 1).find((s) => s.name)?.name || endStreet; // no name: the next road
  const turnRef2 = next && next.type !== "arrive" && next.name ? next.ref.split(";")[0] : "";
  const turnMi = next ? Math.max(0, next.startFrac - navP) * navMi : navMi * navLeft;
  // The street the car is on now (the step it is driving), for the pill under the car.
  const onIdx = steps.length ? Math.max(0, (nextIdx < 0 ? steps.length : nextIdx) - 1) : -1;
  const onStreet = onIdx >= 0 ? steps[onIdx].name || steps[onIdx].ref.split(";")[0] || steps.slice(0, onIdx).reverse().find((s) => s.name)?.name || "" : "";
  // Call / Message on the bottom card: a short notice only (nothing is dialled or
  // sent, and no timer changes).
  const [toast, setToast] = useState<{ text: string; top: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => { if (!overlays) setToast(null); }, [overlays]);
  const notice = (text: string) => setToast({ text, top: Math.round((turnRef.current?.getBoundingClientRect().bottom ?? 120) + 10) });

  // The Contracted Services card grows big, then settles back (the website's
  // magnify; with reduced motion only its glow).
  const csaRef = useRef<HTMLDivElement>(null);
  const [magnify, setMagnify] = useState(false);
  // Each step fades in, then holds before anything on it starts (DEMO_RIDE.phaseFadeMs + phaseHoldMs).
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
  // the auto-accept time (DEMO_RIDE.autoAcceptMs) as a fill with the seconds
  // shown, and accepts at zero; with reduced motion the fill moves per second.
  const offer = phase === "offer";
  const fullScreen = offer || (pickupLeg && !legSettled);
  // What the map draws on each step: the offer, the green leg to the pickup and
  // the purple trip with the Operator's car parked at the start; on the way to
  // pickup, only the green leg (the car drives it); the agreement and the
  // drive, only the trip. The car is purple throughout.
  const mapView = useMemo<PreparedView | null>(() => {
    if (!routes) return null;
    const leg = { id: "leg", coords: routes.leg, color: PICKUP_GREEN };
    const trip = { id: "trip", coords: routes.trip, color: TRIP_PURPLE };
    const pickupDot = { at: routes.pickup, color: TRIP_PURPLE }, dropoffDot = { at: routes.dropoff, color: "#22d3ee" };
    if (offer) return { lines: [leg, trip], dots: [pickupDot, dropoffDot], parkedCar: routes.start, carRoute: null, frame: [...routes.leg, ...routes.trip] };
    if (pickupLeg) return { lines: [leg], dots: [pickupDot], parkedCar: null, carRoute: routes.leg, frame: routes.leg };
    return { lines: [trip], dots: [pickupDot, dropoffDot], parkedCar: null, carRoute: routes.trip, frame: routes.trip };
  }, [routes, offer, pickupLeg]);
  const [headerPx, setHeaderPx] = useState(64);
  useLayoutEffect(() => {
    const measure = () => setHeaderPx(document.querySelector("header")?.getBoundingClientRect().height ?? 64);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  // The pickup overview: the full-screen map shows only through the box where the
  // map sits (top, right, bottom, left insets), and opens up from there.
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<[number, number, number, number] | null>(null);
  const boxed = pickupLeg && !legSettled;
  useLayoutEffect(() => {
    if (!boxed) { setBox(null); return; }
    const measure = () => {
      const b = boxRef.current?.getBoundingClientRect();
      if (b) setBox([Math.round(b.top), Math.round(window.innerWidth - b.right), Math.round(window.innerHeight - b.bottom), Math.round(b.left)]);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [boxed]);
  const fitPadding = useMemo(
    () => (box && !navLeg ? { top: box[0] + 36, right: box[1] + 36, bottom: box[2] + 36, left: box[3] + 36 } : 36),
    [box, navLeg],
  );

  // The countdown starts after the offer's fade-in and hold. It holds while the
  // visitor touches or scrolls the breakdown, and runs on BREAKDOWN_HOLD_MS after
  // the last touch or scroll.
  const [offerMs, setOfferMs] = useState(0);
  const holdRef = useRef({ touching: false, until: 0 });
  const acceptRef = useRef(onAccept);
  acceptRef.current = onAccept;
  useEffect(() => {
    if (!offer) return;
    const start = Date.now() + lead;
    let last = Date.now(), ran = 0;
    holdRef.current = { touching: false, until: 0 };
    setOfferMs(0);
    const t = window.setInterval(() => {
      const now = Date.now(), h = holdRef.current;
      const from = Math.max(last, start, h.until);
      if (!h.touching && now > from) ran += now - from;
      last = now;
      setOfferMs(Math.min(r.autoAcceptMs, ran));
      if (ran >= r.autoAcceptMs) { window.clearInterval(t); acceptRef.current(); }
    }, 100);
    return () => window.clearInterval(t);
  }, [offer, r.autoAcceptMs, lead]);
  const touchBreakdown = (touching?: boolean) => {
    const h = holdRef.current;
    if (touching !== undefined) h.touching = touching;
    h.until = Date.now() + BREAKDOWN_HOLD_MS;
    if (touching) window.addEventListener("pointerup", () => touchBreakdown(false), { once: true });
  };
  const rowsRef = useRef<HTMLDivElement>(null);
  const [rowsEnd, setRowsEnd] = useState(false);
  useEffect(() => { setRowsEnd(false); }, [offer]);
  const secondsLeft = Math.ceil((r.autoAcceptMs - offerMs) / 1000);
  const fill = (reduced ? Math.floor(offerMs / 1000) * 1000 : offerMs) / r.autoAcceptMs;
  const mapClass = fixedMap ? "h-full w-full [&>div]:rounded-none" : fullScreen ? "min-h-[96px] w-full flex-1" : "h-[40svh] min-h-[200px] w-full";
  // Side gutters: 16px on phones, the content centred at max-w-3xl on wide screens.
  const gutter = "max(16px, calc((100vw - 48rem) / 2 + 16px))";
  // The Mapbox logo: inside the pickup overview's box, then just above the bottom card.
  const logo = box && !navLeg ? { b: box[2] + 4, l: box[3] + 4 } : { b: cardPx + 4, l: 0 };
  // The turn and bottom cards fade in (0.3 s) as the camera's move finishes.
  const cardFade: React.CSSProperties = navOn
    ? (reduced ? {} : { animation: `demo-card-in 300ms ease-out ${Math.max(0, easeMs - 300)}ms both` })
    : { opacity: 0, pointerEvents: "none" };

  // The fade between steps: a curtain in the page's background colour that clears
  // over 0.4 s each time the step changes (and closes before the reset). Below the
  // header, except on the full-screen drive.
  const curtain = (
    <div
      key={leaving ? "leaving" : phase}
      data-testid="demo-curtain"
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-[65] bg-background", leaving ? "demo-curtain-out" : "demo-curtain-in")}
      style={{ top: guideLayout ? 0 : headerPx }}
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
        {/* SOLO.drive as in the header's logo; DEMO in the header's Demo-tag gold. */}
        <p data-testid="demo-thanks" className="font-display text-2xl font-semibold leading-snug">
          Thanks for experiencing the <span data-testid="thanks-logo">SOLO<span className="text-gradient">.drive</span></span> <span data-testid="thanks-demo" className="text-warning">DEMO</span>
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="demo-ride"
      data-phase={phase}
      data-view={guidance ? "guidance" : "classic"}
      className={guideLayout
        ? "fixed inset-x-0 top-0 z-[60] h-[100svh] overflow-hidden bg-background"
        : fullScreen
          // On the way to pickup the screen sits above the header, so the map can open up over it.
          ? cn("fixed inset-x-0 bottom-0 flex flex-col gap-2 overflow-hidden bg-background pt-3 pb-[max(12px,env(safe-area-inset-bottom))]", pickupLeg ? "z-[60]" : "z-20")
          : "mx-auto max-w-3xl px-4 py-4 md:px-8"}
      style={guideLayout ? undefined : fullScreen ? { top: headerPx, paddingLeft: gutter, paddingRight: gutter } : undefined}
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
      {/* The same map through every step (see mapView); until the routes are in,
          an empty box of the same size. From the pickup on it fills the screen:
          on the pickup overview clipped to its box (boxRef), then opening up while
          the camera eases into the navigation view. */}
      <div
        data-testid="demo-map-frame"
        className={cn(
          fixedMap ? "fixed inset-0" : mapClass,
          fixedMap && "[&_.mapboxgl-ctrl-bottom-left]:!bottom-[var(--logo-b)] [&_.mapboxgl-ctrl-bottom-left]:!left-[var(--logo-l)]",
        )}
        style={fixedMap ? ({
          clipPath: box && !navLeg ? `inset(${box[0]}px ${box[1]}px ${box[2]}px ${box[3]}px round 16px)` : "inset(0px round 0px)",
          transition: reduced || !navLeg ? undefined : `clip-path ${easeMs}ms ease-in-out`,
          "--logo-b": `${logo.b}px`,
          "--logo-l": `${logo.l}px`,
        } as React.CSSProperties) : undefined}
      >
        {mapView ? (
          <MapboxMap
            className={fixedMap ? mapClass : "h-full w-full"}
            prepared={mapView}
            fitPadding={fitPadding}
            tripProgress={phase === "drive" ? progress : pickupLeg ? legP : null}
            resizeWithContainer
            driveView={navOn ? { bottomPx, reduced } : null}
          />
        ) : (
          <div data-testid="demo-map-wait" className="h-full w-full rounded-2xl border border-border bg-surface" />
        )}
      </div>

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
            {/* The breakdown (DEMO_RATE_ROWS, in order), in its own scroll box: about
                three rows show and the next peeks in. Touching or scrolling it holds
                the countdown. */}
            <div className="relative mt-1">
              <div
                ref={rowsRef}
                data-testid="demo-offer-breakdown"
                onPointerDown={() => touchBreakdown(true)}
                onPointerCancel={() => touchBreakdown(false)}
                onTouchStart={() => touchBreakdown(true)}
                onTouchEnd={() => touchBreakdown(false)}
                onTouchCancel={() => touchBreakdown(false)}
                onWheel={() => touchBreakdown()}
                onScroll={(e) => {
                  touchBreakdown();
                  const el = e.currentTarget;
                  if (el.scrollHeight - el.scrollTop - el.clientHeight < 2) setRowsEnd(true);
                }}
                className="max-h-[114px] overflow-y-auto overscroll-contain pr-1 [touch-action:pan-y] [-webkit-tap-highlight-color:transparent]"
              >
                {DEMO_RATE_ROWS.map((row) => (
                  <div key={row.label} data-testid="demo-rate-row" className="flex items-center justify-between gap-3 border-t border-primary/15 py-0.5 first:border-t-0">
                    <div className="min-w-0">
                      <div className="text-[12px] leading-4 text-foreground/90">{row.label}</div>
                      <div className="truncate text-[10px] leading-3 text-muted-foreground">{row.basis}</div>
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums text-foreground/80">{row.add ? "+" : ""}${row.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {!rowsEnd && (
                <span data-testid="demo-offer-scroll-cue" aria-hidden="true" className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-0.5 text-[11px] text-muted-foreground/80 backdrop-blur">
                  scroll ↓
                </span>
              )}
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
      ) : pickupLeg && !guideLayout ? (
        <>
          {/* Where the map shows on the overview (the map itself is the fixed layer above). */}
          <div ref={boxRef} aria-hidden="true" className="min-h-[96px] w-full flex-1" />
          <div data-testid="demo-pickup" className={cn("flex shrink-0 flex-col gap-2", navLeg && "opacity-0", navLeg && !reduced && "transition-opacity duration-300")}>
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
        </>
      ) : null}
      {overlays ? (
        <>
          {/* Top: the next turn — arrow, street, distance to it. */}
          <div ref={turnRef} data-testid="guide-turn" className="fixed inset-x-3 z-10 rounded-3xl border border-primary/30 bg-[#15122a]/95 p-4 shadow-elevated backdrop-blur" style={{ top: "max(12px, env(safe-area-inset-top))", ...cardFade }}>
            <div key={nextIdx} className={cn("flex items-center gap-4", !reduced && "demo-turn-swap")}>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                <TurnIcon className="h-10 w-10" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div data-testid="guide-turn-distance" className="font-display text-3xl font-semibold leading-none">{arrived ? "Arrived" : turnDistance(turnMi)}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span data-testid="guide-turn-street" className="line-clamp-2 text-xl font-semibold leading-tight">{turnStreet}</span>
                  {turnRef2 && <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">{turnRef2}</span>}
                </div>
              </div>
            </div>
          </div>
          {/* Bottom: time left, miles left and the arrival time; the customer (with
              Call and Message) and the fare (on the way to pickup, the pickup
              address instead). */}
          <div ref={bottomRef} data-testid="guide-bottom" className="fixed inset-x-3 z-10 rounded-3xl border border-border bg-card/95 px-5 py-4 shadow-elevated backdrop-blur" style={{ bottom: "max(12px, env(safe-area-inset-bottom))", ...cardFade }}>
            <div data-testid="guide-time" className={cn("font-display font-semibold leading-none text-success", arrived ? "text-3xl" : "text-4xl")}>{arrived ? "Arrived at pickup" : navMinutes}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-base text-muted-foreground">
              <span data-testid="guide-miles" className="font-medium text-foreground">{navMiles}</span>
              <span>·</span>
              <span>Arrival <span data-testid="guide-arrival" className="font-medium text-[#22d3ee]">{navArrival}</span></span>
            </div>
            <div data-testid="guide-customer-row" className="mt-3 flex items-center justify-between gap-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
              <span className="inline-flex shrink-0 items-center gap-1"><User className="h-3.5 w-3.5" /> Customer <span data-testid="guide-customer" className="font-medium text-foreground">{r.customer}</span></span>
              {navLeg
                ? <span data-testid="guide-pickup-address" className="min-w-0 truncate font-medium text-foreground">{endStreet}</span>
                : <span data-testid="guide-fare" className="font-medium text-foreground">${r.rate.total.toFixed(2)}</span>}
              {/* In the row's own height (negative margins), so the card doesn't grow. */}
              <span className="-my-1 flex shrink-0 items-center gap-1">
                <button type="button" data-testid="guide-call" aria-label="Call Customer" onClick={() => notice("Simulated in-app call · numbers stay private")}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary-glow [-webkit-tap-highlight-color:transparent] active:bg-primary/30">
                  <Phone className="h-3 w-3" />
                </button>
                <button type="button" data-testid="guide-message" aria-label="Message Customer" onClick={() => notice("Simulated in-app message · numbers stay private")}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary-glow [-webkit-tap-highlight-color:transparent] active:bg-primary/30">
                  <MessageCircle className="h-3 w-3" />
                </button>
              </span>
            </div>
          </div>
          {/* Left, under the turn card: a sample speed (fixed, not real data). */}
          <div data-testid="guide-speed" aria-label={`Sample speed ${SAMPLE_MPH} mph`} className="pointer-events-none fixed left-3 z-10 flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-white/15 bg-[#15122a]/90 text-white shadow-elevated backdrop-blur" style={{ top: turnPx + 10, ...cardFade }}>
            <span className="font-display text-xl font-semibold leading-none tabular-nums">{SAMPLE_MPH}</span>
            <span className="mt-0.5 text-[10px] uppercase leading-none tracking-wider text-white/70">mph</span>
          </div>
          {/* Under the car: the street it is on now. */}
          {onStreet && (
            <div data-testid="guide-street-pill" className="pointer-events-none fixed inset-x-0 z-10 flex justify-center" style={{ bottom: bottomPx - PILL_BELOW_CAR_PX - 24, ...cardFade }}>
              <span className="max-w-[70vw] truncate rounded-full bg-white/95 px-3 py-1 text-[13px] font-semibold leading-4 text-[#15122a] shadow-elevated">{onStreet}</span>
            </div>
          )}
          {toast && (
            <div role="status" data-testid="guide-toast" className="pointer-events-none fixed inset-x-6 z-20 mx-auto max-w-sm rounded-full border border-primary/30 bg-[#15122a]/95 px-4 py-2 text-center text-xs font-medium text-foreground shadow-elevated backdrop-blur" style={{ top: toast.top }}>
              {toast.text}
            </div>
          )}
        </>
      ) : !offer && !pickupLeg ? (
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
      ) : null}
    </div>
  );
}
