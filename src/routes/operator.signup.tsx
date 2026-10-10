import { createFileRoute } from "@tanstack/react-router";
import { SignupPage } from "./signup";

// Operator account creation inside the Operator app's scope (/operator/), so
// the installed Operator app never leaves it. Same page as /signup.
export const Route = createFileRoute("/operator/signup")({
  head: () => ({ meta: [{ title: "Create account — SOLO.drive" }] }),
  component: SignupPage,
});
