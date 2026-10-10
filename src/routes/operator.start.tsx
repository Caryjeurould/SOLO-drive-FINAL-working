import { createFileRoute } from "@tanstack/react-router";
import { AppStartScreen } from "@/components/AppStartScreen";

// The installed Operator app's start screen (its manifest start_url).
export const Route = createFileRoute("/operator/start")({
  head: () => ({ meta: [{ title: "SOLO.drive Operator" }] }),
  component: () => <AppStartScreen kind="operator" />,
});
