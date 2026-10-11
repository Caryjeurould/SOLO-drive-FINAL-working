// The visitor demo (VISITOR_PASSWORD): a complete simulated Operator, held in
// memory only — never in the database (lib/supabase refuses every request in
// visitor mode) and never in device storage (the real onboarding progress in
// "solo.onboarding" is left alone). Closing the app ends the demo.
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { LEGAL_DOCS, type OnboardingState } from "@/lib/onboarding";
import type { OperatorProfile } from "@/hooks/useOperatorProfile";
import type { OperatorDocument } from "@/hooks/useDocuments";
import type { Trip } from "@/hooks/useTrips";
import type { OperatorShift } from "@/hooks/useOperatorShift";

export const DEMO_DEFAULT_NAME = { first: "Demo", last: "Operator" };
/** The daily work window the demo Operator declared (shown beside the 50-hour weekly cap). */
export const DEMO_WORK_WINDOW_HOURS = 12;
const DEMO_ID = "00000000-0000-4000-8000-000000000000";

type DemoState = {
  started: boolean;
  first: string;
  last: string;
  onboarding: OnboardingState;
  profile: Partial<OperatorProfile>;
  documents: Record<string, Pick<OperatorDocument, "status" | "expiration_date" | "file_url">>;
  shift: OperatorShift | null;
};

const EMPTY_ONBOARDING: OnboardingState = { stage: 1, status: "not_started", data: {} };
const fresh = (): DemoState => ({
  started: false,
  first: "",
  last: "",
  onboarding: EMPTY_ONBOARDING,
  profile: {},
  documents: {},
  shift: null,
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

/** A plain initials badge as the sample self photo. */
function samplePhoto(first: string, last: string) {
  const initials = `${first[0] ?? "D"}${last[0] ?? "O"}`.toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="16" fill="#3b4cca"/><text x="48" y="58" font-family="sans-serif" font-size="32" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text><text x="48" y="84" font-family="sans-serif" font-size="10" fill="#fff" text-anchor="middle">SAMPLE</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Obviously fake sample answers for every wizard field, with all four stages
 *  already completed: every document signed with the visitor's name, the
 *  background check cleared, both coverage confirmations filled in. */
function sampleOnboardingData(first: string, last: string): OnboardingState["data"] {
  const name = `${first} ${last}`;
  const signedAt = new Date().toISOString();
  return {
    fullName: name,
    phone: "(555) 010-0100",
    address: "100 Sample Street, Demo City, NY 00000",
    vehMake: "Toyota",
    vehModel: "Camry",
    vehYear: "2022",
    vin: "SAMPLE00000000000",
    autoCarrier: "Demo Mutual",
    autoPolicy: "DEMO-AUTO-0001",
    ssn: "000-00-0000",
    debit: "4242 4242 4242 4242",
    photoDataUrl: samplePhoto(first, last),
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
    entityName: `${last} Transport LLC`,
    ein: "00-0000000",
    formationState: "Delaware",
    commCarrier: "Demo Commercial",
    commPolicy: "DEMO-COMM-0001",
    commInsuranceExpiration: yearsFromNow(1),
    profInsuranceExpiration: yearsFromNow(1),
    bizLiabPolicy: "T2388-U66-23094",
    bizLiabLimit: "$1,000,000",
    bizLiabCarrier: "Farmers",
    confirmBizLiability: true,
    commLiabPolicy: "DEMO-AUTO-0001",
    commLiabLimit: "$1,000,000",
    commLiabCarrier: "Demo Mutual",
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
    insurance: doc(yearsFromNow(1)),
    professional_insurance: doc(yearsFromNow(1)),
    background: doc(yearsFromNow(1)),
    criminal: doc(null),
  };
}

/** The name screen: starts the demo as this person (blank → "Demo Operator"). */
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
}

export function resetDemo() {
  set(fresh());
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

/** Sample trips spread over the current week (Monday start), up to now. */
export function demoTrips(): Trip[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const samples: [number, number, string, string, number, number, number][] = [
    // [day, hour, pickup, dropoff, fare, miles, minutes]
    [0, 8, "Demo Ave", "Sample Plaza", 24.5, 6.2, 95],
    [0, 15, "Test Terminal", "Demo Ave", 41.0, 12.8, 130],
    [1, 9, "Sample Plaza", "Mock Mall", 18.75, 4.1, 80],
    [1, 17, "Mock Mall", "Example Park", 33.2, 9.6, 115],
    [2, 7, "Example Park", "Test Terminal", 63.9, 21.4, 150],
    [3, 12, "Demo Ave", "Placeholder Pier", 27.4, 7.7, 100],
    [4, 10, "Placeholder Pier", "Sample Plaza", 22.1, 5.5, 90],
    [5, 14, "Sample Plaza", "Demo Ave", 45.6, 14.3, 140],
  ];
  return samples
    .map(([day, hour, pickup, dropoff, fare, distance, duration], i) => {
      const at = new Date(monday);
      at.setDate(monday.getDate() + day);
      at.setHours(hour);
      return { id: `demo-trip-${i}`, operator_id: DEMO_ID, pickup, dropoff, fare, distance, duration, created_at: at.toISOString() };
    })
    .filter((t) => new Date(t.created_at) <= now)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoShift(): OperatorShift | null {
  return state.shift;
}
export function setDemoShift(shift: OperatorShift | null) {
  set({ ...state, shift });
}
export function newDemoShift(serviceType: OperatorShift["service_type"]): OperatorShift {
  return {
    id: "demo-shift",
    operator_id: DEMO_ID,
    service_type: serviceType,
    started_at: new Date().toISOString(),
    ended_at: null,
    last_lat: null,
    last_lng: null,
    last_location_at: null,
  };
}
