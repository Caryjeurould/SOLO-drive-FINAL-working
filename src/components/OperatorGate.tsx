import { Link } from "@tanstack/react-router";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { BrandText } from "@/components/BrandText";

export function OperatorGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [state] = useOnboarding();

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[80vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="relative mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center md:px-8">
          <div className="absolute -inset-x-20 top-1/3 -z-10 h-64 bg-gradient-primary opacity-20 blur-3xl" />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface shadow-glow">
            <Lock className="h-7 w-7 text-primary-glow" />
          </div>
          <div className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">Sign in required</div>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            Operator access<br /><span className="text-gradient">requires an account.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
            Sign in or create a SOLO.drive operator account to access the dashboard, accept rides, and manage your business.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-6 py-3.5 text-sm font-medium text-foreground backdrop-blur-xl transition-colors hover:bg-surface"
            >
              Create account
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (state.status === "approved") return <>{children}</>;

  const pct = ((state.stage - 1) / 4) * 100;
  return (
    <AppShell>
      <div className="relative mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center md:px-8">
        <div className="absolute -inset-x-20 top-1/3 -z-10 h-64 bg-gradient-primary opacity-20 blur-3xl" />
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface shadow-glow">
          <Lock className="h-7 w-7 text-primary-glow" />
        </div>
        <div className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">Authorization Required</div>
        <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
          Complete onboarding<br /><span className="text-gradient">before you operate.</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
          <BrandText>The Operator Console is gated behind Smart+Logix™ Authorization. Identity, disclosures, background check, and your business entity must all be approved before you can access your dashboard or accept rides.</BrandText>
        </p>

        <div className="mt-8 w-full max-w-md">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Stage {state.stage} of 4</span>
            <span>{state.status === "in_progress" ? "In progress" : "Not started"}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Link
          to="/download"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
        >
          {state.status === "not_started" ? "Begin authorization" : "Resume onboarding"} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AppShell>
  );
}
