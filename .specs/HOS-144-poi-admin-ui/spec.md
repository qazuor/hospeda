---
title: Point of Interest (POI) Admin Management UI
linear: HOS-144
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - admin
---

# Point of Interest (POI) Admin Management UI

## 1. Summary

Add a `points-of-interest` management feature to the TanStack Start admin
dashboard, mirroring the existing `attractions` feature's file layout
(config/columns/consolidated sections/hooks + thin route files). The POI
edit form uses `I18nTextField` for the v2 model's `nameI18n`/`descriptionI18n`
fields (with an AI "Translate now" action, contingent on a small backend
widening this spec also lands), the existing `CoordinatesField` Leaflet
map-picker (unmodified, reused) for `lat`/`long`, and a `hasOwnPage` toggle.
Category assignment (with a primary-category marker) and destination
assignment (with the PRIMARY/NEARBY `relation` marker) are each their own
management **tab** on the POI's view page — not fields bundled into the main
form — following the exact precedent already established by the
Destinations/Accommodations "FAQs" sub-tab (`FaqManager`). This spec consumes
HOS-143's admin API end to end; it adds zero new API endpoints.

## 2. Problem

- POIs have no admin UI at all today. HOS-113 explicitly deferred this
  (NG-5/OQ-6: "Admin CRUD UI for POIs in Phase 1... an admin management
  surface is a deferred follow-up"). Every other editorial catalog in the
  platform (attractions, amenities, features, event locations/organizers) has
  a full admin feature; POI does not, even though it is about to receive a
  914-row production catalog (per the HOS-113 follow-up plan) that will need
  routine correction (bad geocodes, category re-tagging, curation
  verification, `hasOwnPage` flips for a handful of featured landmarks).
- HOS-143 (API) ships the admin CRUD + relation-management + category-
  management endpoints this UI needs, but an API with no UI is unusable for
  the non-technical/semi-technical operators who curate content today through
  the admin panel, not `curl`.

## 3. Goals

- **G-1** LIST page (`index.tsx`) — `DataTable` with POI-specific columns
  (resolved display name, slug, type, `hasOwnPage`, `isFeatured`,
  `displayWeight`, lifecycle state, row actions), mirroring
  `attractions.columns.ts`.
- **G-2** CREATE page (`new.tsx`) — `EntityCreateContent` with
  `afterCreateRedirectMode: 'edit'` (create the minimal record, then land on
  the edit page where categories/destinations become available — see §6.2 for
  why creation cannot include those two in the same request).
- **G-3** EDIT page (`$id_.edit.tsx`) — `EntityPageBase` in edit mode +
  consolidated sections: Basic Info (incl. `I18nTextField` for
  `nameI18n`/`descriptionI18n`), Location (coordinates + address + keywords),
  Curation (verified/source/notes), States & Moderation (lifecycle,
  isFeatured/isBuiltin, `hasOwnPage`).
- **G-4** VIEW page (`$id.tsx`) — `EntityPageBase` view mode with 3 tabs:
  Overview, Categories, Destinations.
- **G-5** `PoiCategoryManager` component (new) — the Categories tab: a chip
  multi-select over the `poi_categories` catalog + a primary-category picker,
  persisted via HOS-143's `PUT /{id}/categories`.
- **G-6** `PoiDestinationRelationManager` component (new) — the Destinations
  tab: a list of the POI's current destination relations, each showing its
  PRIMARY/NEARBY `relation` badge with an inline changer and a remove action,
  plus an "add destination" combobox + relation selector, persisted per-action
  via HOS-143's destination-relation endpoints (mirrors `FaqManager`'s
  granular per-row CRUD, not a bulk form save).
- **G-7** AI auto-translate wiring: widen `TranslationSection`'s `entityType`
  union and `TRANSLATABLE_FIELDS` map (both in
  `apps/admin/src/features/content/components/TranslationSection.tsx`) to
  include `'pointOfInterest': ['name', 'description']`, and mount
  `<TranslationSection entityType="pointOfInterest" .../>` on the edit page,
  exactly like the accommodations/destinations/events/posts edit pages
  already do. Depends on HOS-143 G-6 (the backend `TranslatableEntityType`
  widening) — see §11 OQ-1.
- **G-8** Navigation registration: sidebar link
  (`apps/admin/src/config/ia/sidebars.ts`) + create-action entry
  (`apps/admin/src/config/ia/create-actions.ts`), mirroring the
  `destination-attractions` entries exactly.
- **G-9** Component tests for `PoiCategoryManager` and
  `PoiDestinationRelationManager` (the two genuinely new pieces of UI logic);
  a documented manual verification checklist for the parts that cannot be
  meaningfully unit-tested (Leaflet map interaction, end-to-end AI translate
  round trip).

## 4. Non-goals

- **NG-1** No new API endpoints or schema changes — this spec is a pure
  consumer of HOS-143. If an endpoint this design assumes doesn't exist or
  has a different shape, that is a HOS-143 gap to fix there, not a reason to
  add ad-hoc admin-side API calls.
- **NG-2** No bulk/CSV import UI for the 914-POI catalog — that is the HOS-113
  follow-up plan's "[E] Import/seed" item, a data-migration concern, not an
  admin-UI concern.
- **NG-3** No public-facing (web app) POI page changes. Out of scope — see the
  HOS-113 plan's Phase 2 consumption issues (H-K).
- **NG-4** No multi-marker map showing every POI of a destination at once.
  `CoordinatesField` (reused as-is) is single-marker per-POI, exactly like the
  destination detail page's own multi-marker limitation (HOS-113 NG-3). Out of
  scope here.
- **NG-5** No change to `type`'s (transitional/deprecated) semantics or to any
  category→`type` derivation logic. The form keeps `type` as a plain required
  select field, unchanged from how `attractions`' equivalent field works
  today.
- **NG-6** No new generic form-system primitives beyond the two small,
  scoped additions in §6.5/§6.6 (a "one keyword per line" textarea
  convention and, if the tab pattern needs it, a `PointOfInterestSubTabLayout`
  wrapper). This spec does not build a generic multi-entity relation-manager
  framework — see §6.4 Alternatives.

## 5. Current baseline

Verified against the codebase 2026-07-11:

- **Reference feature**: `apps/admin/src/features/attractions/` — `config/
  attractions.config.ts`, `config/attractions.columns.ts`
  (`apps/admin/src/features/attractions/config/attractions.columns.ts:1-165`),
  `config/attraction-consolidated.config.ts` (composes
  `createBasicInfoConsolidatedSection` + `createStatesModerationConsolidatedSection`,
  `apps/admin/src/features/attractions/config/attraction-consolidated.config.ts:14-29`),
  `config/sections/basic-info.consolidated.ts` (plain `FieldTypeEnum.TEXT`/
  `TEXTAREA`/`NUMBER`/`SWITCH` fields, permission-gated per field,
  `apps/admin/src/features/attractions/config/sections/basic-info.consolidated.ts:8-135`),
  `hooks/useAttractionQuery.ts`, `hooks/useAttractionPage.ts`,
  `schemas/attractions.schemas.ts`. Route files:
  `apps/admin/src/routes/_authed/content/destination-attractions/{index,new,$id,$id_.edit}.tsx`.
  This is the structural template for the new `points-of-interest` feature and
  its route files (§6.1/§6.2).
- **`I18nTextField`**
  (`apps/admin/src/components/entity-form/fields/I18nTextField.tsx:65-229`)
  already renders one input/textarea per locale (es/en/pt) with per-locale
  char counters and error slots; wired into `EntityFormSection.tsx` via the
  `FieldTypeEnum.I18N_TEXT` / `I18N_TEXTAREA` cases
  (`apps/admin/src/components/entity-form/EntityFormSection.tsx:525-577`).
  **It does NOT itself contain any AI-translate button or logic** — that is a
  separate concern (next bullet). Reused as-is for `nameI18n`
  (`I18N_TEXT`) and `descriptionI18n` (`I18N_TEXTAREA`).
- **AI auto-translate is a SEPARATE component, not part of `I18nTextField`.**
  `TranslationSection`
  (`apps/admin/src/features/content/components/TranslationSection.tsx:25-172`)
  is mounted independently on the accommodations/destinations/events/posts
  edit pages (confirmed via
  `apps/admin/src/routes/_authed/{accommodations,destinations,events,posts}/$id_.edit.tsx`,
  all four import `TranslationSection`). Its `entityType` prop type
  (line 26) and internal `TRANSLATABLE_FIELDS` map (lines 35-40) are a
  **closed union of exactly those four entity types today — `pointOfInterest`
  is not among them.** This directly contradicts an assumption that AI
  auto-translate is "already wired for free" once `I18nTextField` is used —
  it is NOT; §6.7/G-7 makes the widening an explicit deliverable, gated on
  HOS-143 G-6 shipping the matching backend support (`ai-translate.service.ts`'s
  `TranslatableEntityType`, currently the identical closed 4-type union,
  `apps/api/src/services/ai-translate.service.ts:30`).
- **`CoordinatesField`**
  (`apps/admin/src/components/entity-form/fields/CoordinatesField.tsx:149-679`)
  is a fully-built Leaflet map-picker: draggable marker, forward/reverse
  Nominatim geocoding (optional, wired via `typeConfig.addressFields`), manual
  lat/long inputs as fallback, SSR-safe lazy-loaded map view
  (`CoordinatesMapView`, loaded via `createClientOnlyFn` + `React.lazy` per
  the HOS-33 TanStack Start pattern). Value shape is `{ lat: string, long:
  string }` (strings, matching the JSONB-column convention `accommodations`/
  `destinations` use) — **POI's v2 columns are plain numeric
  `doublePrecision`** (`packages/db/src/schemas/destination/point-of-interest.dbschema.ts:31-32`),
  so the form-value-to-API-payload boundary must coerce string↔number (§6.3),
  same as it would for any other `NUMBER`-typed field submitted as a string
  from an HTML input.
- **No existing "chip multi-select with a primary marker" pattern.**
  `AmenitySelectField`
  (`apps/admin/src/components/entity-form/fields/entity-selects/AmenitySelectField.tsx:47-89`)
  and its `FeatureSelectField` sibling are the closest precedent — both wrap
  `EntitySelectField` in `multiple: true` + `searchMode: 'client'` mode,
  returning a flat `string[]` of ids with chip labels resolved via
  `resolveI18nText()` (`apps/admin/src/utils/i18n-text.ts`). Neither supports
  marking one selected item as "primary" — that affordance is new UI work for
  `PoiCategoryManager` (§6.4).
- **No existing M2M relation-MANAGEMENT UI anywhere in the admin panel today**
  (only read-only display exists). Concretely: destinations already have an
  `attractions` tab
  (`apps/admin/src/routes/_authed/destinations/$id_.attractions.tsx:17-97`)
  that lists `destination.attractions` — but it is **purely read-only**: no
  mutation hook, no add/remove/edit control, just a rendered list. The
  **FAQs** sub-tab is the one true precedent for a MUTABLE per-item-CRUD
  relation manager:
  `apps/admin/CLAUDE.md` § FAQ Management, backed by
  `components/faqs/FaqManager.tsx` + `SortableFaqRow.tsx`, consumed from
  `apps/admin/src/routes/_authed/destinations/$id_.faqs.tsx:17-42` via
  `<FaqManager entityType="destinations" parentId={id} />` — "each row saves
  on its own (PUT), deletes on its own (DELETE)... there is no bulk
  form-array save." `PoiDestinationRelationManager` (§6.4) follows this exact
  pattern, not the read-only attractions-tab pattern.
- **Per-entity `SubTabLayout` convention**: both `DestinationSubTabLayout`
  (`apps/admin/src/features/destinations/components/DestinationSubTabLayout.tsx`)
  and `AccommodationSubTabLayout`
  (`apps/admin/src/features/accommodations/components/AccommodationSubTabLayout.tsx`)
  are entity-specific wrapper components (breadcrumb + tab nav), NOT a shared
  generic component — there is no `EntitySubTabLayout` to reuse. POI needs its
  own `PointOfInterestSubTabLayout` (§6.1), following the same per-entity
  convention rather than introducing a first generic abstraction (§6.6
  Alternatives — same reasoning HOS-143 §6.1 used for NOT introducing a
  generic route-factory).
- **`EntityCreateContent`'s `afterCreateRedirectMode`**
  (`apps/admin/src/components/entity-pages/EntityCreateContent.tsx:63,100,194,203,362`)
  already supports a documented "create mínimo → edit" flow: `'view'`
  (default) navigates to `${basePath}/${id}`, `'edit'` navigates to
  `${basePath}/${id}/edit`. This is the exact mechanism POI's create flow
  needs (§6.2) — no new plumbing required.
- **Sidebar / create-action registration precedent**:
  `apps/admin/src/config/ia/sidebars.ts:161-169` (the `atracciones` link entry,
  `route: '/content/destination-attractions'`, `permissions:
  ['ATTRACTION_VIEW']`) and `apps/admin/src/config/ia/create-actions.ts:63-70`
  (the `newAttraction` entry) are the structural templates for §6.8's new
  entries.
- **Field-type catalog** (`apps/admin/src/components/entity-form/enums/form-config.enums.ts:20-63`):
  no field type exists today for a free-form string-array chip input (needed
  for POI's `keywords: text[]`, HOS-138). `SELECT_MULTIPLE`/
  `ENTITY_MULTISELECT`/`TAG_SELECT` are all catalog-backed (options come from
  a fixed list or another entity's rows), not free-text. See §6.5.

## 6. Proposed design

### 6.1 Feature directory + route files

```
apps/admin/src/features/points-of-interest/
  config/
    points-of-interest.config.ts          # apiEndpoint, basePath, entity metadata
    points-of-interest.columns.ts         # DataTable columns (§6.7)
    poi-consolidated.config.ts            # composes the 4 sections below
    sections/
      basic-info.consolidated.ts          # slug, nameI18n, descriptionI18n, type, icon
      location.consolidated.ts            # address, keywords, CoordinatesField
      curation.consolidated.ts            # verified, verifiedAt, source, notes
      states-moderation.consolidated.ts   # lifecycleState, isFeatured, isBuiltin, hasOwnPage, displayWeight
      index.ts
    index.ts
  hooks/
    usePointOfInterestQuery.ts            # createEntityHooks-based CRUD hooks
    usePointOfInterestPage.ts             # page-level orchestration (mirrors useAttractionPage)
    index.ts
  schemas/
    points-of-interest.schemas.ts         # admin-panel-local Zod re-exports/aliases
  components/
    PoiCategoryManager.tsx                # §6.4
    PoiDestinationRelationManager.tsx      # §6.4
    PointOfInterestSubTabLayout.tsx        # §6.6

apps/admin/src/routes/_authed/content/points-of-interest/
  index.tsx           # LIST
  new.tsx             # CREATE
  $id.tsx             # VIEW (Overview tab, default)
  $id_.categories.tsx     # VIEW — Categories tab
  $id_.destinations.tsx   # VIEW — Destinations tab
  $id_.edit.tsx       # EDIT
```

Route naming, tab-sibling convention (`$id_.categories.tsx` /
`$id_.destinations.tsx`), and the LIST/VIEW/EDIT/CREATE 4-page pattern all
follow `apps/admin/CLAUDE.md`'s documented File-Based Routing rules verbatim
— no deviation.

### 6.2 Create → Edit flow (why categories/destinations can't be set at
creation time)

HOS-143's category (`PUT /{id}/categories`) and destination-relation
(`POST /{id}/destinations`) endpoints both require an existing
`pointOfInterestId` in the URL — there is no "create with categories" combined
endpoint (and adding one would duplicate validation logic across two request
shapes for a one-time convenience). `new.tsx` therefore configures
`EntityCreateConfig.afterCreateRedirectMode: 'edit'` (§5), so the operator
flow is: fill in the CRUD-schema fields (slug, name/description, type, coords,
etc.) → Create → land on `$id_.edit.tsx` → optionally also visit the
Categories/Destinations tabs from there (or from the VIEW page reached via
"Save and view"). This mirrors the documented "create mínimo → edit" pattern
already used elsewhere in the codebase (§5) rather than inventing a
two-request atomic-create flow.

**Alternatives considered**: (a) `afterCreateRedirectMode: 'edit'` (chosen);
(b) a bespoke multi-step create wizard collecting categories/destinations
before the POI even exists, submitted as 3 sequential requests
(create → set-categories → add-destinations) orchestrated client-side.
Rejected (b): it requires bespoke rollback handling (what happens if step 2
fails after step 1 succeeded — the POI now exists half-configured either
way, so the atomicity (b) promises is illusory), and no other entity in the
codebase does this — (a) is simpler, already built, and leaves the operator
in exactly the same end state (a POI that may still need its
categories/destinations filled in) with far less code.

### 6.3 Basic Info + Location sections

Basic Info (mirrors `attractions`' `basic-info.consolidated.ts` structure,
§5), fields:

| Field id | Type | Notes |
| --- | --- | --- |
| `slug` | `TEXT` | pattern `^[a-z0-9]+(?:[-_][a-z0-9]+)*$`, same regex as the Zod schema |
| `nameI18n` | `I18N_TEXT` | required; `typeConfig.maxLength` per the v2 schema's cap |
| `descriptionI18n` | `I18N_TEXTAREA` | optional (nullish per the current schema shape) |
| `type` | `SELECT` | options from `PointOfInterestTypeEnum`; label/description notes it is a legacy/transitional field (NG-5) |
| `icon` | `TEXT` | unchanged from today |

Location section (new):

| Field id | Type | Notes |
| --- | --- | --- |
| `address` | `TEXT` | HOS-138 field, optional |
| `keywords` | `TEXTAREA` | see §6.5 — "one keyword per line" convention, transformed to `text[]` at submit |
| `coordinates` (maps `lat`+`long`) | `COORDINATES` | reuses `CoordinatesField` unmodified; `typeConfig.addressFields.street` wired to the `address` field above so forward-geocoding ("find on map from address") works out of the box, same wiring accommodations already use |

**Coordinate type coercion**: `CoordinatesField` produces/consumes
`{ lat: string, long: string }`; the POI API expects numeric `lat`/`long`
(§7). The page's submit-payload builder (the same seam every entity already
uses to shape its `EntityFormSection` values into the API body before
calling `createMutation`/`updateMutation`) does `Number(value.lat)` /
`Number(value.long)` — a plain, local conversion, not a form-system change.

### 6.4 Categories tab — `PoiCategoryManager`

Rendered on `$id_.categories.tsx` inside `PointOfInterestSubTabLayout`
(§6.6). Fetches the POI's current categories via HOS-143's
`GET /{id}/categories`, renders:

1. A chip multi-select over the full `poi_categories` catalog (client-side
   search mode, same shape as `AmenitySelectField`/`FeatureSelectField`,
   §5) — a new `PoiCategorySelectField` following that exact wrapper
   pattern (options loaded once via a `loadAllPoiCategories()` /
   `loadPoiCategoriesByIds()` pair mirroring
   `apps/admin/src/components/entity-form/fields/entity-selects/utils/amenity-api.utils.ts`).
2. Below the chips, a radio-button list showing ONLY the currently-selected
   category ids, letting the operator pick exactly one as primary.
3. A single "Save categories" button that calls
   `PUT /{id}/categories` with `{ categoryIds, primaryCategoryId }` — full
   replace, matching HOS-143 §6.3.2's chosen contract.

**Alternatives considered**: (a) a single custom widget combining
multi-select + primary-radio in one component (chosen, described above);
(b) two independent widgets (a multi-select for membership, then a SEPARATE
"mark primary" step reached by clicking into each chip). Chosen **(a)**: the
constraint "primary must be one of the selected" is trivially enforced by
deriving the radio list's options FROM the multi-select's current value
(the radio list literally cannot offer an option that isn't selected), which
sidesteps the client needing to replicate HOS-143 §7.3's
`primaryCategoryId ∈ categoryIds` validation separately — the UI structure
makes the invalid state unrepresentable rather than merely validated.

### 6.5 `keywords` field — "one per line" textarea vs. a new chip-input
field type

`keywords: text[]` (HOS-138) is a free-form string array — NOT
catalog-backed, so none of `SELECT_MULTIPLE`/`ENTITY_MULTISELECT`/
`TAG_SELECT` fit (§5, all three are backed by a fixed option list or another
entity's rows). Two options:

1. **Reuse `FieldTypeEnum.TEXTAREA`** with a documented "one keyword per
   line" convention; the submit-payload builder (§6.3) does
   `value.split('\n').map(s => s.trim()).filter(Boolean)`, and the initial
   form value is prepared as `poi.keywords.join('\n')`.
2. **Add a new `FieldTypeEnum.TAG_INPUT`** — a genuinely new, reusable
   chip-style free-text input widget (press Enter/comma to add a chip,
   click-x to remove), wired into `EntityFormSection.tsx` as a new case.

**Chosen: (1).** `keywords` is a secondary field — per the HOS-113 follow-up
plan it exists primarily to feed the AI-search allowlist and full-text
search, not a field operators will edit frequently or need polished
chip-editing UX for. Option (2) is a real, reusable improvement (a
`TAG_INPUT` field type would likely get reused by future free-text-array
fields elsewhere) but is core form-system surface area this spec should not
take on speculatively (YAGNI) — flagged as a candidate follow-up if keyword
editing turns out to be a frequent operator task (§11 OQ-2).

### 6.6 Destinations tab — `PoiDestinationRelationManager` +
`PointOfInterestSubTabLayout`

`PointOfInterestSubTabLayout` (new, small) mirrors
`DestinationSubTabLayout`/`AccommodationSubTabLayout` (§5): breadcrumb (POI
resolved display name via `resolveI18nText(poi.nameI18n)`) + tab nav
(Overview / Categories / Destinations / Edit). No generic
`EntitySubTabLayout` is introduced — consistent with the established
per-entity convention (§5) and with HOS-143 §6.1's parallel decision not to
introduce a generic route factory.

`PoiDestinationRelationManager`, rendered on `$id_.destinations.tsx`:

- Fetches current relations via HOS-143's `GET /{id}/destinations`
  (`{ destinationId, destinationName, destinationSlug, relation }[]`).
- Renders one row per relation: destination name (linked to
  `/destinations/{destinationId}`), a `relation` badge
  (PRIMARY = default/solid badge, NEARBY = outline badge — same
  `BadgeColor` convention `attractions.columns.ts` already uses for
  lifecycle badges, §5), an inline `<select>` to change `relation`
  (calls `PATCH /{id}/destinations/{destinationId}` on change,
  optimistic-update + rollback-on-error, same pattern
  `InlineStateSelectCell` already establishes for lifecycle-state changes),
  and a remove button (calls `DELETE /{id}/destinations/{destinationId}`,
  confirmation dialog same as `DeleteRowButton`).
- An "Add destination" row: a `DestinationSelectField`-style single-entity
  combobox (existing `DestinationSelectField.tsx`, §5's entity-selects
  directory) + a `relation` radio (PRIMARY/NEARBY, default PRIMARY) +
  an "Add" button calling `POST /{id}/destinations`.

This is a genuinely per-item-persisted manager (§5's FAQ precedent), not a
form section — there is no "Save" button for the whole tab, each action
persists immediately, exactly like `FaqManager`.

### 6.7 List page columns

`points-of-interest.columns.ts` mirrors `attractions.columns.ts` (§5)
structurally, with these deltas (since POI has no plain `name` column and
gained new v2 fields):

| Column id | Source | Notes |
| --- | --- | --- |
| `name` | `nameI18n` | `ColumnType.ENTITY` widget resolving `resolveI18nText(row.nameI18n)` for display, linking to `$id.tsx` |
| `slug` | `slug` | unchanged pattern |
| `type` | `type` | `ColumnType.STRING` (or a badge, TBD at implementation — not a functional decision) |
| `hasOwnPage` | `hasOwnPage` | `ColumnType.BOOLEAN` — new |
| `isFeatured` | `isFeatured` | unchanged pattern (no destinationCount column — see next paragraph) |
| `displayWeight` | `displayWeight` | `WeightBarCell` widget, unchanged pattern |
| `lifecycleState` | `lifecycleState` | `InlineStateSelectCell`, gated by `POINT_OF_INTEREST_LIFECYCLE_CHANGE` (existing permission) |
| `createdAt` | `createdAt` | `ColumnType.TIME_AGO` |
| `actions` | — | Edit + Delete, gated by `POINT_OF_INTEREST_DELETE`/`_UPDATE` |

**No `destinationCount` column** (unlike `attractions.columns.ts`, which has
one, §5): HOS-143's admin `list`/`getById` routes call the base
`service.adminList()`/`getById()` — the same generic, relation-less path
every other admin CRUD entity uses — NOT the POI service's bespoke
`searchForList()` method (which does compute per-item destination counts
but is a separate, non-admin-gated method). Adding a relation count to the
admin list would require either switching the admin route to
`searchForList()` (a HOS-143 API-side decision, out of scope for this UI
spec to force) or a follow-up. Flagged, not silently assumed away (§11
OQ-3).

### 6.8 AI auto-translate wiring (G-7)

Two small, mechanical changes:

1. `TranslationSection.tsx`: widen the `entityType` prop union
   (`'accommodation' | 'destination' | 'event' | 'post'` →
   `... | 'pointOfInterest'`) and add
   `pointOfInterest: ['name', 'description']` to `TRANSLATABLE_FIELDS`
   (§5). No other change needed inside the component — its logic already
   derives everything else generically from `entity[`${fieldType}I18n`]` and
   `entity.translationMeta`.
2. `$id_.edit.tsx` (POI): mount `<TranslationSection entityType="pointOfInterest"
   entityId={id} entity={poi} />`, same call shape the other four edit pages
   already use.

This can only work end-to-end once HOS-143 G-6 ships the matching backend
widening (`ai-translate.service.ts`'s `TranslatableEntityType` +
`ENTITY_FIELDS`/`I18N_COLUMN_MAP`/`getEntityTable`, and the three `z.enum`
literals in `ai/admin/translate.ts` — HOS-143 §6.5). If this UI spec is
implemented before that backend piece lands, ship it BEHIND the same PR
ordering dependency rather than merging a "Translate now" button that 404s
or 400s — see R-1.

### 6.9 Navigation registration (G-8)

`apps/admin/src/config/ia/sidebars.ts`: new link entry inside the same
"Catálogo" group as `atracciones` (§5's cited block), `route:
'/content/points-of-interest'`, `permissions: ['POINT_OF_INTEREST_VIEW']`.

`apps/admin/src/config/ia/create-actions.ts`: new `newPointOfInterest` entry
mirroring `newAttraction` (§5), `route: '/content/points-of-interest/new'`,
`permissions: ['POINT_OF_INTEREST_CREATE']`.

## 7. Data model / contracts

No new Zod schemas at the `@repo/schemas` package level — this spec is a UI
consumer of HOS-143's contracts (`PointOfInterestAdminSchema`,
`PointOfInterestAdminSearchSchema`, the destination-relation and category
schemas from HOS-143 §7.2/§7.3). Admin-panel-local additions:

- `apps/admin/src/features/points-of-interest/schemas/points-of-interest.schemas.ts`
  — thin local type aliases for whatever the `createEntityHooks` factory
  needs (mirrors `attractions.schemas.ts`'s role — no new validation logic,
  just re-exporting/narrowing `@repo/schemas` types for the admin panel's own
  hooks).
- `FieldTypeEnum` gains no new member (§6.5 deliberately avoids this) unless
  §11 OQ-2 is later resolved in favor of a real `TAG_INPUT` type.
- `EntityCreateConfig`/`EntityFormSection`/`TabsConfigInput` (all existing,
  unmodified types) are configured, not extended, for POI — except
  `TranslationSection`'s `entityType` union (§6.8), the one genuine type
  widening this spec performs.
- API endpoints consumed (all from HOS-143, none newly defined here):
  `GET/POST/PUT/PATCH/DELETE /api/v1/admin/points-of-interest[/{id}]`,
  `DELETE .../{id}/hard`, `POST .../{id}/restore`, `POST .../batch`,
  `GET/POST /api/v1/admin/points-of-interest/{id}/destinations`,
  `PATCH/DELETE .../{id}/destinations/{destinationId}`,
  `GET/PUT /api/v1/admin/points-of-interest/{id}/categories`,
  `POST /api/v1/admin/ai/translate` (widened `entityType`).

## 8. UX / UI behavior

- **Empty states**: LIST page with zero POIs shows the standard `DataTable`
  empty state (same component every other entity list uses — no custom
  copy needed beyond the entity name strings). Categories tab with zero
  categories assigned shows a one-line hint ("No categories assigned yet —
  add one below") above the chip selector, not a full-page empty state
  (it's a sub-tab, not a list page). Destinations tab likewise.
- **Loading states**: LIST/VIEW/EDIT pages use the existing skeleton/loader
  conventions from `EntityPageBase`/`DataTable` — no bespoke loading UI.
  `PoiDestinationRelationManager`'s row-level actions (relation change,
  remove) show a per-row spinner during their own mutation, exactly like
  `InlineStateSelectCell`/`DeleteRowButton` already do elsewhere — never a
  full-tab spinner for a single-row action.
- **Error states**: form validation errors surface field-by-field via
  `EntityFormSection`'s standard error-slot rendering (already built,
  unchanged). `PoiCategoryManager`'s "Save categories" button shows a toast
  on failure (network error or the 400 `primaryCategoryId` validation from
  HOS-143 §7.3) and leaves the chip selection as the operator left it (no
  silent revert) so they can retry without re-selecting everything.
  `PoiDestinationRelationManager` rolls back an optimistic relation change on
  a failed `PATCH` (toast + row reverts to its previous badge) and shows an
  inline error on a failed add/remove (mirrors `FaqManager`'s per-row error
  handling).
- **Accessibility**: `I18nTextField` inputs already carry per-locale
  `aria-invalid`/`aria-describedby` wiring (§5, unchanged). The new
  relation-manager rows use semantic `<button>`/`<select>` elements (never
  `<div onClick>`) with `aria-label`s following the same convention
  `DeleteRowButton`/`EditIcon` links already use in `attractions.columns.ts`
  (§5). The category primary-radio list uses a native `<input type="radio">`
  group with a shared `name` attribute so screen readers announce it as one
  choice group, not N independent checkboxes.
- **User flow (happy path, create)**: Sidebar → "Nuevo punto de interés" →
  fill Basic Info + Location → Create → redirected to Edit page → (optional)
  visit Categories tab → select categories + mark primary → Save categories
  → visit Destinations tab → add destination(s) with PRIMARY/NEARBY → done.
- **User flow (happy path, correcting a bad geocode)**: LIST → click a row →
  Edit → Location section → drag the map marker (or re-run forward geocode
  from `address`) → Save.

## 9. Acceptance criteria

- **AC-1** The LIST page renders all POIs (paginated) with the columns in
  §6.7, and the `name` column displays the Spanish (or first-available)
  resolved value from `nameI18n`, never a raw `[object Object]` or the slug
  as a silent fallback with no visual indication it's a fallback.
- **AC-2** Creating a POI with only the Basic Info + Location sections
  filled succeeds and redirects to `$id_.edit.tsx` for that new id
  (`afterCreateRedirectMode: 'edit'` verified by an integration/e2e-style
  component test asserting the post-create route).
- **AC-3** The Categories tab's "Save categories" button is disabled (or
  shows an inline validation message) whenever no category is selected as
  primary among the current chip selection, and is NEVER able to submit a
  `primaryCategoryId` that is not also present in `categoryIds` (structurally
  impossible per §6.4, not merely validated).
- **AC-4** Changing a destination's `relation` badge (PRIMARY ↔ NEARBY) in
  the Destinations tab persists via `PATCH` and reflects the new badge value
  after a page reload (round-trip verified, not just optimistic-UI-only).
- **AC-5** Removing a destination relation shows a confirmation step before
  the `DELETE` call fires (same UX guarantee `DeleteRowButton` gives
  elsewhere — no destructive action fires on a single unconfirmed click).
- **AC-6** The `keywords` textarea round-trips correctly: entering 3 lines
  (including one blank line and one line with leading/trailing whitespace)
  persists as an array of exactly the 2 non-empty, trimmed keyword strings
  (verifies §6.5's split/trim/filter transform).
- **AC-7** The lat/long values entered/dragged in `CoordinatesField` persist
  as numbers server-side (verified against HOS-143's numeric-column
  contract, not left as strings that would fail the API's Zod validation).
- **AC-8** With HOS-143 G-6 shipped, clicking "Translate now" in the mounted
  `TranslationSection` on the POI edit page successfully populates the
  missing EN/PT values for `nameI18n`/`descriptionI18n`. Without HOS-143 G-6
  shipped, this button must not be shown/reachable in a broken 404/400 state
  — see R-1 for the sequencing guard.
- **AC-9** The sidebar entry and create-action entry are visible only to
  actors holding `POINT_OF_INTEREST_VIEW`/`_CREATE` respectively (permission
  gating verified the same way every other sidebar/create-action entry's
  gating is already tested).
- **AC-10** `pnpm --filter admin typecheck`, `pnpm --filter admin lint`, and
  `pnpm --filter admin test` all pass; `PoiCategoryManager` and
  `PoiDestinationRelationManager` each have component tests covering: happy
  path render, the primary-must-be-selected constraint (AC-3), and at least
  one failure-path (network error) test per manager verifying the rollback/
  toast behavior in §8.

## 10. Risks

- **R-1 Cross-spec sequencing.** G-7/§6.8's AI-translate wiring is USELESS
  (and actively broken — a button that 400s/404s) unless HOS-143 G-6 ships
  first or in the same PR. Mitigation: implement §6.8 last, behind an
  explicit "is HOS-143 G-6 merged?" checkpoint in the task-planner's phasing;
  if it lands first, gate the `<TranslationSection>` mount behind a feature
  check rather than shipping a dead button (AC-8's second half).
- **R-2 `keywords` UX regression risk.** The "one keyword per line" textarea
  convention (§6.5) is a lower-fidelity UX than a proper chip input; if
  keyword editing turns out to be a frequent operator task (e.g. during the
  914-POI curation pass), this will be perceived as clunky. Mitigation: §11
  OQ-2 flags this explicitly as a candidate `TAG_INPUT` follow-up rather than
  silently accepting the limitation forever.
- **R-3 Missing `destinationCount` on the list page.** Operators skimming
  the LIST page cannot tell at a glance which POIs have zero destination
  assignments (a real curation signal — "914 imported POIs, how many still
  need a destination?") without opening each one's Destinations tab.
  Mitigation: §11 OQ-3 flags the underlying API gap (admin `list`/`getById`
  not exposing a relation count) as a HOS-143 follow-up rather than working
  around it with an admin-side N+1 fetch loop (which this spec explicitly
  does NOT do — that would be a real performance foot-gun for a 900+ row
  list).
- **R-4 Optimistic-update rollback correctness in `PoiDestinationRelationManager`.**
  A naive optimistic `relation` badge update that doesn't correctly revert
  on a failed `PATCH` would silently desync the UI from the server (operator
  believes a POI is PRIMARY for a destination when the server still has it
  as NEARBY). Mitigation: AC-4 explicitly requires a post-reload round-trip
  check, not just an optimistic-UI assertion.
- **R-5 `PointOfInterestSubTabLayout` duplication.** Following the
  established "one `SubTabLayout` per entity" convention (§6.6) means yet
  another near-identical wrapper component. Mitigation: accepted
  consciously (§6.6 Alternatives) — consistent with the codebase's existing
  convention is worth more than a premature generic abstraction; if a THIRD
  or FOURTH entity needs this exact pattern soon after POI, that is the
  right trigger to extract a shared `EntitySubTabLayout` (not this spec).

## 11. Open questions

- **OQ-1 (sequencing, needs owner/task-planner input)**: should HOS-144's
  implementation be blocked entirely on HOS-143 G-6 (AI-translate backend
  widening) merging first, or should §6.8's admin-side wiring be built and
  merged but feature-flagged off until the backend lands? Recommended:
  sequence HOS-143 fully before starting HOS-144 (the dependency already
  declared: "Depends on HOS-143"), and treat G-6 as just one more of
  HOS-143's deliverables that must be done before HOS-144 starts — avoids
  needing a feature flag at all. Flagging for confirmation since G-6 is a
  small addition that could tempt someone into deferring it past HOS-143's
  own close-out.
- **OQ-2 (deferred by design, §6.5)**: should `keywords` get a dedicated
  `FieldTypeEnum.TAG_INPUT` chip widget instead of the "one per line"
  textarea convention? Deferred — revisit if the 914-POI curation pass
  reports this as a real pain point.
- **OQ-3 (deferred by design, §6.7)**: should the admin `list`/`getById`
  routes switch from `service.adminList()`/`getById()` to the POI service's
  existing `searchForList()` (which already computes `destinationCount`) so
  the LIST page can show it? This is a HOS-143 (API) decision, not this
  spec's to make unilaterally — flagged for a HOS-143 follow-up or a
  HOS-143 spec amendment before HOS-144 implementation starts, since it
  changes what `list.ts`'s handler calls.
- **OQ-4 (genuinely open, product question)**: should `hasOwnPage` toggling
  from the admin UI trigger any immediate side effect (e.g. scheduling ISR
  revalidation for the POI's future public page, per the
  `featuredByEntitlement` precedent's revalidation-on-write pattern
  documented in this repo's root `CLAUDE.md`)? Out of scope for THIS spec
  (HOS-113's own-pages feature, item K in the follow-up plan, is not built
  yet — there is no public POI page to revalidate) — flagged so the K item's
  future spec remembers `hasOwnPage` already has an admin toggle by the time
  it needs one.

## 12. Implementation notes

- Suggested phasing (Task Master), assuming HOS-143 is fully merged first
  (§11 OQ-1):
  - **Phase 1 — Feature scaffolding**: `features/points-of-interest/config/*`
    (config, columns, consolidated sections), `hooks/*`, `schemas/*` — no
    route files yet, no manager components. Unit tests for column
    definitions and hook wiring (mirrors how `attractions` feature itself
    would be tested).
  - **Phase 2 — Core CRUD pages**: `index.tsx`, `new.tsx`, `$id_.edit.tsx`,
    `$id.tsx` (Overview tab only) + `PointOfInterestSubTabLayout`. Manual
    verification: create → edit → view round trip with Basic Info +
    Location fields, including the `CoordinatesField` numeric coercion
    (AC-7) and the `keywords` transform (AC-6).
  - **Phase 3 — Categories tab**: `PoiCategorySelectField` +
    `PoiCategoryManager` + `$id_.categories.tsx`. Component tests (AC-3,
    AC-10).
  - **Phase 4 — Destinations tab**: `PoiDestinationRelationManager` +
    `$id_.destinations.tsx`. Component tests (AC-4, AC-5, AC-10).
  - **Phase 5 — AI-translate wiring**: `TranslationSection` widening +
    edit-page mount (G-7/§6.8), gated per R-1/OQ-1.
  - **Phase 6 — Navigation + docs**: sidebar + create-action entries (§6.9);
    update `apps/admin/CLAUDE.md`'s FAQ Management-adjacent section (or add
    a new one) documenting the POI relation-manager pattern for future
    entities that need the same thing.
  - **Phase 7 — Quality gate**: `pnpm --filter admin typecheck/lint/test`
    (AC-10); manual verification checklist per the task's stated
    verification step (create/edit a POI with multilang + categories +
    coords-on-map, confirm persistence via the API — i.e. re-fetch via
    `GET /api/v1/admin/points-of-interest/{id}` directly and diff against
    what was submitted).
- Do not build a generic relation-manager component shared between
  Categories and Destinations tabs even though they look superficially
  similar (§6.4 vs §6.6) — one is a full-replace chip selector with a
  derived primary-radio, the other is a per-row-persisted CRUD list with an
  enum badge. Forcing them into one abstraction now (2 call sites) would be
  premature generalization; revisit only if a third such tab appears
  elsewhere in the codebase.

## 13. Linear

Canonical tracking:
HOS-144
