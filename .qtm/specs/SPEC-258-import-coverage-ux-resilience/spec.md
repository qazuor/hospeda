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
| A3 | MercadoLibre | Add a 2nd call to `/items/{id}/description` → `description`; scan `attributes` for `PROPERTY_TYPE`/`REAL_ESTATE_TYPE` → `type`, `BEDS` → `extraInfo.beds`, and amenity-type attributes → `amenityNames`. | Medium |
| A4 | Booking | Add `beds`, `price`/`currency`, `facilities`/`amenities` to `BookingItem` + map them; reconsider the `USEFUL_FIELD_THRESHOLD` so type/capacity/amenities aren't dropped when JSON-LD barely passes (e.g. always try to enrich `type`+`capacity` via the actor even if JSON-LD gave name+description). | Medium |
| A5 | Generic | Wire JSON-LD `priceRange` → `price` where it is numeric-parseable; map JSON-LD `@type` → `type`. | Low |
| A6 | All | Decide SEO: either leave `seo.*` host-authored (document as intentional) or auto-derive `seo.title`/`seo.description` from name+locality+summary (no AI needed). | Low |

> Each A-task ships with the same non-mocked / real-shape test discipline SPEC-257
> established (probe the real actor/API response shape; do not trust guessed field
> names — that pattern hid two bugs already).

### B. UX — surface what was imported

**Problem:** `CreatePropertyMiniForm` only renders name, type, city and summary. Every
other imported field (description, coordinates, images, amenities, capacity/beds/baths,
price, contact, country) is set on the draft and sent to the onboarding endpoint, but
the host never sees it in the create step — so a rich import looks like it did almost
nothing.

**Options (pick during planning):**

1. **Imported-summary panel (recommended)** — after a successful import, render a
   compact, read-only "Esto importamos" block listing every prefilled field with its
   value preview, source and confidence badge (the badge component already exists for
   name/type/summary). E.g. "✓ 10 fotos · ✓ 8 amenities · ✓ 3 hab / 8 camas / 1 baño ·
   ✓ coordenadas · ✓ precio $X". Non-editable here; editable in the panel.
2. **Expand the mini-form** to show the high-value extras inline (description preview,
   image thumbnails, capacity) before "Crear y continuar". Heavier; risks bloating the
   "minimum viable" create step.
3. **Carry confidence badges into the full panel** so the host sees on the edit page
   which fields came from import (most already flow there; needs the badges rendered).

A blend of (1) for the create step + (3) for the panel is likely best: the host gets
immediate proof of what was captured, then reviews/edits in the panel.

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
- **Open questions for planning:** (Q1) UX approach — imported-summary block vs expanded
  mini-form vs panel-only badges (recommended: block + panel badges). (Q2) Booking
  threshold strategy — always-enrich-type/capacity vs raise threshold. (Q3) SEO — auto-derive
  vs leave manual. (Q4) Import cache TTL + storage (in-memory vs Redis). (Q5) Whether the
  async import path is in scope here or deferred to align with SPEC-250.
