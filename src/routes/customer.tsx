import { createFileRoute } from "@tanstack/react-router";
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
      <SmartRateBooking layout="split" onRequestDownload={openPopup} />
    </AppShell>
  );
}
