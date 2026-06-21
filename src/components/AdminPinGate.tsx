import { useState, useEffect, useRef } from "react";
import { Lock, Delete } from "lucide-react";

interface AdminPinGateProps {
  pin: string;
  children: React.ReactNode;
  label?: string;
}

const SESSION_KEY = "solo-admin-unlocked";

export function AdminPinGate({ pin, children, label = "Admin access" }: AdminPinGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [entry, setEntry] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === pin) setUnlocked(true);
  }, [pin]);

  useEffect(() => {
    if (entry.length === pin.length) {
      if (entry === pin) {
        sessionStorage.setItem(SESSION_KEY, pin);
        setUnlocked(true);
      } else {
        setShake(true);
        setTimeout(() => {
          setEntry("");
          setShake(false);
        }, 500);
      }
    }
  }, [entry, pin]);

  if (unlocked) return <>{children}</>;

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  function press(d: string) {
    if (d === "⌫") {
      setEntry((e) => e.slice(0, -1));
    } else if (entry.length < pin.length) {
      setEntry((e) => e + d);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface shadow-glow">
            <Lock className="h-6 w-6 text-primary-glow" />
          </div>
          <div className="text-center">
            <div className="font-display text-xl font-semibold">{label}</div>
            <div className="mt-1 text-xs text-muted-foreground">Enter your PIN to continue</div>
          </div>

          {/* dots */}
          <div className={`flex gap-3 py-2 transition-transform ${shake ? "animate-[wiggle_0.4s_ease-in-out]" : ""}`}>
            {Array.from({ length: pin.length }).map((_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full border-2 transition-colors ${
                  i < entry.length ? "border-primary bg-primary" : "border-border bg-transparent"
                }`}
              />
            ))}
          </div>

          {/* keypad */}
          <div className="grid grid-cols-3 gap-3 w-full mt-1">
            {digits.map((d, i) => (
              <button
                key={i}
                disabled={!d}
                onClick={() => d && press(d)}
                className={`h-14 rounded-2xl font-display text-xl font-medium transition-all
                  ${!d ? "pointer-events-none" : ""}
                  ${d === "⌫"
                    ? "bg-surface border border-border text-muted-foreground hover:bg-secondary active:scale-95"
                    : d
                    ? "bg-surface border border-border hover:border-primary/40 hover:bg-primary/5 active:scale-95"
                    : ""
                  }`}
              >
                {d === "⌫" ? <Delete className="h-4 w-4 mx-auto" /> : d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes wiggle {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
