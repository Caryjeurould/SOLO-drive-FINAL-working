import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MapboxMap } from "@/components/MapboxMap";
import { PostTripReportPrompt } from "@/components/PostTripReportPrompt";
import { supabase } from "@/lib/supabase";
import { Phone, MessageCircle, Shield, Star, Navigation } from "lucide-react";

export const Route = createFileRoute("/customer/trip")({
  head: () => ({
    meta: [
      { title: "On the way — SOLO.drive" },
      { name: "description", content: "Track your operator in real time." },
    ],
  }),
  component: TripScreen,
});

function TripScreen() {
  const [eta, setEta] = useState(8);
  const [tripCompleted, setTripCompleted] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setEta((e) => Math.max(0, e - 1)), 4000);
    return () => clearInterval(t);
  }, []);

  const [tripRequestId, pickupAddress, dropoffAddress] = (() => {
    try {
      const stored = sessionStorage.getItem("solo.trip");
      if (stored) {
        const { tripRequestId, pickup, dropoff } = JSON.parse(stored);
        return [tripRequestId as string | undefined, pickup as string, dropoff as string];
      }
    } catch {}
    return [undefined, "1333 Camelback Rd, Phoenix, AZ", "14765 Scottsdale Rd, Scottsdale, AZ"];
  })();

  // The simulated ETA reaching 0 is what stands in for "trip completed" until
  // real GPS-driven trip tracking exists — but the trip_requests row it flips
  // here is real, so the post-trip report below is tied to an actual record.
  useEffect(() => {
    if (eta !== 0 || tripCompleted || !tripRequestId) return;
    setTripCompleted(true);
    supabase
      .from("trip_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", tripRequestId)
      .then(({ error }) => {
        if (error) console.error("Failed to mark trip completed", error);
      });
  }, [eta, tripCompleted, tripRequestId]);

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-8 lg:grid-cols-[1fr_380px]">
        <MapboxMap
          className="h-[560px] w-full"
          pickupAddress={pickupAddress}
          dropoffAddress={dropoffAddress}
          animateDriver
        />

        <div className="rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="uppercase tracking-[0.2em] text-success">Operator en route</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-6xl font-semibold">{eta}</span>
            <span className="text-sm text-muted-foreground">min away</span>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-display font-semibold">M</div>
              <div className="flex-1">
                <div className="font-medium">Marcus R.</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-warning text-warning" /> 4.96 · Tesla Model Y
                </div>
              </div>
              <span className="rounded-lg bg-surface px-2 py-1 font-mono text-xs">7B12·LMN</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Action icon={<Phone className="h-4 w-4" />} label="Call" />
              <Action icon={<MessageCircle className="h-4 w-4" />} label="Message" />
              <Action icon={<Shield className="h-4 w-4" />} label="Safety" />
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <Step done label="Booking confirmed" sub="Smart Rate locked at $24.80" />
            <Step done label="Operator assigned" sub="Marcus accepted the trip" />
            <Step done={tripCompleted} active={!tripCompleted} label="Driving to pickup" sub={tripCompleted ? "Arrived" : `${eta} min · 0.6 mi away`} />
            <Step done={tripCompleted} active={tripCompleted} label="Arrive at drop-off" sub={tripCompleted ? "Trip complete" : "Midtown East"} />
          </div>

          <Link
            to="/customer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm hover:bg-secondary"
          >
            <Navigation className="h-4 w-4" /> Share trip status
          </Link>
        </div>
      </div>

      {tripCompleted && tripRequestId && !feedbackGiven && (
        <PostTripReportPrompt
          tripRequestId={tripRequestId}
          role="rider"
          onDone={() => setFeedbackGiven(true)}
        />
      )}
    </AppShell>
  );
}

function Action({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface py-3 text-xs hover:bg-secondary">
      <span className="text-primary-glow">{icon}</span>
      {label}
    </button>
  );
}

function Step({ label, sub, done, active }: { label: string; sub: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative mt-1">
        <div className={
          "h-3 w-3 rounded-full " +
          (done ? "bg-success" : active ? "bg-primary" : "bg-muted")
        } />
        {active && <div className="absolute inset-0 rounded-full bg-primary animate-ping" />}
      </div>
      <div className="flex-1 leading-tight">
        <div className={done ? "text-muted-foreground line-through" : "font-medium"}>{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
