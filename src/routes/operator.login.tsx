import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "./login";

// Operator sign-in inside the Operator app's scope (/operator/), so the
// installed Operator app never leaves it. Same page as /login.
export const Route = createFileRoute("/operator/login")({
  head: () => ({ meta: [{ title: "Sign in — SOLO.drive" }] }),
  component: LoginPage,
});
