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
import { AuthProvider } from "@/lib/auth";
import { DownloadPopupProvider } from "@/components/DownloadPopupProvider";
import { registerServiceWorker, getInstalledAppKind, appRedirectFor } from "@/lib/pwa";
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
          <Outlet />
        </DownloadPopupProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
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
