import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider, useAuth, setAuthMessage, WRONG_APP_MESSAGE } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { DownloadPopupProvider } from "@/components/DownloadPopupProvider";
import { OpenOnPhone, useVisitorDemo } from "@/components/VisitorDemo";
import { registerServiceWorker, getInstalledAppKind, appRedirectFor, appForPath } from "@/lib/pwa";
import { getSiteRole, isVisitor, roleRedirectFor } from "@/lib/site-role";
import { useEffect, useRef } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Lovable Generated Project" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Lovable Generated Project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      // Installable app (PWA): status-bar color and iPhone home-screen mode.
      { name: "theme-color", content: "#040819" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Each app section (/operator, /customer) adds its own manifest, iPhone
      // icon and title — see appHead() in lib/pwa — never both.
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/operator-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
        {/* Catch the browser's one-time install prompt before the app's own
            JavaScript has loaded (it can fire that early); lib/pwa picks it up. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();var l=document.querySelector('link[rel=manifest]');window.__soloInstallPrompt=e;window.__soloInstallManifest=l?l.href:null;window.dispatchEvent(new Event('solo:installprompt'));});",
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Minimal service worker so browsers can install SOLO.drive (see public/sw.js).
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DownloadPopupProvider>
          <InstalledAppGuard />
          <RoleGuard />
          <AccountTypeGuard />
          <DemoOutlet />
        </DownloadPopupProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** The page, or — the visitor demo on a computer — only "open on your phone". */
function DemoOutlet() {
  return useVisitorDemo() ? <OpenOnPhone /> : <Outlet />;
}

/** Inside an installed app (Operator or Customer), keeps the visitor on that
 *  app's own pages: anything belonging to the other app — or to neither, like
 *  the homepage or /download — is replaced by this app's start screen. Runs
 *  after render, so it never affects server rendering; does nothing in a
 *  browser tab. */
function InstalledAppGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const firstRun = useRef(true);
  useEffect(() => {
    const initialLoad = firstRun.current;
    firstRun.current = false;
    const kind = getInstalledAppKind();
    if (!kind) return;
    const to = appRedirectFor(kind, pathname);
    if (!to || to === pathname) return;
    // A page opened directly (fresh load) may still be hydrating; switching
    // routes under it breaks the router, so do a plain page replace instead.
    // In-app clicks afterwards navigate normally.
    if (initialLoad) window.location.replace(to);
    else navigate({ to, replace: true });
  }, [pathname, navigate]);
  return null;
}

/** The same role rules the password wall applies to full page loads, for
 *  in-app navigation: a visitor (demo password) never reaches the real
 *  sign-in/sign-up pages or the admin backend, and only visitors reach the
 *  demo's name screen. */
function RoleGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  useEffect(() => {
    const role = getSiteRole();
    if (!role) return; // no password wall (local dev): nothing to enforce
    const to = roleRedirectFor(role, pathname);
    if (to) navigate({ to, replace: true });
  }, [pathname, navigate]);
  return null;
}

/** Account-type check for a session restored when an app opens (or that
 *  reaches the wrong pages): inside an installed app the account must be that
 *  app's type; in a browser tab, Operator pages need an Operator account (a
 *  Customer account must never reach anything Operator — Operators may use
 *  Customer pages). A wrong-type session is signed out right away and sent to
 *  that app's sign-in, which shows WRONG_APP_MESSAGE. Network errors never
 *  sign anyone out; only a definite wrong or missing type does. */
function AccountTypeGuard() {
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const checked = useRef<string | null>(null);
  useEffect(() => {
    if (isVisitor()) return; // the demo's pretend Operator has no real account
    if (!user) { checked.current = null; return; }
    const app = getInstalledAppKind();
    const required = app ?? (appForPath(pathname) === "operator" ? "operator" : null);
    if (!required) return;
    const key = `${user.id}:${required}`;
    if (checked.current === key) return;
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled || error || !data.user) return;
      const type = data.user.app_metadata?.account_type;
      if (type === required) { checked.current = key; return; }
      await signOut();
      setAuthMessage(WRONG_APP_MESSAGE);
      const to = required === "customer" ? "/customer/login" : app ? "/operator/login" : "/login";
      navigate({ to, replace: true });
    });
    return () => { cancelled = true; };
  }, [user, pathname, signOut, navigate]);
  return null;
}
