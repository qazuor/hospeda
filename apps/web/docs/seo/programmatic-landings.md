# Programmatic landings — prose review & geo×type decision

> Tracks HOS-117 Wave 2 (T-012). Companion to the CWV/rendering analysis in
> `rendering-strategy.md`.

Reviews the existing programmatic accommodation landings for unique prose and
records the go/no-go on adding a geo×type landing dimension. Analysis artifact —
the actual prose authoring depends on real host content (deferred until the
example/seed data is purged from prod).

Last reviewed: 2026-07-10.

## Current state of the landings

| Landing | Route | Indexed? | Unique SEO meta | Body prose |
|---|---|---|---|---|
| By type | `/alojamientos/tipo/[type]/` | **Yes** (13 types in sitemap) | **Yes** — per-type `pageTitle` + `description` (i18n `accommodations.byType.types.{ENUM}.*`), `CollectionPage`+`ItemList`+`Breadcrumb` JSON-LD | **No** — header is `tagline` + type name, then the filtered card grid |
| By amenity | `/alojamientos/comodidades/[slug]/` | **No** (`noindex={true}`, absent from sitemap) | No (title is `{amenity} - Alojamientos`) | No |
| By feature | `/alojamientos/caracteristicas/[slug]/` | **No** (`noindex={true}`, absent from sitemap) | No | No |
| Geo × entity | `/destinos/[slug]/alojamientos/` | Yes | Destination-scoped | (destination detail prose) |

**Key finding:** the only indexed programmatic landings are the **13 by-type
pages** (× 3 locales). They carry a unique per-type `<title>` and meta
description, but their **visible body is structurally identical** across types
(a filtered card grid, no editorial paragraph). The amenity/feature landings are
deliberately `noindex`, so they carry no duplicate-content risk today.

## Unique-prose requirement (deferred to real content)

The by-type landings should each get a **unique intro paragraph** so the indexed
body differs by more than the result set and the title tag:

- Add an i18n key `accommodations.byType.types.{ENUM}.intro` (one short,
  genuinely descriptive paragraph per type, per locale — not lorem, not a
  templated mad-lib).
- Render it in the page body (e.g. directly under `ListingPageHeader` in
  `alojamientos/tipo/[type]/index.astro`). ~1 render line + 13 strings × 3
  locales.

Authoring is **deferred**: prod is currently 100% demo/seed content (purge
pending), so there is no real inventory to describe truthfully yet. The
*requirement* is recorded here as infra; the *prose* lands with real content.

The amenity/feature landings do **not** need prose while they are `noindex`. If
either is ever promoted to indexable, it must get the same unique-intro
treatment first — do not index a filtered list with no unique body.

## geo×type landing dimension — decision: **NO-GO (deferred)**

A geo×type dimension (e.g. `/destino/{city}/cabañas/` — city × accommodation
type) is **not** worth adding now.

Rationale:

1. **Duplicate-content multiplier.** geo×type ≈ 81 city destinations × 13 types
   ≈ 1000+ new indexed pages. The single by-type dimension does not yet have
   unique body prose; multiplying it by geography without prose produces ~1000
   thin, near-duplicate pages — an SEO liability, not an asset.
2. **No content to justify it.** With prod 100% demo (purge pending), most
   geo×type combinations would be empty or thin — the same thin-content problem
   Wave 0 already had to `noindex` for plain destinations.
3. **The geo browse intent is already served.** `/destinos/[slug]/alojamientos/`
   (city × all accommodations) already exists; users narrow by type via the
   in-page filters. The incremental long-tail value of a dedicated crawlable
   geo×type URL is unproven.

Revisit **only when all** of the following hold:

- Real host content exists post-purge (enough inventory per city×type to make
  the pages non-thin).
- The single-dimension by-type landings already carry unique intro prose.
- There is measured search demand for `"{type} en {city}"` long-tail queries
  (via Google Search Console, once connected).
- A per-combination unique-prose plan exists (not just a filtered list) — the
  same anti-duplicate bar applied to the single-dimension landings.

Until then, keep the by-type landings as the indexed programmatic surface, add
their intro prose when real content arrives, and leave amenity/feature landings
`noindex`.
