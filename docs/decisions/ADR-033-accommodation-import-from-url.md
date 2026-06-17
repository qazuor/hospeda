# ADR-033: Accommodation Import from URL (tiered strategy, provider abstraction, SSRF, legal posture)

## Status

Accepted

## Date

2026-06-16

## Context

Hosts onboarding an accommodation must retype data that already exists on an
external listing (Airbnb, Booking, MercadoLibre, Google Maps, or a generic
site). SPEC-222 adds a feature where a host pastes a listing URL and the
platform extracts structured data to **pre-fill** the create/edit form for human
review before anything is saved.

The feature is deliberately narrow:

- **Stateless** — a one-shot extract; no import is persisted as its own entity.
- **Pre-fill only** — the human always reviews and confirms; no field (and never
  the destination FK) is auto-committed.
- **Reviews/ratings are 100% out of scope** — guest reviews, ratings, and
  aggregate scores must never be extracted, stored, or displayed.

Several cross-cutting decisions were needed: how to extract across heterogeneous
sources, how to fetch arbitrary user-supplied URLs safely, whether to record
imports, and the legal/ToS posture of scraping third-party listings.

## Decision

### 1. Source-aware tiered extraction strategy

`detectSource(url)` labels the platform; each `ImportSourceAdapter.supports(url)`
decides routing (the authority). Adapters try the cheapest, most reliable signal
first and degrade:

- **Official API first** where one exists: Google Places (Place Details),
  MercadoLibre (`/items/{id}` with OAuth app token), Airbnb/Booking via an Apify
  actor. These yield the highest-confidence fields.
- **Structured HTML next** (generic + Booking direct): JSON-LD
  (`LodgingBusiness`/`Hotel`), then Open Graph, then targeted meta tags — parsed
  with bounded regex + `JSON.parse`, **no headless browser, no cheerio/jsdom**.
- **Strategy B (AI) last, only when needed**: the generic adapter falls back to
  AI extraction (`@repo/ai-core` `generateObject`, feature
  `accommodation_import`) only when the structured pass yields fewer than a
  threshold of useful fields. AI fields get the lowest confidence and only fill
  gaps — structured results always win.

Every field carries `{ value, confidence (0-100), source }` so the UI can show
the host where each value came from and how much to trust it.

### 2. `ImportSourceAdapter` provider abstraction + Apify choice

Per-source extraction lives behind a single `ImportSourceAdapter` interface
(`supports`, `extract`). Third-party scraping for Airbnb/Booking is delegated to
**Apify** actors, reached via the plain REST `run-sync-get-dataset-items`
endpoint (no SDK) with the token sent in the `Authorization` header. The actor
id is configuration (`HOSPEDA_APIFY_*`), so swapping providers (or self-hosting a
scraper) is a config + adapter change with no ripple into the orchestrator,
mapping, or routes.

### 3. SSRF-hardened fetch (`safeExternalFetch`)

User-supplied URLs are fetched through `safeExternalFetch` (`@repo/utils`):
HTTPS-only; reject `file:`/`ftp:`/localhost/internal hostnames; DNS-resolve the
host and block private/loopback/link-local ranges (RFC-1918, 127.0.0.0/8,
169.254.0.0/16, `::1`, `fc00::/7`) **before connecting**, pinning the resolved IP
to defeat DNS-rebinding (TOCTOU); cap redirects; enforce a timeout
(`HOSPEDA_IMPORT_FETCH_TIMEOUT_MS`) and a max body size
(`HOSPEDA_IMPORT_FETCH_MAX_BYTES`).

### 4. Stateless — no audit/import table

An import does not create a row. The pipeline runs, returns a draft, and is
forgotten. Rationale: the artifact of value is the saved accommodation (which has
its own audit trail); a separate import-history table would add storage,
migration, and privacy surface for no product requirement (YAGNI). Observability
is covered by ephemeral, fire-and-forget PostHog events, not durable rows.

### 5. Reviews/ratings excluded by construction

Review/rating fields are stripped at the extractor level (`aggregateRating`,
`review`, `ratingValue`, `reviewCount`, …), the AI output schema does not request
them and the AI guardrail prompt forbids them, and the response schema has no
field to carry them. This is enforced by tests at every layer (extractor, AI
mapper, route integration).

### 6. Fault-isolation — the pipeline never throws

Every step is wrapped: a blocked fetch, an unconfigured provider, a malformed
page, or an AI error degrades to a partial/empty draft with a human-readable
message and `source: 'none'`, never a 500. Missing third-party credentials
degrade cleanly (US-11) so the feature ships before the owner provisions keys.

### 7. AI quota applies only to Strategy B, degrade-clean

The endpoint itself is permission-gated (create OR update), **not**
entitlement-gated — any host can import from official APIs / JSON-LD. The
`accommodation_import` AI entitlement + monthly quota are enforced **lazily**
inside the injected `aiExtract` port (only when Strategy B actually runs). A host
without the entitlement/quota still gets the structured-only draft plus an
informational notice; they are never hard-blocked with a 403. Successful AI calls
are metered so the monthly quota increments.

### 8. Legal / ToS posture

Importing is **host-initiated and human-confirmed**: the host asserts, via a
required `legalConfirmed` checkbox (re-validated server-side), that they have the
right to import the listing's data. The platform extracts only factual
accommodation attributes the host is reproducing for their own listing, never
third-party user-generated content (reviews/ratings). Access is rate-limited
per-user, uses realistic request headers, and respects each source's official
API where available. The feature does not redistribute scraped content publicly;
it pre-fills a private form the host then edits and owns.

## Consequences

### Positive

- Hosts onboard faster; data quality is visible (confidence + source per field).
- One small interface (`ImportSourceAdapter`) localizes per-source quirks and
  makes the third-party provider swappable via config.
- SSRF guard makes fetching arbitrary user URLs safe by default.
- Statelessness keeps the surface tiny — no migration, no PII retention, no
  audit table to govern.
- Reviews-excluded posture is structurally enforced, not just by convention.

### Negative

- Scrapers are brittle: third-party HTML/actor changes can silently reduce
  extraction quality. Mitigated by graceful degradation + AI fallback.
- AI extraction has a cost; bounded by the threshold gate, per-feature quota, and
  the engine's USD cost ceiling.

### Risks

- ToS of some sources discourage scraping. Mitigated by host-confirmed,
  human-in-the-loop, official-API-first, no public redistribution, rate limits.
- Provider outages (Apify/Google/ML) degrade the feature for those sources;
  handled by clean degradation rather than failure.

## Alternatives Considered

### Headless-browser scraping (Playwright/Puppeteer) in-house

Rejected: heavyweight, expensive, and a much larger SSRF/operational surface than
official APIs + structured HTML + an external scraping provider for the hard
sources.

### Persisting imports in an audit table

Rejected (YAGNI): no product need; adds storage, migration, and privacy surface.
Ephemeral PostHog events cover observability.

### Auto-applying high-confidence fields (incl. destination)

Rejected: violates the human-in-the-loop principle and risks wrong data
(especially the destination FK). All fields, including a single exact
destination match, are advisory only.

### Gating the whole endpoint behind the AI entitlement

Rejected: would block non-AI imports (official APIs / JSON-LD) for hosts on
AI-less plans. The quota is applied lazily to Strategy B only, degrade-clean.

## Related Decisions

- [ADR-031](ADR-031-ai-core-foundation-architecture.md) — AI Foundation Architecture (`@repo/ai-core`), the engine behind Strategy B.
- [ADR-016](ADR-016-billing-fail-open.md) — Billing fail-open policy, mirrored by the degrade-clean AI quota gate.
- [ADR-006](ADR-006-integer-monetary-values.md) — Integer monetary values, used by AI usage cost metering.
