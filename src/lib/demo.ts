// The visitor demo (VISITOR_PASSWORD): a complete simulated Operator, held in
// memory only — never in the database (lib/supabase refuses every request in
// visitor mode) and never in device storage (the real onboarding progress in
// "solo.onboarding" is left alone). Closing the app ends the demo.
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { LEGAL_DOCS, type OnboardingState } from "@/lib/onboarding";
import type { OperatorProfile } from "@/hooks/useOperatorProfile";
import type { OperatorDocument } from "@/hooks/useDocuments";
import type { OperatorShift } from "@/hooks/useOperatorShift";

export const DEMO_DEFAULT_NAME = { first: "Demo", last: "Operator" };
/** The daily work window the demo Operator declared (shown beside the 50-hour weekly cap). */
export const DEMO_WORK_WINDOW_HOURS = 12;
const DEMO_ID = "00000000-0000-4000-8000-000000000000";

/** The sample Operator documents (images in public/demo/, plus a Business
 *  Liability card drawn in code). The documents always show this fixed
 *  person; the visitor's typed name still appears in agreements and pop-ups.
 *  Every prefilled vehicle / policy field in the demo reads from here. */
export const DEMO_DOCS = {
  name: "Marcus Paul Roberts",
  address: "1575 Montana Ave, Phoenix, AZ 85045",
  entity: "Roberts Transports - PHX LLC",
  entityState: "Arizona",
  vehicle: { year: "2020", make: "Toyota", model: "Camry", vin: "78XXTW35RT997302", plate: "XXX7722", plateType: "Standard" },
  registrationExpires: "08/25/2027",
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
    licenseFront: "/demo/license.png",
    licenseBack: "/demo/license-back.png",
    registration: "/demo/registration.png",
    commercialInsurance: "/demo/commercial-insurance.png",
    entity: "/demo/entity.png",
  },
} as const;

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
    address: DEMO_DOCS.address,
    vehMake: DEMO_DOCS.vehicle.make,
    vehModel: DEMO_DOCS.vehicle.model,
    vehYear: DEMO_DOCS.vehicle.year,
    vin: DEMO_DOCS.vehicle.vin,
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
    entityName: DEMO_DOCS.entity,
    ein: "00-0000000",
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

/** The demo dashboard's week: fixed, hand-typed numbers, the same at any day
 *  or time. Five working days, Saturday and Sunday off. [Mon … Sun] */
export const DEMO_WEEK = {
  dailyHours: [8.0, 9.0, 8.5, 8.0, 9.2, 0, 0],
  /** Each day's DEMO_JOBS fares added up. */
  dailyEarnings: [358.33, 430.95, 402.54, 379.76, 434.38, 0, 0],
  earnings: 2005.96,
  avgFare: 20.68,
  trips: 97,
  rides: 58,
  deliveries: 39,
  ytd: 82244.36,
  /** Billing cycle: 30 days, 11 past (the due date is counted from today). */
  billingDaysPast: 11,
  billingDaysLeft: 19,
};

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
  { when: "Fri 5:05 pm", kind: "Delivery", from: "Mock Pet Supply", to: "Test Meadows", miles: 7.9, fare: 21.17, minutes: 29 },
  { when: "Fri 4:02 pm", kind: "Ride", from: "Mock Medical Center", to: "Sample Hotel", miles: 15.0, fare: 40.20, minutes: 52 },
  { when: "Fri 3:41 pm", kind: "Delivery", from: "Demo Deli", to: "Mock Commons", miles: 3.9, fare: 10.45, minutes: 14 },
  { when: "Fri 3:12 pm", kind: "Ride", from: "Demo Heights", to: "Sample Hotel", miles: 5.8, fare: 15.54, minutes: 20 },
  { when: "Fri 2:45 pm", kind: "Delivery", from: "Sample Noodle House", to: "Placeholder Lane", miles: 6.9, fare: 18.49, minutes: 25 },
  { when: "Fri 2:08 pm", kind: "Ride", from: "Sample Hotel", to: "Mock Library", miles: 9.8, fare: 26.26, minutes: 35 },
  { when: "Fri 1:26 pm", kind: "Ride", from: "Demo Ave", to: "Demo Arena", miles: 9.8, fare: 26.26, minutes: 32 },
  { when: "Fri 1:02 pm", kind: "Ride", from: "Sample Station", to: "Example College", miles: 6.9, fare: 18.49, minutes: 22 },
  { when: "Fri 12:34 pm", kind: "Ride", from: "Example Airfield", to: "Test Terminal", miles: 7.9, fare: 21.17, minutes: 25 },
  { when: "Fri 11:48 am", kind: "Ride", from: "Test Town Square", to: "Mock Mall", miles: 9.8, fare: 26.26, minutes: 35 },
  { when: "Fri 11:11 am", kind: "Delivery", from: "Demo Deli", to: "Example Row", miles: 7.9, fare: 21.17, minutes: 25 },
  { when: "Fri 10:40 am", kind: "Delivery", from: "Demo Hardware", to: "Mock Commons", miles: 7.8, fare: 20.90, minutes: 26 },
  { when: "Fri 10:00 am", kind: "Ride", from: "Test Terminal", to: "Placeholder Pier", miles: 9.8, fare: 26.26, minutes: 33 },
  { when: "Fri 9:24 am", kind: "Delivery", from: "Example Bakery", to: "Example Row", miles: 7.8, fare: 20.90, minutes: 25 },
  { when: "Fri 8:54 am", kind: "Ride", from: "Sample Hotel", to: "Placeholder Pier", miles: 5.9, fare: 15.81, minutes: 19 },
  { when: "Fri 8:19 am", kind: "Ride", from: "Example Airfield", to: "Sample Plaza", miles: 9.5, fare: 25.46, minutes: 31 },
  { when: "Fri 7:37 am", kind: "Ride", from: "Demo Arena", to: "Example Park", miles: 9.4, fare: 25.19, minutes: 31 },
  { when: "Fri 7:00 am", kind: "Delivery", from: "Sample Noodle House", to: "Example Hills", miles: 7.8, fare: 20.90, minutes: 27 },
  { when: "Fri 6:20 am", kind: "Ride", from: "Test Terminal", to: "Sample Station", miles: 9.3, fare: 24.92, minutes: 33 },
  { when: "Fri 6:01 am", kind: "Delivery", from: "Test Florist", to: "Example Row", miles: 3.2, fare: 8.58, minutes: 13 },
  { when: "Thu 5:11 pm", kind: "Ride", from: "Test Town Square", to: "Demo Arena", miles: 8.9, fare: 23.85, minutes: 30 },
  { when: "Thu 4:22 pm", kind: "Ride", from: "Placeholder Pier", to: "Example Airfield", miles: 8.7, fare: 23.32, minutes: 30 },
  { when: "Thu 3:54 pm", kind: "Ride", from: "Sample Hotel", to: "Mock Library", miles: 6.3, fare: 16.88, minutes: 21 },
  { when: "Thu 3:06 pm", kind: "Ride", from: "Placeholder Pier", to: "Example Airfield", miles: 9.6, fare: 25.73, minutes: 31 },
  { when: "Thu 2:22 pm", kind: "Ride", from: "Example Park", to: "Test Terminal", miles: 7.7, fare: 20.64, minutes: 26 },
  { when: "Thu 2:03 pm", kind: "Delivery", from: "Test Florist", to: "Demo Village", miles: 4.7, fare: 12.60, minutes: 16 },
  { when: "Thu 1:17 pm", kind: "Delivery", from: "Test Florist", to: "Sample Court", miles: 7.9, fare: 21.17, minutes: 28 },
  { when: "Thu 12:56 pm", kind: "Delivery", from: "Demo Deli", to: "Example Row", miles: 5.0, fare: 13.40, minutes: 17 },
  { when: "Thu 12:18 pm", kind: "Ride", from: "Test Town Square", to: "Sample Hotel", miles: 6.9, fare: 18.49, minutes: 22 },
  { when: "Thu 11:42 am", kind: "Delivery", from: "Demo Hardware", to: "Placeholder Lane", miles: 8.0, fare: 21.44, minutes: 29 },
  { when: "Thu 11:14 am", kind: "Ride", from: "Sample Plaza", to: "Test Town Square", miles: 6.8, fare: 18.22, minutes: 24 },
  { when: "Thu 10:24 am", kind: "Ride", from: "Demo Heights", to: "Test Terminal", miles: 9.3, fare: 24.92, minutes: 30 },
  { when: "Thu 9:34 am", kind: "Ride", from: "Placeholder Pier", to: "Sample Station", miles: 10.0, fare: 26.80, minutes: 35 },
  { when: "Thu 9:00 am", kind: "Delivery", from: "Demo Hardware", to: "Example Row", miles: 5.7, fare: 15.28, minutes: 18 },
  { when: "Thu 8:26 am", kind: "Delivery", from: "Mock Pet Supply", to: "Demo Village", miles: 6.7, fare: 17.96, minutes: 23 },
  { when: "Thu 7:42 am", kind: "Ride", from: "Demo Ave", to: "Placeholder Pier", miles: 9.4, fare: 25.19, minutes: 33 },
  { when: "Thu 6:54 am", kind: "Delivery", from: "Demo Deli", to: "Sample Court", miles: 10.1, fare: 27.07, minutes: 33 },
  { when: "Thu 6:05 am", kind: "Ride", from: "Sample Plaza", to: "Placeholder Pier", miles: 10.0, fare: 26.80, minutes: 34 },
  { when: "Wed 5:04 pm", kind: "Ride", from: "Mock Medical Center", to: "Test Terminal", miles: 8.8, fare: 23.58, minutes: 28 },
  { when: "Wed 4:26 pm", kind: "Delivery", from: "Demo Deli", to: "Test Meadows", miles: 6.7, fare: 17.96, minutes: 24 },
  { when: "Wed 3:52 pm", kind: "Ride", from: "Mock Mall", to: "Demo Ave", miles: 9.5, fare: 25.46, minutes: 32 },
  { when: "Wed 3:25 pm", kind: "Ride", from: "Demo Ave", to: "Demo Arena", miles: 5.2, fare: 13.94, minutes: 19 },
  { when: "Wed 2:41 pm", kind: "Ride", from: "Demo Heights", to: "Example College", miles: 9.1, fare: 24.39, minutes: 32 },
  { when: "Wed 2:19 pm", kind: "Delivery", from: "Example Bakery", to: "Demo Village", miles: 3.5, fare: 9.38, minutes: 13 },
  { when: "Wed 1:48 pm", kind: "Delivery", from: "Sample Noodle House", to: "Demo Gardens", miles: 7.0, fare: 18.76, minutes: 22 },
  { when: "Wed 1:06 pm", kind: "Ride", from: "Example College", to: "Test Town Square", miles: 10.0, fare: 26.80, minutes: 33 },
  { when: "Wed 12:29 pm", kind: "Delivery", from: "Placeholder Pizza", to: "Example Row", miles: 7.5, fare: 20.10, minutes: 27 },
  { when: "Wed 11:34 am", kind: "Ride", from: "Test Town Square", to: "Example College", miles: 12.1, fare: 32.43, minutes: 43 },
  { when: "Wed 11:07 am", kind: "Ride", from: "Example Airfield", to: "Test Town Square", miles: 7.4, fare: 19.83, minutes: 24 },
  { when: "Wed 10:34 am", kind: "Delivery", from: "Example Grocer", to: "Demo Gardens", miles: 6.8, fare: 18.22, minutes: 24 },
  { when: "Wed 9:56 am", kind: "Ride", from: "Demo Arena", to: "Demo Heights", miles: 9.0, fare: 24.12, minutes: 31 },
  { when: "Wed 9:30 am", kind: "Delivery", from: "Example Grocer", to: "Demo Village", miles: 3.8, fare: 10.18, minutes: 12 },
  { when: "Wed 8:55 am", kind: "Ride", from: "Demo Ave", to: "Placeholder Pier", miles: 6.7, fare: 17.96, minutes: 22 },
  { when: "Wed 8:27 am", kind: "Delivery", from: "Placeholder Pizza", to: "Mock Commons", miles: 5.8, fare: 15.54, minutes: 18 },
  { when: "Wed 7:49 am", kind: "Ride", from: "Sample Station", to: "Example College", miles: 9.5, fare: 25.46, minutes: 31 },
  { when: "Wed 7:16 am", kind: "Ride", from: "Example Airfield", to: "Mock Mall", miles: 6.7, fare: 17.96, minutes: 22 },
  { when: "Wed 6:27 am", kind: "Ride", from: "Mock Medical Center", to: "Example College", miles: 10.0, fare: 26.80, minutes: 36 },
  { when: "Wed 6:02 am", kind: "Delivery", from: "Example Bakery", to: "Mock Commons", miles: 5.1, fare: 13.67, minutes: 17 },
  { when: "Tue 5:18 pm", kind: "Ride", from: "Example Park", to: "Mock Medical Center", miles: 6.9, fare: 18.49, minutes: 22 },
  { when: "Tue 4:53 pm", kind: "Delivery", from: "Placeholder Pizza", to: "Demo Village", miles: 5.6, fare: 15.01, minutes: 18 },
  { when: "Tue 4:16 pm", kind: "Ride", from: "Sample Plaza", to: "Example Airfield", miles: 8.2, fare: 21.98, minutes: 28 },
  { when: "Tue 3:34 pm", kind: "Ride", from: "Test Town Square", to: "Sample Plaza", miles: 8.5, fare: 22.78, minutes: 31 },
  { when: "Tue 3:03 pm", kind: "Delivery", from: "Demo Hardware", to: "Demo Gardens", miles: 8.0, fare: 21.44, minutes: 26 },
  { when: "Tue 2:29 pm", kind: "Ride", from: "Sample Hotel", to: "Example Airfield", miles: 7.1, fare: 19.03, minutes: 23 },
  { when: "Tue 1:51 pm", kind: "Ride", from: "Mock Medical Center", to: "Test Town Square", miles: 9.8, fare: 26.26, minutes: 34 },
  { when: "Tue 1:16 pm", kind: "Ride", from: "Example College", to: "Example Airfield", miles: 8.7, fare: 23.32, minutes: 29 },
  { when: "Tue 12:53 pm", kind: "Delivery", from: "Sample Pharmacy", to: "Sample Terrace", miles: 5.1, fare: 13.67, minutes: 16 },
  { when: "Tue 12:13 pm", kind: "Ride", from: "Sample Station", to: "Test Town Square", miles: 8.3, fare: 22.24, minutes: 28 },
  { when: "Tue 11:33 am", kind: "Delivery", from: "Example Grocer", to: "Example Hills", miles: 8.0, fare: 21.44, minutes: 28 },
  { when: "Tue 11:04 am", kind: "Ride", from: "Sample Hotel", to: "Placeholder Pier", miles: 7.2, fare: 19.30, minutes: 24 },
  { when: "Tue 10:26 am", kind: "Ride", from: "Mock Medical Center", to: "Test Terminal", miles: 9.4, fare: 25.19, minutes: 30 },
  { when: "Tue 9:51 am", kind: "Delivery", from: "Example Bakery", to: "Example Hills", miles: 9.6, fare: 25.73, minutes: 31 },
  { when: "Tue 9:19 am", kind: "Delivery", from: "Demo Hardware", to: "Mock Ridge", miles: 7.6, fare: 20.37, minutes: 24 },
  { when: "Tue 8:54 am", kind: "Ride", from: "Mock Mall", to: "Mock Library", miles: 6.3, fare: 16.88, minutes: 20 },
  { when: "Tue 8:18 am", kind: "Ride", from: "Sample Station", to: "Demo Arena", miles: 7.2, fare: 19.30, minutes: 25 },
  { when: "Tue 7:36 am", kind: "Ride", from: "Mock Medical Center", to: "Example Airfield", miles: 10.0, fare: 26.80, minutes: 36 },
  { when: "Tue 7:07 am", kind: "Delivery", from: "Placeholder Pizza", to: "Placeholder Lane", miles: 5.8, fare: 15.54, minutes: 21 },
  { when: "Tue 6:42 am", kind: "Delivery", from: "Mock Pet Supply", to: "Sample Terrace", miles: 5.5, fare: 14.74, minutes: 18 },
  { when: "Tue 6:05 am", kind: "Delivery", from: "Mock Pet Supply", to: "Example Row", miles: 8.0, fare: 21.44, minutes: 28 },
  { when: "Mon 4:54 pm", kind: "Ride", from: "Mock Mall", to: "Test Terminal", miles: 9.1, fare: 24.39, minutes: 33 },
  { when: "Mon 4:15 pm", kind: "Delivery", from: "Demo Deli", to: "Demo Village", miles: 7.6, fare: 20.37, minutes: 27 },
  { when: "Mon 3:34 pm", kind: "Delivery", from: "Placeholder Pizza", to: "Example Row", miles: 7.4, fare: 19.83, minutes: 29 },
  { when: "Mon 2:47 pm", kind: "Ride", from: "Placeholder Pier", to: "Example College", miles: 9.4, fare: 25.19, minutes: 33 },
  { when: "Mon 2:12 pm", kind: "Ride", from: "Demo Ave", to: "Mock Library", miles: 6.7, fare: 17.96, minutes: 24 },
  { when: "Mon 1:43 pm", kind: "Delivery", from: "Mock Market", to: "Demo Village", miles: 5.1, fare: 13.67, minutes: 18 },
  { when: "Mon 1:13 pm", kind: "Ride", from: "Test Town Square", to: "Test Terminal", miles: 5.0, fare: 13.40, minutes: 18 },
  { when: "Mon 12:47 pm", kind: "Delivery", from: "Demo Deli", to: "Example Row", miles: 6.6, fare: 17.69, minutes: 22 },
  { when: "Mon 12:13 pm", kind: "Delivery", from: "Placeholder Pizza", to: "Sample Terrace", miles: 4.7, fare: 12.60, minutes: 16 },
  { when: "Mon 11:38 am", kind: "Ride", from: "Placeholder Pier", to: "Example College", miles: 8.2, fare: 21.98, minutes: 27 },
  { when: "Mon 11:22 am", kind: "Delivery", from: "Demo Deli", to: "Mock Ridge", miles: 3.0, fare: 8.04, minutes: 12 },
  { when: "Mon 10:49 am", kind: "Ride", from: "Test Town Square", to: "Demo Arena", miles: 6.9, fare: 18.49, minutes: 23 },
  { when: "Mon 9:59 am", kind: "Ride", from: "Example Airfield", to: "Example Park", miles: 8.5, fare: 22.78, minutes: 33 },
  { when: "Mon 9:14 am", kind: "Ride", from: "Example College", to: "Demo Ave", miles: 6.9, fare: 18.49, minutes: 27 },
  { when: "Mon 8:08 am", kind: "Ride", from: "Example Airfield", to: "Sample Hotel", miles: 15.0, fare: 40.20, minutes: 50 },
  { when: "Mon 7:34 am", kind: "Delivery", from: "Example Grocer", to: "Placeholder Lane", miles: 5.5, fare: 14.74, minutes: 21 },
  { when: "Mon 6:50 am", kind: "Ride", from: "Test Town Square", to: "Test Terminal", miles: 8.5, fare: 22.78, minutes: 30 },
  { when: "Mon 6:05 am", kind: "Ride", from: "Mock Library", to: "Sample Plaza", miles: 9.6, fare: 25.73, minutes: 37 },
];

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
