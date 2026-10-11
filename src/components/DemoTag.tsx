import { cn } from "@/lib/utils";

/** The small "Demo" label on every screen of the visitor demo. */
export function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-warning", className)}>
      Demo
    </span>
  );
}
