# SmartLogix Onboarding — Owner/Driver Authorization Path

Frontend-only build (per v1 scope: design + shell, no backend). State persists in `localStorage` so the gate can be demoed end-to-end. Customer side is untouched.

## Architecture

A single hard-gated wizard at `/operator/onboarding` with 4 stages. The existing `/operator` dashboard becomes inaccessible (redirects back to onboarding) until `status === "approved"`. The "Go Online" toggle stays gated by docs/hours/sub as today, but now also by onboarding approval.

```text
/operator/onboarding
  ├─ Stage 1: Identity & Vehicle      (must pass to unlock 2)
  ├─ Stage 2: Disclosures & Consent   (must pass to unlock 3)
  ├─ Stage 3: Background Check        (must pass to unlock 4)
  └─ Stage 4: Business & Commercial Insurance  → APPROVED
```

Each stage shows a locked state until the previous one is complete. No "skip", no back-door to `/operator` until stage 4 is approved.

## Stages & fields

**Stage 1 — Identity & Vehicle**
- Full name, residential address, smartphone #
- Vehicle: Make, Model, Year, VIN (17-char validation), personal auto insurance carrier + policy #
- SSN (masked input, last-4 shown), debit card # (masked, Luhn check)
- Self-upload photo (file input → preview, stored as data URL)

**Stage 2 — Disclosures & Legal**
- Felony convictions: dynamic list (add/remove rows: offense, year, jurisdiction)
- Misdemeanor convictions: same dynamic list
- "None" checkbox per category
- Read-and-sign panel for: Rules, Platform Policies, Regulations, Legal Agreement, Dispute Resolution, Release of Liability, Arbitration Acknowledgement
  - Each doc is a scroll-enforced viewer (reuse `ConsentGate` pattern from customer flow). Signature = typed full name + date, must match Stage 1 name.

**Stage 3 — Background Check**
- Explainer card: "$9.99 — processed by third party"
- "Begin Background Check" button → simulated external link → returns to a polling screen → after a short delay flips to "Cleared" (mocked, since no backend)
- Status badge: Not started / In progress / Cleared / Failed

**Stage 4 — Business Entity & Commercial Insurance**
- Entity type: LLC / C-Corp / S-Corp (radio)
- Legal entity name, EIN, state of formation, formation doc upload
- Commercial Auto Insurance: carrier, policy #, declarations page upload
  - Required minimums shown prominently: **$1,000,000 Liability** + **$1,000,000 Professional Liability**
  - Two checkboxes confirming each minimum is met
- Final "Submit for approval" → status becomes `approved`

## Hard wall

- New `useOnboardingStatus()` hook reads `localStorage["solo.onboarding"]` → `{ stage, status, data }`.
- `/operator` route: if status !== "approved", render a full-screen "Complete onboarding to access your dashboard" screen with a single CTA to `/operator/onboarding`. No partial dashboard preview.
- `/operator/vault` similarly gated.
- Landing page (`/`) "I'm an Operator" CTA routes to `/operator/onboarding` for new users, `/operator` for approved.

## Files

New:
- `src/lib/onboarding.ts` — types, storage helpers, stage definitions, validators (VIN, Luhn, EIN format)
- `src/routes/operator.onboarding.tsx` — wizard shell with stepper, lock states, persistence
- `src/components/onboarding/StageIdentity.tsx`
- `src/components/onboarding/StageDisclosures.tsx`
- `src/components/onboarding/StageBackground.tsx`
- `src/components/onboarding/StageBusiness.tsx`
- `src/components/onboarding/LegalDocViewer.tsx` — scroll-to-bottom + typed signature
- `src/components/OperatorGate.tsx` — wraps protected operator routes; redirects if not approved

Edited:
- `src/routes/operator.tsx` — wrap with `OperatorGate`
- `src/routes/operator.vault.tsx` — wrap with `OperatorGate`
- `src/routes/index.tsx` — operator CTA routes based on onboarding status

## Design

Stays in Midnight Indigo. Stepper uses the existing gradient-primary + glow tokens. Locked stages use muted surface + lock icon. Each stage is a glass card on a subtle gradient backdrop, with a sticky footer showing "Stage X of 4" and primary CTA.

## Out of scope (this iteration)

- Real third-party background check API
- Real document OCR/verification
- Server-side persistence (will move from `localStorage` to Lovable Cloud when backend is enabled later)
- Stripe for the $9.99 BG check fee (payments deferred per v1 decision)
