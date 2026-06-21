import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type OperatorDocument = {
  id: string;
  operator_id: string;
  document_type: string;
  file_url: string | null;
  verified: boolean;
  created_at: string;
};

export const REQUIRED_DOC_TYPES: { id: string; name: string }[] = [
  { id: "entity", name: "Entity / LLC Information" },
  { id: "license", name: "Driver's License" },
  { id: "insurance", name: "Commercial Auto Insurance" },
  { id: "background", name: "Background Check" },
  { id: "criminal", name: "Criminal Record Disclosure" },
];

export function useDocuments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["documents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("operator_id", user!.id);
      if (error) throw error;
      return (data ?? []) as OperatorDocument[];
    },
  });
}

export function useUpsertDocument() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { document_type: string; file_url?: string; verified?: boolean }) => {
      const { data, error } = await supabase
        .from("documents")
        .upsert(
          { operator_id: user!.id, ...payload },
          { onConflict: "operator_id,document_type" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as OperatorDocument;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", user?.id] }),
  });
}
