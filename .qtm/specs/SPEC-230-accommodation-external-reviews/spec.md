---
spec-id: SPEC-230
title: External-platform reviews & reputation on accommodation pages
type: feature
complexity: high
status: draft
created: 2026-06-15T00:00:00Z
---

# SPEC-230 — External-platform reviews & reputation on accommodation pages

## Overview

**Goal.** On a Hospeda accommodation detail page, show the property's **reputation
on external platforms** (Google, Booking.com, Airbnb, …), clearly labeled as
coming from another platform, and a link to the property's listing on each. This
is the deferred "reviews" feature that SPEC-222 (import-from-URL) explicitly
excluded — handled here as a **separate entity with a different approach**.

**What we show (scope = "Option 2").**

- **Google**: real review **snippets** (author, text, rating, date) via the
  official **Places API**, displayed per Google's display rules (attribution +
  link back). Plus the aggregate (rating + count).
- **Booking.com / Airbnb / others**: **aggregate only** — rating + review count +
  a deep link to the listing. **No review text** (legal/ToS — see below).

**Why only Google shows full reviews.** Google has an official API whose terms
permit displaying review snippets with attribution. Airbnb and Booking have no
such API for small platforms, and their review text is copyrighted user content;
republishing it would breach ToS and copyright. So for those we show only factual
aggregate numbers + a link. **This rationale must be surfaced clearly in the UI**
(owner config + a subtle public note).

**Relationship to internal reviews.** Hospeda's own reviews
(`accommodation_reviews`, with `averageRating`/`reviewsCount` on the
accommodation) are untouched. External reputation is a **completely separate
entity**, shown in a **sibling section**, and **never** merged into the internal
average. (Verified: internal `averageRating`/`reviewsCount` are computed solely
from internal rows; external data living in new tables is purely additive.)

**Relationship to SPEC-222.** Independent specs, shared infra. Both touch Google
Places, Apify, `safeExternalFetch`, and the same env vars. Whichever lands first
builds those; the second reuses them. SPEC-222 is stateless; **this spec is
stateful** (new tables + a cron).

## Locked design decisions (from scoping with product owner, 2026-06-15)

1. **Scope = Option 2**: Google real snippets + aggregate-only for the rest.
2. **External listing link stored in DB** and shown on the detail page
   ("Nuestro alojamiento en Airbnb" + deep link).
3. **Owner visibility toggles**: a **global master** on/off, AND **per-platform**
   on/off, applied **separately** to (a) the platform **link** and (b) the
   **reviews/reputation**.
4. **Clearly explain** in the UI why only Google shows full reviews.
5. **Separate entity, constrained backend**: external reputation rows are
   **not user-editable or user-deletable**. The only operations are **refresh**
   (owner button, automatic fetch — rate-limited) + **list** (for display). Owner
   CRUD applies only to the *listing config* (URL + toggles), not to the fetched
   reputation data.
6. **Refresh = button + cron.** Owner button triggers an on-demand fetch
   (rate-limited to prevent abuse); a periodic cron also refreshes active listings
   so data doesn't rot and Google text stays within its caching window.
7. **Google text caching = TTL + degrade.** Google review snippets are stored with
   a timestamp; if they exceed Google's allowed caching window (~30 days) without
   a refresh, the **text is hidden** and only the aggregate (rating + count) shows
   until the next refresh. Aggregate numbers (all platforms) cache freely.

## Baseline (verified against `origin/staging`, 2026-06-15)

- Internal reviews: `accommodation_reviews` table/schema — `userId` is **NOT
  NULL** FK, **no `source`/`platform`/`isExternal` field**. External reviews
  **cannot** reuse this table.
- `accommodations.averageRating` (numeric 3,2) + `reviewsCount` (int) computed
  only from internal reviews (`accommodationReview.helpers.ts
  calculateStatsFromReviews`). External data must NOT write here.
- **No external-listing link exists** anywhere on the accommodation today.
- Detail page: `apps/web/src/pages/[lang]/alojamientos/[slug].astro` renders
  `ReviewPreview.astro` (aggregate) + `ReviewsModal.client.tsx` (list, fetched via
  `accommodationsApi.getReviews`). Public endpoint:
  `GET /api/v1/public/accommodations/:accommodationId/reviews`.
- Web styling: CSS Modules / scoped Astro `<style>`, design tokens (`var(--space-N)`,
  `var(--core-foreground)`, …), no Tailwind. i18n via `createTranslations(locale)`,
  keys under `packages/i18n/src/locales/{es,en,pt}/review.json`.
- Cron jobs live in `apps/api/src/cron/jobs/`.
- Migrations: structural carril (`packages/db/src/migrations/` via `db:generate` +
  `db:migrate`); extras carril for triggers/partial indexes.
- Google Places + Apify + `safeExternalFetch` may already exist if SPEC-222
  merged first — reuse; otherwise build here.

---

## Domain model (two new entities — separate from internal reviews)

### A. `accommodation_external_listings` (owner-managed config)

One row per (accommodation, platform). Owner-managed (CRUD by owner).

```
id, accommodationId (FK)
platform        enum: 'google' | 'booking' | 'airbnb' | 'other'
url             string (the public listing URL; for Google, the Maps URL)
externalId      string nullish  (e.g. resolved Google placeId)
showLink        boolean default false   // show the deep link on detail
showReviews     boolean default false   // show rating/snippets on detail
verified        boolean default false   // optional: ownership hint (future)
+ BaseAuditFields + BaseLifecycleFields (soft delete)
```

Unique `(accommodationId, platform)`.

**Global master toggle.** A single per-accommodation `showExternalReputation`
boolean (default `false` — opt-in) gates the entire block regardless of
per-platform flags. Recommended location: additive column on `accommodations`
(queryable at SSR without a join). [Micro-decision — see open items.]

### B. `accommodation_external_reputation` (read-only cached data)

One row per (accommodation, platform). **System-written only**, never edited or
deleted by the owner.

```
id, accommodationId (FK), platform (enum)
listingId        FK → accommodation_external_listings
rating           numeric(3,2) nullish     // platform's aggregate rating
reviewsCount     integer nullish
deepLink         string nullish           // canonical link to the listing
snippets         jsonb nullish            // GOOGLE ONLY: [{author, text, rating,
                                           //   timeIso, authorUrl, profilePhoto,
                                           //   relativeTime}]  (max ~5)
snippetsFetchedAt timestamptz nullish      // TTL anchor for Google text
aggregateFetchedAt timestamptz nullish
fetchStatus      enum: 'ok'|'blocked'|'not_found'|'error' default 'ok'
fetchMessage     string nullish
+ createdAt, updatedAt
```

`snippets` is populated **only** for `platform = 'google'`. For Booking/Airbnb it
stays null (aggregate-only). The display layer hides Google `snippets` when
`now - snippetsFetchedAt > GOOGLE_SNIPPET_TTL` (default 30 days).

---

## User Stories & Acceptance Criteria

### US-1 — Owner registers external listings + toggles visibility

GIVEN an authenticated owner editing their accommodation,
WHEN they add a platform + URL and set `showLink` / `showReviews`,
THEN the listing config is saved; nothing is displayed publicly until the global
master `showExternalReputation` is ON and the relevant per-platform flag is ON.

- **AC-1.1** Owner can add/edit/remove a listing config (URL + per-platform
  `showLink` + `showReviews`).
- **AC-1.2** A single **global master** toggle gates the whole external block.
- **AC-1.3** `showLink` and `showReviews` are **independent** per platform (e.g.
  show the Airbnb link but not its rating).
- **AC-1.4** The owner config UI shows the **explainer** of why only Google has
  full reviews (US-5).

### US-2 — Owner refreshes external data via a (rate-limited) button

GIVEN an owner with registered listings,
WHEN they click "Actualizar reputación externa",
THEN the system fetches each enabled listing (Google Places / aggregate sources),
stores the result in `accommodation_external_reputation`, and shows a "last
updated" timestamp.

- **AC-2.1** The button is **rate-limited** (default: 1 refresh per accommodation
  per X minutes, configurable) → 429 + retry hint when exceeded.
- **AC-2.2** The fetch is fully automatic; the owner never types rating/review
  data by hand.
- **AC-2.3** Partial failure is graceful: a platform that fails gets
  `fetchStatus != 'ok'` and is simply omitted from display; others still show.

### US-3 — Background cron keeps data fresh

GIVEN active listings with `showReviews` on,
WHEN the refresh cron runs (default weekly, configurable),
THEN it re-fetches them so aggregates stay current and Google snippets stay within
the caching window — without depending on the owner clicking the button.

### US-4 — Public detail page shows external reputation (labeled, separated)

GIVEN a visitor on the accommodation detail page,
WHEN the accommodation has the master toggle ON and enabled platforms,
THEN a **separate "Reputación en otras plataformas" block** renders (sibling to
the internal reviews block), honoring every toggle:

- **AC-4.1** Per platform with `showLink`: a labeled deep link ("Mirá nuestro
  alojamiento en Airbnb →") with the platform name/logo.
- **AC-4.2** Per platform with `showReviews`: an aggregate badge (rating + count)
  with platform attribution.
- **AC-4.3** **Google only**: up to ~5 real review snippets (author, text, date,
  rating) with Google attribution + link back, per Places display rules — unless
  the snippet TTL expired, in which case only the aggregate shows.
- **AC-4.4** The internal `averageRating`/`reviewsCount` are **never** affected;
  external numbers live in their own block and are never blended.
- **AC-4.5** Every external item is **clearly labeled** with its source platform.

### US-5 — Clear explanation of the Google-only reviews

- **AC-5.1** The UI explains (owner config + a subtle public note/tooltip) that
  full review text is shown only for Google because it provides an official API,
  while other platforms show aggregate numbers + a link for legal reasons.
- **AC-5.2** Copy via `@repo/i18n` (es/en/pt).

### US-6 — Constrained backend (no user edit/delete of reputation)

- **AC-6.1** The reputation entity exposes only **refresh** (owner button + cron)
  and **list** (public display). No create/update/delete of reputation rows by the
  owner. (Owner CRUD is limited to the *listing config* entity.)
- **AC-6.2** An **admin-only** disable/purge exists for legal takedown / abuse
  (e.g. a platform demands removal) — minimal escape hatch, not owner-facing.
  [Micro-decision — keep or drop.]

### US-7 — Legal & attribution

- **AC-7.1** No review **text** is ever fetched, stored, or shown for non-Google
  platforms — only aggregate rating + count (facts) + a link. The aggregate
  source (Apify actor / Booking JSON-LD) returns more; the adapter MUST strip
  everything except `rating`, `reviewsCount`, and the canonical link.
- **AC-7.2** Google snippets shown with required attribution + link to Google;
  cached no longer than the allowed window (TTL → degrade to aggregate).
- **AC-7.3** Owner opt-in (registering their own listing + enabling) is the
  authorization basis; nothing displays without it.

### US-8 — Security (SSRF) for aggregate fetches

- **AC-8.1** Any direct fetch of a Booking/generic listing (for aggregate JSON-LD)
  goes through `safeExternalFetch` (HTTPS-only, private-IP/DNS guard, redirect/
  timeout/size limits) — shared with SPEC-222. Official APIs (Google/Apify) hit
  fixed trusted hosts.

---

## Technical Approach

### Data sources per platform

| Platform | Aggregate | Snippets | Method |
| --- | --- | --- | --- |
| **Google** | rating + userRatingsTotal | up to 5 real reviews | Places API (placeId from URL/Text Search → Place Details). Compliant display + TTL. |
| **Booking** | rating + reviewsCount | none | `safeExternalFetch` + JSON-LD `aggregateRating`; fallback Apify (numbers only). |
| **Airbnb** | rating + reviewsCount | none | Apify actor; **strip all but rating/count/link**. |
| **other/generic** | rating + reviewsCount if JSON-LD present | none | `safeExternalFetch` + JSON-LD `aggregateRating`. |

`platform` adapters mirror SPEC-222's `ImportSourceAdapter` style (provider
abstraction; Apify actor swappable). Reuse SPEC-222 utilities if present.

### Refresh service (constrained)

`accommodation-external-reputation.service.ts` (`@repo/service-core`,
stateless-helper style; the persistence is via `@repo/db` models). Operations:

- `refresh(accommodationId, actor)` — owner button + cron entrypoint; iterates
  enabled listings, fetches, strips disallowed fields, writes reputation rows.
- `listForDisplay(accommodationId)` — returns toggle-filtered, TTL-degraded data
  for the public detail page.
No owner-facing update/delete of reputation rows.

Listing-config CRUD lives in a small `accommodation-external-listing.service.ts`
(owner-managed: add/edit/remove URL + toggles).

### Cron

New job `apps/api/src/cron/jobs/refresh-external-reputation.job.ts` — weekly
(configurable), refreshes active listings with `showReviews` on. Respects the
Google TTL (re-fetch before expiry). Follows existing cron-job patterns.

### Endpoints

- `POST /api/v1/protected/accommodations/:id/external-reputation/refresh`
  — owner button. Permission: `ACCOMMODATION_UPDATE_OWN` (or new
  `ACCOMMODATION_EXTERNAL_MANAGE`). **Rate-limited** per accommodation.
- `GET  /api/v1/public/accommodations/:id/external-reputation`
  — public list for the detail page (toggle-filtered, TTL-degraded). Cached
  (short server TTL).
- Owner listing-config CRUD: `GET/POST/PATCH/DELETE
  /api/v1/protected/accommodations/:id/external-listings`. Permission:
  `ACCOMMODATION_UPDATE_OWN`.
- Admin disable/purge (US-6.2): `apps/api/src/routes/.../admin/...`
  [if kept].

### Schemas (`@repo/schemas`, new entity dir `accommodation-external/`)

- `AccommodationExternalListingSchema` (+ create/update/patch CRUD schemas) —
  platform enum, url, externalId, showLink, showReviews.
- `AccommodationExternalReputationSchema` — read model: rating, reviewsCount,
  deepLink, snippets (google-only), fetchedAt fields, fetchStatus.
- `ExternalPlatformEnum` = google | booking | airbnb | other.
- Public response schema for the detail block (toggle-filtered shape).

### DB (`@repo/db`)

- `accommodation_external_listings.dbschema.ts` + model (BaseModel, soft delete).
- `accommodation_external_reputation.dbschema.ts` + model (BaseModel; system-written).
- Additive `accommodations.show_external_reputation boolean default false`
  (master toggle) — OR a settings row [micro-decision].
- `db:generate` → commit migration → `db:migrate` → `db:apply-extras`.

### Web UI (`apps/web`)

- New `ExternalReputation.astro` (server, aggregate + links) + an island for the
  Google snippets if interactivity is needed (`ExternalReviews.client.tsx`),
  rendered as a **sibling block** to `ReviewPreview.astro` on
  `[lang]/alojamientos/[slug].astro`. SSR fetches the public endpoint.
- Per-platform badges/logos, deep links, attribution, the "why only Google"
  explainer. CSS Modules + design tokens, no Tailwind. i18n es/en/pt.

### Admin/Owner config UI

- Owner: a section to manage external listings (URL + toggles + "Actualizar"
  button with last-updated + rate-limit feedback). Web (host) and/or admin per
  current accommodation-edit conventions.

### Env / config (registry + Coolify)

- `HOSPEDA_GOOGLE_PLACES_API_KEY` (secret) — shared w/ SPEC-222.
- `HOSPEDA_APIFY_TOKEN` (+ actor) — shared w/ SPEC-222.
- `HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS` (default 30).
- `HOSPEDA_EXTREP_REFRESH_RATE_LIMIT` (button: e.g. 1 / accommodation / 10 min).
- `HOSPEDA_EXTREP_CRON_SCHEDULE` (default weekly).
- `safeExternalFetch` timeout/size (shared w/ SPEC-222).
After registering → STOP and notify owner to set them in Coolify + redeploy.

---

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Republishing Airbnb/Booking review **text** (copyright/ToS) | High | Aggregate-only for those platforms; adapters strip all text. Only Google text (official API + display rules). |
| Google ToS caching limit on review text | Medium | TTL + degrade-to-aggregate (US-5/AC-7.2); cron refresh within window. |
| Google Places cost | Low | Free tier (5-10k/mo); refresh is button+cron, not per-page-view; aggregates cached. |
| Apify actor breakage | Medium | Provider abstraction (shared w/ SPEC-222); aggregate-only mapping is simpler/stabler. |
| SSRF via listing URL | High | `safeExternalFetch` (shared). |
| Owner shows a listing that isn't theirs | Medium | Opt-in + attribution; optional `verified` flag (future); admin takedown (US-6.2). |
| External numbers confused with Hospeda rating | Medium | Separate labeled block; never merged into `averageRating`; explicit platform attribution. |
| Stale/abandoned data | Low | Cron refresh + "last updated" + TTL degrade. |

## Out of Scope

- Editing/deleting external reputation by the owner (read-only, system-written).
- Review **text** from any non-Google platform.
- Mixing external scores into the internal `averageRating`/`reviewsCount`.
- Responding to / moderating external reviews; sentiment analysis.
- Real-time sync, calendar/price/reservation data.
- Importing external reviews **into** Hospeda's own review table (never).

## Suggested Tasks (phased)

**Phase 1 — Schemas, enums, config, env.** Listing + reputation schemas,
`ExternalPlatformEnum`, public response shape; env vars (+ shared w/ SPEC-222).

**Phase 2 — DB.** Two tables + models + master-toggle column; migration; extras.

**Phase 3 — Fetch adapters + services.** Google Places adapter (placeId resolve +
Place Details + snippet mapping + TTL), Booking/Airbnb/generic aggregate adapters
(numbers-only, text-stripped), `safeExternalFetch` (reuse/build). Refresh service
(constrained) + listing-config service. Unit tests incl. **per-adapter test that
no review text leaks for non-Google**, TTL-degrade logic, toggle filtering.

**Phase 4 — Endpoints.** Owner refresh (rate-limited) + listing CRUD + public
list (toggle-filtered, TTL-degraded) + admin takedown [if kept]. Integration
tests. Endpoint-gate-matrix rows.

**Phase 5 — Cron.** `refresh-external-reputation` weekly job + test.

**Phase 6 — Web UI.** Sibling external-reputation block on detail; per-platform
badges/links/attribution; Google snippets; the "why only Google" explainer; i18n.
Component test.

**Phase 7 — Owner config UI.** Manage listings + toggles + refresh button.

**Phase 8 — Docs & ADR.** Route-architecture; ADR (separate-entity decision,
Google-only-text + TTL, aggregate-only legal posture, provider abstraction shared
w/ SPEC-222, stateful-with-cron). Legal copy review. Smoke: one Google fetch +
one aggregate fetch.

## Open micro-decisions (defaults applied — flag if you disagree)

1. **Master toggle location**: additive `accommodations.show_external_reputation`
   column (default) vs a separate settings row. Default: column (SSR-friendly).
2. **Admin takedown (US-6.2)**: keep a minimal admin disable/purge for legal/abuse
   (default: keep) vs drop entirely.
3. **Owner config surface**: web host UI vs admin panel vs both. Default: follow
   wherever the owner edits the accommodation today (confirm at impl).
4. **`verified` ownership check**: out of MVP (advisory flag only), revisit later.
