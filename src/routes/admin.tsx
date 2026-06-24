import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import {
  useIsAdmin,
  useAdminOperators,
  useAdminRiders,
  useAdminUsers,
  useAuditLog,
  useLogAdminEvent,
  useIssueSuspension,
  useReinstateOperator,
  useIssueRiderSuspension,
  useReinstateRider,
  useAdminVerifyDocument,
  useUpdateAdminUser,
  hasRole,
  SUSPENSION_CATEGORIES,
  ABUSE_SUSPENSION_CATEGORIES,
} from "@/hooks/useAdmin";
import type { AdminOperatorRow, AdminRiderRow, AdminUser, AdminRole, AuditLogEntry, SuspensionCategory } from "@/hooks/useAdmin";
import { computeDailyHours, computeWeeklyEarnings } from "@/hooks/useTrips";
import { LEGAL_DOCS } from "@/lib/onboarding";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, FileText, AlertTriangle, Clock, Car, User, LogOut, Loader2,
  FileLock2, Gavel, Ban, ArrowRight, ChevronDown, ScrollText, Users, Check, X, CheckCircle2,
} from "lucide-react";

// Only the idle/inactive state gets a frosted-glass tint — scoped to data-[state=inactive]
// so the active tab's original look (dark background via the base component) is untouched.
const TAB_TRIGGER_CLASS =
  "flex-1 gap-2 transition-colors data-[state=inactive]:border data-[state=inactive]:border-primary/15 data-[state=inactive]:bg-primary/10 data-[state=inactive]:text-foreground/70 data-[state=inactive]:backdrop-blur-sm data-[state=inactive]:hover:bg-primary/20 data-[state=inactive]:hover:text-foreground";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Console — SOLO.drive" }],
  }),
  component: AdminAuthGate,
});

function AdminAuthGate() {
  const { user, loading } = useAuth();
  const { data: adminRecord, isLoading: adminLoading } = useIsAdmin();
  const logEvent = useLogAdminEvent();
  const loggedSignIn = useRef(false);

  useEffect(() => {
    if (adminRecord?.active && !loggedSignIn.current) {
      loggedSignIn.current = true;
      logEvent.mutate({ action: "sign_in", description: `${adminRecord.email} opened the admin console` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRecord?.id]);

  if (loading || (!!user && adminLoading)) {
    return (
      <AppShell>
        <div className="flex min-h-[80vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center md:px-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface shadow-glow">
            <ShieldCheck className="h-6 w-6 text-primary-glow" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">Admin sign-in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Each staff member signs in with their own account — there's no shared PIN.
            Access is granted per-person in <code>admin_users</code>.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow"
          >
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!adminRecord || !adminRecord.active) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center md:px-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
            <Ban className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as <span className="text-foreground">{user.email}</span>, but this account
            {adminRecord ? " has been deactivated" : " isn't listed in admin_users"}. Ask a super admin for access.
          </p>
        </div>
      </AppShell>
    );
  }

  return <AdminDashboard admin={adminRecord} />;
}

function AdminDashboard({ admin }: { admin: AdminUser }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = admin.role === "super_admin";

  const { data: operators = [], isLoading: opLoading } = useAdminOperators(true);
  const { data: riders = [], isLoading: riderLoading } = useAdminRiders(true);
  const { data: staff = [], isLoading: staffLoading } = useAdminUsers(isSuperAdmin);
  const [auditActorId, setAuditActorId] = useState<string>("all");
  const { data: auditLog = [], isLoading: auditLoading } = useAuditLog(isSuperAdmin, {
    actorId: auditActorId === "all" ? undefined : auditActorId,
  });
  const logEvent = useLogAdminEvent();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin Console</div>
            <h1 className="mt-1 font-display text-4xl font-semibold">Welcome, {admin.name ?? admin.email}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as <span className="text-foreground">{admin.email}</span> <RoleBadge role={admin.role} />
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </header>

        <Tabs
          defaultValue="operators"
          className="mt-8"
          onValueChange={(tab) => logEvent.mutate({ action: "view", description: `Opened ${tab} tab`, metadata: { tab } })}
        >
          <TabsList className={cn("h-11 w-full", isSuperAdmin ? "max-w-2xl" : "max-w-md")}>
            <TabsTrigger value="operators" className={TAB_TRIGGER_CLASS}>
              <Car className="h-3.5 w-3.5" /> Operators ({operators.length})
            </TabsTrigger>
            <TabsTrigger value="riders" className={TAB_TRIGGER_CLASS}>
              <User className="h-3.5 w-3.5" /> Riders ({riders.length})
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="staff" className={TAB_TRIGGER_CLASS}>
                <Users className="h-3.5 w-3.5" /> Staff ({staff.length})
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="audit" className={TAB_TRIGGER_CLASS}>
                <ScrollText className="h-3.5 w-3.5" /> Audit Log
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="operators" className="mt-6">
            {opLoading ? (
              <LoadingBlock />
            ) : operators.length === 0 ? (
              <EmptyState icon={<Car className="h-8 w-8" />} text="No operators have signed up yet." />
            ) : (
              <div className="space-y-6">
                {operators.map((op) => (
                  <OperatorCard key={op.id} operator={op} admin={admin} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="riders" className="mt-6">
            {riderLoading ? (
              <LoadingBlock />
            ) : riders.length === 0 ? (
              <EmptyState icon={<User className="h-8 w-8" />} text="No riders have signed up yet." />
            ) : (
              <div className="space-y-6">
                {riders.map((r) => (
                  <RiderCard key={r.id} rider={r} admin={admin} />
                ))}
              </div>
            )}
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="staff" className="mt-6">
              {staffLoading ? <LoadingBlock /> : <StaffTab staff={staff} currentAdminId={admin.id} />}
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="audit" className="mt-6">
              <AuditLogTab
                entries={auditLog}
                isLoading={auditLoading}
                staff={staff}
                selectedActorId={auditActorId}
                onSelectActor={setAuditActorId}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

function OperatorCard({ operator, admin }: { operator: AdminOperatorRow; admin: AdminUser }) {
  const [expanded, setExpanded] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const logEvent = useLogAdminEvent();
  const issueSuspension = useIssueSuspension();
  const reinstateOperator = useReinstateOperator();
  const verifyDoc = useAdminVerifyDocument();

  const canWrite = hasRole(admin, "compliance");
  const docMap = Object.fromEntries(operator.documents.map((d) => [d.document_type, d]));
  const dailyHours = computeDailyHours(operator.trips);
  const hoursThisWeek = dailyHours.reduce((s, h) => s + h, 0);
  const { total: weekEarnings, count: tripCount } = computeWeeklyEarnings(operator.trips);
  const suspended = operator.status === "suspended";

  const handleToggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      logEvent.mutate({
        action: "view",
        targetTable: "operators",
        targetId: operator.id,
        description: `Viewed operator record: ${operator.name ?? operator.email ?? operator.id}`,
      });
    }
  };

  const handleSuspend = () => {
    if (!suspendReason.trim()) return;
    issueSuspension.mutate(
      {
        operatorId: operator.id,
        operatorEmail: operator.email,
        operatorName: operator.name,
        description: suspendReason.trim(),
      },
      { onSuccess: () => { setSuspendReason(""); setSuspendOpen(false); } },
    );
  };

  const handleReinstate = () => {
    reinstateOperator.mutate(
      { operatorId: operator.id, operatorEmail: operator.email, operatorName: operator.name },
      { onSuccess: () => setReinstateOpen(false) },
    );
  };

  return (
    <div className="rounded-3xl border border-border bg-gradient-surface p-6 shadow-card">
      <button onClick={handleToggleExpand} className="flex w-full flex-wrap items-start justify-between gap-3 text-left">
        <div>
          <div className="font-display text-xl font-semibold">{operator.name ?? "Unnamed operator"}</div>
          <div className="text-xs text-muted-foreground">{operator.email ?? "—"} · {operator.phone ?? "—"}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs", suspended ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
            {operator.status ?? "active"}
          </span>
          <span className={cn("rounded-full px-3 py-1 text-xs", operator.subscription_active ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
            {operator.subscription_active ? "Subscribed" : "Unsubscribed"}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SectionCard title="Identification & Vehicle" icon={<FileText className="h-3.5 w-3.5" />}>
            <DocVerifyRow label="Driver's license (front)" doc={docMap.license_front} canWrite={canWrite} onVerify={(v) => docMap.license_front && verifyDoc.mutate({ documentId: docMap.license_front.id, verified: v })} />
            <DocVerifyRow label="Driver's license (back)" doc={docMap.license_back} canWrite={canWrite} onVerify={(v) => docMap.license_back && verifyDoc.mutate({ documentId: docMap.license_back.id, verified: v })} />
            <FieldRow label="Vehicle" value={[operator.vehicle_year, operator.vehicle_make, operator.vehicle_model].filter(Boolean).join(" ") || "—"} />
            <FieldRow label="VIN" value={operator.vin ?? "—"} />
            <PlaceholderRow label="Vehicle registration document" />
          </SectionCard>

          <SectionCard title="Insurance & Background Check" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            <DocVerifyRow label="Commercial insurance" doc={docMap.insurance} canWrite={canWrite} onVerify={(v) => docMap.insurance && verifyDoc.mutate({ documentId: docMap.insurance.id, verified: v })} />
            <DocVerifyRow label="Background check" doc={docMap.background} canWrite={canWrite} onVerify={(v) => docMap.background && verifyDoc.mutate({ documentId: docMap.background.id, verified: v })} />
            <DocVerifyRow label="Criminal disclosure" doc={docMap.criminal} canWrite={canWrite} onVerify={(v) => docMap.criminal && verifyDoc.mutate({ documentId: docMap.criminal.id, verified: v })} />
            <PlaceholderRow label="Background check approval date" />
          </SectionCard>

          <SectionCard title="Safety Acknowledgments" icon={<Gavel className="h-3.5 w-3.5" />}>
            {LEGAL_DOCS.map((doc) => (
              <PlaceholderRow key={doc.id} label={doc.title} />
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Operators sign these during onboarding, but signatures are only stored on-device today — not synced to Supabase.
            </p>
          </SectionCard>

          <SectionCard title="Suspension History" icon={<Ban className="h-3.5 w-3.5" />}>
            {operator.suspensions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suspensions on record.</p>
            ) : (
              operator.suspensions.map((s) => (
                <FieldRow
                  key={s.id}
                  label={new Date(s.created_at).toLocaleDateString()}
                  value={s.description ?? s.status ?? "Suspended"}
                  ok={s.status === "resolved"}
                />
              ))
            )}

            {canWrite && suspended && (
              reinstateOpen ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Reinstate and email a confirmation?</span>
                  <button
                    onClick={handleReinstate}
                    disabled={reinstateOperator.isPending}
                    className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-success-foreground disabled:opacity-50"
                  >
                    {reinstateOperator.isPending ? "Reinstating…" : "Confirm reinstatement"}
                  </button>
                  <button onClick={() => setReinstateOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setReinstateOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3 py-1.5 text-xs text-success hover:bg-success/10"
                >
                  <CheckCircle2 className="h-3 w-3" /> Reinstate / Approve
                </button>
              )
            )}
            {reinstateOperator.data?.emailSent === false && (
              <p className="text-[11px] text-warning">Operator reinstated, but the confirmation email failed to send.</p>
            )}

            {canWrite && !suspended && (
              suspendOpen ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Reason for suspension…"
                    rows={2}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSuspend}
                      disabled={!suspendReason.trim() || issueSuspension.isPending}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
                    >
                      {issueSuspension.isPending ? "Submitting…" : "Confirm suspension"}
                    </button>
                    <button onClick={() => setSuspendOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSuspendOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Ban className="h-3 w-3" /> Issue suspension
                </button>
              )
            )}
            {issueSuspension.data?.emailSent === false && (
              <p className="text-[11px] text-warning">Operator suspended, but the notification email failed to send.</p>
            )}
          </SectionCard>

          <SectionCard title="Weekly Hours & Activity" icon={<Clock className="h-3.5 w-3.5" />}>
            <FieldRow label="Hours this week" value={`${hoursThisWeek.toFixed(1)} / 50h`} ok={hoursThisWeek < 50} />
            <FieldRow label="Lifetime hours used" value={String(operator.hours_used)} />
            <FieldRow label="Trips this week" value={String(tripCount)} />
            <FieldRow label="Earnings this week" value={`$${weekEarnings.toFixed(2)}`} />
          </SectionCard>

          <SectionCard title="Account" icon={<User className="h-3.5 w-3.5" />}>
            <FieldRow label="Joined" value={new Date(operator.created_at).toLocaleDateString()} />
            <FieldRow label="Operator ID" value={`${operator.id.slice(0, 8)}…`} />
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function RiderCard({ rider, admin }: { rider: AdminRiderRow; admin: AdminUser }) {
  const [expanded, setExpanded] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendCategory, setSuspendCategory] = useState<SuspensionCategory | "">("");
  const [suspendDescription, setSuspendDescription] = useState("");
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const logEvent = useLogAdminEvent();
  const issueSuspension = useIssueRiderSuspension();
  const reinstateRider = useReinstateRider();

  const canWrite = hasRole(admin, "compliance");
  const fullName = [rider.first_name, rider.last_name].filter(Boolean).join(" ") || "Unnamed rider";
  const cleared = rider.bg_status === "cleared";
  const suspended = rider.status === "suspended";

  const handleToggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      logEvent.mutate({
        action: "view",
        targetTable: "riders",
        targetId: rider.id,
        description: `Viewed rider record: ${fullName}`,
      });
    }
  };

  const handleSuspend = () => {
    if (!suspendCategory || !suspendDescription.trim()) return;
    issueSuspension.mutate(
      {
        riderId: rider.id,
        riderEmail: rider.email,
        riderName: fullName,
        category: suspendCategory,
        description: suspendDescription.trim(),
      },
      { onSuccess: () => { setSuspendCategory(""); setSuspendDescription(""); setSuspendOpen(false); } },
    );
  };

  const handleReinstate = () => {
    reinstateRider.mutate(
      { riderId: rider.id, riderEmail: rider.email, riderName: fullName },
      { onSuccess: () => setReinstateOpen(false) },
    );
  };

  return (
    <div className="rounded-3xl border border-border bg-gradient-surface p-6 shadow-card">
      <button onClick={handleToggleExpand} className="flex w-full flex-wrap items-start justify-between gap-3 text-left">
        <div>
          <div className="font-display text-xl font-semibold">{fullName}</div>
          <div className="text-xs text-muted-foreground">{rider.email ?? "—"} · {rider.phone ?? "—"} · DOB {rider.dob ?? "—"}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs", suspended ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
            {rider.status ?? "active"}
          </span>
          <span className={cn("rounded-full px-3 py-1 text-xs", cleared ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
            {rider.bg_status ?? "pending"}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SectionCard title="ID Verification" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            <FieldRow label="Background check / ID" value={rider.bg_status ?? "pending"} ok={cleared} />
            <FieldRow
              label="Approved"
              value={rider.approved_at ? new Date(rider.approved_at).toLocaleDateString() : "Not yet approved"}
              ok={!!rider.approved_at}
            />
          </SectionCard>

          <SectionCard title="Sign-up Disclosures" icon={<FileText className="h-3.5 w-3.5" />}>
            <FieldRow label="Disclosure & release consent" value={rider.consent_signed ? "Signed" : "Not signed"} ok={!!rider.consent_signed} />
            <FieldRow
              label="Signed at"
              value={rider.consent_signed_at ? new Date(rider.consent_signed_at).toLocaleString() : "—"}
              ok={!!rider.consent_signed_at}
            />
          </SectionCard>

          <SectionCard title="Dispute Resolution" icon={<Gavel className="h-3.5 w-3.5" />}>
            <PlaceholderRow label="Dispute resolution agreement" />
            <PlaceholderRow label="Arbitration acknowledgement" />
          </SectionCard>

          <SectionCard title="Signed Legal Docs" icon={<FileLock2 className="h-3.5 w-3.5" />}>
            <PlaceholderRow label="Itemized per-document signatures" />
            <p className="pt-1 text-[11px] text-muted-foreground">
              Only a single consent_signed flag is stored for riders today — no per-document trail like operators have.
            </p>
          </SectionCard>

          <SectionCard title="Safety Acknowledgments" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
            <PlaceholderRow label="Signed safety acknowledgment" />
            <p className="pt-1 text-[11px] text-muted-foreground">
              {rider.incidents.length > 0
                ? `${rider.incidents.length} incident report(s) on file — see safety_incidents (not the same as a signed acknowledgment).`
                : "No incident reports on file."}
            </p>
          </SectionCard>

          <SectionCard title="Suspension History" icon={<Ban className="h-3.5 w-3.5" />}>
            {rider.suspensions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suspensions on record.</p>
            ) : (
              rider.suspensions.map((s) => (
                <FieldRow
                  key={s.id}
                  label={new Date(s.created_at).toLocaleDateString()}
                  value={[s.category, s.description].filter(Boolean).join(" — ") || s.status || "Suspended"}
                  ok={s.status === "resolved"}
                />
              ))
            )}

            {canWrite && suspended && (
              reinstateOpen ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Reinstate and email a confirmation?</span>
                  <button
                    onClick={handleReinstate}
                    disabled={reinstateRider.isPending}
                    className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-success-foreground disabled:opacity-50"
                  >
                    {reinstateRider.isPending ? "Reinstating…" : "Confirm reinstatement"}
                  </button>
                  <button onClick={() => setReinstateOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setReinstateOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3 py-1.5 text-xs text-success hover:bg-success/10"
                >
                  <CheckCircle2 className="h-3 w-3" /> Reinstate / Approve
                </button>
              )
            )}
            {reinstateRider.data?.emailSent === false && (
              <p className="text-[11px] text-warning">Rider reinstated, but the confirmation email failed to send.</p>
            )}

            {canWrite && !suspended && (
              suspendOpen ? (
                <div className="mt-2 space-y-2">
                  <select
                    value={suspendCategory}
                    onChange={(e) => setSuspendCategory(e.target.value as SuspensionCategory)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="" disabled>Select a category…</option>
                    {SUSPENSION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <textarea
                    value={suspendDescription}
                    onChange={(e) => setSuspendDescription(e.target.value)}
                    placeholder="Description…"
                    rows={2}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  {suspendCategory && ABUSE_SUSPENSION_CATEGORIES.has(suspendCategory) && (
                    <p className="text-[11px] text-warning">
                      This category will also create a linked safety incident report.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSuspend}
                      disabled={!suspendCategory || !suspendDescription.trim() || issueSuspension.isPending}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
                    >
                      {issueSuspension.isPending ? "Submitting…" : "Confirm suspension"}
                    </button>
                    <button onClick={() => setSuspendOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSuspendOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Ban className="h-3 w-3" /> Issue suspension
                </button>
              )
            )}
            {issueSuspension.data?.emailSent === false && (
              <p className="text-[11px] text-warning">Rider suspended, but the notification email failed to send.</p>
            )}
          </SectionCard>

          <SectionCard title="Account" icon={<User className="h-3.5 w-3.5" />}>
            <FieldRow label="Joined" value={new Date(rider.created_at).toLocaleDateString()} />
            <FieldRow label="Rider ID" value={`${rider.id.slice(0, 8)}…`} />
          </SectionCard>
        </div>
      )}
    </div>
  );
}

const STAFF_ROLES: AdminRole[] = ["super_admin", "compliance", "viewer"];

function StaffTab({ staff, currentAdminId }: { staff: AdminUser[]; currentAdminId: string }) {
  const update = useUpdateAdminUser();

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-xs text-muted-foreground">
        New staff logins are provisioned outside this UI — a Supabase Auth account has to exist first,
        then a super admin adds a matching row to <code>admin_users</code>. This panel manages role and
        access for existing staff only.
      </div>
      {staff.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <div className="font-medium">
              {s.name ?? "—"} {s.id === currentAdminId && <span className="text-xs text-muted-foreground">(you)</span>}
            </div>
            <div className="text-xs text-muted-foreground">{s.email} · joined {new Date(s.created_at).toLocaleDateString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={s.role}
              disabled={s.id === currentAdminId}
              onChange={(e) => update.mutate({ id: s.id, role: e.target.value as AdminRole })}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs disabled:opacity-50"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </select>
            <button
              disabled={s.id === currentAdminId}
              onClick={() => update.mutate({ id: s.id, active: !s.active })}
              className={cn(
                "rounded-full px-3 py-1 text-xs disabled:opacity-50",
                s.active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
              )}
            >
              {s.active ? "Active" : "Deactivated"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditLogTab({
  entries,
  isLoading,
  staff,
  selectedActorId,
  onSelectActor,
}: {
  entries: AuditLogEntry[];
  isLoading: boolean;
  staff: AdminUser[];
  selectedActorId: string;
  onSelectActor: (actorId: string) => void;
}) {
  const selectedStaffName = staff.find((s) => s.id === selectedActorId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="audit-actor-filter">
          Staff member
        </label>
        <select
          id="audit-actor-filter"
          value={selectedActorId}
          onChange={(e) => onSelectActor(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="all">All staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.email}
            </option>
          ))}
        </select>
        {selectedActorId !== "all" && (
          <span className="text-xs text-muted-foreground">
            Showing full activity history for {selectedStaffName?.name ?? selectedStaffName?.email ?? "this staff member"}
          </span>
        )}
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" />}
          text={selectedActorId === "all" ? "No audit log entries yet." : "No activity logged for this staff member yet."}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.actor_email ?? "system"}</div>
                    <div className="text-xs text-muted-foreground">{e.actor_role ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{e.action}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {e.target_table ? `${e.target_table}${e.target_id ? ` · ${e.target_id.slice(0, 8)}…` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span
      className={cn(
        "ml-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest",
        role === "super_admin" ? "bg-primary/15 text-primary-glow" : role === "compliance" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
      )}
    >
      {role.replace("_", " ")}
    </span>
  );
}

function DocVerifyRow({
  label,
  doc,
  canWrite,
  onVerify,
}: {
  label: string;
  doc?: { verified: boolean; file_url: string | null };
  canWrite: boolean;
  onVerify: (verified: boolean) => void;
}) {
  const status = doc?.verified ? "Verified" : doc?.file_url ? "Pending review" : "Missing";

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("font-medium", doc?.verified && "text-success", !doc?.verified && doc?.file_url && "text-warning")}>{status}</span>
        {canWrite && doc?.file_url && !doc.verified && (
          <button onClick={() => onVerify(true)} title="Verify" className="rounded-md bg-success/15 p-1 text-success hover:bg-success/25">
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        {canWrite && doc?.verified && (
          <button onClick={() => onVerify(false)} title="Revoke verification" className="rounded-md bg-warning/15 p-1 text-warning hover:bg-warning/25">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-16 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {icon} {title}
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function FieldRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", ok === true && "text-success", ok === false && "text-warning")}>{value}</span>
    </div>
  );
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground/70">
      <span>{label}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest">Not tracked yet</span>
    </div>
  );
}
