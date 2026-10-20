// Which site password this visit was opened with. The password wall
// (server/middleware/password-wall.ts) verifies the signed, HttpOnly
// "solo-auth" cookie on every request and tells each page the result in the
// readable "solo-role" cookie: "admin" (APP_PASSWORD — the real site, as
// always) or "visitor" (VISITOR_PASSWORD — the Operator demo, with the
// database switched off). Shared with the middleware, so no "@/" imports here.
import { useSyncExternalStore } from "react";

export type SiteRole = "admin" | "visitor";

export const ROLE_COOKIE = "solo-role";

/** With a temporary access code (a visitor), the time left in this opening in
 *  ms, rewritten on every request; at the end the page reloads to the password
 *  page (see useCodeSessionEnd). */
export const CODE_LEFT_COOKIE = "solo-code-left";

let cached: SiteRole | null | undefined;

/** The role the server reported when this page loaded, or null on the server
 *  and wherever there's no password wall (the local dev server). Read once per
 *  page load, so editing the cookie afterwards changes nothing. */
export function getSiteRole(): SiteRole | null {
  if (typeof document === "undefined") return null;
  if (cached === undefined) {
    const m = document.cookie.match(/(?:^|;\s*)solo-role=(admin|visitor)(?:;|$)/);
    cached = m ? (m[1] as SiteRole) : null;
  }
  return cached;
}

export function isVisitor(): boolean {
  return getSiteRole() === "visitor";
}

const noSubscribe = () => () => {};

/** For rendering: false on the server and during hydration (so the HTML
 *  matches), then the real answer. */
export function useIsVisitor(): boolean {
  return useSyncExternalStore(noSubscribe, isVisitor, () => false);
}

/** Pages a visitor never sees, and where they go instead: the real sign-in and
 *  sign-up pages and the admin backend lead into the demo; the Customer app's
 *  real account pages lead to the Customer booking simulation. And the demo's
 *  name screen is for visitors only. Used by the password wall (full page
 *  loads) and by the app (in-app navigation). */
export function roleRedirectFor(role: SiteRole | null, pathname: string): string | null {
  const p = pathname.split("?")[0].toLowerCase().replace(/\/+$/, "") || "/";
  if (role === "visitor") {
    if (p === "/admin" || p.startsWith("/admin/")) return "/operator/start";
    if (["/login", "/signup", "/operator/login", "/operator/signup"].includes(p)) return "/operator/start";
    if (["/customer/login", "/customer/signup", "/customer/dashboard", "/customer/trip"].includes(p)) return "/customer";
    return null;
  }
  if (p === "/operator/demo") return "/operator/start";
  return null;
}
