import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SmartRateBooking } from "@/components/SmartRateBooking";
import { DownloadPopup } from "@/components/DownloadPopup";

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
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let shown = false;

    const resetTimer = () => {
      if (shown) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        shown = true;
        setShowPopup(true);
      }, 15000);
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"];
    activityEvents.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      activityEvents.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);

  return (
    <AppShell>
      {showPopup && <DownloadPopup onClose={() => setShowPopup(false)} />}
      <SmartRateBooking layout="split" onRequestDownload={() => setShowPopup(true)} />
    </AppShell>
  );
}
