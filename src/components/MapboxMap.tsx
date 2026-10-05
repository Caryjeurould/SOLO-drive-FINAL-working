import { useEffect, useRef, useState } from "react";
import { Key, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type RouteData = { distanceMi: number; durationMin: number };

type Props = {
  className?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  onRouteData?: (d: RouteData) => void;
  animateDriver?: boolean;
  /** Changing this value (e.g. to Date.now()) scatters a fresh set of
   *  simulated nearby-driver dots near pickup, with one distinguished as the
   *  confirmed operator. Set to null/undefined to clear them. */
  nearbyDriversSeed?: number | null;
  /** Once a ride is confirmed, the trip is an exclusive contract with Marcus —
   *  other simulated nearby drivers are no longer relevant. When true, only
   *  Marcus's marker is drawn (the generic ones are skipped). */
  onlyConfirmedDriver?: boolean;
  /** fitBounds padding in px — the default (64) is tuned for /customer's
   *  520px map; pass a smaller explicit value for shorter map containers
   *  (e.g. the homepage preview card) so the same route doesn't get forced
   *  into a much more zoomed-out fit just because the container is shorter.
   *  Also accepts per-side values (e.g. extra bottom room for the Mapbox logo). */
  fitPadding?: number | { top: number; right: number; bottom: number; left: number };
};

const ENV_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string) || "";
const DEFAULT_CENTER: [number, number] = [-112.0740, 33.4484];

// ── Mapbox API helpers ─────────────────────────────────────────────────────

async function mbGeocode(query: string, token: string): Promise<[number, number] | null> {
  try {
    const r = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`,
    );
    const j = await r.json();
    return (j.features?.[0]?.center as [number, number]) ?? null;
  } catch {
    return null;
  }
}

async function mbDirections(a: [number, number], b: [number, number], token: string) {
  try {
    const r = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${a[0]},${a[1]};${b[0]},${b[1]}?access_token=${token}&geometries=geojson&overview=full`,
    );
    const j = await r.json();
    const route = j.routes?.[0];
    if (!route) return null;
    return {
      coords: route.geometry.coordinates as [number, number][],
      distanceMi: route.distance / 1609.34,
      durationMin: route.duration / 60,
    };
  } catch {
    return null;
  }
}

async function loadMapboxGL(token: string): Promise<any> {
  const w = window as any;
  if (!document.getElementById("mapbox-css")) {
    const link = document.createElement("link");
    link.id = "mapbox-css";
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.5.2/mapbox-gl.css";
    document.head.appendChild(link);
  }
  if (!w.mapboxgl) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://api.mapbox.com/mapbox-gl-js/v3.5.2/mapbox-gl.js";
      s.onload = () => res();
      s.onerror = () => rej(new Error("mapbox-gl failed to load"));
      document.head.appendChild(s);
    });
  }
  w.mapboxgl.accessToken = token;
  return w.mapboxgl;
}

function ensureDriverCSS() {
  if (document.getElementById("mb-driver-css")) return;
  const el = document.createElement("style");
  el.id = "mb-driver-css";
  el.textContent = `
    @keyframes mb-ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }
    .mb-ping { animation: mb-ping 1.1s cubic-bezier(0,0,.2,1) infinite; }
  `;
  document.head.appendChild(el);
}

// ── Component ──────────────────────────────────────────────────────────────

export function MapboxMap({
  className,
  pickupAddress,
  dropoffAddress,
  onRouteData,
  animateDriver = false,
  nearbyDriversSeed = null,
  onlyConfirmedDriver = false,
  fitPadding = 64,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const nearbyMarkersRef = useRef<any[]>([]);
  // Which seed value nearby-driver markers were last drawn for — lets the
  // effect below wait for pickupCoords without redrawing every time pickup
  // merely changes (that must stay cleared, not auto-redrawn, per address-
  // change behavior).
  const drawnForSeedRef = useRef<number | null>(null);
  const onRouteDataRef = useRef(onRouteData);
  onRouteDataRef.current = onRouteData;

  const [token, setToken] = useState<string>(() => {
    if (ENV_TOKEN && ENV_TOKEN !== "your_pk_token_here") return ENV_TOKEN;
    return typeof window !== "undefined"
      ? localStorage.getItem("MAPBOX_TOKEN") || ""
      : "";
  });
  const [tokenInput, setTokenInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);

  // ── 1. Initialize map ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    let map: any;

    (async () => {
      try {
        const mapboxgl = await loadMapboxGL(token);
        if (cancelled || !containerRef.current) return;

        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: DEFAULT_CENTER,
          zoom: 12,
          attributionControl: false,
          // Static route view: no drag/pan, pinch- or scroll-zoom, rotate, or
          // keyboard. Also means swipes over the map scroll the page on mobile
          // instead of panning the map. Programmatic fitBounds still works.
          interactive: false,
        });
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: [] },
            },
          });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#7c5cff", "line-width": 4, "line-opacity": 0.9 },
          });
        });
      } catch (e) {
        console.error("Mapbox init failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, [token]);

  // ── 2. Geocode addresses → fetch route → update markers + line ───────────
  useEffect(() => {
    if (!token || !pickupAddress?.trim() || !dropoffAddress?.trim()) return;
    let cancelled = false;

    const run = async () => {
      setGeocoding(true);
      try {
        const [pickup, dropoff] = await Promise.all([
          mbGeocode(pickupAddress, token),
          mbGeocode(dropoffAddress, token),
        ]);
        if (cancelled || !pickup || !dropoff) return;
        setPickupCoords(pickup);

        const route = await mbDirections(pickup, dropoff, token);
        if (cancelled) return;

        if (route) {
          routeCoordsRef.current = route.coords;
          onRouteDataRef.current?.({
            distanceMi: route.distanceMi,
            durationMin: route.durationMin,
          });
        }

        const applyToMap = () => {
          if (cancelled || !mapRef.current) return;
          const map = mapRef.current;
          const mapboxgl = (window as any).mapboxgl;

          // Replace markers
          markersRef.current.forEach((m) => m.remove());
          markersRef.current = [];

          const mkEl = (color: string, shadow: string) => {
            const el = document.createElement("div");
            el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 14px ${shadow};`;
            return el;
          };

          markersRef.current.push(
            new mapboxgl.Marker({ element: mkEl("#7c5cff", "rgba(124,92,255,0.8)") })
              .setLngLat(pickup)
              .addTo(map),
            new mapboxgl.Marker({ element: mkEl("#22d3ee", "rgba(34,211,238,0.8)") })
              .setLngLat(dropoff)
              .addTo(map),
          );

          // Update route line
          if (route && map.getSource("route")) {
            (map.getSource("route") as any).setData({
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: route.coords },
            });
          }

          // Fit viewport to both endpoints.
          const bounds = new mapboxgl.LngLatBounds(pickup, pickup).extend(dropoff);
          map.fitBounds(bounds, { padding: fitPadding, maxZoom: 15 });
        };

        const map = mapRef.current;
        if (map) {
          if (map.loaded()) applyToMap();
          else map.once("load", applyToMap);
        }
      } finally {
        if (!cancelled) setGeocoding(false);
      }
    };

    // Debounce 600 ms so we don't geocode on every keystroke
    const t = setTimeout(run, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, pickupAddress, dropoffAddress]);

  // ── 3. Animate driver marker along route (trip tracking page) ────────────
  useEffect(() => {
    if (!animateDriver || !token) return;
    ensureDriverCSS();

    let step = 0;
    let driverMarker: any = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      const map = mapRef.current;
      const mapboxgl = (window as any).mapboxgl;
      const coords = routeCoordsRef.current;
      if (!map || !mapboxgl || coords.length < 2) {
        setTimeout(start, 800);
        return;
      }

      const el = document.createElement("div");
      el.style.cssText = "position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center";
      el.innerHTML = `
        <div class="mb-ping" style="position:absolute;inset:0;border-radius:50%;background:rgba(124,92,255,0.45)"></div>
        <div style="position:relative;width:14px;height:14px;border-radius:50%;background:#7c5cff;box-shadow:0 0 14px rgba(124,92,255,0.9)"></div>
      `;

      driverMarker = new mapboxgl.Marker({ element: el })
        .setLngLat(coords[0])
        .addTo(map);

      // Move ~1/60th of the route per second so it reaches the end in ~60s
      const stride = Math.max(1, Math.floor(coords.length / 60));
      interval = setInterval(() => {
        step = Math.min(step + stride, coords.length - 1);
        driverMarker?.setLngLat(coords[step]);
        if (step >= coords.length - 1 && interval) clearInterval(interval);
      }, 1000);
    };

    const t = setTimeout(start, 1500);
    return () => {
      clearTimeout(t);
      if (interval) clearInterval(interval);
      driverMarker?.remove();
    };
  }, [animateDriver, token]);

  // ── 4. Simulated nearby drivers, with the confirmed operator distinguished ──
  // Waits for pickupCoords (set asynchronously by effect 2) rather than firing
  // once and giving up — nearbyDriversSeed can be set before geocoding has
  // resolved (e.g. on first mount), and this must draw once it's ready, not
  // silently do nothing forever. The drawnForSeedRef guard stops pickupCoords
  // alone (e.g. after an address change) from triggering an unwanted redraw —
  // that must stay cleared until a genuinely new seed (a fresh confirm) arrives.
  useEffect(() => {
    if (nearbyDriversSeed == null || !token) {
      nearbyMarkersRef.current.forEach((m) => m.remove());
      nearbyMarkersRef.current = [];
      drawnForSeedRef.current = null;
      return;
    }
    if (drawnForSeedRef.current === nearbyDriversSeed) return;

    const mapboxgl = (window as any).mapboxgl;
    const pickup = pickupCoords;
    const map = mapRef.current;
    if (!mapboxgl || !pickup || !map) return;

    nearbyMarkersRef.current.forEach((m) => m.remove());
    nearbyMarkersRef.current = [];
    drawnForSeedRef.current = nearbyDriversSeed;

    ensureDriverCSS();
    // Radial offset (random angle + a minimum radius) guarantees visible
    // separation from the pickup marker — independent x/y jitter could land
    // arbitrarily close to zero and overlap it.
    const offsetPoint = (minDeg: number, maxDeg: number): [number, number] => {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDeg + Math.random() * (maxDeg - minDeg);
      return [pickup[0] + Math.cos(angle) * dist, pickup[1] + Math.sin(angle) * dist];
    };

    const carSvg = (stroke: string, size: number) => `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 17h-2a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1l2 -4a2 2 0 0 1 1.8 -1h6.4a2 2 0 0 1 1.8 1l2 4h1a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-2"></path>
        <circle cx="7" cy="17" r="2"></circle>
        <circle cx="17" cy="17" r="2"></circle>
        <path d="M9 17h6"></path>
      </svg>
    `;

    if (!onlyConfirmedDriver) {
      for (let i = 0; i < 3; i++) {
        const el = document.createElement("div");
        el.style.cssText = "width:22px;height:22px;border-radius:9999px;background:#475569;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(71,85,105,0.7);border:1.5px solid rgba(255,255,255,0.35);";
        el.innerHTML = carSvg("#e2e8f0", 13);
        nearbyMarkersRef.current.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat(offsetPoint(0.006, 0.015))
            .addTo(map),
        );
      }
    }

    const confirmedEl = document.createElement("div");
    confirmedEl.style.cssText = "position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center";
    confirmedEl.innerHTML = `
      <div class="mb-ping" style="position:absolute;inset:0;border-radius:9999px;background:rgba(124,92,255,0.45)"></div>
      <div style="position:relative;width:26px;height:26px;border-radius:9999px;background:#7c5cff;border:2px solid white;box-shadow:0 0 14px rgba(124,92,255,0.9);display:flex;align-items:center;justify-content:center;">
        ${carSvg("#ffffff", 15)}
      </div>
    `;
    nearbyMarkersRef.current.push(
      new mapboxgl.Marker({ element: confirmedEl })
        .setLngLat(offsetPoint(0.004, 0.009))
        .addTo(map),
    );

    return () => {
      nearbyMarkersRef.current.forEach((m) => m.remove());
      nearbyMarkersRef.current = [];
    };
  }, [nearbyDriversSeed, token, pickupCoords, onlyConfirmedDriver]);

  // ── 5. Clear nearby-driver markers the moment the address changes ────────
  // They're pinned to the pickup location at confirm time — if the visitor
  // edits pickup/dropoff afterward, those markers now describe a stale
  // location and must disappear immediately, not linger until reconfirmed.
  useEffect(() => {
    nearbyMarkersRef.current.forEach((m) => m.remove());
    nearbyMarkersRef.current = [];
  }, [pickupAddress, dropoffAddress]);

  // ── No-token placeholder ─────────────────────────────────────────────────
  if (!token) {
    return (
      <div className={className}>
        <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-surface grid-bg">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background/80" />
          <svg
            className="absolute inset-0 h-full w-full opacity-60"
            viewBox="0 0 400 300"
            preserveAspectRatio="none"
          >
            <path
              d="M0 220 C100 180 180 240 400 160"
              stroke="oklch(0.62 0.22 275)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <path d="M40 0 L120 300" stroke="oklch(0.40 0.08 270)" strokeWidth="2" fill="none" />
            <path d="M280 0 L340 300" stroke="oklch(0.40 0.08 270)" strokeWidth="2" fill="none" />
          </svg>
          <div className="absolute left-[35%] top-[55%]">
            <div className="relative h-4 w-4 rounded-full bg-primary pulse-ring shadow-glow" />
          </div>

          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-xl shadow-elevated">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4 text-primary" /> Connect Mapbox
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your Mapbox public token to{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">.env.local</code>{" "}
                as <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">VITE_MAPBOX_TOKEN</code>,
                or paste it below to save in this browser.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="pk.eyJ1Ijoi…"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => {
                    if (tokenInput.startsWith("pk.")) {
                      localStorage.setItem("MAPBOX_TOKEN", tokenInput);
                      setToken(tokenInput);
                    }
                  }}
                  className="rounded-lg bg-gradient-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-glow"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-2xl" />
      {geocoding && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-xs backdrop-blur-sm">
          <Loader2 className="h-3 w-3 animate-spin text-primary" /> Calculating route…
        </div>
      )}
    </div>
  );
}
