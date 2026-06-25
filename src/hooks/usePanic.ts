import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** One-shot, best-effort GPS read at the moment of the panic press — not a
 *  recurring ping. Resolves null on denial/timeout rather than rejecting, since
 *  a missing location must never block the call or the log from going through. */
function captureCurrentPosition(timeoutMs = 4000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10_000 },
    );
  });
}

/**
 * Logs a panic event and attaches whatever location context is available.
 * Deliberately fire-and-forget from the caller's perspective — the tap-to-call
 * link should never wait on this. Falls back to a known last-ping location
 * (e.g. an Operator's shift) if a fresh GPS read fails.
 */
export function useTriggerPanic() {
  return useMutation({
    mutationFn: async (payload: {
      tripRequestId: string;
      triggeredById: string;
      triggeredBy: "operator" | "rider";
      pickupAddress?: string | null;
      dropoffAddress?: string | null;
      fallbackLat?: number | null;
      fallbackLng?: number | null;
    }) => {
      const fresh = await captureCurrentPosition();
      const lat = fresh?.lat ?? payload.fallbackLat ?? null;
      const lng = fresh?.lng ?? payload.fallbackLng ?? null;

      const { error } = await supabase.from("panic_events").insert({
        trip_request_id: payload.tripRequestId,
        triggered_by: payload.triggeredBy,
        triggered_by_id: payload.triggeredById,
        pickup_address: payload.pickupAddress ?? null,
        dropoff_address: payload.dropoffAddress ?? null,
        lat,
        lng,
        location_captured_at: lat != null && lng != null ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
  });
}

export type PanicAlert = {
  id: string;
  tripRequestId: string | null;
  triggeredBy: "operator" | "rider";
  pickupAddress: string | null;
  dropoffAddress: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
};

/**
 * Live in-app alert the instant a panic button is pressed, via Supabase
 * Realtime — same mechanism as useSuspensionAlerts, kept as its own channel and
 * banner so a real emergency is never buried among routine suspension alerts.
 */
export function usePanicAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<PanicAlert[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("admin-panic-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "panic_events" },
        (payload) => {
          const row = payload.new as {
            id: string;
            trip_request_id: string | null;
            triggered_by: "operator" | "rider";
            pickup_address: string | null;
            dropoff_address: string | null;
            lat: number | null;
            lng: number | null;
            created_at: string;
          };
          setAlerts((prev) => [
            {
              id: row.id,
              tripRequestId: row.trip_request_id,
              triggeredBy: row.triggered_by,
              pickupAddress: row.pickup_address,
              dropoffAddress: row.dropoff_address,
              lat: row.lat,
              lng: row.lng,
              createdAt: row.created_at,
            },
            ...prev,
          ].slice(0, 20));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return {
    alerts,
    dismiss: (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id)),
    dismissAll: () => setAlerts([]),
  };
}
