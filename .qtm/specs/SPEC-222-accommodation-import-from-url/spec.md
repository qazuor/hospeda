---
spec-id: SPEC-222
title: Accommodation import from URL
type: feature
complexity: high
status: draft
created: 2026-06-13T12:00:00Z
revised: 2026-06-15T00:00:00Z
---

# SPEC-222 — Accommodation import from URL

## Overview

**Goal.** Let an authenticated host (or admin) paste a public URL from an
external platform (MercadoLibre, Google Maps/Business, Booking.com, Airbnb, or a
generic accommodation site) and have the system extract structured listing data
to **pre-fill** the accommodation creation/edit form. The host reviews every
field — each annotated with a confidence badge and its extraction source — and
confirms before anything is saved. The import is never blind and never persists
on its own.

**Motivation.** The current "nueva propiedad" flow (`/[lang]/publicar/nueva`)
creates a minimal draft and sends the host to fill in the rest by hand. Many
hosts already have the property listed elsewhere; a one-click import removes the
duplicate typing and improves onboarding conversion and listing quality.

**What this is NOT.** Not an official platform integration (except where a free
official API exists — see below), not sync, not a channel manager, not review/
calendar/price/reservation import, not bulk scraping, not crawling.

> **Reviews are explicitly and entirely out of scope.** This import must NEVER
> read, extract, map, persist, or even surface external reviews, ratings, rating
> breakdowns, or guest comments — not as Hospeda `rating`, not as advisory hints,
> not anywhere. Where a source (e.g. the Apify Airbnb actor, Booking JSON-LD
> `aggregateRating`) returns review/rating data, the adapter MUST strip those
> fields from `RawExtraction` before mapping. Importing reviews will be handled
> by a **separate future spec with a different approach** — it is deliberately not
> part of this feature.

**Stateless.** The endpoint persists nothing about the import itself (no audit
table). It is a stateless extraction helper that returns a draft payload. The
only persistence is the eventual draft accommodation the host creates through
the existing create flow.

## Locked design decisions (from scoping with product owner, 2026-06-15)

1. **Refines the existing SPEC-222 draft** — not a new spec.
2. **Stateless** — no `accommodation_imports` table. Analytics, if any, are
   ephemeral fire-and-forget PostHog events (no DB).
3. **Source-aware tiered strategy, provider-agnostic** behind an
   `ImportSourceAdapter` interface + a light source detector. No per-provider
   business logic leaks into routes.
4. **Per-field confidence + source** (`{ value, confidence, source }`) — not a
   single coarse flag.
5. **All 5 sources in the MVP** (MercadoLibre, Google, Booking, Airbnb, generic).
6. **Airbnb via Apify** (free plan, pay-per-result actor, REST via native
   `fetch`). Provider abstracted so the actor/provider is swappable. Validated
   with a live test call.
7. **Blocking legal confirmation checkbox** before import starts.
8. **URL-acquisition help** shown in the UI per platform (how to copy the URL).
9. **Correct Hospeda layout**: schemas in `@repo/schemas`, business logic in
   `@repo/service-core`, thin route in `apps/api`, DB (none here) via `@repo/db`.
   The PRD's `apps/api/src/modules/...{services,repositories,providers}` layout is
   rejected — it violates the single-source-of-truth conventions.

## Baseline (verified against `origin/staging`, 2026-06-13 / 2026-06-15)

- `apps/web/src/pages/[lang]/publicar/nueva.astro` mounts
  `CreatePropertyMiniForm.client.tsx` (auth-guarded in-page).
- `apps/api/src/routes/accommodation/protected/` — protected tier; pattern is
  `createProtectedRoute` + `PermissionEnum`. The route handler returns data
  directly; `ResponseFactory` is applied **inside** `createProtectedRoute`
  (`apps/api/src/utils/route-factory.ts`), not called per-route.
- `httpToDomainAccommodationCreateDraft` +
  `AccommodationCreateDraftHttpSchema`
  (`packages/schemas/src/entities/accommodation/accommodation.http.schema.ts`):
  a draft requires `name` (3-100), `summary` (10-300), `type`
  (`AccommodationTypeEnum`), `destinationId` (UUID FK); `description` optional
  (min 30, placeholder injected if absent); `ownerId` from the authenticated
  actor.
- `AccommodationTypeEnum` has **13 values** (verified against
  `packages/schemas/src/enums/accommodation-type.enum.ts`): APARTMENT, HOUSE,
  COUNTRY_HOUSE, CABIN, HOTEL, HOSTEL, CAMPING, ROOM, MOTEL, RESORT,
  APART_HOTEL, ESTANCIA, BED_AND_BREAKFAST. The AI type-mapping prompt (AC-8.1)
  MUST enumerate all 13.
- `destinationId` is a **NOT NULL FK** to `destinations` (`onDelete: restrict`).
  No free-text city/country on the accommodation. Resolution via public
  `GET /api/v1/public/destinations?q=<city>&searchScope=name`.
- Amenities/features are **catalog entities referenced by UUID**
  (`amenityIds`/`featureIds`), looked up by `name->>'es' ILIKE` (service) or by
  unique `slug`. NOT free strings.
- `extraInfo` JSONB: `capacity`, `minNights`, `bedrooms`, `bathrooms` required
  when the block is present; `extraInfo.extraInfo: string[]` is an unstructured
  catch-all. `location.coordinates.{lat,long}` are **strings**.
- `checkInTime`, `checkOutTime`, `houseRules`, `city`, `country` **do not exist**
  on the accommodation model.
- `@repo/ai-core` exposes `generateObject(request, ZodSchema)` (Vercel AI SDK,
  provider-native structured output, Zod-validated). New features need: an
  `AiFeatureSchema` value, a `DEFAULT_PROMPTS` entry, and (for quota) an
  `EntitlementKey` + `LimitKey` pair, plus rate-limit/quota middleware.
- `createConfiguredAiService()` in `apps/api/src/services/ai-service.factory.ts`
  wires credentials/ceiling/usage per request.
- **No outbound-fetch/SSRF protection exists anywhere** — `safeExternalFetch` is
  net-new. `packages/utils/src/validation.ts isValidUrl()` only checks parseability.
- Server-side PostHog exists (`apps/api/src/lib/posthog.ts getPostHogClient()`).
- No scraping/import code exists yet.

---

## User Stories & Acceptance Criteria

### US-1 — Host imports from URL on "nueva propiedad"

GIVEN an authenticated host on `/[lang]/publicar/nueva`,
WHEN they open the "Importar desde otra plataforma" section, accept the legal
confirmation checkbox, paste a public listing URL, and click "Importar datos",
THEN the form fields that could be extracted are pre-filled (each with a
confidence badge + source), a "revisá y confirmá" notice is shown, and the host
continues through the existing creation flow.

- **AC-1.1** The import button is **disabled until the legal checkbox is ticked**.
- **AC-1.2** The endpoint returns a partial draft; only extracted fields are
  pre-filled. Nothing is saved automatically.
- **AC-1.3** Each returned field carries `{ value, confidence (0-100), source }`.

### US-2 — Admin imports from URL on the accommodation edit form

GIVEN an admin on the accommodation consolidated edit form,
WHEN they accept the checkbox, paste a URL and trigger the import,
THEN all extractable fields are pre-filled in the TanStack Form (without saving)
with confidence/source surfaced, so the admin reviews and saves selectively.

### US-3 — Source detection + tiered extraction

GIVEN a pasted URL,
WHEN the endpoint runs,
THEN it detects the source and applies the correct strategy (see Technical
Approach), returning whatever it could extract plus a per-field source map.

- **AC-3.1** MercadoLibre → official REST API (`/items/{id}`), no scraping.
- **AC-3.2** Google Maps/Business → Google Places API (Place Details).
- **AC-3.3** Booking.com → direct fetch + JSON-LD; on block/empty → Apify fallback.
- **AC-3.4** Airbnb → Apify actor (no direct fetch — Airbnb is CSR/GraphQL).
- **AC-3.5** Generic → direct fetch + JSON-LD (`schema.org/LodgingBusiness`);
  on insufficient fields → AI extraction (Strategy B).

### US-4 — Graceful degradation

GIVEN the URL is unreachable, blocked, bot-protected, or yields no useful data,
WHEN the endpoint is called,
THEN it returns a partial (possibly empty) draft with a human-readable
`message`, a `source: 'none'` marker where nothing was found, and a retry hint —
never an error that breaks the form.

### US-5 — Per-field Zod validation before return

GIVEN raw extracted values (structured, official-API, or AI),
WHEN the service processes them,
THEN each field is coerced + validated against `AccommodationImportDraftSchema`;
fields that fail validation are dropped (not returned). The client always gets a
type-safe partial.

### US-6 — Rate limiting + AI quota

GIVEN an authenticated user calling the import endpoint,
WHEN they exceed the per-user rate limit (default 10/hour, configurable),
THEN HTTP 429 with a `retryAfter` hint. When Strategy B (AI) is used, the AI
quota/entitlement + cost ceiling for the new `accommodation_import` feature apply.

> **Implementation note (verified):** there is NO existing 10/h/user default.
> The reusable per-user limiter (`createSlidingWindowPerUserRateLimit`,
> `apps/api/src/middlewares/rate-limit.ts`) defaults to 30/min. This route must
> define its own `{ requests: 10, windowMs: 3_600_000 }` explicitly (driven by
> `HOSPEDA_IMPORT_RATE_LIMIT_RPH`).

### US-7 — URL-acquisition guidance (new requirement)

GIVEN a host/admin in the import UI,
WHEN they need to know what URL to paste,
THEN a clear, per-platform help panel explains where to find and copy the listing
URL (Airbnb, Booking, MercadoLibre, Google Maps) — with short steps and a visual
hint. All copy via `@repo/i18n` (es/en/pt).

- **AC-7.1** Help content is collapsible/inline next to the URL input, not a
  separate page.
- **AC-7.2** Each supported platform has its own short "cómo copiar la URL" steps
  (e.g. Google Maps: abrí el lugar → Compartir → Copiar vínculo).
- **AC-7.3** Examples of valid URL shapes per platform are shown.

### US-8 — Required fields the import cannot supply

GIVEN extraction succeeds but the source lacks a Hospeda-required field,
WHEN building the draft,
THEN:

- **AC-8.1 `type`**: AI/mapping maps the external listing type to one of the 10
  `AccommodationTypeEnum` values; if unmappable, it is omitted (host picks).
- **AC-8.2 `destinationId`**: the import NEVER sets the FK blindly. It returns a
  `destinationHint` (the scraped city/locality string + candidate destinations
  from the public destination search, possibly disambiguated by country). The
  host confirms via the existing destination picker. If no candidate, the field
  is left empty with a hint to choose manually.
- **AC-8.3 `summary`**: if the source has no short summary, the AI generates one
  (≤300 chars) from the description.

### US-9 — Restrictions honored

- **AC-9.1** No reviews, ratings, rating breakdowns, or guest comments are ever
  read, mapped, persisted, or surfaced. Adapters MUST strip review/rating fields
  (e.g. Apify `reviews`/`reviewsCount`/`rating`/`ratingBreakdown`, Booking
  JSON-LD `aggregateRating`/`review`) from the extraction before mapping. A unit
  test per adapter asserts these fields never appear in the returned draft.
- **AC-9.2** No automatic photo import. Image URLs are returned as
  `mediaHints.imageUrls` (advisory, read-only) — never written to DB or media
  storage. The host uploads photos separately.
- **AC-9.3** Amenities are returned resolved to `amenityIds` (catalog UUIDs);
  unresolved scraped amenity names are returned as `unresolvedAmenities: string[]`
  (advisory only, not applied).
- **AC-9.4** No recurring sync. One URL, one user-initiated call.

### US-10 — Security (SSRF)

GIVEN any user-supplied URL,
WHEN the endpoint fetches it (Booking/generic direct-fetch tiers),
THEN it goes through `safeExternalFetch` which blocks non-HTTPS, private/loopback/
link-local IPs (RFC-1918, 127.x, 169.254.x, ::1, fc00::/7), validates DNS
resolution (no rebinding), limits redirects, enforces a timeout and a max
response size.

- **AC-10.1** `file://`, `ftp://`, `localhost`, internal hostnames, and private
  IPs are rejected before any network call.
- **AC-10.2** Official-API tiers (ML/Google/Apify) call fixed, trusted hosts and
  are exempt from the user-URL SSRF path (the only user input there is an ID
  parsed from the URL).

### US-11 — Credential-less adapter degradation (5-source MVP decision, 2026-06-15)

GIVEN an adapter whose external credential is not configured (no Apify token, no
Google Places key, ML OAuth not set up),
WHEN that source is detected for a pasted URL,
THEN the adapter MUST degrade cleanly — return an empty `RawExtraction` with
`source: 'none'` and a human-readable `message` ("esta fuente no está disponible
todavía") — and NEVER throw, 500, or block the endpoint. A missing credential is
a disabled-source condition, identical to US-4 graceful degradation.

- **AC-11.1** Each adapter checks its required credential at the start of
  `extract()`; if absent, it returns the degraded empty result, not an error.
- **AC-11.2** The endpoint stays fully functional for the other sources while one
  source's credential is unconfigured (no shared failure).
- **AC-11.3** A unit test per credential-gated adapter asserts the degraded path
  when the credential env var is empty.

---

## Technical Approach

### Source detection (light)

`detectSource(url): ImportSource` normalizes the hostname and returns one of
`'mercadolibre' | 'google' | 'booking' | 'airbnb' | 'generic'`. Used to route to
the right adapter and to label analytics. No heavy per-provider parsing lives in
the detector.

### Adapter interface (provider-agnostic)

```ts
interface ImportSourceAdapter {
  readonly source: ImportSource;
  supports(url: URL): boolean;
  extract(url: URL, ctx: ImportContext): Promise<RawExtraction>;
}
// RawExtraction = loosely-typed bag of candidate values + their source tag,
// pre-validation. The service maps + Zod-validates it into the draft.
```

Adapters (MVP): `MercadoLibreAdapter`, `GooglePlacesAdapter`, `BookingAdapter`,
`AirbnbAdapter` (Apify), `GenericAdapter`. Swapping the Airbnb provider = swap the
adapter implementation; nothing else changes.

### Tiered strategy per source

| Source | Method | Cost | Notes |
| --- | --- | --- | --- |
| **MercadoLibre** | Official REST `GET /items/{id}` (item ID parsed from URL) | $0 | Clean JSON: title, description, location, photos, attributes (bedrooms/bathrooms/area). May need a public app token (verify). |
| **Google Maps/Business** | Google Places API (Place ID from URL → Place Details New) | $0 (5-10k free/mo) | name, address, coords, phone, website, photos, type. Needs a Google Cloud key. |
| **Booking.com** | Direct `safeExternalFetch` + JSON-LD parse (`@type: Hotel`) | $0 | JSON-LD is in the initial HTML (name, address, geo, rating, images). On block/empty → Apify fallback. |
| **Airbnb** | Apify actor via REST (`run-sync-get-dataset-items`) | ~$1.99/1k (free $5/mo ≈ 2.5k listings) | CSR/GraphQL — no usable embedded JSON. Provider abstracted. |
| **Generic** | Direct `safeExternalFetch` + JSON-LD (`LodgingBusiness`); else Strategy B (AI) | $0 | schema.org markup common on small sites. |

**Strategy B — AI extraction (fallback).** When structured extraction yields
fewer than N useful fields (configurable, default 2), strip the HTML to text
(max chars configurable, default ~12k), and call
`@repo/ai-core generateObject({ feature: 'accommodation_import', ... },
AccommodationImportDraftSchema)`. AI-sourced fields get the lowest confidence.
If the AI feature is disabled or unconfigured, skip B and return the structured
partial.

**JSON-LD / meta extraction without a DOM dependency.** Parse
`<script type="application/ld+json">` blocks with a bounded regex + `JSON.parse`,
and OpenGraph/meta with targeted regex. **No `cheerio`/`jsdom` added for MVP**
(dependency policy). If a future source needs full DOM traversal, that's a
separate dependency-approval decision.

### Confidence model

```ts
type FieldSource = 'official_api' | 'jsonld' | 'opengraph' | 'meta' | 'text' | 'ai';
type ImportedField<T> = { value: T; confidence: number; source: FieldSource };
```

Confidence bands: `official_api`/`jsonld` ≈ 90-100, `opengraph`/`meta` ≈ 60-75,
`text` ≈ 40-55, `ai` ≈ 20-40. The exact table lives in the service as a constant.

### Endpoint

**`POST /api/v1/protected/accommodations/import-from-url`**

- Tier: PROTECTED (authenticated session).
- Permission: `ACCOMMODATION_CREATE` OR `ACCOMMODATION_UPDATE_OWN`
  (`ACCOMMODATION_UPDATE_ANY` accepted for admin-via-web).
- Middlewares: per-route rate limit (10/h/user default); when Strategy B runs,
  the `accommodation_import` AI quota/entitlement + cost ceiling apply.
- Request (`AccommodationImportRequestSchema`):
  `{ url: z.string().url().max(2048), locale?: LanguageEnum, legalConfirmed: z.literal(true) }`
  (server re-checks `legalConfirmed === true`; reject otherwise).
- Response (`AccommodationImportResponseSchema`):
  `{ draft: AccommodationImportDraftSchema, source: ImportSource, methodsUsed: FieldSource[], partial: boolean, message?: string, destinationHint?: {...}, unresolvedAmenities?: string[], mediaHints?: { imageUrls: string[] } }`.

### `AccommodationImportDraftSchema` (new subtype, `@repo/schemas`)

Each field is an optional `ImportedField<T>` mirroring `AccommodationSchema` keys
that an import can plausibly fill:

```
name?, summary?, description?, type? (mapped to AccommodationTypeEnum),
extraInfo?: { capacity?, bedrooms?, beds?, bathrooms? },   // each an ImportedField
location?: { coordinates?: {lat,long}, street?, number? }, // strings
price?: { price?, currency? },
contactInfo?: { mobilePhone?, website? },
seo?: { title?, description? }
```

Out of the draft (no home in the model): `checkInTime`, `checkOutTime`,
`houseRules`, free-text `city`/`country` (→ `destinationHint` instead).

### Service (`@repo/service-core`)

`accommodation-import.service.ts` — stateless helper (does NOT extend
`BaseCrudService`, same style as billing services). Returns
`Result<AccommodationImportResponse>`. Steps: detect source → pick adapter →
`safeExternalFetch` or official-API call or Apify → map raw → resolve amenities
(catalog search) + destination hint (destination search) → Zod-validate per field
→ assemble response.

### AI feature wiring (new)

1. Add `'accommodation_import'` to `AiFeatureSchema`
   (`packages/schemas/src/entities/ai/ai-provider.schema.ts`).
2. Add a `DEFAULT_PROMPTS['accommodation_import']` entry
   (`packages/ai-core/src/engine/default-prompts.ts`) — JSON-only extraction
   prompt in `es`.
3. Add `EntitlementKey.AI_ACCOMMODATION_IMPORT`
   (`packages/billing/src/types/entitlement.types.ts`) +
   `LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH`
   (`packages/billing/src/types/plan.types.ts` — **separate file**). Both enums
   are exhaustiveness-checked, so also add entries to `LIMIT_METADATA`
   (`packages/billing/src/config/limits.config.ts`) and `RESOURCE_NAMES`
   (`apps/api/src/utils/limit-check.ts`) — both are `Record<LimitKey, ...>` and
   will fail to compile without the new key. Plus plan-limit defaults +
   entitlement seed.
4. Add a default `ai_settings` config entry for the feature (treat missing as
   disabled).
5. Optional admin-editable prompt via the existing `/ai/prompts` editor;
   `invalidatePromptCache('accommodation_import')` on write.

### `safeExternalFetch` (new util)

`packages/utils/src/safe-fetch.ts` (or `packages/service-core/src/utils/`):
HTTPS-only, DNS-resolve + private/loopback/link-local block, max redirects,
timeout, max body size. Reused by Booking + generic adapters.

### Adapters' external calls (native `fetch`, no SDKs)

- MercadoLibre: `https://api.mercadolibre.com/items/{id}`.
- Google Places: Places API (New) Place Details endpoint + key.
- Apify (Airbnb, Booking fallback): `POST
  https://api.apify.com/v2/acts/<actor>/run-sync-get-dataset-items?token=...`
  with `{ mode: 'listing', urls: [url] }`. Actor id chosen at impl time by
  current adoption/reliability; abstracted behind `AirbnbAdapter`.

### UI

**Web (`apps/web`)** — new `ImportFromUrl.client.tsx` island +
`ImportFromUrl.module.css` (CSS Modules, no Tailwind), wired into
`CreatePropertyMiniForm.client.tsx` as a collapsible section. Contains: legal
checkbox (blocks the button), URL input, per-platform URL-help panel (US-7),
"Importar" button, and on success pre-fills `name`/`summary`/`type` with
confidence badges. All strings via `@repo/i18n`.

**Admin (`apps/admin`)** — new `import-from-url.section.ts` config wired into
`accommodation-consolidated.config.ts`. TanStack Query mutation → endpoint →
`form.setFieldValue(...)` per returned field, with confidence badges in the
section. Tailwind. Request validated with `AccommodationImportRequestSchema.safeParse()`.

### New env vars (registry + Coolify)

- `HOSPEDA_APIFY_TOKEN` (secret) — Apify API token.
- `HOSPEDA_APIFY_AIRBNB_ACTOR` — actor id/slug (default to chosen actor).
- `HOSPEDA_GOOGLE_PLACES_API_KEY` (secret).
- `HOSPEDA_MERCADOLIBRE_TOKEN` (secret, only if the public items API requires it).
- `HOSPEDA_IMPORT_FETCH_TIMEOUT_MS` (default 8000).
- `HOSPEDA_IMPORT_FETCH_MAX_BYTES` (default e.g. 3_000_000).
- `HOSPEDA_IMPORT_RATE_LIMIT_RPH` (default 10).
- `HOSPEDA_IMPORT_AI_MAX_CHARS` (default 12000).
Register in `packages/config/src/env-registry.*`, `apps/api/src/utils/env.ts`,
`apps/api/.env.example`. After registering → STOP and notify owner to set them in
Coolify + redeploy.

---

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Airbnb/Booking ToS prohibit automated access | High | User-initiated, single listing, human-reviewed, blocking legal checkbox; Apify intermediates Airbnb; low volume; ~$2/mo. Legal review recommended pre-launch. CFAA risk near-zero for public data (hiQ, Meta v. Bright Data); residual is ToS breach (civil, low practical risk for a small AR platform). |
| Apify community actor breaks/abandoned | Medium | `AirbnbAdapter` abstraction; choose a high-adoption actor at impl; swappable to Bright Data. |
| Booking direct-fetch IP gets flagged over time | Medium | Realistic headers; graceful fallback to Apify; low volume. |
| AI hallucination | Medium | Zod-validated per field; lowest confidence on AI source; host confirms. |
| SSRF via crafted URL | High | `safeExternalFetch` (net-new) — HTTPS-only, private-IP/DNS guard, redirect/size/timeout limits. |
| `destinationId` cannot be resolved (city not in catalog) | Medium | Never auto-set FK; return `destinationHint` + candidates; host picks. Empty hint → manual selection, draft still creatable. |
| Amenity name → UUID mismatch | Medium | Catalog name search; unresolved returned as advisory `unresolvedAmenities`, never applied. |
| Importing copyrighted photos | Medium | `mediaHints` advisory only; never auto-imported. |
| Token cost runaway (AI/Apify) | Low | AI cost ceiling + quota; Apify free tier; Strategy B only on insufficient structured fields. |
| New `AiFeature` missing from seed | Low | Treat missing config as disabled; seed/migration adds default. |

## Out of Scope

- Persisted import audit table / import history (stateless decision).
- Importing photos into media storage (advisory hints only).
- `checkInTime`/`checkOutTime`/`houseRules` persistence (no model home; future
  schema extension).
- Official OAuth/partner integrations with Booking/Airbnb.
- Bulk/scheduled import, crawling, browser extension/bookmarklet, PDF/Doc import.
- AI description rewriting post-import (separate feature).
- **Reviews / ratings / guest comments import — entirely excluded** (see the
  callout in Overview). The pipeline never reads or surfaces them. This will be a
  **separate future spec, handled with a different approach** (TBD number).
- Headless-browser rendering (rejected — cost/infra, still blockable).
- "Paste page HTML" manual fallback (explicitly rejected by owner).

---

## Suggested Tasks (phased)

### Phase 1 — Schemas, enums, config- `AccommodationImportDraftSchema` (per-field `ImportedField<T>`)

  `AccommodationImportRequestSchema` (with `legalConfirmed: literal(true)`),
  `AccommodationImportResponseSchema`, `ImportSource` + `FieldSource` enums in
  `@repo/schemas`.

- Add `'accommodation_import'` to `AiFeatureSchema`; `DEFAULT_PROMPTS` entry;
  `EntitlementKey`/`LimitKey` pair + plan defaults + entitlement seed.
- Register env vars (config registry + `apps/api/env.ts` + `.env.example`).

### Phase 2 — Security util- `safeExternalFetch` (HTTPS-only, private-IP/DNS guard, redirect/size/timeout)

- Unit tests: reject `file://`/`localhost`/RFC-1918/`::1`/link-local/DNS-rebind;
  enforce timeout + max bytes.

### Phase 3 — Service + adapters- `accommodation-import.service.ts` + `ImportSourceAdapter` interface + detector

- Adapters: MercadoLibre (REST), GooglePlaces (REST), Booking (fetch+JSON-LD →
  Apify fallback), Airbnb (Apify), Generic (fetch+JSON-LD → AI Strategy B).
- Amenity resolution (catalog name search) + `destinationHint` (destination search).
- Per-field Zod validation; confidence scoring constant.
- Unit tests: JSON-LD fixture parse, ML/Places mapping (mocked), Apify mapping
  (mocked), AI Strategy B (mocked), confidence assignment, amenity resolution,
  destination hint, graceful-degradation/empty.

### Phase 4 — API route- `POST /api/v1/protected/accommodations/import-from-url` via `createProtectedRoute`

- Permissions + per-route rate limit + AI quota/entitlement when Strategy B runs.
- Server re-check `legalConfirmed === true`.
- Integration test (stub HTML server for JSON-LD path; mocked Apify/AI).
- Add row to `docs/billing/endpoint-gate-matrix.md`.

### Phase 5 — Web UI- `ImportFromUrl.client.tsx` island + `.module.css`; wire into

  `CreatePropertyMiniForm`. Legal checkbox gate, URL-help panel (US-7),
  confidence badges. i18n keys `importFromUrl.*` (es/en/pt). Component test.

### Phase 6 — Admin UI- `import-from-url.section.ts` + wire into consolidated config; TanStack Query

  mutation; `form.setFieldValue` per field; confidence badges. Admin component test.

### Phase 7 — Docs & polish- Update `apps/api/docs/route-architecture.md`

- ADR documenting: tiered source-aware strategy, provider abstraction, Apify
  choice + swap path, SSRF approach, stateless decision, legal posture.
- Legal notice copy review. Smoke test against a real JSON-LD page + one Apify call.
- Optional: ephemeral PostHog events (`accommodation_import_started/completed/failed`).

---

## Open micro-decisions (sane defaults applied, flag if you disagree)

1. **`houseRules`/`checkIn`/`checkOut`**: dropped from MVP (no validated home).
   Default: omit. Alt: store `houseRules` in `extraInfo.extraInfo[]` (unvalidated).
2. **`destinationHint` UX**: returns candidates; host always confirms in the
   picker. Default: never auto-select even on a single exact match.
3. **MercadoLibre token**: ML's `/items/{id}` is **no longer anonymous** (since
   ~2024 ML requires an OAuth `access_token` on most resources, including items).
   The adapter needs an app-level token (client credentials) with refresh
   handling, NOT a plain fetch. `HOSPEDA_MERCADOLIBRE_TOKEN` (or a client-id/
   secret pair) is therefore required. Per US-11, if it's unset the ML adapter
   degrades to `source: 'none'`. Flag at impl: confirm exact ML auth flow
   (client-credentials vs full OAuth) with a live call before building the adapter.
4. **Analytics**: optional ephemeral PostHog events; not a blocking AC.
