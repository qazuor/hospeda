# JSON-LD Structural Audit

> Tracks SPEC-096 / REQ-096-37 (T-066, T-067, T-068) and HOS-117 (T-007, T-013).

This document records the structural audit of every JSON-LD generator
emitted by the public-facing web app, the gaps found, and the fixes
applied.

Last audited: 2026-07-10 (HOS-117 T-013).

## How JSON-LD is wired (current architecture)

All structured data passes through `src/components/seo/JsonLd.astro`
(generic wrapper that escapes `<`, `>`, `&` to prevent injection inside
`<script type="application/ld+json">`). Each layout (`DetailLayout`,
`MarketingLayout`, `LegalLayout`, `DefaultLayout`) exposes a named slot
`head-extra` that pages use to mount entity-specific JSON-LD blocks.

Every detail page mounts a **typed** `*JsonLd.astro` component (each one
wraps `JsonLd.astro` internally and owns its own schema.org shape) via the
`head-extra` slot — it does not assemble a raw JSON-LD object inline. This
replaced the earlier inline-object pattern (SPEC-096 era) as part of
SPEC-157 REQ-7: the typed component is now the single source of truth for
each entity's schema.org fields (geo, aggregateRating, eventStatus mapping,
FAQ join, publisher, etc.), so the shape can be unit-tested directly on the
component and reused on lower-detail surfaces.

| Component | File | Schema.org `@type` | Used by |
|-----------|------|---------------------|---------|
| `LodgingBusinessJsonLd` | `src/components/seo/LodgingBusinessJsonLd.astro` | `LodgingBusiness` and subtypes (`Hotel`, `Hostel`, `Motel`, `Resort`, `Campground`) | `alojamientos/[slug].astro` |
| `EventJsonLd` | `src/components/seo/EventJsonLd.astro` | `Event` | `eventos/[slug].astro` |
| `PlaceJsonLd` | `src/components/seo/PlaceJsonLd.astro` | `TouristDestination` | `destinos/[...path].astro` |
| `ArticleJsonLd` | `src/components/seo/ArticleJsonLd.astro` | `Article` (`BlogPosting`) | `publicaciones/[slug].astro` |
| `RestaurantJsonLd` | `src/components/seo/RestaurantJsonLd.astro` | `Restaurant` | `gastronomia/[slug].astro` |
| `TouristAttractionJsonLd` | `src/components/seo/TouristAttractionJsonLd.astro` | `TouristAttraction` | `experiencias/[slug].astro` |
| `BreadcrumbJsonLd` | `src/components/seo/BreadcrumbJsonLd.astro` | `BreadcrumbList` | All 6 detail pages above |
| `FAQPageJsonLd` | `src/components/seo/FAQPageJsonLd.astro` | `FAQPage` | Legal pages (privacidad, terminos, cookies), accommodation detail (when FAQs exist), destination detail (when FAQs exist, SPEC-158) |
| `AboutPageJsonLd` | `src/components/seo/AboutPageJsonLd.astro` | `AboutPage` | `nosotros`, `beneficios` |
| `PriceSpecificationJsonLd` | `src/components/seo/PriceSpecificationJsonLd.astro` | `Offer` + `UnitPriceSpecification` | `suscriptores/turistas`, `suscriptores/planes` |

`RestaurantJsonLd` and `TouristAttractionJsonLd` were the two entities
missing from this table before HOS-117 T-007/T-013 — gastronomy and
experience detail pages existed and already mounted their typed components,
but neither the audit doc nor the coverage guard test tracked them.

## Detail-page → typed-component map (all 6 entities)

| Detail page | File | Primary typed component | Also mounts |
|-------------|------|--------------------------|--------------|
| Accommodation | `src/pages/[lang]/alojamientos/[slug].astro` | `LodgingBusinessJsonLd` | `BreadcrumbJsonLd`, `FAQPageJsonLd` (conditional) |
| Event | `src/pages/[lang]/eventos/[slug].astro` | `EventJsonLd` | `BreadcrumbJsonLd` |
| Destination | `src/pages/[lang]/destinos/[...path].astro` | `PlaceJsonLd` | `BreadcrumbJsonLd`, `FAQPageJsonLd` (conditional) |
| Post | `src/pages/[lang]/publicaciones/[slug].astro` | `ArticleJsonLd` | `BreadcrumbJsonLd` |
| Gastronomy | `src/pages/[lang]/gastronomia/[slug].astro` | `RestaurantJsonLd` | `BreadcrumbJsonLd` |
| Experience | `src/pages/[lang]/experiencias/[slug].astro` | `TouristAttractionJsonLd` | `BreadcrumbJsonLd` |

## Required-field audit per @type

### LodgingBusiness (and subtypes)

Reference: schema.org/LodgingBusiness. Google Rich Results requires
`name`, `address`, `image`, `priceRange` (optional but recommended),
`starRating` (optional).

Page: `src/pages/[lang]/alojamientos/[slug].astro`.
Component: `src/components/seo/LodgingBusinessJsonLd.astro`.

| Field | Source | Status |
|-------|--------|--------|
| `@context` | hard-coded `https://schema.org` | OK |
| `@type` | `TYPE_MAP[accommodation.type] ?? 'LodgingBusiness'` (Hotel/Hostel/Motel/Resort/Campground) | OK |
| `name` | `accommodation.name` | OK |
| `description` | `accommodation.summary` | OK |
| `image` | `accommodation.featuredImage` | OK |
| `url` | `Astro.url.href` | OK |
| `address` (PostalAddress) | `addressLocality` from `destination.name`, `addressCountry: 'AR'` | OK (locality + country always present) |
| `geo` (GeoCoordinates) | conditional, when `location.lat` and `location.lng` are set | OK |
| `aggregateRating` | conditional, only when `averageRating > 0` | OK |
| `numberOfRooms` | conditional, from `extraInfo.bedrooms` | OK |
| `amenityFeature[]` (LocationFeatureSpecification) | derived from `accommodation.amenities` | OK |

### Event

Reference: schema.org/Event. Google requires `name`, `startDate`,
`location`, `image`, `description`. `eventStatus` recommended.

Page: `src/pages/[lang]/eventos/[slug].astro`.
Component: `src/components/seo/EventJsonLd.astro`.

| Field | Source | Status |
|-------|--------|--------|
| `name` | `event.name \|\| event.title` | OK |
| `description` | `event.summary \|\| event.description` | OK |
| `startDate` | `event.startDate` (ISO) | OK |
| `endDate` | conditional | OK |
| `eventStatus` | mapped to `EventCancelled` (cancelled), `EventRescheduled` (rescheduled), `EventScheduled` (default) | OK (REQ-096-37 fix in T-067) |
| `image` | `event.featuredImage` | OK |
| `location` (Place + PostalAddress) | `event.location.{name,city}` | OK |
| `organizer` | conditional from `event.organizer.name` | OK |
| `offers` | conditional when `price.amount` is set | OK |
| `url` | absolute, derived from `Astro.site \|\| Astro.url.origin` | OK |

### BlogPosting

Reference: schema.org/BlogPosting. Google requires `headline`,
`image`, `datePublished`, `author`, `publisher`.

Page: `src/pages/[lang]/publicaciones/[slug].astro`.
Component: `src/components/seo/ArticleJsonLd.astro`.

| Field | Source | Status |
|-------|--------|--------|
| `headline` | `post.title` | OK |
| `description` | `post.summary \|\| post.excerpt` | OK |
| `image` | `post.featuredImage` (placeholder if missing) | OK |
| `datePublished` | `post.publishedAt \|\| post.createdAt` | OK |
| `dateModified` | conditional | OK |
| `author` (Person) | conditional from `author.displayName \|\| author.name` | OK |
| `publisher` (Organization) | hard-coded Hospeda Organization, owned by the component | OK (added in T-067) |
| `url` | absolute | OK |

### TouristDestination

Reference: schema.org/TouristDestination. Required: `name`,
`description`, `image`, `geo` (recommended).

Page: `src/pages/[lang]/destinos/[...path].astro`.
Component: `src/components/seo/PlaceJsonLd.astro`.

| Field | Source | Status |
|-------|--------|--------|
| `name` | `dest.name` | OK |
| `description` | `dest.summary \|\| dest.description` | OK |
| `image` | `dest.featuredImage` | OK |
| `geo` (GeoCoordinates) | conditional from `dest.location.{lat,lng}`, owned by the component | OK (added in T-067) |
| `url` | absolute | OK |

### Restaurant

Reference: schema.org/Restaurant. Google Rich Results (`Restaurant`
extends `LocalBusiness`) recommends `name`, `image`, `address`,
`servesCuisine`, `priceRange`, `aggregateRating` (conditional).

Page: `src/pages/[lang]/gastronomia/[slug].astro`.
Component: `src/components/seo/RestaurantJsonLd.astro`.

| Field | Source | Status |
|-------|--------|--------|
| `@type` | hard-coded `Restaurant` | OK |
| `aggregateRating` | conditional `AggregateRating`, only when a usable rating exists | OK |

> This entity's typed component was added alongside the gastronomy
> vertical and had never been folded into this audit doc until HOS-117
> T-013 — verify its full field list against `RestaurantJsonLd.astro`
> directly if extending it; this table intentionally only calls out the
> two fields checked by the schema-shape guard in
> `json-ld-coverage.test.ts` today.

### TouristAttraction

Reference: schema.org/TouristAttraction (extends `Place`). Google Rich
Results recommends `name`, `description`, `image`, `geo` (conditional).

Page: `src/pages/[lang]/experiencias/[slug].astro`.
Component: `src/components/seo/TouristAttractionJsonLd.astro`.

| Field | Source | Status |
|-------|--------|--------|
| `@type` | hard-coded `TouristAttraction` | OK |

> Same note as `Restaurant` above: added with the experiences vertical,
> newly folded into this audit at HOS-117 T-013. Verify the full field
> list against `TouristAttractionJsonLd.astro` directly if extending it.

### BreadcrumbList

Reference: schema.org/BreadcrumbList. Required: `itemListElement[]`
(each `ListItem` with `position`, `name`, `item`).

| Page family | BreadcrumbList emitted? |
|-------------|------------------------|
| `alojamientos/[slug]` | Yes (T-068 fix) |
| `eventos/[slug]` | Yes (T-068 fix) |
| `publicaciones/[slug]` | Yes (T-068 fix) |
| `destinos/[...path]` | Yes (T-068 fix) |
| `gastronomia/[slug]` | Yes |
| `experiencias/[slug]` | Yes |
| Legal pages (`legal/*`) | Not required: legal layout renders breadcrumbs but they are a 2-level Home → Title trail; accepted gap (could be added in v1.1) |
| Listing pages (`alojamientos/`, `eventos/`, `publicaciones/`, `destinos/`, `gastronomia/`, `experiencias/`) | Not implemented (1-level trail, low value) |

The visible `<Breadcrumbs />` component does NOT emit JSON-LD by
itself — it is intentionally separated from `BreadcrumbJsonLd` so
pages can decide whether the trail warrants structured data and to
let pages compose the absolute URLs (which Breadcrumbs cannot do
cheaply because it only sees relative `path` strings). All 6 detail
pages render `<Breadcrumbs />` and therefore emit `<BreadcrumbJsonLd />`
explicitly via the `head-extra` slot.

### FAQPage

| Page | FAQPage emitted? |
|------|-------------------|
| `legal/cookies` | Yes |
| `legal/privacidad` | Yes |
| `legal/terminos` | Yes |
| `alojamientos/[slug]` (when accommodation has FAQs) | Yes (T-067 fix) |
| `destinos/[...path]` (when destination has FAQs) | Yes (SPEC-158) |

### AboutPage

| Page | AboutPage emitted? |
|------|---------------------|
| `nosotros` | Yes |
| `beneficios` | Yes |

### Offer (PriceSpecification)

| Page | Offer emitted? |
|------|----------------|
| `suscriptores/turistas` | Yes (one Offer per tourist plan) |
| `suscriptores/planes` | Yes (one Offer per owner plan) |

## History

### Gaps fixed in T-067 (SPEC-096)

1. Accommodation detail: `BreadcrumbList` was missing despite the
   page rendering `<Breadcrumbs />`. Added.
2. Accommodation detail: `FAQPage` was missing despite the page
   rendering `<FaqAccordion />`. Now emitted when `faqs.length > 0`.
3. Event detail: `eventStatus` was hard-coded to `EventScheduled` for
   non-cancelled events. Added explicit handling for the
   `isRescheduled` flag → `EventRescheduled`. Postponed/MovedOnline
   are out of scope for v1 (no flags upstream).
4. Post detail: missing `publisher` Organization (Google requires it
   for `BlogPosting` rich results). Added.
5. Post detail, event detail, destination detail: all missing
   `BreadcrumbList`. Added.
6. Destination detail: missing optional `geo` coordinates. Added
   conditional emission when `dest.location.{lat,lng}` are present.

### SPEC-157 REQ-7: typed-component migration

The gaps above were originally fixed by assembling the JSON-LD object
**inline** on each detail page (calling `JsonLd.astro` directly with an
ad-hoc schema object). SPEC-157 REQ-7 replaced that pattern: every
detail page now imports a typed `*JsonLd.astro` component per entity
and mounts it via `head-extra`, so the schema.org shape lives in one
place per entity (testable in isolation) instead of being duplicated
inline on the page. This audit doc had not been updated to reflect that
migration until HOS-117 T-013 — until then it still described the
retired inline pattern as current.

### HOS-117 T-007: coverage guard extended to 6 entities

`json-ld-coverage.test.ts` originally enumerated only 4 detail entities
(accommodation, event, destination, post). T-007 extended `DETAIL_PAGES`
to all 6 (adding gastronomy → `RestaurantJsonLd` and experience →
`TouristAttractionJsonLd`), closing a real regression gap: the two newer
verticals could have dropped their typed component or `BreadcrumbJsonLd`
with no CI signal.

## Validation strategy

This codebase cannot reach Google Rich Results Test from CI — the
test requires a publicly deployable URL. We rely on three layers:

1. Unit tests on `src/components/seo/*.astro` source asserting on the
   schema.org shape (`@type`, required fields, conditional emission).
   Located at `apps/web/test/components/seo/*.test.ts`.
2. An integration test
   (`apps/web/test/integration/json-ld-coverage.test.ts`) that is the
   **enforced CI contract**: it reads every `[lang]/{detail-page}.astro`
   and asserts each of the 6 detail pages imports its typed JSON-LD
   component and `BreadcrumbJsonLd`, and mounts both via the
   `head-extra` slot. This is what prevents a regression like a new
   vertical shipping without structured data, or an existing one losing
   it silently during a refactor.
3. A manual run of the Google Rich Results Test on one
   representative page per `@type` before declaring a related spec done.
   Procedure documented in `apps/web/docs/quality/lighthouse-audit.md`
   (same playbook covers Lighthouse + Rich Results manual runs).

## Re-audit checklist

When a new entity / page is added, this audit must be updated. The
checklist:

- [ ] Identify the schema.org `@type` that best fits the entity.
- [ ] List the required fields per Google Rich Results Test docs.
- [ ] Map each required field to an actual data source, in a typed
      `*JsonLd.astro` component (not an inline object on the page).
- [ ] Add the page family to the BreadcrumbList table above and emit
      `BreadcrumbJsonLd` if the page renders `<Breadcrumbs />`.
- [ ] Extend `apps/web/test/integration/json-ld-coverage.test.ts`'s
      `DETAIL_PAGES` array beyond the current 6 entities to cover the
      new one.
- [ ] Run the Rich Results Test manually on a deployed preview URL
      and capture the screenshot in `apps/web/docs/seo/`.
