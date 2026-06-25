import { useEffect, useState } from "react";

export type OnboardingStatus = "not_started" | "in_progress" | "approved";

export type OnboardingState = {
  stage: 1 | 2 | 3 | 4;
  status: OnboardingStatus;
  data: {
    // Stage 1
    fullName?: string;
    address?: string;
    phone?: string;
    vehMake?: string;
    vehModel?: string;
    vehYear?: string;
    vin?: string;
    autoCarrier?: string;
    autoPolicy?: string;
    ssn?: string;
    debit?: string;
    photoDataUrl?: string;
    licenseExpiration?: string;
    stage1Complete?: boolean;
    // Stage 2
    felonies?: { offense: string; year: string; jurisdiction: string }[];
    feloniesNone?: boolean;
    misd?: { offense: string; year: string; jurisdiction: string }[];
    misdNone?: boolean;
    signedDocs?: Record<string, { name: string; signature: string; signedAt: string }>;
    stage2Complete?: boolean;
    // Stage 3
    bgStatus?: "not_started" | "in_progress" | "cleared" | "failed";
    bgStartedAt?: number;
    stage3Complete?: boolean;
    // Stage 4
    entityType?: "LLC" | "C-Corp" | "S-Corp";
    entityName?: string;
    ein?: string;
    formationState?: string;
    commCarrier?: string;
    commPolicy?: string;
    commInsuranceExpiration?: string;
    profInsuranceExpiration?: string;
    confirmLiability?: boolean;
    confirmProfLiability?: boolean;
    stage4Complete?: boolean;
  };
};

const KEY = "solo.onboarding";

const initial: OnboardingState = { stage: 1, status: "not_started", data: {} };

export function readOnboarding(): OnboardingState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    return { ...initial, ...(JSON.parse(raw) as OnboardingState) };
  } catch {
    return initial;
  }
}

export function writeOnboarding(s: OnboardingState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("solo:onboarding-change"));
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(initial);
  useEffect(() => {
    setState(readOnboarding());
    const h = () => setState(readOnboarding());
    window.addEventListener("solo:onboarding-change", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("solo:onboarding-change", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  const update = (patch: Partial<OnboardingState> | ((s: OnboardingState) => OnboardingState)) => {
    const next = typeof patch === "function" ? patch(state) : { ...state, ...patch, data: { ...state.data, ...(patch.data ?? {}) } };
    setState(next);
    writeOnboarding(next);
  };
  return [state, update] as const;
}

// Validators
export function isValidVIN(v?: string) {
  if (!v) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(v.trim());
}
export function luhn(num?: string) {
  if (!num) return false;
  const s = num.replace(/\D/g, "");
  if (s.length < 13) return false;
  let sum = 0, alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = parseInt(s[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}
export function isValidEIN(e?: string) {
  return !!e && /^\d{2}-?\d{7}$/.test(e.trim());
}
export function isValidSSN(s?: string) {
  return !!s && /^\d{3}-?\d{2}-?\d{4}$/.test(s.trim());
}

export const LEGAL_DOCS: { id: string; title: string; body: string }[] = [
  { id: "rules", title: "SOLO.drive Operator Rules", body: "As an independent operator on SOLO.drive, you agree to maintain a clean vehicle, professional conduct, and abide by all federal, state, and local transportation laws. You acknowledge the 50-hour weekly online cap is a hard safety limit and may not be circumvented. You will not discriminate against any passenger for any protected characteristic. You will not operate a vehicle while impaired by any substance. You will accept the Smart Rate fare as quoted, with no off-platform negotiation, and will deliver every booked trip absent a documented safety concern." },
  { id: "policies", title: "Platform Policies", body: "SOLO.drive is a technology platform connecting independent operators with riders. SOLO.drive is not your employer, principal, or agent. You are solely responsible for your business operations, tax obligations, vehicle maintenance, and compliance with applicable regulations. You authorize SOLO.drive to display your verified credentials to prospective riders. You agree to keep your Document Vault current; expired insurance or licensure will automatically take you offline." },
  { id: "regulations", title: "Regulatory Acknowledgement", body: "You acknowledge that taxi and for-hire operations are regulated at the city, state, and federal levels. You represent that you hold all licenses, permits, medallions, or TNC authorities required in every jurisdiction in which you operate. You understand that SOLO.drive does not verify regulatory licensure on your behalf and that operating without proper authority is your sole liability." },
  { id: "agreement", title: "Operator Legal Agreement", body: "This Operator Legal Agreement is a binding contract between you and SOLO.drive. You grant SOLO.drive a limited, revocable license to display your business profile, vehicle details, and verified credentials to riders. You retain 100% of fares net of any third-party processing fees. SOLO.drive's compensation is the flat quarterly subscription. Either party may terminate this agreement on 30 days notice; SOLO.drive may suspend access immediately for material breach, safety concerns, or regulatory action." },
  { id: "dispute", title: "Dispute Resolution", body: "Any dispute, claim, or controversy arising out of or relating to this Agreement or the SOLO.drive platform shall first be submitted to good-faith negotiation between the parties for thirty (30) days. If unresolved, the dispute shall proceed to mediation administered by a mutually-selected neutral mediator. Mediation costs shall be split equally. If mediation fails, the dispute shall proceed to binding arbitration as set forth below." },
  { id: "release", title: "Release of Liability", body: "To the fullest extent permitted by law, you release, waive, and discharge SOLO.drive, its officers, directors, employees, and affiliates from any and all liability, claims, demands, actions, and causes of action arising out of or related to your use of the platform, your operation of any vehicle, your interactions with riders, or any incident occurring during the course of providing transportation services. You acknowledge that you maintain commercial auto and professional liability insurance as the primary coverage for any such claims." },
  { id: "arbitration", title: "Arbitration Acknowledgement & Agreement", body: "YOU AND SOLO.DRIVE AGREE THAT ANY DISPUTE NOT RESOLVED THROUGH NEGOTIATION OR MEDIATION SHALL BE RESOLVED EXCLUSIVELY BY FINAL AND BINDING INDIVIDUAL ARBITRATION administered by JAMS under its Streamlined Arbitration Rules. The seat of arbitration shall be Wilmington, Delaware. YOU WAIVE ANY RIGHT TO A JURY TRIAL AND ANY RIGHT TO PARTICIPATE IN A CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION. Either party may seek injunctive relief in a court of competent jurisdiction to protect intellectual property pending arbitration." },
];
