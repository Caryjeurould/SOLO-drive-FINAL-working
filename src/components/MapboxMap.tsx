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
  /** Operator demo ride: everything to draw, fetched beforehand (see
   *  fetchDemoRide). The map opens already framed on `frame` (no geocoding,
   *  no "Calculating route…", no wide view first), fades in once drawn, and
   *  redraws at once when this changes. Unset everywhere else. */
  prepared?: PreparedView | null;
  /** Operator demo ride: redraw the map whenever its box changes size (the
   *  ride steps give the map different heights). Off everywhere else. */
  resizeWithContainer?: boolean;
};

type LngLat = [number, number];
/** The demo ride's map for one step: route lines (drawn in order, each in its
 *  colour), end dots, the Operator's parked car, the route the car
 *  (`tripProgress`) follows, and the points kept in view. */
export type PreparedView = {
  lines: { id: string; coords: LngLat[]; color: string }[];
  dots: { at: LngLat; color: string }[];
  parkedCar: LngLat | null;
  carRoute: LngLat[] | null;
  frame: LngLat[];
};

/** One Mapbox Directions step: the maneuver at its start, the road it follows,
 *  and where it starts as a fraction (0-1) of the whole route. */
export type RouteStep = { type: string; modifier: string; name: string; ref: string; startFrac: number };

/** The guidance view's camera: close to the car, tilted like a driver's view. */
export const DRIVE_ZOOM = 15.6;
export const DRIVE_PITCH = 48;
/** Demo ride route lines (and their darker casing): one width for every line,
 *  growing with the zoom — about 5 px on the overviews, 15 px at the navigation zoom. */
const ROUTE_W: [number, number][] = [[12, 5], [14, 7], [DRIVE_ZOOM, 15], [18, 20]];
const CASE_EXTRA = 4;
const zoomWidth = (stops: [number, number][], extra = 0) => ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flatMap(([z, w]) => [z, w + extra])];
/** The same width at one zoom (for the demo test). */
function routeWidthAt(z: number) {
  const s = ROUTE_W;
  if (z <= s[0][0]) return s[0][1];
  for (let i = 1; i < s.length; i++) {
    if (z <= s[i][0]) {
      const [z0, w0] = s[i - 1], [z1, w1] = s[i];
      const t = (1.5 ** (z - z0) - 1) / (1.5 ** (z1 - z0) - 1);
      return w0 + (w1 - w0) * t;
    }
  }
  return s[s.length - 1][1];
}
/** The route's casing colour: the line's colour, darker. */
function darker(hex: string) {
  const n = parseInt(hex.slice(1), 16), k = 0.45;
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}
/** The camera's move from the route overview into the driver's view (zoom,
 *  tilt, turn, and over to the car), eased in and out. */
export const DRIVE_INTRO_MS = 1000;

const ENV_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string) || "";
/** The smallest box holding all these points. */
function boundsOf(mapboxgl: any, pts: [number, number][]) {
  const b = new mapboxgl.LngLatBounds(pts[0], pts[0]);
  for (const p of pts) b.extend(p);
  return b;
}
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

/** The demo Go-online map's centre for an address (looked up once, then kept). */
const simCenterCache = new Map<string, Promise<[number, number]>>();
function simAreaCenter(address: string, token: string): Promise<[number, number]> {
  let p = simCenterCache.get(address);
  if (!p) {
    p = mbGeocode(address, token).then((c) => { if (!c) simCenterCache.delete(address); return c ?? DEFAULT_CENTER; });
    simCenterCache.set(address, p);
  }
  return p;
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

function mapboxToken(): string {
  if (ENV_TOKEN && ENV_TOKEN !== "your_pk_token_here") return ENV_TOKEN;
  return typeof window !== "undefined" ? localStorage.getItem("MAPBOX_TOKEN") || "" : "";
}

export type DemoRideRoutes = { start: LngLat; pickup: LngLat; dropoff: LngLat; leg: LngLat[]; legSteps: RouteStep[]; trip: LngLat[]; tripSteps: RouteStep[] };
const demoRideCache = new Map<string, Promise<DemoRideRoutes | null>>();
/** Operator demo ride: the Operator's start, the pickup and the drop-off, and
 *  the two Directions routes between them (start → pickup, pickup → drop-off,
 *  each with turn-by-turn steps), fetched once and kept for the page's life. */
export function fetchDemoRide(a: { start: string; pickup: string; dropoff: string }): Promise<DemoRideRoutes | null> {
  const key = `${a.start}|${a.pickup}|${a.dropoff}`;
  let p = demoRideCache.get(key);
  if (!p) {
    p = (async () => {
      const token = mapboxToken();
      if (!token) return null;
      const [start, pickup, dropoff] = await Promise.all([mbGeocode(a.start, token), mbGeocode(a.pickup, token), mbGeocode(a.dropoff, token)]);
      if (!start || !pickup || !dropoff) return null;
      const [leg, trip] = await Promise.all([mbDirections(start, pickup, token, true), mbDirections(pickup, dropoff, token, true)]);
      if (!leg || !trip) return null;
      return { start, pickup, dropoff, leg: leg.coords, legSteps: leg.steps, trip: trip.coords, tripSteps: trip.steps };
    })();
    p.then((r) => { if (!r) demoRideCache.delete(key); });
    demoRideCache.set(key, p);
  }
  return p;
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

/** The demo ride's guidance view: the Operator's car from above (nose up) —
 *  shadow, four wheels, mirrors, purple body with a white outline, windshield,
 *  roof, rear window, headlights and taillights. Laid flat on the map, so the
 *  tilted camera sees it from behind. Each car gets its own gradient ids. */
let topDownCarCount = 0;
function topDownCarEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.dataset.testid = "trip-car";
  el.dataset.kind = "top";
  el.style.cssText = "width:56px;height:84px";
  const id = ++topDownCarCount;
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120" width="56" height="84">
      <defs>
        <linearGradient id="sdcBody${id}" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#5b3fe0"/>
          <stop offset="0.5" stop-color="#9a7bff"/>
          <stop offset="1" stop-color="#5b3fe0"/>
        </linearGradient>
        <linearGradient id="sdcGlass${id}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#cfe4ff"/>
          <stop offset="1" stop-color="#6f86c9"/>
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="64" rx="31" ry="52" fill="#000" opacity=".35"/>
      <g data-wheels="4" fill="#0c0c12" stroke="#2b2b3a" stroke-width="1">
        <rect x="8" y="22" width="9" height="20" rx="3.5"/>
        <rect x="63" y="22" width="9" height="20" rx="3.5"/>
        <rect x="8" y="80" width="9" height="20" rx="3.5"/>
        <rect x="63" y="80" width="9" height="20" rx="3.5"/>
      </g>
      <path d="M17 44 q-7 1 -7 5 q0 3 7 3 z" fill="#6a4ff0"/>
      <path d="M63 44 q7 1 7 5 q0 3 -7 3 z" fill="#6a4ff0"/>
      <path d="M40 6 C56 6 64 16 64 34 L64 88 C64 106 56 114 40 114 C24 114 16 106 16 88 L16 34 C16 16 24 6 40 6 Z" fill="url(#sdcBody${id})" stroke="#ffffff" stroke-width="2.2"/>
      <path d="M40 10 C52 10 58 18 58 30 L22 30 C22 18 28 10 40 10 Z" fill="#fff" opacity=".16"/>
      <path d="M24 38 C24 34 30 31 40 31 C50 31 56 34 56 38 L53 52 L27 52 Z" fill="url(#sdcGlass${id})" stroke="#1a1f3a" stroke-width="1"/>
      <rect x="25" y="52" width="30" height="26" rx="6" fill="#7e62f5" stroke="#4a33b8" stroke-width="1"/>
      <rect x="29" y="56" width="22" height="8" rx="4" fill="#fff" opacity=".18"/>
      <path d="M27 78 L53 78 L56 90 C56 93 50 95 40 95 C30 95 24 93 24 90 Z" fill="url(#sdcGlass${id})" stroke="#1a1f3a" stroke-width="1" opacity=".95"/>
      <ellipse cx="26" cy="14" rx="5" ry="2.6" fill="#fff6c8"/>
      <ellipse cx="54" cy="14" rx="5" ry="2.6" fill="#fff6c8"/>
      <g data-taillights="2">
        <rect x="21" y="106" width="9" height="3.2" rx="1.6" fill="#ff4d5e"/>
        <rect x="50" y="106" width="9" height="3.2" rx="1.6" fill="#ff4d5e"/>
      </g>
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
  prepared = null,
  resizeWithContainer = false,
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
  const preparedRef = useRef(prepared);
  preparedRef.current = prepared;
  const driveViewRef = useRef(driveView);
  driveViewRef.current = driveView;
  const fitPaddingRef = useRef(fitPadding);
  fitPaddingRef.current = fitPadding;
  // Demo ride and demo Go-online map: hidden until drawn, then faded in.
  const [shown, setShown] = useState(!prepared && !simulationArea);
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

        // Demo ride: open already framed on the prepared view (no wide view first).
        const pv = preparedRef.current;
        // Demo Go-online map: open at its final centre and zoom (the area's
        // centre, or its address looked up first), so it never moves.
        const sim = simulationRef.current;
        const simCenter = sim ? sim.center ?? (await simAreaCenter(sim.address, token)) : null;
        if (cancelled || !containerRef.current) return;
        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          ...(pv && pv.frame.length
            ? { bounds: boundsOf(mapboxgl, pv.frame), fitBoundsOptions: { padding: fitPadding, maxZoom: 15 } }
            : sim && simCenter
              ? { center: simCenter, zoom: sim.zoom }
              : { center: DEFAULT_CENTER, zoom: 12 }),
          attributionControl: false,
          // Static route view: no drag/pan, pinch- or scroll-zoom, rotate, or
          // keyboard. Also means swipes over the map scroll the page on mobile
          // instead of panning the map. Programmatic fitBounds still works.
          interactive: false,
        });
        mapRef.current = map;
        if (sim) {
          // Demo Go-online map: shown anyway if its tiles never finish loading.
          window.setTimeout(() => { if (!cancelled) setShown(true); }, 6000);
          // For the demo test: the view it opened at and how often it moved.
          const el = containerRef.current;
          el.dataset.simView = JSON.stringify({ lng: +map.getCenter().lng.toFixed(5), lat: +map.getCenter().lat.toFixed(5), zoom: map.getZoom() });
          el.dataset.simMoves = "0";
          map.on("move", () => { el.dataset.simMoves = String(+(el.dataset.simMoves ?? 0) + 1); });
        }

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
          if (preparedRef.current) {
            // Frame at the box's real size (it may have grown since the map was made).
            map.resize();
            applyPrepared(map, preparedRef.current, true);
            map.on("zoomend", () => markLineWidths(map));
            let done = false;
            const show = () => {
              if (done || cancelled) return;
              done = true;
              // The view the visitor first sees (for the demo test).
              const c = map.getCenter();
              if (containerRef.current) containerRef.current.dataset.shownView = JSON.stringify({ lng: +c.lng.toFixed(4), lat: +c.lat.toFixed(4), zoom: +map.getZoom().toFixed(2) });
              setShown(true);
            };
            map.once("idle", show);
            window.setTimeout(show, 1500);
          }
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
        simLng != null && simLat != null ? [simLng, simLat] : await simAreaCenter(simAddress, token);
      if (cancelled) return;
      // The map was made at this view; only a later change of area moves it.
      const c0 = map.getCenter();
      if (Math.abs(c0.lng - center[0]) > 1e-6 || Math.abs(c0.lat - center[1]) > 1e-6 || map.getZoom() !== simZoom) map.jumpTo({ center, zoom: simZoom });
      // Every tile of the final view in (the map may already be idle).
      await new Promise<void>((r) => { if (map.loaded() && map.areTilesLoaded()) r(); else map.once("idle", () => r()); });
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
      // The finished map and its cars fade in together.
      map.getContainer().dataset.simReady = "1";
      setShown(true);

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

  // ── 6b. Demo ride: the prepared view (lines, dots, parked car, framing) ──
  const preparedMarkersRef = useRef<any[]>([]);
  const preparedLinesRef = useRef<string[]>([]);
  function applyPrepared(map: any, pv: PreparedView, refit: boolean) {
    const mapboxgl = (window as any).mapboxgl;
    const ids = pv.lines.map((l) => `demo-${l.id}`);
    for (const id of preparedLinesRef.current) {
      if (ids.includes(id)) continue;
      for (const layer of [id, `${id}-case`]) if (map.getLayer(layer)) map.removeLayer(layer);
      if (map.getSource(id)) map.removeSource(id);
    }
    // Every line the same width (by zoom), each over a darker casing so it reads as a road overlay.
    for (const l of pv.lines) {
      const id = `demo-${l.id}`;
      const data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: l.coords } };
      if (map.getSource(id)) (map.getSource(id) as any).setData(data);
      else map.addSource(id, { type: "geojson", data });
      const layout = { "line-cap": "round", "line-join": "round" };
      if (!map.getLayer(`${id}-case`)) map.addLayer({ id: `${id}-case`, type: "line", source: id, layout, paint: { "line-color": darker(l.color), "line-width": zoomWidth(ROUTE_W, CASE_EXTRA), "line-opacity": 0.95 } });
      else map.setPaintProperty(`${id}-case`, "line-color", darker(l.color));
      if (!map.getLayer(id)) map.addLayer({ id, type: "line", source: id, layout, paint: { "line-color": l.color, "line-width": zoomWidth(ROUTE_W), "line-opacity": 1 } });
      else map.setPaintProperty(id, "line-color", l.color);
    }
    preparedLinesRef.current = ids;
    preparedMarkersRef.current.forEach((m) => m.remove());
    preparedMarkersRef.current = pv.dots.map((d) => {
      const el = document.createElement("div");
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${d.color};box-shadow:0 0 14px ${d.color};`;
      return new mapboxgl.Marker({ element: el }).setLngLat(d.at).addTo(map);
    });
    if (pv.parkedCar) {
      ensureSimCSS();
      const el = document.createElement("div");
      el.dataset.testid = "start-car";
      el.style.cssText = "position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center";
      el.innerHTML = `
        <div class="mb-soft-ring" style="position:absolute;inset:0;border-radius:9999px;background:rgba(124,92,255,0.45)"></div>
        <div style="position:relative;width:19px;height:19px;border-radius:9999px;background:#7c5cff;border:1.5px solid white;box-shadow:0 0 8px rgba(124,92,255,0.9);display:flex;align-items:center;justify-content:center;">
          ${carSvg("#ffffff", 12)}
        </div>`;
      preparedMarkersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat(pv.parkedCar).addTo(map));
    }
    routeCoordsRef.current = pv.carRoute ?? [];
    if (containerRef.current) containerRef.current.dataset.lines = pv.lines.map((l) => l.id).join(",");
    markLineWidths(map);
    if (refit && !driveViewRef.current && pv.frame.length) fitPrepared(map, pv);
  }
  /** For the demo test: each route line's width (and its casing's) at the current zoom. */
  function markLineWidths(map: any) {
    const el = containerRef.current;
    if (!el) return;
    const z = map.getZoom(), w = +routeWidthAt(z).toFixed(2);
    el.dataset.lineWidths = JSON.stringify(Object.fromEntries(preparedLinesRef.current.map((id) => {
      const same = JSON.stringify(map.getPaintProperty(id, "line-width")) === JSON.stringify(zoomWidth(ROUTE_W));
      const caseSame = JSON.stringify(map.getPaintProperty(`${id}-case`, "line-width")) === JSON.stringify(zoomWidth(ROUTE_W, CASE_EXTRA));
      return [id.replace("demo-", ""), { w: same ? w : null, casing: caseSame ? +(w + CASE_EXTRA).toFixed(2) : null, casingColor: map.getPaintProperty(`${id}-case`, "line-color") ?? null, zoom: +z.toFixed(2) }];
    })));
  }
  /** Demo ride: frame the prepared view, level and north up (an overview). */
  function fitPrepared(map: any, pv: PreparedView) {
    map.fitBounds(boundsOf((window as any).mapboxgl, pv.frame), { padding: fitPaddingRef.current, maxZoom: 15, duration: 0, bearing: 0, pitch: 0 });
  }
  useEffect(() => {
    const map = mapRef.current;
    if (!prepared || !map || !mapReadyRef.current) return;
    applyPrepared(map, prepared, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);
  // Demo ride: framed again when the room around the view changes (e.g. the box
  // the map shows through on the pickup overview).
  const fitKey = JSON.stringify(fitPadding);
  useEffect(() => {
    const map = mapRef.current, pv = preparedRef.current;
    if (!pv || !map || !mapReadyRef.current || driveViewRef.current || !pv.frame.length) return;
    fitPrepared(map, pv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  // Demo ride: keep the map's drawing the size of its box (and the prepared view framed).
  useEffect(() => {
    const el = containerRef.current;
    if (!resizeWithContainer || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.resize();
      const pv = preparedRef.current;
      if (pv && pv.frame.length && !driveViewRef.current && mapReadyRef.current) fitPrepared(map, pv);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizeWithContainer, token]);

  // ── 7. Demo ride: the Operator's car at tripProgress along the route ──────
  const tripMarkerRef = useRef<any>(null);
  const routeCumRef = useRef<{ coords: [number, number][]; cum: number[] } | null>(null);
  // Guidance view: where the camera started (for the tilt-in) and the eased heading.
  type Pad = { top: number; bottom: number; left: number; right: number };
  const driveCamRef = useRef<{ t0: number; last: number; heading: number; from: { center: [number, number]; zoom: number; bearing: number; pitch: number; padding: Pad } } | null>(null);
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
    // The drive's top-down car and the round car are different markers: swap
    // when the view changes (the demo goes straight from the pickup leg to the drive).
    if (tripMarkerRef.current && (tripMarkerRef.current.getElement().dataset.kind === "top") !== driveOn) {
      tripMarkerRef.current.remove();
      tripMarkerRef.current = null;
      driveCamRef.current = null;
    }
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
        // The move starts from whatever the map shows now (the route overview).
        if (map.getLayer("route")) map.setPaintProperty("route", "line-width", 9);
        const c = map.getCenter(), pad = map.getPadding();
        cam = driveCamRef.current = { t0: now, last: now, heading, from: { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), padding: { top: pad.top, bottom: pad.bottom, left: pad.left, right: pad.right } } };
      } else {
        // The map turns smoothly into each new road (instantly with reduced motion).
        const k = driveReduced ? 1 : 1 - Math.exp(-(now - cam.last) / 350);
        cam.heading += turn(cam.heading, heading) * k;
        cam.last = now;
      }
      // From the overview the camera eases over to the car while it zooms, tilts
      // and turns in (all at once with reduced motion), then follows the car.
      const x = driveReduced ? 1 : Math.min(1, (now - cam.t0) / DRIVE_INTRO_MS);
      const e = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; // ease in-out
      const { from } = cam;
      const H = map.getContainer().clientHeight;
      const mix = (a: number, b: number) => a + (b - a) * e;
      // The car's distance from the centre shrinks evenly on screen while the zoom
      // grows (scaled back to map units at this zoom), so the car and the road
      // around it stay in view through the whole move.
      const zoom = mix(from.zoom, DRIVE_ZOOM), k = (1 - e) * 2 ** (from.zoom - zoom);
      map.jumpTo({
        center: [at[0] + (from.center[0] - at[0]) * k, at[1] + (from.center[1] - at[1]) * k],
        zoom,
        bearing: from.bearing + turn(from.bearing, cam.heading) * e,
        pitch: mix(from.pitch, DRIVE_PITCH),
        // The car sits low on the screen: bottomPx above the bottom edge.
        padding: { top: mix(from.padding.top, Math.max(0, H - 2 * driveBottom)), bottom: mix(from.padding.bottom, 0), left: mix(from.padding.left, 0), right: mix(from.padding.right, 0) },
      });
      // For the demo test: the camera on this frame.
      if (containerRef.current) containerRef.current.dataset.cam = JSON.stringify({ t: Math.round(now), zoom: +map.getZoom().toFixed(3), pitch: +map.getPitch().toFixed(2), bearing: +map.getBearing().toFixed(2), e: +e.toFixed(3) });
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

  // ── 7b. Demo ride, navigation only: larger, brighter street names with a soft
  // halo, and subtle 3D buildings at the close zoom. Put back as they were when
  // the navigation view ends (the overviews keep the style's own look).
  useEffect(() => {
    if (!driveOn || !token) return;
    let cancelled = false, undo: (() => void) | null = null;
    (async () => {
      while (!cancelled && !mapReadyRef.current) await new Promise((r) => setTimeout(r, 50));
      const map = mapRef.current;
      if (cancelled || !map) return;
      const labels = (map.getStyle()?.layers ?? []).filter((l: any) => l.type === "symbol" && l["source-layer"] === "road" && /label/.test(l.id) && !/shield|exit|number/.test(l.id));
      const before = labels.map((l: any) => ({ id: l.id, size: map.getLayoutProperty(l.id, "text-size"), color: map.getPaintProperty(l.id, "text-color"), halo: map.getPaintProperty(l.id, "text-halo-color"), haloW: map.getPaintProperty(l.id, "text-halo-width"), blur: map.getPaintProperty(l.id, "text-halo-blur") }));
      for (const l of labels) {
        map.setLayoutProperty(l.id, "text-size", ["interpolate", ["linear"], ["zoom"], 13, 11, DRIVE_ZOOM, 12.5, 18, 13]);
        map.setPaintProperty(l.id, "text-color", "#f4f2ff");
        map.setPaintProperty(l.id, "text-halo-color", "rgba(10,8,24,0.9)");
        map.setPaintProperty(l.id, "text-halo-width", 1.6);
        map.setPaintProperty(l.id, "text-halo-blur", 0.6);
      }
      // 3D buildings under the labels and the route; they fade in from zoom 14.8 (navigation only).
      const firstSymbol = (map.getStyle()?.layers ?? []).find((l: any) => l.type === "symbol")?.id;
      if (map.getSource("composite") && !map.getLayer("demo-buildings")) {
        map.addLayer({
          id: "demo-buildings", type: "fill-extrusion", source: "composite", "source-layer": "building", minzoom: 14.8,
          filter: ["==", ["get", "extrude"], "true"],
          paint: {
            "fill-extrusion-color": "#2a2440",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14.8, 0, DRIVE_ZOOM, 0.35],
          },
        }, firstSymbol);
      }
      const el = containerRef.current;
      if (el) { el.dataset.navStyle = JSON.stringify({ labels: labels.length, labelSize: 12.5 }); el.dataset.buildings = map.getLayer("demo-buildings") ? "1" : "0"; }
      undo = () => {
        for (const b of before) {
          if (!map.getLayer(b.id)) continue;
          map.setLayoutProperty(b.id, "text-size", b.size);
          map.setPaintProperty(b.id, "text-color", b.color);
          map.setPaintProperty(b.id, "text-halo-color", b.halo);
          map.setPaintProperty(b.id, "text-halo-width", b.haloW);
          map.setPaintProperty(b.id, "text-halo-blur", b.blur);
        }
        if (map.getLayer("demo-buildings")) map.removeLayer("demo-buildings");
        if (el) { delete el.dataset.navStyle; el.dataset.buildings = "0"; }
      };
    })();
    return () => { cancelled = true; if (undo && mapRef.current) undo(); };
  }, [driveOn, token]);

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
      <div
        ref={containerRef}
        className={cn("h-full w-full overflow-hidden rounded-2xl", prepared && "motion-safe:transition-opacity motion-safe:duration-[400ms]", simulationArea && !prepared && "motion-safe:transition-opacity motion-safe:duration-300")}
        style={prepared || simulationArea ? { opacity: shown ? 1 : 0 } : undefined}
      />
      {geocoding && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-xs backdrop-blur-sm">
          <Loader2 className="h-3 w-3 animate-spin text-primary" /> Calculating route…
        </div>
      )}
    </div>
  );
}
