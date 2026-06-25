import { useRef, useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAFETY_LINE_PHONE_NUMBER, toTelHref } from "@/lib/config";
import { useTriggerPanic } from "@/hooks/usePanic";
import { usePrimarySafetyNumber } from "@/hooks/useSafetyContacts";

const HOLD_DURATION_MS = 3000;

/** No-op on browsers/devices without the Vibration API — never throws. */
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Unsupported or blocked — silently ignore.
  }
}

/**
 * Press-and-hold, not tap — outsourced answering services may bill per call,
 * including false ones, so a pocket bump or stray tap must never place one.
 * Releasing early cancels cleanly: no call, no logged event. The fill bar is
 * driven directly by rAF rather than a CSS transition so it tracks the actual
 * hold progress exactly, with no lag.
 */
export function PanicButton({
  tripRequestId,
  triggeredById,
  triggeredBy,
  pickupAddress,
  dropoffAddress,
  fallbackLat,
  fallbackLng,
  className,
  label = "Panic / Emergency",
}: {
  tripRequestId: string;
  triggeredById: string;
  triggeredBy: "operator" | "rider";
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  fallbackLat?: number | null;
  fallbackLng?: number | null;
  className?: string;
  label?: string;
}) {
  const triggerPanic = useTriggerPanic();
  const { phoneNumber } = usePrimarySafetyNumber();
  const telHref = toTelHref(phoneNumber || SAFETY_LINE_PHONE_NUMBER);

  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const stopHold = () => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    startRef.current = null;
    setHolding(false);
    setProgress(0);
    vibrate(0);
  };

  const fire = () => {
    firedRef.current = true;
    triggerPanic.mutate({
      tripRequestId,
      triggeredById,
      triggeredBy,
      pickupAddress,
      dropoffAddress,
      fallbackLat,
      fallbackLng,
    });
    // location.href, not a real anchor click — the action only happens once
    // the 3s hold completes, well after the initiating pointerdown gesture.
    window.location.href = telHref;
    stopHold();
  };

  const tick = () => {
    if (startRef.current == null) return;
    const elapsed = performance.now() - startRef.current;
    const next = Math.min(1, elapsed / HOLD_DURATION_MS);
    setProgress(next);
    if (next >= 1) {
      fire();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  };

  const startHold = () => {
    if (holding) return;
    firedRef.current = false;
    startRef.current = performance.now();
    setHolding(true);
    vibrate(HOLD_DURATION_MS);
    frameRef.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    if (firedRef.current) return;
    stopHold();
  };

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      vibrate(0);
    },
    [],
  );

  return (
    <button
      type="button"
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          startHold();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") cancelHold();
      }}
      className={cn(
        "relative flex touch-none select-none flex-col items-center gap-1 overflow-hidden rounded-xl border border-destructive/50 bg-destructive/10 py-3 text-xs font-medium text-destructive hover:bg-destructive/20",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-destructive/30"
        style={{ width: `${progress * 100}%` }}
      />
      <ShieldAlert className="relative h-4 w-4" />
      <span className="relative">{holding ? "Keep holding…" : label}</span>
    </button>
  );
}
