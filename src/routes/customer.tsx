import { createFileRoute, Outlet, useChildMatches } from "@tanstack/react-router";
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
  // File-based routing makes /customer the parent of /customer/login,
  // /customer/dashboard, /customer/signup and /customer/trip. Those pages draw
  // their own full layout, so when one of them is active, show only it.
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;

  return (
    <AppShell>
      <SmartRateBooking layout="split" onRequestDownload={openPopup} />
    </AppShell>
  );
}
