import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { sendOperatorSuspensionEmail, sendOperatorReinstatementEmail } from "@/lib/email.server";
import type { OperatorProfile } from "@/hooks/useOperatorProfile";
import type { OperatorDocument } from "@/hooks/useDocuments";
import type { Trip } from "@/hooks/useTrips";

export type AdminRole = "super_admin" | "compliance" | "viewer";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  active: boolean;
  created_at: string;
};

export type Rider = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  phone: string | null;
  bg_status: string | null;
  consent_signed: boolean | null;
  approved_at: string | null;
  created_at: string;
};

export type SafetyIncident = {
  id: string;
  type: string;
  severity: string | null;
  operator_id: string | null;
  rider_id: string | null;
  trip_id: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
};

export type AdminFlag = {
  id: string;
  type: string;
  user_id: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  description: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AdminOperatorRow = OperatorProfile & {
  documents: OperatorDocument[];
  trips: Trip[];
  /** admin_flags rows of type "suspension" for this operator — convention only, no DB enum backs it yet */
  suspensions: AdminFlag[];
};

export type AdminRiderRow = Rider & {
  incidents: SafetyIncident[];
};

/** Checks admin_users for the signed-in user. Returns null while signed out or not an admin. */
export function useIsAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-users", "self", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, email, name, role, active")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as AdminUser | null;
    },
  });
}

export function hasRole(admin: AdminUser | null | undefined, required: AdminRole): boolean {
  if (!admin || !admin.active) return false;
  return admin.role === required || admin.role === "super_admin";
}

/**
 * Fires a row-less audit event (page view, expanding a record, sign-in) via the
 * log_admin_event RPC. The DB resolves actor identity from auth.uid() itself — the
 * client only supplies what happened, never who did it.
 */
export function useLogAdminEvent() {
  return useMutation({
    mutationFn: async (payload: {
      action: string;
      targetTable?: string;
      targetId?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { error } = await supabase.rpc("log_admin_event", {
        p_action: payload.action,
        p_target_table: payload.targetTable ?? null,
        p_target_id: payload.targetId ?? null,
        p_description: payload.description ?? null,
        p_metadata: payload.metadata ?? null,
      });
      if (error) throw error;
    },
  });
}

export function useAdminOperators(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "operators"],
    enabled,
    queryFn: async (): Promise<AdminOperatorRow[]> => {
      const [
        { data: operators, error: opErr },
        { data: documents, error: docErr },
        { data: trips, error: tripErr },
        { data: flags, error: flagErr },
      ] = await Promise.all([
        supabase.from("operators").select("*").order("created_at", { ascending: false }),
        supabase.from("documents").select("*"),
        supabase.from("trips").select("*"),
        supabase.from("admin_flags").select("*").eq("type", "suspension"),
      ]);
      if (opErr) throw opErr;
      if (docErr) throw docErr;
      if (tripErr) throw tripErr;
      if (flagErr) throw flagErr;

      return (operators ?? []).map((op) => ({
        ...(op as OperatorProfile),
        documents: (documents ?? []).filter((d) => d.operator_id === op.id) as OperatorDocument[],
        trips: (trips ?? []).filter((t) => t.operator_id === op.id) as Trip[],
        suspensions: (flags ?? []).filter((f) => f.user_id === op.id) as AdminFlag[],
      }));
    },
  });
}

export function useAdminRiders(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "riders"],
    enabled,
    queryFn: async (): Promise<AdminRiderRow[]> => {
      const [
        { data: riders, error: riderErr },
        { data: incidents, error: incErr },
      ] = await Promise.all([
        supabase.from("riders").select("*").order("created_at", { ascending: false }),
        supabase.from("safety_incidents").select("*"),
      ]);
      if (riderErr) throw riderErr;
      if (incErr) throw incErr;

      return (riders ?? []).map((r) => ({
        ...(r as Rider),
        incidents: (incidents ?? []).filter((i) => i.rider_id === r.id) as SafetyIncident[],
      }));
    },
  });
}

/**
 * Suspends an operator: records the flag, flips operators.status to "suspended",
 * and emails the operator the reason + reinstatement steps. Blocked by RLS unless
 * caller has the "compliance" role. The email send is best-effort — a delivery
 * failure doesn't roll back the suspension, but is surfaced via emailSent so the
 * UI can warn the staffer.
 */
export function useIssueSuspension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      operatorId: string;
      operatorEmail: string | null;
      operatorName: string | null;
      description: string;
    }) => {
      const { error: flagError } = await supabase.from("admin_flags").insert({
        type: "suspension",
        user_id: payload.operatorId,
        description: payload.description,
        status: "open",
      });
      if (flagError) throw flagError;

      const { error: statusError } = await supabase
        .from("operators")
        .update({ status: "suspended" })
        .eq("id", payload.operatorId);
      if (statusError) throw statusError;

      if (!payload.operatorEmail) return { emailSent: false };

      try {
        await sendOperatorSuspensionEmail({
          data: {
            to: payload.operatorEmail,
            operatorName: payload.operatorName ?? "there",
            reason: payload.description,
          },
        });
        return { emailSent: true };
      } catch (err) {
        console.error("Failed to send suspension email", err);
        return { emailSent: false };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "operators"] }),
  });
}

/**
 * Reinstates a suspended operator: flips operators.status back to "active",
 * resolves any open suspension flags, and emails a confirmation. Blocked by RLS
 * unless caller has the "compliance" role.
 */
export function useReinstateOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { operatorId: string; operatorEmail: string | null; operatorName: string | null }) => {
      const { error: statusError } = await supabase
        .from("operators")
        .update({ status: "active" })
        .eq("id", payload.operatorId);
      if (statusError) throw statusError;

      const { error: flagError } = await supabase
        .from("admin_flags")
        .update({ status: "resolved" })
        .eq("user_id", payload.operatorId)
        .eq("type", "suspension")
        .eq("status", "open");
      if (flagError) throw flagError;

      if (!payload.operatorEmail) return { emailSent: false };

      try {
        await sendOperatorReinstatementEmail({
          data: { to: payload.operatorEmail, operatorName: payload.operatorName ?? "there" },
        });
        return { emailSent: true };
      } catch (err) {
        console.error("Failed to send reinstatement email", err);
        return { emailSent: false };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "operators"] }),
  });
}

/** Verify/reject an operator's uploaded document. Blocked by RLS unless caller has the "compliance" role. */
export function useAdminVerifyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { documentId: string; verified: boolean }) => {
      const { error } = await supabase
        .from("documents")
        .update({ verified: payload.verified })
        .eq("id", payload.documentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "operators"] }),
  });
}

/** Full staff roster — RLS only returns every row to a super_admin, otherwise just the caller's own row. */
export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "staff"],
    enabled,
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, email, name, role, active, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

/** Update an existing staff member's role/active flag. Blocked by RLS unless caller is a super_admin. */
export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; role?: AdminRole; active?: boolean }) => {
      const patch: Partial<Pick<AdminUser, "role" | "active">> = {};
      if (payload.role) patch.role = payload.role;
      if (payload.active !== undefined) patch.active = payload.active;
      const { error } = await supabase.from("admin_users").update(patch).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] }),
  });
}

/**
 * Audit log entries, optionally scoped to one staff member's full history.
 * RLS restricts this to super_admins only. When filtering by actor we raise the
 * limit so "full activity history" isn't quietly truncated by the all-staff cap.
 */
export function useAuditLog(enabled: boolean, options: { actorId?: string; limit?: number } = {}) {
  const { actorId, limit = actorId ? 1000 : 200 } = options;

  return useQuery({
    queryKey: ["admin", "audit-log", actorId ?? "all", limit],
    enabled,
    queryFn: async (): Promise<AuditLogEntry[]> => {
      let query = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
      if (actorId) query = query.eq("actor_id", actorId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AuditLogEntry[];
    },
  });
}
