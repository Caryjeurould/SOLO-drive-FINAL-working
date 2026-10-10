import { createFileRoute } from "@tanstack/react-router";
import { InstallAppPage } from "@/components/InstallAppPage";

export const Route = createFileRoute("/customer/download")({
  head: () => ({ meta: [{ title: "Get the Customer App — SOLO.drive" }] }),
  component: () => <InstallAppPage kind="customer" />,
});
