import { createFileRoute } from "@tanstack/react-router";
import { AppStartScreen } from "@/components/AppStartScreen";

// The installed Customer app's start screen (its manifest start_url).
export const Route = createFileRoute("/customer/start")({
  head: () => ({ meta: [{ title: "SOLO.drive Customer" }] }),
  component: () => <AppStartScreen kind="customer" />,
});
