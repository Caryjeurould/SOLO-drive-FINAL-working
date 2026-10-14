// Visitor demo only: the sample Operator documents shown as "uploaded"
// thumbnails in the onboarding wizard, with a large view. Images come from
// public/demo/ (copies; the files themselves are never changed). The visitor's
// own name is laid over each image (SVG patches), and every document carries a
// CSS/SVG "SAMPLE" watermark on top. Nothing is saved or sent.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_DOCS, demoDocNames, useDemoState } from "@/lib/demo";

function useDocNames() {
  const s = useDemoState();
  return demoDocNames(s.first, s.last);
}

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

const DOC_SANS = 'Tahoma, Verdana, "Segoe UI", Arial, sans-serif';
const DOC_ARIAL = 'Arial, Helvetica, "Liberation Sans", sans-serif';
const DOC_SCRIPT = '"Kaushan Script", "Segoe Script", "Brush Script MT", cursive';

type Patch = { x: number; y: number; w: number; h: number; fill: string; soft?: boolean };
type Line = { field: string; text: string; x: number; y: number; size: number; max: number; family: string; weight?: number; fill: string; anchor?: "start" | "middle" };
type Rule = { x1: number; y1: number; x2: number; y2: number; width: number; stroke: string };
type Layout = { w: number; h: number; patches: Patch[]; rules?: Rule[]; lines: Line[] };

/** Where the name sits on each image, in the image's own pixels (the SVG viewBox
 *  scales it with the image, so the same numbers work in thumbnails and the large
 *  view). Each patch covers only the original name, in the local background colour. */
function nameLayout(kind: DemoDocKind, side: "front" | "back", n: ReturnType<typeof demoDocNames>): Layout | null {
  if (kind === "license" && side === "front") return {
    w: 335, h: 225,
    patches: [{ x: 31, y: 147, w: 73, h: 25.5, fill: "rgb(211,223,222)", soft: true }],
    lines: [
      { field: "license-last", text: n.last.toUpperCase(), x: 36, y: 156.6, size: 11, max: 64, family: DOC_SANS, weight: 700, fill: "#000" },
      { field: "license-first", text: n.first.toUpperCase(), x: 36, y: 170.6, size: 11, max: 64, family: DOC_SANS, weight: 700, fill: "#000" },
    ],
  };
  if (kind === "registration") return {
    w: 585, h: 293,
    patches: [{ x: 40, y: 118, w: 150, h: 13, fill: "#fff" }],
    lines: [{ field: "registration-name", text: n.full, x: 43, y: 128.6, size: 10.6, max: 142, family: DOC_SANS, fill: "#000" }],
  };
  if (kind === "commercial") return {
    w: 250, h: 159,
    patches: [{ x: 107, y: 74, w: 120, h: 9.5, fill: "#fff" }],
    lines: [{ field: "commercial-insured", text: n.full, x: 109, y: 81.7, size: 8.3, max: 114, family: DOC_ARIAL, fill: "rgb(100,100,100)" }],
  };
  if (kind === "entity") return {
    w: 540, h: 393,
    patches: [
      { x: 219, y: 251, w: 144, h: 14, fill: "#fff" },
      { x: 150, y: 268, w: 222, h: 13, fill: "#fff" },
      { x: 65, y: 337, w: 104, h: 17, fill: "rgb(218,218,218)", soft: true },
      { x: 384, y: 340.5, w: 92, h: 17.5, fill: "rgb(217,217,217)", soft: true },
    ],
    // The underlines and signature lines, redrawn where the patches cross them
    // (the bottoms of the original letters sit on these lines).
    rules: [
      { x1: 219, y1: 263.5, x2: 363, y2: 263.5, width: 1, stroke: "rgb(213,213,213)" },
      { x1: 219, y1: 264.5, x2: 363, y2: 264.5, width: 1, stroke: "rgb(170,170,170)" },
      { x1: 150, y1: 279.5, x2: 372, y2: 279.5, width: 1, stroke: "rgb(210,210,210)" },
      { x1: 150, y1: 280.5, x2: 372, y2: 280.5, width: 1, stroke: "rgb(173,173,173)" },
      { x1: 64, y1: 350.7, x2: 170, y2: 353.2, width: 1.8, stroke: "rgb(165,165,165)" },
      { x1: 383, y1: 355.4, x2: 477, y2: 356, width: 2, stroke: "rgb(168,168,168)" },
    ],
    lines: [
      { field: "entity-owner", text: n.full, x: 285, y: 261.6, size: 10, max: 128, family: DOC_ARIAL, weight: 700, fill: "#000", anchor: "middle" },
      { field: "entity-business", text: n.entity, x: 261, y: 278.4, size: 10, max: 212, family: DOC_ARIAL, weight: 700, fill: "#000", anchor: "middle" },
      { field: "entity-signature", text: n.full, x: 117, y: 349, size: 13.5, max: 94, family: DOC_SCRIPT, fill: "#111", anchor: "middle" },
      { field: "entity-cosigner", text: n.coSigner, x: 430, y: 353.4, size: 13.5, max: 82, family: DOC_SCRIPT, fill: "#111", anchor: "middle" },
    ],
  };
  return null;
}

/** One line of the name, shrunk (font size) until it fits its patch. Re-fits once web fonts load. */
function FitText({ line }: { line: Line }) {
  const ref = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fit by the advance width (it scales exactly with the font size, unlike the
    // drawn box at thumbnail sizes); line.max leaves room for glyph overhang and slant.
    const fit = () => {
      el.setAttribute("font-size", String(line.size));
      const w = el.getComputedTextLength();
      if (w > line.max) el.setAttribute("font-size", String((line.size * line.max * 0.96) / w));
    };
    fit();
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) fit(); });
    document.fonts?.addEventListener?.("loadingdone", fit);
    return () => { alive = false; document.fonts?.removeEventListener?.("loadingdone", fit); };
  }, [line.text, line.size, line.max, line.family]);
  return (
    <text
      ref={ref}
      data-testid="doc-name"
      data-field={line.field}
      data-max={line.max}
      x={line.x}
      y={line.y}
      fontSize={line.size}
      fontFamily={line.family}
      fontWeight={line.weight ?? 400}
      fill={line.fill}
      textAnchor={line.anchor ?? "start"}
    >
      {line.text}
    </text>
  );
}

/** The signatures use a handwriting web font, loaded only when the entity document is shown. */
function useSignatureFont(on: boolean) {
  useEffect(() => {
    if (!on || document.getElementById("demo-signature-font")) return;
    const l = document.createElement("link");
    l.id = "demo-signature-font";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Kaushan+Script&display=swap";
    document.head.appendChild(l);
  }, [on]);
}

/** The visitor's name laid over the document image (same box as the object-contain image). */
function NameOverlay({ kind, side }: { kind: DemoDocKind; side: "front" | "back" }) {
  const names = useDocNames();
  useSignatureFont(kind === "entity");
  const soft = `doc-soft-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const l = nameLayout(kind, side, names);
  if (!l) return null;
  return (
    <svg
      data-testid="doc-name-overlay"
      viewBox={`0 0 ${l.w} ${l.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      aria-hidden="true"
    >
      <defs>
        <filter id={soft} x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="0.6" /></filter>
      </defs>
      {l.patches.map((p, i) => (
        <rect key={i} data-testid="doc-patch" x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} filter={p.soft ? `url(#${soft})` : undefined} />
      ))}
      {l.rules?.map((r, i) => <line key={`r${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} strokeWidth={r.width} stroke={r.stroke} />)}
      {l.lines.map((line) => <FitText key={line.field} line={line} />)}
    </svg>
  );
}

/** The Business Liability card, drawn in code in the style of the Acme insurance card. */
export function BusinessLiabilityCard({ className }: { className?: string }) {
  const b = DEMO_DOCS.businessLiability;
  const names = useDocNames();
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
        <div><span className="font-bold">INSURED:</span> <span data-testid="doc-name" data-field="bizliab-insured">{names.entity}</span></div>
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
      {src && <NameOverlay kind={kind} side={side} />}
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
  const names = useDocNames();
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
              <div className="text-xs text-muted-foreground">Sample document · {names.full}</div>
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
