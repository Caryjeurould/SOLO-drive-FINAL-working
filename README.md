# SOLO.drive — Independent Operator PWA

A Progressive Web App (PWA) designed for individual taxi and delivery operators to run their own business. Two apps in one platform: an **Operator Hub** (for drivers) and a **Customer Booking** app (for riders), each with separate authorization paths.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [App Architecture](#app-architecture)
- [Design System](#design-system)
- [Key Features](#key-features)
- [Roadmap](#roadmap)

---

## Project Overview

SOLO.drive is a "business-in-a-box" platform for solo drivers. Unlike traditional rideshare apps that take 20–40% per ride, SOLO.drive charges a flat quarterly subscription ($600/quarter) and lets operators keep 100% of every fare.

### Two Apps, One Platform

| App | Path | Audience |
|-----|------|----------|
| **Landing / Marketing** | `/` | Everyone |
| **Customer Booking** | `/customer`, `/customer/trip` | Riders looking to book a trip |
| **Operator Dashboard** | `/operator` | Approved drivers (gated by onboarding) |
| **Operator Vault** | `/operator/vault` | Document storage for verified operators |
| **Operator Onboarding** | `/operator/onboarding` | New driver applicants (4-stage wizard) |

### Smart Rate Engine

Fares are calculated automatically using a non-negotiable formula:

- **Base fare**: $4.50
- **Per mile**: $1.85
- **Fuel adjustment**: Scales with national gas price vs. $3.50 baseline
- **Peak hours**: 7–9 AM, 4–7 PM (×1.25)
- **Weekend**: Sat–Sun (×1.15)
- **Special events**: Configurable (×1.30)

Both customer and operator see the exact same price upfront — no surprises, no haggling.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [TanStack Start v1](https://tanstack.com/start) (full-stack React 19) |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 with custom CSS variables |
| UI Components | Radix UI primitives + custom glassmorphism components |
| Maps | Mapbox (configured, API key required) |
| State (v1) | localStorage (onboarding/demo state) |
| Backend (v1) | None — frontend shell only |
| Icons | Lucide React |
| Validation | Zod |
| Forms | React Hook Form |

---

## Prerequisites

- **Node.js** ≥ 20
- **Bun** ≥ 1.0 (preferred package manager)
- A **Mapbox public token** (free at [mapbox.com](https://account.mapbox.com/access-tokens/))

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# Mapbox (required for map rendering)
VITE_MAPBOX_TOKEN=pk.your_public_mapbox_token_here
```

> **Note:** This project is built for Lovable Cloud / edge deployment. Server-side secrets are managed through the Lovable secrets system, not committed `.env` files. Do not commit secrets to version control.

---

## Installation

```bash
# Clone or extract the project
cd tanstack_start_ts

# Install dependencies
bun install
```

---

## Running Locally

```bash
# Start the dev server
bun run dev
```

The app will be available at `http://localhost:3000` (or the port assigned by the sandbox).

### Available Routes (Local)

| URL | Description |
|-----|-------------|
| `http://localhost:3000/` | Marketing landing page |
| `http://localhost:3000/customer` | Customer booking flow |
| `http://localhost:3000/customer/trip` | Active trip view |
| `http://localhost:3000/operator/onboarding` | 4-stage operator authorization wizard |
| `http://localhost:3000/operator` | Operator dashboard (gated — requires approved onboarding) |
| `http://localhost:3000/operator/vault` | Document vault (gated) |

---

## Building for Production

```bash
# Production build
bun run build

# Development build (includes dev-mode debugging)
bun run build:dev

# Preview the production build locally
bun run preview
```

The build output is optimized for edge deployment (Cloudflare Workers compatible via `@cloudflare/vite-plugin`).

---

## Project Structure

```
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # shadcn/Radix UI primitives
│   │   ├── onboarding/      # Onboarding stage components
│   │   ├── AppShell.tsx     # Global app shell (header, layout)
│   │   ├── MapboxMap.tsx    # Mapbox map wrapper
│   │   └── OperatorGate.tsx # Route guard for operator pages
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Business logic & utilities
│   │   ├── onboarding.ts    # Onboarding state, validators, legal docs
│   │   ├── smart-rate.ts    # Fare calculation engine
│   │   ├── error-capture.ts # SSR error handling
│   │   └── error-page.ts    # Error page renderer
│   ├── routes/              # TanStack Start file-based routes
│   │   ├── __root.tsx       # Root layout (HTML shell, providers)
│   │   ├── index.tsx        # Landing page
│   │   ├── customer.tsx     # Customer booking
│   │   ├── customer.trip.tsx# Active trip
│   │   ├── operator.tsx     # Operator dashboard
│   │   ├── operator.vault.tsx # Document vault
│   │   └── operator.onboarding.tsx # 4-stage onboarding wizard
│   ├── router.tsx           # Router bootstrap with QueryClient
│   ├── server.ts            # SSR server entry (error wrapper)
│   ├── start.ts             # TanStack Start configuration
│   └── styles.css           # Design tokens, Tailwind theme, animations
├── public/                  # Static assets (PWA manifest, icons)
├── vite.config.ts           # Vite + TanStack Start configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies & scripts
```

---

## App Architecture

### TanStack Start File-Based Routing

Routes are defined by files in `src/routes/`. The router auto-generates `src/routeTree.gen.ts` — do not edit it manually.

Naming convention:
- `index.tsx` → `/`
- `customer.tsx` → `/customer`
- `customer.trip.tsx` → `/customer/trip`
- `operator.vault.tsx` → `/operator/vault`

Layouts with `<Outlet />` render child routes automatically.

### Operator Onboarding (Hard Wall)

New operators must complete a 4-stage wizard before accessing the dashboard:

1. **Identity & Vehicle** — Personal info, VIN validation, SSN, debit card (Luhn check), driver photo
2. **Disclosures & Legal** — Criminal record disclosure, scroll-enforced signing of 7 legal documents
3. **Background Check** — Simulated $9.99 third-party check (mocked for v1)
4. **Business & Insurance** — LLC/C-Corp/S-Corp entity, EIN, commercial insurance ($1M liability + $1M professional liability)

State persists in `localStorage` under key `solo.onboarding`. The `OperatorGate` component redirects unapproved users back to onboarding.

### Smart Rate Engine

Located in `src/lib/smart-rate.ts`. Calculates fares deterministically from:
- Pickup + dropoff distance (miles)
- Current hour (for peak detection)
- Day of week (for weekend multiplier)
- National gas price (for fuel adjustment)
- Optional special event flag

The engine returns a full breakdown showing every component of the fare.

---

## Design System

### Midnight Indigo Theme

A dark, modern tech aesthetic built entirely on CSS custom properties:

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | Deep indigo-black | Page background |
| `--primary` | Vibrant indigo | CTAs, accents, progress |
| `--primary-glow` | Soft violet | Highlights, gradients |
| `--surface` | Elevated dark card | Cards, panels |
| `--success` | Mint green | Positive states, earnings |
| `--destructive` | Warm red | Errors, warnings |

### Typography
- **Display**: Space Grotesk (headings, hero text)
- **Body**: DM Sans (UI text, forms, paragraphs)

### Effects
- Glassmorphism cards with `backdrop-blur-2xl`
- Gradient glows on primary elements
- Subtle grid background pattern
- Smooth floating animation on hero card

---

## Key Features

### Operator Side
- **Go Online / Go Offline** toggle with real-time status
- **Trip request cards** with Smart Rate fare preview
- **Document Vault** for insurance, license, background check results
- **Weekly 50-hour cap** enforcement
- **Quarterly subscription gate**
- **Hard-walled onboarding** — no dashboard access until fully verified

### Customer Side
- **Booking flow** with origin/destination input
- **Map visualization** of route
- **Smart Rate fare** displayed before booking
- **Legal waiver** required before first booking
- **Operator verification** badge (shows approved credentials)

---

## Roadmap

### v1 (Current) — Design + Frontend Shell
- [x] Landing page with marketing copy
- [x] Customer booking UI (no backend)
- [x] Operator dashboard UI (no backend)
- [x] Smart Rate engine (frontend logic)
- [x] 4-stage operator onboarding wizard (localStorage)
- [x] Document Vault UI
- [x] Mapbox map integration (requires token)

### v2 — Backend & Persistence
- [ ] Lovable Cloud database (user profiles, trips, documents)
- [ ] Real authentication (Supabase Auth)
- [ ] Move onboarding from localStorage to database
- [ ] Real-time trip matching
- [ ] Stripe payment integration ($9.99 BG check + quarterly subscription)
- [ ] Operator hours tracking with real-time enforcement

### v3 — Production
- [ ] Push notifications for trip requests
- [ ] GPS tracking during active trips
- [ ] Rating system
- [ ] Admin dashboard for platform oversight
- [ ] iOS / Android PWA packaging

---

## License

Proprietary — SOLO.drive / SmartLogix Design. All rights reserved.

## Support

For questions about this codebase, contact your development team or refer to the Lovable Cloud documentation.
