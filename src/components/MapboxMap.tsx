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
  /** Operator demo, "Go online": centre on `center` (or, when null, on the
   *  geocoded `address`) at `zoom`, hide every label (places, POIs, house
   *  numbers), and draw the visitor's own car there (larger, softly pulsing)
   *  with `cars` simulated SOLO.drive cars moving slowly along the roads the
   *  map draws. Unset everywhere else, so other maps are unchanged. */
  simulationArea?: { center: [number, number] | null; address: string; zoom: number; cars: number } | null;
  /** Operator demo ride: draw the Operator's car this far (0-1) along the
   *  pickup → drop-off route. Unset everywhere else. */
  tripProgress?: number | null;
  /** Operator demo ride, "guidance" view: when given, the Directions request
   *  also asks for the turn-by-turn steps and reports them here. Unset
   *  everywhere else, so other maps make the same request as before. */
  onRouteSteps?: (steps: RouteStep[]) => void;
  /** Operator demo ride, "guidance" view: while `tripProgress` is set, the
   *  camera follows the car tilted (~60°), turned so the road ahead points up,
   *  with the car `bottomPx` above the map's bottom edge, drawn as a top-down
   *  car. `reduced`: no tilt/glide, instant turns. Unset everywhere else. */
  driveView?: { bottomPx: number; reduced: boolean } | null;
};

/** One Mapbox Directions step: the maneuver at its start, the road it follows,
 *  and where it starts as a fraction (0-1) of the whole route. */
export type RouteStep = { type: string; modifier: string; name: string; ref: string; startFrac: number };

/** The guidance view's camera: street level, tilted like a driver's view. */
const DRIVE_ZOOM = 14;
const DRIVE_PITCH = 60;
/** The tilt and glide from the route overview into the driver's view. */
const DRIVE_INTRO_MS = 1500;

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

async function mbDirections(a: [number, number], b: [number, number], token: string, withSteps = false) {
  try {
    const r = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${a[0]},${a[1]};${b[0]},${b[1]}?access_token=${token}&geometries=geojson&overview=full${withSteps ? "&steps=true" : ""}`,
    );
    const j = await r.json();
    const route = j.routes?.[0];
    if (!route) return null;
    let steps: RouteStep[] = [];
    if (withSteps) {
      let at = 0;
      steps = (route.legs?.[0]?.steps ?? []).map((s: any) => {
        const step = { type: s.maneuver?.type ?? "", modifier: s.maneuver?.modifier ?? "", name: s.name ?? "", ref: s.ref ?? "", startFrac: at / route.distance };
        at += s.distance;
        return step;
      });
    }
    return {
      coords: route.geometry.coordinates as [number, number][],
      distanceMi: route.distance / 1609.34,
      durationMin: route.duration / 60,
      steps,
    };
  } catch {
    return null;
  }
}

// One shared load of the mapbox-gl script. Two overlapping loads (e.g. a map
// mounting twice in quick succession) used to inject the script twice; when
// the downloads finished out of order, window.mapboxgl was swapped for a
// second copy after the map was built, and fitBounds then rejected bounds
// made from the other copy — the route never got framed.
let mapboxglLoading: Promise<void> | null = null;

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
    mapboxglLoading ??= new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://api.mapbox.com/mapbox-gl-js/v3.5.2/mapbox-gl.js";
      s.onload = () => res();
      s.onerror = () => {
        mapboxglLoading = null; // allow a retry on the next mount
        rej(new Error("mapbox-gl failed to load"));
      };
      document.head.appendChild(s);
    });
    await mapboxglLoading;
  }
  w.mapboxgl.accessToken = token;
  return w.mapboxgl;
}

const carSvg = (stroke: string, size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 17h-2a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1l2 -4a2 2 0 0 1 1.8 -1h6.4a2 2 0 0 1 1.8 1l2 4h1a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-2"></path>
    <circle cx="7" cy="17" r="2"></circle>
    <circle cx="17" cy="17" r="2"></circle>
    <path d="M9 17h6"></path>
  </svg>
`;

/** The nearby-car marker the website simulation draws (grey disc, white car). */
function nearbyCarEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "width:22px;height:22px;border-radius:9999px;background:#475569;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(71,85,105,0.7);border:1.5px solid rgba(255,255,255,0.35);";
  el.innerHTML = carSvg("#e2e8f0", 13);
  return el;
}

/** The demo Go-online map's other cars: a small SOLO.drive car dot. */
function simCarEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "width:14px;height:14px;border-radius:9999px;background:#475569;display:flex;align-items:center;justify-content:center;box-shadow:0 0 4px rgba(71,85,105,0.7);border:1px solid rgba(255,255,255,0.5);";
  el.innerHTML = carSvg("#e2e8f0", 9);
  return el;
}

/** The demo ride's guidance view: the Operator's car from above (front up) —
 *  rounded hood, windshield, roof, rear window — in the Operator car's purple.
 *  Laid flat on the map, so the tilted camera sees it from behind. */
function topDownCarEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.dataset.testid = "trip-car";
  el.style.cssText = "width:40px;height:72px";
  el.innerHTML = `
    <svg width="40" height="72" viewBox="0 0 30 54" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 15 C3 5 8 1.5 15 1.5 C22 1.5 27 5 27 15 L27 46 C27 50.5 24.5 52.5 20 52.5 L10 52.5 C5.5 52.5 3 50.5 3 46 Z" fill="#7c5cff" stroke="#ffffff" stroke-width="1.5"/>
      <path d="M6 19.5 C11 16.5 19 16.5 24 19.5 L22.5 26.5 C18 25 12 25 7.5 26.5 Z" fill="#1e1b4b" fill-opacity="0.9"/>
      <rect x="7.5" y="27.5" width="15" height="14" rx="3" fill="#7c5cff" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>
      <path d="M8 43.5 C12 44.8 18 44.8 22 43.5 L21 48 C17.5 49 12.5 49 9 48 Z" fill="#1e1b4b" fill-opacity="0.9"/>
    </svg>`;
  return el;
}

/** The demo's soft pulse for the visitor's own car (none with reduced motion). */
function ensureSimCSS() {
  if (document.getElementById("mb-sim-css")) return;
  const el = document.createElement("style");
  el.id = "mb-sim-css";
  el.textContent = `
    @keyframes mb-soft-ring { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(1.9); opacity: 0; } }
    .mb-soft-ring { animation: mb-soft-ring 2.4s ease-out infinite; }
    @media (prefers-reduced-motion: reduce) { .mb-soft-ring { animation: none; opacity: .3; } }
  `;
  document.head.appendChild(el);
}

/** Road line layers of the style (the lines the map draws), minus casings, paths, rail, etc. */
function roadLayerIds(map: any): string[] {
  return (map.getStyle()?.layers ?? [])
    .filter((l: any) => l.type === "line" && l["source-layer"] === "road" &&
      !/case|path|pedestrian|steps|rail|ferry|construction|service|track|golf|aerialway|turning/.test(l.id))
    .map((l: any) => l.id);
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
  simulationArea = null,
  tripProgress = null,
  onRouteSteps,
  driveView = null,
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
  const onRouteStepsRef = useRef(onRouteSteps);
  onRouteStepsRef.current = onRouteSteps;
  // The route lookup and the map's own load race each other. The latest
  // "draw markers + route line + fit" step waits here until the map is ready
  // (its "load" handler has added the route layer), then runs exactly once —
  // whichever side finishes last triggers it.
  const mapReadyRef = useRef(false);
  const pendingApplyRef = useRef<(() => void) | null>(null);
  const flushPendingApply = () => {
    if (!mapReadyRef.current || !pendingApplyRef.current) return;
    const apply = pendingApplyRef.current;
    pendingApplyRef.current = null;
    apply();
  };

  const [token, setToken] = useState<string>(() => {
    if (ENV_TOKEN && ENV_TOKEN !== "your_pk_token_here") return ENV_TOKEN;
    return typeof window !== "undefined"
      ? localStorage.getItem("MAPBOX_TOKEN") || ""
      : "";
  });
  const [tokenInput, setTokenInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const simulationRef = useRef(simulationArea);
  simulationRef.current = simulationArea;

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
          // Demo Go-online map: no labels at all (place names, restaurants and
          // other POIs, road names, house numbers are all symbol layers).
          if (simulationRef.current) {
            for (const l of map.getStyle().layers ?? []) {
              if (l.type === "symbol") map.setLayoutProperty(l.id, "visibility", "none");
            }
          }
          mapReadyRef.current = true;
          // A route that arrived before the map finished loading draws now.
          flushPendingApply();
        });
      } catch (e) {
        console.error("Mapbox init failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      mapReadyRef.current = false;
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

        const route = await mbDirections(pickup, dropoff, token, !!onRouteStepsRef.current);
        if (cancelled) return;

        if (route) {
          routeCoordsRef.current = route.coords;
          onRouteDataRef.current?.({
            distanceMi: route.distanceMi,
            durationMin: route.durationMin,
          });
          onRouteStepsRef.current?.(route.steps);
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

        // Don't draw directly: the map may not exist yet, or may report
        // !loaded() after its one-time "load" event already fired — both used
        // to drop the route for good. Queue it; it runs now if the map is
        // ready, otherwise from the map's "load" handler.
        pendingApplyRef.current = applyToMap;
        flushPendingApply();
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

    if (!onlyConfirmedDriver) {
      for (let i = 0; i < 3; i++) {
        const el = nearbyCarEl();
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

  // ── 6. Demo Go-online area: own car + cars driving along the drawn roads ──
  const simLng = simulationArea?.center?.[0] ?? null;
  const simLat = simulationArea?.center?.[1] ?? null;
  const simAddress = simulationArea?.address ?? null;
  const simZoom = simulationArea?.zoom ?? null;
  const simCars = simulationArea?.cars ?? 0;
  useEffect(() => {
    if (simAddress == null || simZoom == null || !token) return;
    let cancelled = false;
    let raf = 0;
    const markers: any[] = [];
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ensureSimCSS();

    (async () => {
      while (!cancelled && !mapReadyRef.current) await new Promise((r) => setTimeout(r, 100));
      const map = mapRef.current;
      const mapboxgl = (window as any).mapboxgl;
      if (cancelled || !map || !mapboxgl) return;
      const center: [number, number] =
        simLng != null && simLat != null ? [simLng, simLat] : (await mbGeocode(simAddress, token)) ?? DEFAULT_CENTER;
      if (cancelled) return;
      map.jumpTo({ center, zoom: simZoom });
      await new Promise<void>((r) => map.once("idle", () => r()));
      if (cancelled) return;

      // The visitor's own car: a little larger than the others, with a softly pulsing ring.
      const self = document.createElement("div");
      self.dataset.testid = "sim-self-car";
      self.style.cssText = "position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center";
      self.innerHTML = `
        <div class="mb-soft-ring" style="position:absolute;inset:0;border-radius:9999px;background:rgba(124,92,255,0.45)"></div>
        <div style="position:relative;width:19px;height:19px;border-radius:9999px;background:#7c5cff;border:1.5px solid white;box-shadow:0 0 8px rgba(124,92,255,0.9);display:flex;align-items:center;justify-content:center;">
          ${carSvg("#ffffff", 12)}
        </div>
      `;

      // Road lines drawn on screen, cut to the visible map (with a margin). Kept
      // as map coordinates (so the cars stay on the roads if the map is moved),
      // measured in pixels at this zoom.
      const layers = roadLayerIds(map);
      const feats = layers.length ? map.queryRenderedFeatures({ layers }) : [];
      const { clientWidth: W, clientHeight: H } = map.getContainer();
      const M = 10;
      type Pt = { x: number; y: number; ll: [number, number] };
      type Line = { pts: Pt[]; cum: number[]; total: number };
      const lines: Line[] = [];
      const pushRun = (run: Pt[]) => {
        if (run.length < 2) return;
        const cum = [0];
        for (let i = 1; i < run.length; i++) cum.push(cum[i - 1] + Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y));
        if (cum[cum.length - 1] >= 40) lines.push({ pts: run, cum, total: cum[cum.length - 1] });
      };
      for (const f of feats) {
        const g = f.geometry;
        const parts: [number, number][][] = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
        for (const part of parts) {
          let run: Pt[] = [];
          for (const c of part) {
            const q = map.project(c);
            if (q.x >= M && q.x <= W - M && q.y >= M && q.y <= H - M) run.push({ x: q.x, y: q.y, ll: c });
            else { pushRun(run); run = []; }
          }
          pushRun(run);
        }
      }

      const seg = (l: Line, d: number) => {
        let i = 1;
        while (i < l.cum.length - 1 && l.cum[i] < d) i++;
        return { a: l.pts[i - 1], b: l.pts[i], t: (d - l.cum[i - 1]) / Math.max(1e-6, l.cum[i] - l.cum[i - 1]) };
      };
      const at = (l: Line, d: number) => {
        const { a, b, t } = seg(l, d);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      };
      const lngLatAt = (l: Line, d: number): [number, number] => {
        const { a, b, t } = seg(l, d);
        return [a.ll[0] + (b.ll[0] - a.ll[0]) * t, a.ll[1] + (b.ll[1] - a.ll[1]) * t];
      };
      // Real city speeds: 15-30 mph, turned into pixels per second at this zoom
      // (Mapbox: 40,075 km around the equator per 512 px at zoom 0).
      const metersPerPx = (40_075_016.686 * Math.cos((center[1] * Math.PI) / 180)) / (512 * 2 ** simZoom);
      const mph = (v: number) => (v * 0.44704) / metersPerPx;

      // Spread the cars over different roads (longest first, then shuffled), never on the visitor's car.
      const pool = lines.sort((a, b) => b.total - a.total).slice(0, Math.max(simCars * 2, 24));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const mid = map.project(center);
      const cars: { m: any; l: Line; d: number; dir: number; v: number; w: number; ph: number }[] = [];
      for (let k = 0; pool.length && cars.length < simCars && k < simCars * 8; k++) {
        const l = pool[k % pool.length];
        const d = Math.random() * l.total;
        const q = at(l, d);
        if (Math.hypot(q.x - mid.x, q.y - mid.y) < 22) continue;
        if (cars.some((c) => { const o = at(c.l, c.d); return Math.hypot(o.x - q.x, o.y - q.y) < 20; })) continue;
        const el = simCarEl();
        el.dataset.testid = "sim-car";
        const m = new mapboxgl.Marker({ element: el }).setLngLat(lngLatAt(l, d)).addTo(map);
        markers.push(m);
        // Each car keeps its own unhurried pace (60% of 15-30 mph) and drifts a little (±10%) around it.
        cars.push({ m, l, d, dir: Math.random() < 0.5 ? 1 : -1, v: mph(0.6 * (15 + Math.random() * 15)), w: 0.2 + Math.random() * 0.3, ph: Math.random() * 6.28 });
      }
      markers.push(new mapboxgl.Marker({ element: self }).setLngLat(center).addTo(map)); // added last, drawn on top

      if (still || !cars.length) return; // reduced motion: cars stay still
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        for (const c of cars) {
          // Ease off near the end of the street before turning back (no sudden stops).
          const toEnd = c.dir > 0 ? c.l.total - c.d : c.d;
          const ease = Math.max(0.25, Math.min(1, toEnd / 20));
          c.d += c.dir * c.v * (1 + 0.1 * Math.sin((now / 1000) * c.w + c.ph)) * ease * dt;
          if (c.d <= 0) { c.d = 0; c.dir = 1; }
          if (c.d >= c.l.total) { c.d = c.l.total; c.dir = -1; }
          c.m.setLngLat(lngLatAt(c.l, c.d));
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      markers.forEach((m) => m.remove());
    };
  }, [simLng, simLat, simAddress, simZoom, simCars, token]);

  // ── 7. Demo ride: the Operator's car at tripProgress along the route ──────
  const tripMarkerRef = useRef<any>(null);
  const routeCumRef = useRef<{ coords: [number, number][]; cum: number[] } | null>(null);
  // Guidance view: where the camera started (for the tilt-in) and the eased heading.
  const driveCamRef = useRef<{ t0: number; last: number; heading: number; from: { zoom: number; bearing: number; pitch: number } } | null>(null);
  const driveOn = driveView != null;
  const driveBottom = driveView?.bottomPx ?? 0;
  const driveReduced = driveView?.reduced ?? false;
  useEffect(() => {
    if (tripProgress == null) {
      tripMarkerRef.current?.remove();
      tripMarkerRef.current = null;
      driveCamRef.current = null;
      return;
    }
    const map = mapRef.current;
    const mapboxgl = (window as any).mapboxgl;
    const coords = routeCoordsRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current || coords.length < 2) return; // placed on a later tick
    if (routeCumRef.current?.coords !== coords) {
      const cum = [0];
      for (let i = 1; i < coords.length; i++) {
        const k = Math.cos((coords[i][1] * Math.PI) / 180);
        cum.push(cum[i - 1] + Math.hypot((coords[i][0] - coords[i - 1][0]) * k, coords[i][1] - coords[i - 1][1]));
      }
      routeCumRef.current = { coords, cum };
    }
    const { cum } = routeCumRef.current;
    const total = cum[cum.length - 1];
    const pointAt = (dd: number): [number, number] => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < dd) i++;
      const t = (dd - cum[i - 1]) / Math.max(1e-12, cum[i] - cum[i - 1]);
      return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t];
    };
    const d = Math.max(0, Math.min(1, tripProgress)) * total;
    const at = pointAt(d);
    if (driveOn) {
      // The heading: toward the route ~300 m ahead (cum is in degrees of latitude).
      const look = 300 / 111_320;
      const [p0, p1] = d + look <= total ? [at, pointAt(d + look)] : [pointAt(Math.max(0, total - look)), pointAt(total)];
      const heading = (Math.atan2((p1[0] - p0[0]) * Math.cos((p0[1] * Math.PI) / 180), p1[1] - p0[1]) * 180) / Math.PI;
      const turn = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180; // shortest a → b
      const now = performance.now();
      let cam = driveCamRef.current;
      if (!cam) {
        map.resize(); // the map just became full screen
        if (map.getLayer("route")) map.setPaintProperty("route", "line-width", 9);
        cam = driveCamRef.current = { t0: now, last: now, heading, from: { zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() } };
      } else {
        // The map turns smoothly into each new road (instantly with reduced motion).
        const k = driveReduced ? 1 : 1 - Math.exp(-(now - cam.last) / 350);
        cam.heading += turn(cam.heading, heading) * k;
        cam.last = now;
      }
      // The car stays put on the screen from the first frame; the map zooms,
      // tilts and turns in around it (all at once with reduced motion).
      const x = driveReduced ? 1 : Math.min(1, (now - cam.t0) / DRIVE_INTRO_MS);
      const e = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; // ease in-out
      const { from } = cam;
      const H = map.getContainer().clientHeight;
      map.jumpTo({
        center: at,
        zoom: from.zoom + (DRIVE_ZOOM - from.zoom) * e,
        bearing: from.bearing + turn(from.bearing, cam.heading) * e,
        pitch: from.pitch + (DRIVE_PITCH - from.pitch) * e,
        // The car sits low on the screen: bottomPx above the bottom edge.
        padding: { top: Math.max(0, H - 2 * driveBottom), bottom: 0, left: 0, right: 0 },
      });
      if (!tripMarkerRef.current) {
        tripMarkerRef.current = new mapboxgl.Marker({ element: topDownCarEl(), rotationAlignment: "map", pitchAlignment: "map" }).setLngLat(at).addTo(map);
      }
      tripMarkerRef.current.setLngLat(at).setRotation(cam.heading);
      return;
    }
    if (!tripMarkerRef.current) {
      ensureSimCSS();
      const el = document.createElement("div");
      el.dataset.testid = "trip-car";
      el.style.cssText = "position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center";
      el.innerHTML = `
        <div class="mb-soft-ring" style="position:absolute;inset:0;border-radius:9999px;background:rgba(124,92,255,0.45)"></div>
        <div style="position:relative;width:19px;height:19px;border-radius:9999px;background:#7c5cff;border:1.5px solid white;box-shadow:0 0 8px rgba(124,92,255,0.9);display:flex;align-items:center;justify-content:center;">
          ${carSvg("#ffffff", 12)}
        </div>
      `;
      tripMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(at).addTo(map);
    } else {
      tripMarkerRef.current.setLngLat(at);
    }
  }, [tripProgress, driveOn, driveBottom, driveReduced]);
  useEffect(() => () => { tripMarkerRef.current?.remove(); tripMarkerRef.current = null; }, []);

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
