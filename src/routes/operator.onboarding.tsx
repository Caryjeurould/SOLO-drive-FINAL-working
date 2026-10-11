import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck, User, Car, FileSignature, FileSearch, Building2, Lock, Check,
  Plus, X, Upload, ArrowRight, ArrowLeft, AlertTriangle, Sparkles, CheckCircle2,
  Loader2, FileLock2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LegalDocViewer } from "@/components/onboarding/LegalDocViewer";
import {
  useOnboarding, isValidVIN, luhn, isValidSSN, isValidEIN, LEGAL_DOCS,
  type OnboardingState,
} from "@/lib/onboarding";
import { useUpsertOperator } from "@/hooks/useOperatorProfile";
import { useDocuments, useUploadDocument } from "@/hooks/useDocuments";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useInstalledAppOnly } from "@/lib/pwa";
import { isVisitor } from "@/lib/site-role";
import { useDemoState } from "@/lib/demo";

export const Route = createFileRoute("/operator/onboarding")({
  // The real onboarding form must never be reachable on the public website —
  // no exceptions, regardless of auth or how the visitor arrived. It only
  // exists inside the installed Operator app. Every hit from a browser tab
  // bounces to the homepage with the Downloads popup open, with nothing of
  // this page ever shown. Not server-rendered: whether this is the installed
  // app can only be known in the browser, and the wizard never appears in the
  // public site's HTML.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Operator Authorization — SOLO.drive" },
      { name: "description", content: "Complete the four-stage SmartLogix Authorization to operate on SOLO.drive." },
    ],
  }),
  component: InstalledAppOnboarding,
});

const STAGES = [
  { n: 1, title: "Identity & Vehicle", icon: User },
  { n: 2, title: "Disclosures & Legal", icon: FileSignature },
  { n: 3, title: "Background Check", icon: FileSearch },
  { n: 4, title: "Business & Insurance", icon: Building2 },
] as const;

function InstalledAppOnboarding() {
  const navigate = useNavigate();
  const allowed = useInstalledAppOnly("operator", () => navigate({ to: "/", search: { openDownloads: true }, replace: true }));
  return allowed ? <OnboardingWizard /> : null;
}

function OnboardingWizard() {
  const [state, update] = useOnboarding();
  const navigate = useNavigate();
  const [active, setActive] = useState<1 | 2 | 3 | 4>(state.stage);
  // Visitor demo: the wizard starts from the demo's name screen.
  const demo = isVisitor();
  const demoStarted = useDemoState().started;

  useEffect(() => { setActive(state.stage); }, [state.stage]);
  useEffect(() => {
    if (demo && !demoStarted) navigate({ to: "/operator/demo", replace: true });
  }, [demo, demoStarted, navigate]);
  if (demo && !demoStarted) return null;

  if (state.status === "approved") {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold">
            {demo && state.data.fullName ? `You're approved, ${state.data.fullName}.` : "You're approved."}
          </h1>
          <p className="mt-3 text-muted-foreground">
            SmartLogix Authorization complete. Your profile, disclosures, and required documents —
            driver's license, business formation, and insurance — have all been submitted.
            Compliance will verify them before you can go online.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/operator" className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm text-primary-foreground shadow-glow">
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/operator/vault" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-3.5 text-sm hover:bg-secondary">
              <FileLock2 className="h-4 w-4" /> View Document Vault
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const stageComplete = (n: number) => {
    if (n === 1) return !!state.data.stage1Complete;
    if (n === 2) return !!state.data.stage2Complete;
    if (n === 3) return state.data.bgStatus === "cleared";
    return !!state.data.stage4Complete;
  };
  const canOpen = (n: 1 | 2 | 3 | 4) => n === 1 || stageComplete(n - 1);

  const advance = (from: 1 | 2 | 3 | 4) => {
    const next = (from + 1) as 1 | 2 | 3 | 4;
    if (next > 4) {
      update({ status: "approved" });
      navigate({ to: "/operator" });
      return;
    }
    update({ stage: next, status: "in_progress" });
    setActive(next);
  };

  // The header's back chip: previous wizard screen, or out to the app's start
  // screen from the first one. (Its default target, the homepage, isn't part of
  // the Operator app, so the installed-app guard used to bounce it.)
  const back = () => {
    if (active > 1) setActive((active - 1) as 1 | 2 | 3);
    else navigate({ to: "/operator/start" });
  };

  return (
    <AppShell onBack={back}>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">SmartLogix Authorization</div>
            <h1 className="mt-1 font-display text-4xl font-semibold">Become an Operator</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Four locked stages. Each one unlocks the next. You cannot accept rides until every stage is approved.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary-glow">
            <Sparkles className="h-3.5 w-3.5" /> Hard-walled · No back doors
          </span>
        </div>

        {/* Stepper */}
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {STAGES.map((s) => {
            const done = stageComplete(s.n);
            const open = canOpen(s.n as 1 | 2 | 3 | 4);
            const isActive = active === s.n;
            const Icon = done ? Check : open ? s.icon : Lock;
            return (
              <button
                key={s.n}
                onClick={() => open && setActive(s.n as 1 | 2 | 3 | 4)}
                disabled={!open}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                  isActive ? "border-primary/60 bg-gradient-surface shadow-glow" :
                  done ? "border-success/30 bg-success/5" :
                  open ? "border-border bg-card hover:border-primary/40" :
                  "border-border bg-muted/30 opacity-60 cursor-not-allowed",
                )}
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  done ? "bg-success/15 text-success" : isActive ? "bg-gradient-primary text-primary-foreground" : "bg-surface text-muted-foreground",
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Stage {s.n}</div>
                  <div className="text-sm font-medium">{s.title}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stage content */}
        <div className="mt-8 rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated md:p-8">
          {active === 1 && <Stage1 state={state} update={update} onDone={() => advance(1)} />}
          {active === 2 && <Stage2 state={state} update={update} onDone={() => advance(2)} />}
          {active === 3 && <Stage3 state={state} update={update} onDone={() => advance(3)} />}
          {active === 4 && <Stage4 state={state} update={update} onDone={() => advance(4)} />}
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------- Stage 1 ---------------- */
function Stage1({ state, update, onDone }: { state: OnboardingState; update: (p: Partial<OnboardingState>) => void; onDone: () => void }) {
  const d = state.data;
  const set = (patch: Partial<OnboardingState["data"]>) => update({ data: patch });
  const upsertOperator = useUpsertOperator();
  const { user } = useAuth();
  const { data: documents = [] } = useDocuments();
  const uploadDocument = useUploadDocument();

  const docMap = Object.fromEntries(documents.map((doc) => [doc.document_type, doc]));
  const licenseFrontUploaded = !!docMap.license_front?.file_url;
  const licenseBackUploaded = !!docMap.license_back?.file_url;

  const valid =
    !!d.fullName?.trim() && !!d.address?.trim() && !!d.phone && /\d{10}/.test((d.phone ?? "").replace(/\D/g, "")) &&
    !!d.vehMake && !!d.vehModel && !!d.vehYear && isValidVIN(d.vin) &&
    !!d.autoCarrier && !!d.autoPolicy && isValidSSN(d.ssn) && luhn(d.debit) && !!d.photoDataUrl &&
    licenseFrontUploaded && licenseBackUploaded && !!d.licenseExpiration;

  const onPhoto = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => set({ photoDataUrl: String(r.result) });
    r.readAsDataURL(f);
  };

  return (
    <div>
      <StageHeader n={1} title="Identity & Vehicle" subtitle="Tell us who you are and what you drive." />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Full legal name"><Input value={d.fullName ?? ""} onChange={(v) => set({ fullName: v })} placeholder="Marcus L. Reeves" /></Field>
        <Field label="Smartphone #"><Input value={d.phone ?? ""} onChange={(v) => set({ phone: v })} placeholder="(555) 123-4567" /></Field>
        <Field label="Residential address" full><Input value={d.address ?? ""} onChange={(v) => set({ address: v })} placeholder="123 Main St, Brooklyn, NY 11201" /></Field>

        <Field label="Vehicle make"><Input value={d.vehMake ?? ""} onChange={(v) => set({ vehMake: v })} placeholder="Toyota" /></Field>
        <Field label="Vehicle model"><Input value={d.vehModel ?? ""} onChange={(v) => set({ vehModel: v })} placeholder="Camry" /></Field>
        <Field label="Year"><Input value={d.vehYear ?? ""} onChange={(v) => set({ vehYear: v })} placeholder="2022" /></Field>
        <Field label="VIN (17 chars)" hint={d.vin && !isValidVIN(d.vin) ? "Invalid VIN format" : undefined}>
          <Input value={d.vin ?? ""} onChange={(v) => set({ vin: v.toUpperCase() })} placeholder="1HGBH41JXMN109186" />
        </Field>

        <Field label="Personal auto carrier"><Input value={d.autoCarrier ?? ""} onChange={(v) => set({ autoCarrier: v })} placeholder="GEICO" /></Field>
        <Field label="Auto policy #"><Input value={d.autoPolicy ?? ""} onChange={(v) => set({ autoPolicy: v })} placeholder="A-XXXXXXXX" /></Field>

        <Field label="Social Security #" hint="Encrypted at rest. Last 4 visible only.">
          <Input value={d.ssn ?? ""} onChange={(v) => set({ ssn: v })} placeholder="XXX-XX-1234" type="password" />
        </Field>
        <Field label="Debit card #" hint={d.debit && !luhn(d.debit) ? "Card number failed checksum" : "For payouts. Tokenized."}>
          <Input value={d.debit ?? ""} onChange={(v) => set({ debit: v })} placeholder="•••• •••• •••• 4242" />
        </Field>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Self photo</div>
            <div className="text-xs text-muted-foreground">A clear forward-facing photo. Used for in-app driver verification.</div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm hover:bg-secondary">
            <Upload className="h-4 w-4" /> {d.photoDataUrl ? "Replace" : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
        </div>
        {d.photoDataUrl && (
          <img src={d.photoDataUrl} alt="self" className="mt-4 h-24 w-24 rounded-xl border border-border object-cover" />
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card/60 p-5">
        <div className="text-sm font-medium">Driver's license</div>
        <div className="text-xs text-muted-foreground">
          Clear photos of both sides. Reviewed by Compliance before you can go online.
        </div>
        <div className="mt-3 max-w-xs">
          <Field label="License expiration date" hint="Matches what's printed on the license — enter this before uploading.">
            <Input type="date" value={d.licenseExpiration ?? ""} onChange={(v) => set({ licenseExpiration: v })} />
          </Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DocUploadButton
            label="front"
            accept="image/*"
            uploaded={licenseFrontUploaded}
            uploading={uploadDocument.isPending && uploadDocument.variables?.documentType === "license_front"}
            onPick={(file) => file && uploadDocument.mutate({ documentType: "license_front", file, expirationDate: d.licenseExpiration })}
          />
          <DocUploadButton
            label="back"
            accept="image/*"
            uploaded={licenseBackUploaded}
            uploading={uploadDocument.isPending && uploadDocument.variables?.documentType === "license_back"}
            onPick={(file) => file && uploadDocument.mutate({ documentType: "license_back", file, expirationDate: d.licenseExpiration })}
          />
        </div>
        {uploadDocument.isError && (
          <p className="mt-2 text-xs text-destructive">Upload failed — please try again.</p>
        )}
      </div>

      <StageFooter
        valid={valid}
        onContinue={() => {
          set({ stage1Complete: true });
          // Sync to Supabase in the background; don't block progression
          if (user) {
            upsertOperator.mutate({
              name: d.fullName ?? null,
              phone: d.phone ?? null,
              vehicle_make: d.vehMake ?? null,
              vehicle_model: d.vehModel ?? null,
              vehicle_year: d.vehYear ? parseInt(d.vehYear) : null,
              vin: d.vin ?? null,
            });
          }
          onDone();
        }}
      />
    </div>
  );
}

/* ---------------- Stage 2 ---------------- */
function Stage2({ state, update, onDone }: { state: OnboardingState; update: (p: Partial<OnboardingState>) => void; onDone: () => void }) {
  const d = state.data;
  const set = (patch: Partial<OnboardingState["data"]>) => update({ data: patch });
  const expectedName = d.fullName ?? "";

  const felonies = d.felonies ?? [];
  const misd = d.misd ?? [];
  const signedDocs = d.signedDocs ?? {};

  const disclosuresOk = (d.feloniesNone || felonies.every((f) => f.offense && f.year && f.jurisdiction)) &&
                        (d.misdNone || misd.every((f) => f.offense && f.year && f.jurisdiction)) &&
                        (d.feloniesNone || felonies.length > 0) &&
                        (d.misdNone || misd.length > 0);
  const allSigned = LEGAL_DOCS.every((doc) => !!signedDocs[doc.id]);
  const valid = disclosuresOk && allSigned;

  const addRow = (key: "felonies" | "misd") => {
    const cur = (d[key] ?? []) as { offense: string; year: string; jurisdiction: string }[];
    set({ [key]: [...cur, { offense: "", year: "", jurisdiction: "" }] } as Partial<OnboardingState["data"]>);
  };
  const updateRow = (key: "felonies" | "misd", i: number, patch: Partial<{ offense: string; year: string; jurisdiction: string }>) => {
    const cur = [...((d[key] ?? []) as { offense: string; year: string; jurisdiction: string }[])];
    cur[i] = { ...cur[i], ...patch };
    set({ [key]: cur } as Partial<OnboardingState["data"]>);
  };
  const removeRow = (key: "felonies" | "misd", i: number) => {
    const cur = [...((d[key] ?? []) as { offense: string; year: string; jurisdiction: string }[])];
    cur.splice(i, 1);
    set({ [key]: cur } as Partial<OnboardingState["data"]>);
  };

  return (
    <div>
      <StageHeader n={2} title="Disclosures & Legal" subtitle="Required disclosures and signed agreements." />

      {/* Disclosures */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <DisclosureBlock
          title="Felony convictions"
          rows={felonies}
          none={!!d.feloniesNone}
          onToggleNone={(v) => set({ feloniesNone: v, felonies: v ? [] : felonies })}
          onAdd={() => addRow("felonies")}
          onUpdate={(i, p) => updateRow("felonies", i, p)}
          onRemove={(i) => removeRow("felonies", i)}
        />
        <DisclosureBlock
          title="Misdemeanor convictions"
          rows={misd}
          none={!!d.misdNone}
          onToggleNone={(v) => set({ misdNone: v, misd: v ? [] : misd })}
          onAdd={() => addRow("misd")}
          onUpdate={(i, p) => updateRow("misd", i, p)}
          onRemove={(i) => removeRow("misd", i)}
        />
      </div>

      {/* Legal docs */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl">Read & sign</h3>
          <span className="text-xs text-muted-foreground">
            Signed {Object.keys(signedDocs).length} / {LEGAL_DOCS.length}
          </span>
        </div>
        {!expectedName && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
            <AlertTriangle className="h-4 w-4" /> Complete Stage 1 to enable signatures (signature must match your legal name).
          </div>
        )}
        <div className="mt-4 grid gap-3">
          {LEGAL_DOCS.map((doc) => (
            <LegalDocViewer
              key={doc.id}
              title={doc.title}
              body={doc.body}
              expectedName={expectedName}
              signed={signedDocs[doc.id]}
              prefill={isVisitor()}
              onSign={(sig) => set({ signedDocs: { ...signedDocs, [doc.id]: sig } })}
            />
          ))}
        </div>
      </div>

      <StageFooter
        valid={valid}
        onContinue={() => { set({ stage2Complete: true }); onDone(); }}
      />
    </div>
  );
}

function DisclosureBlock({ title, rows, none, onToggleNone, onAdd, onUpdate, onRemove }: {
  title: string;
  rows: { offense: string; year: string; jurisdiction: string }[];
  none: boolean;
  onToggleNone: (v: boolean) => void;
  onAdd: () => void;
  onUpdate: (i: number, p: Partial<{ offense: string; year: string; jurisdiction: string }>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={none} onChange={(e) => onToggleNone(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
          None to disclose
        </label>
      </div>
      {!none && (
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_1fr_28px] items-center gap-2">
              <input value={r.offense} onChange={(e) => onUpdate(i, { offense: e.target.value })} placeholder="Offense"
                className="rounded-lg border border-border bg-input px-2.5 py-2 text-xs" />
              <input value={r.year} onChange={(e) => onUpdate(i, { year: e.target.value })} placeholder="Year"
                className="rounded-lg border border-border bg-input px-2.5 py-2 text-xs" />
              <input value={r.jurisdiction} onChange={(e) => onUpdate(i, { jurisdiction: e.target.value })} placeholder="Jurisdiction"
                className="rounded-lg border border-border bg-input px-2.5 py-2 text-xs" />
              <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={onAdd} className="inline-flex items-center gap-1.5 text-xs text-primary-glow hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add entry
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Stage 3 ---------------- */
function Stage3({ state, update, onDone }: { state: OnboardingState; update: (p: Partial<OnboardingState>) => void; onDone: () => void }) {
  const d = state.data;
  const status = d.bgStatus ?? "not_started";
  const set = (patch: Partial<OnboardingState["data"]>) => update({ data: patch });

  useEffect(() => {
    if (status !== "in_progress") return;
    const t = setTimeout(() => set({ bgStatus: "cleared" }), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <StageHeader n={3} title="Background Check" subtitle="Third-party screening. $19.99 one-time fee." />

      <div className="mt-6 rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">SOLO.drive Background Check{isVisitor() && " (simulated)"}</div>
            <div className="text-xs text-muted-foreground">Identity, motor vehicle record, and criminal history. Powered by Checkr.</div>
          </div>
          <div className={cn(
            "rounded-full px-3 py-1 text-xs",
            status === "cleared" ? "bg-success/15 text-success" :
            status === "in_progress" ? "bg-warning/15 text-warning" :
            status === "failed" ? "bg-destructive/15 text-destructive" :
            "bg-muted text-muted-foreground",
          )}>
            {status === "not_started" && "Not started"}
            {status === "in_progress" && "Processing…"}
            {status === "cleared" && "Cleared"}
            {status === "failed" && "Action required"}
          </div>
        </div>

        <div className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-4xl font-semibold">$19.99</span>
          <span className="text-xs text-muted-foreground">one-time, paid to Checkr</span>
        </div>

        <div className="mt-6 flex gap-3">
          {status === "not_started" && (
            <button onClick={() => set({ bgStatus: "in_progress", bgStartedAt: Date.now() })}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm text-primary-foreground shadow-glow">
              Begin background check <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {status === "in_progress" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-warning" /> Verifying records…
            </div>
          )}
          {status === "cleared" && (
            <button onClick={onDone} className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm text-primary-foreground shadow-glow">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Stage 4 ---------------- */
function Stage4({ state, update, onDone }: { state: OnboardingState; update: (p: Partial<OnboardingState>) => void; onDone: () => void }) {
  const d = state.data;
  const set = (patch: Partial<OnboardingState["data"]>) => update({ data: patch });
  const { data: documents = [] } = useDocuments();
  const uploadDocument = useUploadDocument();

  const docMap = Object.fromEntries(documents.map((doc) => [doc.document_type, doc]));
  const formationUploaded = !!docMap.entity?.file_url;
  const declarationsUploaded = !!docMap.insurance?.file_url;
  const profDeclarationsUploaded = !!docMap.professional_insurance?.file_url;

  const valid = !!d.entityType && !!d.entityName?.trim() && isValidEIN(d.ein) && !!d.formationState && formationUploaded &&
    !!d.commCarrier && !!d.commPolicy && declarationsUploaded && !!d.commInsuranceExpiration &&
    profDeclarationsUploaded && !!d.profInsuranceExpiration &&
    !!d.confirmLiability && !!d.confirmProfLiability;

  return (
    <div>
      <StageHeader n={4} title="Business Entity & Commercial Insurance" subtitle="Final step. Operate as a registered business with $1M+$1M coverage." />

      <div className="mt-6">
        <div className="text-sm font-medium">Entity type</div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {(["LLC", "C-Corp", "S-Corp"] as const).map((t) => (
            <button key={t} onClick={() => set({ entityType: t })}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                d.entityType === t ? "border-primary/60 bg-gradient-primary/10 shadow-glow" : "border-border bg-card hover:border-primary/40",
              )}>
              <div className="font-display text-lg">{t}</div>
              <div className="text-xs text-muted-foreground">
                {t === "LLC" ? "Limited liability" : t === "C-Corp" ? "Standard corporation" : "Pass-through corp"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Legal entity name"><Input value={d.entityName ?? ""} onChange={(v) => set({ entityName: v })} placeholder="Reeves Transport LLC" /></Field>
        <Field label="EIN" hint={d.ein && !isValidEIN(d.ein) ? "Format: 12-3456789" : undefined}>
          <Input value={d.ein ?? ""} onChange={(v) => set({ ein: v })} placeholder="12-3456789" />
        </Field>
        <Field label="State of formation"><Input value={d.formationState ?? ""} onChange={(v) => set({ formationState: v })} placeholder="Delaware" /></Field>
        <Field label="Formation document">
          <DocUploadButton
            label="formation document"
            uploaded={formationUploaded}
            uploading={uploadDocument.isPending && uploadDocument.variables?.documentType === "entity"}
            onPick={(file) => file && uploadDocument.mutate({ documentType: "entity", file })}
          />
        </Field>
      </div>

      <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary-glow">Required coverage</div>
            <div className="mt-1 font-display text-xl">$1,000,000 Liability + $1,000,000 Professional Liability</div>
          </div>
          <ShieldCheck className="h-8 w-8 text-primary-glow" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Commercial auto carrier"><Input value={d.commCarrier ?? ""} onChange={(v) => set({ commCarrier: v })} placeholder="Progressive Commercial" /></Field>
        <Field label="Commercial policy #"><Input value={d.commPolicy ?? ""} onChange={(v) => set({ commPolicy: v })} placeholder="C-XXXXXXXX" /></Field>
        <Field label="Commercial auto expiration date" hint="Matches what's printed on the declarations page.">
          <Input type="date" value={d.commInsuranceExpiration ?? ""} onChange={(v) => set({ commInsuranceExpiration: v })} />
        </Field>
        <Field label="Declarations page" full>
          <DocUploadButton
            label="declarations page"
            uploaded={declarationsUploaded}
            uploading={uploadDocument.isPending && uploadDocument.variables?.documentType === "insurance"}
            onPick={(file) => file && uploadDocument.mutate({ documentType: "insurance", file, expirationDate: d.commInsuranceExpiration })}
          />
        </Field>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Professional liability expiration date" hint="Matches what's printed on the declarations page." full>
          <Input type="date" value={d.profInsuranceExpiration ?? ""} onChange={(v) => set({ profInsuranceExpiration: v })} />
        </Field>
        <Field label="Professional liability declarations page" full>
          <DocUploadButton
            label="professional liability declarations page"
            uploaded={profDeclarationsUploaded}
            uploading={uploadDocument.isPending && uploadDocument.variables?.documentType === "professional_insurance"}
            onPick={(file) => file && uploadDocument.mutate({ documentType: "professional_insurance", file, expirationDate: d.profInsuranceExpiration })}
          />
        </Field>
      </div>

      {uploadDocument.isError && (
        <p className="mt-2 text-xs text-destructive">Upload failed — please try again.</p>
      )}

      <div className="mt-4 space-y-2">
        <Check2 checked={!!d.confirmLiability} onChange={(v) => set({ confirmLiability: v })}
          label="I confirm my policy meets or exceeds $1,000,000 in commercial auto liability coverage." />
        <Check2 checked={!!d.confirmProfLiability} onChange={(v) => set({ confirmProfLiability: v })}
          label="I confirm I carry $1,000,000 in professional liability coverage." />
      </div>

      <StageFooter
        valid={valid}
        labelContinue="Submit for approval"
        onContinue={() => { set({ stage4Complete: true }); onDone(); }}
      />
    </div>
  );
}

/* ---------------- Shared ---------------- */
function StageHeader({ n, title, subtitle }: { n: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Stage {n} of 4</div>
        <h2 className="mt-1 font-display text-3xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
function StageFooter({ valid, onContinue, labelContinue = "Continue" }: { valid: boolean; onContinue: () => void; labelContinue?: string }) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
      <Link to="/operator/start" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Save & exit
      </Link>
      <button
        onClick={onContinue}
        disabled={!valid}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition",
          valid ? "bg-gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "cursor-not-allowed bg-muted text-muted-foreground/60",
        )}
      >
        {labelContinue} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", full && "md:col-span-2")}>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-warning/90">{hint}</div>}
    </div>
  );
}
function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-xl border border-border bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}
function Check2({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card/60 p-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
}
function DocUploadButton({ label, accept, uploaded, uploading, onPick }: {
  label: string;
  accept?: string;
  uploaded: boolean;
  uploading: boolean;
  onPick: (file?: File) => void;
}) {
  return (
    <label className={cn(
      "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm",
      uploaded ? "border-success/30 bg-success/5" : "border-border bg-input",
    )}>
      <span className={cn("flex items-center gap-2 truncate", uploaded ? "text-success" : "text-muted-foreground/60")}>
        {uploading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : uploaded ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <Upload className="h-4 w-4 shrink-0" />
        )}
        {uploading ? "Uploading…" : uploaded ? `${label[0].toUpperCase()}${label.slice(1)} uploaded` : `Upload ${label}`}
      </span>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
    </label>
  );
}
