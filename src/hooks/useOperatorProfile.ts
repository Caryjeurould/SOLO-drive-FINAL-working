import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isVisitor } from "@/lib/site-role";
import { demoProfile, updateDemoProfile } from "@/lib/demo";
import { useAuth } from "@/lib/auth";

export type OperatorProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vin: string | null;
  status: string;
  hours_used: number;
  subscription_active: boolean;
  created_at: string;
  /** Set once, the first time all 5 document requirements are simultaneously
   *  verified. Null means this operator has never been fully approved — a
   *  document rejection before this is set never auto-suspends. */
  approved_at: string | null;
};

export function useOperatorProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["operator", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isVisitor()) return demoProfile();
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: created, error: createErr } = await supabase
          .from("operators")
          .insert({
            id: user!.id,
            email: user!.email ?? null,
            status: "active",
            hours_used: 0,
            subscription_active: false,
          })
          .select()
          .single();
        if (createErr) throw createErr;
        return created as OperatorProfile;
      }

      return data as OperatorProfile;
    },
  });
}

export function useUpsertOperator() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Omit<OperatorProfile, "id" | "created_at">>) => {
      if (isVisitor()) { updateDemoProfile(patch); return demoProfile(); }
      const { data, error } = await supabase
        .from("operators")
        .upsert({ id: user!.id, ...patch })
        .select()
        .single();
      if (error) throw error;
      return data as OperatorProfile;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator", user?.id] }),
  });
}
