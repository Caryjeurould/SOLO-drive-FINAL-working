// Visitor demo only: the Contracted Services Agreement behind one of the demo
// week's rides or deliveries. Everything is derived from the fixed DEMO_JOBS
// entry; nothing is saved, stored or sent anywhere.
import { useEffect, useRef, useState } from "react";
import { FileSignature, X } from "lucide-react";
import { BrandText } from "@/components/BrandText";
import type { DemoJob } from "@/lib/demo";

const AUTO_CLOSE_MS = 5000;
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CUSTOMERS = [
  "Avery Sample", "Jordan Demo", "Casey Example", "Riley Mock", "Morgan Testwell", "Quinn Placeholder",
  "Harper Fictional", "Rowan Samplesby", "Jamie Demoford", "Skyler Mockton", "Emerson Examply", "Taylor Pretendo",
];

/** A stable hash of the job, so the same job always gets the same number and customer. */
function jobHash(job: DemoJob) {
  let h = 2166136261;
  for (const ch of `${job.when}|${job.kind}|${job.from}|${job.to}|${job.miles}|${job.fare}|${job.minutes}`) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  }
  return h;
}

/** "MR-5047XF-6152" */
export function csaReference(job: DemoJob) {
  const h = jobHash(job);
  const h2 = Math.imul(h ^ 0x9e3779b9, 2654435761) >>> 0;
  const d1 = String(h % 10000).padStart(4, "0");
  const d2 = String(h2 % 10000).padStart(4, "0");
  const l = LETTERS[(h >>> 14) % LETTERS.length] + LETTERS[(h2 >>> 14) % LETTERS.length];
  return `MR-${d1}${l}-${d2}`;
}

export function csaCustomer(job: DemoJob) {
  const name = CUSTOMERS[(jobHash(job) >>> 7) % CUSTOMERS.length];
  const [first, last] = name.split(" ");
  return `${first} ${last[0]}.`;
}

export function CsaPopup({ job, operator, onClose }: { job: DemoJob; operator: string; onClose: () => void }) {
  // Auto-close after 5s; holding the pop-up pauses it, releasing restarts from 5s.
  const [held, setHeld] = useState(false);
  const [left, setLeft] = useState(1); // fraction of the 5s still to go
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (held) return;
    setLeft(1);
    let elapsed = 0;
    const t = window.setInterval(() => {
      elapsed += 50;
      const f = 1 - elapsed / AUTO_CLOSE_MS;
      if (f <= 0) {
        window.clearInterval(t);
        onClose();
      } else setLeft(f);
    }, 50);
    return () => window.clearInterval(t);
  }, [held, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hold = () => setHeld(true);
  const release = () => setHeld(false);

  return (
    <div
      data-testid="csa-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csa-title"
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-elevated"
        onPointerDown={hold}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        <div className="overflow-y-auto overscroll-contain p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="csa-title" className="font-display text-lg font-semibold leading-tight">Contracted Services Agreement</h2>
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
          <div data-testid="csa-ref" className="font-mono text-xs text-muted-foreground">#{csaReference(job)}</div>

          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-glow">
              <FileSignature className="h-3 w-3" /> Contracted Services
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Operator</dt>
              <dd data-testid="csa-operator">{operator}</dd>
              <dt className="text-muted-foreground">Customer</dt>
              <dd>{csaCustomer(job)}</dd>
              <dt className="text-muted-foreground">Services</dt>
              <dd>{job.kind}</dd>
              <dt className="text-muted-foreground">From</dt>
              <dd>{job.from}</dd>
              <dt className="text-muted-foreground">To</dt>
              <dd>{job.to}</dd>
              <dt className="text-muted-foreground">When</dt>
              <dd>{job.when}</dd>
              <dt className="text-muted-foreground">Distance</dt>
              <dd>{job.miles.toFixed(1)} mi · {job.minutes} min</dd>
            </dl>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground"><BrandText>Smart+Rate™ fare</BrandText></span>
              <span data-testid="csa-fare" className="font-display text-xl font-semibold">${job.fare.toFixed(2)}</span>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
            SOLO.drive is a technology platform and is not a party to this agreement.
          </p>
        </div>

        <div className="h-1 w-full shrink-0 bg-muted" aria-hidden="true">
          <div data-testid="csa-countdown" className="h-full bg-gradient-primary" style={{ width: `${left * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
