import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MapboxMap, type RouteData } from "@/components/MapboxMap";
import type { RateBreakdown } from "@/lib/smart-rate";
import { supabase } from "@/lib/supabase";
import { DOCUMENT_REQUIREMENTS } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";
import {
  MapPin, Navigation, Clock, ShieldCheck, Sparkles, ArrowRight,
  FileText, Star, X, Loader2, CheckCircle2, AlertTriangle, FileSignature, Download, Flag,
} from "lucide-react";

type FeaturedOperator = {
  id: string;
  name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
};

/** There's no real rider/operator matching yet — this shows whichever active
 *  operator exists, as a stand-in for "the matched operator" until that system
 *  is built. Real fields, just not a real match. */
function useFeaturedOperator(enabled: boolean) {
  return useQuery({
    queryKey: ["featured-operator"],
    enabled,
    queryFn: async (): Promise<FeaturedOperator | null> => {
      const { data, error } = await supabase
        .from("operator_public_profile")
        .select("id, name, vehicle_make, vehicle_model, vehicle_year")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useOperatorVerification(operatorId: string | undefined) {
  return useQuery({
    queryKey: ["operator-verification", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const [{ data: docs, error: docErr }, { data: rating, error: ratingErr }] = await Promise.all([
        supabase.from("operator_document_status").select("document_type, status").eq("operator_id", operatorId!),
        supabase.from("operator_rating_summary").select("avg_rating, ratings_count").eq("operator_id", operatorId!).maybeSingle(),
      ]);
      if (docErr) throw docErr;
      if (ratingErr) throw ratingErr;
      return {
        docs: (docs ?? []) as { document_type: string; status: "pending" | "verified" | "rejected" | "expired" }[],
        avgRating: rating?.avg_rating ?? null,
        ratingsCount: rating?.ratings_count ?? 0,
      };
    },
  });
}

const PO_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomDigits(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

function randomLetters(n: number) {
  return Array.from({ length: n }, () => PO_LETTERS[Math.floor(Math.random() * PO_LETTERS.length)]).join("");
}

function generatePoNumber(initials: string) {
  return `${initials}-${randomDigits(4)}${randomLetters(2)}-${randomDigits(4)}`;
}

/** "11:55 AM" */
function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
/** The Smart Rate shown everywhere this component renders: fixed figures,
 *  the same whatever the day, time, or route ($4.50 + $31.75 + $2.90 fuel =
 *  $39.15, ×1.08). Only "Special event nearby" changes it, adding the engine's
 *  event surcharge (+30% of base + distance = +$10.88 → $50.03, ×1.38).
 *  Worked in integer cents so the rounding is exact. */
function fixedSmartRate(specialEvent: boolean): RateBreakdown {
  const baseC = 450;
  const distanceC = 3175;
  const fuelC = 290;
  const eventC = specialEvent ? Math.round((baseC + distanceC) * 0.3) : 0;
  const totalC = baseC + distanceC + fuelC + eventC;
  return {
    base: baseC / 100,
    distance: distanceC / 100,
    fuelAdj: fuelC / 100,
    peakAdj: 0,
    weekendAdj: 0,
    eventAdj: eventC / 100,
    total: totalC / 100,
    multiplier: Math.round((totalC / (baseC + distanceC)) * 100) / 100,
  };
}

type SmartRateBookingProps = {
  /** "split": the full responsive two-column booking layout (map | panel).
   *  "stacked": a single column, always — for embedding in a narrower slot.
   *  "preview": a compact, non-editable summary card (real map/data, fixed
   *  addresses, Confirm links out to /customer instead of confirming locally).
   *  "intro": the homepage Customer section's opening card — the Where-To panel
   *  alone as a display card (no map or route lookup, no Confirm). The only
   *  live element is a pulsing Verify button that opens the Verify popup;
   *  closing it calls onVerifyClose. Renders just the card; the page supplies
   *  the surrounding layout. */
  layout?: "split" | "stacked" | "preview" | "intro";
  /** Show the matched-operator identity card (name, avatar, Verify button). */
  showOperatorCard?: boolean;
  /** Called when the visitor wants to open the Downloads popup themselves
   *  (manual "Download the app" link) — Confirm ride never triggers it. */
  onRequestDownload?: () => void;
  /** "intro" only: called when the Verify popup is closed. */
  onVerifyClose?: () => void;
  /** "preview" only: give the Book-A-Ride button the same attention flash
   *  the intro card's Verify button has. */
  ctaAttention?: boolean;
};

export function SmartRateBooking({
  layout = "split",
  showOperatorCard = true,
  onRequestDownload,
  onVerifyClose,
  ctaAttention = false,
}: SmartRateBookingProps) {
  const [pickup, setPickup] = useState("1333 Camelback Rd, Phoenix, AZ");
  const [dropoff, setDropoff] = useState("14765 Scottsdale Rd, Scottsdale, AZ");
  const [event, setEvent] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  // "intro" layout: the Verify button pulses until the popup has been opened once.
  const [verifyOpened, setVerifyOpened] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [confirmation, setConfirmation] = useState<{ at: number; poNumber: string; operatorEtaMin: number } | null>(null);
  // Nearby-driver cars are ambient map decoration, visible from arrival — kept
  // separate from `confirmation` (which gates the CSA box) since Confirm ride
  // should keep refreshing them without controlling whether they show at all.
  const [nearbyDriversSeed, setNearbyDriversSeed] = useState<number | null>(() => Date.now());

  const { data: featuredOperator, isLoading: operatorLoading } = useFeaturedOperator(showOperatorCard);
  const { data: verification } = useOperatorVerification(showOperatorCard ? featuredOperator?.id : undefined);

  const operatorName = featuredOperator?.name?.trim() || "Unverified operator";
  const vehicleLine = [featuredOperator?.vehicle_year, featuredOperator?.vehicle_make, featuredOperator?.vehicle_model]
    .filter(Boolean)
    .join(" ");
  const ratingLabel = verification?.avgRating != null
    ? `${Number(verification.avgRating).toFixed(2)} (${verification.ratingsCount})`
    : "New operator";

  const handleRouteData = useCallback((d: RouteData) => setRouteData(d), []);

  const rate = useMemo(() => fixedSmartRate(event), [event]);

  // On every Confirm ride, bring the newly revealed CSA block into view — it's
  // usually below the fold (under the map on desktop, under the panel + map on
  // mobile), so without this confirming looks like it did nothing.
  const csaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirmation) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    csaRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, [confirmation?.at]);

  if (layout === "intro") {
    return (
      <>
        <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Where to?</div>

          <div className="mt-4 space-y-2">
            <DisplayField icon={<span className="h-2.5 w-2.5 rounded-full bg-primary-glow" />} label="Pickup" value={pickup} />
            <DisplayField icon={<span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />} label="Drop-off" value={dropoff} />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-warning" /> Special event nearby</span>
            {/* Display-only: same look as the real checkbox, but not focusable or clickable. */}
            <input
              type="checkbox"
              checked={false}
              onChange={() => {}}
              tabIndex={-1}
              aria-readonly="true"
              className="pointer-events-none h-4 w-4 accent-primary"
            />
          </div>

          {showOperatorCard && (
            <div className="mt-5 rounded-2xl border border-border bg-card p-4">
              {operatorLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : featuredOperator ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-display text-lg font-semibold">
                    {operatorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{operatorName}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-warning text-warning" /> {ratingLabel}
                      {vehicleLine && ` · ${vehicleLine}`}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setVerifyOpened(true);
                      setVerifyOpen(true);
                    }}
                    className={cn(
                      "shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-secondary",
                      // The one live element on the card — a solid gradient fill, glow,
                      // expanding ring, and gentle scale until it's been opened once.
                      // Same padding and border width, so the size doesn't change.
                      !verifyOpened &&
                        "animate-verify-attention border-transparent bg-gradient-primary text-white",
                    )}
                  >
                    Verify
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No operators are currently available in your area.</p>
              )}
            </div>
          )}

          {/* Smart Rate breakdown — fixed display values. */}
          <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-primary-glow">Smart Rate · locked</div>
                <div className="mt-1 font-display text-4xl font-semibold">${rate.total.toFixed(2)}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                ×{rate.multiplier.toFixed(2)} multiplier<br />
                100% to operator
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Row k="Base" v={`$${rate.base.toFixed(2)}`} />
              <Row k="Distance" v={`$${rate.distance.toFixed(2)}`} />
              <Row k="Fuel index" v={`+$${rate.fuelAdj.toFixed(2)}`} />
              <Row k="Peak time" v={`+$${rate.peakAdj.toFixed(2)}`} />
              <Row k="Weekend" v={`+$${rate.weekendAdj.toFixed(2)}`} />
              <Row k="Event" v={`+$${rate.eventAdj.toFixed(2)}`} />
            </div>
          </div>
        </div>

        {/* Closing the popup hands off to the page (the homepage swaps in the
            Book-A-Ride preview card). */}
        {showOperatorCard && verifyOpen && (
          <VerifyDialog
            operatorName={operatorName}
            docs={verification?.docs ?? []}
            onClose={() => {
              setVerifyOpen(false);
              onVerifyClose?.();
            }}
          />
        )}
      </>
    );
  }

  if (layout === "preview") {
    return (
      <>
        <div className="rounded-3xl border border-border bg-gradient-surface p-4 shadow-elevated">
          <MapboxMap
            className="h-[260px] w-full" // matches the /customer split map's phone-width height
            pickupAddress={pickup}
            dropoffAddress={dropoff}
            onRouteData={handleRouteData}
            fitPadding={20}
          />

          <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Where to?</div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary-glow" />
              <span className="truncate text-muted-foreground">{pickup}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
              <span className="truncate text-muted-foreground">{dropoff}</span>
            </div>
          </div>

          {showOperatorCard && (
            <div className="mt-3 rounded-2xl border border-border bg-card p-3">
              {operatorLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : featuredOperator ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-display text-sm font-semibold">
                    {operatorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">{operatorName}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] text-success">
                        <ShieldCheck className="h-2.5 w-2.5" /> Verified
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      <Star className="mr-0.5 inline h-2.5 w-2.5 fill-warning text-warning" /> {ratingLabel}
                      {vehicleLine && ` · ${vehicleLine}`}
                    </div>
                  </div>
                  <button
                    onClick={() => setVerifyOpen(true)}
                    className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] hover:bg-secondary"
                  >
                    Verify
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No operators are currently available in your area.</p>
              )}
            </div>
          )}

          <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-primary-glow">Smart Rate · locked</div>
              <div className="text-[10px] text-muted-foreground">×{rate.multiplier}</div>
            </div>
            <div className="mt-1 font-display text-3xl font-semibold">${rate.total.toFixed(2)}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <Row k="Base" v={`$${rate.base.toFixed(2)}`} />
              <Row k="Distance" v={`$${rate.distance.toFixed(2)}`} />
              <Row k="Fuel index" v={`+$${rate.fuelAdj.toFixed(2)}`} />
              <Row k="Peak time" v={`+$${rate.peakAdj.toFixed(2)}`} />
              <Row k="Weekend" v={`+$${rate.weekendAdj.toFixed(2)}`} />
              <Row k="Event" v={`+$${rate.eventAdj.toFixed(2)}`} />
            </div>
          </div>

          <Link
            to="/customer"
            className={cn(
              "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]",
              ctaAttention && "animate-verify-attention",
            )}
          >
            Book-A-Ride · ${rate.total.toFixed(2)} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {showOperatorCard && verifyOpen && (
          <VerifyDialog
            operatorName={operatorName}
            docs={verification?.docs ?? []}
            onClose={() => setVerifyOpen(false)}
          />
        )}
      </>
    );
  }

  // Nothing here is real or saved — no auth check, no database write. Every
  // visitor sees the same simulated confirmation, repeatable at will.
  const handleConfirm = () => {
    const at = Date.now();
    setConfirmation({
      at,
      poNumber: generatePoNumber("MR"),
      operatorEtaMin: 2 + Math.floor(Math.random() * 4), // 2-5 min to pickup
    });
    setNearbyDriversSeed(at); // fresh arrangement on every confirm, as before
  };

  const csaText = `Customer Marie C. and Operator Marcus R. entered into a Contracted Svs Agreement (CSA) for `
    + `transportation/delivery from the marked pick-up, drop-off, and/or delivery location(s) specified in the `
    + `"Where To" for the agreed upon $${rate.total.toFixed(2)} Smart Rate price.`;

  const mapBlock = (
    <div>
      <MapboxMap
        // Split layout: half height on phones so the pills, CSA block, and Confirm
        // button stay close together; full 520px from sm (640px) up.
        className={layout === "stacked" ? "h-[240px] w-full" : "h-[260px] w-full sm:h-[520px]"}
        pickupAddress={pickup}
        dropoffAddress={dropoff}
        onRouteData={handleRouteData}
        nearbyDriversSeed={nearbyDriversSeed}
        onlyConfirmedDriver={confirmation != null}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Pill
          icon={<Navigation className="h-3.5 w-3.5" />}
          label="Distance"
          value={routeData ? `${routeData.distanceMi.toFixed(1)} mi` : "—"}
        />
        <Pill
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Trip ETA"
          value={routeData ? `${Math.round(routeData.durationMin)} min` : "—"}
        />
        {/* Arrival = CSA timestamp + Operator ETA to pickup + Trip ETA. */}
        <Pill
          icon={<Flag className="h-3.5 w-3.5" />}
          label="Arrival"
          value={confirmation && routeData
            ? formatTime(confirmation.at + (confirmation.operatorEtaMin + Math.round(routeData.durationMin)) * 60_000).toLowerCase()
            : "—"}
          // Same cyan as the map's drop-off marker; the "—" placeholder stays neutral.
          valueClassName={confirmation && routeData ? "text-[#22d3ee]" : undefined}
        />
      </div>

      <div ref={csaRef} className="mt-8 scroll-mb-6 scroll-mt-24 rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-glow">
            <FileSignature className="h-3 w-3" /> Contracted Services
          </div>
          {confirmation && (
            <div className="font-mono text-xs text-muted-foreground">[#{confirmation.poNumber}]</div>
          )}
        </div>

        {confirmation && (
          <>
            <p className="mt-1.5 min-h-[5em] text-xs leading-snug text-muted-foreground">
              <TypewriterText text={csaText} replayKey={confirmation.at} />
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Operator ETA to pickup:{" "}
              <span className="font-semibold text-success">{confirmation.operatorEtaMin} min</span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const panelBlock = (
    <div className="rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Where to?</div>

      <div className="mt-4 space-y-2">
        <Field icon={<span className="h-2.5 w-2.5 rounded-full bg-primary-glow" />} value={pickup} onChange={setPickup} label="Pickup" />
        <Field icon={<span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />} value={dropoff} onChange={setDropoff} label="Drop-off" />
      </div>

      <label className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-warning" /> Special event nearby</span>
        <input type="checkbox" checked={event} onChange={(e) => setEvent(e.target.checked)} className="h-4 w-4 accent-primary" />
      </label>

      {showOperatorCard && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          {operatorLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : featuredOperator ? (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-display text-lg font-semibold">
                {operatorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{operatorName}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-warning text-warning" /> {ratingLabel}
                  {vehicleLine && ` · ${vehicleLine}`}
                </div>
              </div>
              <button
                onClick={() => setVerifyOpen(true)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-secondary"
              >
                Verify
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No operators are currently available in your area.</p>
          )}
        </div>
      )}

      {/* Smart Rate breakdown */}
      <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-primary-glow">Smart Rate · locked</div>
            <div className="mt-1 font-display text-4xl font-semibold">${rate.total.toFixed(2)}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            ×{rate.multiplier} multiplier<br />
            100% to operator
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Row k="Base" v={`$${rate.base.toFixed(2)}`} />
          <Row k="Distance" v={`$${rate.distance.toFixed(2)}`} />
          <Row k="Fuel index" v={`+$${rate.fuelAdj.toFixed(2)}`} />
          <Row k="Peak time" v={`+$${rate.peakAdj.toFixed(2)}`} />
          <Row k="Weekend" v={`+$${rate.weekendAdj.toFixed(2)}`} />
          <Row k="Event" v={`+$${rate.eventAdj.toFixed(2)}`} />
        </div>
      </div>

      <button
        onClick={handleConfirm}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.01]"
      >
        Confirm ride · ${rate.total.toFixed(2)} <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        By confirming you accept the locked Smart Rate. No surge surprises.
      </p>

      {onRequestDownload && (
        <button
          onClick={onRequestDownload}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" /> Download the app
        </button>
      )}
    </div>
  );

  return (
    <>
      {layout === "split" ? (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-8 lg:grid-cols-[1fr_420px]">
          <div className="order-2 lg:order-1">{mapBlock}</div>
          <div className="order-1 lg:order-2">{panelBlock}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {panelBlock}
          {mapBlock}
        </div>
      )}

      {showOperatorCard && verifyOpen && (
        <VerifyDialog
          operatorName={operatorName}
          docs={verification?.docs ?? []}
          onClose={() => setVerifyOpen(false)}
        />
      )}
    </>
  );
}

function Field({ icon, value, onChange, label }: { icon: React.ReactNode; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex h-6 w-6 items-center justify-center">{icon}</div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
      </div>
      <MapPin className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

/** Read-only twin of Field for the "intro" card: same box, label, and icons,
 *  but plain text that wraps instead of an input, so full addresses fit at
 *  phone width. */
function DisplayField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="break-words text-sm">{value}</div>
      </div>
      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function Pill({ icon, label, value, valueClassName }: { icon: React.ReactNode; label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</span>
      <span className={cn("text-sm font-medium", valueClassName)}>{value}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <><span>{k}</span><span className="text-right text-foreground/80">{v}</span></>;
}

/** Reveals `text` over a fixed short duration regardless of length, and
 *  replays whenever `replayKey` changes — even if `text` itself is the same. */
function TypewriterText({ text, replayKey, totalMs = 650 }: { text: string; replayKey: number; totalMs?: number }) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    if (!text) return;
    const tickMs = 16;
    const ticks = Math.max(1, Math.round(totalMs / tickMs));
    const perTick = Math.max(1, Math.ceil(text.length / ticks));
    const id = setInterval(() => {
      setVisible((v) => {
        const next = v + perTick;
        if (next >= text.length) {
          clearInterval(id);
          return text.length;
        }
        return next;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [text, totalMs, replayKey]);

  return <>{text.slice(0, visible)}</>;
}

type DocStatus = "verified" | "pending" | "rejected" | "expired" | "missing";

function getRequirementStatus(
  docTypeIds: string[],
  docs: { document_type: string; status: "pending" | "verified" | "rejected" | "expired" }[],
): DocStatus {
  const matches = docTypeIds.map((id) => docs.find((d) => d.document_type === id));
  if (matches.some((d) => d?.status === "expired")) return "expired";
  if (matches.some((d) => d?.status === "rejected")) return "rejected";
  if (matches.every((d) => d?.status === "verified")) return "verified";
  if (matches.some((d) => d)) return "pending";
  return "missing";
}

function VerifyDialog({
  operatorName,
  docs,
  onClose,
}: {
  operatorName: string;
  docs: { document_type: string; status: "pending" | "verified" | "rejected" | "expired" }[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-elevated">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Verify Driver</div>
        <h2 className="mt-1 font-display text-2xl font-semibold">{operatorName}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Read-only credentials. Driver is notified of your view.</p>

        <div className="mt-5 space-y-2">
          {DOCUMENT_REQUIREMENTS.map((req) => {
            const status = getRequirementStatus(req.docTypeIds, docs);
            return (
              <div key={req.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  status === "verified" ? "bg-success/15 text-success" :
                  status === "pending" ? "bg-warning/15 text-warning" :
                  "bg-destructive/15 text-destructive",
                )}>
                  {status === "verified" ? <CheckCircle2 className="h-4 w-4" /> : status === "pending" ? <FileText className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{req.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {status === "verified" ? "Verified by Compliance" :
                     status === "pending" ? "Submitted · pending Compliance review" :
                     status === "rejected" ? "Rejected by Compliance" :
                     status === "expired" ? "Expired · renewal required" :
                     "Not yet submitted"}
                  </div>
                </div>
                <div className={cn(
                  "text-[10px] uppercase tracking-widest",
                  status === "verified" ? "text-success" : status === "pending" ? "text-warning" : "text-destructive",
                )}>
                  {status}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
