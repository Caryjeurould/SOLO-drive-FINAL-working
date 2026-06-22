import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MapboxMap, type RouteData } from "@/components/MapboxMap";
import { calculateSmartRate } from "@/lib/smart-rate";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  MapPin, Navigation, Clock, ShieldCheck, Sparkles, ArrowRight,
  FileText, Star, X, Loader2,
} from "lucide-react";
import { DownloadPopup } from "@/components/DownloadPopup";

export const Route = createFileRoute("/customer")({
  head: () => ({
    meta: [
      { title: "Book a Ride — SOLO.drive" },
      { name: "description", content: "Transparent Smart Rate pricing. Verified independent operators. No surprises." },
    ],
  }),
  component: CustomerBooking,
});

function CustomerBooking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowPopup(true), 15000);
    return () => clearTimeout(timer);
  }, []);
  const [pickup, setPickup] = useState("1333 Camelback Rd, Phoenix, AZ");
  const [dropoff, setDropoff] = useState("14765 Scottsdale Rd, Scottsdale, AZ");
  const [event, setEvent] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  const handleRouteData = useCallback((d: RouteData) => setRouteData(d), []);

  const now = new Date();
  const rate = useMemo(() => calculateSmartRate({
    pickupDistanceMi: 0.6,
    dropoffDistanceMi: routeData ? routeData.distanceMi : 4.2,
    hour: now.getHours(),
    dayOfWeek: now.getDay(),
    gasPricePerGal: 3.78,
    specialEvent: event,
  }), [event, routeData]);

  const confirmRide = async () => {
    if (!user) { setShowPopup(true); return; }
    const { data } = await supabase.from("riders").select("bg_status").eq("id", user.id).single();
    if (!data || data.bg_status !== "cleared") { setShowPopup(true); return; }
    sessionStorage.setItem("solo.trip", JSON.stringify({ pickup, dropoff }));
    navigate({ to: "/customer/trip" });
  };

  return (
    <AppShell>
      {showPopup && <DownloadPopup onClose={() => setShowPopup(false)} />}
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-8 lg:grid-cols-[1fr_420px]">
        {/* Map */}
        <div className="order-2 lg:order-1">
          <MapboxMap
            className="h-[520px] w-full"
            pickupAddress={pickup}
            dropoffAddress={dropoff}
            onRouteData={handleRouteData}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Pill
              icon={<Navigation className="h-3.5 w-3.5" />}
              label="Distance"
              value={routeData ? `${routeData.distanceMi.toFixed(1)} mi` : "—"}
            />
            <Pill
              icon={<Clock className="h-3.5 w-3.5" />}
              label="ETA"
              value={routeData ? `${Math.round(routeData.durationMin)} min` : "—"}
            />
            <Pill icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Operator" value="Verified" />
          </div>
        </div>

        {/* Booking panel */}
        <div className="order-1 lg:order-2">
          <div className="rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Where to?</div>

            <div className="mt-4 space-y-2">
              <Field icon={<span className="h-2.5 w-2.5 rounded-full bg-primary-glow" />} value={pickup} onChange={setPickup} label="Pickup" />
              <Field icon={<span className="h-2.5 w-2.5 rounded-full bg-accent" />} value={dropoff} onChange={setDropoff} label="Drop-off" />
            </div>

            <label className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-warning" /> Special event nearby</span>
              <input type="checkbox" checked={event} onChange={(e) => setEvent(e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>

            {/* Operator card */}
            <div className="mt-5 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-display text-lg font-semibold">M</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Marcus R.</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-warning text-warning" /> 4.96 · Tesla Model Y · 7B12-LMN
                  </div>
                </div>
                <button
                  onClick={() => setVerifyOpen(true)}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  Verify
                </button>
              </div>
            </div>

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
              onClick={confirmRide}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.01]"
            >
              Confirm ride · ${rate.total.toFixed(2)} <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              By confirming you accept the locked Smart Rate. No surge surprises.
            </p>
          </div>
        </div>
      </div>

      {verifyOpen && <VerifyDialog onClose={() => setVerifyOpen(false)} />}
    </AppShell>
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

function Pill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <><span>{k}</span><span className="text-right text-foreground/80">{v}</span></>;
}

function VerifyDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const docs = [
    { name: "Driver's License", state: "NY · Class E", verified: "Verified Jan 14, 2025" },
    { name: "Commercial Auto Insurance", state: "GEICO Commercial", verified: "Verified Apr 10, 2025" },
    { name: "Background Check", state: "Checkr · Clear", verified: "Verified Feb 21, 2025" },
    { name: "Entity / LLC", state: "Marcus R. Mobility LLC", verified: "Verified Mar 2, 2025" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-elevated">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Verify Driver</div>
        <h2 className="mt-1 font-display text-2xl font-semibold">Marcus R.</h2>
        <p className="mt-1 text-xs text-muted-foreground">Read-only credentials. Driver is notified of your view.</p>

        <div className="mt-5 space-y-2">
          {docs.map((d) => (
            <div key={d.name} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground">{d.state}</div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-success">{d.verified.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
