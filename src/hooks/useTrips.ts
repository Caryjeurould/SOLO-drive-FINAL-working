import { useQuery } from "@tanstack/react-query";
import { startOfWeek, differenceInDays, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type Trip = {
  id: string;
  operator_id: string;
  pickup: string | null;
  dropoff: string | null;
  fare: number | null;
  distance: number | null;
  duration: number | null; // minutes
  created_at: string;
};

export function useWeeklyTrips() {
  const { user } = useAuth();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: ["trips", "week", user?.id, weekStart.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("operator_id", user!.id)
        .gte("created_at", weekStart.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });
}

export function useRecentTrips(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trips", "recent", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("operator_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });
}

/** Returns [Mon, Tue, Wed, Thu, Fri, Sat, Sun] hours from weekly trips */
export function computeDailyHours(trips: Trip[]): number[] {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const daily = [0, 0, 0, 0, 0, 0, 0];
  for (const t of trips) {
    const dayIndex = differenceInDays(parseISO(t.created_at), weekStart);
    if (dayIndex >= 0 && dayIndex < 7) {
      daily[dayIndex] += (t.duration ?? 0) / 60;
    }
  }
  return daily;
}

export function computeWeeklyEarnings(trips: Trip[]) {
  const total = trips.reduce((s, t) => s + (t.fare ?? 0), 0);
  const avg = trips.length > 0 ? total / trips.length : 0;
  return { total, avg, count: trips.length };
}
