---
spec-id: SPEC-222
title: Accommodation import from URL
type: feature
complexity: high
status: draft
created: 2026-06-13T12:00:00Z
---

# SPEC-222 — Accommodation import from URL

## Overview

**Goal.** Allow a host (or admin) to paste a public URL from an external
platform (Booking.com, Airbnb, Tripadvisor, etc.) and have the system
extract structured data to **pre-fill** the accommodation creation or edit
form. The host then reviews the pre-filled fields and confirms before saving
— the import is never blind and never persists without explicit user action.

**Motivation.** The current "nueva propiedad" flow (`/[lang]/publicar/nueva`)
creates a minimal draft and redirects the host to the admin panel to fill in
the rest of the listing manually. Many hosts already have their property
listed elsewhere and would benefit from a one-click import to avoid
re-entering duplicate information. The import must be non-destructive: it only
pre-populates the form; the host edits, approves, and saves through the
existing creation/edit flow.

**Success criteria.**

1. A host authenticated on `/publicar/nueva` can optionally provide a URL; the
   system returns a partial `AccommodationImportDraftSchema` payload that
   pre-fills the `CreatePropertyMiniForm`.
2. An admin on the accommodation edit form can trigger the same import to
   pre-populate fields from an external URL.
3. The endpoint never persists anything — it is a stateless extraction helper.
4. Extraction uses structured metadata (JSON-LD / OpenGraph) when available and
   falls back to AI-assisted extraction (`@repo/ai-core` `generateObject`)
   when the page lacks machine-readable data.
5. All extracted values pass Zod validation before being returned to the client.
6. The endpoint enforces authentication (`ACCOMMODATION_CREATE` or
   `ACCOMMODATION_UPDATE_OWN`) and per-user rate limiting to prevent abuse.

**Baseline.** Verified against `origin/staging` (worktree:
`/home/qazuor/projects/WEBS/hospeda-specs-batch`) on 2026-06-13.

Key files verified:

- `apps/web/src/pages/[lang]/publicar/nueva.astro` — hosts `CreatePropertyMiniForm.client.tsx` island; auth-guarded in-page.
- `apps/web/src/components/host/CreatePropertyMiniForm.client.tsx` — minimal-field draft creation form (React island).
- `apps/api/src/routes/accommodation/protected/` — existing protected tier; pattern: `createProtectedRoute` factory, `PermissionEnum`, `createProtectedRoute`.
- `apps/api/src/routes/accommodation/index.ts` — aggregates `publicAccommodationRoutes`, `protectedAccommodationRoutes`, `adminAccommodationRoutes`.
- `packages/schemas/src/entities/accommodation/accommodation.schema.ts` — `AccommodationSchema` (all core fields: `name`, `summary`, `description`, `type`, `extraInfo`, `price`, `location`, `seo`, contact, social, tags, etc.).
- `packages/schemas/src/entities/accommodation/subtypes/` — `accommodation.ia.schema.ts`, `accommodation.amenity.schema.ts`, `accommodation.feature.schema.ts`, `accommodation.price.schema.ts`.
- `packages/ai-core/src/capabilities/generate-object.capability.ts` — `executeGenerateObject` (locale-default + engine delegation). Exposed via `@repo/ai-core`.
- `packages/schemas/src/entities/ai/ai-provider.schema.ts` — `AiFeatureSchema` values: `'text_improve' | 'chat' | 'search' | 'support'`. Import feature must be added.
- `packages/schemas/src/enums/permission.enum.ts` — `ACCOMMODATION_CREATE`, `ACCOMMODATION_UPDATE_OWN`, `ACCOMMODATION_UPDATE_ANY`, `ACCOMMODATION_PUBLISH`.
- No scraping/cheerio/puppeteer code found in `apps/api/src` — feature does not exist yet.
- `apps/admin/src/features/accommodations/config/accommodation-consolidated.config.ts` — admin edit form config.

---

## User Stories & Acceptance Criteria

### US-1 — Host imports from URL on nueva propiedad

GIVEN an authenticated host on `/[lang]/publicar/nueva`,
WHEN they enter a public URL (e.g. an Airbnb or Booking listing) and click
"Importar datos",
THEN the `CreatePropertyMiniForm` fields (`name`, `summary`, `type`) are
pre-populated with extracted values, a "revisá y confirmá" notice is shown,
and the host can proceed normally through the existing creation flow.

### US-2 — Admin imports from URL on accommodation edit

GIVEN an admin on the accommodation edit form,
WHEN they paste a URL and trigger the import,
THEN all extractable fields (name, summary, description, type, price,
extraInfo, location, seo, contact, amenities hint) are pre-filled in the
TanStack Form — without saving — so the admin can review and save selectively.

### US-3 — Graceful degradation when extraction fails

GIVEN the target URL is unavailable, blocks the fetch, or yields no useful
structured data,
WHEN the endpoint is called,
THEN it returns a partial result with only the fields that could be extracted
(possibly an empty object), never an error that breaks the form, and a
`source` field indicating what extraction method was used and whether it was
partial.

### US-4 — Rate limiting per user

GIVEN an authenticated user calling the import endpoint,
WHEN they exceed the per-user rate limit (configurable, default: 10 calls
per hour),
THEN the endpoint returns HTTP 429 with a `retryAfter` hint; the form shows
a user-friendly message.

### US-5 — Extracted data is Zod-validated before return

GIVEN the extraction (structured or AI) produces raw values,
WHEN the service processes them,
THEN each field is individually coerced and validated through
`AccommodationImportDraftSchema` (partial Zod); fields that fail validation
are silently dropped (not returned), so the client always receives a
type-safe partial.

---

## Technical Approach

### Strategy A — Structured metadata extraction (primary)

When the fetched HTML page includes machine-readable markup:

1. **JSON-LD** (`<script type="application/ld+json">` with `@type: LodgingBusiness`
   or `Hotel` or `Accommodation`) — parse `name`, `description`, `address`,
   `geo`, `amenityFeature`, `priceRange`, `telephone`, `url`, `image`.
2. **OpenGraph** (`<meta property="og:*">`) — fallback for `og:title`,
   `og:description`, `og:image`, `og:url`.
3. **Schema.org meta** — any `<meta itemprop="...">` tags.

This path requires no AI call and is deterministic. Mapping logic converts
external field names to internal `AccommodationImportDraftSchema` keys.

### Strategy B — AI-assisted extraction (fallback)

When Strategy A yields fewer than N useful fields (configurable threshold,
default: 2):

1. Extract the main text content from `<main>` / `<article>` / `<body>` (with
   basic tag stripping to reduce token count).
2. Call `@repo/ai-core` `executeGenerateObject` with:
   - `feature: 'import'` (new value — must be added to `AiFeatureSchema`).
   - `outputSchema`: `AccommodationImportDraftSchema` (partial, nullable fields).
   - `prompt`: structured extraction prompt in `es` (platform locale) asking
     the model to fill in the schema from the provided text.
3. The result is merged with any Strategy A fields (Strategy A wins on
   conflict).

**AI feature flag.** If `'import'` is disabled in `AiSettings` or the API key
is not configured, Strategy B is skipped and the endpoint returns the Strategy
A partial (or an empty draft with a `source: 'none'` marker).

### Endpoint design

**New route:** `POST /api/v1/protected/accommodations/import-from-url`

```
Tier:       PROTECTED (requires authenticated user session)
Permission: ACCOMMODATION_CREATE  (hosts)  OR  ACCOMMODATION_UPDATE_OWN (editing host)
            ACCOMMODATION_UPDATE_ANY is also accepted for admin-via-web calls.
Rate limit: 10 req / hour / user (per-route via createPerRouteRateLimitMiddleware)
```

**Request body** (`AccommodationImportRequestSchema`, new in `@repo/schemas`):

```ts
{
  url: z.string().url().max(2048),
  locale?: LanguageEnum   // default 'es'
}
```

**Response** (`AccommodationImportResponseSchema`, new in `@repo/schemas`):

```ts
{
  draft: AccommodationImportDraftSchema,  // partial — only extracted fields
  source: z.enum(['structured', 'ai', 'mixed', 'none']),
  partial: z.boolean()   // true if not all main fields were found
}
```

**`AccommodationImportDraftSchema`** (new subtype in `@repo/schemas`):

All fields optional/nullable — mirrors `AccommodationSchema` main fields:

```ts
{
  name?: string,
  summary?: string,
  description?: string,
  type?: AccommodationTypeEnumSchema,
  extraInfo?: Partial<ExtraInfo>,       // capacity, bedrooms, bathrooms, beds
  price?: Partial<AccommodationPriceSchema>,
  location?: Partial<AccommodationLocationFields>,
  seo?: { title?: string; description?: string },
  contact?: Partial<BaseContactFields>,
  tags?: string[],
  mediaHints?: { imageUrls: string[] }  // external image URLs — open question below
}
```

**Service** (`accommodation-import.service.ts`, new, in `packages/service-core`):

Does NOT extend `BaseCrudService` — it is a stateless helper service (same
pattern as billing services in `packages/service-core/src/services/billing/`).
Returns `Result<AccommodationImportResponse>` for consistent error handling.

Steps:
1. Validate and sanitise the URL (block `localhost`, private IPs, non-HTTP/S).
2. `fetch()` with a timeout (`HOSPEDA_IMPORT_FETCH_TIMEOUT_MS`, default 8000ms).
3. Strategy A: parse HTML for JSON-LD / OG tags.
4. If Strategy A fields < threshold → Strategy B: strip HTML, call AI.
5. Validate extracted fields against `AccommodationImportDraftSchema`.
6. Return `{ draft, source, partial }`.

### UI design

**Web (`apps/web`) — CreatePropertyMiniForm.client.tsx:**

Add an optional collapsible "Importar desde otra plataforma" section above the
main fields. Contains a URL text input and a "Importar" button. On success,
pre-populates `name`, `summary`, `type`. Styled with CSS Modules (`*.module.css`),
no Tailwind. All user-facing strings go through `@repo/i18n`.

**Admin (`apps/admin`) — accommodation consolidated edit form:**

Add an "Importar desde URL" panel (new `sections/import-from-url.section.ts`
config entry). Contains URL input + button wired to a TanStack Query mutation
calling the protected endpoint. On success, calls `form.setFieldValue(...)` for
each returned field. Styled with Tailwind. Uses TanStack Form; schema validation
via `AccommodationImportRequestSchema.safeParse()`.

### Touched files

Backend (new files):

- `packages/schemas/src/entities/accommodation/subtypes/accommodation.import.schema.ts` — `AccommodationImportDraftSchema`, `AccommodationImportRequestSchema`, `AccommodationImportResponseSchema`.
- `packages/schemas/src/entities/ai/ai-provider.schema.ts` — add `'import'` to `AiFeatureSchema` enum.
- `packages/service-core/src/services/accommodation/accommodation-import.service.ts` — stateless extraction service.
- `apps/api/src/routes/accommodation/protected/importFromUrl.ts` — new route using `createProtectedRoute`.
- `apps/api/src/routes/accommodation/protected/index.ts` — register new route.
- `docs/billing/endpoint-gate-matrix.md` — add row for new protected route.

Web (new/modified):

- `apps/web/src/components/host/CreatePropertyMiniForm.client.tsx` — add import-from-URL section (existing file, surgical addition).
- `apps/web/src/components/host/ImportFromUrl.client.tsx` — new React island for the import UI (extracted to keep MiniForm under 500 lines).
- `apps/web/src/components/host/ImportFromUrl.module.css` — CSS Module for import UI.
- `packages/i18n/src/locales/{es,en,pt}/host.json` — new keys: `importFromUrl.*`.

Admin (new/modified):

- `apps/admin/src/features/accommodations/config/sections/import-from-url.section.ts` — new section config.
- `apps/admin/src/features/accommodations/config/accommodation-consolidated.config.ts` — wire import section.

Environment / config (new vars):

- `HOSPEDA_IMPORT_FETCH_TIMEOUT_MS` — fetch timeout in ms (default `8000`).
- `HOSPEDA_IMPORT_RATE_LIMIT_RPH` — rate limit requests per hour per user (default `10`).
- Add both to: `packages/config/src/env-registry.hospeda.ts`, `apps/api/src/utils/env.ts`, `apps/api/.env.example`.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| ToS / legality of scraping (Booking, Airbnb prohibit automated scraping) | High | Import is always user-initiated and human-reviewed before save; add Terms of Use notice in UI ("only import pages you have rights to"); no automated / bulk import; legal review recommended before launch |
| Fetch blocked / CAPTCHA / JS-rendered pages (Airbnb, Booking rely heavily on JS) | High | Strategy A works only on static HTML; Strategy B degrades gracefully to partial; document known-blocked platforms; consider user-paste of page HTML as future opt-in |
| HTML structure changes breaking Strategy A parsers | Medium | Parsers rely on semantic JSON-LD / OG (standard formats), not DOM selectors; structured markup is more stable than HTML structure |
| AI hallucination mapping wrong field values | Medium | AI output validated through `AccommodationImportDraftSchema`; invalid fields are silently dropped; host must confirm before save |
| Rate limiting bypass / SSRF via crafted URLs | High | Validate URL scheme (HTTP/S only); block private IP ranges and localhost; per-user rate limit via `createPerRouteRateLimitMiddleware` |
| Importing copyrighted photo URLs | Medium | `mediaHints.imageUrls` is an advisory hint only — never auto-imported to DB; open question: download vs. link vs. exclude entirely |
| Enum mapping (external `type` strings → `AccommodationTypeEnumSchema`) | Medium | Maintain an explicit mapping table in the service; unrecognised values are dropped (not guessed) |
| Token cost for AI fallback | Low | Strategy B is only triggered when Strategy A yields < threshold fields; AI call is bounded by the HTML text budget (configurable max chars before truncation) |
| `AiFeature: 'import'` not in existing AiSettings seed data | Low | New value → existing `AiFeaturesMap` records won't have it; treat missing key as "disabled"; seed/migration must add a default config entry |

---

## Out of Scope

- Automated / scheduled bulk import of external listings (only user-initiated, one at a time).
- Importing external photo assets into `@repo/media` storage (photos are advisory hints only — host must upload separately).
- Direct OAuth / API integration with Booking.com or Airbnb APIs (would require partner agreements).
- Browser extension or bookmarklet to trigger import.
- Import from PDF, Word documents, or other non-URL formats.
- AI-powered description rewriting after import (separate feature).
- Mapping external review scores to internal `rating` fields.

---

## Suggested Tasks (phased)

**Phase 1 — Schema & config**

- Add `AccommodationImportDraftSchema`, `AccommodationImportRequestSchema`, `AccommodationImportResponseSchema` to `@repo/schemas`.
- Add `'import'` to `AiFeatureSchema` enum; add default config entry to AI settings seed.
- Register new env vars (`HOSPEDA_IMPORT_FETCH_TIMEOUT_MS`, `HOSPEDA_IMPORT_RATE_LIMIT_RPH`) in `packages/config` + `apps/api/src/utils/env.ts` + `.env.example`.

**Phase 2 — Service**

- Implement `accommodation-import.service.ts` in `packages/service-core`:
  - URL validation & SSRF guard.
  - HTML fetch with timeout.
  - Strategy A: JSON-LD + OpenGraph parser.
  - Strategy B: HTML stripping + `executeGenerateObject` call.
  - Zod-validated merge and `Result<AccommodationImportResponse>` return.
- Unit tests: Strategy A parsing (JSON-LD fixture, OG fixture), Strategy B mock, SSRF rejection, rate limit, partial-result graceful degradation.

**Phase 3 — API route**

- `POST /api/v1/protected/accommodations/import-from-url` using `createProtectedRoute`.
- Per-route rate limit via `createPerRouteRateLimitMiddleware`.
- Integration test (stub HTML server, verify structured + AI paths).
- Add row to `docs/billing/endpoint-gate-matrix.md`.

**Phase 4 — Web UI**

- Extract `ImportFromUrl.client.tsx` island + `ImportFromUrl.module.css`.
- Wire into `CreatePropertyMiniForm.client.tsx` (collapsible section).
- Add i18n keys to `packages/i18n/src/locales/{es,en,pt}/host.json`.
- Component test (mock API response, assert field pre-population).

**Phase 5 — Admin UI**

- `import-from-url.section.ts` config + wire into `accommodation-consolidated.config.ts`.
- TanStack Query mutation calling the protected endpoint.
- `form.setFieldValue(...)` integration for all returned fields.
- Admin component test.

**Phase 6 — Docs & polish**

- Update `apps/api/docs/route-architecture.md` with new route.
- Legal notice in both UIs ("only import pages you have rights to").
- Smoke test: verify JSON-LD path against a real-world page that uses structured data.

---

## Internal Review Notes

- **No existing import/scraping code found** in `apps/api/src` — `grep` for `cheerio|puppeteer|playwright|scrape|import.*url|fetch.*booking|fetch.*airbnb` returned only `logger.ts` and `env.ts` (false positives). This feature is net-new.
- **`@repo/ai-core` is fully wired** with `executeGenerateObject` via `generate-object.capability.ts`. The capability is provider-agnostic and accepts any Zod schema as `outputSchema`. `AiFeatureSchema` currently has 4 values (`text_improve|chat|search|support`); `'import'` must be added.
- **`AccommodationSchema`** is comprehensive: `name`, `summary`, `description`, `type`, `extraInfo` (capacity/bedrooms/bathrooms/beds), `price`, `location`, `seo`, contact, social, tags, `iaData`, `faqs`, `rating`. The import draft schema should be a strict partial of these.
- **Protected tier pattern** is well-established: `createProtectedRoute` factory + `PermissionEnum` + `createPerRouteRateLimitMiddleware`. File goes in `apps/api/src/routes/accommodation/protected/importFromUrl.ts` and is registered in `protected/index.ts`.
- **Web form entry point** is `apps/web/src/pages/[lang]/publicar/nueva.astro` which mounts `CreatePropertyMiniForm.client.tsx` (auth-guarded in-page). Import UI is additive (no page restructuring needed).
- **Admin edit form** is driven by config in `apps/admin/src/features/accommodations/config/accommodation-consolidated.config.ts` — adding a new section follows the established pattern.
- **Open questions for impl:**
  1. `mediaHints.imageUrls` — include advisory image URLs in the draft (for host to cherry-pick) or exclude entirely to avoid copyright concerns? Recommend: include as read-only hints, never auto-import.
  2. Threshold for Strategy A → Strategy B fallback — recommend N=2 extractable fields.
  3. Max HTML size to feed to AI (token budget) — recommend strip to 12 000 chars.
  4. Whether to surface `source` and `partial` to the user in the UI or keep them internal.
  5. Confirm rate limit default: 10 req/hour per user.
- **Env vars:** two new vars needed. Per CLAUDE.md workflow — after adding to registry, STOP and notify user to set them in Coolify + trigger redeploy.
