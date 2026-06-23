---
spec-id: SPEC-266
title: Amenities & features catalog by vertical (scoping + i18n source-of-truth)
type: improvement
complexity: high
status: in-progress
created: 2026-06-23T02:10:00Z
---

# SPEC-266 — Amenities & features catalog by vertical

> Redesign the shared amenities/features catalog so each commerce vertical
> (accommodation, gastronomy, experience) presents a **semantically correct** set
> of attributes, and make **i18n the single source of truth** for their display
> names. **Not yet implemented** — written so it can be planned and atomized
> later. The catalog-scoping APPROACH (Options A/B/C below) is an OPEN decision to
> resolve during planning, NOT pre-decided here. Tasks are intentionally NOT
> atomized yet.
>
> **Absorbs [BETA-90](https://linear.app/hospeda-beta/issue/BETA-90/tech-debt-eliminar-el-campo-name-de-amenitiesfeatures-y-usar-i18n-por)**
> (remove the catalog `name` column → i18n by slug). Both efforts mutate the same
> two tables (`amenities`, `features`); doing them together avoids migrating the
> same schema twice. See §6.

## 1. Overview

### Goal

The amenities/features catalog is currently **single, global, and populated only
with accommodation items**, and every vertical's editor renders the WHOLE catalog
unfiltered. A gastronomy listing (e.g. a brewery) can therefore tick
**"Ropa de cama", "Toallas", "Cuna", "Silla alta para bebé", "Pileta climatizada",
"Recepción 24 horas"** — accommodation amenities that make no sense for a
restaurant. This is a correctness bug, not just polish.

Two coupled objectives:

1. **Scope the catalog by vertical** — each vertical shows only the attributes that
   apply to it: a small shared core (WiFi, Estacionamiento, Pet-friendly,
   Accesibilidad, Aire acondicionado) plus its own domain-specific set.
2. **Make i18n the single source of truth for display names** (absorbs BETA-90) —
   drop the catalog `name` column; resolve labels from `@repo/i18n` by a stable
   identifier.

### Motivation

The current model conflates "the catalog of selectable items" with "what a given
vertical can use". The relation layer already separates verticals
(`r_gastronomy_amenity`, `r_gastronomy_feature`, the
`AccommodationAmenityRelationSchema` / `GastronomyAmenityRelationSchema` /
`ExperienceAmenityRelationSchema` schemas), but the **item catalog itself has no
notion of vertical** — only `type` and `category`, both authored for
accommodation. The web editor compounds it by fetching the raw catalog with no
filter.

Beyond filtering, each vertical has its OWN taxonomy:

- **Gastronomy**: tipo de cocina, delivery, reservas, apto celíaco/vegano, menú
  infantil, música en vivo, terraza, happy hour…
- **Experiences**: duración, dificultad, edad mínima, incluye traslado/equipo,
  idioma del guía, apto para niños…
- **Shared core (cross-vertical)**: WiFi, Estacionamiento, Pet-friendly,
  Accesibilidad, Aire acondicionado, Terraza.

So this is not only "hide the accommodation items"; it's "give each vertical its
real attribute set while reusing the genuinely shared ones".

## 2. Current state

### What exists today

| Concern | Location |
|---|---|
| Amenity catalog table | `packages/db/src/schemas/accommodation/amenity.dbschema.ts` (`name` jsonb, `slug`, `icon`, `category`, `type`; **no vertical scope field**) |
| Feature catalog table | `packages/db/src/schemas/accommodation/feature.dbschema.ts` (same shape) |
| Per-vertical relation tables | `r_gastronomy_amenity`, `r_gastronomy_feature`, accommodation/experience equivalents |
| Public catalog endpoints | `GET /api/v1/public/amenities`, `GET /api/v1/public/features` — **no `vertical` filter** |
| Commerce editor catalog fetch | `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro` → `fetch('/api/v1/public/amenities?pageSize=100')` (same endpoint as accommodation, unfiltered) |
| Accommodation editor | `apps/web/src/components/host/editor/AmenitiesSection.client.tsx` |
| Commerce editor field | `apps/web/src/components/commerce/AmenitiesFeaturesField.tsx` |
| Display-name resolution (interim) | `apps/web/src/lib/catalog-names.ts` (`translateAmenityName`, added in `feat/SPEC-249-commerce-editor-refinement`) |
| i18n names (accommodation) | `accommodations.amenityNames.<key>` in `es/en/pt`; **no `featureNames` namespace** |

### What's wrong

1. **No vertical scoping** — the catalog has no field saying "this amenity applies
   to gastronomy". Every vertical sees the full accommodation-authored list.
2. **`name` column is an overloaded hybrid** (BETA-90) — for amenities `name.es`
   is actually the i18n lookup key (`"wifi"`); for features it's human-readable
   Spanish replicated across all 3 locales. Display should come from i18n only.
3. **Slug vs key mismatch** — `slug` uses hyphens (`air-conditioning`), i18n keys
   use underscores (`air_conditioning`); the codebase currently keys i18n off
   `name.es`, not `slug`.
4. **No per-vertical taxonomies** — gastronomy/experience domain attributes don't
   exist in the catalog at all.

## 3. Scope

### In scope

- A mechanism to scope catalog items to one or more verticals (approach decided in
  planning — see §4).
- Curating the existing accommodation set (mark shared-core items as
  cross-vertical; keep the rest accommodation-only).
- Authoring gastronomy and experience attribute sets (amenities and/or features).
- Filtering the public catalog endpoints by vertical and consuming that in BOTH
  editors (accommodation + commerce).
- Absorbing BETA-90: drop `name`, resolve display from i18n by a stable key,
  including creating the missing `featureNames` namespace.

### Out of scope

- Changing the per-vertical relation tables (they already separate verticals).
- Re-modeling pricing/openingHours/media (handled elsewhere).
- Admin bulk re-categorization UX beyond what the new model needs.

## 4. Catalog-scoping approaches (DECIDE DURING PLANNING)

> **DECIDED (planning 2026-06-23): Option A + `applicableVerticals text[]`.** See §5
> for the full resolution of every open question. The options below are kept for
> historical context.

### Option A — Single catalog + multi-vertical scope (RECOMMENDED)

Add an `applicableVerticals` field to each catalog item (array, e.g.
`['accommodation','gastronomy','experience']`, or a normalized N:M
`amenity_vertical` table). Shared-core items are tagged for all 3; vertical-specific
items only for theirs. Endpoints filter `?vertical=`.

- **Pros**: single source of truth; no duplication of shared items (WiFi exists
  once); extensible; semantically correct; smallest data footprint.
- **Cons**: schema migration; one-time curation of the existing set; need to author
  per-vertical items.
- **Impact**: DB, schemas, service (filter), seed, public endpoints, web (both
  editors), admin (edit the scope field).
- **Note**: array (`text[]` / enum array) is simpler than an N:M table and enough
  for 3 values (KISS). N:M only if we foresee many verticals or per-relation
  metadata.

### Option B — Separate catalogs per vertical

Independent item sets per vertical (own tables or a hard `vertical` discriminator
column with no sharing).

- **Pros**: full isolation; each vertical curated independently.
- **Cons**: duplicates shared items across verticals (WiFi/Estacionamiento ×3);
  more tables/seed/maintenance; loses the single-catalog benefit the relation
  layer was designed around.
- **Impact**: similar surface to A but with duplicated data and more seed.

### Option C — Reuse `type`/`category` + vertical→category allow-map

No new scope field; define which existing categories apply to each vertical and
filter on that (config-driven).

- **Pros**: least invasive; no migration of a new column.
- **Cons**: current categories are accommodation-authored and don't map cleanly;
  doesn't solve per-vertical taxonomies (no place to add gastronomy/experience
  items); fragile.
- **Impact**: mostly endpoint + config + web; but likely a dead end that forces A
  later.

### Decision criteria

Pick by: (1) avoid duplicating shared items, (2) allow per-vertical taxonomies,
(3) migration cost, (4) admin authoring ergonomics. A satisfies 1–2 best; C is
cheapest but fails 2; B fails 1.

## 5. Open questions — RESOLVED (planning 2026-06-23)

1. **Approach**: **Option A** — single catalog + multi-vertical scope. Decided.
2. **Scope shape**: **`applicableVerticals text[]`** on each catalog row, NOT an N:M
   table. KISS — 3 values, no per-relation metadata.
3. **i18n identifier**: the **`slug` (snake_case) is the canonical id AND the i18n
   key**. Verified against the real seed: `slug == name.es == name.en ==
   "air_conditioning"` already — the three are identical, and `name` is the i18n key
   replicated, not a human label (the human text lives in `description`). Therefore:
   drop the `name` column, resolve display from `@repo/i18n` by slug, **relax the slug
   Zod regex to allow underscores** (`^[a-z0-9]+(?:[-_][a-z0-9]+)*$`), and create the
   missing `featureNames` namespace. Underscores chosen → **zero data migration** (slug
   already equals the key). These slugs are internal catalog ids, not public URLs.
4. **One dimension or two?**: **Keep BOTH amenities AND features per vertical.**
   CORRECTION to an earlier planning assumption: gastronomy/experience features are
   NOT dead scaffold — they are wired end-to-end and ACTIVE. `GastronomyService` /
   `ExperienceService` register `_featureJunctionModel` and sync it on every
   create/update (`syncCommerceFeatureJunction` in `BaseCommerceListingService`); the
   live `PATCH /api/v1/protected/{gastronomies,experiences}/:id` routes accept
   `featureIds`; `CommerceListingEditor.client.tsx` toggles them; gated by
   `COMMERCE_FEATURES_EDIT_OWN`; explicitly retained by SPEC-253. Dropping them would
   regress shipped product. SPEC-266 therefore **scopes both dimensions by vertical; it
   removes nothing.** Only the SEED is incomplete (gastro/experience seeds bypass the
   service and never populate the junction rows) — the runtime path is live.
   **Catalog boundary**: only BOOLEAN attributes belong in the amenity/feature catalog.
   Value-bearing attributes (experience duration / difficulty / min-age / group-size,
   gastronomy cuisine-type) are listing fields and are OUT of scope here.
5. **Seed authoring**: engineering proposes the initial boolean taxonomy (shared-core
   - per-vertical amenities & features); the product owner validates. Proposed set
   under review at planning time; once validated it is recorded in §10.
6. **Migration safety**: unchanged hard constraint — the curation/migration MUST
   preserve every existing accommodation listing's selected amenities AND features
   (no relation loss). Verified at cutover.

## 6. Relationship to BETA-90 (absorbed)

BETA-90 ("remove the `name` column → i18n by slug") mutates the SAME tables this
spec re-models. Doing them separately means migrating `amenities`/`features`
twice. This spec **absorbs** BETA-90: the scoping migration and the
`name`→i18n migration ship as one coordinated change. BETA-90 stays as the
tracking issue for the i18n half; this spec is the umbrella. The BETA-90 inventory
(DB, schemas, service search `name->>'es'`, seed JSONs, web transforms/grids,
admin form/columns/select-utils, missing `featureNames` namespace) is the
checklist for the i18n half.

Interim already shipped (does NOT block this spec): the web editors resolve
amenity labels from i18n via `apps/web/src/lib/catalog-names.ts` with a humanized
fallback, so amenities no longer render raw English keys. Features still render
their raw `name` until `featureNames` exists (this spec).

## 7. Risks

- **Data migration**: existing accommodation listings have selected amenities;
  the curation/migration must preserve those relations.
- **Cross-cutting surface**: touches DB→schemas→service→seed→API→web→admin; needs
  a coordinated migration (structural carril + possibly an extras step).
- **Product curation dependency**: the gastronomy/experience taxonomies need
  product/owner input; engineering can scaffold but not invent the final sets.
- **Search path**: the service search currently filters `name->>'es'`; removing
  `name` requires migrating search to the i18n key/slug (BETA-90 item).

## 8. Acceptance criteria (high level, refine at planning)

- A gastronomy/experience editor shows ONLY attributes relevant to that vertical
  (shared-core + its own set); no accommodation-only items leak in.
- The accommodation editor is unchanged in coverage (no regression in its set).
- Display names for amenities AND features come from `@repo/i18n` in es/en/pt; the
  catalog `name` column is gone.
- Existing accommodation listings keep all their previously selected amenities.
- Public catalog endpoints accept and honor a `vertical` filter.

## 9. Tasks

Atomized after planning (§4/§5 resolved, §10 taxonomy owner-approved, §11 phases
defined — all 2026-06-23). See `.qtm/tasks/SPEC-266-amenities-feature-catalog-by-vertical/`.

## 10. Validated taxonomy (owner-approved 2026-06-23)

> BOOLEAN catalog attributes only. Value-bearing attributes are listing fields (out of
> scope, see §5.4). Slugs are snake_case and double as the i18n key (§5.3). The
> amenity-vs-feature split follows: **amenity = something the place OFFERS/HAS**;
> **feature = a QUALITY or suitability**.

### Shared-core — `applicableVerticals = ['accommodation','gastronomy','experience']`

`wifi` · `parking` · `pet_friendly` · `wheelchair_accessible` · `air_conditioning` ·
`outdoor_seating` · `smoke_free` · `accepts_cards`

> Curation: existing accommodation catalog items are re-tagged to all 3 verticals; the
> rest stay accommodation-only. `accepts_cards` is shared (all 3 verticals bill).

### Gastronomy — `applicableVerticals = ['gastronomy']`

**Amenities (10):** `delivery` · `takeaway` · `accepts_reservations` · `live_music` ·
`happy_hour` · `bike_parking` · `kids_play_area` · `private_events` · `catering` ·
`bar_service`
**Features (9):** `gluten_free_options` · `vegan_options` · `vegetarian_options` ·
`kids_menu` · `panoramic_view` · `family_friendly` · `romantic_ambiance` ·
`organic_products` · `craft_beer`

### Experience — `applicableVerticals = ['experience']`

**Amenities (8):** `transport_included` · `equipment_included` · `food_included` ·
`guide_included` · `photos_included` · `insurance_included` · `hotel_pickup` ·
`lockers_available`
**Features (8):** `kid_friendly` · `beginner_friendly` · `english_guide_available` ·
`portuguese_guide_available` · `outdoor_activity` · `pregnancy_safe` ·
`private_available` · `senior_friendly`

### Out of catalog (listing fields, NOT this spec)

- **Gastronomy**: cuisine-type (categorical), `priceRange` (exists).
- **Experience**: duration, difficulty, min-age, max group size, exact guide language.

## 11. Implementation phases

Coordinated migration: the scoping field (§5.1/5.2) and the BETA-90 `name` drop (§5.3)
touch the SAME two tables and MUST ship as ONE structural migration — never migrate
`amenities`/`features` twice.

1. **Schema + migration** — add `applicableVerticals text[]` to `amenities` &
   `features`; drop `name`; relax slug regex to allow `_`. One Drizzle-generated
   structural migration (hand-edit the data step where needed). `@repo/db`,
   `@repo/schemas`.
2. **i18n source of truth** — resolve display by slug everywhere; create the
   `featureNames` namespace (es/en/pt); remove all `name`-based reads, including the
   service search path (`name->>'es'` → slug). `@repo/i18n`, web, admin, service-core.
3. **Seed** — re-tag shared-core accommodation items to all 3 verticals; author the
   §10 gastronomy/experience amenity & feature items with their `applicableVerticals`.
   `@repo/seed`.
4. **Vertical filter** — public catalog endpoints accept `?vertical=`; BOTH editors
   (accommodation + commerce) consume the filtered catalog. API, web.
5. **Data-migration safety** — preserve every existing accommodation listing's selected
   amenities AND features across the change (§5.6). `extras/` step if needed.
