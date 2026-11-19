---
title: Partner types as an admin-managed catalog (adds Medio and Persona)
linear: HOS-2336
statusSource: linear
created: 2026-11-18
type: feature
smoke:
  - staging
areas:
  - db
  - api
  - admin
  - web
  - i18n
  - seed
---

# Partner types as an admin-managed catalog (adds Medio and Persona)

## 1. Summary

Replace the closed `PartnerTypeEnum` (`business`, `ngo`, `institution`) with an **admin-managed
catalog** table `partner_types`, so that adding or renaming a partner type is an admin operation and
not a code change plus a deploy. The catalog starts with five types. Two are new **type values**, not
fields: **Medio** (a media outlet such as a radio station or a news portal) and **Persona** (an
individual person).

This follows the HOS-919 precedent (provider trade categories), minus everything a flat list does not
need: no groups, no keywords, no many-to-many. A partner has exactly one type.

### 1.1 Out of scope

| Item | Why / where |
|---|---|
| Groups or keywords for partner types | A flat list of five values. YAGNI (alternative C, §9) |
| A partner with several types | One type per partner stays. Not requested |
| Tier (gold/silver) changes | Tiers are unrelated to type (`apps/web/CLAUDE.md`, HOS-294) |
| A button in the admin inbox to approve-and-provision a partner lead | The endpoint exists, the UI does not (§10, R3). Separate follow-up |
| Hard delete of a type | Soft delete only, and only when unused (AC-3.4) |
| A public `?type=` filter on the partner list | Dropped (AC-5.2, owner decision 2026-11-18). The endpoint keeps answering `400` on purpose |
| The N+1 contract release | Specified here (§5.3) but shipped as its own PR after the data-migration ran everywhere |

## 2. Current state (verified on this branch, 2026-11-18)

- `packages/schemas/src/enums/partner-type.enum.ts` defines `PartnerTypeEnum` (3 values); `partner-type.schema.ts` exports `PartnerTypeEnumSchema`.
- `packages/db/src/schemas/enums.dbschema.ts:426` declares the pgEnum `partner_type_enum`.
- `packages/db/src/schemas/partner/partner.dbschema.ts:35` has `type` NOT NULL on that pgEnum, with `partners_type_idx` (`:169`).
- `packages/db/src/schemas/alliance/alliance_lead.dbschema.ts:105` has `partnerType` as `varchar(30)`, validated in Zod only.
- Consumers of the closed set:
  - Schemas: `partner.schema.ts:64`, `partner.query.schema.ts:12`, `partner.admin-search.schema.ts:11`, `partner-application.schema.ts:39` (approval body `type`), `alliance-lead.schema.ts:205`, `alliance-lead.crud.schema.ts:62`. `PartnerPublicSchema` is `partnerSchema.pick({ type: true, ... })` (`partner.access.schema.ts:25`).
  - Model: `packages/db/src/models/partner/partner.model.ts:33` (`eq(partners.type, ...)`) and the raw INSERT in `partner-application.model.ts:263`.
  - Service: `alliance-lead.partner-provisioning.ts:87` (`PartnerTypeEnumSchema.safeParse(lead.partnerType)`).
  - API: `apps/api/src/routes/partners/public/index.ts:31` passes `query?.type` to the service.
  - Web: `apps/web/src/pages/[lang]/partners/[slug].astro:94` (`t('partners.types.<type>')`), `apps/web/src/components/alliance/AllianceLead.client.tsx:135-139,329,698` (options from the enum, labels `alliance-leads.form.partnerTypeOptions.*`), `apps/web/src/lib/forms/alliance-lead-message.ts:87`.
  - Admin: `apps/admin/src/features/partners/components/PartnerForm.tsx:100-103` (hardcoded `TYPE_OPTIONS`), `partners.columns.tsx:25-43` and `partners.config.ts:20-25` (filter, labels `admin-filters.partnerType.*`), `partner-applications/components/PartnerApplicationActionDialog.tsx:3,45,122-126`.
  - Seed: `packages/seed/src/data/partner/001..006-*.json` (`"type": "business" | "ngo" | "institution"`), `packages/seed/src/example/partners.seed.ts`, `packages/seed/src/schemas/partner.schema.json`.
  - Tests that name the enum: `packages/schemas/test/enums/partner-type.enum.test.ts`, `packages/service-core/test/services/alliance-lead/alliance-lead.partner-provisioning.test.ts`, `partner.*.test.ts` under `packages/service-core/test/services/partner/`, `PartnerForm.test.tsx`, `usePartnerApplicationActions.test.tsx`, DB integration tests (`partner-application-from-empty.test.ts`, `old-grouping-*.test.ts`, `listing-reconciler-population.integration.test.ts`).
- Partner provisioning from a lead is a **separate explicit action** (`POST /api/v1/admin/alliance/leads/:id/approve-and-provision-partner`, `apps/api/src/routes/alliance/admin/approve-and-provision-partner.ts`), not part of `mark-handled`. It already degrades: a lead with no usable typed data returns `201` with `partnerId: null`.

## 3. Decisions (approved by the owner on 2026-11-18)

| # | Decision |
|---|---|
| D1 | New table `partner_types`: `id`, `slug` (unique, includes soft-deleted rows), `name_i18n` jsonb, `translation_meta` jsonb, `display_weight`, `lifecycle_state`, `admin_info`, audit columns and soft delete. **No** groups, keywords or M2M. Same column set and conventions as `host_trade_category_groups` (`packages/db/src/schemas/host-trade/host-trade-category-group.dbschema.ts`). |
| D2 | `partners.type_id uuid` FK `RESTRICT`, added **nullable** in release N (expand) and backfilled by a seed data-migration from the enum value by slug, with `meta.requiresColumns`. Release N+1 (contract, separate PR, only after the data-migration ran in every environment) makes `type_id` NOT NULL and drops `partners.type`, `partner_type_enum` and `PartnerTypeEnum`. |
| D3 | `alliance_leads.partner_type` stays a **slug varchar**. It is validated against ACTIVE types at submission and again at approval. |
| D4 | Seed five types with deterministic ids (like the HOS-919 seeder), as baseline plus data-migration (dual-write): `business` Comercio, `ngo` ONG, `institution` Institución, `media` Medio, `person` Persona, each with `es`, `en` and `pt` names (§11). |
| D5 | The public partner page renders the type name from the table's `nameI18n`, delivered in the partner payload: `PartnerPublicSchema` returns `type: { slug, name }`. The `partners.types.*` i18n keys are removed once unused. |
| D6 | ~~The public `?type=` filter on the partner list keeps accepting **slugs**.~~ **Dropped 2026-11-18** (see AC-5.2). The public list gets no `type` filter. |
| D7 | Admin: CRUD plus a restore screen under `/content`, following `host-trade-categories`. Permissions `partnerType.*` granted to `SUPER_ADMIN` and `ADMIN` only. In-use guard (409 when deactivating or deleting a type that a partner uses). Cache-tag purge on every write. |
| D8 | Admin `PartnerForm`, the partner list column and filter, and `PartnerApplicationActionDialog` read the catalog. |
| D9 | The web lead form reads a new public endpoint `GET /api/v1/public/partner-types`. |
| D10 | If the lead's type is inactive at approval, partner provisioning degrades (the lead is approved, no partner is created) and reports the reason, aligned with the provisioning-outcome contract of HOS-2339. |

## 4. User stories and acceptance criteria

### US-1. An applicant picks the kind of organization in the alliance form

- **AC-1.1** Given the partner alliance form, when it loads, then the type select lists every ACTIVE type ordered by `displayWeight`, then localized name, labelled from `nameI18n[locale] ?? nameI18n.es`. On a fresh seed it shows Comercio, ONG, Institución, Medio, Persona.
- **AC-1.2** Given the type catalog request fails, then the select shows an inline error with a retry action, and the form cannot be submitted (the field is required).
- **AC-1.3** Given a submission whose `partnerType` is a slug that is unknown or inactive (stale tab), then the API answers `400 VALIDATION_ERROR` with `details.field = partnerType`.
- **AC-1.4** Given a type deactivated after the form loaded, when the applicant submits it, then AC-1.3 applies.
- **AC-1.5** Given `kind` is not `partner`, then `partnerType` is neither required nor validated (current behaviour kept).

### US-2. An admin approves a partner lead

- **AC-2.1** Given an approved partner lead whose `partnerType` slug is an ACTIVE type, when the admin runs approve-and-provision, then a DRAFT partner is created with `type_id` of that type and the response is `provisioned: true`.
- **AC-2.2** Given the lead's type was deactivated or deleted after submission, then the lead is approved, no partner is created, the response is `201` with `partnerId: null, provisioned: false` and `reason: 'no-active-partner-type'`, and the skip is logged at `warn` with the lead id and slug.
- **AC-2.3** Given a lead with no `businessName` or no `partnerType`, then the existing `legacy-lead-without-typed-fields` outcome is unchanged.
- **AC-2.4** Given `PartnerApplicationActionDialog` (partner applications, not alliance leads), when it opens, then the type select is filled from the admin catalog (ACTIVE only), defaults to the first option by weight, and the approval body sends `typeId`.

### US-3. An admin manages the catalog

- **AC-3.1** Given an admin with `partnerType.view`, when opening `/content/partner-types`, then they see every type with name, slug, weight, lifecycle badge and a partner count.
- **AC-3.2** Given `partnerType.create`, when creating a type with `slug`, `nameI18n.es` and a weight, then it is stored ACTIVE, appears in the public endpoint, and the slug matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`. A slug that already exists (even on a soft-deleted row) answers `409 ALREADY_EXISTS`.
- **AC-3.3** Given an existing type, when editing, then `slug` is read-only (immutable, because leads store slugs) and a body that includes `slug` answers `400`.
- **AC-3.4** Given a type used by at least one non-deleted partner, when the admin deactivates it, soft-deletes it or both, then the API answers `409 PARTNER_TYPE_IN_USE`, naming the count in `details.count`, and nothing changes. A type with zero partners can be deactivated and deleted.
- **AC-3.5** *(moved to HOS-2366, not part of this release)* Given a soft-deleted type, when the admin turns on "Mostrar borrados" and restores it, then it returns with its old slug and lifecycle state. Given `partnerType.restore` is missing, the button is hidden and the API answers `403`.
- **AC-3.6** Given an actor with none of the `partnerType.*` permissions (for example an editor), then every admin endpoint answers `403` and the menu entry is hidden.
- **AC-3.7** Given any admin write, then the cache tag `CACHE_TAG_PARTNER_TYPES` is purged once after commit, and a purge failure never fails the write.

### US-4. An admin edits a partner's type

- **AC-4.1** Given `PartnerForm`, when it opens, then the type select lists ACTIVE types plus the partner's current type even if inactive (marked "inactiva"), so saving other fields never forces a type change.
- **AC-4.2** Given the partner list, then the type column shows the localized name and the filter lists every type (all lifecycle states) and sends the **slug** (`?type=media`).
- **AC-4.3** Given an admin sends `typeId` of an inactive type for a partner whose current type is another one, then the API answers `400 VALIDATION_ERROR` (`details.field = typeId`). Sending the partner's own current inactive type is accepted.

### US-5. A visitor reads a partner page

- **AC-5.1** Given `/{lang}/partners/<slug>/`, then the type label is the type's `nameI18n[locale] ?? es`, rendered in the SSR HTML (no client fetch).
- ~~**AC-5.2** Given `GET /api/v1/public/partners?type=media`, then only partners of that type are returned. An unknown slug returns an empty list (`200`), not an error (current behaviour for an enum miss is preserved: the value was never rejected as a 400 here).~~
  **DROPPED (owner decision, 2026-11-18).** HOS-294 decision D-5 retired the filtered partner directory: only the carousel and the gold-partner page exist, and nothing in the web consumes a type-filtered list. The public list stays unimplemented for `?type=` and keeps answering `400` "Unknown query parameters: type" on purpose. Recorded in the HOS-2336 sign-off comment of 2026-11-18.
- **AC-5.3** Given a partner whose type was deactivated, then the partner stays visible and keeps its type label (deactivating a type only stops new assignments).

## 5. Data model

### 5.1 New table `partner_types` (`packages/db/src/schemas/partner/partner-type.dbschema.ts`)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK, defaultRandom | deterministic for seeded rows (UUIDv5 from slug) |
| `slug` | text NOT NULL unique | immutable; uniqueness includes soft-deleted rows |
| `name_i18n` | jsonb `I18nText` NOT NULL | `es` required |
| `translation_meta` | jsonb `TranslationMeta` default `{}` | |
| `display_weight` | integer NOT NULL default 50 | lower first |
| `lifecycle_state` | `LifecycleStatusPgEnum` NOT NULL default `ACTIVE` | |
| `admin_info`, `created_at`, `updated_at`, `created_by_id`, `updated_by_id`, `deleted_at`, `deleted_by_id` | as `host_trade_category_groups` | |

Index: `lifecycle_state`. Relations: `partnerTypes` has many `partners`.

### 5.2 `partners` and `alliance_leads`

- **Release N (expand):** add `partners.type_id uuid` nullable, FK to `partner_types.id` `ON DELETE RESTRICT`, with an index on `type_id`. `partners.type` and `partner_type_enum` stay and are **still written** (dual-write) until N+1, so a rollback of the app keeps working. Every write path sets both: model create/update, the raw INSERT in `partner-application.model.ts:263`, and the seed.
- `alliance_leads.partner_type` is unchanged in shape. Its Zod validation moves from `PartnerTypeEnumSchema` to a slug schema plus a service-side check against ACTIVE types (same mechanism as `resolveSubmittedCategorySlugs`, `alliance-lead.service.ts:523`, using a model method like `findActiveBySlugs`).
- **Release N+1 (contract, separate PR):** `type_id` NOT NULL; drop `partners.type`, `partners_type_idx` and the pgEnum `partner_type_enum` (`enums.dbschema.ts:426`); delete `PartnerTypeEnum`, `PartnerTypeEnumSchema` and their tests; stop dual-writing. Precondition checked in the PR description: `SELECT count(*) FROM partners WHERE type_id IS NULL` is 0 in staging and prod.

### 5.3 Migrations and carriles

| Step | Carril | Content |
|---|---|---|
| 1 | structural (`pnpm db:generate`) | create `partner_types`, add `partners.type_id` |
| 2 | seed data-migration (`pnpm db:seed:make partner-types-catalog`) | upsert the 5 types by slug; grant `partnerType.*` to `SUPER_ADMIN` and `ADMIN` (precedent: `packages/seed/src/data-migrations/0180-hos919-host-trade-category-catalog.ts`); backfill `partners.type_id` from `partners.type` (map `business`, `ngo`, `institution` to the same slugs). `meta.requiresColumns: ['partners.type']`. An unknown legacy value is logged and skipped, never aborts |
| 3 | baseline seed | `packages/seed/src/required/partnerTypes.seed.ts` (+ `packages/seed/src/data/partnerType/*.json`, deterministic ids) and `data/partner/*.json` switch `type` to `typeSlug` |
| 4 (N+1) | structural | the drops in §5.2 |

Step 2 is one data-migration so catalog, grants and backfill run in a guaranteed order. Steps 2 and 3 satisfy the seed dual-write rule (`scripts/check-seed-dual-write.sh`). `partner_types` is a required catalog, so it goes under `required/`, like `hostTradeCategories.seed.ts`.

## 6. API

### 6.1 Schemas (`packages/schemas/src/entities/partner-type/`)

- `PartnerTypeSchema`, create, update (omits `slug`), admin-search (extends `AdminSearchBaseSchema` with `lifecycleState`), http and access schemas, following `host-trade-category/`.
- `PartnerTypeRefSchema = { id, slug, nameI18n }` embedded in admin partner reads. `PartnerPublicTypeSchema = { slug, name }` for public reads (`name` already resolved for the request locale, falling back to `es`).
- `PublicPartnerTypeListSchema = { items: [{ slug, nameI18n, displayWeight }] }`.
- `partnerSchema`: `type` (enum) is replaced by `typeId` (+ the embedded ref on reads). `PartnerPublicSchema` can no longer `pick({ type })` (it would pick the enum); it overrides `type` with `PartnerPublicTypeSchema`. `PartnerQuerySchema` and `PartnerAdminSearchSchema` keep `type` as a **slug string** (D6). `partner-application.schema.ts:39` approval body `type` becomes `typeId` (uuid).
- `AllianceLeadSchema.partnerType` and the create schema become a slug string (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 30).

### 6.2 Endpoints

| Method / path | Tier | Permission | Notes |
|---|---|---|---|
| `GET /api/v1/public/partner-types` | public | none | ACTIVE, not deleted, ordered by weight then name. Emits `CACHE_TAG_PARTNER_TYPES` |
| `GET /api/v1/admin/partner-types` | admin | `PARTNER_TYPE_VIEW` | `page`+`pageSize`, filters `lifecycleState`, `search`; honours `includeDeleted`; each row carries `partnerCount` |
| `POST /api/v1/admin/partner-types` | admin | `PARTNER_TYPE_CREATE` | |
| `PATCH /api/v1/admin/partner-types/:id` | admin | `PARTNER_TYPE_UPDATE` | deactivation guarded (AC-3.4) |
| `DELETE /api/v1/admin/partner-types/:id` | admin | `PARTNER_TYPE_DELETE` | soft; guarded (AC-3.4) |
| `POST /api/v1/admin/partner-types/:id/restore` | admin | `PARTNER_TYPE_RESTORE` | |
| existing partner admin create/update, partner-application approve | admin | unchanged | body `typeId` |
| existing partner public list | public | none | unchanged; no `type` filter (AC-5.2 dropped, `?type=` keeps answering `400`) |
| existing alliance-lead submit (`routes/alliance/public/create-lead.ts`) | public | none | `partnerType` slug validated against ACTIVE types |

New files under `apps/api/src/routes/partner-type/{public,admin}/` (mirror `apps/api/src/routes/host-trade-category/`), registered in the route index and `apps/api/route-manifest.json`.

New permissions: `PARTNER_TYPE_VIEW|CREATE|UPDATE|DELETE|RESTORE` with values `partnerType.view|create|update|delete|restore` (camelCase, like `hostTradeCategory.*`). `SUPER_ADMIN` receives every permission at runtime without reading `role_permission` (`apps/api/src/middlewares/actor.ts`), so the `SUPER_ADMIN` grant row is for inventory consistency only. The `ADMIN` grant is the one that matters. Adding enum values trips the frozen permission guards: **recount** them (`packages/schemas/test/enums/permission-naming-convention.guard.test.ts` and the role-permission inventory tests), do not bump by one.

### 6.3 Services (`packages/service-core/src/services/partner-type/`)

- `PartnerTypeService extends BaseCrudService`, with `partner-type.permissions.ts`, `partner-type.cache.ts` (`purgePartnerTypesCache`, best effort like `host-trade-category.cache.ts`), and `getPublicList()`.
- `_beforeSoftDelete` and the update path refuse with `PARTNER_TYPE_IN_USE` when a non-deleted partner uses the type. Lock the type row `FOR UPDATE` inside the transaction and have partner writes read the type `FOR SHARE`, exactly as `HostTradeCategoryService` does, so a concurrent assignment and a delete serialize.
- `PartnerService` create/update: validate `typeId` (exists, not deleted, ACTIVE unless it is the partner's current type, AC-4.3); write `type` (enum) and `type_id` together while dual-writing; hydrate the type ref in one batched query per page.
- `alliance-lead.partner-provisioning.ts:87`: resolve `lead.partnerType` to an ACTIVE type id; if none, return the skip `no-active-partner-type`. Extend `PartnerProvisionSkipReason` and `ProvisionPartnerResult` (same file) with that reason. The route response schema keeps `{ lead, partnerId, provisioned }` and gains `reason?` (additive), the shape HOS-2339 uses for `provisioning`.
- Approval-time recheck (D3): the same resolution runs at approve-and-provision, so a type deactivated between submission and approval takes the skip path.

### 6.4 Error contract

Order 401, 403, 400, 404, 409 (`apps/api/docs/error-contract.md`). Add one row to the table there: *Deleting or deactivating a partner type that partners still use (HOS-2336)* returns **409** `PARTNER_TYPE_IN_USE`, next to `CATEGORY_IN_USE`. The new code is added exactly where `CATEGORY_IN_USE` lives: `packages/schemas/src/enums/service-error-code.enum.ts`, `apps/api/src/middlewares/response.ts` and `apps/api/src/utils/response-helpers.ts`. A 4xx is never `INTERNAL_ERROR`. Unknown id on admin routes is 404 after the permission check (403 first).

### 6.5 Cache

> Note: decision 17 of the 2026-11-18 sign-off (no Cache-Tag on the public route) has a follow-up in HOS-2368. Check it before implementing the emission described below.

Add `CACHE_TAG_PARTNER_TYPES = 'partner-types'` to `packages/cache-tags/src/vocabulary.ts` (and the barrel `index.ts` plus `vocabulary.test.ts`, which enforces the tag shape and that no prefix collides). The public endpoint emits it. Partner pages emit it too, because they render the type name (D5); every admin type write purges it. A type rename must also refresh `/{lang}/partners/<slug>/`: the partner page response carries both its own partner tag and `CACHE_TAG_PARTNER_TYPES`.

## 7. Web (`apps/web`)

- `AllianceLead.client.tsx`: the `partnerType` select is filled from `partnerTypeApi.list()` (new wrapper in `src/lib/api/endpoints.ts` + a transform in `transforms.ts`). Loading, error+retry (AC-1.2) and empty (no active types: the field shows "No disponible por ahora" and blocks submit) states. `alliance-lead-message.ts:87` keeps the field as typed/excluded from the prose message.
- `partners/[slug].astro:94`: read `partner.type.name` from the payload; drop the `t('partners.types.*')` lookup.
- `@repo/i18n`: remove `partners.types.*`, `alliance-leads.form.partnerTypeOptions.*` and `admin-filters.partnerType.{business,ngo,institution}` (es, en, pt) once unused; update `test/untranslated-spanish.baseline.json` for removed keys. Keep the field labels (`partnerType`, validation messages), change the validation key from enum-closed wording if any.

## 8. Admin (`apps/admin`)

- New route `src/routes/_authed/content/partner-types/index.tsx` and `src/features/partner-types/` (table, create/edit dialog, delete dialog, "Mostrar borrados" toggle, restore button), modelled on `src/features/host-trade-categories/`. Hooks in `src/hooks/use-partner-types.ts`. Do not reuse `isCategoryInUseError` (`use-host-trade-categories.ts:86`, it treats any 409 as in-use); compare `error.code === 'PARTNER_TYPE_IN_USE'`.
- `PartnerForm.tsx:100-103`: delete `TYPE_OPTIONS`; options from the admin catalog (AC-4.1). `partners.columns.tsx` and `partners.config.ts`: column and filter options from the catalog (slug values). `PartnerApplicationActionDialog.tsx`: options from the catalog, sends `typeId` (AC-2.4).
- Navigation: entry under the content section guarded by `PARTNER_TYPE_VIEW`.

## 9. Alternatives considered

| | Option | Why not |
|---|---|---|
| A | Add `media` and `person` to the enum | Fixes today's gap, but the next type needs code, a migration and a deploy: the exact problem HOS-919 removed for categories. |
| B | Keep a pgEnum and add an admin screen that writes enum values | A pgEnum value cannot be added or renamed from a screen without DDL. |
| C | Reuse the HOS-919 tables (group = partner, category = type) | Different aggregate, permissions and cache tag; a partner has one type, a provider many categories. Coupling them would leak provider rules into partners. |
| D | `partners.type` as a text slug with no FK | No referential integrity, so AC-3.4 would need a scan, and a typo would be a valid value. |
| E | Single release (add `type_id` NOT NULL and drop the enum at once) | The backfill reads the column the same release drops: it moves zero rows and is ledgered applied forever (HOS-433). Expand/contract is mandatory. |

## 10. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | `type_id` stays NULL on rows a path forgot to dual-write | Every writer listed in §5.2 sets both; integration test asserts both columns on create via model, via approval INSERT and via seed; the N+1 PR is gated on `count(*) WHERE type_id IS NULL = 0` |
| R2 | `PartnerPublicSchema` silently keeps the enum through `pick` | Explicit override plus a schema test on the public payload shape |
| R3 | The admin inbox has no UI to approve-and-provision a partner lead (`useAllianceLeads.ts` header says so), so AC-2.2 is exercised through the API only until HOS-2339/follow-up adds a button | Documented; smoke uses the endpoint |
| R4 | An admin deactivates a type used by pending leads | Not blocked (leads store slugs); approval degrades per AC-2.2 |
| R5 | Cached partner pages show an old type name after a rename | Shared cache tag (§6.5), covered by a cache-purge test |

## 11. Initial catalog (seed baseline and data-migration)

| slug | es | en | pt | weight |
|---|---|---|---|---|
| `business` | Comercio | Business | Comércio | 10 |
| `ngo` | ONG | NGO | ONG | 20 |
| `institution` | Institución | Institution | Instituição | 30 |
| `media` | Medio | Media outlet | Meio de comunicação | 40 |
| `person` | Persona | Person | Pessoa | 50 |

Ids: `deterministicFixtureId({ seedKey: 'partnerType:<slug>' })`, exported as `partnerTypeIdFor({ slug })` so the baseline seeder and the data-migration assign the same id (same pattern as `hostTradeCategoryIdFor`, `packages/seed/src/required/hostTradeCategories.seed.ts`).

## 12. Testing strategy

| AC | Level | Test |
|---|---|---|
| AC-1.1, 1.2 | component (web) | `AllianceLead.client` partner-type select: ordered options, error+retry, empty state |
| AC-1.3, 1.4, 1.5 | service + route | `alliance-lead.service` submit with unknown/inactive slug => `VALIDATION_ERROR` `details.field`; non-partner kind unaffected |
| AC-2.1, 2.2, 2.3 | unit | `alliance-lead.partner-provisioning.test.ts`: plan/execute with active, inactive, deleted, absent type; logger called on skip |
| AC-2.2 | route | approve-and-provision returns `201`, `partnerId: null`, `reason` |
| AC-2.4 | component (admin) | `PartnerApplicationActionDialog` options + `typeId` in body (update `usePartnerApplicationActions.test.tsx`) |
| AC-3.1..3.6 | route + service | `apps/api/test/routes/partner-type/admin.test.ts`, `partner-type.service.test.ts` (in-use guard incl. race via `FOR UPDATE`/`FOR SHARE`, immutable slug, restore, permission matrix) |
| AC-3.7 | unit | `partner-type.cache.test.ts` (purge called once, failure swallowed) |
| AC-3.1, 3.5 | component (admin) | list + toggle + restore dialog; hidden controls without permission |
| AC-4.1, 4.2 | component (admin) | `PartnerForm` keeps an inactive current type; column/filter use slugs |
| AC-4.3 | service | `PartnerService` update with inactive foreign type vs own current type |
| AC-5.1 | static + unit | `[slug].astro` source guard (no `partners.types`), payload schema test |
| AC-5.3 | route | public partner whose type is inactive stays visible with its type label (AC-5.2 dropped: `?type=` on the public list stays a `400`) |
| §5 | DB integration | data-migration over seeded old rows (backfill, idempotent re-run, `requiresColumns` abort when the column is gone and rows exist), `partner-application` INSERT sets both columns, FK RESTRICT |
| §6.2 | guards | permission inventory recount, `check-seed-dual-write`, `scripts/check-catalog-sql.ts` untouched, route manifest |

Smoke (staging, label `status-needs-smoke-staging`): create a type in the admin, see it in the alliance form, submit a lead with it, approve and provision through the endpoint, deactivate the type before a second lead's approval and confirm the degraded outcome, rename a type and confirm the public partner page refreshes after the purge.

## 13. Suggested tasks (phased)

**Phase 1, setup:** permissions enum + inventory recount; `CACHE_TAG_PARTNER_TYPES`; Zod schemas for `partner-type`.
**Phase 2, data:** `partner-type.dbschema.ts` + `partners.type_id`; `pnpm db:generate`; data-migration (catalog, grants, backfill); baseline seed + fixtures; DB integration tests.
**Phase 3, core:** `PartnerTypeService` (+ in-use guard, cache); model changes (`partner.model.ts:33` filter by slug via join, for the admin list only: the public list exposes no `type` filter, dual-write, `partner-application.model.ts:263`); `PartnerService` type validation and hydration; provisioning skip reason; lead slug validation.
**Phase 4, API:** public and admin routes, manifest, partner and approval schemas, error-contract row.
**Phase 5, UI:** admin screen + hooks; `PartnerForm`, column/filter, `PartnerApplicationActionDialog`; web lead form, partner page; i18n removals.
**Phase 6, verification:** run tests, guards, staging smoke, sign-off comment.
**Phase 7, N+1 contract (separate PR, later):** precondition query, `type_id` NOT NULL, drops, delete enum code and tests.

## 14. Revision history

- 2026-11-18: AC-5.2 (public `?type=` filter) dropped by the owner. Reason: HOS-294 decision D-5 retired the filtered partner directory, and nothing in the web consumes a type-filtered list. The public list keeps answering `400` "Unknown query parameters: type". D6, §1.1, §6.2, §12 and Phase 3 adjusted to match.
- 2026-11-18: AC-3.5 (restore keeps lifecycle state) moved to HOS-2366.
- 2026-11-18: decision 17 (no Cache-Tag on the public route) has a follow-up in HOS-2368.
