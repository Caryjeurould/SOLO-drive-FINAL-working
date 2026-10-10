import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Car, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Create account — SOLO.drive" }],
  }),
  component: SignupPage,
});

const schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await signUp(data.email, data.password, "operator");
    if (error) {
      setServerError(error.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-gradient-hero opacity-40" />
        <div className="relative w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/30 bg-success/10 shadow-glow">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">Check your inbox</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We sent a confirmation link to your email. Click it to activate your account,
            then come back to sign in.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            Go to sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Car className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <div className="font-display text-2xl font-semibold tracking-tight">
              SOLO<span className="text-gradient">.drive</span>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Operator Portal
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-elevated backdrop-blur-2xl">
          <h1 className="font-display text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join SOLO.drive as an independent operator
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat password"
                autoComplete="new-password"
                {...register("confirm")}
              />
              {errors.confirm && (
                <p className="text-xs text-destructive">{errors.confirm.message}</p>
              )}
            </div>

            {serverError && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Create account <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary-glow hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
