import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isVisitor } from "@/lib/site-role";
import { demoDocuments, setDemoDocument } from "@/lib/demo";
import { useAuth } from "@/lib/auth";

export type DocumentStatus = "pending" | "verified" | "rejected" | "expired";

export type OperatorDocument = {
  id: string;
  operator_id: string;
  document_type: string;
  /** A Storage object path ("<operator uid>/<doc type>.<ext>"), NOT a ready-to-use
   *  URL — the "documents" bucket is private, so viewing a file requires generating
   *  a fresh signed URL (supabase.storage.from("documents").createSignedUrl(...))
   *  at view time. Column name is legacy; nothing renders this value directly today. */
  file_url: string | null;
  status: DocumentStatus;
  /** Generated column (status === 'verified') — read-only, kept for convenience. */
  verified: boolean;
  /** Entered by the Operator at upload for license/insurance/professional_insurance,
   *  matching what's printed on the document. System-computed (verified_at + 12mo)
   *  for background/entity. Always null for criminal — no expiration concept. */
  expiration_date: string | null;
  created_at: string;
};

/** Document types the Operator enters a real printed expiration date for at upload. */
export const EXPIRING_DOC_TYPES = new Set(["license_front", "license_back", "insurance", "professional_insurance"]);

export const REQUIRED_DOC_TYPES: { id: string; name: string }[] = [
  { id: "entity", name: "Entity / LLC Information" },
  { id: "license_front", name: "Driver's License (Front)" },
  { id: "license_back", name: "Driver's License (Back)" },
  { id: "insurance", name: "Commercial Auto Insurance" },
  { id: "professional_insurance", name: "Professional Insurance" },
  { id: "background", name: "Background Check" },
  { id: "criminal", name: "Criminal Record Disclosure" },
];

/**
 * The 5 onboarding document requirements shown as "X/5 verified." License
 * front/back are two physically separate uploads (see REQUIRED_DOC_TYPES) but
 * count as a single requirement here — it isn't satisfied until both sides
 * are verified. Insurance is the same pattern: one requirement covering both
 * the Professional and Commercial Auto policies.
 */
export const DOCUMENT_REQUIREMENTS: { id: string; name: string; docTypeIds: string[] }[] = [
  { id: "entity", name: "Entity / LLC Information", docTypeIds: ["entity"] },
  { id: "license", name: "Driver's License", docTypeIds: ["license_front", "license_back"] },
  { id: "insurance", name: "Insurance - Professional & Commercial Auto", docTypeIds: ["insurance", "professional_insurance"] },
  { id: "background", name: "Background Check", docTypeIds: ["background"] },
  { id: "criminal", name: "Criminal Record Disclosure", docTypeIds: ["criminal"] },
];

export function useDocuments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["documents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isVisitor()) return demoDocuments();
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
    mutationFn: async (payload: { document_type: string; file_url?: string; status?: DocumentStatus; expiration_date?: string | null }) => {
      if (isVisitor()) {
        setDemoDocument(payload.document_type, payload.expiration_date);
        return demoDocuments().find((d) => d.document_type === payload.document_type)!;
      }
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

/** Uploads a file to Storage and upserts the matching documents row — the same
 *  pattern the Document Vault uses, shared so onboarding can submit real
 *  documents instead of just capturing a filename string. */
export function useUploadDocument() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentType,
      file,
      expirationDate,
    }: { documentType: string; file: File; expirationDate?: string | null }) => {
      if (isVisitor()) {
        setDemoDocument(documentType, expirationDate);
        return demoDocuments().find((d) => d.document_type === documentType)!;
      }
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/${documentType}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      // The bucket is private — store the path, not a public URL (getPublicUrl()
      // would return a URL that 403s). Generate a signed URL on demand when viewing.
      const { data, error } = await supabase
        .from("documents")
        .upsert(
          {
            operator_id: user!.id,
            document_type: documentType,
            file_url: path,
            status: "pending",
            expiration_date: expirationDate ?? null,
          },
          { onConflict: "operator_id,document_type" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as OperatorDocument;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", user?.id] }),
  });
}
