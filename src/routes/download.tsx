import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Car, Download, Share, Plus, Chrome, Smartphone,
  ArrowRight, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [{ title: "Get the App — SOLO.drive" }],
  }),
  component: DownloadPage,
});

function DownloadPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "unknown">("unknown");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    // Capture install prompt for Android/Desktop
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    }
  };

  if (installed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">App installed!</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            SOLO.drive is on your home screen. Open it to complete your setup and book your first ride!
          </p>
          <Link
            to="/customer/login"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow"
          >
            Open the app to sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />
      <div className="relative mx-auto max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Car className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-3xl font-semibold">
              SOLO<span className="text-gradient">.drive</span>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Independent Operator Platform</div>
          </div>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-3xl border border-border bg-card/80 p-8 shadow-elevated backdrop-blur-2xl">
          <h2 className="font-display text-2xl font-semibold text-center">Get the SOLO.drive App</h2>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Install directly from your browser — no App Store needed!
          </p>

          {/* iOS Instructions */}
          {platform === "ios" && (
            <div className="mt-6 space-y-4">
              <p className="text-sm font-medium text-center">Follow these steps on your iPhone:</p>
              <div className="space-y-3">
                <Step n={1} icon={<Share className="h-5 w-5" />} text='Tap the Share button at the bottom of your browser' />
                <Step n={2} icon={<Plus className="h-5 w-5" />} text='Scroll down and tap "Add to Home Screen"' />
                <Step n={3} icon={<Smartphone className="h-5 w-5" />} text='Tap "Add" — SOLO.drive will appear on your home screen!' />
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Open the app from your home screen to complete setup
              </p>
            </div>
          )}

          {/* Android / Desktop Install Button */}
          {(platform === "android" || platform === "desktop") && (
            <div className="mt-6 space-y-4">
              {deferredPrompt ? (
                <button
                  onClick={handleInstall}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-4 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90"
                >
                  <Download className="h-5 w-5" /> Install SOLO.drive App
                </button>
              ) : (
                <div className="space-y-3">
                  <Step n={1} icon={<Chrome className="h-5 w-5" />} text="Open this page in Chrome browser" />
                  <Step n={2} icon={<Download className="h-5 w-5" />} text='Tap the menu (⋮) and select "Add to Home Screen" or "Install App"' />
                  <Step n={3} icon={<Smartphone className="h-5 w-5" />} text="Tap Install — SOLO.drive will appear on your home screen!" />
                </div>
              )}
            </div>
          )}

          {/* What you get */}
          <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">What you get</p>
            <div className="space-y-2">
              {[
                "Book rides & deliveries instantly",
                "Transparent Smart Rate pricing",
                "Verified independent operators",
                "Real-time trip tracking",
                "Zero surge pricing surprises",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/customer/login" className="text-primary-glow hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <span className="text-xs text-muted-foreground">Step {n}</span>
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}
