---
spec-id: SPEC-243
title: "Hospeda mobile app (React Native / Expo)"
type: epic
complexity: high
status: in-progress
created: 2026-06-15T00:00:00Z
tags: [mobile, react-native, expo, native, tourist, host, push-notifications, qr-scan, geolocation]
---

# SPEC-243 — Hospeda mobile app (React Native / Expo)

## Overview

**Goal.** Build a native mobile application (`apps/mobile`) on top of the existing
Hospeda platform — a new Expo / React Native app that brings the full tourist-discovery
and host-management experience to iOS and Android. The mobile app is a **first-class
client of the Hono API** (public + protected tiers); it does not introduce a new
backend tier and does not touch the admin surface.

**Who it serves.** Both audiences the web app already targets — tourists discovering
accommodations, gastronomy, and experiences in Concepción del Uruguay and the Litoral;
and hosts managing their own fichas, consultas, and metrics. Role-based navigation
(from the Better Auth session) shows each user only what is relevant to their role. A
single binary is shipped for both audiences.

**Why native, not a PWA or Astro island.** The core value-adds require native device
APIs: push notifications (Expo Notifications), QR-code scanning of the Tarjeta Hospeda
credential without a browser permissions dance (Expo Camera / BarCodeScanner), and
background geolocation for "nearby" discovery (Expo Location). A native shell also
enables Play Store / App Store distribution and better offline capability than a PWA.
The Astro web app stays the primary web experience; the mobile app is additive.

**Relationship to the web app.** The mobile UI is **rebuilt from scratch** with React
Native primitives — no Astro components, no CSS Modules, no Tailwind. Only the
data and contract layer is shared: `@repo/schemas` (Zod), `@repo/i18n` (locale strings),
TypeScript types, and the Hono REST API (`/api/v1/public/*`, `/api/v1/protected/*`).
This is a deliberate architecture decision to avoid "lowest-common-denominator" shared
UI that would compromise both targets.

---

## Locked design decisions

- **New TurboRepo app**: `apps/mobile` — added to the pnpm workspace and Turbo pipeline
  alongside `apps/web`, `apps/api`, `apps/admin`.
- **Framework**: Expo SDK (latest stable at implementation time) + React Native. File-based
  routing via **Expo Router** (v3+).
- **Audience**: tourist + host in a single binary, role-gated navigation.
- **Admin tier not used**: the mobile app only calls `/api/v1/public/*` and
  `/api/v1/protected/*`. The `/api/v1/admin/*` tier is out of scope for this app.
- **UI layer rebuilt in RN**: no shared UI components with the web or admin apps.
- **Data layer reused**: `@repo/schemas`, `@repo/i18n`, and TypeScript types from
  `@repo/db`/`@repo/service-core` (read-only shape reuse, not logic).
- **Icon strategy**: `@repo/icons` wraps `@phosphor-icons/react` (web-only DOM SVG);
  it is NOT usable in React Native. Replace with a RN-compatible phosphor library
  (`phosphor-react-native`) or `@expo/vector-icons` — decided at Sub-0 foundation
  time. **Never import `@repo/icons` in `apps/mobile`.**
- **Auth**: Better Auth v1.4+ has an Expo/React Native client path via
  `better-auth/expo` and `@better-fetch/fetch`. Session handling, secure token
  storage (via `expo-secure-store`), and social OAuth flows must be validated
  against the actual BA version before implementation (flagged as "to-validate").
- **Native capabilities** (all via Expo managed workflow):
  - Push notifications: `expo-notifications` (device token → `HOSPEDA_API_URL`).
  - QR scan: `expo-camera` + `expo-barcode-scanner` (Tarjeta Hospeda QR, Sub-2).
  - Geolocation: `expo-location` (nearby discovery, Sub-1).
- **Sub-spec structure**: 5 sub-specs (Sub-0 through Sub-4) as detailed in the
  Sub-spec roadmap section. Sub-0 can start immediately; Sub-1/3/4 unblock after
  Sub-0; Sub-2 requires Sub-0 + SPEC-242 (Tarjeta Hospeda backend).
- **Dependency order**: SPEC-239 (Gastronomía) and SPEC-240 (Experiencias) must land
  before Sub-1 tourist discovery. SPEC-242 (Tarjeta Hospeda) must land before Sub-2.
  Sub-0 foundation and Sub-3/4 (host/account) have no external feature dependencies.
- **No billing admin surface**: entitlement display is read-only (plan name, usage
  indicators). No subscription management UI in v1.
- **Language**: Spanish default (es), same i18n keys as the web app where applicable;
  new `mobile.*` namespaced keys for mobile-only copy.

---

## Baseline (what exists to reuse)

**Packages available to `apps/mobile` today:**

- `@repo/schemas` — Zod schemas for all existing entities (`accommodation`,
  `destination`, `event`, `post`, `user`, `conversation`, `userBookmark`, etc.),
  fully typed. New entities added by SPEC-239/240/242 will extend this package.
- `@repo/i18n` — Locale files (`es/en/pt`) for all existing UI surfaces. Locale
  resolution logic (`createTranslations(locale)`) is framework-agnostic; works in
  RN. New locale keys for `gastronomy`, `experiencias`, `tarjeta` namespaces added
  by SPEC-239/240/242 will be consumed here.
- `@repo/logger` — Structured logging; framework-agnostic core, usable in RN with
  a console transport.
- `@repo/config` — Env-registry types (read-only shape; mobile reads env from
  `app.config.ts` / Expo constants, not the server registry directly).
- TypeScript types derived from `@repo/db` schema definitions (entity shapes) —
  usable as read-only type imports in mobile.

**API surface available (public + protected tiers):**

- `GET /api/v1/public/accommodations/*` — list, detail, reviews, amenities, FAQs,
  nearby (once geo endpoint exists).
- `GET /api/v1/public/destinations/*`, `events/*`, `posts/*`, `search/*`.
- `GET/POST /api/v1/protected/*` — user profile, bookmarks, conversations, billing
  usage (read-only entitlement display).
- Auth endpoints via Better Auth: `/api/auth/*` (sign-in, sign-up, session, sign-out).

**NOT reusable / requires rebuild:**

- All React components in `apps/web` (Astro + React islands, DOM-only).
- All React components in `apps/admin` (TanStack Start, Tailwind, DOM-only).
- `@repo/icons` — `@phosphor-icons/react` is DOM-SVG; throws in RN.
- `@repo/auth-ui` — sign-in/sign-up forms are DOM React; must be reimplemented in RN.
- `@repo/tailwind-config` / `@repo/design-tokens` — CSS/OKLCH tokens; not applicable
  in RN (StyleSheet or NativeWind as alternative — decided at Sub-0).

---

## Architecture

### Expo app in TurboRepo

`apps/mobile` is added as a standard pnpm workspace member. The `package.json`
references internal packages (`@repo/schemas`, `@repo/i18n`) and declares Expo SDK
dependencies. Turbo pipeline tasks:

- `build` → `expo export` (for OTA or EAS Build).
- `typecheck` → `tsc --noEmit`.
- `lint` → Biome (same config as other apps via `@repo/biome-config`).
- `test` → Vitest (unit/logic) + RN-specific test runner for components (`@testing-library/react-native`).

Metro bundler is Expo's default. TurboRepo's remote cache applies to `expo export`
outputs. The Expo managed workflow is preferred over bare (avoids native code
maintenance in CI); EAS Build handles native compilation.

### Data-layer reuse

The mobile app imports from `@repo/schemas` for Zod parse/validation and from
`@repo/i18n` for locale strings. No shared service logic (service-core is Node.js /
server-side). The mobile data-fetching layer is a thin **API client** (`src/lib/api/`)
that wraps `fetch` (native fetch available in Expo SDK 49+) or a lightweight
alternative, authenticated via the Better Auth session token sent as a cookie or
Bearer header.

### Navigation (Expo Router)

File-based routing in `apps/mobile/app/`:

```
app/
  _layout.tsx          # root layout, auth gate
  (auth)/
    sign-in.tsx
    sign-up.tsx
  (tourist)/
    _layout.tsx         # tourist tab navigator
    index.tsx           # discovery home
    accommodations/
      index.tsx
      [slug].tsx
    gastronomy/
      index.tsx
      [slug].tsx
    experiencias/
      index.tsx
      [slug].tsx
    nearby.tsx          # geolocation map
    tarjeta/
      index.tsx         # scan QR + benefits
  (host)/
    _layout.tsx         # host tab navigator
    dashboard.tsx
    fichas/
      index.tsx
      [id].tsx
    consultas/
      index.tsx
      [id].tsx
    metrics.tsx
  (shared)/
    profile.tsx
    settings.tsx
    notifications.tsx
```

Role-gated root layout: on session load, check `user.role`; navigate to
`/(tourist)` or `/(host)` accordingly. A user with both roles (uncommon) sees
a role-switcher in settings.

### Auth (Better Auth Expo)

Better Auth v1.4+ ships `better-auth/expo` client adapter. Session token stored in
`expo-secure-store` (encrypted key-value, replaces `localStorage`). The Expo client
adapter must be validated against the server's BA configuration (cookies vs Bearer,
session refresh, OAuth providers if added). **This is the single largest technical
risk in Sub-0** — allocate a spike task before committing the full auth implementation.

### API client strategy

`src/lib/api/client.ts` — a typed API client initialized with:

- `baseUrl`: from `expo-constants` / `app.config.ts` (`EXPO_PUBLIC_API_URL`).
- Auth: attaches the BA session token (cookie or Bearer).
- Zod parse: every response parsed with the matching `@repo/schemas` schema before
  returning (fail-fast on schema drift).

TanStack Query (`@tanstack/react-query`) for server-state caching and background
refresh — already a project dep in `apps/admin`; carry the same pattern to mobile.
React Query's `QueryClient` initialized in the root layout.

### Native capabilities

| Capability | Expo Package | Used in |
|---|---|---|
| Push notifications | `expo-notifications` | Sub-0 (device registration), all subs (receive) |
| QR / barcode scan | `expo-camera` + `expo-barcode-scanner` | Sub-2 (Tarjeta scan) |
| Geolocation | `expo-location` | Sub-1 (nearby discovery) |
| Secure storage | `expo-secure-store` | Sub-0 (auth token) |
| Deep linking | Expo Router built-in | Sub-0 (universal links for auth redirect) |

### Base design system

`apps/mobile/src/design/` — mobile-specific design tokens derived from the brand
palette (same color values as `@repo/design-tokens`, ported to JS objects for RN
`StyleSheet`). Typography, spacing scale, and radius constants defined here.
**Styling approach**: `StyleSheet.create` (RN standard) as the baseline; NativeWind
(Tailwind-for-RN) is a candidate for team velocity but requires evaluation in Sub-0.
The choice is locked in Sub-0 before any UI sub-spec starts.

Push notification setup in Sub-0: `expo-notifications` `getExpoPushTokenAsync()` →
`POST /api/v1/protected/profile/push-token` (new endpoint, small). Notification
receipt on foreground/background/killed handled per Expo docs.

---

## Reuse boundary

### Reused as-is

| Package | What is reused |
|---|---|
| `@repo/schemas` | Zod entity schemas, enums, request/response validation |
| `@repo/i18n` | Locale JSON files (`es/en/pt`), `createTranslations()` function |
| `@repo/logger` | Logging core (console transport in RN) |
| **Hono API** | All `/api/v1/public/*` and `/api/v1/protected/*` endpoints |
| TypeScript types | Entity shape types from `@repo/schemas` (import type only) |

### Rebuilt for RN

| Web/Admin Layer | Mobile equivalent |
|---|---|
| Astro pages + React islands | Expo Router screens + RN components |
| `@repo/icons` (phosphor-react DOM) | `phosphor-react-native` or `@expo/vector-icons` |
| `@repo/auth-ui` (DOM forms) | Native sign-in/sign-up screens in `apps/mobile` |
| CSS Modules + design tokens (CSS) | `StyleSheet.create` + JS token objects |
| TanStack Start routes (admin) | Expo Router file-based routes |
| Tailwind CSS (admin) | NativeWind (TBD) or vanilla StyleSheet (Sub-0 decision) |
| `@repo/tailwind-config` | Mobile design system in `apps/mobile/src/design/` |

### To validate

1. **Better Auth Expo session**: `better-auth/expo` adapter with `expo-secure-store`
   — confirm cookie/Bearer mode, session refresh on app resume, sign-out, and
   cross-platform behavior (iOS vs Android secure storage). Spike in Sub-0 T-003.
2. **Push token endpoint**: `POST /api/v1/protected/profile/push-token` does not
   exist yet. Small API addition in Sub-0.
3. **NativeWind vs StyleSheet**: NativeWind adds Tailwind DX but requires Babel
   plugin and can lag Expo SDK. Decide and document in Sub-0.
4. **Deep-link / universal-link config**: required for Better Auth OAuth redirect
   in Expo managed workflow.
5. **EAS Build setup**: `eas.json`, app identifiers (Apple/Google), environment
   variable injection via EAS Secrets. Needed before any testflight/internal test.
6. **TanStack Query in RN**: already used in admin; confirm RN compatibility with
   the version pinned in the monorepo.
7. **`@repo/i18n` tree-shake in Metro**: Metro bundler does not tree-shake the same
   way esbuild does — confirm locale JSON import sizes are acceptable.

---

## Sub-spec roadmap

| Sub-spec | Name | Scope summary | Key deliverables | Depends on | Can start when |
|---|---|---|---|---|---|
| **Sub-0** | Foundation | Expo monorepo setup, auth, API client, design system, push setup | `apps/mobile` scaffold, Expo Router, Better Auth Expo (spiked), API client + Zod parse, base design system (tokens, typography), push-token registration, CI integration | None (internal) | NOW |
| **Sub-1** | Tourist / Discovery | Accommodation listing + detail, gastronomy listing + detail, experiencias listing + detail, nearby map (geolocation) | 4 entity listing/detail screens, map screen with `expo-location` + MapLibre/MapView, bookmark toggle, reviews read-only | Sub-0 complete + SPEC-239 (gastronomy API) + SPEC-240 (experiencias API) merged | After Sub-0 + SPEC-239/240 |
| **Sub-2** | Tourist / Tarjeta Hospeda | QR scan flow, benefits display by destination, "me interesa" action, post-use survey (Phase 2) | Camera permission + QR scan screen, benefit list screen, host-QR display, "me interesa" endpoint call, Phase-2 survey entry point | Sub-0 complete + SPEC-242 (Tarjeta backend) | After Sub-0 + SPEC-242 |
| **Sub-3** | Host / Management | Host dashboard, fichas management (view + edit operational fields), consultas list + detail, basic metrics | Dashboard home screen, accommodation list/detail (host-scoped), consultas inbox + thread, metrics screen | Sub-0 complete | After Sub-0 |
| **Sub-4** | Account / Profile | Shared profile screen (both roles), settings (language, notifications), notification preference management, role-switcher (if user has multiple roles) | Profile read/edit screen, notification prefs screen, language selector, role-switcher, sign-out | Sub-0 complete | After Sub-0 |

**Parallel start note.** Sub-1, Sub-2, Sub-3, Sub-4 can all be worked in parallel
after Sub-0 ships, with Sub-1 and Sub-2 each additionally waiting on their respective
feature specs (SPEC-239/240 and SPEC-242). Sub-3 and Sub-4 have zero external spec
blockers beyond Sub-0.

---

## User Stories & Acceptance Criteria

### Sub-0 — Foundation

**US-F1** — A developer can run the mobile app in Expo Go or a simulator from the
monorepo with `pnpm dev --filter=mobile` (or `pnpm cli dev:mobile`).

- AC-F1.1: `apps/mobile` exists in the TurboRepo workspace; `turbo lint`/`typecheck`/`test` include it.
- AC-F1.2: Expo Router renders at least a placeholder home screen.
- AC-F1.3: CI (GitHub Actions) builds and typechecks the mobile app.

**US-F2** — A user can sign in and sign out; the session persists across app kills.

- AC-F2.1: Sign-in screen calls Better Auth email/password; session token stored in `expo-secure-store`.
- AC-F2.2: On app relaunch, existing session is restored without re-login.
- AC-F2.3: Sign-out clears the secure store and returns to the sign-in screen.

**US-F3** — The app registers for push notifications and stores the Expo push token server-side.

- AC-F3.1: On first authenticated launch, `getExpoPushTokenAsync()` is called; token POSTed to the API.
- AC-F3.2: Foreground notifications are displayed in-app; background notifications follow OS behavior.

### Sub-1 — Tourist / Discovery

**US-T1** — A tourist browses accommodations and opens a detail screen.

- AC-T1.1: Accommodation list shows thumbnail, name, destination, price range, and average rating.
- AC-T1.2: Detail screen shows all public fields (description, amenities, FAQs, reviews summary, gallery).
- AC-T1.3: Bookmark toggle works (authenticated user only; prompt to sign in if not).

**US-T2** — A tourist discovers nearby accommodations and gastronomy on a map.

- AC-T2.1: "Nearby" tab requests location permission via `expo-location`.
- AC-T2.2: Map (MapLibre RN or React Native Maps) shows pins for accommodations, gastronomy, and experiencias within a radius.
- AC-T2.3: Tapping a pin opens a bottom sheet with name + distance + detail link.

**US-T3** — A tourist browses gastronomy fichas (SPEC-239 entities).

- AC-T3.1: Gastronomy listing shows type badge, price range, name, and destination.
- AC-T3.2: Detail shows schedule, contact, menu link (if present), and map pin.

**US-T4** — A tourist browses experiencias (SPEC-240 entities).

- AC-T4.1: Experiencias listing shows type badge, price-from, and unit.
- AC-T4.2: Detail shows schedule, contact, and booking info (info + contact only — no in-app booking).

### Sub-2 — Tourist / Tarjeta Hospeda

**US-H1** — A tourist (guest) scans a host's Tarjeta Hospeda QR and sees the benefit list.

- AC-H1.1: Scan screen requests camera permission; decodes the host QR (contains hostId or credential token).
- AC-H1.2: After scan, the app calls the Tarjeta endpoint (SPEC-242) and shows benefits for the host's destination.
- AC-H1.3: Unauthenticated user is prompted to sign in / register to see benefits (the discount is the growth hook).

**US-H2** — A guest marks "me interesa" on a benefit.

- AC-H2.1: "Me interesa" button calls the SPEC-242 protected endpoint; confirmation shown.
- AC-H2.2: Post-use survey entry point exists (Phase 2 — can be a stub in v1).

### Sub-3 — Host / Management

**US-M1** — A host sees their dashboard with key metrics.

- AC-M1.1: Dashboard shows consultation count, active fichas count, and plan/entitlement summary (read-only).
- AC-M1.2: Data is fetched from the existing `/api/v1/protected/` host endpoints.

**US-M2** — A host views and edits operational fields of their accommodation.

- AC-M2.1: Fichas list shows all host-owned accommodations.
- AC-M2.2: Edit screen exposes only operational fields (schedule, contact, social, short description) — not identity/core fields.
- AC-M2.3: PATCH saved via `ACCOMMODATION_UPDATE_OWN` permission endpoint.

**US-M3** — A host reads and replies to consultas (conversation threads).

- AC-M3.1: Consultas list shows unread badge and latest message preview.
- AC-M3.2: Thread screen renders message history and a reply input.

### Sub-4 — Account / Profile

**US-A1** — Any authenticated user views and edits their profile.

- AC-A1.1: Profile screen shows name, email, avatar (read-only), location.
- AC-A1.2: Editable fields: name, phone, location. Saved via the existing profile endpoint.

**US-A2** — A user manages notification preferences and app language.

- AC-A2.1: Notification prefs screen shows toggles for push notification categories.
- AC-A2.2: Language selector (es/en/pt) persists to `expo-secure-store`; i18n updates immediately.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Better Auth Expo adapter not working as expected (session, secure store, OAuth) | Medium | High | Spike task in Sub-0 T-003 before committing auth implementation; fall back to manual token management if needed |
| Metro bundler incompatibility with internal package imports (`@repo/schemas`, `@repo/i18n`) | Medium | High | Validate in Sub-0 T-001; may need `metro.config.js` path aliases or package symlink resolution |
| `@phosphor-icons/react` import accidentally used in RN context (crashes with DOM errors) | Low | Medium | Biome custom rule or import lint to ban `@repo/icons` in `apps/mobile` |
| SPEC-239/240/242 not yet merged when Sub-1/2 need them | Medium | Medium | Sub-0/3/4 are fully parallelizable; track the dependency explicitly; Sub-1/2 can start with stub API responses |
| EAS Build setup and Apple/Google developer account access | Low | High | Identify account owners and credentials early; EAS setup is a Sub-0 task, not a blocker for development |
| Push notification delivery reliability on Android (Doze mode) | Medium | Low | Use Expo's FCM integration (managed); document known Android limitations |
| NativeWind version lag behind Expo SDK updates | Medium | Low | Evaluate in Sub-0; if problematic, use `StyleSheet.create` exclusively |
| App Store / Play Store review timeline | Low | High | Not a code risk, but a shipping-timeline risk; plan submission 2-3 weeks before target go-live |
| i18n locale JSON size in Metro bundle | Low | Low | Tree-shake by namespace or lazy-load locales; validate bundle size in Sub-0 |
| Host account surface leaks admin-tier features | Low | High | Strict tier enforcement in the API client: only public + protected endpoints; enforced via code review + lint |

---

## Out of Scope

- `/api/v1/admin/*` endpoints — the mobile app never calls the admin tier.
- In-app subscription management (plan upgrade, MercadoPago checkout). Read-only plan display only.
- Rich text content editing (TipTap equivalent) — operational fields on the host side are plain text.
- Offline-first / full offline mode — React Query caching provides basic stale-data UX but no offline write queue.
- Web Progressive Web App (PWA) — this spec is native only; PWA improvements to `apps/web` are separate.
- Any admin panel feature (platform settings, user management, billing admin, cron admin, etc.).
- In-app booking or reservation flow — the platform is currently information + contact only.
- Analytics SDK integration (PostHog, Sentry mobile) — recommended but tracked as follow-up tasks in each sub-spec.
- Oficios 24hs for hosts (SPEC-241) — out of v1 mobile scope; can be added as Sub-5 later.
- Desktop (macOS / iPad-optimized layout) — standard phone layout only in v1.
- Widgets (iOS WidgetKit, Android App Widgets) — future enhancement.

---

## Suggested Tasks

### Sub-0 — Foundation

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-001 | Scaffold `apps/mobile` — Expo SDK init, pnpm workspace, TurboRepo pipeline tasks (lint/typecheck/test/build) | 2 | — |
| T-002 | Configure Metro + Biome for monorepo internal packages (`@repo/schemas`, `@repo/i18n`) | 2 | T-001 |
| T-003 | Auth spike: validate `better-auth/expo` + `expo-secure-store` session flow (sign-in, persist, refresh, sign-out) | 3 | T-002 |
| T-004 | Implement sign-in + sign-up screens (native RN) using the spiked auth client | 2 | T-003 |
| T-005 | Root layout: role-gated navigator (tourist vs host), session restore on cold launch | 2 | T-004 |
| T-006 | Mobile design system: color tokens (JS objects from brand palette), typography, spacing, radius constants | 2 | T-001 |
| T-007 | Decide and wire styling strategy (NativeWind vs StyleSheet.create); document in ADR | 1 | T-006 |
| T-008 | Icon strategy: evaluate and integrate `phosphor-react-native` or `@expo/vector-icons`; add Biome rule banning `@repo/icons` in mobile | 1 | T-001 |
| T-009 | API client (`src/lib/api/client.ts`): typed fetch wrapper + Zod parse + auth header injection | 2 | T-003 |
| T-010 | TanStack Query setup: `QueryClient` in root layout, custom hooks pattern | 1 | T-009 |
| T-011 | Push notification setup: `expo-notifications` init, `getExpoPushTokenAsync`, new `POST /protected/profile/push-token` API endpoint | 3 | T-004 |
| T-012 | CI: add `apps/mobile` to GitHub Actions (typecheck + lint + test); EAS Build setup skeleton (`eas.json`, app identifiers) | 2 | T-001 |
| T-013 | Unit tests for API client (Zod parse, error handling), auth utilities, design token exports | 2 | T-009, T-006 |

### Sub-1 — Tourist / Discovery

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-020 | Accommodation list screen: API hook, card component, pagination | 2 | T-010 |
| T-021 | Accommodation detail screen: full public fields, amenities, FAQs, reviews summary, gallery | 3 | T-020 |
| T-022 | Bookmark toggle component (authenticated gate + optimistic update) | 2 | T-021 |
| T-023 | Destination filter + search bar on accommodation list | 2 | T-020 |
| T-024 | Gastronomy list + detail screens (SPEC-239 entities) | 2 | T-010, SPEC-239 merged |
| T-025 | Experiencias list + detail screens (SPEC-240 entities) | 2 | T-010, SPEC-240 merged |
| T-026 | Nearby map screen: `expo-location` permission flow, MapLibre RN or React Native Maps, pin clustering | 4 | T-010 |
| T-027 | Bottom-sheet detail on map pin tap | 2 | T-026 |
| T-028 | Tests: accommodation list/detail hooks, bookmark toggle, location permission mock | 2 | T-021, T-026 |

### Sub-2 — Tourist / Tarjeta Hospeda

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-030 | QR scan screen: `expo-camera` + `expo-barcode-scanner` permission flow + decode host credential | 3 | T-005, SPEC-242 merged |
| T-031 | Benefit list screen: call Tarjeta endpoint, display by destination, "me interesa" action | 2 | T-030 |
| T-032 | Unauthenticated QR scan → sign-in/register prompt (growth hook) | 1 | T-030, T-004 |
| T-033 | Phase-2 survey entry point stub (screen scaffolded, content deferred) | 1 | T-031 |
| T-034 | Tests: QR decode logic, benefit list hook, "me interesa" optimistic update | 2 | T-031 |

### Sub-3 — Host / Management

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-040 | Host dashboard screen: consultation count, fichas count, plan summary | 2 | T-010 |
| T-041 | Fichas list screen (host-scoped accommodations) | 2 | T-040 |
| T-042 | Ficha detail + operational-fields edit screen (PATCH via protected endpoint) | 3 | T-041 |
| T-043 | Consultas list screen with unread badge | 2 | T-010 |
| T-044 | Consulta thread screen + reply input | 3 | T-043 |
| T-045 | Metrics screen (basic) | 2 | T-040 |
| T-046 | Tests: dashboard hooks, ficha edit form validation, consulta reply | 2 | T-042, T-044 |

### Sub-4 — Account / Profile

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-050 | Profile read/edit screen (name, phone, location) | 2 | T-005 |
| T-051 | Notification preferences screen (push category toggles) | 2 | T-011 |
| T-052 | Language selector (es/en/pt) with `expo-secure-store` persistence | 1 | T-006 |
| T-053 | Role-switcher (for users with multiple roles) | 2 | T-005 |
| T-054 | Sign-out + account deletion stub | 1 | T-004 |
| T-055 | Tests: profile update, language switch, role-switcher | 2 | T-050, T-052, T-053 |

---

## Open micro-decisions

> **RESOLVED (2026-06-15) in [ADR-034](../../../docs/decisions/ADR-034-mobile-app-foundation.md).**
> Sub-0 locks: (1) `StyleSheet.create`, (2) `phosphor-react-native`, (3) transport
> deferred to the auth spike (T-003), (4) map library deferred to Sub-1 (T-026),
> (5) eager locale loading (validate size in T-002), (6) single push channel v1,
> (7) EAS Build. The original analysis below is retained for context.

1. **Styling strategy (NativeWind vs StyleSheet.create)** — Proposed default:
   `StyleSheet.create` (no extra build plugin risk). NativeWind if team already
   knows Tailwind well and it's tested green with the current Expo SDK version.
   Lock this in Sub-0 T-007 before any UI work starts.

2. **Icon package** — Proposed default: `phosphor-react-native` (same icon set as
   web, closest design parity). Alternative: `@expo/vector-icons` (larger, less
   branded). Lock in Sub-0 T-008.

3. **Map library** — Proposed default: `react-native-maps` (Google Maps / Apple Maps,
   zero extra infra). Alternative: MapLibre RN (open-source tiles, no SDK key
   needed). Decision has cost implications (Google Maps billing). Lock in Sub-1 T-026.

4. **API client transport** — Proposed default: native `fetch` (Expo SDK 49+ global).
   Alternative: `axios` or `@better-fetch/fetch` (if Better Auth Expo requires it).
   Lock in Sub-0 T-009.

5. **Locale loading strategy in Metro** — Proposed default: import all three locale
   JSONs eagerly (small footprint). Alternative: lazy-load by detected locale.
   Validate bundle size in Sub-0 T-002 before deciding.

6. **Push notification channel / categories** — Proposed default: single channel v1,
   per-category prefs added in Sub-4. Lock in Sub-0 T-011.

7. **EAS vs local builds** — Proposed default: EAS Build for CI and distribution.
   Local bare workflow only if EAS has blocking issues. Lock in Sub-0 T-012.

---

## Dependencies

### Other Hospeda specs

| Spec | What is blocked | Can start without? |
|---|---|---|
| SPEC-239 (Gastronomía) | Sub-1 T-024 (gastronomy screens) | Yes — Sub-0, Sub-3, Sub-4 start without it |
| SPEC-240 (Experiencias y Servicios) | Sub-1 T-025 (experiencias screens) | Yes |
| SPEC-242 (Tarjeta Hospeda) | Sub-2 entirely | Yes — Sub-0/1/3/4 start without it |

### External dependencies (Expo / third-party)

| Dependency | Purpose | Risk |
|---|---|---|
| Expo SDK (latest stable) | Runtime + native module wrappers | Low — managed workflow abstracts native changes |
| `better-auth` v1.4+ `better-auth/expo` | Auth client in RN | Medium — validate in spike |
| `expo-secure-store` | Encrypted session token storage | Low |
| `expo-notifications` | Push notifications | Low |
| `expo-camera` / `expo-barcode-scanner` | QR scan | Low |
| `expo-location` | Geolocation (nearby discovery) | Low |
| `@tanstack/react-query` | Server-state caching | Low (already in admin) |
| `phosphor-react-native` | Icons in RN (proposed) | Low |
| EAS Build | Native compilation + distribution | Medium (account setup) |

### New environment variables needed

| Variable | Scope | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `apps/mobile` build-time | API base URL for the RN fetch client |
| `EXPO_PUBLIC_APP_ENV` | `apps/mobile` build-time | `development` / `staging` / `production` |
| EAS Secrets (Apple/Google creds, etc.) | EAS Build only | Native build signing |

After registering env vars: notify owner to add `EXPO_PUBLIC_API_URL` to EAS Secrets
for each build profile (`development`, `preview`, `production`).
