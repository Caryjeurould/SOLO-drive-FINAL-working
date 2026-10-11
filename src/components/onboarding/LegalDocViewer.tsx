import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function LegalDocViewer({
  title,
  body,
  expectedName,
  signed,
  onSign,
  demo = false,
}: {
  title: string;
  body: string;
  expectedName: string;
  signed?: { name: string; signature: string; signedAt: string };
  onSign: (sig: { name: string; signature: string; signedAt: string }) => void;
  /** Visitor demo: the document comes already signed, and the signature line
   *  shows the visitor's name (name only, no date). */
  demo?: boolean;
}) {
  const [scrolledEnd, setScrolledEnd] = useState(!!signed);
  const [sig, setSig] = useState(signed?.signature ?? "");
  const ref = useRef<HTMLDivElement>(null);

  // Short documents don't overflow the box, so there's nothing to scroll and
  // onScroll never fires — without this, signing stays permanently blocked.
  // Re-checked when the box changes size (e.g. the phone is rotated).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => { if (el.scrollHeight - el.clientHeight < 16) setScrolledEnd(true); };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [body]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 16) setScrolledEnd(true);
  };

  const canSign = scrolledEnd && sig.trim().length > 1 && sig.trim().toLowerCase() === expectedName.trim().toLowerCase();

  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-card", signed ? "border-success/30" : "border-border")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary-glow" />
          <h4 className="font-display text-base">{title}</h4>
        </div>
        {signed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[10px] uppercase tracking-widest text-success">
            <CheckCircle2 className="h-3 w-3" /> Signed
          </span>
        ) : (
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Read & sign
          </span>
        )}
      </div>

      <div
        ref={ref}
        onScroll={onScroll}
        className="mt-4 h-40 overflow-y-auto rounded-xl border border-border bg-background/40 p-4 text-xs leading-relaxed text-muted-foreground"
      >
        {body}
      </div>

      {signed && demo && (
        <div className="mt-3 flex items-baseline gap-2 border-b border-border pb-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Signed</span>
          <span className="font-display italic">{expectedName}</span>
        </div>
      )}

      {!signed && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={sig}
            onChange={(e) => setSig(e.target.value)}
            placeholder={scrolledEnd ? `Type "${expectedName}" to sign` : "Scroll to the end to enable signing"}
            disabled={!scrolledEnd}
            className="flex-1 rounded-xl border border-border bg-input px-3 py-2.5 text-sm font-display italic placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            disabled={!canSign}
            onClick={() => onSign({ name: expectedName, signature: sig.trim(), signedAt: new Date().toISOString() })}
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm font-medium",
              canSign
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "cursor-not-allowed bg-muted text-muted-foreground/60",
            )}
          >
            Read & Sign
          </button>
        </div>
      )}
    </div>
  );
}
