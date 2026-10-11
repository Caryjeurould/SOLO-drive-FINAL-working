import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isVisitor } from "@/lib/site-role";
import { demoShift, newDemoShift, setDemoShift } from "@/lib/demo";
import { useAuth } from "@/lib/auth";

export type ShiftServiceType = "rideshare" | "delivery" | "both";

export type OperatorShift = {
  id: string;
  operator_id: string;
  service_type: ShiftServiceType;
  started_at: string;
  ended_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
};

/** Operators' devices are the location source — Mapbox only ever consumes the
 *  resulting lat/lng for routing later, it never senses location itself. */
const LOCATION_PING_INTERVAL_MS = 30_000;

function getCurrentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10_000 },
    );
  });
}

/** The operator's current active (still-online) shift, or null while offline. */
export function useActiveShift() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["operator-shift", "active", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<OperatorShift | null> => {
      if (isVisitor()) return demoShift();
      const { data, error } = await supabase
        .from("operator_shifts")
        .select("*")
        .eq("operator_id", user!.id)
        .is("ended_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as OperatorShift | null;
    },
  });
}

/** Starts a shift: inserts an operator_shifts row with the declared service type
 *  and an initial GPS fix (if the browser grants it). */
export function useGoOnline() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (serviceType: ShiftServiceType) => {
      if (isVisitor()) { const shift = newDemoShift(serviceType); setDemoShift(shift); return shift; }
      const pos = await getCurrentPosition();
      const { data, error } = await supabase
        .from("operator_shifts")
        .insert({
          operator_id: user!.id,
          service_type: serviceType,
          last_lat: pos?.coords.latitude ?? null,
          last_lng: pos?.coords.longitude ?? null,
          last_location_at: pos ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as OperatorShift;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator-shift", "active", user?.id] }),
  });
}

/** Ends the active shift. */
export function useGoOffline() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (shiftId: string) => {
      if (isVisitor()) { setDemoShift(null); return; }
      const { error } = await supabase
        .from("operator_shifts")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", shiftId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator-shift", "active", user?.id] }),
  });
}

/**
 * While `shiftId` is set, refreshes last_lat/last_lng on that shift every 30s
 * (plus immediately on start). Returns whether a GPS fix is currently available,
 * so the UI can tell the operator if location isn't being captured.
 */
export function useLocationPing(shiftId: string | null | undefined): boolean {
  const [locationAvailable, setLocationAvailable] = useState(false);

  useEffect(() => {
    if (!shiftId) {
      setLocationAvailable(false);
      return;
    }

    // Demo: no location is read or sent anywhere.
    if (isVisitor()) {
      setLocationAvailable(true);
      return;
    }

    let cancelled = false;

    const ping = async () => {
      const pos = await getCurrentPosition();
      if (cancelled) return;
      if (!pos) {
        setLocationAvailable(false);
        return;
      }
      setLocationAvailable(true);
      await supabase
        .from("operator_shifts")
        .update({
          last_lat: pos.coords.latitude,
          last_lng: pos.coords.longitude,
          last_location_at: new Date().toISOString(),
        })
        .eq("id", shiftId);
    };

    ping();
    const interval = setInterval(ping, LOCATION_PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shiftId]);

  return locationAvailable;
}
