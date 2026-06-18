# ADR-036: External Reputation as a Separate Entity (SPEC-237)

## Status

Accepted (2026-06-18)

## Context

SPEC-237 adds the ability to show reputation data from external booking platforms
(Google, Booking.com, Airbnb, and generic sites) on accommodation detail pages.
The feature must show real Google review snippets (text + author + date) and
aggregate-only data (rating + review count + deep link) for all other platforms.

Several cross-cutting decisions were needed before implementation:

1. **Where to persist external reputation** — extend the existing internal
   `accommodation_reviews` table or create a separate entity.
2. **Which platforms may supply snippet text** — review text is copyrighted content;
   showing it without authorization is a ToS / legal risk.
3. **How long to cache Google snippet text** before it must be refreshed or stripped.
4. **Legal posture for non-Google platforms** — what is safe to show without a
   platform-specific data-sharing agreement.
5. **Whether to reuse SPEC-222 infrastructure** — that spec built adapters, a safe
   HTTP wrapper, and an Apify client for scraping; SPEC-237 overlaps on provider
   abstraction.
6. **Refresh strategy** — on-demand (like SPEC-222 imports) or background-cached.
7. **Where to store the master on/off toggle** — on the accommodation row or a
   separate config table.

## Decision

### 1. Separate entity, not an extension of `accommodation_reviews`

External reputation is persisted in two new tables:

- `accommodation_external_listings` — one row per platform link registered by the
  host (URL, platform, per-listing flags `showReviews`, `showLink`, `showRating`).
- `accommodation_external_reputation` — one cache row per
  `(accommodationId, platform)`, updated by the background refresh job.

`accommodation_reviews` was **not extended** for the following reasons:

- `accommodation_reviews.userId` is `NOT NULL` with a FK to `users(id)`. External
  platform reviews have no Hospeda user. Adding a nullable user FK and an
  `isExternal` flag would corrupt the table's invariant that every review belongs
  to a registered user.
- The review lifecycle (moderation, `PENDING`/`APPROVED`/`REJECTED` states,
  report flow) is irrelevant to cached platform data fetched by a system job.
- The rating aggregate computed from `accommodation_reviews` feeds
  `accommodations.averageRating`. **External reputation must never contaminate that
  aggregate** — the internal rating reflects real guest feedback submitted through
  the platform; mixing external aggregates (which may use different scales or
  sampling windows) would corrupt host metrics and billing limit signals.

Keeping the two concerns as separate entities eliminates schema-level coupling and
makes the isolation enforceable via tests.

### 2. Google-only for review snippet text

Only `GoogleReputationAdapter` may populate the `snippets` field in
`ReputationFetchResult`. All other adapters (`BookingReputationAdapter`,
`AirbnbReputationAdapter`, `GenericReputationAdapter`) MUST return
`snippets: null` regardless of what the upstream source returns.

**Rationale:**

- The **Google Places API (New)** provides an official, documented
  `X-Goog-FieldMask` mechanism for fetching up to five review entries per place.
  Google's [Places API Terms of Service](https://developers.google.com/maps/terms)
  explicitly permit displaying review content with attribution ("Powered by Google")
  as long as the app links back to Google Maps. This is codified in
  `GoogleReputationAdapter`, which populates `attributionUrl` with the standard
  Google Maps attribution URL for the place.
- **Booking.com and Airbnb ToS prohibit** republishing guest review text. Their
  contracts restrict programmatic access to review content to registered
  distribution partners; scraping and displaying review text is explicitly
  forbidden. Publishing review text from these platforms would constitute a
  copyright violation and/or ToS breach that carries legal risk for the platform.
- **Generic sites** have no blanket permission grant; snippet text is treated as
  copyrighted by default.

The `snippets: null` constraint is enforced at the adapter-type level
(`adapter.types.ts` JSDoc) and integration-tested. A code comment on
`ReputationFetchResult.snippets` states the constraint as "AC-7.1 legal guard"
so future adapter authors cannot accidentally violate it.

### 3. Google 30-day TTL with aggregate-only degradation

The `accommodation_external_reputation` table records two separate fetch
timestamps:

- `snippetsFetchedAt` — timestamp of the last successful snippet fetch.
- `aggregateFetchedAt` — timestamp of the last successful aggregate fetch.

The public display contract is:

- If `snippetsFetchedAt` is within 30 days → show snippets + attribution.
- If `snippetsFetchedAt` is older than 30 days or `null` → **degrade to
  aggregate-only** (show `rating` + `reviewsCount` + `deepLink` but strip
  `snippets` from the public response). The `AccommodationExternalPublicSchema`
  enforces this at the schema level: the public block omits `snippets` when the
  TTL has lapsed, and the service computes a `snippetsExpired` flag that the UI
  uses to decide which variant to render.
- The weekly cron job prioritises accommodations whose
  `snippetsFetchedAt IS NULL OR snippetsFetchedAt < (NOW() - TTL + 5 days)` so
  snippets are refreshed before expiry, not after.

The 30-day TTL was chosen to:

  1. Stay within Google's "freshness" expectation for cached Places data.
  2. Keep API call volume low (weekly batch vs. per-request fetching).
  3. Give the cron a 5-day safety margin to retry before display degrades.

### 4. Aggregate-only legal posture for non-Google platforms

For Booking.com, Airbnb, and generic sites, the public block shows only:

- `rating` (numeric value)
- `reviewsCount` (integer)
- `deepLink` (URL to the reviews section on the platform)

These are **factual numbers** — rating scores and counts are not copyrightable
expression. Displaying them alongside a direct link to the authoritative source
satisfies both the user-value goal (corroboration of quality) and the legal
constraint (no reproduction of copyrighted text).

`BookingReputationAdapter` and `AirbnbReputationAdapter` fetch via the Apify
scraping infrastructure (same `apify-client.ts` and `safeExternalFetch` wrapper
used by SPEC-222). They extract only numeric aggregate fields from the scraped
page and explicitly discard any text content before constructing the
`ReputationFetchResult`.

### 5. Provider abstraction: shared infrastructure, distinct adapters

SPEC-222 (accommodation import from URL) established:

- `safeExternalFetch` in `@repo/utils` — a safe HTTP wrapper with SSRF
  protection, redirects guard, and content-type gating.
- `apify-client.ts` in `@repo/service-core` — a thin wrapper around the Apify
  actor API used to scrape sites that block direct HTTP fetch.
- An adapter pattern (`ImportAdapter` interface) for provider-specific extraction.

SPEC-237 **reuses** `safeExternalFetch` and `apify-client.ts` without
modification. It does **not** reuse the `ImportAdapter` interface or any SPEC-222
import adapter because:

- The SPEC-222 Google adapter (`google-places.adapter.ts`) intentionally excludes
  `rating` and `reviews` from its Places API field mask. That mask must not be
  changed — doing so would silently expand every host import's data surface and
  risk exposing review content inside the pre-fill form.
- Reputation adapters have a different interface (`ReputationAdapter`) and a
  different result type (`ReputationFetchResult`) that is optimized for recurring
  cache updates (nullable fields, `snippets` array, `attributionUrl`) rather than
  one-shot import pre-fill.

The two adapter sets live in separate directories
(`services/accommodation-import/adapters/` vs
`services/accommodation-external-reputation/adapters/`) and share no
inheritance. See [ADR-033](ADR-033-accommodation-import-from-url.md) for the
SPEC-222 design.

### 6. Stateful-with-cron design (weekly background refresh)

SPEC-222 imports are **stateless** — the host triggers a one-shot HTTP fetch,
the result is returned immediately, and nothing is persisted as an import entity.

SPEC-237 reputation data is **stateful** — results are persisted in
`accommodation_external_reputation` and served from cache on every public page
load. This design was chosen because:

- A per-request live fetch of Google Places + Apify scraping would add 1–3 s to
  accommodation detail page SSR latency and would quickly exhaust API quotas.
- Platform APIs (especially Apify scrapers) are billed per call; batching weekly
  keeps cost predictable.
- The 30-day TTL means cached data is fresh enough for the display use case
  (reputation changes slowly).

The background job (`refresh-external-reputation.job.ts`) runs weekly
(`HOSPEDA_EXTREP_CRON_SCHEDULE`, default `0 2 * * 1`). It:

1. Queries all accommodations with at least one enabled external listing.
2. Prioritises accommodations near snippet TTL expiry.
3. Calls each platform adapter once per listing.
4. Upserts results into `accommodation_external_reputation`.
5. Tolerates per-accommodation failures (logs and continues).

Owners may also trigger a manual refresh via
`POST /api/v1/protected/accommodations/:id/external-reputation/refresh`, which
is rate-limited to prevent quota abuse. The cron job bypasses this rate limit.

### 7. Master toggle as an additive column on `accommodations`

The on/off toggle for the external reputation block on the public detail page is
stored as `accommodations.show_external_reputation BOOLEAN NOT NULL DEFAULT FALSE`
— an additive column added in migration `0019_massive_living_tribunal.sql`.

Alternative considered: a separate `accommodation_external_reputation_config`
table keyed by `accommodationId`.

**Rejected** because:

- A separate config table would require a JOIN on every accommodation detail page
  SSR render just to check one boolean.
- The column is append-only (no structural constraint dependencies) and defaults
  to `false`, so the migration is non-destructive and backward compatible.
- The SSR page can read `show_external_reputation` from the existing accommodation
  row fetch with zero extra queries.

The `verified` flag for individual external listing data was intentionally deferred
from MVP scope. It will be added in a future spec when a verification flow is
designed.

---

## Consequences

- (+) Internal `averageRating` and the billing entitlement engine are fully
  isolated from external reputation data — no contamination risk.
- (+) Legal posture is explicit and enforced at the type layer: only Google
  snippets are shown, and only when the 30-day TTL has not lapsed.
- (+) Weekly cron batching keeps API costs predictable; per-page latency is
  unaffected (cached reads only on the public tier).
- (+) `safeExternalFetch` and `apify-client.ts` are reused without modification,
  reducing duplicated infrastructure.
- (+) The `show_external_reputation` boolean on the accommodation row keeps the
  SSR detail page join-free for the display toggle.
- (-) The 30-day Google snippet TTL means snippets may be up to 30 days stale.
  Operators should treat them as a signal, not a real-time feed.
- (-) Booking/Airbnb aggregate data depends on Apify scrapers, which may break if
  the platforms change their HTML structure. Scraper failures degrade the row's
  `fetchStatus` to `'error'` and leave previously-cached values intact.
- (~) The `verified` flag is out of MVP scope, meaning hosts cannot yet mark
  external listings as officially verified. Deferred to a future spec.

## Alternatives Considered

### Extend `accommodation_reviews` with an `isExternal` flag

Rejected. The `userId NOT NULL` FK cannot accommodate platform reviews with no
Hospeda user identity. Adding a nullable `userId` would also corrupt the internal
rating aggregate computation, which relies on the assumption that every row in
`accommodation_reviews` represents a guest who used the platform.

### Live per-request external fetches (no cache)

Rejected. Adds 1–3 s to accommodation SSR latency and burns API quota on every
page load. At current traffic this would require expensive per-request rate
limiting and would still degrade under load. The cache model is strictly better
for the static-ish nature of reputation data.

### Reuse `ImportAdapter` from SPEC-222 for reputation fetching

Rejected. The SPEC-222 adapter interface and result type are optimized for
one-shot pre-fill (non-nullable fields, no snippets). Forcing reputation data
through that interface would require changing the Google import adapter's field
mask (breaking SPEC-222's explicit "no ratings" invariant) or wrapping both in a
facade that solves nothing. Separate adapter interfaces with shared underlying
infrastructure is the correct seam.

### Store the master toggle in a separate config table

Rejected. A dedicated `accommodation_external_reputation_config` table adds a
JOIN to every accommodation detail SSR render. The boolean column on
`accommodations` achieves the same goal with zero additional queries.

## Related Decisions

- [ADR-033](ADR-033-accommodation-import-from-url.md) — Accommodation import from
  URL (SPEC-222). Documents the `safeExternalFetch` / `apify-client.ts` /
  `ImportAdapter` infrastructure that SPEC-237 reuses for HTTP fetching but does
  not reuse at the adapter-interface level.
- [ADR-029](ADR-029-versioned-migration-strategy.md) — Versioned migration
  strategy. Migration `0019_massive_living_tribunal.sql` follows the standard
  Drizzle-kit generate + migrate carril.
- [ADR-025](ADR-025-factory-level-strict-response-strip.md) — Factory-level
  strict response strip. The `AccommodationExternalPublicSchema` enforces the
  snippet-TTL degradation at the schema layer so the public route factory strips
  `snippets` when the TTL has lapsed, consistent with the platform-wide strip
  policy.
