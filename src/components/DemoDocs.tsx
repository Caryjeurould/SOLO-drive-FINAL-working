// Visitor demo only: the sample Operator documents shown as "uploaded"
// thumbnails in the onboarding wizard, with a large view. Images come from
// public/demo/ (copies; the files themselves are never changed). Every
// document carries a CSS/SVG "SAMPLE" watermark. Nothing is saved or sent.
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_DOCS } from "@/lib/demo";

export type DemoDocKind = "license" | "registration" | "entity" | "commercial" | "bizliab";

const TITLES: Record<DemoDocKind, string> = {
  license: "Driver's license",
  registration: "Vehicle registration",
  entity: "Articles of Organization",
  commercial: "Commercial insurance card",
  bizliab: "Business liability insurance card",
};

/** Diagonal, semi-transparent watermark laid over a document (never baked into the image). */
function Watermark({ official }: { official: boolean }) {
  return (
    <svg
      data-testid="doc-watermark"
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      aria-hidden="true"
    >
      <g transform="rotate(-24 100 60)" textAnchor="middle" fontFamily="sans-serif" fontWeight="800"
        fill="rgba(220,38,38,0.38)" stroke="rgba(255,255,255,0.55)" strokeWidth="0.8">
        <text x="100" y={official ? 62 : 72} fontSize="40" letterSpacing="4">SAMPLE</text>
        {official && <text x="100" y="80" fontSize="9.5" letterSpacing="1">NOT AN OFFICIAL DOCUMENT</text>}
      </g>
    </svg>
  );
}

/** The Business Liability card, drawn in code in the style of the Acme insurance card. */
export function BusinessLiabilityCard({ className }: { className?: string }) {
  const b = DEMO_DOCS.businessLiability;
  return (
    <div className={cn("@container rounded-[6%/9%] border border-neutral-300 bg-white p-[4%] font-sans text-black", className)}>
      <div className="flex items-start gap-[4%] border-b-2 border-red-600 pb-[2%]">
        <div className="text-[6.5cqw] font-bold leading-[1.05] text-red-600">Acme<br />Insurance</div>
        <div className="flex-1 text-center font-bold leading-tight">
          <div className="text-[6.5cqw]">ARIZONA</div>
          <div className="text-[4.2cqw]">BUSINESS LIABILITY INSURANCE CARD</div>
        </div>
      </div>
      <div className="mt-[3%] space-y-[1.5%] text-[3.6cqw] leading-snug">
        <div className="font-bold">{b.carrier} : Business Liability</div>
        <div><span className="font-bold">INSURED:</span> {DEMO_DOCS.entity}</div>
        <div>Policy Number: {b.policy}</div>
        <div><span className="font-bold">LIMIT:</span> {b.limit}</div>
        <div><span className="font-bold">EFFECTIVE DATE:</span> {b.effective} TO {b.expires}</div>
      </div>
    </div>
  );
}

/** One document face (image or the coded card) with its watermark. */
function DocFace({ kind, side, className }: { kind: DemoDocKind; side: "front" | "back"; className?: string }) {
  const img = DEMO_DOCS.images;
  const src = kind === "license" ? (side === "front" ? img.licenseFront : img.licenseBack)
    : kind === "registration" ? img.registration
    : kind === "entity" ? img.entity
    : kind === "commercial" ? img.commercialInsurance
    : null;
  const official = kind === "registration" || kind === "entity";
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-white", className)}>
      {src ? (
        <img src={src} alt={`${TITLES[kind]}${kind === "license" ? ` (${side})` : ""} — sample`} className="block h-full w-full object-contain" draggable={false} />
      ) : (
        <BusinessLiabilityCard className="h-full w-full" />
      )}
      <Watermark official={official} />
    </div>
  );
}

/** An "uploaded" document slot: thumbnail(s) that open the large view. */
export function DemoDocThumb({ kind, label, caption }: { kind: DemoDocKind; label?: string; caption?: string }) {
  const [open, setOpen] = useState<null | "front" | "back">(null);
  const sides: ("front" | "back")[] = kind === "license" ? ["front", "back"] : ["front"];
  return (
    <div data-testid={`demo-doc-${kind}`} className="rounded-xl border border-success/30 bg-success/5 p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-success">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {label ?? TITLES[kind]} uploaded
      </div>
      <div className={cn("mt-2 grid gap-2", sides.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {sides.map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => setOpen(side)}
            aria-label={`View ${TITLES[kind]}${kind === "license" ? ` (${side})` : ""}`}
            className="text-left"
          >
            <DocFace kind={kind} side={side} className={cn("aspect-[3/2] w-full border border-border", sides.length === 1 && "max-w-[260px]")} />
            {sides.length === 2 && <div className="mt-1 text-center text-[11px] text-muted-foreground">{side === "front" ? "Front" : "Back"}</div>}
          </button>
        ))}
      </div>
      {caption && <div className="mt-1.5 text-[11px] text-muted-foreground">{caption}</div>}
      {open && <DemoDocViewer kind={kind} initialSide={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Large view: centered, phone-first; closes via X, a tap outside, or Escape. No auto-close. */
function DemoDocViewer({ kind, initialSide, onClose }: { kind: DemoDocKind; initialSide: "front" | "back"; onClose: () => void }) {
  const [side, setSide] = useState(initialSide);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      data-testid="doc-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-elevated"
      >
        <div className="overflow-y-auto overscroll-contain p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="doc-title" className="font-display text-lg font-semibold leading-tight">{TITLES[kind]}</h2>
              <div className="text-xs text-muted-foreground">Sample document · {DEMO_DOCS.name}</div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {kind === "license" && (
            <div className="mt-3 inline-flex rounded-xl border border-border bg-surface p-1 text-xs">
              {(["front", "back"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  aria-pressed={side === s}
                  className={cn("min-h-9 rounded-lg px-4", side === s ? "bg-primary/15 text-primary-glow" : "text-muted-foreground")}
                >
                  {s === "front" ? "Front" : "Back"}
                </button>
              ))}
            </div>
          )}
          <DocFace kind={kind} side={side} className="mt-3 w-full border border-border [&>img]:h-auto" />
        </div>
      </div>
    </div>
  );
}
