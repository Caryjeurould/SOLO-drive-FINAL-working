import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SmartRateBooking } from "@/components/SmartRateBooking";
import { DownloadPopup } from "@/components/DownloadPopup";
import { useIdleDownloadPopup } from "@/hooks/useIdleDownloadPopup";

export const Route = createFileRoute("/customer")({
  head: () => ({
    meta: [
      { title: "Book a Ride — SOLO.drive" },
      { name: "description", content: "Transparent Smart Rate pricing. Verified independent operators. No surprises." },
    ],
  }),
  component: CustomerBooking,
});

function CustomerBooking() {
  const { showPopup, openPopup, closePopup, markShown } = useIdleDownloadPopup();

  return (
    <AppShell onDownloadPopupOpen={markShown}>
      {showPopup && <DownloadPopup onClose={closePopup} />}

      {/* Mirrors the homepage's "Customer hero" (src/routes/index.tsx) — same
          classes and copy — with the display-only Where-To card on the right.
          No top border: here it sits directly under the nav, not under another section. */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary-glow">
                <Sparkles className="h-3 w-3" /> Zero commission · Flat $499.99 / month
              </span>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
                Your fleet of one.<br />
                <span className="text-gradient">Owned, not rented.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
                SOLO.drive is the plug-and-play platform for independent taxi and delivery operators.
                No per-ride commissions. Transparent Smart Rate pricing. Verified credentials your customers can actually see.
              </p>
            </div>

            <div className="w-full">
              <SmartRateBooking layout="intro" onRequestDownload={openPopup} />
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
