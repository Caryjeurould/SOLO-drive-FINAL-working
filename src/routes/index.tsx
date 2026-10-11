import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useDownloadPopup } from "@/components/DownloadPopupProvider";
import { AppShell } from "@/components/AppShell";
import { BrandText } from "@/components/BrandText";
import { SmartRateBooking } from "@/components/SmartRateBooking";
import {
  ArrowRight, ShieldCheck, Gauge, Sparkles, Building2, Truck, FileSignature, DollarSign,
} from "lucide-react";
import { useOnboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const openDownloads = search.openDownloads === true || search.openDownloads === "true";
    // Only include the key when true — an always-present key (even `false`)
    // makes TanStack Router treat a bare "/" as needing a canonical-URL
    // redirect to "/?openDownloads=false" on every single homepage hit.
    return openDownloads ? { openDownloads: true as const } : {};
  },
  head: () => ({
    meta: [
      { title: "SOLO.drive — The Independent Operator Platform" },
      { name: "description", content: "Run your own taxi or delivery business. Zero commission. Flat monthly fee. Smart+Rate™ AI pricing built in." },
      { property: "og:title", content: "SOLO.drive — Independent Operator PWA" },
      { property: "og:description", content: "A business-in-a-box for solo drivers. No middleman. No per-ride cuts." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [onb] = useOnboarding();
  // Customer section: has the visitor opened and closed the Verify popup yet?
  const [riderVerified, setRiderVerified] = useState(false);
  const { openDownloads = false } = Route.useSearch();
  const { openPopup } = useDownloadPopup();
  // ?openDownloads=true (e.g. the redirect from /operator/onboarding) opens the
  // shared Downloads pop-up right away.
  useEffect(() => {
    if (openDownloads) openPopup();
  }, [openDownloads, openPopup]);

  // The page scrolls on <html>, so snapping has to be enabled there — and only
  // while the homepage is mounted, so other routes keep normal scrolling.
  // scroll-padding-top offsets snap points by the sticky nav's height so each
  // section snaps just below the nav instead of underneath it.
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector("header");
    const prevType = root.style.scrollSnapType;
    const prevPadding = root.style.scrollPaddingTop;
    root.style.scrollSnapType = "y mandatory";
    root.style.scrollPaddingTop = `${header?.offsetHeight ?? 0}px`;

    // Arriving with a section hash (/#operator, /#rider) — from a nav shortcut
    // on another page, or a direct link — land on that section here, once the
    // padding above exists. (A router scroll before this point would land a
    // nav-height off; AppShell's shortcuts skip it for that reason.)
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    const frame = target ? requestAnimationFrame(() => target.scrollIntoView({ block: "start" })) : 0;

    return () => {
      cancelAnimationFrame(frame);
      root.style.scrollSnapType = prevType;
      root.style.scrollPaddingTop = prevPadding;
    };
  }, []);

  // Defaults to dark on first render (server and client agree, so no hydration
  // mismatch) then randomizes client-side after mount — "random per page load"
  // without the server/client disagreeing on the very first paint.
  const [heroVariant, setHeroVariant] = useState<"light" | "dark">("dark");
  useEffect(() => {
    setHeroVariant(Math.random() < 0.5 ? "light" : "dark");
  }, []);

  const operatorTo = onb.status === "approved" ? "/operator" : "/operator/onboarding";
  const operatorLabel = onb.status === "approved" ? "Operator Dashboard" : onb.status === "in_progress" ? "Resume Onboarding" : "Become an Operator";

  const isLight = heroVariant === "light";
  const now = new Date();
  const dashboardHeader = `${now.toLocaleDateString("en-US", { weekday: "long" })} · ${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()} · Dashboard`;
  const hoursThisWeek = 42.7;
  const hoursCap = 50;

  return (
    <AppShell>

      {/* Short (laptop-height) screens get tighter vertical spacing so the
          whole hero — with its long marketplace paragraph — fits on one
          screen under the nav; taller screens keep the original spacing. */}
      <section id="operator" className="snap-start relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28 [@media(min-width:768px)_and_(min-height:881px)_and_(max-height:960px)]:py-20 [@media(min-width:768px)_and_(max-height:880px)]:py-8">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary-glow">
                <Sparkles className="h-3 w-3" /> Zero commission · Flat $499.99 / month
              </span>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl [@media(min-width:768px)_and_(max-height:880px)]:text-[3.5rem]">
                Your fleet of one.<br />
                <span className="text-gradient">Owned, not rented.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-[15px] leading-[1.6] text-muted-foreground md:text-base md:leading-[1.65]">
                SOLO.drive is a digital marketplace &amp; technology platform and does not provide transportation or delivery services. Independent Operators pay a monthly access fee to operate their app-based businesses, which connect directly with Customers who request specific transportation &amp; delivery services. Both parties agree that each transaction is its own separate Contracted Services Agreement&nbsp;(CSA).
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/operator/download"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
                >
                  Download Now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
                <Stat value="0%" label="Commission" />
                <Stat value="50h" label="Weekly cap" />
                <Stat value="$499.99" label="Per month" />
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute -inset-8 bg-gradient-primary opacity-20 blur-3xl" />
              {/* Framed like a cropped phone screen — rounded top edge, bezel
                  border on top/sides only, no bottom bezel or dead space below
                  the content so it reads as a mid-screen crop, not a full card. */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-t-[2.5rem] border-t-2 border-x-2 pb-3 pt-6 px-6 backdrop-blur-2xl shadow-elevated animate-float",
                  isLight ? "border-neutral-300 bg-white/95" : "border-border/70 bg-card/80",
                )}
              >
                <div className={cn("text-[11px] uppercase tracking-widest", isLight ? "text-neutral-500" : "text-muted-foreground")}>
                  {dashboardHeader}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary font-display text-lg font-semibold text-primary-foreground">
                    M
                  </div>
                  <div className="leading-tight">
                    <div className={cn("font-medium", isLight ? "text-neutral-900" : "text-foreground")}>Marcus Rogers</div>
                    <div className={cn("text-xs", isLight ? "text-neutral-500" : "text-muted-foreground")}>
                      Toyota Camry '20 · Rogers Transport LLC
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={isLight ? "text-neutral-500" : "text-muted-foreground"}>Commercial ins</span>
                    <span className={cn("font-semibold", isLight ? "text-green-600" : "text-green-400")}>Valid</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={isLight ? "text-neutral-500" : "text-muted-foreground"}>Indemnity ins</span>
                    <span className={cn("font-semibold", isLight ? "text-green-600" : "text-green-400")}>Valid</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className={isLight ? "text-neutral-500" : "text-muted-foreground"}>Declared shift</span>
                  <span className={isLight ? "text-neutral-900" : "text-foreground"}>3:00am – 3:00pm</span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className={isLight ? "text-neutral-500" : "text-muted-foreground"}>Hours this week</span>
                    <span className={isLight ? "text-neutral-900" : "text-foreground"}>{hoursThisWeek} / {hoursCap}h cap</span>
                  </div>
                  <div className={cn("mt-1.5 h-1.5 w-full overflow-hidden rounded-full", isLight ? "bg-neutral-200" : "bg-muted")}>
                    <div
                      className={cn("h-full", isLight ? "bg-green-600" : "bg-green-400")}
                      style={{ width: `${(hoursThisWeek / hoursCap) * 100}%` }}
                    />
                  </div>
                  <div className={cn("mt-1 text-[10px]", isLight ? "text-neutral-500" : "text-muted-foreground")}>
                    {(hoursCap - hoursThisWeek).toFixed(1)}h remaining before weekly cap
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", isLight ? "text-neutral-900" : "text-foreground")}>$1,375.00</span>
                  <span className={isLight ? "text-xs text-neutral-500" : "text-xs text-muted-foreground"}>this week</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", isLight ? "text-amber-600/80" : "text-amber-300/80")}>$71,500.00</span>
                  <span className={isLight ? "text-xs text-neutral-500" : "text-xs text-muted-foreground"}>YTD earnings</span>
                </div>

                <div className="mt-4 flex justify-center">
                  <button className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-500">
                    Go online
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marketplace model */}
      <section className="snap-start border-t-2 border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 pt-12 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              How SOLO.drive is Different
            </h2>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              SOLO.drive is a technology marketplace, not a transportation company — it facilitates a series of
              direct contracts between independent Operators and Customers, each ride and/or delivery a separate
              agreement.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-6xl px-4 pb-20 md:px-8 md:pb-28">
          <div className="grid auto-rows-fr gap-x-6 gap-y-4 sm:grid-cols-3">
            <Pillar
              align="left"
              size="lg"
              className="min-h-0 pb-6"
              icon={<Building2 className="h-5 w-5" />}
              title="Entity Declaration"
              body="An Operator must operate as a registered business entity (LLC, C-Corp, S-Corp), and not as an individual gig worker."
            />
            <Pillar
              align="left"
              size="lg"
              className="min-h-0 pb-6"
              icon={<ShieldCheck className="h-5 w-5" />}
              title="(Bus) Indemnity Ins"
              body="An Operator is required to maintain $500,000–$1,000,000 Indemnity coverage that protects their individual business or entity to operate on SOLO.drive."
            />
            <Pillar
              align="left"
              size="lg"
              className="min-h-0 pb-6"
              icon={<Truck className="h-5 w-5" />}
              title="(Comm) Vehicle Ins"
              body="An Operator must maintain their state's minimum commercial vehicle insurance requirements to operate their business on the SOLO.drive platform."
            />
            <Pillar
              align="left"
              size="lg"
              className="min-h-0 pb-6"
              icon={<FileSignature className="h-5 w-5" />}
              title="Contracted Svs Agreement (CSA)"
              body="SOLO.drive requires each Operator to acknowledge and agree to the Contracted Svs Agreement (CSA), which states that every transaction is its own separate contract."
            />
            <Pillar
              align="left"
              size="lg"
              className="min-h-0 pb-6"
              icon={<Gauge className="h-5 w-5" />}
              title="Operator Rules & Guardrails"
              body="SOLO.drive requires Operators to follow built-in operational & safety rules — a monthly subscription gate, a 50-hour weekly cap, and a 'Go Online' switch that logs their active hours."
            />
            <Pillar
              align="left"
              size="lg"
              className="min-h-0 pb-6"
              icon={<Sparkles className="h-5 w-5" />}
              title="Smart+Rate™ Pricing"
              body="SOLO.drive's proprietary Smart+Rate™ Pricing — Distance, fuel index, peak hours, weekends, and special events offer a competitive, non-negotiable price both sides see up front — Operators keep 100%."
            />
          </div>
        </div>
      </section>

      {/* Customer hero */}
      {/* Same short-screen spacing tiers as the Operator hero, so the section
          (with the Where-To card) fits one laptop-height screen. */}
      <section id="rider" className="snap-start relative overflow-hidden border-t-2 border-border bg-gradient-hero">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28 [@media(min-width:768px)_and_(min-height:881px)_and_(max-height:960px)]:py-20 [@media(min-width:768px)_and_(max-height:880px)]:py-8">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              {/* One line each, as written. Sized to match the Operator hero
                  heading where the column allows it, otherwise the largest size
                  at which "with Smart+Rate™ pricing." (~11.2× the font size wide)
                  still fits on one line: phones scale with the screen; sm 48px
                  and md 60px (Operator: 48 / 72); lg
                  42px and xl 54px, limited by the 478px / 612px column. */}
              <h2 className="font-display text-[clamp(1.25rem,calc((100vw-2rem)/11.5),3rem)] font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-[2.625rem] xl:text-[3.375rem]">
                <span className="block whitespace-nowrap">Ownership Matters.</span>
                <span className="block whitespace-nowrap text-gradient">Operator owned,</span>
                <span className="block whitespace-nowrap text-gradient">with Smart+Rate™ pricing.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-[1.6] text-muted-foreground md:text-base md:leading-[1.65]">
                SOLO.drive empowers Operators to take ownership of their own transportation &amp; delivery businesses. A Customer who needs transportation or delivery can use the SOLO.drive platform to request service directly from an Operator.
              </p>
              <ul className="mt-4 max-w-2xl space-y-2 text-[15px] leading-[1.55] text-muted-foreground md:text-base">
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-glow" />
                  <span><strong className="font-semibold text-foreground">Direct contracting:</strong> Connect directly with local, independent transportation and delivery business owners.</span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-glow" />
                  <span><strong className="font-semibold text-foreground">Upfront pricing:</strong> Review and agree to a transparent price for your specific service request before booking.</span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-glow" />
                  <span><strong className="font-semibold text-foreground">Independent choice:</strong> Benefit from a competitive marketplace of independent Operators.</span>
                </li>
              </ul>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/customer/download"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
                >
                  Download Now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
              <p className="mt-4 max-w-2xl text-xs italic leading-relaxed text-muted-foreground/80">
                Operators and Customers also agree that any disputes will be resolved through third-party mediation. SOLO.drive has no affiliation with, direction of, or financial responsibility for that mediation.
              </p>
            </div>

            {/* Guided flow: the display-only Where-To card with a flashing
                Verify; once its popup closes, the Book-A-Ride map card (at its
                original max-w-sm width) with a flashing Book-A-Ride button. */}
            {riderVerified ? (
              <div className="mx-auto w-full max-w-sm">
                <SmartRateBooking layout="preview" ctaAttention />
              </div>
            ) : (
              <div className="w-full">
                <SmartRateBooking layout="intro" onVerifyClose={() => setRiderVerified(true)} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Why book with SOLO.drive */}
      <section className="snap-start border-t-2 border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Why Book with SOLO.drive
            </h2>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              Every trip or delivery is its own Contracted Services Agreement with a verified independent
              Operator, with transparent pricing and no surprises.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-20 md:px-8 md:pb-28">
          <div className="grid gap-6 sm:grid-cols-3">
            <Pillar
              icon={<DollarSign className="h-5 w-5" />}
              title="Transparent Pricing"
              body="See your Smart+Rate™ price with every line item, and agree to it before you book."
              size="lg"
            />
            <Pillar
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Verified Operators"
              body="Each Operator's insurance and credentials are checked and visible before you confirm."
              size="lg"
            />
            <Pillar
              icon={<Sparkles className="h-5 w-5" />}
              title="No Surge Surprises"
              body="Your price is locked once you agree. Anything that affects it is shown up front, never added later."
              size="lg"
            />
          </div>
        </div>
      </section>

    </AppShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Pillar({
  icon,
  title,
  body,
  size = "sm",
  align = "center",
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  size?: "sm" | "lg";
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col items-center rounded-2xl border border-border bg-gradient-surface text-center shadow-card transition-transform hover:-translate-y-1",
        size === "lg" ? "min-h-[320px] p-8" : "min-h-[280px] p-6",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">{icon}</div>
      <h3 className={cn("mt-4 font-display text-xl font-semibold", align === "left" && "self-stretch text-left")}>
        <BrandText>{title}</BrandText>
      </h3>
      {body && (
        <p className={cn("mt-2 text-sm text-muted-foreground", align === "left" && "self-stretch text-left")}><BrandText>{body}</BrandText></p>
      )}
    </div>
  );
}
