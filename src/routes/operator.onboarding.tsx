import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  User, Car, FileSignature, FileSearch, Building2, Lock, Check,
  Plus, X, Upload, ArrowRight, ArrowLeft, AlertTriangle, Sparkles, CheckCircle2,
  Loader2, FileLock2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BrandText } from "@/components/BrandText";
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
import { DEMO_DOCS, useDemoState } from "@/lib/demo";
import { DemoDocThumb } from "@/components/DemoDocs";

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
      { name: "description", content: "Complete the four-stage Smart+Logix™ Authorization to operate on SOLO.drive." },
    ],
  }),
  component: InstalledAppOnboarding,
});

const STAGES = [
  { n: 1, title: "Identity & Vehicle", icon: User },
  { n: 2, title: "Disclosures & Legal", icon: FileSignature },
  { n: 3, title: "Background Check", icon: FileSearch },
  { n: 4, title: "Business Liability & Commercial Insurance", icon: Building2 },
] as const;

function InstalledAppOnboarding() {
  const navigate = useNavigate();
  const allowed = useInstalledAppOnly("operator", () => navigate({ to: "/", search: { openDownloads: true }, replace: true }));
  return allowed ? <OnboardingWizard /> : null;
}

/** Visitor demo: true while the page is gliding to a newly opened stage, so that
 *  stage's Next doesn't count the end as "reached" on the way past it. */
const DemoSettlingContext = createContext(false);
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const headerHeight = () => document.querySelector("header")?.offsetHeight ?? 0;

function OnboardingWizard() {
  const [state, update] = useOnboarding();
  const navigate = useNavigate();
  const [active, setActive] = useState<1 | 2 | 3 | 4>(state.stage);
  // Visitor demo: the wizard starts from the demo's name screen.
  const demo = isVisitor();
  const demoStarted = useDemoState().started;

  useEffect(() => { setActive(state.stage); }, [state.stage]);
  // The furthest stage reached so far: the stage rows open only up to it (going
  // back works; skipping ahead does not — Next stays the way forward).
  const [furthest, setFurthest] = useState<number>(state.stage);
  useEffect(() => { setFurthest((f) => Math.max(f, active, state.stage)); }, [active, state.stage]);
  useEffect(() => {
    if (demo && !demoStarted) navigate({ to: "/operator/demo", replace: true });
  }, [demo, demoStarted, navigate]);

  // Visitor demo: suggestive scrolling. Like the homepage, snapping is set on
  // <html> (the page scrolls there) only while this page is mounted, with the
  // sticky header's height as padding; here it's "proximity", so the page only
  // settles on a content block when it stops near one. Off with reduced motion.
  useEffect(() => {
    if (!demo || reducedMotion()) return;
    const root = document.documentElement;
    const prevType = root.style.scrollSnapType;
    const prevPadding = root.style.scrollPaddingTop;
    root.style.scrollSnapType = "y proximity";
    root.style.scrollPaddingTop = `${headerHeight() + 8}px`;
    return () => {
      root.style.scrollSnapType = prevType;
      root.style.scrollPaddingTop = prevPadding;
    };
  }, [demo]);

  // Visitor demo: after Next or Back, glide so the new stage's card sits just
  // under the header (instant with reduced motion).
  const cardRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const glide = useRef(false);
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (!demo || !glide.current) return;
    glide.current = false;
    const card = cardRef.current;
    if (!card) { setSettling(false); return; }
    // A short stage leaves too little page below it to bring its card up under
    // the header, so add just enough empty space after it (none for long stages).
    const pad = padRef.current;
    if (pad) pad.style.height = "0px";
    const want = Math.max(0, card.getBoundingClientRect().top + window.scrollY - headerHeight() - 8);
    let max = document.documentElement.scrollHeight - window.innerHeight;
    if (pad && want > max) { pad.style.height = `${Math.ceil(want - max)}px`; max = want; }
    const top = Math.min(max, want);
    window.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      setSettling(false);
    };
    const onScroll = () => { if (Math.abs(window.scrollY - top) < 2) finish(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    const timer = window.setTimeout(finish, 1500);
    onScroll();
    return finish;
  }, [active, demo]);
  const glideTo = (n: 1 | 2 | 3 | 4) => {
    glide.current = true;
    setSettling(true);
    setActive(n);
  };

  if (demo && !demoStarted) return null;

  if (state.status === "approved" && demo) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.3em] text-success">Submitted · Approved by SOLO.drive Admin</div>
          <h1 className="mt-3 font-display text-4xl font-semibold">{state.data.fullName}</h1>
          <div className="mt-6 flex justify-center">
            <Link to="/operator" className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm text-primary-foreground shadow-glow">
              Open dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (state.status === "approved") {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold">
            You're approved.
          </h1>
          <p className="mt-3 text-muted-foreground">
            <BrandText>
              Smart+Logix™ Authorization complete. Your profile, disclosures, and required documents —
              driver's license, business formation, and insurance — have all been submitted.
              Compliance will verify them before you can go online.
            </BrandText>
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
  const canOpen = (n: 1 | 2 | 3 | 4) => n <= furthest && (n === 1 || stageComplete(n - 1));

  const advance = (from: 1 | 2 | 3 | 4) => {
    const next = (from + 1) as 1 | 2 | 3 | 4;
    if (next > 4) {
      // The demo's Approved screen starts at the top.
      if (demo) window.scrollTo({ top: 0 });
      update({ status: "approved" });
      // The demo shows its Approved screen first (this same page).
      if (!demo) navigate({ to: "/operator" });
      return;
    }
    update({ stage: next, status: "in_progress" });
    if (demo) glideTo(next);
    else setActive(next);
  };

  // The header's back chip: previous wizard screen, or out to the app's start
  // screen from the first one. (Its default target, the homepage, isn't part of
  // the Operator app, so the installed-app guard used to bounce it.)
  const back = () => {
    if (active > 1) {
      if (demo) glideTo((active - 1) as 1 | 2 | 3);
      else setActive((active - 1) as 1 | 2 | 3);
    } else navigate({ to: "/operator/start" });
  };

  return (
    <AppShell onBack={back}>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground"><BrandText>Smart+Logix™ Authorization</BrandText></div>
            <h1 className="mt-1 font-display text-4xl font-semibold">Become an Operator</h1>
            <p className="mt-1 text-sm text-primary-glow">SOLO.drive's 4-stage verified onboarding.</p>
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
            const open = canOpen(s.n as 1 | 2 | 3 | 4);
            const done = stageComplete(s.n);
            const isActive = active === s.n;
            const Icon = done ? Check : open ? s.icon : Lock;
            return (
              <button
                key={s.n}
                onClick={() => open && setActive(s.n as 1 | 2 | 3 | 4)}
                disabled={!open}
                data-testid={demo ? `stage-row-${s.n}` : undefined}
                data-open={demo ? String(open) : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                  isActive ? "border-primary/60 bg-gradient-surface shadow-glow" :
                  done ? "border-success/30 bg-success/5" :
                  open ? "border-border bg-card hover:border-primary/40" :
                  // Locked: no tap flash, no hover, no pointer.
                  "border-border bg-muted/30 opacity-60 cursor-not-allowed [-webkit-tap-highlight-color:transparent]",
                  // A completed stage not reached yet keeps its check but does not open.
                  !open && done && !isActive && "cursor-not-allowed [-webkit-tap-highlight-color:transparent]",
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
        <div
          ref={cardRef}
          data-testid={demo ? "demo-stage-card" : undefined}
          className={cn(
            "mt-8 rounded-3xl border border-border bg-gradient-surface p-6 shadow-elevated md:p-8",
            // Visitor demo: the card and each content block of the stage are snap points.
            demo && "snap-start [&>div>*]:snap-start",
          )}
        >
          <DemoSettlingContext.Provider value={settling}>
            {active === 1 && <Stage1 state={state} update={update} onDone={() => advance(1)} />}
            {active === 2 && <Stage2 state={state} update={update} onDone={() => advance(2)} />}
            {active === 3 && <Stage3 state={state} update={update} onDone={() => advance(3)} />}
            {active === 4 && <Stage4 state={state} update={update} onDone={() => advance(4)} />}
          </DemoSettlingContext.Provider>
        </div>
        {demo && <div ref={padRef} aria-hidden="true" />}
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
  // Visitor demo: the VIN printed on the sample documents (16 characters) is
  // accepted as-is; every other VIN goes through the normal 17-character check.
  const vinOk = isValidVIN(d.vin) || (isVisitor() && d.vin === DEMO_DOCS.vehicle.vin);
  // Visitor demo: the SSN and debit card show only their last four digits
  // (read-only), so they are taken as entered.
  const demoMasked = isVisitor() && d.ssn === DEMO_DOCS.ssnMasked && d.debit === DEMO_DOCS.debitMasked;

  const valid =
    !!d.fullName?.trim() && !!d.address?.trim() && !!d.phone && /\d{10}/.test((d.phone ?? "").replace(/\D/g, "")) &&
    !!d.vehMake && !!d.vehModel && !!d.vehYear && vinOk &&
    !!d.autoCarrier && !!d.autoPolicy && (demoMasked || (isValidSSN(d.ssn) && luhn(d.debit))) && !!d.photoDataUrl &&
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
        <Field label="VIN (17 chars)" error={d.vin && !vinOk ? "Invalid VIN format" : undefined}>
          <Input value={d.vin ?? ""} onChange={(v) => set({ vin: v.toUpperCase() })} placeholder="1HGBH41JXMN109186" />
        </Field>

        <Field label="Personal auto carrier"><Input value={d.autoCarrier ?? ""} onChange={(v) => set({ autoCarrier: v })} placeholder="GEICO" /></Field>
        <Field label="Auto policy #"><Input value={d.autoPolicy ?? ""} onChange={(v) => set({ autoPolicy: v })} placeholder="A-XXXXXXXX" /></Field>

        <Field label="Social Security #" hint="Encrypted at rest. Last 4 visible only.">
          {demoMasked
            ? <Input value={d.ssn ?? ""} onChange={() => {}} readOnly ariaLabel="Social Security #" />
            : <Input value={d.ssn ?? ""} onChange={(v) => set({ ssn: v })} placeholder="XXX-XX-1234" type="password" />}
        </Field>
        <Field
          label="Debit card #"
          hint={d.debit && !luhn(d.debit) ? undefined : "For payouts. Tokenized."}
          error={d.debit && !luhn(d.debit) && !demoMasked ? "Card number failed checksum" : undefined}
        >
          {demoMasked
            ? <Input value={d.debit ?? ""} onChange={() => {}} readOnly ariaLabel="Debit card #" />
            : <Input value={d.debit ?? ""} onChange={(v) => set({ debit: v })} placeholder="•••• •••• •••• 4242" />}
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
        {isVisitor() ? (
          <div className="mt-4"><DemoDocThumb kind="license" /></div>
        ) : <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        </div>}
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
          locked={isVisitor()}
          onToggleNone={(v) => set({ feloniesNone: v, felonies: v ? [] : felonies })}
          onAdd={() => addRow("felonies")}
          onUpdate={(i, p) => updateRow("felonies", i, p)}
          onRemove={(i) => removeRow("felonies", i)}
        />
        <DisclosureBlock
          title="Misdemeanor convictions"
          rows={misd}
          none={!!d.misdNone}
          locked={isVisitor()}
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
              demo={isVisitor()}
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

function DisclosureBlock({ title, rows, none, locked, onToggleNone, onAdd, onUpdate, onRemove }: {
  title: string;
  rows: { offense: string; year: string; jurisdiction: string }[];
  none: boolean;
  /** Visitor demo: "None to disclose" stays checked. */
  locked?: boolean;
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
          <input type="checkbox" checked={none} disabled={locked} onChange={(e) => onToggleNone(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
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
  // Visitor demo: already Cleared, with the same pinned Next as the other stages.
  const demo = isVisitor();

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

        {!demo && <div className="mt-6 flex gap-3">
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
        </div>}
      </div>
      {demo && <StageFooter valid={status === "cleared"} onContinue={onDone} />}
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

  const bizFilled = !!d.bizLiabPolicy?.trim() && !!d.bizLiabLimit?.trim() && !!d.bizLiabCarrier?.trim();
  const commFilled = !!d.commLiabPolicy?.trim() && !!d.commLiabLimit?.trim() && !!d.commLiabCarrier?.trim();

  const valid = !!d.entityType && !!d.entityName?.trim() && isValidEIN(d.ein) && !!d.formationState && formationUploaded &&
    !!d.commCarrier && !!d.commPolicy && declarationsUploaded && !!d.commInsuranceExpiration &&
    profDeclarationsUploaded && !!d.profInsuranceExpiration &&
    bizFilled && !!d.confirmBizLiability && commFilled && !!d.confirmCommLiability;

  return (
    <div>
      <StageHeader n={4} title="Business Liability & Commercial Insurance" subtitle="Final step. Operate as a registered business with the required coverage." />

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
        <Field label="EIN" error={d.ein && !isValidEIN(d.ein) ? "Format: 12-3456789" : undefined}>
          <Input value={d.ein ?? ""} onChange={(v) => set({ ein: v })} placeholder="12-3456789" />
        </Field>
        <Field label="State of formation"><Input value={d.formationState ?? ""} onChange={(v) => set({ formationState: v })} placeholder="Delaware" /></Field>
        <Field label="Formation document">
          {isVisitor() ? <DemoDocThumb kind="entity" /> : <DocUploadButton
            label="formation document"
            uploaded={formationUploaded}
            uploading={uploadDocument.isPending && uploadDocument.variables?.documentType === "entity"}
            onPick={(file) => file && uploadDocument.mutate({ documentType: "entity", file })}
          />}
        </Field>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Commercial auto carrier"><Input value={d.commCarrier ?? ""} onChange={(v) => set({ commCarrier: v })} placeholder="Progressive Commercial" /></Field>
        <Field label="Commercial policy #"><Input value={d.commPolicy ?? ""} onChange={(v) => set({ commPolicy: v })} placeholder="C-XXXXXXXX" /></Field>
        <Field label="Commercial auto expiration date" hint="Matches what's printed on the declarations page.">
          <Input type="date" value={d.commInsuranceExpiration ?? ""} onChange={(v) => set({ commInsuranceExpiration: v })} />
        </Field>
        <Field label={isVisitor() ? "Commercial insurance card" : "Declarations page"} full>
          {isVisitor() ? <DemoDocThumb kind="commercial" /> : <DocUploadButton
            label="declarations page"
            uploaded={declarationsUploaded}
            uploading={uploadDocument.isPending && uploadDocument.variables?.documentType === "insurance"}
            onPick={(file) => file && uploadDocument.mutate({ documentType: "insurance", file, expirationDate: d.commInsuranceExpiration })}
          />}
        </Field>
        {isVisitor() && (
          <Field label="Vehicle registration" full>
            <DemoDocThumb
              kind="registration"
              caption={`${DEMO_DOCS.vehicle.year} ${DEMO_DOCS.vehicle.make} ${DEMO_DOCS.vehicle.model} · VIN ${DEMO_DOCS.vehicle.vin} · Plate ${DEMO_DOCS.vehicle.plate} (${DEMO_DOCS.vehicle.plateType}) · Expires ${DEMO_DOCS.registrationExpires}`}
            />
          </Field>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Professional liability expiration date" hint="Matches what's printed on the declarations page." full>
          <Input type="date" value={d.profInsuranceExpiration ?? ""} onChange={(v) => set({ profInsuranceExpiration: v })} />
        </Field>
        <Field label="Professional liability declarations page" full>
          <DocUploadButton
            label="professional liability declarations page"
            uploadedLabel={isVisitor() ? "Professional liability - uploaded" : undefined}
            uploaded={profDeclarationsUploaded}
            uploading={uploadDocument.isPending && uploadDocument.variables?.documentType === "professional_insurance"}
            onPick={(file) => file && uploadDocument.mutate({ documentType: "professional_insurance", file, expirationDate: d.profInsuranceExpiration })}
          />
        </Field>
      </div>

      {uploadDocument.isError && (
        <p className="mt-2 text-xs text-destructive">Upload failed — please try again.</p>
      )}

      {isVisitor() && (
        <div className="mt-6">
          <Field label="Business liability insurance card" full>
            <DemoDocThumb kind="bizliab" />
          </Field>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <CoverageConfirm
          name="Business Liability"
          tail="meets the SOLO.drive minimum of $1,000,000."
          policy={d.bizLiabPolicy ?? ""}
          limit={d.bizLiabLimit ?? ""}
          carrier={d.bizLiabCarrier ?? ""}
          checked={!!d.confirmBizLiability}
          onChange={(p) => set({ bizLiabPolicy: p.policy, bizLiabLimit: p.limit, bizLiabCarrier: p.carrier, confirmBizLiability: p.checked })}
        />
        <CoverageConfirm
          name="Commercial Insurance"
          note="Commercially rated coverage for the vehicle you operate."
          limitPlaceholder="Limits"
          limitHint="in $1,000s: bodily injury per person / per accident / property damage"
          tail="meets or exceeds my state's required minimum."
          policy={d.commLiabPolicy ?? ""}
          limit={d.commLiabLimit ?? ""}
          carrier={d.commLiabCarrier ?? ""}
          checked={!!d.confirmCommLiability}
          onChange={(p) => set({ commLiabPolicy: p.policy, commLiabLimit: p.limit, commLiabCarrier: p.carrier, confirmCommLiability: p.checked })}
        />
      </div>

      <StageFooter
        valid={valid}
        labelContinue={isVisitor() ? undefined : "Submit for approval"}
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
  if (isVisitor()) return <DemoNextBar valid={valid} onNext={onContinue} />;
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

/** `hint` is an explanation line (not shown in the visitor demo); `error` is a
 *  validation message (always shown, in its place). */
function Field({ label, hint, error, full, children }: { label: string; hint?: string; error?: string; full?: boolean; children: React.ReactNode }) {
  const line = error ?? (isVisitor() ? undefined : hint);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", full && "md:col-span-2")}>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
      {line && <div className="text-[11px] text-warning/90">{line}</div>}
    </div>
  );
}
function Input({ value, onChange, placeholder, type = "text", readOnly, ariaLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean; ariaLabel?: string }) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-xl border border-border bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}
/** Visitor demo: the stage's Next button, inline at the end of the stage. Its
 *  place is kept but it stays hidden until the visitor has scrolled to the end
 *  of the stage (then it stays); until then a quiet "scroll ↓" hint shows. */
function DemoNextBar({ valid, onNext }: { valid: boolean; onNext: () => void }) {
  const settling = useContext(DemoSettlingContext);
  const endRef = useRef<HTMLDivElement>(null);
  const [reached, setReached] = useState(false);
  useEffect(() => {
    if (settling || reached) return;
    const check = () => {
      const end = endRef.current;
      if (end && end.getBoundingClientRect().top <= window.innerHeight) setReached(true);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const ro = new ResizeObserver(check);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      ro.disconnect();
    };
  }, [settling, reached]);

  return (
    <>
      <div className={cn("mt-8 flex justify-end border-t border-border pt-6", !reached && "invisible")} aria-hidden={!reached || undefined}>
        <button
          onClick={onNext}
          disabled={!valid || !reached}
          tabIndex={reached ? undefined : -1}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition",
            valid ? "bg-gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "cursor-not-allowed bg-muted text-muted-foreground/60",
          )}
        >
          Next <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {/* Marks the end of the stage (below the Next button, so reaching it means Next is on screen). */}
      <div ref={endRef} data-testid="demo-stage-end" />
      {!reached && (
        <span aria-hidden="true" className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-[11px] text-muted-foreground/80 backdrop-blur">
          scroll ↓
        </span>
      )}
    </>
  );
}

/** A fixed coverage sentence where only the policy #, limit and carrier can be
 *  typed in. Its checkbox stays unchecked until all three are filled. */
function CoverageConfirm({ name, note, limitPlaceholder = "Limit", limitHint, tail, policy, limit, carrier, checked, onChange }: {
  name: string;
  /** Small gray line under the coverage name. */
  note?: string;
  limitPlaceholder?: string;
  /** Small gray hint under the limits box. */
  limitHint?: string;
  tail: string;
  policy: string;
  limit: string;
  carrier: string;
  checked: boolean;
  onChange: (p: { policy: string; limit: string; carrier: string; checked: boolean }) => void;
}) {
  const filled = !!policy.trim() && !!limit.trim() && !!carrier.trim();
  const cur = { policy, limit, carrier, checked };
  const pill = (key: "policy" | "limit" | "carrier", placeholder: string, width: string) => (
    <input
      value={cur[key]}
      onChange={(e) => onChange({ ...cur, [key]: e.target.value })}
      placeholder={placeholder}
      aria-label={`${name} ${placeholder}`}
      className={cn(
        "mx-0.5 inline-block rounded-lg border border-border bg-input px-2.5 py-1 align-middle text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring",
        width,
      )}
    />
  );
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3 text-sm">
      <input
        type="checkbox"
        aria-label={`I confirm my ${name} policy`}
        checked={checked && filled}
        disabled={!filled}
        onChange={(e) => onChange({ ...cur, checked: e.target.checked })}
        className="mt-2.5 h-4 w-4 shrink-0 rounded border-border disabled:cursor-not-allowed disabled:opacity-50"
      />
      <p className="leading-10 text-muted-foreground">
        I confirm that my {name} policy:{" "}
        {note && <span className="block text-xs leading-5 text-muted-foreground/80">{note}</span>}
        {pill("policy", "Policy #", "w-40")} |{" "}
        {limitHint ? (
          <span className="inline-flex flex-col align-top">
            {pill("limit", limitPlaceholder, "w-28")}
            <span className="mx-0.5 -mt-1.5 max-w-[14rem] text-[10px] leading-4 text-muted-foreground/80">{limitHint}</span>
          </span>
        ) : pill("limit", limitPlaceholder, "w-28")}{" "}
        {pill("carrier", "Carrier", "w-32")} {tail}
      </p>
    </div>
  );
}
function DocUploadButton({ label, uploadedLabel, accept, uploaded, uploading, onPick }: {
  label: string;
  /** The green line once uploaded (default "<Label> uploaded"). */
  uploadedLabel?: string;
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
        {uploading ? "Uploading…" : uploaded ? (uploadedLabel ?? `${label[0].toUpperCase()}${label.slice(1)} uploaded`) : `Upload ${label}`}
      </span>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
    </label>
  );
}
