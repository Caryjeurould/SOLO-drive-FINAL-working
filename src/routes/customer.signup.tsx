import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User, ShieldCheck, CreditCard, ArrowRight, ArrowLeft,
  Loader2, CheckCircle2, Car, AlertTriangle, Lock,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customer/signup")({
  // The real signup form must never be reachable on the public website —
  // no exceptions, regardless of auth or how the visitor arrived. It only
  // exists inside the installed Customer app. Every hit here bounces to
  // /download before anything else renders.
  beforeLoad: () => {
    throw redirect({ to: "/download" });
  },
  head: () => ({
    meta: [{ title: "Rider Signup — SOLO.drive" }],
  }),
  component: CustomerSignup,
});

const STAGES = [
  { n: 1, title: "Account", icon: User },
  { n: 2, title: "Identity & Card", icon: CreditCard },
  { n: 3, title: "Background Check", icon: ShieldCheck },
] as const;

// ── Luhn check for card numbers ─────────────────────────────────────────────
function luhn(n: string) {
  const digits = n.replace(/\D/g, "").split("").reverse().map(Number);
  const sum = digits.reduce((acc, d, i) => {
    if (i % 2 !== 0) { d *= 2; if (d > 9) d -= 9; }
    return acc + d;
  }, 0);
  return sum % 10 === 0;
}

// ── Stage 1: Account ─────────────────────────────────────────────────────────
const accountSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
});
type AccountData = z.infer<typeof accountSchema>;

// ── Stage 2: Identity & Card ─────────────────────────────────────────────────
const identitySchema = z.object({
  firstName: z.string().min(2, "Required"),
  lastName: z.string().min(2, "Required"),
  dob: z.string().min(1, "Date of birth required"),
  phone: z.string().min(10, "Enter a valid phone number"),
  cardNumber: z.string().refine((v) => luhn(v.replace(/\s/g, "")), "Invalid card number"),
  cardExpiry: z.string().regex(/^\d{2}\/\d{2}$/, "Format: MM/YY"),
  cardCvc: z.string().min(3, "Invalid CVC"),
});
type IdentityData = z.infer<typeof identitySchema>;

function CustomerSignup() {
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<1 | 2 | 3>(1);

  // If already verified, skip straight to booking
  useEffect(() => {
    if (authLoading || !user) return;
    supabase.from("riders").select("bg_status").eq("id", user.id).single().then(({ data }) => {
      if (data?.bg_status === "cleared") navigate({ to: "/customer" });
    });
  }, [user, authLoading]);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [identityData, setIdentityData] = useState<IdentityData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">You're approved!</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your background check cleared. Welcome to SOLO.drive — your rider account is ready.
          </p>
          <Link
            to="/customer/dashboard"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            Go to my dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
        {/* Header */}
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-xl font-semibold">
              SOLO<span className="text-gradient">.drive</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Rider Authorization</div>
          </div>
        </div>

        {/* Stage indicators */}
        <div className="mt-6 flex gap-2">
          {STAGES.map(({ n, title, icon: Icon }) => {
            const complete = n < stage;
            const active = n === stage;
            return (
              <div key={n} className={cn(
                "flex flex-1 items-center gap-2 rounded-2xl border px-3 py-2.5 transition-all",
                complete ? "border-success/30 bg-success/10" :
                active ? "border-primary/40 bg-primary/10" :
                "border-border bg-surface opacity-50"
              )}>
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold",
                  complete ? "bg-success/20 text-success" :
                  active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className="hidden text-xs font-medium sm:block">{title}</span>
              </div>
            );
          })}
        </div>

        {/* Stage content */}
        <div className="mt-6 rounded-3xl border border-border bg-card/80 p-6 shadow-elevated backdrop-blur-2xl">
          {stage === 1 && (
            <Stage1
              onNext={(data, uid) => {
                setAccountData(data);
                setUserId(uid);
                setStage(2);
              }}
              signUp={signUp}
            />
          )}
          {stage === 2 && (
            <Stage2
              onNext={(data) => { setIdentityData(data); setStage(3); }}
              onBack={() => setStage(1)}
            />
          )}
          {stage === 3 && identityData && userId && accountData && (
            <Stage3
              userId={userId}
              email={accountData.email}
              identityData={identityData}
              onComplete={() => setDone(true)}
              onBack={() => setStage(2)}
            />
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/customer/login" className="text-primary-glow hover:underline">Sign in</Link>
        </p>
      </div>
    </AppShell>
  );
}

// ── Stage 1: Account Creation ────────────────────────────────────────────────
function Stage1({ onNext, signUp }: {
  onNext: (data: AccountData, uid: string) => void;
  signUp: (email: string, password: string) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AccountData>({
    resolver: zodResolver(accountSchema),
  });

  const onSubmit = async (data: AccountData) => {
    setServerError(null);
    const { data: authData, error } = await signUp(data.email, data.password);
    if (error) { setServerError(error.message); return; }
    onNext(data, authData?.user?.id ?? "");
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">Create your rider account</h2>
      <p className="mt-1 text-sm text-muted-foreground">Start by setting up your login credentials.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <Input type="password" placeholder="Min. 8 characters" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Confirm password</Label>
          <Input type="password" placeholder="Repeat password" {...register("confirm")} />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>
        {serverError && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{serverError}</p>
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>
    </div>
  );
}

// ── Stage 2: Identity & Card ─────────────────────────────────────────────────
function Stage2({ onNext, onBack }: { onNext: (data: IdentityData) => void; onBack: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<IdentityData>({
    resolver: zodResolver(identitySchema),
  });

  const formatCard = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 16);
    e.target.value = val.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    e.target.value = val.length >= 3 ? `${val.slice(0, 2)}/${val.slice(2)}` : val;
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">Identity & Payment</h2>
      <p className="mt-1 text-sm text-muted-foreground">We need to verify your identity and collect your payment method for rides.</p>

      <form onSubmit={handleSubmit(onNext)} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input placeholder="Jane" {...register("firstName")} />
            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input placeholder="Doe" {...register("lastName")} />
            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Date of birth</Label>
          <Input type="date" {...register("dob")} />
          {errors.dob && <p className="text-xs text-destructive">{errors.dob.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Phone number</Label>
          <Input type="tel" placeholder="(555) 000-0000" {...register("phone")} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" /> Payment method
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Card number</Label>
              <Input placeholder="1234 5678 9012 3456" onChange={formatCard} {...register("cardNumber")} />
              {errors.cardNumber && <p className="text-xs text-destructive">{errors.cardNumber.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Expiry</Label>
                <Input placeholder="MM/YY" onChange={formatExpiry} {...register("cardExpiry")} />
                {errors.cardExpiry && <p className="text-xs text-destructive">{errors.cardExpiry.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>CVC</Label>
                <Input placeholder="•••" maxLength={4} {...register("cardCvc")} />
                {errors.cardCvc && <p className="text-xs text-destructive">{errors.cardCvc.message}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button type="submit" className="flex-1 gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Stage 3: Background Check + Payment ──────────────────────────────────────
function Stage3({ userId, email, identityData, onComplete, onBack }: {
  userId: string;
  email: string;
  identityData: IdentityData;
  onComplete: () => void;
  onBack: () => void;
}) {
  const [disclosed, setDisclosed] = useState<"none" | "yes" | "no">("none");
  const [scrolled, setScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "processing" | "approved" | "denied">("idle");

  const canProceed = disclosed !== "none" && scrolled && agreed;

  const runCheck = async () => {
    setStatus("paying");
    await new Promise((r) => setTimeout(r, 1500));
    setStatus("processing");
    await new Promise((r) => setTimeout(r, 3000));

    // Mock: deny if criminal record disclosed, else approve
    const result = disclosed === "yes" ? "denied" : "approved";
    setStatus(result);

    if (result === "approved") {
      // Save rider profile to Supabase
      await supabase.from("riders").upsert({
        id: userId,
        email,
        first_name: identityData.firstName,
        last_name: identityData.lastName,
        phone: identityData.phone,
        bg_status: "cleared",
        consent_signed: true,
        consent_signed_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      });
      setTimeout(onComplete, 1500);
    }
  };

  if (status === "paying") {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 font-medium">Processing payment of $9.99…</p>
        <p className="mt-1 text-sm text-muted-foreground">Connecting to Checkr background check</p>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-primary" />
          </span>
        </div>
        <p className="mt-4 font-medium">Running background check…</p>
        <p className="mt-1 text-sm text-muted-foreground">Powered by Checkr · This takes just a moment</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold">Application Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Based on the information provided, we're unable to approve your rider account at this time.
        </p>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold">Background Check Cleared!</h2>
        <p className="mt-2 text-sm text-muted-foreground">Setting up your account…</p>
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">Background Check</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A basic background check is required for all riders. Powered by Checkr. Fee: <strong>$9.99</strong>
      </p>

      <div className="mt-5 space-y-4">
        {/* Criminal disclosure */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Criminal Record Disclosure</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Have you been convicted of a felony or misdemeanor in the past 7 years?
          </p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => setDisclosed("no")}
              className={cn(
                "flex-1 rounded-xl border py-2.5 text-sm font-medium transition",
                disclosed === "no" ? "border-success/40 bg-success/10 text-success" : "border-border bg-card hover:bg-secondary"
              )}
            >
              No
            </button>
            <button
              onClick={() => setDisclosed("yes")}
              className={cn(
                "flex-1 rounded-xl border py-2.5 text-sm font-medium transition",
                disclosed === "yes" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-card hover:bg-secondary"
              )}
            >
              Yes
            </button>
          </div>
        </div>

        {/* Terms scroll */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Terms & Waiver</p>
          <div
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setScrolled(true);
            }}
            className="h-40 overflow-y-auto rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground"
          >
            <p><strong className="text-foreground">1. Background Check Consent.</strong> You authorize SOLO.drive and its partner Checkr to perform a consumer background report including identity verification and criminal records search.</p>
            <p className="mt-2"><strong className="text-foreground">2. Payment.</strong> A non-refundable fee of $9.99 will be charged to your payment method to cover the cost of the background check.</p>
            <p className="mt-2"><strong className="text-foreground">3. Rider Conduct.</strong> You agree to treat operators with respect and comply with all applicable laws during trips.</p>
            <p className="mt-2"><strong className="text-foreground">4. Independent Operators.</strong> SOLO.drive connects you with self-employed operators. We are a software platform and not the carrier of record.</p>
            <p className="mt-2"><strong className="text-foreground">5. Acceptance.</strong> Checking the box below constitutes your electronic signature and acceptance of these terms.</p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <CheckCircle2 className={cn("h-4 w-4", scrolled ? "text-success" : "text-muted-foreground/40")} />
            <span className={scrolled ? "text-success" : "text-muted-foreground"}>
              {scrolled ? "Read in full." : "Scroll to the end to continue."}
            </span>
          </div>
        </div>

        {/* Agree checkbox */}
        <label className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
          agreed ? "border-primary/40 bg-primary/5" : "border-border"
        )}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={!scrolled}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            I agree to the terms above and authorize the $9.99 background check fee to be charged to my card.
          </span>
        </label>

        {/* Payment notice */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-success" />
          $9.99 will be charged · Powered by Checkr · Results in seconds
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            onClick={runCheck}
            disabled={!canProceed}
            className="flex-1 gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-40"
          >
            Pay $9.99 & Run Check <ShieldCheck className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
