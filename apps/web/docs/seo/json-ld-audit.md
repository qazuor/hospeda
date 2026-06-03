# JSON-LD Structural Audit

> Tracks SPEC-096 / REQ-096-37 (T-066, T-067, T-068).

This document records the structural audit of every JSON-LD generator
emitted by the public-facing web app, the gaps found, and the fixes
applied.

Last audited: 2026-04-29 (SPEC-096 close-out).

## How JSON-LD is wired

All structured data passes through `src/components/seo/JsonLd.astro`
(generic wrapper that escapes `<`, `>`, `&` to prevent injection inside
`<script type="application/ld+json">`). Each layout (`DetailLayout`,
`MarketingLayout`, `LegalLayout`, `DefaultLayout`) exposes a named slot
`head-extra` that pages use to mount entity-specific JSON-LD blocks.

| Component | File | Schema.org `@type` | Used by |
|-----------|------|---------------------|---------|
| `LodgingBusinessJsonLd` | `src/components/seo/LodgingBusinessJsonLd.astro` | `LodgingBusiness` and subtypes (`Hotel`, `Hostel`, `Motel`, `Resort`, `Campground`) | Currently inline JSON-LD on `alojamientos/[slug].astro` (uses `JsonLd` directly with `TYPE_MAP` mapping) |
| `EventJsonLd` | `src/components/seo/EventJsonLd.astro` | `Event` | Inline on `eventos/[slug].astro` |
| `PlaceJsonLd` | `src/components/seo/PlaceJsonLd.astro` | `TouristDestination` | Inline on `destinos/[...path].astro` |
| `ArticleJsonLd` | `src/components/seo/ArticleJsonLd.astro` | `Article` | Inline on `publicaciones/[slug].astro` (uses `BlogPosting`) |
| `BreadcrumbJsonLd` | `src/components/seo/BreadcrumbJsonLd.astro` | `BreadcrumbList` | All four detail pages |
| `FAQPageJsonLd` | `src/components/seo/FAQPageJsonLd.astro` | `FAQPage` | Legal pages (privacidad, terminos, cookies) and accommodation detail when FAQs exist |
| `AboutPageJsonLd` | `src/components/seo/AboutPageJsonLd.astro` | `AboutPage` | `nosotros`, `beneficios` |
| `PriceSpecificationJsonLd` | `src/components/seo/PriceSpecificationJsonLd.astro` | `Offer` + `UnitPriceSpecification` | `suscriptores/turistas`, `suscriptores/planes` |

Note: detail pages assemble the structured-data object inline rather
than calling the entity component because the inline shape carries
extra fields (geo, aggregateRating, eventStatus mapping, FAQ join,
publisher) that are not part of the component's narrow Props
contract. The entity components remain as a curated "minimum viable"
contract that can be reused on lower-detail surfaces (cards, sitemaps,
embeds) and to seed the test suite.

## Required-field audit per @type

### LodgingBusiness (and subtypes)

Reference: schema.org/LodgingBusiness. Google Rich Results requires
`name`, `address`, `image`, `priceRange` (optional but recommended),
`starRating` (optional).

Page: `src/pages/[lang]/alojamientos/[slug].astro`.

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

| Field | Source | Status |
|-------|--------|--------|
| `headline` | `post.title` | OK |
| `description` | `post.summary \|\| post.excerpt` | OK |
| `image` | `post.featuredImage` (placeholder if missing) | OK |
| `datePublished` | `post.publishedAt \|\| post.createdAt` | OK |
| `dateModified` | conditional | OK |
| `author` (Person) | conditional from `author.displayName \|\| author.name` | OK |
| `publisher` (Organization) | hard-coded Hospeda Organization | OK (added in T-067) |
| `url` | absolute | OK |

### TouristDestination

Reference: schema.org/TouristDestination. Required: `name`,
`description`, `image`, `geo` (recommended).

Page: `src/pages/[lang]/destinos/[...path].astro`.

| Field | Source | Status |
|-------|--------|--------|
| `name` | `dest.name` | OK |
| `description` | `dest.summary \|\| dest.description` | OK |
| `image` | `dest.featuredImage` | OK |
| `geo` (GeoCoordinates) | conditional from `dest.location.{lat,lng}` | OK (added in T-067) |
| `url` | absolute | OK |

### BreadcrumbList

Reference: schema.org/BreadcrumbList. Required: `itemListElement[]`
(each `ListItem` with `position`, `name`, `item`).

| Page family | BreadcrumbList emitted? |
|-------------|------------------------|
| `alojamientos/[slug]` | Yes (T-068 fix) |
| `eventos/[slug]` | Yes (T-068 fix) |
| `publicaciones/[slug]` | Yes (T-068 fix) |
| `destinos/[...path]` | Yes (T-068 fix) |
| Legal pages (`legal/*`) | Not required: legal layout renders breadcrumbs but they are a 2-level Home → Title trail; accepted gap (could be added in v1.1) |
| Listing pages (`alojamientos/`, `eventos/`, `publicaciones/`, `destinos/`) | Not implemented (1-level trail, low value) |

The visible `<Breadcrumbs />` component does NOT emit JSON-LD by
itself — it is intentionally separated from `BreadcrumbJsonLd` so
pages can decide whether the trail warrants structured data and to
let pages compose the absolute URLs (which Breadcrumbs cannot do
cheaply because it only sees relative `path` strings). Pages that
render `<Breadcrumbs />` therefore emit `<BreadcrumbJsonLd />`
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

## Gaps fixed in T-067

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

## Validation strategy

This codebase cannot reach Google Rich Results Test from CI — the
test requires a publicly deployable URL. We rely on three layers:

1. Unit tests on `src/components/seo/*.astro` source asserting on the
   schema.org shape (`@type`, required fields, conditional emission).
   Located at `apps/web/test/components/seo/*.test.ts`.
2. An integration test
   (`apps/web/test/integration/json-ld-coverage.test.ts`) that
   reads every `[lang]/{detail-page}.astro` and asserts each
   page imports the expected JSON-LD generators and emits them via
   the `head-extra` slot.
3. A manual run of the Google Rich Results Test on one
   representative page per `@type` before declaring the spec done.
   Procedure documented in `apps/web/docs/quality/lighthouse-audit.md`
   (same playbook covers Lighthouse + Rich Results manual runs).

## Re-audit checklist

When a new entity / page is added, this audit must be updated. The
checklist:

- [ ] Identify the schema.org `@type` that best fits the entity.
- [ ] List the required fields per Google Rich Results Test docs.
- [ ] Map each required field to an actual data source.
- [ ] Add the page family to the BreadcrumbList table above and emit
      `BreadcrumbJsonLd` if the page renders `<Breadcrumbs />`.
- [ ] Extend `apps/web/test/integration/json-ld-coverage.test.ts`
      with the new page family.
- [ ] Run the Rich Results Test manually on a deployed preview URL
      and capture the screenshot in `apps/web/docs/seo/`.
