import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Car, Map, ShieldCheck, FileLock2, Gauge, LogIn, LogOut, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { DownloadPopup } from "@/components/DownloadPopup";

export function AppShell({
  children,
  onDownloadPopupOpen,
}: {
  children: React.ReactNode;
  /** Called when the nav opens the Download popup, so a page's idle timer
   *  can treat it as already shown (see useIdleDownloadPopup). */
  onDownloadPopupOpen?: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const openPopup = () => {
    onDownloadPopupOpen?.();
    setShowPopup(true);
  };
  const isOperator = pathname.startsWith("/operator");
  const isCustomer = pathname.startsWith("/customer");

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const handleOperatorClick = (e: React.MouseEvent) => {
    if (!user) { e.preventDefault(); openPopup(); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showPopup && <DownloadPopup onClose={() => setShowPopup(false)} />}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative h-9 w-9 shrink-0">
              <div className="relative h-9 w-9 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
                <Car className="h-4 w-4 text-primary-foreground" />
              </div>
              {/* Back-arrow chip — all the "clickable" attention lives here now:
                  a brief scale+brightness flash every few seconds, badge stays static. */}
              <div
                aria-hidden="true"
                className="animate-chip-flash pointer-events-none absolute -bottom-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-primary ring-2 ring-background"
              >
                <ArrowLeft className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={2.5} />
              </div>
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold tracking-tight">SOLO<span className="text-gradient">.drive</span></div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Independent Operator</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm">
            <button
                onClick={openPopup}
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              >
                <Gauge className="h-4 w-4" /> Operator
              </button>
            <Link
              to="/customer"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                isCustomer ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
              )}
            >
              <Map className="h-4 w-4" /> Rider
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Network Live
            </span>
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/50"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Sign out</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/50"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden md:inline">Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 mt-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Zero commission</span>
            <span className="flex items-center gap-1.5"><FileLock2 className="h-3.5 w-3.5" /> Verified operators</span>
          </div>
          <div>© SOLO.drive — Built for independent operators.</div>
        </div>
      </footer>
    </div>
  );
}
