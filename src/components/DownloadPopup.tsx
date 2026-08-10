import { X, Car, MapPin, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface DownloadPopupProps {
  onClose: () => void;
}

export function DownloadPopup({ onClose }: DownloadPopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card/95 p-8 shadow-elevated backdrop-blur-2xl">

        <button onClick={onClose} className="absolute right-4 top-4 rounded-xl p-2 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-6">
          <div className="font-display text-2xl font-semibold">
            SOLO<span className="text-gradient">.drive</span> Downloads
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Start your SOLO.drive experience</p>
        </div>

        <div className="space-y-3">
          <Link
            to="/download"
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Operate & Own</div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">For Operators — run your logistics business</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>

          <Link
            to="/download"
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-success/40 hover:bg-success/5"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-success shadow-glow">
              <MapPin className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Book & Save</div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">For Customers — transparent pricing, verified owner operators</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-glow hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
