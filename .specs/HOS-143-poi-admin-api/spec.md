---
title: Point of Interest (POI) Admin CRUD API
linear: HOS-143
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - api
---

# Point of Interest (POI) Admin CRUD API

## 1. Summary

Add a full admin CRUD tier for the `points_of_interest` entity
(`/api/v1/admin/points-of-interest`), mirroring the existing `attraction/admin`
tier exactly (list/getById/create/update/patch/delete/hardDelete/restore/batch),
plus two new relation-management surfaces: destination assignment (with the
`relation` PRIMARY/NEARBY marker from HOS-140) and category assignment (with an
`isPrimary` marker, from HOS-139). This is **purely additive**: permissions
(`POINT_OF_INTEREST_*`), the CRUD input schemas, `PointOfInterestAdminSchema`,
and a fully admin-capable `PointOfInterestService` (with `_canCreate`/
`_canUpdate`/`_canDelete`/`_canRestore`/`_canAdminList` hooks already
implemented) all shipped with HOS-113 and are unused today because POI has been
public-read-only since then (HOS-113 NG-5/OQ-6). No new DB migration, no new
Zod entity schema, no new service permission is required by this spec — only
routes, two small admin-search/relation schema files, two new service methods,
and route registration.

## 2. Problem

- POI is a seed-only, public-read-only catalog today
  (`apps/api/src/routes/point-of-interest/index.ts:1-8`: "there are deliberately
  NO protected or admin route tiers here"). The HOS-113 plan to bring in a
  914-POI production catalog (multilang name/description, address, keywords,
  40 categories, curation metadata) makes hand-editing via seed JSON/DB
  unworkable for day-to-day content operations: fixing a bad geocode, marking a
  POI `verified`, assigning categories, or flipping `hasOwnPage` all currently
  require a direct DB write or a seed-fixture PR.
- The POI v2 data model (HOS-138: `nameI18n`/`descriptionI18n`/`translationMeta`/
  `address`/`keywords`/`hasOwnPage`/curation columns), the category catalog
  (HOS-139: `poi_categories` + `r_poi_category` M2M with `isPrimary`), and the
  `relation` column on the destination join table (HOS-140: PRIMARY/NEARBY on
  `r_destination_point_of_interest`) are prerequisites this spec assumes are
  already merged — this spec adds ZERO new columns/tables of its own.
- HOS-144 (admin UI) cannot be built without these endpoints existing first —
  this spec is the hard blocker for that one.

## 3. Goals

- **G-1** Standard admin CRUD tier for POI — list, getById, create, update,
  patch, delete (soft), hardDelete, restore, batch — structurally identical to
  `attraction/admin` (same route factories, same permission-per-endpoint
  mapping, same file layout).
- **G-2** A new `PointOfInterestAdminSearchSchema`
  (`packages/schemas/src/entities/point-of-interest/point-of-interest.admin-search.schema.ts`)
  extending `AdminSearchBaseSchema` with POI-specific list filters: `type`,
  `isFeatured`, `isBuiltin`, `hasOwnPage`, `verified`, `destinationId`,
  `categoryId`.
- **G-3** Destination-relation management endpoints under
  `/api/v1/admin/points-of-interest/{id}/destinations` — list, add (with
  `relation`), update the `relation` value, and remove — built on top of the
  HOS-140 `relation` column.
- **G-4** Category-assignment management endpoints under
  `/api/v1/admin/points-of-interest/{id}/categories` — list assigned
  categories (with `isPrimary`) and a full-replace `PUT` — built on top of the
  HOS-139 `r_poi_category` join table.
- **G-5** All routes mounted at `/api/v1/admin/points-of-interest` and
  registered in `apps/api/src/routes/index.ts`, following the existing
  three-tier mounting convention.
- **G-6** Extend the generic AI-translate admin service/route
  (`apps/api/src/services/ai-translate.service.ts`,
  `apps/api/src/routes/ai/admin/translate.ts`) to recognize
  `entityType: 'pointOfInterest'` mapped to `{ name: 'nameI18n', description:
  'descriptionI18n' }` — a prerequisite for HOS-144's "Translate now" button on
  the POI edit form (see §7.5, R-6).
- **G-7** Integration tests covering full CRUD, relation management, category
  management, and permission gating (missing-permission → 403) for every new
  route.

## 4. Non-goals

- **NG-1** No new DB migration. Every table/column this spec's routes read or
  write (`points_of_interest.*` v2 columns, `poi_categories`,
  `r_poi_category`, `r_destination_point_of_interest.relation`) is assumed
  already shipped by HOS-138/139/140. If any of those land with a different
  shape than assumed here, this spec's §7 must be revisited before
  implementation starts.
- **NG-2** No changes to the public or protected POI tiers. They stay
  read-only exactly as HOS-113 left them
  (`apps/api/src/routes/point-of-interest/public/*`).
- **NG-3** No bulk import / 914-POI seed work (HOS-113 plan item "[E] Import/seed
  of the 914 POIs" — a separate issue).
- **NG-4** No admin UI. That is HOS-144, which depends on this spec.
- **NG-5** No changes to the `/api/v1/protected/ai/translate` route (used by
  hosts translating their OWN accommodation content) — only the
  **admin** translate route/service is extended (G-6). See §7.5.
- **NG-6** No change to how `type` (the transitional, soon-to-be-deprecated
  9-value enum) is computed or derived from the primary category — that
  derivation logic is HOS-139/141's concern. This spec's `update`/`patch`
  routes accept `type` as a plain field exactly like every other field, same
  as today.

## 5. Current baseline

Verified against the codebase 2026-07-11:

- **`apps/api/src/routes/point-of-interest/index.ts:1-8`** re-exports ONLY
  `publicPointOfInterestRoutes`, with an explicit comment that admin/protected
  tiers are deferred. **No `admin/` subdirectory exists yet** for this entity.
- **`apps/api/src/routes/index.ts:139,285`** — POI is mounted only at
  `/api/v1/public/points-of-interest`. There is no
  `/api/v1/admin/points-of-interest` line to mirror the existing
  `app.route('/api/v1/admin/attractions', adminAttractionRoutes)` at line 508.
- **`packages/service-core/src/services/point-of-interest/point-of-interest.service.ts`**
  is already fully admin-capable:
  - `_canCreate`/`_canUpdate`/`_canDelete`/`_canSoftDelete`/`_canHardDelete`/
    `_canRestore`/`_canView`/`_canList`/`_canSearch`/`_canCount` (lines 123-159)
    all delegate to `point-of-interest.permissions.ts` checkers.
  - `_canAdminList` (lines 170-173) is already overridden correctly (calls
    `super._canAdminList(actor)` first, then `checkCanAdminList(actor)`), so no
    permission-hook work is needed for `adminList`.
  - `addPointOfInterestToDestination(actor, { destinationId,
    pointOfInterestId })` (lines 187-251) and
    `removePointOfInterestFromDestination(...)` (lines 259-326) already exist
    and are consumed by the seed relationship step. **Neither accepts a
    `relation` param today** — HOS-140 is expected to add it to
    `PointOfInterestAddToDestinationInputSchema` and to the `create()` call
    inside `addPointOfInterestToDestination`; this spec's routes assume that
    shape exists.
  - `_canAddPointOfInterestToDestination` delegates to
    `checkCanCreatePointOfInterest` and `_canRemovePointOfInterestFromDestination`
    to `checkCanDeletePointOfInterest` (lines 160-165) — i.e. relation
    add/remove today piggybacks on the generic POI CREATE/DELETE permissions,
    NOT on the dedicated relation-management permission that already exists
    unused (see next bullet). §6.2 changes this.
  - There is no `updatePointOfInterestDestinationRelation` method and no
    category-assignment method (`setPointOfInterestCategories`,
    `getPointOfInterestCategories`) — both are new in this spec (§6.3, §6.4),
    since HOS-139 is scoped to the category catalog + join table, not to the
    POI-side service surface that consumes it.
- **`PermissionEnum.DESTINATION_POINT_OF_INTEREST_MANAGE =
  'destination.pointOfInterest.manage'`**
  (`packages/schemas/src/enums/permission.enum.ts:196`) already exists in the
  enum, with the doc comment "Allows managing destination points of interest
  (HOS-113)" — but a repo-wide grep confirms it is referenced **nowhere** in
  `service-core` or `apps/api`. It is dead code, added proactively during
  HOS-113 for exactly this follow-up. Its attraction sibling,
  `DESTINATION_ATTRACTION_MANAGE` (line 195), is equally unused — attraction
  destination-relation management has never been wired to any route or UI
  (verified: no `admin/routes/attraction/` file calls
  `addAttractionToDestination`, and no admin UI feature manages attraction↔
  destination relations at all today). See §6.2 Alternatives for why this spec
  activates the dedicated POI permission rather than copying attraction's gap.
- **`packages/schemas/src/entities/point-of-interest/`** already has the
  6-file set (`.schema`, `.crud.schema`, `.query.schema`, `.http.schema`,
  `.access.schema`, `.relations.schema` — confirmed via `index.ts`) but **no
  `.admin-search.schema.ts` and no `.batch.schema.ts`** — both exist for
  `attraction/` (`attraction.admin-search.schema.ts`,
  `attraction.batch.schema.ts`) and must be added here (§7.1, §7.4).
- **`PointOfInterestAdminSchema`**
  (`packages/schemas/src/entities/point-of-interest/point-of-interest.access.schema.ts:73`)
  is already just `PointOfInterestSchema` re-exported — i.e. it already
  exposes every field with no admin-only redaction, exactly the shape
  `attraction/admin` routes use for their `responseSchema`.
- **Reference CRUD tier**: `apps/api/src/routes/attraction/admin/*.ts`
  (`list.ts`, `getById.ts`, `create.ts`, `update.ts`, `patch.ts`, `delete.ts`,
  `hardDelete.ts`, `restore.ts`, `batch.ts`, `index.ts`) — every file in this
  spec's new `apps/api/src/routes/point-of-interest/admin/` directory is a
  structural copy with `Attraction` → `PointOfInterest` renames. Route
  factories used: `createAdminListRoute` (list) and `createAdminRoute` (all
  others), both from `apps/api/src/utils/route-factory.ts`.
- **AI-translate admin surface**
  (`apps/api/src/services/ai-translate.service.ts:30,33-38,74-88,91-113`,
  `apps/api/src/routes/ai/admin/translate.ts:34-57`): `TranslatableEntityType`
  is a closed union `'accommodation' | 'destination' | 'event' | 'post'`,
  hard-coded in three places (`ENTITY_FIELDS`, `getEntityTable`'s `tables`
  map, `I18N_COLUMN_MAP`) plus the Zod `z.enum([...])` literals in
  `translate.ts` (three separate schemas: single-entity, batch, override).
  Every one of these five spots needs the `pointOfInterest` variant added.
  **This is real, non-trivial work — not "already wired for free"** despite
  POI's v2 model conveniently matching the existing `nameI18n`/
  `descriptionI18n`/`translationMeta` column convention these helpers already
  assume (see R-6).
- **Gate matrix guard**: `apps/api/CLAUDE.md` documents that
  `docs/billing/endpoint-gate-matrix.md` is parsed by
  `apps/api/test/middlewares/endpoint-gate-matrix.guard.test.ts` on every CI
  run, and **fails CI if any new protected/admin route file has no matching
  row**. Every new route file this spec adds needs a matrix row with
  `Decision: none` (POI admin routes carry no billing entitlement gate) and a
  one-line reason (R-7).

## 6. Proposed design

### 6.1 Standard CRUD tier — structural copy of `attraction/admin`

Create `apps/api/src/routes/point-of-interest/admin/` with the same 10 files
as `attraction/admin/` (9 route files + `index.ts`), each a rename of the
attraction reference file with the service swapped to
`PointOfInterestService` and the schemas swapped to the POI equivalents:

| File | Method + path | Permission | Request | Response |
| --- | --- | --- | --- | --- |
| `list.ts` | `GET /` | `POINT_OF_INTEREST_VIEW` | `PointOfInterestAdminSearchSchema` (query) | paginated `PointOfInterestAdminSchema[]` |
| `getById.ts` | `GET /{id}` | `POINT_OF_INTEREST_VIEW` | `PointOfInterestIdSchema` (param) | `PointOfInterestAdminSchema.nullable()` |
| `create.ts` | `POST /` | `POINT_OF_INTEREST_CREATE` | `PointOfInterestCreateInputSchema` | `PointOfInterestAdminSchema` |
| `update.ts` | `PUT /{id}` | `POINT_OF_INTEREST_UPDATE` | `PointOfInterestUpdateInputSchema` | `PointOfInterestAdminSchema` |
| `patch.ts` | `PATCH /{id}` | `POINT_OF_INTEREST_UPDATE` | `PointOfInterestUpdateInputSchema` (partial, via `transformApiInputToDomain`) | `PointOfInterestAdminSchema` |
| `delete.ts` | `DELETE /{id}` | `POINT_OF_INTEREST_DELETE` | `PointOfInterestIdSchema` (param) | `DeleteResultSchema` |
| `hardDelete.ts` | `DELETE /{id}/hard` | `POINT_OF_INTEREST_HARD_DELETE` | `PointOfInterestIdSchema` (param) | `{ success, message }` |
| `restore.ts` | `POST /{id}/restore` | `POINT_OF_INTEREST_RESTORE` | `PointOfInterestIdSchema` (param) | `PointOfInterestAdminSchema` |
| `batch.ts` | `POST /batch` | `POINT_OF_INTEREST_VIEW` | `PointOfInterestBatchRequestSchema` (new, §7.4) | `PointOfInterestBatchResponseSchema` (new, §7.4) |

`patch.ts`'s rate-limit override (`options: { customRateLimit: { requests: 20,
windowMs: 60000 } }`) and `getById.ts`'s cache/rate-limit override
(`options: { cacheTTL: 60, customRateLimit: { requests: 100, windowMs: 60000 }
}`) are copied verbatim from the attraction reference — no reason to diverge.

**Alternatives considered**: (a) generate this tier from a generic
`createStandardAdminCrudRoutes(entityConfig)` helper instead of 9 hand-copied
files; (b) hand-copy from `attraction/admin`, entity-by-entity, as every other
entity in the codebase does today. Chosen **(b)** — no such generic factory
exists anywhere in the codebase today (every entity's `admin/` directory is a
hand-copy of the previous one), introducing one here would be an
unrequested architectural change affecting the whole route layer, and the
9-file copy is a well-worn, low-risk pattern with zero behavioral surprises.

### 6.2 Destination-relation management

New sub-router `apps/api/src/routes/point-of-interest/admin/destinations.ts`,
mounted under `/{id}/destinations` on the same `admin/index.ts` router:

| Method + path | Permission | Body / params | Behavior |
| --- | --- | --- | --- |
| `GET /{id}/destinations` | `POINT_OF_INTEREST_VIEW` | — | Calls `service.getDestinationsByPointOfInterest` (existing) plus, for each returned destination, the matching relation row's `relation` value — returned as `{ destinationId, destinationName, destinationSlug, relation }[]`. |
| `POST /{id}/destinations` | `POINT_OF_INTEREST_CREATE` | `{ destinationId, relation }` (`relation` defaults to `PRIMARY` per HOS-140) | Calls `service.addPointOfInterestToDestination(actor, { destinationId, pointOfInterestId: id, relation })`. 409 `ALREADY_EXISTS` if the pair already exists (existing service behavior, unchanged). |
| `PATCH /{id}/destinations/{destinationId}` | `POINT_OF_INTEREST_UPDATE` | `{ relation }` | Calls the **new** `service.updatePointOfInterestDestinationRelation(actor, { destinationId, pointOfInterestId: id, relation })` (§6.3.1). |
| `DELETE /{id}/destinations/{destinationId}` | `POINT_OF_INTEREST_DELETE` | — | Calls `service.removePointOfInterestFromDestination` (existing, unchanged). |

**Permission decision — activate the dedicated `MANAGE` permission instead of
reusing CREATE/DELETE.** The service's `_canAddPointOfInterestToDestination`/
`_canRemovePointOfInterestFromDestination` hooks currently check
`checkCanCreatePointOfInterest`/`checkCanDeletePointOfInterest` (§5). Two
options:

1. **Keep reusing CREATE/DELETE** (zero service change; an operator who can
   create/delete POIs can also manage their destination assignments).
2. **Switch both hooks to check `PermissionEnum.DESTINATION_POINT_OF_INTEREST_MANAGE`**
   (small, isolated change to `point-of-interest.permissions.ts` +
   `point-of-interest.service.ts`'s two `_can*` overrides).

**Chosen at kickoff (2026-07-13): (1) — REVERSED from the spec's original
(2).** Baseline verification found an explicit, deliberate code comment in
`point-of-interest.permissions.ts:8-14`: *"POI uses `PermissionEnum.
POINT_OF_INTEREST_*` CONSISTENTLY at every hook... Do not reintroduce
attraction's inconsistency here."* The spec author had NOT seen this comment
when originally choosing (2). Switching relation management onto
`DESTINATION_POINT_OF_INTEREST_MANAGE` would directly reintroduce exactly the
split-brain the POI permission layer was deliberately built to avoid. Owner
decision at kickoff: **keep `POINT_OF_INTEREST_*` consistency**. Relation
routes therefore gate as: `GET → POINT_OF_INTEREST_VIEW`, `POST` add →
`POINT_OF_INTEREST_CREATE`, `PATCH` relation → `POINT_OF_INTEREST_UPDATE`,
`DELETE` → `POINT_OF_INTEREST_DELETE`. **No change** to
`point-of-interest.permissions.ts` or the two service `_can*` overrides (they
already delegate to Create/Delete correctly). `DESTINATION_POINT_OF_INTEREST_MANAGE`
stays unused. See §14.

### 6.3 New service methods

#### 6.3.1 `updatePointOfInterestDestinationRelation`

New method on `PointOfInterestService`, same shape as
`addPointOfInterestToDestination`/`removePointOfInterestFromDestination`
(`runWithLoggingAndValidation` wrapper, existence checks in parallel via
`Promise.all`, `ServiceError(NOT_FOUND, ...)` when the POI/destination/relation
row doesn't exist). Calls `this.relatedModel.update({ destinationId,
pointOfInterestId }, { relation })` (the HOS-140 `relation` column update is a
plain column update, no cardinality change). Input schema:
`PointOfInterestUpdateDestinationRelationInputSchema` (§7.2).

#### 6.3.2 Category assignment — reuse the existing `PointOfInterestCategoryService`

**Kickoff correction (2026-07-13): REVERSED from the spec's original plan of
adding these methods to `PointOfInterestService`.** Baseline verification
found a dedicated `PointOfInterestCategoryService` already exists
(`packages/service-core/src/services/poi-category/point-of-interest-category.service.ts`)
that OWNS the `r_poi_category` join table (via `RPoiCategoryModel` — the real
model name; the spec's `RPointOfInterestCategoryModel` does not exist, and it
has no bespoke finder, so filter with generic `findAll({ pointOfInterestId })`).
It already exposes `getCategoriesForPointOfInterest`,
`assignCategoryToPointOfInterest`, `unassignCategoryFromPointOfInterest`, and
`setPrimaryCategory`. Adding category methods to `PointOfInterestService`
instead would put TWO services on the same table — an SSOT violation. Owner
decision at kickoff: **the routes call the existing
`PointOfInterestCategoryService`**; we only ADD one new transactional
full-replace method there. See §14.

- `getCategoriesForPointOfInterest(actor, { pointOfInterestId })` —
  **already exists**; returns categories (id, slug, nameI18n, icon,
  isPrimary) ordered primary-first. Reused as-is by `GET .../categories`.
- `setCategoriesForPointOfInterest(actor, { pointOfInterestId, categoryIds,
  primaryCategoryId })` — **the one new method** — **full replace**, not
  incremental add/remove.
  Validates `primaryCategoryId ∈ categoryIds`, validates every id resolves to
  an existing, non-deleted `poi_categories` row (parallel `Promise.all`
  lookups, same style as §5's existing relation methods), then inside a
  `withServiceTransaction` block: deletes all existing `r_poi_category` rows
  for the POI and inserts the new set (with `isPrimary` set on exactly the
  `primaryCategoryId` row). Transaction wrapping matters here because a
  partial failure (delete succeeds, insert fails) must not leave the POI with
  zero categories.

**Alternatives considered for category assignment** (this is the concrete
design choice a junior implementer must not guess): (a) incremental
`POST .../categories` (add one) + `DELETE .../categories/{categoryId}`
(remove one) + a separate `PATCH .../categories/{categoryId}/primary`
endpoint to flip the primary marker, mirroring the destination-relation
add/remove/update triad in §6.2; (b) one `PUT` full-replace endpoint taking
the complete desired `{ categoryIds, primaryCategoryId }` set. **Chosen:
(b).** Both the category assignment and the destination-relation management
live in their own dedicated admin-UI sub-tab, decoupled from the main entity
form's single "Save" action — the same established precedent as the
Destinations/Accommodations "FAQs" sub-tab (`FaqManager`, per
`apps/admin/CLAUDE.md` § FAQ Management: "each row saves on its own... there
is no bulk form-array save") rather than a field bundled into the main PUT
body (see HOS-144 §6.4/§8). Within that tab, the category multi-select is a
chip-style widget that always holds the FULL current selection (the same
UX/data shape every other multi-select field in the admin form system already
uses — `AmenitySelectField`/`FeatureSelectField` both return a flat
`string[]` on every change, per
`apps/admin/src/components/entity-form/fields/entity-selects/AmenitySelectField.tsx`),
so its "Save categories" action naturally submits the complete edited set. A
full-replace `PUT` matches that shape with one round trip instead of N
incremental calls a client would otherwise have to diff and issue itself.

### 6.4 Admin-search filters

`PointOfInterestAdminSearchSchema` filters, layered on
`PointOfInterestSearchInputSchema`'s existing `_executeSearch`/`_executeCount`
machinery (§5, `buildSearchWhere`/`resolveDestinationIdFilter`):

- `type`, `isFeatured`, `isBuiltin` — already supported by
  `buildSearchWhere` (`packages/service-core/.../point-of-interest.service.ts:494-504`),
  just need surfacing in the admin-search schema.
- `destinationId` — already supported via `resolveDestinationIdFilter`
  (lines 526-540). No service change.
- `hasOwnPage`, `verified` — new plain-column filters (HOS-138 columns);
  extend `buildSearchWhere` to pass them through when present, same pattern
  as `isFeatured`.
- `categoryId` — new, mirrors `resolveDestinationIdFilter` exactly but joins
  through `r_poi_category` instead of `r_destination_point_of_interest`: a
  new private `resolveCategoryIdFilter(categoryId)` returning the same
  `{ empty, additionalConditions }` shape, ANDed with the destination filter's
  additional conditions when both are present.

### 6.5 AI-translate admin extension (G-6)

Five-spot change in `apps/api/src/services/ai-translate.service.ts` +
`apps/api/src/routes/ai/admin/translate.ts` (§5 baseline lists all five):
widen `TranslatableEntityType` to include `'pointOfInterest'`, add it to
`ENTITY_FIELDS` (`{ name: [...], description: [...] }` — actually a 2-field
map: `name`, `description`), add `pointsOfInterest` to `getEntityTable`'s
`tables` record, add `{ name: 'nameI18n', description: 'descriptionI18n' }`
to `I18N_COLUMN_MAP`, and widen the three `z.enum([...])` literals in
`translate.ts` to include `'pointOfInterest'`. This requires
`points_of_interest.translationMeta` (HOS-138) to exist with the exact same
shape (`jsonb`, nullable/default `{}`) the other four tables already have —
confirm this at implementation time; if HOS-138 shipped a differently-shaped
`translationMeta`, this sub-task blocks on a HOS-138 follow-up rather than
silently mismatching.

## 7. Data model / contracts

### 7.1 New file: `point-of-interest.admin-search.schema.ts`

```
packages/schemas/src/entities/point-of-interest/point-of-interest.admin-search.schema.ts
```

Mirrors `attraction.admin-search.schema.ts` structurally:

```ts
export const PointOfInterestAdminSearchSchema = AdminSearchBaseSchema.extend({
    type: PointOfInterestTypeEnumSchema.optional(),
    isFeatured: queryBooleanParam().describe('Filter by featured status'),
    isBuiltin: queryBooleanParam().describe('Filter by builtin status'),
    hasOwnPage: queryBooleanParam().describe('Filter POIs with an own public page'),
    verified: queryBooleanParam().describe('Filter by curation-verified status'),
    destinationId: DestinationIdSchema.optional(),
    categoryId: PointOfInterestCategoryIdSchema.optional() // id.schema.ts, added by HOS-139
});
```

### 7.2 Relation-management schemas (extend `.crud.schema.ts` or a new

`.destination-relation.schema.ts`)

```ts
export const PointOfInterestUpdateDestinationRelationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    pointOfInterestId: PointOfInterestIdSchema,
    relation: DestinationPointOfInterestRelationEnumSchema // PRIMARY | NEARBY, from HOS-140
});

export const PointOfInterestDestinationListItemSchema = z.object({
    destinationId: DestinationIdSchema,
    destinationName: z.string(),
    destinationSlug: z.string(),
    relation: DestinationPointOfInterestRelationEnumSchema
});
```

`PointOfInterestAddToDestinationInputSchema` (existing) gains an optional
`relation` field defaulting to `PRIMARY` — that widening is HOS-140's own
scope (additive, per the Schema Compatibility Policy — optional field with a
default), consumed here.

### 7.3 Category-assignment schemas

```ts
export const PointOfInterestSetCategoriesInputSchema = z.object({
    pointOfInterestId: PointOfInterestIdSchema,
    categoryIds: z.array(PointOfInterestCategoryIdSchema).min(1).max(10),
    primaryCategoryId: PointOfInterestCategoryIdSchema
}).refine((v) => v.categoryIds.includes(v.primaryCategoryId), {
    message: 'zodError.pointOfInterest.categories.primaryNotInSet'
});

export const PointOfInterestCategoryAssignmentSchema = z.object({
    id: PointOfInterestCategoryIdSchema,
    slug: z.string(),
    nameI18n: I18nTextSchema,
    icon: z.string().nullish(),
    isPrimary: z.boolean()
});
```

The `.max(10)` cap is a deliberate, documented product decision (not an
arbitrary implementation detail a junior should have to invent): a landmark
realistically fits in a handful of thematic buckets; 10 leaves generous
headroom while still catching a fat-fingered "select everything" mistake in
the admin UI multi-select.

### 7.4 New file: `point-of-interest.batch.schema.ts`

Structural copy of `attraction.batch.schema.ts`: `PointOfInterestBatchRequestSchema`
(`ids: uuid[].min(1).max(100)`, optional `fields`), `PointOfInterestBatchItemSchema`
(`PointOfInterestSchema.partial().required({ id: true })`),
`PointOfInterestBatchResponseSchema` (`z.array(...nullable())`). Note the
attraction batch handler's "Always include id and name" comment — since POI has
no `name` field even in v2 (`nameI18n` is the multilang field), the batch
handler's `requiredFields` constant must be `['id', 'slug']`, not `['id',
'name']` — a copy-paste trap to call out explicitly (R-4).

### 7.5 Endpoint summary (new routes only, excluding the standard CRUD tier

already tabulated in §6.1)

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/admin/points-of-interest/{id}/destinations` | `POINT_OF_INTEREST_VIEW` |
| POST | `/api/v1/admin/points-of-interest/{id}/destinations` | `POINT_OF_INTEREST_CREATE` |
| PATCH | `/api/v1/admin/points-of-interest/{id}/destinations/{destinationId}` | `POINT_OF_INTEREST_UPDATE` |
| DELETE | `/api/v1/admin/points-of-interest/{id}/destinations/{destinationId}` | `POINT_OF_INTEREST_DELETE` |
| GET | `/api/v1/admin/points-of-interest/{id}/categories` | `POINT_OF_INTEREST_VIEW` |
| PUT | `/api/v1/admin/points-of-interest/{id}/categories` | `POINT_OF_INTEREST_UPDATE` |
| POST | `/api/v1/admin/ai/translate` (existing route, widened enum) | `AI_SETTINGS_MANAGE` (unchanged) |

### 7.6 Registration

`apps/api/src/routes/point-of-interest/index.ts` gains
`export { adminPointOfInterestRoutes } from './admin/index.js';` alongside the
existing public export. `apps/api/src/routes/index.ts` gains, in the admin
tier block (near line 508, alphabetically after `attractions`):

```ts
app.route('/api/v1/admin/points-of-interest', adminPointOfInterestRoutes);
```

No change to the public-tier mount at line 285.

## 8. UX / UI behavior

Not applicable — this spec is API-only (no UI). HOS-144 covers the admin UI
that consumes these endpoints.

## 9. Acceptance criteria

- **AC-1** `GET/POST/PUT/PATCH/DELETE /api/v1/admin/points-of-interest[/{id}]`,
  `DELETE .../{id}/hard`, `POST .../{id}/restore`, and `POST .../batch` all
  exist, are mounted, and enforce the permission listed in §6.1's table
  (verified by an integration test per route asserting 403 for an actor
  missing the permission and 200/201 for an actor holding it).
- **AC-2** `PointOfInterestAdminSearchSchema` accepts `type`, `isFeatured`,
  `isBuiltin`, `hasOwnPage`, `verified`, `destinationId`, `categoryId` as
  optional query filters; a list request combining `destinationId` +
  `categoryId` returns only POIs matching BOTH (AND semantics, not OR).
- **AC-3** `POST /{id}/destinations` with an existing `(destinationId,
  pointOfInterestId)` pair returns `409` with error code `ALREADY_EXISTS`
  (unchanged existing service behavior, exercised through the new route).
- **AC-4** `PATCH /{id}/destinations/{destinationId}` changes only the
  `relation` column value and returns `404 NOT_FOUND` if the relation row
  does not exist (does NOT silently create it).
- **AC-5** `PUT /{id}/categories` with `primaryCategoryId` absent from
  `categoryIds` returns `400 VALIDATION_ERROR` before any DB write; with a
  valid set, the POI ends up with EXACTLY the submitted category set (no
  leftover rows from a previous assignment) and exactly one row flagged
  `isPrimary: true`.
- **AC-6** `PUT /{id}/categories` failing mid-transaction (e.g. a
  non-existent `categoryId` in the middle of the array) leaves the POI's
  PREVIOUS category assignment fully intact (transaction rollback verified
  by an integration test that intentionally submits one bad id among valid
  ones).
- **AC-7** (rewritten at kickoff — §6.2 decision reversed) Destination-relation
  routes enforce the standard POI CRUD permissions: an actor missing
  `POINT_OF_INTEREST_CREATE` gets `403` on `POST .../destinations`, missing
  `POINT_OF_INTEREST_UPDATE` gets `403` on `PATCH .../destinations/{destinationId}`,
  and missing `POINT_OF_INTEREST_DELETE` gets `403` on `DELETE
  .../destinations/{destinationId}`; an actor holding each respective
  permission succeeds. (`DESTINATION_POINT_OF_INTEREST_MANAGE` is NOT wired —
  no test asserts it.)
- **AC-8** `POST /api/v1/admin/ai/translate` with `{ entityType:
  'pointOfInterest', entityId, sourceLocale: 'es' }` translates `nameI18n`/
  `descriptionI18n` into the missing target locale(s) and persists via
  `persistTranslations`, exercised by a new integration test alongside the
  existing accommodation/destination/event/post ones.
- **AC-9** Every new route file has a corresponding row in
  `docs/billing/endpoint-gate-matrix.md` (Decision: `none`, with a one-line
  reason) so `endpoint-gate-matrix.guard.test.ts` passes.
- **AC-10** `pnpm typecheck` and the full `apps/api` + `packages/schemas` +
  `packages/service-core` test suites pass; ≥90% coverage on the two new
  service methods (§6.3) and the two new resolver helpers (§6.4).

## 10. Risks

- **R-1 Dependency drift.** This spec assumes HOS-138/139/140 ship the exact
  shapes described in §5/§6 (`translationMeta` column, `poi_categories` +
  `r_poi_category` with `isPrimary`, `relation` enum column + widened
  `PointOfInterestAddToDestinationInputSchema`). Mitigation: re-verify §5's
  baseline against the actual merged state of those three specs immediately
  before starting implementation, not from this document alone.
- **R-2 Permission-switch behavior change.** §6.2's decision to move
  destination-relation add/remove off `POINT_OF_INTEREST_CREATE`/`_DELETE`
  onto `DESTINATION_POINT_OF_INTEREST_MANAGE` is a real behavior change for
  any actor who currently holds CREATE/DELETE but not the dedicated MANAGE
  permission (none exist yet in practice since the feature is unbuilt, but
  seed/test fixtures granting roles broadly should be checked). Mitigation:
  AC-7's test makes the new gate explicit; call this out in the PR
  description per the endpoint-gate-matrix workflow (`docs/billing/adding-an-entitlement.md`
  step pattern, even though this isn't a billing gate).
- **R-3 Category-replace race.** Two concurrent `PUT .../categories` calls
  for the same POI could interleave delete+insert. Mitigation: wrap in
  `withServiceTransaction` (§6.3.2) — Postgres's default transaction
  isolation serializes the two transactions' writes to the same rows; the
  loser simply sees its own full-replace apply last (last-write-wins is
  acceptable UX for an admin-only single-operator-at-a-time catalog edit).
- **R-4 Batch schema copy-paste trap.** Copying `attraction.batch.schema.ts`
  naively would carry over the "always include id and name" comment/logic
  even though POI has no `name` field (§7.4). Mitigation: called out
  explicitly here; the batch handler's `requiredFields` must read
  `['id', 'slug']`.
- **R-5 Admin-search `categoryId` AND vs OR.** Combining `destinationId` +
  `categoryId` filters must be AND (a POI must satisfy both), not OR — an
  easy mistake when writing two independent `resolve*Filter` helpers that
  each return "empty" independently. Mitigation: AC-2 test explicitly
  exercises the combination.
- **R-6 AI-translate widening is real work, not free.** The task framing
  that mentions "AI auto-translate wired via EntityFormSection.tsx" for
  `I18nTextField` describes the ADMIN-side widget, but the field only
  becomes functional once the ADMIN-side `TranslationSection` component
  points at a working backend entity type — and today's backend
  (`ai-translate.service.ts`) has a closed 4-entity union with no POI
  variant anywhere. Mitigation: G-6/§6.5/AC-8 make this an explicit,
  estimated part of THIS spec (api area) rather than an assumed side-effect
  of HOS-144 (admin area) — HOS-144's design doc must NOT assume this is
  already wired.
- **R-7 Gate-matrix guard.** Every new admin route file (9 standard CRUD +
  4 relation + 2 category = 15 files) needs its own
  `docs/billing/endpoint-gate-matrix.md` row or CI fails outright on an
  unrelated-looking guard test. Mitigation: AC-9; do this in the same PR,
  not as an afterthought.

## 11. Open questions

- **OQ-1 (resolved by design, documented for traceability)**: should
  destination-relation add/remove/update require `DESTINATION_POINT_OF_INTEREST_MANAGE`
  or reuse `POINT_OF_INTEREST_CREATE`/`_DELETE`? Resolved in §6.2 — use the
  dedicated `MANAGE` permission.
- **OQ-2**: should the category-assignment endpoint be full-replace (`PUT`)
  or incremental (`POST`/`DELETE` per category)? Resolved in §6.3.2 —
  full-replace, to match the "submit whole array" UX of every other
  admin-form multi-select.
- **OQ-3 (genuinely open)**: HOS-139's `poi_categories` model/service layer
  (`RPointOfInterestCategoryModel` or equivalent) is assumed to exist with a
  `findAll({ pointOfInterestId })`-style query capability by the time this
  spec starts. If HOS-139 ships a different model shape (e.g. no dedicated
  join-table model, direct SQL instead), §6.3.2/§6.4's `categoryId` filter
  design needs a quick revisit against the actual HOS-139 implementation.
  Flag this at kickoff, not mid-implementation.
- **OQ-4 (genuinely open)**: should `type` remain a required field on
  `PointOfInterestCreateInputSchema` once categories become the real
  taxonomy (HOS-113's plan doc calls `type` "deprecated, derived from primary
  category")? This spec does NOT change that — `type` stays required and
  independently settable, exactly as it is today — but whoever implements
  HOS-139/141's category→type derivation logic should confirm this admin
  API's `create`/`update` routes don't need a compensating change (e.g.
  auto-deriving `type` server-side from `primaryCategoryId` on save). Out of
  scope here; flagged for the derivation-logic spec.

## 12. Implementation notes

- Suggested phasing (Task Master):
  - **Phase 1 — Schemas**: `point-of-interest.admin-search.schema.ts`,
    `point-of-interest.batch.schema.ts`, relation/category schemas (§7.2,
    §7.3). Unit tests for each new schema (valid/invalid cases, especially
    the `primaryCategoryId ∈ categoryIds` refinement).
  - **Phase 2 — Service**: `updatePointOfInterestDestinationRelation`,
    `getPointOfInterestCategories`, `setPointOfInterestCategories`; switch
    the two destination-relation permission hooks to
    `DESTINATION_POINT_OF_INTEREST_MANAGE` (§6.2); extend `buildSearchWhere`/
    add `resolveCategoryIdFilter` (§6.4). Unit tests per method, including the
    transaction-rollback case (AC-6).
  - **Phase 3 — Standard CRUD routes**: the 9-file `admin/` directory copy
    (§6.1) + `index.ts` + registration in `routes/index.ts` (§7.6). One
    integration test per route (happy path + permission-denied path).
  - **Phase 4 — Relation + category routes**: `destinations.ts` sub-router +
    categories routes; integration tests for AC-3 through AC-7.
  - **Phase 5 — AI-translate widening**: the five-spot change (§6.5); AC-8
    integration test.
  - **Phase 6 — Gate matrix + docs**: 15 new rows in
    `docs/billing/endpoint-gate-matrix.md` (AC-9); confirm
    `endpoint-gate-matrix.guard.test.ts` passes.
  - **Phase 7 — Quality gate**: `pnpm typecheck`, full suite, coverage check
    (AC-10).
- Every new route file is a rename-and-rewire of its `attraction/admin`
  counterpart — resist the temptation to "improve" the pattern along the way
  (e.g. don't introduce a generic route-factory abstraction, per §6.1's
  Alternatives). Consistency with the rest of the codebase's entity tiers
  outweighs local cleverness.
- When wiring the `destinations.ts` sub-router, mount it the same way
  `attraction/admin/batch.ts`'s `/batch` sub-path is mounted today — a nested
  path segment on the SAME `adminRouter`, not a separately-registered Hono
  app.

## 13. Linear

Canonical tracking:
HOS-143

## 14. Kickoff baseline verification & corrections (2026-07-13)

Per R-1/OQ-3, §5's baseline was re-verified against the actual merged state of
HOS-138/139/140 before implementation. Result: **all data-model prerequisites
are present and functionally correct** (v2 columns, `translationMeta` uniform
across all 5 tables, `poi_categories` + `r_poi_category` with `isPrimary` +
partial-unique "one primary" index, `relation` PRIMARY/NEARBY column). No
blockers. Two design points were reversed and several symbol names in this
document were found wrong; both the reversals and the corrections are binding
for implementation and override the earlier prose where they conflict.

### 14.1 Symbol-name corrections (spec text was wrong)

| Spec text (WRONG) | Actual symbol | Location |
| --- | --- | --- |
| `DestinationPointOfInterestRelationEnumSchema` | `PointOfInterestDestinationRelationEnumSchema` | `packages/schemas/src/enums/point-of-interest-destination-relation.schema.ts` |
| `RPointOfInterestCategoryModel` | `RPoiCategoryModel` (no bespoke finder — use generic `findAll({ pointOfInterestId })`) | `packages/db/src/models/destination/rPoiCategory.model.ts` |
| `PointOfInterestCategoryIdSchema` | `PoiCategoryIdSchema` | `packages/schemas/src/common/id.schema.ts:58` |

POI DB/model files live under `packages/db/src/schemas/destination/` and
`.../models/destination/`, NOT a top-level `point-of-interest/` folder.

### 14.2 AI-translate widen count (§6.5 said "5 spots")

Actually **6 edit sites across 2 files**: in `ai-translate.service.ts` — (1)
the `TranslatableEntityType` union, (2) `ENTITY_FIELDS`, (3) `getEntityTable`'s
`tables` map, (4) `I18N_COLUMN_MAP`; in `routes/ai/admin/translate.ts` — the
three `z.enum([...])` literals at lines 35, 41, 52. Add `'pointOfInterest'`
mapped to `{ name: 'nameI18n', description: 'descriptionI18n' }` and table
`pointsOfInterest`.

### 14.3 Design reversals (both owner-approved at kickoff)

- **§6.2 permissions**: destination-relation routes keep `POINT_OF_INTEREST_*`
  (VIEW/CREATE/UPDATE/DELETE), NOT `DESTINATION_POINT_OF_INTEREST_MANAGE`.
  Honors the explicit "do not reintroduce attraction's inconsistency" comment
  in `point-of-interest.permissions.ts:8-14`. No permissions/service-hook
  change. AC-7 rewritten accordingly.
- **§6.3.2 category methods**: add the one new transactional full-replace
  `setCategoriesForPointOfInterest` to the EXISTING
  `PointOfInterestCategoryService` (owner of `r_poi_category`), reuse its
  `getCategoriesForPointOfInterest`. Routes call that service, not
  `PointOfInterestService`. SSOT.
