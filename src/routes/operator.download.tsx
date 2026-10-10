import { createFileRoute } from "@tanstack/react-router";
import { InstallAppPage } from "@/components/InstallAppPage";

export const Route = createFileRoute("/operator/download")({
  head: () => ({ meta: [{ title: "Get the Operator App — SOLO.drive" }] }),
  component: () => <InstallAppPage kind="operator" />,
});
