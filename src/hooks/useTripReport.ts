import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { sendOperatorSuspensionEmail, sendRiderSuspensionEmail, sendComplianceIncidentAlertEmail } from "@/lib/email";
import { MISCONDUCT_CATEGORIES, type MisconductCategory } from "@/hooks/useAdmin";

export { MISCONDUCT_CATEGORIES };
export type { MisconductCategory };

export type TripReportSeverity = "general" | "egregious";

/**
 * Marks that a party has responded to (or dismissed) the post-trip prompt for a
 * given trip, so it doesn't keep reappearing. Used both for plain dismissal and
 * right before/after a report is filed.
 */
export function useMarkTripFeedbackGiven() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { tripRequestId: string; role: "rider" | "operator" }) => {
      const column = payload.role === "rider" ? "rider_feedback_at" : "operator_feedback_at";
      const { error } = await supabase
        .from("trip_requests")
        .update({ [column]: new Date().toISOString() })
        .eq("id", payload.tripRequestId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-requests"] }),
  });
}

/**
 * Submits a post-trip report. Always creates a safety_incidents row (reviewable
 * by Admin regardless of severity) and marks feedback as given for the reporter.
 * For "egregious" categories, the accused party is auto-suspended by the DB
 * trigger the instant the row is inserted — this mutation then sends the
 * existing suspension email plus a new alert to active Compliance staff, using
 * two narrowly-scoped RPCs since a Rider/Operator can't otherwise read the other
 * party's contact info or the staff roster directly.
 */
export function useSubmitTripReport() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      tripRequestId: string;
      reporterRole: "rider" | "operator";
      severity: TripReportSeverity;
      category?: MisconductCategory;
      description: string;
    }) => {
      const { data: trip, error: tripError } = await supabase
        .from("trip_requests")
        .select("rider_id, matched_operator_id")
        .eq("id", payload.tripRequestId)
        .single();
      if (tripError) throw tripError;

      const reportedParty: "operator" | "rider" = payload.reporterRole === "rider" ? "operator" : "rider";
      const type = payload.severity === "egregious" ? payload.category! : "General complaint";

      const { error: incidentError } = await supabase.from("safety_incidents").insert({
        type,
        severity: payload.severity === "egregious" ? "high" : "low",
        operator_id: trip.matched_operator_id,
        rider_id: trip.rider_id,
        trip_id: payload.tripRequestId,
        reported_party: reportedParty,
        reported_by_id: user!.id,
        description: payload.description,
        status: "open",
      });
      if (incidentError) throw incidentError;

      const feedbackColumn = payload.reporterRole === "rider" ? "rider_feedback_at" : "operator_feedback_at";
      const { error: feedbackError } = await supabase
        .from("trip_requests")
        .update({ [feedbackColumn]: new Date().toISOString() })
        .eq("id", payload.tripRequestId);
      if (feedbackError) throw feedbackError;

      if (payload.severity !== "egregious") return { emailSent: true };

      let emailSent = true;
      try {
        const { data: contact } = await supabase.rpc("get_trip_party_contact", {
          p_trip_request_id: payload.tripRequestId,
          p_party: reportedParty,
        });
        const target = contact?.[0];
        if (target?.email) {
          if (reportedParty === "operator") {
            await sendOperatorSuspensionEmail({
              data: { to: target.email, operatorName: target.name ?? "there", reason: payload.description, category: payload.category },
            });
          } else {
            await sendRiderSuspensionEmail({
              data: { to: target.email, riderName: target.name ?? "there", category: payload.category!, reason: payload.description },
            });
          }
        } else {
          emailSent = false;
        }
      } catch (err) {
        console.error("Failed to send suspension email after trip report", err);
        emailSent = false;
      }

      try {
        const { data: staff } = await supabase.rpc("get_active_compliance_staff");
        await Promise.all(
          (staff ?? []).map((s: { email: string; name: string | null }) =>
            sendComplianceIncidentAlertEmail({
              data: {
                to: s.email,
                staffName: s.name ?? "there",
                reportedParty,
                category: payload.category!,
                description: payload.description,
              },
            }).catch((err) => console.error("Failed to notify compliance staff", s.email, err)),
          ),
        );
      } catch (err) {
        console.error("Failed to notify compliance staff of new report", err);
      }

      return { emailSent };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-requests"] }),
  });
}
