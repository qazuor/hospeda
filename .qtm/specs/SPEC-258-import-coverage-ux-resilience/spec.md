---
spec-id: SPEC-258
title: Accommodation import — coverage gaps, limbo fields, UX surfacing & scraper resilience
type: improvement
complexity: high
status: draft
created: 2026-06-22T14:53:31Z
---

# SPEC-258 — Accommodation import: coverage, UX surfacing & scraper resilience

> Follow-up of **SPEC-257** (which followed up SPEC-222). SPEC-257 made the four
> import sources work end-to-end (short links, user locale, adapter re-mapping,
> destination auto-select). This spec closes the **data-coverage gaps**, fixes the
> **UX gap** (imported data the host never sees), and adds **resilience** so a
> blocked scraper does not take the whole feature down. **Not yet implemented** —
> written so SPEC-257 can close and other work can proceed.

## 1. Overview

### Goal

Raise the quality and trustworthiness of accommodation import along three axes:

1. **Coverage** — capture the fields each source actually exposes but we don't map
   yet ("limbo"), and decide explicitly about the ones we can't.
2. **UX surfacing** — show the host *everything* that was imported/prefilled, even
   fields that don't live in the create mini-form, so the import feels trustworthy
   instead of a black box.
3. **Resilience** — when a scraper/actor is rate-limited or anti-bot-blocked, the
   feature must degrade gracefully with a clear, actionable message and fallbacks,
   never present a dead end.

### Motivation

The SPEC-257 Chrome smoke proved the pipeline works but surfaced three classes of
problem worth a dedicated spec:

- Several useful fields are available upstream but unmapped (Google `types`, ML
  description, Booking capacity/amenities, currency).
- The create mini-form only renders name/type/city/summary, so a host who imports
  an Airbnb listing never sees that we also captured the description, coordinates,
  10 photos, amenities, capacity, beds and price — it silently goes to the panel.
  That reads as "the import barely did anything".
- The Airbnb Apify actor went into an anti-bot cooldown after repeated runs and the
  import surfaced "No pudimos extraer información de esta URL" — a hard dead end with
  no retry, no fallback, and a message that blames the user's URL.

## 2. Current state — field coverage matrix

Legend: **✅ mapped today** · **⚠️ limbo (available upstream, not mapped / not reliable)** · **❌ not available (source limitation)**

| Field | Airbnb (Apify) | Booking (JSON-LD) | Booking (Apify) | MercadoLibre (API) | Google (Places) | Generic (JSON-LD/OG) | Generic (AI) |
|---|---|---|---|---|---|---|---|
| name | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| summary | ✅ | ❌ | ❌ | ❌ | ✅ (editorialSummary, often empty) | ✅ (cond.) | ✅ |
| description | ✅ | ✅ | ✅ | ⚠️ (2nd endpoint) | ❌ | ✅ | ✅ |
| type | ✅ | ❌ | ✅ | ⚠️ (PROPERTY_TYPE attr) | ⚠️ (types[] fetched, dropped) | ❌ | ✅ |
| extraInfo.capacity | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| extraInfo.bedrooms | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| extraInfo.beds | ✅ | ❌ | ⚠️ (not in type) | ⚠️ (no attr scan) | ❌ | ❌ | ✅ |
| extraInfo.bathrooms | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| location.coordinates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| location.street | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| location.number | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| price.price | ✅ | ❌ | ⚠️ (not in type) | ✅ | ❌ | ⚠️ (priceRange not wired) | ✅ |
| price.currency | ⚠️ (not in type) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| contactInfo.phone | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| contactInfo.website | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| imageUrls | ✅ | ✅ | ✅ | ✅ | ❌ (photos not in mask) | ✅ | ✅ |
| amenityNames | ✅ | ❌ | ⚠️ (not in type) | ⚠️ (no attr scan) | ❌ | ❌ | ✅ |
| scrapedLocality | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| scrapedCountry | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| seo.title / seo.description | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Key reads:**

- **Airbnb** is the most complete (14/22). Gaps: currency (limbo), street/number/contact
  (not in Airbnb's model), SEO.
- **Google** is the only source for street number + phone + website, but gives no
  description/price/images/capacity/amenities (Places API limitation) and **drops the
  `types[]` it already fetches** (limbo → type).
- **MercadoLibre** is the only reliable **currency** source; its biggest miss is the
  **description** (lives at a second endpoint we don't call) and `PROPERTY_TYPE`/beds/
  amenities attributes we don't scan.
- **Booking** silently loses type/capacity/amenities when the cheap JSON-LD path meets
  the 2-field threshold and skips the actor; `beds`/`price`/`amenities` aren't even in
  the `BookingItem` type.
- **SEO** is a dead slot across all adapters (only AI could fill it).

## 3. Scope — three workstreams

### A. Close the limbo (per source)

| # | Source | Change | Effort |
|---|---|---|---|
| A1 | Google | Map `place.types[]` → `RawExtraction.type` via the existing `mapAccommodationType` heuristic (types are already in the field mask, just discarded in `buildRawExtraction`). | Trivial |
| A2 | Airbnb | Add `currency` to `AirbnbItem` + map to `price.currency` when the actor returns it. | Trivial |
| A3 | MercadoLibre | **DEFERRED (2026-06-23).** Blocked on a prerequisite: the ML import tier is NOT production-viable today — it uses a static `HOSPEDA_MERCADOLIBRE_TOKEN` (no refresh flow), and ML access tokens expire ~6h, so the tier silently dies without manual rotation + redeploy. Enriching ML extraction polishes an unusable tier. **Prerequisite = a separate task/spec: ML OAuth refresh-token flow** (client_id/secret + persisted rotating refresh_token + token service). A3 resumes once that lands. Planned changes (for then): 2nd call to `/items/{id}/description` → `description`; scan `attributes` for `PROPERTY_TYPE`/`REAL_ESTATE_TYPE` → `type`, `BEDS` → `extraInfo.beds`, amenity attrs → `amenityNames`. | Medium |
| A4 | Booking | **(Q2 RESOLVED: full coverage.)** Map JSON-LD `@type`→`type` (free, no actor). Add `beds`, `price`/`currency`, `facilities`/`amenities` to `BookingItem` + map them; escalate to the actor to enrich capacity/beds/amenities even when JSON-LD passed `USEFUL_FIELD_THRESHOLD`. | Medium |
| A5 | Generic | Wire JSON-LD `priceRange` → `price` where it is numeric-parseable; map JSON-LD `@type` → `type`. | Low |
| A6 | All | **(Q3 RESOLVED: leave host-authored.)** Doc-only: document `seo.*` as intentionally host-authored (edited in the panel). No code change. | Low |
| A7 | Web | **Import analytics — PostHog events** (import attempt / success / failure-with-source / fields-prefilled count). Inherited from SPEC-222 T-028 (the smoke + legal copy parts shipped; the PostHog events were never wired). | Low |

> Each A-task ships with the same non-mocked / real-shape test discipline SPEC-257
> established (probe the real actor/API response shape; do not trust guessed field
> names — that pattern hid two bugs already).

### B. UX — surface what was imported

**Problem:** `CreatePropertyMiniForm` only renders name, type, city and summary. Every
other imported field (description, coordinates, images, amenities, capacity/beds/baths,
price, contact, country) is set on the draft and sent to the onboarding endpoint, but
the host never sees it in the create step — so a rich import looks like it did almost
nothing.

**DECISION (2026-06-23, owner): expand the mini-form with progressive disclosure,
data-only, single import call.** Rejected: re-import (double Apify cost + higher
anti-bot block risk) and cache (staleness + invalidation complexity). The import runs
ONCE on the web onboarding step and the create form persists everything then; the panel
becomes pure editing. Concretely:

1. **Single-call persistence.** `handleImported` stops discarding fields. The mini-form
   captures every data field the import returned and submits them to an EXPANDED
   `/host-onboarding/start`. `createForOnboarding` persists the scalars (description,
   `extraInfo.{capacity,bedrooms,beds,bathrooms}`, `location.{coordinates,street,number}`,
   `price.{price,currency}`, `contactInfo.{mobilePhone,website}`) into their JSONB columns
   (reusing the existing flat→nested converter from `AccommodationCreateHttpSchema`) and
   syncs amenities via `syncAmenityJunction()` inside its existing transaction (mirrors the
   admin panel save path).
2. **Progressive disclosure.** Only name/summary/type stay REQUIRED and always visible.
   Every imported extra is OPTIONAL and rendered ONLY when the import actually returned a
   value for it (fields with no data are not shown), each with the existing confidence
   badge. The manual (non-import) path stays the original 4-field form. Optional fields
   validate only when present (e.g. imported description shorter than min(30) must not
   block submit).
3. **Images are OUT of scope** — data-only. `imageUrls` are not persisted (no re-host
   subsystem). The extracted `imageUrls` remain unconsumed; accepted tradeoff.
4. **Amenities resolver enhancement** — `resolveAmenities` today matches strictly against
   the ES name (exact). Add a static ES/EN/PT synonym/variant map + normalization
   (lowercase, strip accents, singular/plural) + EN/PT fallback search so pileta/pool/
   piscina all resolve to our "piscina" amenity. No DB table/migration; unmatched names
   still flow to `unresolvedAmenities`.

**Slicing into chained PRs:** PR1 = workstream A (coverage). PR2 = amenities resolver
enhancement (isolated, real-shape tests). PR3 = onboarding persistence (schema +
`createForOnboarding`) + web mini-form progressive disclosure + i18n (endpoint and form
are coupled, ship together).

**AC examples:**

- After importing an Airbnb listing, the create step shows a summary listing ≥ the
  fields that were prefilled (count of photos, amenities, capacity figures, price,
  description present), each with source/confidence.
- Fields not captured are not listed (no false "imported" claims).

### C. Resilience — never let a blocked scraper dead-end the feature

**Problem:** the Airbnb Apify actor returns an empty dataset under anti-bot pressure
(observed after ~6 runs). The current UX shows "No pudimos extraer información de esta
URL. El sitio puede estar bloqueando el acceso o la URL no corresponde a un alojamiento."
— a dead end that wrongly implies the host's URL is wrong.

**Proposals:**

1. **Differentiate failure modes.** Distinguish (a) invalid/unsupported URL, (b) source
   temporarily blocked / empty dataset, (c) credential/config error, (d) timeout. Each
   gets its own message. (b) should say "la fuente está temporalmente no disponible,
   probá de nuevo en unos minutos" + offer manual entry — NOT blame the URL.
2. **Retry with backoff** on empty/blocked actor results (1–2 retries, jittered), since
   anti-bot blocks are often transient.
3. **Fallback chain per source.** If the Airbnb/Booking actor returns empty, try the
   Generic adapter (JSON-LD/OpenGraph) against the same URL as a best-effort partial
   import (name + image + description from OG) instead of nothing.
4. **Import cache.** Cache a successful extraction per normalized URL for N hours so
   re-imports (and repeated smokes) don't re-hit the actor and don't re-trigger blocks.
   Also lets the host retry instantly after a transient UI issue.
5. **Async option for slow/contended sources.** For actors that are slow or rate-limited,
   reuse the async pattern from SPEC-250 (Apify async API + polling) so the import isn't
   a single blocking 8–120s request.
6. **Provider-level mitigation (config, no code churn).** Document/allow configuring
   residential-proxy or alternative actors via `ctx.credentials.apify*Actor` so ops can
   swap a blocked actor without a deploy.
7. **Graceful manual path.** Whenever extraction yields nothing, the create form stays
   fully usable for manual entry with a clear note — the host is never stuck.

## 4. Out of scope

- Real MercadoPago / billing changes.
- New external providers beyond what `ctx.credentials` already supports (config only).
- Importing reviews/ratings — permanently excluded (SPEC-222 hard rule).
- Full AI-generation of missing fields beyond the existing Generic Strategy-B AI port.

## 5. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Guessed actor/API field names (the recurring trap) | Medium | Probe the real response shape first; non-mocked tests |
| Booking threshold change increases actor cost | Low/Med | Only escalate to the actor for high-value missing fields (type/capacity), not always |
| UX panel over-promises (shows a field as imported that's actually empty) | Medium | Only list fields with a real value + source; reuse confidence badges |
| Import cache serves stale data | Low | Short TTL + cache key on normalized URL; bypass on explicit re-import |
| Retry/backoff lengthens a failed import | Low | Cap retries (1–2) + jitter; async path for the slow case |

## 6. Tasks (suggested, by workstream)

- **Setup:** probe real response shapes (ML description endpoint, Booking actor item,
  Airbnb currency) and record them in the spec before coding.
- **Core A (coverage):** A1 Google type, A2 Airbnb currency, A3 ML description+attrs,
  A4 Booking enrichment+threshold, A5 Generic price/type, A6 SEO decision.
- **Core B (UX):** imported-summary block in the create step; confidence badges in the
  full panel; i18n (es/en/pt).
- **Core C (resilience):** failure-mode classification + messaging; retry/backoff;
  per-source Generic fallback; import cache; (optional) async path; provider config docs.
- **Integration/testing:** real-shape adapter tests; UX component tests; resilience
  tests (empty dataset → fallback/clear message, not dead end); i18n key-coverage.
- **Testing (smoke):** Chrome smoke per source (space out Airbnb runs to avoid anti-bot);
  verify the imported-summary UX and the blocked-source messaging.
- **Docs/cleanup:** update the import docs + the SPEC-257 cross-reference.

## Internal Review Notes

- Built directly from the SPEC-257 smoke findings + the per-adapter coverage audit
  (mechanisms, mapped vs limbo vs unavailable fields). The matrix in §2 is the
  authoritative current-state snapshot as of 2026-06-22.
- **Open questions — status (updated 2026-06-23):**
  - **(Q1) UX approach — RESOLVED.** Expand the mini-form with progressive disclosure +
    single-call persistence (data-only). See the §B decision block above. The
    "imported-summary block" and "re-import / cache" alternatives were rejected.
  - **(Q2) Booking threshold strategy — RESOLVED (2026-06-23): full coverage.** Map
    JSON-LD `@type`→type for free (no actor), AND escalate to the Apify actor to also
    fetch capacity/beds/amenities even when JSON-LD passed `USEFUL_FIELD_THRESHOLD`.
    Owner accepted the extra Apify cost for a single import (the cost-aversion was about
    DOUBLE calls / re-import, not a well-targeted single enrichment).
  - **(Q3) SEO — RESOLVED (2026-06-23): leave host-authored.** Do NOT auto-derive.
    A6 becomes a doc-only task: document `seo.*` as intentionally host-authored
    (edited in the panel). No code change.
  - **(Q4) Import cache — REJECTED.** No cache (staleness + invalidation cost; the
    single-call design makes it unnecessary).
  - **(Q5) Async import path — DEFERRED to workstream C** (out of scope for the A+B
    delivery in progress).
