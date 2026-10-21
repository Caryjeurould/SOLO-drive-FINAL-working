// The visitor demo (VISITOR_PASSWORD): a complete simulated Operator, held in
// memory only — never in the database (lib/supabase refuses every request in
// visitor mode) and never in device storage (the real onboarding progress in
// "solo.onboarding" is left alone). Closing the app ends the demo.
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { LEGAL_DOCS, type OnboardingState } from "@/lib/onboarding";
import type { OperatorProfile } from "@/hooks/useOperatorProfile";
import type { OperatorDocument } from "@/hooks/useDocuments";
import { resetSessions } from "@/lib/onlineSessions";

export const DEMO_DEFAULT_NAME = { first: "Marcus", last: "Roberts" };
/** The daily work window the demo Operator declared (shown beside the 50-hour weekly cap). */
export const DEMO_WORK_WINDOW_HOURS = 12;
const DEMO_ID = "00000000-0000-4000-8000-000000000000";

/** The sample Operator documents (images in public/demo/, plus a Business
 *  Liability card drawn in code). The fixed data (address, vehicle, policies,
 *  dates) lives here; the name on the documents is the visitor's own, from
 *  demoDocNames() below. Every prefilled vehicle / policy field in the demo
 *  reads from here. */
export const DEMO_DOCS = {
  address: "1575 Montana Ave, Phoenix, AZ 85045",
  entityState: "Arizona",
  vehicle: { year: "2020", make: "Toyota", model: "Camry", vin: "78XXTW35RT997302", plate: "XXX7722", plateType: "Standard" },
  registrationExpires: "08/25/2027",
  personalAuto: {
    carrier: "Acme Insurance & Casualty",
    policy: "468 84675-G99-05W",
  },
  /** Only the last four digits are ever shown. Fictional numbers. */
  ssnMasked: "*** ** 5689",
  debitMasked: "**** **** **** 9932",
  ein: "86-3197254",
  commercial: {
    carrier: "Acme Insurance & Casualty",
    policy: "468 84675-G99-05W",
    effective: "FEB 23 2026",
    expires: "AUG 2 2028",
    expiresIso: "2028-08-02",
    limits: "75/100/50",
  },
  businessLiability: {
    carrier: "Acme Insurance & Casualty",
    policy: "468 52917-L31-08B",
    limit: "$1,000,000",
    effective: "FEB 23 2026",
    expires: "AUG 2 2028",
  },
  images: {
    /** Two sample licenses: Marcus (the default) and Maria (see demoPersona). */
    license: {
      marcus: { front: "/demo/license.png", back: "/demo/license-back.png", selfPhoto: "/demo/self-marcus.png" },
      maria: { front: "/demo/license-maria.png", back: "/demo/license-back-maria.png", selfPhoto: "/demo/self-maria.png" },
    },
    registration: "/demo/registration.png",
    commercialInsurance: "/demo/commercial-insurance.png",
    entity: "/demo/entity.png",
  },
} as const;

/** The name printed on the demo documents: the name typed on the demo name
 *  screen, or the default "Marcus Roberts" when it was skipped. The business is
 *  "<Last> Transports - PHX LLC"; the entity's second signer is "Cheryl <Last>". */
export function demoDocNames(first?: string, last?: string) {
  const f = first?.trim() || DEMO_DEFAULT_NAME.first;
  const l = last?.trim() || DEMO_DEFAULT_NAME.last;
  return { first: f, last: l, full: `${f} ${l}`, entity: `${l} Transports - PHX LLC`, coSigner: `Cheryl ${l}` };
}

/** Common female first names. A visitor whose typed first name is on this list
 *  sees the Maria license and photo; every other name (including ambiguous ones
 *  like Jordan or Taylor, and the skipped default) sees Marcus. Decided from the
 *  typed name only, in memory. */
const FEMALE_FIRST_NAMES = new Set(`
  mary patricia jennifer linda elizabeth barbara susan jessica sarah karen lisa nancy betty margaret sandra
  ashley kimberly emily donna michelle carol amanda dorothy melissa deborah stephanie rebecca sharon laura
  cynthia kathleen amy angela shirley anna brenda pamela emma nicole helen samantha katherine christine debra
  rachel carolyn janet catherine maria heather diane ruth julie olivia joyce virginia victoria lauren
  christina joan evelyn judith megan cheryl hannah jacqueline martha gloria teresa ann sara madison
  frances kathryn janice abigail alice judy sophia grace denise amber doris marilyn danielle beverly
  isabella theresa diana natalie brittany charlotte marie kayla lori ava mia chloe ella lily zoe
  aria scarlett penelope layla nora camila hazel violet aurora savannah audrey brooklyn bella claire
  lucy stella natalia leah eleanor paisley naomi elena gabriella valentina ariana alyssa sofia
  isabel jasmine maya kaylee allison destiny vanessa erica tiffany monica veronica crystal melanie
  jenna caroline julia valerie sabrina tara wendy yvonne yolanda rosa carmen lucia ana juana
  alejandra mariana daniela fernanda ximena paula adriana gabriela leticia beatriz silvia claudia esperanza
  priya aisha fatima mei keiko sakura ingrid astrid greta heidi colleen molly kathy cindy tina
  tammy stacy dawn connie peggy sally bonnie joanne marsha irene june rita norma lillian
  rose ruby pearl hailey kaitlyn katelyn brianna gianna serenity delilah everly kinsley josephine
  margot vivian luna willow ivy autumn sienna miranda bethany kristen kristin courtney lindsey chelsea
  whitney holly april meredith marissa alicia felicia renee kara krista ellen colette
  jane jill kate katie beth sue amelia abby gina nina anne annie elle eva liz jenny becky
`.trim().split(/\s+/));

/** Which sample person the demo documents and self photo show, from the typed first name. */
export function demoPersona(first?: string): "maria" | "marcus" {
  const name = first?.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return FEMALE_FIRST_NAMES.has(name) ? "maria" : "marcus";
}

/** The website simulation's pickup (its Book-A-Ride card and /customer start
 *  here). The Operator demo's Go-online map falls back to the same spot. */
export const SIM_PICKUP_ADDRESS = "1333 Camelback Rd, Phoenix, AZ";
/** The website simulation's drop-off. */
export const SIM_DROPOFF_ADDRESS = "14765 Scottsdale Rd, Scottsdale, AZ";

/** The Operator demo's one simulated ride, offered about 8 s after the
 *  Go-online map opens: the website simulation's trip (16.6 mi / 29 min) for
 *  Customer Linda K., at a locked $34.50 Smart+Rate™ ($4.50 base + $27.10
 *  distance + $2.90 fuel index = $34.50, ×1.09). Timings in ms; the ride
 *  itself is compressed into a few seconds. */
export const DEMO_RIDE = {
  customer: "Linda K.",
  pickup: SIM_PICKUP_ADDRESS,
  dropoff: SIM_DROPOFF_ADDRESS,
  /** How far the pickup is from the Operator, and the drive there (~25 mph). */
  pickupMi: 4.6,
  operatorEtaMin: 11,
  tripMi: 16.6,
  tripMin: 29,
  rate: { base: 4.5, distance: 27.1, fuelAdj: 2.9, peakAdj: 0, weekendAdj: 0, eventAdj: 0, total: 34.5, multiplier: 1.09 },
  /** Online and waiting (the cars driving on the map, from the moment it shows), until the request comes in (two beeps). */
  offerAfterMs: 8000,
  /** Every ride step fades in over phaseFadeMs, then holds phaseHoldMs before
   *  anything on it starts or advances; the times below run after that. */
  phaseFadeMs: 400,
  phaseHoldMs: 1000,
  /** "Incoming ride request" (about 3 s on screen), then the offer. */
  requestMs: 1600,
  /** The offer's countdown (about 6 s on screen): Accept, or auto-accept at zero (it holds while the
   *  visitor touches or scrolls the Smart+Rate™ breakdown, until 3 s after). */
  autoAcceptMs: 4600,
  /** Where the Operator starts: about 4.6 driving miles from the pickup
   *  (Mapbox Directions: 4.67 mi). */
  operatorStart: "4300 N 16th St, Phoenix, AZ",
  /** On the way to pickup: the overview of the green route first (about 2 s on
   *  screen), then the camera moves into the navigation view (1 s, the car still
   *  at the start), then the car drives the whole leg (sped up, like the trip),
   *  then "Arrived at pickup". */
  pickupOverviewMs: 600,
  pickupLegMs: 20000,
  arrivedMs: 2000,
  /** The Contracted Services card grows and settles back, then the pickup starts (about 7 s on screen). */
  csaMs: 5600,
  /** The drive in the "classic" view (map + Distance / Trip ETA / Arrival rows). */
  driveMs: 13000,
  /** The drive in the "guidance" view (turn-by-turn navigation screen): the trip's
   *  overview through the fade-in and hold, the 1 s move into navigation (the car
   *  still at the start), then the car drives the whole trip. */
  guidanceDriveMs: 35000,
  /** "Trip complete" with the earnings, then the closing line, then the reset. */
  completeMs: 3600,
  thanksMs: 2700,
};
/** The offer's Smart+Rate™ breakdown, top to bottom: label, amount (placeholder
 *  amounts), whether it is added on top ("+"), and the short line saying what it
 *  is based on. The offer screen draws its rows from this list only. */
export const DEMO_RATE_ROWS: { label: string; amount: number; add: boolean; basis: string }[] = [
  { label: "Base", amount: DEMO_RIDE.rate.base, add: false, basis: "Starting amount" },
  { label: "Distance", amount: DEMO_RIDE.rate.distance, add: false, basis: `${DEMO_RIDE.tripMi.toFixed(1)} mi` },
  { label: "Fuel index", amount: DEMO_RIDE.rate.fuelAdj, add: true, basis: "Current fuel index" },
  { label: "Peak time", amount: DEMO_RIDE.rate.peakAdj, add: true, basis: "None at this hour" },
  { label: "Weekend", amount: DEMO_RIDE.rate.weekendAdj, add: true, basis: "Weekday" },
  { label: "Event", amount: DEMO_RIDE.rate.eventAdj, add: true, basis: "No event nearby" },
];
/** Which drive screen the demo ride shows after the Contracted Services card:
 *  "guidance" = full-screen navigation (tilted map following the car, turn
 *  card, time / miles / arrival card); "classic" = the route map with the
 *  Distance / Trip ETA / Arrival rows. Flip this one value to compare. */
export const DRIVE_VIEW: "guidance" | "classic" = "guidance";
/** The Go-online map's zoom: street level (about 2 m per pixel), so cars at
 *  real city speeds (15-30 mph) visibly creep along the streets. */
export const SIM_ZOOM = 15;

/** The website's Customer booking card: the sample Operator shown when no real
 *  Operator comes back from the database (always, for visitors, whose database
 *  connection is switched off). Built from DEMO_DOCS; all documents verified. */
export const SAMPLE_FEATURED_OPERATOR = {
  id: "sample-featured-operator",
  name: "Marcus R.",
  vehicle_make: DEMO_DOCS.vehicle.make,
  vehicle_model: DEMO_DOCS.vehicle.model,
  vehicle_year: Number(DEMO_DOCS.vehicle.year),
  avgRating: 4.91,
  ratingsCount: 287,
};

type DemoState = {
  started: boolean;
  first: string;
  last: string;
  onboarding: OnboardingState;
  profile: Partial<OperatorProfile>;
  documents: Record<string, Pick<OperatorDocument, "status" | "expiration_date" | "file_url">>;
  /** The dashboard has glided back up to Go online (once per run). */
  glidedBack: boolean;
};

const EMPTY_ONBOARDING: OnboardingState = { stage: 1, status: "not_started", data: {} };
const fresh = (): DemoState => ({
  started: false,
  first: "",
  last: "",
  onboarding: EMPTY_ONBOARDING,
  profile: {},
  documents: {},
  glidedBack: false,
});

let state: DemoState = fresh();
const listeners = new Set<() => void>();
function set(next: DemoState) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
export function getDemoState(): DemoState {
  return state;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const yearsFromNow = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return isoDate(d);
};

/** Realistic, fictional sample answers for every wizard field, with all four stages
 *  already completed: every document signed with the visitor's name, the
 *  background check cleared, both coverage confirmations filled in. */
function sampleOnboardingData(first: string, last: string): OnboardingState["data"] {
  const name = `${first} ${last}`;
  const signedAt = new Date().toISOString();
  return {
    fullName: name,
    phone: "(602) 555-0147",
    address: DEMO_DOCS.address,
    vehMake: DEMO_DOCS.vehicle.make,
    vehModel: DEMO_DOCS.vehicle.model,
    vehYear: DEMO_DOCS.vehicle.year,
    vin: DEMO_DOCS.vehicle.vin,
    autoCarrier: DEMO_DOCS.personalAuto.carrier,
    autoPolicy: DEMO_DOCS.personalAuto.policy,
    ssn: DEMO_DOCS.ssnMasked,
    debit: DEMO_DOCS.debitMasked,
    // The license photo's face, marked SAMPLE.
    photoDataUrl: DEMO_DOCS.images.license[demoPersona(first)].selfPhoto,
    licenseExpiration: yearsFromNow(3),
    stage1Complete: true,
    feloniesNone: true,
    felonies: [],
    misdNone: true,
    misd: [],
    signedDocs: Object.fromEntries(LEGAL_DOCS.map((doc) => [doc.id, { name, signature: name, signedAt }])),
    stage2Complete: true,
    bgStatus: "cleared",
    entityType: "LLC",
    entityName: demoDocNames(first, last).entity,
    ein: DEMO_DOCS.ein,
    formationState: DEMO_DOCS.entityState,
    commCarrier: DEMO_DOCS.commercial.carrier,
    commPolicy: DEMO_DOCS.commercial.policy,
    commInsuranceExpiration: DEMO_DOCS.commercial.expiresIso,
    profInsuranceExpiration: yearsFromNow(1),
    bizLiabPolicy: DEMO_DOCS.businessLiability.policy,
    bizLiabLimit: DEMO_DOCS.businessLiability.limit,
    bizLiabCarrier: DEMO_DOCS.businessLiability.carrier,
    confirmBizLiability: true,
    commLiabPolicy: DEMO_DOCS.commercial.policy,
    commLiabLimit: DEMO_DOCS.commercial.limits,
    commLiabCarrier: DEMO_DOCS.commercial.carrier,
    confirmCommLiability: true,
    stage4Complete: true,
  };
}

/** Every document on file and verified (sample files only). */
function sampleDocuments(): DemoState["documents"] {
  const doc = (expiration_date: string | null) => ({ status: "verified" as const, expiration_date, file_url: "demo/sample" });
  return {
    license_front: doc(yearsFromNow(3)),
    license_back: doc(yearsFromNow(3)),
    entity: doc(yearsFromNow(1)),
    insurance: doc(DEMO_DOCS.commercial.expiresIso),
    professional_insurance: doc(yearsFromNow(1)),
    background: doc(yearsFromNow(1)),
    criminal: doc(null),
  };
}

/** The name screen: starts the demo as this person (blank → "Marcus Roberts"). */
export function startDemo(firstName: string, lastName: string) {
  const first = firstName.trim() || DEMO_DEFAULT_NAME.first;
  const last = lastName.trim() || DEMO_DEFAULT_NAME.last;
  set({
    ...fresh(),
    started: true,
    first,
    last,
    onboarding: { stage: 1, status: "in_progress", data: sampleOnboardingData(first, last) },
    documents: sampleDocuments(),
  });
  resetSessions();
}

export function resetDemo() {
  resetSessions();
  set(fresh());
}

export function markDemoGlidedBack() {
  set({ ...state, glidedBack: true });
}

export function updateDemoOnboarding(next: OnboardingState) {
  set({ ...state, onboarding: next });
}

/** The pretend signed-in Operator (exists only once the demo has started). */
export function demoUser(): User | null {
  if (!state.started) return null;
  return {
    id: DEMO_ID,
    email: "demo.operator@example.invalid",
    aud: "authenticated",
    created_at: new Date().toISOString(),
    app_metadata: { account_type: "operator" },
    user_metadata: {},
  } as User;
}

export function demoProfile(): OperatorProfile {
  const d = state.onboarding.data;
  return {
    id: DEMO_ID,
    name: d.fullName ?? `${state.first} ${state.last}`,
    phone: d.phone ?? null,
    email: "demo.operator@example.invalid",
    vehicle_make: d.vehMake ?? null,
    vehicle_model: d.vehModel ?? null,
    vehicle_year: d.vehYear ? parseInt(d.vehYear) : null,
    vin: d.vin ?? null,
    status: "active",
    hours_used: 0,
    subscription_active: true,
    created_at: new Date().toISOString(),
    approved_at: state.onboarding.status === "approved" ? new Date().toISOString() : null,
    ...state.profile,
  };
}

export function updateDemoProfile(patch: Partial<OperatorProfile>) {
  set({ ...state, profile: { ...state.profile, ...patch } });
}

export function demoDocuments(): OperatorDocument[] {
  return Object.entries(state.documents).map(([document_type, d]) => ({
    id: `demo-${document_type}`,
    operator_id: DEMO_ID,
    document_type,
    ...d,
    verified: d.status === "verified",
    created_at: new Date().toISOString(),
  }));
}

/** A demo "upload": nothing is sent anywhere; the document shows as verified. */
export function setDemoDocument(documentType: string, expirationDate?: string | null) {
  const prev = state.documents[documentType];
  set({
    ...state,
    documents: {
      ...state.documents,
      [documentType]: { status: "verified", file_url: "demo/sample", expiration_date: expirationDate ?? prev?.expiration_date ?? null },
    },
  });
}

/** The demo dashboard's week: five working days, Saturday and Sunday off.
 *  [Mon … Sun] Each day's full hours; what the dashboard shows comes from
 *  demoWeekSoFar (the rides that count by the clock). */
export const DEMO_WEEK = {
  dailyHours: [7.34, 8.69, 8.12, 9.05, 9.5, 0, 0],
  avgFare: 20.68,
  ytd: 82244.36,
};

/** The demo's monthly access fee and billing cycle, from the real calendar:
 *  the cycle is the current month, and the next fee is due on the 1st of next
 *  month. */
export const DEMO_ACCESS_FEE = 499.99;
export function demoBillingCycle(now = new Date()) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPast = now.getDate() - 1;
  const firstOf = (monthsAhead: number) => new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  return {
    daysPast,
    daysLeft: daysInMonth - daysPast,
    nextDue: firstOf(1),
    /** The last three fees, newest first: the 1st of this month and the two before. */
    paid: [0, -1, -2].map(firstOf),
  };
}
/** "1 ride", "6 rides", "0 deliveries": the count with the right form of the word. */
export const countOf = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const demoDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export type DemoJob = {
  /** Day and time label only (never a real date, so nothing is in the future). */
  when: string;
  kind: "Ride" | "Delivery";
  from: string;
  to: string;
  miles: number;
  /** miles × $2.68, to the cent */
  fare: number;
  minutes: number;
};

/** The demo week's 97 rides and deliveries, newest first: Monday to Friday,
 *  6:00 am to 6:00 pm, about 17 mph. Fictional places only. Each day's
 *  minutes add up to that day's hours; the fares add up to $2,005.96. */
export const DEMO_JOBS: DemoJob[] = [
  { when: "Fri 5:05 pm", kind: "Delivery", from: "Desert Paws Pet Supply", to: "Arrowhead Meadows", miles: 7.9, fare: 21.17, minutes: 29 },
  { when: "Fri 4:02 pm", kind: "Ride", from: "Camelback Valley Medical Center", to: "Copper Canyon Hotel", miles: 15.0, fare: 40.20, minutes: 52 },
  { when: "Fri 3:41 pm", kind: "Delivery", from: "Saguaro Street Deli", to: "Ahwatukee Commons", miles: 3.9, fare: 10.45, minutes: 14 },
  { when: "Fri 3:12 pm", kind: "Ride", from: "Piestewa Heights", to: "Copper Canyon Hotel", miles: 5.8, fare: 15.54, minutes: 20 },
  { when: "Fri 2:45 pm", kind: "Delivery", from: "Golden Lantern Noodle House", to: "Quail Run Lane", miles: 6.9, fare: 18.49, minutes: 25 },
  { when: "Fri 2:08 pm", kind: "Ride", from: "Copper Canyon Hotel", to: "Cottonwood Public Library", miles: 9.8, fare: 26.26, minutes: 35 },
  { when: "Fri 1:26 pm", kind: "Ride", from: "Palo Verde Ave", to: "Desert Sky Arena", miles: 9.8, fare: 26.26, minutes: 32 },
  { when: "Fri 1:02 pm", kind: "Ride", from: "Mesquite Transit Center", to: "Maricopa Valley College", miles: 6.9, fare: 18.49, minutes: 22 },
  { when: "Fri 12:34 pm", kind: "Ride", from: "Sonoran Executive Airfield", to: "Valley Air Terminal", miles: 7.9, fare: 21.17, minutes: 25 },
  { when: "Fri 11:48 am", kind: "Ride", from: "Arcadia Town Square", to: "Sun Valley Mall", miles: 9.8, fare: 26.26, minutes: 35 },
  { when: "Fri 11:11 am", kind: "Delivery", from: "Saguaro Street Deli", to: "Garfield Row", miles: 7.9, fare: 21.17, minutes: 25 },
  { when: "Fri 10:40 am", kind: "Delivery", from: "Ironwood Hardware", to: "Ahwatukee Commons", miles: 7.8, fare: 20.90, minutes: 26 },
  { when: "Fri 10:00 am", kind: "Ride", from: "Valley Air Terminal", to: "Tempe Marina Pier", miles: 9.8, fare: 26.26, minutes: 33 },
  { when: "Fri 9:24 am", kind: "Delivery", from: "Sunrise Mesa Bakery", to: "Garfield Row", miles: 7.8, fare: 20.90, minutes: 25 },
  { when: "Fri 8:54 am", kind: "Ride", from: "Copper Canyon Hotel", to: "Tempe Marina Pier", miles: 5.9, fare: 15.81, minutes: 19 },
  { when: "Fri 8:19 am", kind: "Ride", from: "Sonoran Executive Airfield", to: "Camelback Corporate Plaza", miles: 9.5, fare: 25.46, minutes: 31 },
  { when: "Fri 7:37 am", kind: "Ride", from: "Desert Sky Arena", to: "Cholla Ridge Park", miles: 9.4, fare: 25.19, minutes: 31 },
  { when: "Fri 7:00 am", kind: "Delivery", from: "Golden Lantern Noodle House", to: "Moon Valley Hills", miles: 7.8, fare: 20.90, minutes: 27 },
  { when: "Fri 6:20 am", kind: "Ride", from: "Valley Air Terminal", to: "Mesquite Transit Center", miles: 9.3, fare: 24.92, minutes: 33 },
  { when: "Fri 6:01 am", kind: "Delivery", from: "Ocotillo Florist", to: "Garfield Row", miles: 3.2, fare: 8.58, minutes: 13 },
  { when: "Thu 5:11 pm", kind: "Ride", from: "Arcadia Town Square", to: "Desert Sky Arena", miles: 8.9, fare: 23.85, minutes: 30 },
  { when: "Thu 4:22 pm", kind: "Ride", from: "Tempe Marina Pier", to: "Sonoran Executive Airfield", miles: 8.7, fare: 23.32, minutes: 30 },
  { when: "Thu 3:54 pm", kind: "Ride", from: "Copper Canyon Hotel", to: "Cottonwood Public Library", miles: 6.3, fare: 16.88, minutes: 21 },
  { when: "Thu 3:06 pm", kind: "Ride", from: "Tempe Marina Pier", to: "Sonoran Executive Airfield", miles: 9.6, fare: 25.73, minutes: 31 },
  { when: "Thu 2:22 pm", kind: "Ride", from: "Cholla Ridge Park", to: "Valley Air Terminal", miles: 7.7, fare: 20.64, minutes: 26 },
  { when: "Thu 2:03 pm", kind: "Delivery", from: "Ocotillo Florist", to: "Desert Willow Village", miles: 4.7, fare: 12.60, minutes: 16 },
  { when: "Thu 1:17 pm", kind: "Delivery", from: "Ocotillo Florist", to: "Saguaro Court", miles: 7.9, fare: 21.17, minutes: 28 },
  { when: "Thu 12:56 pm", kind: "Delivery", from: "Saguaro Street Deli", to: "Garfield Row", miles: 5.0, fare: 13.40, minutes: 17 },
  { when: "Thu 12:18 pm", kind: "Ride", from: "Arcadia Town Square", to: "Copper Canyon Hotel", miles: 6.9, fare: 18.49, minutes: 22 },
  { when: "Thu 11:42 am", kind: "Delivery", from: "Ironwood Hardware", to: "Quail Run Lane", miles: 8.0, fare: 21.44, minutes: 29 },
  { when: "Thu 11:14 am", kind: "Ride", from: "Camelback Corporate Plaza", to: "Arcadia Town Square", miles: 6.8, fare: 18.22, minutes: 24 },
  { when: "Thu 10:24 am", kind: "Ride", from: "Piestewa Heights", to: "Valley Air Terminal", miles: 9.3, fare: 24.92, minutes: 30 },
  { when: "Thu 9:34 am", kind: "Ride", from: "Tempe Marina Pier", to: "Mesquite Transit Center", miles: 10.0, fare: 26.80, minutes: 35 },
  { when: "Thu 9:00 am", kind: "Delivery", from: "Ironwood Hardware", to: "Garfield Row", miles: 5.7, fare: 15.28, minutes: 18 },
  { when: "Thu 8:26 am", kind: "Delivery", from: "Desert Paws Pet Supply", to: "Desert Willow Village", miles: 6.7, fare: 17.96, minutes: 23 },
  { when: "Thu 7:42 am", kind: "Ride", from: "Palo Verde Ave", to: "Tempe Marina Pier", miles: 9.4, fare: 25.19, minutes: 33 },
  { when: "Thu 6:54 am", kind: "Delivery", from: "Saguaro Street Deli", to: "Saguaro Court", miles: 10.1, fare: 27.07, minutes: 33 },
  { when: "Thu 6:05 am", kind: "Ride", from: "Camelback Corporate Plaza", to: "Tempe Marina Pier", miles: 10.0, fare: 26.80, minutes: 34 },
  { when: "Wed 5:04 pm", kind: "Ride", from: "Camelback Valley Medical Center", to: "Valley Air Terminal", miles: 8.8, fare: 23.58, minutes: 28 },
  { when: "Wed 4:26 pm", kind: "Delivery", from: "Saguaro Street Deli", to: "Arrowhead Meadows", miles: 6.7, fare: 17.96, minutes: 24 },
  { when: "Wed 3:52 pm", kind: "Ride", from: "Sun Valley Mall", to: "Palo Verde Ave", miles: 9.5, fare: 25.46, minutes: 32 },
  { when: "Wed 3:25 pm", kind: "Ride", from: "Palo Verde Ave", to: "Desert Sky Arena", miles: 5.2, fare: 13.94, minutes: 19 },
  { when: "Wed 2:41 pm", kind: "Ride", from: "Piestewa Heights", to: "Maricopa Valley College", miles: 9.1, fare: 24.39, minutes: 32 },
  { when: "Wed 2:19 pm", kind: "Delivery", from: "Sunrise Mesa Bakery", to: "Desert Willow Village", miles: 3.5, fare: 9.38, minutes: 13 },
  { when: "Wed 1:48 pm", kind: "Delivery", from: "Golden Lantern Noodle House", to: "Arcadia Gardens", miles: 7.0, fare: 18.76, minutes: 22 },
  { when: "Wed 1:06 pm", kind: "Ride", from: "Maricopa Valley College", to: "Arcadia Town Square", miles: 10.0, fare: 26.80, minutes: 33 },
  { when: "Wed 12:29 pm", kind: "Delivery", from: "Cactus Flats Pizza", to: "Garfield Row", miles: 7.5, fare: 20.10, minutes: 27 },
  { when: "Wed 11:34 am", kind: "Ride", from: "Arcadia Town Square", to: "Maricopa Valley College", miles: 12.1, fare: 32.43, minutes: 43 },
  { when: "Wed 11:07 am", kind: "Ride", from: "Sonoran Executive Airfield", to: "Arcadia Town Square", miles: 7.4, fare: 19.83, minutes: 24 },
  { when: "Wed 10:34 am", kind: "Delivery", from: "Mesa Fresh Grocer", to: "Arcadia Gardens", miles: 6.8, fare: 18.22, minutes: 24 },
  { when: "Wed 9:56 am", kind: "Ride", from: "Desert Sky Arena", to: "Piestewa Heights", miles: 9.0, fare: 24.12, minutes: 31 },
  { when: "Wed 9:30 am", kind: "Delivery", from: "Mesa Fresh Grocer", to: "Desert Willow Village", miles: 3.8, fare: 10.18, minutes: 12 },
  { when: "Wed 8:55 am", kind: "Ride", from: "Palo Verde Ave", to: "Tempe Marina Pier", miles: 6.7, fare: 17.96, minutes: 22 },
  { when: "Wed 8:27 am", kind: "Delivery", from: "Cactus Flats Pizza", to: "Ahwatukee Commons", miles: 5.8, fare: 15.54, minutes: 18 },
  { when: "Wed 7:49 am", kind: "Ride", from: "Mesquite Transit Center", to: "Maricopa Valley College", miles: 9.5, fare: 25.46, minutes: 31 },
  { when: "Wed 7:16 am", kind: "Ride", from: "Sonoran Executive Airfield", to: "Sun Valley Mall", miles: 6.7, fare: 17.96, minutes: 22 },
  { when: "Wed 6:27 am", kind: "Ride", from: "Camelback Valley Medical Center", to: "Maricopa Valley College", miles: 10.0, fare: 26.80, minutes: 36 },
  { when: "Wed 6:02 am", kind: "Delivery", from: "Sunrise Mesa Bakery", to: "Ahwatukee Commons", miles: 5.1, fare: 13.67, minutes: 17 },
  { when: "Tue 5:18 pm", kind: "Ride", from: "Cholla Ridge Park", to: "Camelback Valley Medical Center", miles: 6.9, fare: 18.49, minutes: 22 },
  { when: "Tue 4:53 pm", kind: "Delivery", from: "Cactus Flats Pizza", to: "Desert Willow Village", miles: 5.6, fare: 15.01, minutes: 18 },
  { when: "Tue 4:16 pm", kind: "Ride", from: "Camelback Corporate Plaza", to: "Sonoran Executive Airfield", miles: 8.2, fare: 21.98, minutes: 28 },
  { when: "Tue 3:34 pm", kind: "Ride", from: "Arcadia Town Square", to: "Camelback Corporate Plaza", miles: 8.5, fare: 22.78, minutes: 31 },
  { when: "Tue 3:03 pm", kind: "Delivery", from: "Ironwood Hardware", to: "Arcadia Gardens", miles: 8.0, fare: 21.44, minutes: 26 },
  { when: "Tue 2:29 pm", kind: "Ride", from: "Copper Canyon Hotel", to: "Sonoran Executive Airfield", miles: 7.1, fare: 19.03, minutes: 23 },
  { when: "Tue 1:51 pm", kind: "Ride", from: "Camelback Valley Medical Center", to: "Arcadia Town Square", miles: 9.8, fare: 26.26, minutes: 34 },
  { when: "Tue 1:16 pm", kind: "Ride", from: "Maricopa Valley College", to: "Sonoran Executive Airfield", miles: 8.7, fare: 23.32, minutes: 29 },
  { when: "Tue 12:53 pm", kind: "Delivery", from: "Glendale Corner Pharmacy", to: "Tatum Terrace", miles: 5.1, fare: 13.67, minutes: 16 },
  { when: "Tue 12:13 pm", kind: "Ride", from: "Mesquite Transit Center", to: "Arcadia Town Square", miles: 8.3, fare: 22.24, minutes: 28 },
  { when: "Tue 11:33 am", kind: "Delivery", from: "Mesa Fresh Grocer", to: "Moon Valley Hills", miles: 8.0, fare: 21.44, minutes: 28 },
  { when: "Tue 11:04 am", kind: "Ride", from: "Copper Canyon Hotel", to: "Tempe Marina Pier", miles: 7.2, fare: 19.30, minutes: 24 },
  { when: "Tue 10:26 am", kind: "Ride", from: "Camelback Valley Medical Center", to: "Valley Air Terminal", miles: 9.4, fare: 25.19, minutes: 30 },
  { when: "Tue 9:51 am", kind: "Delivery", from: "Sunrise Mesa Bakery", to: "Moon Valley Hills", miles: 9.6, fare: 25.73, minutes: 31 },
  { when: "Tue 9:19 am", kind: "Delivery", from: "Ironwood Hardware", to: "South Mountain Ridge", miles: 7.6, fare: 20.37, minutes: 24 },
  { when: "Tue 8:54 am", kind: "Ride", from: "Sun Valley Mall", to: "Cottonwood Public Library", miles: 6.3, fare: 16.88, minutes: 20 },
  { when: "Tue 8:18 am", kind: "Ride", from: "Mesquite Transit Center", to: "Desert Sky Arena", miles: 7.2, fare: 19.30, minutes: 25 },
  { when: "Tue 7:36 am", kind: "Ride", from: "Camelback Valley Medical Center", to: "Sonoran Executive Airfield", miles: 10.0, fare: 26.80, minutes: 36 },
  { when: "Tue 7:07 am", kind: "Delivery", from: "Cactus Flats Pizza", to: "Quail Run Lane", miles: 5.8, fare: 15.54, minutes: 21 },
  { when: "Tue 6:42 am", kind: "Delivery", from: "Desert Paws Pet Supply", to: "Tatum Terrace", miles: 5.5, fare: 14.74, minutes: 18 },
  { when: "Tue 6:05 am", kind: "Delivery", from: "Desert Paws Pet Supply", to: "Garfield Row", miles: 8.0, fare: 21.44, minutes: 28 },
  { when: "Mon 4:54 pm", kind: "Ride", from: "Sun Valley Mall", to: "Valley Air Terminal", miles: 9.1, fare: 24.39, minutes: 33 },
  { when: "Mon 4:15 pm", kind: "Delivery", from: "Saguaro Street Deli", to: "Desert Willow Village", miles: 7.6, fare: 20.37, minutes: 27 },
  { when: "Mon 3:34 pm", kind: "Delivery", from: "Cactus Flats Pizza", to: "Garfield Row", miles: 7.4, fare: 19.83, minutes: 29 },
  { when: "Mon 2:47 pm", kind: "Ride", from: "Tempe Marina Pier", to: "Maricopa Valley College", miles: 9.4, fare: 25.19, minutes: 33 },
  { when: "Mon 2:12 pm", kind: "Ride", from: "Palo Verde Ave", to: "Cottonwood Public Library", miles: 6.7, fare: 17.96, minutes: 24 },
  { when: "Mon 1:43 pm", kind: "Delivery", from: "Roadrunner Farmers Market", to: "Desert Willow Village", miles: 5.1, fare: 13.67, minutes: 18 },
  { when: "Mon 1:13 pm", kind: "Ride", from: "Arcadia Town Square", to: "Valley Air Terminal", miles: 5.0, fare: 13.40, minutes: 18 },
  { when: "Mon 12:47 pm", kind: "Delivery", from: "Saguaro Street Deli", to: "Garfield Row", miles: 6.6, fare: 17.69, minutes: 22 },
  { when: "Mon 12:13 pm", kind: "Delivery", from: "Cactus Flats Pizza", to: "Tatum Terrace", miles: 4.7, fare: 12.60, minutes: 16 },
  { when: "Mon 11:38 am", kind: "Ride", from: "Tempe Marina Pier", to: "Maricopa Valley College", miles: 8.2, fare: 21.98, minutes: 27 },
  { when: "Mon 11:22 am", kind: "Delivery", from: "Saguaro Street Deli", to: "South Mountain Ridge", miles: 3.0, fare: 8.04, minutes: 12 },
  { when: "Mon 10:49 am", kind: "Ride", from: "Arcadia Town Square", to: "Desert Sky Arena", miles: 6.9, fare: 18.49, minutes: 23 },
  { when: "Mon 9:59 am", kind: "Ride", from: "Sonoran Executive Airfield", to: "Cholla Ridge Park", miles: 8.5, fare: 22.78, minutes: 33 },
  { when: "Mon 9:14 am", kind: "Ride", from: "Maricopa Valley College", to: "Palo Verde Ave", miles: 6.9, fare: 18.49, minutes: 27 },
  { when: "Mon 8:08 am", kind: "Ride", from: "Sonoran Executive Airfield", to: "Copper Canyon Hotel", miles: 15.0, fare: 40.20, minutes: 50 },
  { when: "Mon 7:34 am", kind: "Delivery", from: "Mesa Fresh Grocer", to: "Quail Run Lane", miles: 5.5, fare: 14.74, minutes: 21 },
  { when: "Mon 6:50 am", kind: "Ride", from: "Arcadia Town Square", to: "Valley Air Terminal", miles: 8.5, fare: 22.78, minutes: 30 },
  { when: "Mon 6:05 am", kind: "Ride", from: "Cottonwood Public Library", to: "Camelback Corporate Plaza", miles: 9.6, fare: 25.73, minutes: 37 },
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Each DEMO_JOBS entry's day [Mon = 0 … Sun = 6] and start time (minutes
 *  after midnight), read from its "Fri 5:05 pm" label. */
const DEMO_JOB_STARTS = DEMO_JOBS.map((j) => {
  const m = /^(\w{3}) (\d{1,2}):(\d\d) (am|pm)$/.exec(j.when)!;
  return { day: DAY_NAMES.indexOf(m[1]), minute: ((+m[2] % 12) + (m[4] === "pm" ? 12 : 0)) * 60 + +m[3] };
});

/** The demo week by the clock, from DEMO_JOBS (the same rides every week,
 *  Monday to Sunday): a ride counts once the clock reaches its time stamp, so
 *  days before today are complete, today has the rides at or before now, and
 *  later days have none. Count, list, earnings and hours all come from here.
 *  Today's hours are its full hours × the share of its rides that count. */
export function demoWeekSoFar(now = new Date()) {
  const today = (now.getDay() + 6) % 7, minute = now.getHours() * 60 + now.getMinutes();
  const jobs: number[] = []; // indexes into DEMO_JOBS, newest first
  const cents = [0, 0, 0, 0, 0, 0, 0], done = [0, 0, 0, 0, 0, 0, 0], all = [0, 0, 0, 0, 0, 0, 0];
  DEMO_JOB_STARTS.forEach(({ day, minute: start }, i) => {
    all[day]++;
    if (day > today || (day === today && start > minute)) return;
    jobs.push(i);
    done[day]++;
    cents[day] += Math.round(DEMO_JOBS[i].fare * 100);
  });
  const rides = jobs.filter((i) => DEMO_JOBS[i].kind === "Ride").length;
  return {
    jobs,
    rides,
    deliveries: jobs.length - rides,
    dailyEarnings: cents.map((c) => c / 100),
    earnings: cents.reduce((s, c) => s + c, 0) / 100,
    dailyHours: DEMO_WEEK.dailyHours.map((h, d) =>
      d < today ? h : d > today || !all[d] ? 0 : Math.round((h * done[d] * 100) / all[d]) / 100),
  };
}

/** The demo Operator's work days [Mon … Sun]: the days of DEMO_WEEK with hours. */
export const DEMO_WORK_DAYS = DEMO_WEEK.dailyHours.map((h) => h > 0);

