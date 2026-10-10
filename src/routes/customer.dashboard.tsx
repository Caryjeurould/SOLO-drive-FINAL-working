import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User, CreditCard, MapPin, Clock, ShieldCheck, ArrowRight,
  Loader2, CheckCircle2, Car, LogOut, Edit2, Save, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customer/dashboard")({
  head: () => ({
    meta: [{ title: "Customer Dashboard — SOLO.drive" }],
  }),
  component: CustomerDashboard,
});

const profileSchema = z.object({
  phone: z.string().min(10, "Enter a valid phone number"),
  dob: z.string().min(1, "Required"),
});
// firstName/lastName are loaded into the form (reset) and read on save, but
// there are no name inputs and the schema doesn't list them, so validation
// drops them and they're absent at save time — hence optional here.
type ProfileData = z.infer<typeof profileSchema> & { firstName?: string; lastName?: string };

type RiderProfile = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  dob: string | null;
  bg_status: string | null;
  approved_at: string | null;
};

type Trip = {
  id: string;
  pickup: string | null;
  dropoff: string | null;
  fare: number | null;
  distance: number | null;
  created_at: string;
};

function CustomerDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (authLoading) return; // wait for a saved sign-in to be restored
    if (!user) { navigate({ to: "/customer/login" }); return; }
    loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: prof }, { data: tripData }] = await Promise.all([
      supabase.from("riders").select("first_name, last_name, phone, dob, bg_status, approved_at").eq("id", user!.id).single(),
      supabase.from("trips").select("*").eq("rider_id", user!.id).order("created_at", { ascending: false }).limit(10),
    ]);
    if (prof) {
      setProfile(prof);
      reset({
        firstName: prof.first_name ?? "",
        lastName: prof.last_name ?? "",
        phone: prof.phone ?? "",
        dob: prof.dob ?? "",
      });
    }
    setTrips(tripData ?? []);
    setLoading(false);
  };

  const onSave = async (data: ProfileData) => {
    setSaving(true);
    await supabase.from("riders").update({
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      dob: data.dob,
    }).eq("id", user!.id);
    setProfile((p) => p ? { ...p, first_name: data.firstName ?? p.first_name, last_name: data.lastName ?? p.last_name, phone: data.phone, dob: data.dob } : p);
    setSaving(false);
    setSaveSuccess(true);
    setEditing(false);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ""}`.trim()
    : user?.email?.split("@")[0] ?? "Customer";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (loading) {
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
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">

        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Customer Dashboard</div>
            <h1 className="mt-1 font-display text-4xl font-semibold">{greeting}, {profile?.first_name ?? displayName}</h1>
            <div className="mt-2 flex items-center gap-2">
              {profile?.bg_status === "cleared" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs text-success">
                  <ShieldCheck className="h-3 w-3" /> Verified Customer
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs text-warning">
                  Pending Verification
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/customer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90"
            >
              <Car className="h-4 w-4" /> Book a Ride
            </Link>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">

          {/* Profile card */}
          <div className="rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary-glow" />
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">My Profile</span>
              </div>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
              ) : (
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>

            {saveSuccess && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> Profile updated successfully!
              </div>
            )}

            {!editing ? (
              <div className="mt-5 space-y-4">
                <ProfileRow label="Full name" value={`${profile?.first_name ?? "—"} ${profile?.last_name ?? ""}`.trim()} />
                <ProfileRow label="Date of birth" value={profile?.dob ?? "—"} />
                <ProfileRow label="Phone" value={profile?.phone ?? "—"} />
                <ProfileRow label="Email" value={user?.email ?? "—"} />
                {profile?.approved_at && (
                  <ProfileRow label="Verified since" value={new Date(profile.approved_at).toLocaleDateString()} />
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSave)} className="mt-5 space-y-4">
                {/* Name locked after background check */}
                <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-warning">Legal Name — Locked</p>
                      <p className="mt-0.5 text-sm font-medium">{profile?.first_name} {profile?.last_name}</p>
                    </div>
                    <ShieldCheck className="h-4 w-4 text-warning" />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Name changes require admin review after background check approval. Contact support to request a correction.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Date of birth</Label>
                  <Input type="date" {...register("dob")} />
                  {errors.dob && <p className="text-xs text-destructive">{errors.dob.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <Input type="tel" {...register("phone")} />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
                <Button type="submit" disabled={saving} className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save changes</>}
                </Button>
              </form>
            )}
          </div>

          {/* Payment card */}
          <div className="rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary-glow" />
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Payment Method</span>
            </div>
            <div className="mt-5 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Card on file</div>
                    <div className="text-xs text-muted-foreground">•••• •••• •••• ––––</div>
                  </div>
                </div>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Active</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Card updates coming soon via Stripe. Contact support to update your payment method.
            </p>
          </div>
        </div>

        {/* Trip history */}
        <div className="mt-6 rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary-glow" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Trip History</span>
          </div>

          {trips.length === 0 ? (
            <div className="mt-8 flex flex-col items-center py-8 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">No trips yet — book your first ride!</p>
              <Link
                to="/customer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow"
              >
                Book a ride <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {trips.map((trip) => (
                <div key={trip.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Car className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{trip.pickup ?? "—"} → {trip.dropoff ?? "—"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(trip.created_at).toLocaleDateString()} · {trip.distance ? `${trip.distance.toFixed(1)} mi` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold">${trip.fare?.toFixed(2) ?? "—"}</div>
                    <div className="text-[10px] uppercase tracking-widest text-success">Completed</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
