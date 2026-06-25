import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type SafetyContactKey = "primary_safety" | "secondary_safety" | "compliance";

export type SafetyContactNumber = {
  id: string;
  key: SafetyContactKey;
  label: string;
  phone_number: string | null;
  updated_at: string;
};

/** Readable by any signed-in user — the Panic Button needs this to place a call. */
export function useSafetyContactNumbers() {
  return useQuery({
    queryKey: ["safety-contact-numbers"],
    queryFn: async (): Promise<SafetyContactNumber[]> => {
      const { data, error } = await supabase
        .from("safety_contact_numbers")
        .select("id, key, label, phone_number, updated_at")
        .order("key");
      if (error) throw error;
      return (data ?? []) as SafetyContactNumber[];
    },
  });
}

/** Convenience accessor for the one number the Panic Button actually calls. */
export function usePrimarySafetyNumber() {
  const { data, ...rest } = useSafetyContactNumbers();
  return { ...rest, phoneNumber: data?.find((c) => c.key === "primary_safety")?.phone_number ?? null };
}

/** Updates a single contact number's label/phone. Blocked by RLS unless the caller has the "compliance" role. */
export function useUpdateSafetyContactNumber() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; label: string; phone_number: string }) => {
      const { error } = await supabase
        .from("safety_contact_numbers")
        .update({
          label: payload.label,
          phone_number: payload.phone_number,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["safety-contact-numbers"] }),
  });
}
