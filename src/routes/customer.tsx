import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SmartRateBooking } from "@/components/SmartRateBooking";
import { useDownloadPopup } from "@/components/DownloadPopupProvider";

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
  const { openPopup } = useDownloadPopup();

  return (
    <AppShell>
      <SmartRateBooking layout="split" onRequestDownload={openPopup} />
    </AppShell>
  );
}
