import { Link } from "@tanstack/react-router";
import { ArrowRight, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppKind } from "@/lib/pwa";

/** The start screen each installed app opens to (its manifest start_url):
 *  /operator/start → Start onboarding / Sign in;
 *  /customer/start → Create account / Sign in. */
export function AppStartScreen({ kind }: { kind: AppKind }) {
  const operator = kind === "operator";
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />
      <div className="relative mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl shadow-glow", operator ? "bg-gradient-primary" : "bg-success")}>
            <Car className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-3xl font-semibold">
              SOLO<span className="text-gradient">.drive</span> {operator ? "Operator" : "Customer"}
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Independent Operator Platform</div>
          </div>
        </div>

        <div className="mt-8 space-y-3 rounded-3xl border border-border bg-card/80 p-8 shadow-elevated backdrop-blur-2xl">
          <Link
            to={operator ? "/operator/onboarding" : "/customer/signup"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-4 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90"
          >
            {operator ? "Start onboarding" : "Create account"} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to={operator ? "/operator/login" : "/customer/login"}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/60 px-6 py-4 text-sm font-medium text-foreground hover:bg-surface"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
