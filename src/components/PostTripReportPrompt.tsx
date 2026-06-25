import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSubmitTripReport,
  useMarkTripFeedbackGiven,
  MISCONDUCT_CATEGORIES,
  type MisconductCategory,
} from "@/hooks/useTripReport";

/**
 * Shown to both Rider and Operator once a trip reaches "completed." Dismissing
 * (the X, or "Everything was good") just records that feedback was given so
 * this doesn't reappear. Reporting an issue requires picking a severity —
 * "Abuse / violence / safety threat" is the only path that auto-suspends the
 * other party, and that's disclosed before submitting, not after.
 */
export function PostTripReportPrompt({
  tripRequestId,
  role,
  onDone,
}: {
  tripRequestId: string;
  role: "rider" | "operator";
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"prompt" | "reporting">("prompt");
  const [severity, setSeverity] = useState<"general" | "egregious">("general");
  const [category, setCategory] = useState<MisconductCategory | "">("");
  const [description, setDescription] = useState("");

  const markGiven = useMarkTripFeedbackGiven();
  const submitReport = useSubmitTripReport();

  const otherParty = role === "rider" ? "driver" : "rider";

  const handleAllGood = () => {
    markGiven.mutate({ tripRequestId, role }, { onSuccess: onDone });
  };

  const handleSubmit = () => {
    if (!description.trim()) return;
    if (severity === "egregious" && !category) return;
    submitReport.mutate(
      {
        tripRequestId,
        reporterRole: role,
        severity,
        category: severity === "egregious" ? (category as MisconductCategory) : undefined,
        description: description.trim(),
      },
      { onSuccess: onDone },
    );
  };

  const busy = markGiven.isPending || submitReport.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-elevated">
        <button
          onClick={handleAllGood}
          disabled={busy}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trip complete</div>
        <h2 className="mt-1 font-display text-2xl font-semibold">How was your {role === "rider" ? "ride" : "trip"}?</h2>

        {mode === "prompt" ? (
          <div className="mt-5 space-y-3">
            <button
              onClick={handleAllGood}
              disabled={busy}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {markGiven.isPending ? "Saving…" : "Everything was good"}
            </button>
            <button
              onClick={() => setMode("reporting")}
              disabled={busy}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-50"
            >
              Report an issue with the {otherParty}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setSeverity("general")}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-xs",
                  severity === "general" ? "border-primary/40 bg-primary/10 text-primary-glow" : "border-border bg-surface text-muted-foreground",
                )}
              >
                General complaint
              </button>
              <button
                onClick={() => setSeverity("egregious")}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-xs",
                  severity === "egregious" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-surface text-muted-foreground",
                )}
              >
                Abuse / violence / safety threat
              </button>
            </div>

            {severity === "egregious" && (
              <>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MisconductCategory)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>Select a category…</option>
                  {MISCONDUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  This will immediately suspend the {otherParty}&rsquo;s account pending a Compliance investigation.
                </p>
              </>
            )}

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what happened…"
              rows={4}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!description.trim() || (severity === "egregious" && !category) || busy}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
              >
                {submitReport.isPending ? "Submitting…" : "Submit report"}
              </button>
              <button
                onClick={() => setMode("prompt")}
                disabled={busy}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
