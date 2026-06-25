import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  sendOperatorSuspensionEmail,
  sendOperatorReinstatementEmail,
  sendRiderSuspensionEmail,
  sendRiderReinstatementEmail,
  sendComplianceIncidentAlertEmail,
} from "@/lib/email";
import type { OperatorProfile } from "@/hooks/useOperatorProfile";
import type { OperatorDocument, DocumentStatus } from "@/hooks/useDocuments";
import type { Trip } from "@/hooks/useTrips";

export type AdminRole = "super_admin" | "compliance" | "viewer";

export const SUSPENSION_CATEGORIES = [
  "Physical abuse",
  "Sexual abuse",
  "Verbal abuse",
  "Racial discrimination",
  "Non-payment",
  "Legal disclosure not agreed to",
  "Background check not approved",
  "Other",
] as const;

export type SuspensionCategory = (typeof SUSPENSION_CATEGORIES)[number];

/** Categories that also generate a linked safety_incidents row alongside the suspension flag. */
export const ABUSE_SUSPENSION_CATEGORIES = new Set<SuspensionCategory>([
  "Physical abuse",
  "Sexual abuse",
  "Verbal abuse",
  "Racial discrimination",
]);

/**
 * Egregious misconduct categories for the post-trip report flow. Matches the
 * safety_incidents_type_check constraint exactly — selecting one of these
 * automatically suspends the accused party via the DB trigger the instant the
 * report is submitted. "General complaint" is the non-egregious counterpart —
 * it's reviewable by Admin but never auto-suspends.
 */
export const MISCONDUCT_CATEGORIES = [
  "Physical abuse",
  "Sexual abuse",
  "Verbal abuse",
  "Racial discrimination",
  "Inappropriate touching",
] as const;

export type MisconductCategory = (typeof MISCONDUCT_CATEGORIES)[number];

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
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  phone: string | null;
  bg_status: string | null;
  consent_signed: boolean | null;
  consent_signed_at: string | null;
  approved_at: string | null;
  /** active | suspended | terminated — terminated is permanent and manual-only. */
  status: string;
  created_at: string;
};

export type SafetyIncident = {
  id: string;
  type: string;
  severity: string | null;
  operator_id: string | null;
  rider_id: string | null;
  trip_id: string | null;
  /** Which of operator_id/rider_id is the accused party (not the reporter). */
  reported_party: "operator" | "rider" | null;
  reported_by_id: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
};

export type AdminFlag = {
  id: string;
  type: string;
  user_id: string | null;
  category: string | null;
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
  /** admin_flags rows of type "suspension" for this rider — same convention as operators. */
  suspensions: AdminFlag[];
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
        { data: flags, error: flagErr },
      ] = await Promise.all([
        supabase.from("riders").select("*").order("created_at", { ascending: false }),
        supabase.from("safety_incidents").select("*"),
        supabase.from("admin_flags").select("*").eq("type", "suspension"),
      ]);
      if (riderErr) throw riderErr;
      if (incErr) throw incErr;
      if (flagErr) throw flagErr;

      return (riders ?? []).map((r) => ({
        ...(r as Rider),
        incidents: (incidents ?? []).filter((i) => i.rider_id === r.id) as SafetyIncident[],
        suspensions: (flags ?? []).filter((f) => f.user_id === r.id) as AdminFlag[],
      }));
    },
  });
}

/**
 * Every safety_incidents row, both directions (Operator-accused and
 * Rider-accused) — the actual "regular Admin review" surface for reports that
 * didn't meet the auto-suspend threshold, plus a record of every one that did.
 * RLS restricts this to active compliance/super_admin staff via is_admin().
 */
export function useAllSafetyIncidents(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "safety-incidents"],
    enabled,
    queryFn: async (): Promise<SafetyIncident[]> => {
      const { data, error } = await supabase
        .from("safety_incidents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SafetyIncident[];
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

/**
 * Suspends a rider: records the flag (with category), flips riders.status to
 * "suspended", and emails the rider the category + reason + reinstatement steps.
 * For abuse-related categories, also creates a linked safety_incidents row so the
 * incident is tracked there alongside the suspension flag. Blocked by RLS unless
 * caller has the "compliance" role.
 */
export function useIssueRiderSuspension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      riderId: string;
      riderEmail: string | null;
      riderName: string | null;
      category: SuspensionCategory;
      description: string;
    }) => {
      const { data: flag, error: flagError } = await supabase
        .from("admin_flags")
        .insert({
          type: "suspension",
          user_id: payload.riderId,
          category: payload.category,
          description: payload.description,
          status: "open",
        })
        .select()
        .single();
      if (flagError) throw flagError;

      if (ABUSE_SUSPENSION_CATEGORIES.has(payload.category)) {
        const { error: incidentError } = await supabase.from("safety_incidents").insert({
          type: payload.category,
          severity: "high",
          rider_id: payload.riderId,
          description: payload.description,
          status: "open",
          related_flag_id: flag.id,
        });
        if (incidentError) throw incidentError;
      }

      const { error: statusError } = await supabase
        .from("riders")
        .update({ status: "suspended" })
        .eq("id", payload.riderId);
      if (statusError) throw statusError;

      if (!payload.riderEmail) return { emailSent: false };

      try {
        await sendRiderSuspensionEmail({
          data: {
            to: payload.riderEmail,
            riderName: payload.riderName ?? "there",
            category: payload.category,
            reason: payload.description,
          },
        });
        return { emailSent: true };
      } catch (err) {
        console.error("Failed to send rider suspension email", err);
        return { emailSent: false };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "riders"] }),
  });
}

/**
 * Reinstates a suspended rider: flips riders.status back to "active", resolves
 * any open suspension flags, and emails a confirmation. Mirrors useReinstateOperator
 * exactly. Blocked by RLS unless caller has the "compliance" role.
 */
export function useReinstateRider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { riderId: string; riderEmail: string | null; riderName: string | null }) => {
      const { error: statusError } = await supabase
        .from("riders")
        .update({ status: "active" })
        .eq("id", payload.riderId);
      if (statusError) throw statusError;

      const { error: flagError } = await supabase
        .from("admin_flags")
        .update({ status: "resolved" })
        .eq("user_id", payload.riderId)
        .eq("type", "suspension")
        .eq("status", "open");
      if (flagError) throw flagError;

      if (!payload.riderEmail) return { emailSent: false };

      try {
        await sendRiderReinstatementEmail({
          data: { to: payload.riderEmail, riderName: payload.riderName ?? "there" },
        });
        return { emailSent: true };
      } catch (err) {
        console.error("Failed to send rider reinstatement email", err);
        return { emailSent: false };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "riders"] }),
  });
}

/**
 * Sets a document's review status. Blocked by RLS unless caller has the
 * "compliance" role. Setting "rejected" on a previously-approved operator's
 * document fires the auto-suspend DB trigger immediately — there's no
 * additional client-side step needed for that to happen.
 */
export function useAdminSetDocumentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { documentId: string; status: DocumentStatus }) => {
      const { error } = await supabase
        .from("documents")
        .update({ status: payload.status })
        .eq("id", payload.documentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "operators"] }),
  });
}

/**
 * Permanently terminates an Operator. Manual-only, requires a documented
 * justification, never reachable from any automatic path. No reinstate exists
 * from this state — it's intentionally a dead end.
 */
export function useTerminateOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { operatorId: string; justification: string }) => {
      const { error: statusError } = await supabase
        .from("operators")
        .update({ status: "terminated" })
        .eq("id", payload.operatorId);
      if (statusError) throw statusError;

      const { error: flagError } = await supabase.from("admin_flags").insert({
        type: "termination",
        user_id: payload.operatorId,
        description: payload.justification,
        status: "closed",
      });
      if (flagError) throw flagError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "operators"] }),
  });
}

/** Permanently terminates a Rider. Mirrors useTerminateOperator exactly. */
export function useTerminateRider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { riderId: string; justification: string }) => {
      const { error: statusError } = await supabase
        .from("riders")
        .update({ status: "terminated" })
        .eq("id", payload.riderId);
      if (statusError) throw statusError;

      const { error: flagError } = await supabase.from("admin_flags").insert({
        type: "termination",
        user_id: payload.riderId,
        description: payload.justification,
        status: "closed",
      });
      if (flagError) throw flagError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "riders"] }),
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

export type SuspensionAlert = {
  id: string;
  userId: string | null;
  category: string | null;
  description: string | null;
  createdAt: string;
};

/**
 * Live in-app alert the instant a suspension happens, via Supabase Realtime —
 * not just email. Operators losing income while suspended need Compliance to
 * see this immediately, not whenever someone next refreshes the dashboard.
 * Only meaningful for an open session; email remains the durable record.
 */
export function useSuspensionAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<SuspensionAlert[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("admin-suspension-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_flags", filter: "type=eq.suspension" },
        (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string | null;
            category: string | null;
            description: string | null;
            created_at: string;
          };
          setAlerts((prev) => [
            { id: row.id, userId: row.user_id, category: row.category, description: row.description, createdAt: row.created_at },
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
