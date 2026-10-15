import { useQuery } from "@tanstack/react-query";
import { startOfWeek, differenceInDays, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { isVisitor } from "@/lib/site-role";
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
      if (isVisitor()) return [] as Trip[]; // the demo uses DEMO_WEEK / DEMO_JOBS
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
      if (isVisitor()) return [] as Trip[];
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

/** Hour limits: FMCSA weekly cap and the daily cap shown on the day bars. */
export const WEEKLY_HOURS_CAP = 50;
export const DAILY_HOURS_CAP = 10;

/** Returns [Mon, Tue, Wed, Thu, Fri, Sat, Sun] hours from this week's online
 *  sessions (an open session counts up to now). Each session is rounded to
 *  0.1 h, at least 0.1 h, and counts on the day it started; a day never passes
 *  10 h and the week never passes 50 h. Sessions on a day that isn't in
 *  `workDays` (when given) don't count. */
export function computeDailyHoursFromSessions(
  sessions: { started_at: string; ended_at: string | null }[],
  { workDays, now = new Date() }: { workDays?: boolean[]; now?: Date } = {},
): number[] {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const daily = [0, 0, 0, 0, 0, 0, 0];
  let week = 0;
  const sorted = [...sessions].sort((a, b) => a.started_at.localeCompare(b.started_at));
  for (const s of sorted) {
    const start = parseISO(s.started_at);
    const dayIndex = differenceInDays(start, weekStart);
    if (dayIndex < 0 || dayIndex > 6 || (workDays && !workDays[dayIndex])) continue;
    const ms = (s.ended_at ? parseISO(s.ended_at) : now).getTime() - start.getTime();
    const hours = Math.max(0.1, Math.round(ms / 360_000) / 10);
    const add = Math.min(hours, DAILY_HOURS_CAP - daily[dayIndex], WEEKLY_HOURS_CAP - week);
    if (add <= 0) continue;
    daily[dayIndex] = Math.round((daily[dayIndex] + add) * 10) / 10;
    week = Math.round((week + add) * 10) / 10;
  }
  return daily;
}

export function computeWeeklyEarnings(trips: Trip[]) {
  const total = trips.reduce((s, t) => s + (t.fare ?? 0), 0);
  const avg = trips.length > 0 ? total / trips.length : 0;
  return { total, avg, count: trips.length };
}
