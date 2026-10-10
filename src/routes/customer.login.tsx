import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Car, ArrowRight, Loader2 } from "lucide-react";
import { useAuth, getAccountType, takeAuthMessage, WRONG_APP_MESSAGE } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getInstalledAppKind } from "@/lib/pwa";

export const Route = createFileRoute("/customer/login")({
  head: () => ({
    meta: [{ title: "Customer Sign In — SOLO.drive" }],
  }),
  component: CustomerLoginPage,
});

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

function CustomerLoginPage() {
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  // "Create one": Customer signup inside the installed Customer app, the
  // Customer install page in a browser tab (decided after first render).
  const [inCustomerApp, setInCustomerApp] = useState(false);
  useEffect(() => setInCustomerApp(getInstalledAppKind() === "customer"), []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // A wrong-type session signed out elsewhere (AccountTypeGuard) explains why here.
  useEffect(() => {
    const m = takeAuthMessage();
    if (m) setServerError(m);
  }, []);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await signIn(data.email, data.password);
    if (error) { setServerError(error.message); return; }
    // The Customer app signs in Customer accounts only.
    if ((await getAccountType()) !== "customer") {
      await signOut();
      setServerError(WRONG_APP_MESSAGE);
      return;
    }
    navigate({ to: "/customer/dashboard" });
  };

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
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Customer Portal</div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-elevated backdrop-blur-2xl">
          <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your customer account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" autoComplete="current-password" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {serverError && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{serverError}</p>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link to={inCustomerApp ? "/customer/signup" : "/customer/download"} className="text-primary-glow hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
