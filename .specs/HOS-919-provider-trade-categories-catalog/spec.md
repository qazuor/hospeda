---
title: Provider trade categories — admin-managed catalog, multi-category providers, grouped searchable selector
linear: HOS-919
statusSource: linear
created: 2026-11-17
type: feature
areas:
  - db
  - api
  - admin
  - web
  - i18n
  - seed
---

# Provider trade categories — admin-managed catalog, multi-category providers, grouped searchable selector

## 1. Summary

Replace the closed, code-level `HostTradeCategoryEnum` (13 values, one per provider) with an
**admin-managed catalog** of trade categories organised in **groups**, linked to providers through
a **many-to-many** relation, so that:

1. Adding or renaming a category is an admin operation, not a code change plus a deploy (owner
   decision 2026-08-29, recorded in HOS-919).
2. A provider (`host_trades` row) can carry **1..N** categories (owner decision 2026-11-17).
3. The catalog starts with **29 categories in 5 groups** (§11).
4. Every place that lists categories reads from the catalog. That includes the provider sign-up
   form, the host directory filter, the provider cards, the admin, and the
   `/presentacion/proveedores` marketing page, which today has 17 hand-written chips that already
   disagree with the enum.
5. The selector is a **grouped multi-select combobox** whose search ignores accents and case and
   matches by prefix against the category name **and** a list of related words per category
   (for example, «pozo» finds *Destapaciones y desagotes*). It does not use AI.

The precedent this spec follows is HOS-139 (POI categories: `poi_categories` + `r_poi_category`).

### 1.1 Out of scope

| Item | Where it goes |
|---|---|
| Partner types (`PartnerTypeEnum`) as a catalog | HOS-2336 |
| A second benefit aimed at the host's guest | HOS-2337 (owner decision pending) |
| Providers editing their own categories | Not planned. The team edits categories, as today (§3, D3) |
| Hard delete of a category or group | Not exposed. Soft delete only, and only when unused (§6.4) |
| AI or embedding search | Rejected (§9, alternative C) |
| A primary category per provider | Not needed (§9, alternative D) |

## 2. Current state (measured on `origin/staging`, 2026-11-17)

- `packages/schemas/src/enums/host-trade-category.enum.ts` defines 13 values. `host-trade-category.schema.ts` wraps it in `z.nativeEnum`.
- `packages/db/src/schemas/enums.dbschema.ts:130` declares `host_trade_category_enum` as a pgEnum.
- `host_trade.dbschema.ts:33` has `category` as a NOT NULL pgEnum, with a btree index on `category` and a composite index on `(destinationId, category)`. The enum was created in `0016_odd_warbound.sql`.
- `alliance_lead.dbschema.ts:107-126` has `category` as a nullable `varchar(50)`, validated in Zod only.
- Single-value assumptions:
  - `host-trade.service.ts:487,508` builds a key-value `where` map (`where.category = x`), and the admin search does the same.
  - `host-trade.model.ts:59` orders the directory by `category ASC`.
  - `alliance-lead.provisioning.ts:90` runs `safeParse(lead.category)` and skips provisioning when it fails.
  - `TradesDirectory.client.tsx:48-149` filters client-side with one active category.
  - `TradeCard.tsx:107`, `BenefitUsageCard.tsx:96`, `HostTradeEditForm.client.tsx:224`, `mi-cuenta/directorio-proveedores/[slug]/index.astro:140` and `.../registrar-uso/index.astro:158` each render a single label.
- Three drifting copies of the category list exist:
  1. `@repo/i18n` `host-trades.categories.*`.
  2. `admin-filters.hostTradeCategory.*`, which has different labels, plus 13 hand-written filter options in `apps/admin/src/features/host-trades/config/host-trades.config.ts:35-88`.
  3. The 17 chips in `apps/web/src/pages/[lang]/presentacion/proveedores/index.astro:227-248`.
- The admin form (`basic-info.consolidated.ts:61-77`) shows the raw enum value as its label.
- **Data:**
  - prod has 0 `host_trades` and 0 `alliance_leads` with a category;
  - staging has 20 seed rows: PLOMERIA 4, CERRAJERIA 3, ELECTRICIDAD 3, CLIMATIZACION 2, GAS 2, and one each of ALBANILERIA, CARPINTERIA, FLETES, INTERNET, LIMPIEZA and PILETA_JARDIN.
- No email, SEO, sitemap, JSON-LD, analytics, e2e, mobile or MCP code reads the category.

## 3. Decisions (all approved by the owner on 2026-11-17)

| # | Decision |
|---|---|
| D1 | Groups live in their own admin-managed table, with a multilang name and an order. Each category belongs to exactly one group. |
| D2 | A category or group in use is **deactivated**, never deleted. A deactivated category is no longer offered by the selector or the marketing page, and providers that already have it keep it. |
| D3 | Providers do not edit their categories. Admins edit them, and the categories submitted in a sign-up lead are reviewed when the lead is approved. `categoryIds` therefore joins `HOST_TRADE_OWNER_FORBIDDEN_FIELDS`. |
| D4 | The directory filter is multi-select with **any-of** semantics. |
| D5 | *Remís* is an ordinary category with a host-facing benefit. |
| D6 | The marketing page renders its chips from the catalog, grouped. The copy «uno o más rubros» stays, because it becomes true. |
| D7 | Display names live in `nameI18n` jsonb, following the HOS-138/139 pattern. They are **not** i18n keys by slug. Related words live in `keywordsI18n` jsonb. |
| D8 | A slug is immutable once created, because leads store slugs (§5.3). |

## 4. User stories and acceptance criteria

### US-1. A provider signs up choosing several categories

- **AC-1.1** Given the `/sumate/proveedor` form, when I open the category field, then I see every
  **active** category under its **active** group headers, ordered by group `displayWeight`, then
  category `displayWeight`, then localized name.
- **AC-1.2** Given I type `pozo`, then *Destapaciones y desagotes* is listed, because «pozo ciego»
  is one of its related words. Typing `AIRE` or `aíre` lists *Climatización*.
- **AC-1.3** Given a query with no match, then the list shows the empty-state text plus the hint
  «Si tu oficio no está, escribilo en el mensaje».
- **AC-1.4** Given I selected 3 categories, then they show as removable chips. Pressing Backspace
  in an empty input removes the last chip.
- **AC-1.5** Given I submit with 0 categories, then the form blocks the submission with the
  existing «requerido» message. The server also answers `400 VALIDATION_ERROR` for an empty or
  missing `categorySlugs`.
- **AC-1.6** Given I select more than 10 categories, then the 11th option is disabled, with a
  visible reason. The server rejects more than 10 with `400`.
- **AC-1.7** Given a slug that is inactive or unknown at submit time (for example, a stale tab),
  then the server answers `400 VALIDATION_ERROR` naming the field `categorySlugs`.
- **AC-1.8** The combobox is keyboard-operable (arrows, Enter, Escape, Backspace). It exposes
  `role="combobox"` with `aria-expanded`, a `listbox` with `aria-multiselectable="true"` and
  `option[aria-selected]` per item, and group headers as `role="group"` with `aria-labelledby`.

### US-2. An admin approves a lead with several categories

- **AC-2.1** Given a lead with `categorySlugs = [plomeria, destapaciones-desagotes]`, when it is
  approved, then the provisioned `host_trades` row has exactly those two categories in
  `r_host_trade_category`.
- **AC-2.2** Given a lead whose slugs include one that was deactivated after submission, then
  provisioning keeps the active ones. If **none** is active, it returns
  `skip: 'no-active-category'`, and the admin sees the existing skip notice.
- **AC-2.3** Given a legacy lead with only the old `category` varchar, then the data-migration has
  already converted it to `categorySlugs` (§7). Provisioning never reads `category`.

### US-3. An admin manages the catalog

- **AC-3.1** An actor with `HOST_TRADE_CATEGORY_CREATE` can create a group or a category. A
  category needs a slug (kebab-case, unique), `nameI18n` with at least `es`, a group,
  `displayWeight` and optional `keywordsI18n`.
- **AC-3.2** Renaming (`nameI18n`) or editing keywords is reflected in the selector and the
  marketing page without a deploy, after cache purge (§6.6).
- **AC-3.3** Changing `lifecycleState` to `INACTIVE` hides the category from the public catalog
  endpoint and the selector. Providers that have it still show it on their card.
- **AC-3.4** Soft-deleting a category that any non-deleted `host_trades` row uses answers
  `409 CONFLICT` with code `CATEGORY_IN_USE`. The same applies to a group with any non-deleted
  category.
- **AC-3.5** The slug cannot be changed after creation: the update schema rejects `slug` with `400`.
- **AC-3.6** Without the permission, every admin route answers `403`, and an unknown id answers
  `404` (error order per `apps/api/docs/error-contract.md`).

### US-4. An admin edits a provider's categories

- **AC-4.1** The host-trade admin form shows a multi-select fed by the catalog, with min 1 and
  max 10 categories.
- **AC-4.2** Saving replaces the provider's set atomically: delete-missing and insert-new happen
  in one transaction.
- **AC-4.3** An inactive category that the provider already has can be kept. Adding an inactive
  category the provider does not have answers `400`.
- **AC-4.4** The admin list shows one badge per category, and the category filter is
  multi-select with any-of semantics, with options loaded from the catalog. No option list is
  hand-written.

### US-5. A host browses the directory

- **AC-5.1** The directory shows, for each provider, all its categories as badges, in catalog
  order.
- **AC-5.2** The filter pills come from the categories present in the result set, ordered by
  catalog order. Selecting several pills shows providers that have **any** of them, and a
  provider with 2 matching categories appears **once**.
- **AC-5.3** The directory is ordered by provider name (it no longer orders by category).
- **AC-5.4** `GET /api/v1/protected/host-trades?categories=plomeria,pintura` returns any-of
  matches. An unknown slug in the list is ignored, and if all slugs are unknown the result is an
  empty list (200).

### US-6. A prospect reads the marketing page

- **AC-6.1** `/{lang}/presentacion/proveedores/` renders the chips from the public catalog
  endpoint at SSR, grouped under group headings, active rows only, in the page locale.
- **AC-6.2** If the endpoint fails, the page still renders (200). The chips block is omitted,
  and the sentence «Si tu oficio no está…» still shows.
- **AC-6.3** The page stays session-blind
  (`cacheable-pages-are-session-blind.guard.test.ts` stays green).

## 5. Data model

### 5.1 New tables (`packages/db/src/schemas/host-trade/`)

`host_trade_category_groups` (`host-trade-category-group.dbschema.ts`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK, defaultRandom | |
| `slug` | text, NOT NULL, unique | immutable (D8) |
| `name_i18n` | jsonb `I18nText`, NOT NULL | `es` required |
| `translation_meta` | jsonb `TranslationMeta`, default `{}` | same as `poi_categories` |
| `display_weight` | integer, NOT NULL, default 50 | lower first |
| `lifecycle_state` | `LifecycleStatusPgEnum`, NOT NULL, default `ACTIVE` | |
| `admin_info`, audit columns, `deleted_at`, `deleted_by_id` | same as `poi_categories` | |

`host_trade_categories` (`host-trade-category.dbschema.ts`): the same columns, plus:

| Column | Type | Notes |
|---|---|---|
| `group_id` | uuid, NOT NULL, FK → groups.id, `onDelete: 'restrict'` | |
| `keywords_i18n` | jsonb `{ es?: string[]; en?: string[]; pt?: string[] }`, NOT NULL, default `{}` | related words, lowercase, max 30 per locale, max 40 chars each |

Indexes: unique `slug`, `group_id`, and `lifecycle_state`.

`r_host_trade_category` (`r_host_trade_category.dbschema.ts`), modelled on `r_poi_category` without `isPrimary`:

| Column | Type |
|---|---|
| `host_trade_id` | uuid, NOT NULL, FK → host_trades.id, `onDelete: 'cascade'` |
| `category_id` | uuid, NOT NULL, FK → host_trade_categories.id, `onDelete: 'restrict'` |

PK `(host_trade_id, category_id)`, plus an index on `category_id`. `restrict` is deliberate: it
backs AC-3.4 at the DB level.

### 5.2 `host_trades`

- **Release N (expand):** `category` becomes **nullable**. No code reads or writes it after this release.
- **Release N+1 (contract, separate PR):**
  - drop `category`, `hostTrades_category_idx` and `hostTrades_destinationId_category_idx`;
  - drop the pgEnum `host_trade_category_enum`;
  - delete `HostTradeCategoryEnum`, its schema and its tests.

### 5.3 `alliance_leads`

- **N:** add `category_slugs text[]`, nullable. Validation in Zod: 1..10 entries, each an active catalog slug at submit time. The old `category` varchar stays and is not written anymore.
- **N+1:** drop `category`.

We store slugs and not ids because a lead is an inbox record of what the person asked for. A slug
is readable in the admin even if the category is later deactivated, and slugs are immutable (D8).

### 5.4 Migrations and carriles

| Step | Carril | Content |
|---|---|---|
| 1 | structural (`pnpm db:generate`) | create the 3 tables, add `alliance_leads.category_slugs`, make `host_trades.category` nullable |
| 2 | seed data-migration (`pnpm db:seed:make host-trade-category-catalog`) | upsert the 5 groups and 29 categories by slug (§11) |
| 3 | same data-migration, after step 2 | backfill `r_host_trade_category` from `host_trades.category` and `alliance_leads.category_slugs` from `alliance_leads.category` using the map in §5.5. `meta.requiresColumns: ['host_trades.category', 'alliance_leads.category']` |
| 4 | baseline seed | `packages/seed/src/data/hostTradeCategory/*.json` and `hostTradeCategoryGroup/*.json` with deterministic ids. `hostTrade/*.json` switch from `category` to `categorySlugs: string[]` |
| 5 (N+1) | structural | the drops in §5.2 and §5.3 |

Steps 2 and 3 are one data-migration so the order is guaranteed. Steps 2 and 4 satisfy the seed
dual-write rule (`scripts/check-seed-dual-write.sh`). Steps 3 and 5 are split across two
releases, following the expand/contract rule (HOS-433).

### 5.5 Backfill map (old enum → new slugs)

| Old | New |
|---|---|
| CERRAJERIA | cerrajeria |
| PLOMERIA | plomeria |
| ELECTRICIDAD | electricidad |
| GAS | gas-instalacion |
| CLIMATIZACION | climatizacion |
| LIMPIEZA | limpieza-domicilio |
| FLETES | fletes |
| VIDRIERIA | vidrieria |
| CARPINTERIA | carpinteria |
| PILETA_JARDIN | piletas **and** parque-jardineria |
| PLAGAS | control-plagas |
| INTERNET | internet-tv |
| ALBANILERIA | albanileria |

`GAS` maps to installation only. The two staging rows are seed fixtures of gas fitters, and prod
has none. An unknown old value is logged and skipped; it never aborts the migration.

## 6. API

### 6.1 Schemas (`packages/schemas/src/entities/host-trade-category/`)

- `HostTradeCategoryGroupSchema` and `HostTradeCategorySchema` are the entity schemas.
- Create, update, admin-search and http schemas follow the existing `poi-category` files. Update
  omits `slug` (D8).
- `HostTradeCategoryRefSchema = { id, slug, nameI18n, groupSlug }` is what other entities embed.
- `PublicHostTradeCatalogSchema = { groups: [{ slug, nameI18n, displayWeight, categories: [{ id, slug, nameI18n, keywordsI18n, displayWeight }] }] }`.
- `HostTradeSchema`: replace `category` with `categories: HostTradeCategoryRefSchema[]` for reads
  and `categoryIds: uuid[]` (1..10, unique) for admin writes.
- `AllianceLeadSchema`: replace `category` with `categorySlugs: string[] | null`. The
  required-for-`service_provider` rule (`alliance-lead.crud.schema.ts:39`) becomes "non-empty
  array", and the message key moves to
  `zodError.allianceLead.categorySlugs.requiredForServiceProvider`.
- `HostTradeQuerySchema` and `HostTradeAdminSearchSchema`: replace `category` with `categories`, a
  comma-separated slug list preprocessed to `string[]`, max 30.
- `HostTradeUsageProviderRefSchema.category` becomes `categories: HostTradeCategoryRefSchema[]`.

### 6.2 Endpoints

| Method / path | Tier | Permission | Notes |
|---|---|---|---|
| `GET /api/v1/public/host-trade-categories` | public | none | active groups with active categories, ordered. Cache tag §6.6 |
| `GET /api/v1/admin/host-trade-category-groups` | admin | `HOST_TRADE_CATEGORY_VIEW` | `page`+`pageSize` |
| `POST/PATCH/DELETE /api/v1/admin/host-trade-category-groups[/:id]`, `POST …/:id/restore` | admin | `_CREATE` / `_UPDATE` / `_DELETE` / `_RESTORE` | DELETE: 409 `CATEGORY_IN_USE` if any non-deleted category |
| `GET /api/v1/admin/host-trade-categories` | admin | `HOST_TRADE_CATEGORY_VIEW` | filter by `groupId`, `lifecycleState`, `q` |
| `POST/PATCH/DELETE /api/v1/admin/host-trade-categories[/:id]`, `POST …/:id/restore` | admin | as above | DELETE: 409 `CATEGORY_IN_USE` if any non-deleted host_trade links it |
| existing host-trade admin create/update | admin | unchanged | body `categoryIds` |
| existing host-trade list routes (protected + admin) | unchanged | unchanged | `categories` query param, any-of |
| existing alliance-lead submit (`apps/api/src/routes/alliance/public/create-lead.ts`) | public | unchanged | body `categorySlugs`; the form is anonymous, so validation against the active catalog is the only gate |

New permissions in `PermissionEnum`: `HOST_TRADE_CATEGORY_VIEW|CREATE|UPDATE|DELETE|RESTORE`, with
values `hostTradeCategory.*`, camelCase like `poiCategory.*`. The same set gates groups, because
it is one catalog. Granting them to the admin roles needs a seed data-migration (dual-write).
Adding enum values trips the frozen permission guards, which must be re-counted and not just
bumped by one (see `packages/schemas/test/enums/permission-naming-convention.guard.test.ts` and
the role-permission inventory tests).

### 6.3 Services (`packages/service-core/src/services/host-trade-category/`)

- `HostTradeCategoryGroupService` and `HostTradeCategoryService` extend `BaseCrudService`. Their
  permissions file mirrors `poi-category.permissions.ts`.
- `getPublicCatalog()` returns the nested structure in one query (join plus ordering), filtered by
  `lifecycleState = ACTIVE` and `deletedAt IS NULL` on both levels.
- `HostTradeService`:
  - `_executeSearch`, `_executeCount` and the admin search translate `categories` into an
    `EXISTS (SELECT 1 FROM r_host_trade_category r JOIN host_trade_categories c … WHERE c.slug = ANY($1))`
    predicate. The predicate is added through a model method, because the key-value `where` map
    cannot express it.
  - Reads hydrate `categories`, ordered by group `displayWeight`, then category `displayWeight`,
    then slug, using one batched query per page (no N+1).
  - Create and update with `categoryIds` validate that every id exists and is not deleted, that
    an inactive id is allowed only if it is already linked (AC-4.3), and that there are 1..10
    unique ids. They replace the set inside the same transaction as the row write.
- `HostTradeModel` (`host-trade.model.ts:59`) orders by `name` only.
- `alliance-lead.provisioning.ts` resolves `categorySlugs` to active category ids. If there are
  none, it returns `skip: 'no-active-category'`. Otherwise it inserts the join rows in the
  provisioning transaction.
- The alliance-lead create path validates `categorySlugs` against the active catalog (AC-1.7).

### 6.4 Delete and deactivate semantics

- Deactivating means `PATCH { lifecycleState: 'INACTIVE' }`. It is always allowed.
- Soft delete is allowed only when the row is unused (AC-3.4).
- Restore is allowed. A restored category keeps its old slug, and a new category cannot reuse a
  deleted slug: the unique index includes deleted rows.

### 6.5 Error contract

The order is 401 → 403 → 400 → 404 → 409 (`apps/api/docs/error-contract.md`). `CATEGORY_IN_USE`
is a new business error code in the service error map. A 4xx is never `INTERNAL_ERROR`.

### 6.6 Cache

- Add `CACHE_TAG_HOST_TRADE_CATEGORIES` to `@repo/cache-tags`.
- The public catalog response and `/presentacion/proveedores` emit it.
- Every admin catalog write (create, update, delete, restore, on both tables) purges it through
  the existing purge fan-out.
- The `/sumate/proveedor` form fetches the catalog client-side, so no SSR tag is needed there.

## 7. Web (`apps/web`)

- **New `TradeCategoryMultiSelect.client.tsx`** (`src/components/form/`), with styles in
  `.combobox*` and a CSS Module for chips.
  - We do not extend `SearchableSelect.client.tsx`. Its contract is single-value
    (`value: T | null`, `onChange(item | null)`), and grouping plus multi-select would double its
    branches.
  - The component reuses the same ARIA and keyboard conventions and the same CSS tokens.
- **New pure util `src/lib/search/match-catalog-query.ts`.** It normalizes text with NFD,
  strips diacritics (`\p{M}`), lowercases and collapses whitespace.
  - A category matches when **every** query token is a prefix of some word in its haystack.
  - The haystack is the name and keywords in the current locale **plus** the name and keywords in
    `es`. Argentine users type Spanish on any locale.
  - Ranking: a name prefix match first, then a keyword match, then catalog order.
  - A group with no matching category is hidden.
- `AllianceLead.client.tsx` and `src/lib/forms/alliance-lead-message.ts`:
  - the `category` field becomes `categorySlugs`, with a new field type `multiselect`;
  - the message builder keeps excluding typed fields.
- `TradesDirectory.client.tsx`:
  - the active filter becomes `ReadonlySet<string>` of slugs;
  - the pills come from the union of categories in the result set, in catalog order;
  - the filter has any-of semantics and each provider appears once;
  - the toggle-to-clear and empty-state behaviour are kept.
- `TradeCard.tsx`, `BenefitUsageCard.tsx`, `HostTradeEditForm.client.tsx` (read-only) and the two
  `mi-cuenta` pages render one badge per category, using `nameI18n[locale] ?? nameI18n.es`.
  - The card shows at most 3 badges plus «+N».
  - The detail pages show all.
- `/presentacion/proveedores/index.astro` fetches the public catalog at SSR (§6.6). It renders an
  `<h3>` per group plus the existing `.chip` spans and keeps the copy (D6). AC-6.2 defines the
  fallback.
- `src/lib/api/endpoints-protected.ts` and `endpoints-public.ts`: retype the 3 response types and
  add `getHostTradeCatalog()`.
- `@repo/i18n`: remove `host-trades.categories.*` (es, en and pt). Add UI strings for the
  combobox (placeholder, empty state, max reached, remove chip). Update
  `test/untranslated-spanish.baseline.json` for removed keys.

## 8. Admin (`apps/admin`)

- New route `src/routes/_authed/content/host-trade-categories/`. It shows two TanStack tables,
  groups and categories, with create and edit dialogs:
  - `I18nTextField` for `nameI18n`;
  - a per-locale tag input for `keywordsI18n`;
  - `displayWeight`;
  - group select;
  - lifecycle toggle.

  Navigation goes under the host-trades menu section.
- `features/host-trades/config/sections/basic-info.consolidated.ts`: replace the `SELECT` with
  `ENTITY_MULTISELECT` fed by the admin catalog endpoint (min 1, max 10). Labels come from
  `nameI18n`, never the raw slug.
- `host-trades.columns.ts`: a multi-badge cell.
- `host-trades.config.ts`: the filter becomes multi, with options loaded from the catalog. Delete
  the 13 hand-written options and the `admin-filters.hostTradeCategory` i18n block (es, en and pt).

## 9. Alternatives considered

| | Option | Why not |
|---|---|---|
| A | Expand the enum to 29 and use an enum array column | It contradicts the owner decision in HOS-919: every new category still needs code plus a migration plus a deploy. It would be thrown away when HOS-919 lands. |
| B | Use a `text[]` of slugs on `host_trades` instead of a join table | There is no FK, so AC-3.4 (in use) would need a scan. It diverges from the HOS-139 precedent. Filtering would need a GIN index and still not give referential integrity. |
| C | Search with AI or embeddings | A closed list of about 30 items does not need it. Synonyms give determinism, zero latency, offline use, testability, and admin control. |
| D | Mark one category as primary per provider (as `r_poi_category.isPrimary` does) | Nothing consumes a primary: the directory now orders by name and cards show catalog order. YAGNI. It can be added later without breaking anything. |
| E | Keep groups as a fixed code enum | Groups would then need code to add, which is the same problem one level up (D1). |

## 10. Testing strategy

**Unit**

- `match-catalog-query`:
  - accents and case;
  - multi-token queries;
  - prefix versus infix (`ería` must not match);
  - es fallback on the en and pt locales;
  - ranking;
  - an empty query returns everything.
- Zod schemas:
  - 0, 1, 10 and 11 entries;
  - duplicate ids;
  - a non-kebab slug;
  - `slug` present in an update rejected;
  - the `categories` query preprocess.
- Provisioning:
  - all active;
  - partially inactive;
  - none active → skip;
  - never reads `category`.
- `TradeCategoryMultiSelect` (testing-library):
  - keyboard flow;
  - ARIA attributes;
  - the max-10 lock;
  - Backspace removal;
  - group hiding;
  - empty state.
- `TradesDirectory`:
  - any-of;
  - no duplicates;
  - pill order;
  - clearing the filter.

**Integration (DB)**

- The service filter with the `EXISTS` predicate (any-of, unknown slugs, all unknown).
- Hydration order, with no N+1 (assert the query count).
- Set replacement is atomic: a forced failure on insert leaves the old set.
- Restrict on delete: the service answers 409 and the FK restrict holds.
- The data-migration on a fixture with all 13 old values gives the expected join rows
  (PILETA_JARDIN gives 2), and leads are converted. Running it twice is idempotent.

**API**

- Every admin route, for 401, 403, 400, 404 and 409, plus the happy path.
- The public catalog filters out inactive and deleted rows at both levels.
- Lead submit with stale, empty and 11 slugs → 400.
- Keep the regression intent of `admin.test.ts:246-265`: the filter param is forwarded, renamed
  to `categories`.

**Guards and frozen counts to update deliberately**

- The permission enum guards.
- `HOST_TRADE_OWNER_FORBIDDEN_FIELDS` (`categoryIds` added, `category` removed) and its test.
- The admin config test "badge options cover all enum values", rewritten as "options come from
  the catalog".
- The i18n untranslated baseline.
- `scripts/zod-keys-inventory.json`.
- The seed dual-write guard, which must pass with both the baseline and the data-migration.
- `cacheable-pages-are-session-blind`.

**Manual smoke** (`status-needs-smoke-staging`)

1. Create a category in the admin and see it in `/sumate/proveedor` and on the marketing page
   after the purge.
2. Deactivate it and see it disappear from both places, while staying on a provider that already
   has it.
3. Submit a lead with 3 categories, approve it, and check the provider row.
4. In the directory, filter by 2 categories.

## 11. Initial catalog (seed baseline and data-migration)

Groups (`displayWeight` in steps of 10):

| slug | es | en | pt |
|---|---|---|---|
| instalaciones | Instalaciones | Installations | Instalações |
| reparaciones-obra | Reparaciones y obra | Repairs & construction | Reparos e obras |
| limpieza-ropa-blanca | Limpieza y ropa blanca | Cleaning & linens | Limpeza e roupa de cama |
| exterior | Exterior | Outdoors | Área externa |
| abastecimiento-traslados | Abastecimiento y traslados | Supplies & transport | Abastecimento e transporte |

Categories (`displayWeight` follows table order in steps of 10 within each group; keywords are `es`; en and pt keywords start empty):

| group | slug | es | en | pt | es keywords |
|---|---|---|---|---|---|
| instalaciones | plomeria | Plomería | Plumbing | Encanamento | plomero, caño, pérdida, canilla, agua, cañería, inodoro |
| instalaciones | destapaciones-desagotes | Destapaciones y desagotes | Drain clearing & septic | Desentupimento e fossa | destapación, desagote, cloaca, pozo ciego, cámara séptica, atmosférico, caño tapado |
| instalaciones | electricidad | Electricidad | Electrical | Elétrica | electricista, luz, enchufe, tablero, corte, cableado |
| instalaciones | gas-instalacion | Instalación de gas | Gas installation | Instalação de gás | gasista, matriculado, estufa, calefón, pérdida de gas, cocina |
| instalaciones | climatizacion | Climatización | HVAC | Climatização | aire acondicionado, split, calefacción, frío, carga de gas |
| instalaciones | energia-solar | Energía solar y termotanques | Solar energy & water heaters | Energia solar e aquecedores | panel solar, termotanque, calefón solar, fotovoltaico |
| instalaciones | internet-tv | Internet / TV | Internet / TV | Internet / TV | wifi, fibra, antena, cable, router, satelital |
| instalaciones | seguridad-alarmas | Seguridad y alarmas | Security & alarms | Segurança e alarmes | alarma, cámara, cctv, monitoreo, cerradura inteligente |
| reparaciones-obra | mantenimiento-general | Mantenimiento general | General maintenance | Manutenção geral | arreglos, manitas, changas, reparaciones, todo terreno |
| reparaciones-obra | albanileria | Albañilería | Masonry | Alvenaria | albañil, revoque, pared, humedad, cerámica, contrapiso |
| reparaciones-obra | techista | Techista | Roofing | Telhados | techo, goteras, membrana, chapa, tejas, impermeabilización |
| reparaciones-obra | pintura | Pintura | Painting | Pintura | pintor, látex, esmalte, fachada, impermeabilizante |
| reparaciones-obra | herreria | Herrería | Ironwork | Serralheria | herrero, rejas, portón, soldadura, estructura metálica |
| reparaciones-obra | carpinteria | Carpintería | Carpentry | Carpintaria | carpintero, madera, muebles, puertas, placard, deck |
| reparaciones-obra | vidrieria | Vidriería | Glazier | Vidraçaria | vidrio, ventana, espejo, vidrio roto, mampara |
| reparaciones-obra | cerrajeria | Cerrajería | Locksmith | Chaveiro | cerrajero, llave, cerradura, puerta trabada, copia de llaves |
| reparaciones-obra | toldos-cortinas-persianas | Toldos, cortinas y persianas | Awnings, curtains & blinds | Toldos, cortinas e persianas | toldo, cortina, persiana, roller, black out |
| reparaciones-obra | tapiceria | Tapicería | Upholstery | Estofaria | tapicero, sillón, retapizado, colchón, almohadones |
| reparaciones-obra | service-electrodomesticos | Service de electrodomésticos | Appliance repair | Assistência de eletrodomésticos | heladera, lavarropas, microondas, cocina, técnico, service |
| limpieza-ropa-blanca | limpieza-domicilio | Limpieza a domicilio | Home cleaning | Limpeza residencial | limpieza, mucama, recambio, check out, final de obra |
| limpieza-ropa-blanca | lavadero-ropa | Lavadero de ropa | Laundry | Lavanderia | lavandería, sábanas, toallas, ropa blanca, lavado |
| limpieza-ropa-blanca | limpieza-tapizados | Limpieza de tapizados | Upholstery cleaning | Limpeza de estofados | tapizados, sillones, alfombras, colchones, lavado en seco |
| limpieza-ropa-blanca | blanqueria-equipamiento | Blanquería y equipamiento | Linens & supplies | Enxoval e equipamentos | blanquería, sábanas, toallas, vajilla, amenities, equipamiento |
| limpieza-ropa-blanca | control-plagas | Control de plagas | Pest control | Controle de pragas | fumigación, cucarachas, ratas, hormigas, mosquitos, termitas |
| exterior | piletas | Piletas | Pools | Piscinas | pileta, piscina, cloro, filtro, mantenimiento de pileta |
| exterior | parque-jardineria | Parque y jardinería | Garden & landscaping | Jardinagem | jardinero, pasto, poda, césped, desmalezado, riego |
| abastecimiento-traslados | gas-venta | Venta de gas | Gas supply | Venda de gás | garrafa, tubo, gas envasado, zeppelin |
| abastecimiento-traslados | fletes | Fletes | Moving / Freight | Fretes | flete, mudanza, traslado de muebles, camioneta |
| abastecimiento-traslados | remis | Remís | Taxi / car service | Táxi / transfer | remis, taxi, traslado, aeropuerto, terminal, chofer |

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A backfill shipped in the same release as the column drop moves zero rows (HOS-433) | High | Expand/contract across two releases, plus `meta.requiresColumns` |
| A new permission trips frozen guards in 3 packages | Medium | Re-count; do not bump by one. List the guards in the PR |
| N+1 queries when hydrating categories in lists | Medium | One batched query per page, plus an integration test asserting the query count |
| The marketing page caches a stale catalog | Low | Dedicated cache tag, purged on every catalog write |
| A stale `dist` of `@repo/schemas` makes new exports `undefined` in dependants | Medium | Build packages after merging staging, before running app tests |
| The base `where` map silently drops the `categories` filter | High | API test asserting the filter is applied (rows excluded), not just forwarded |

## 13. Suggested tasks (phased)

1. **setup**
   - schemas: catalog entities, refs, public catalog, and `categories`/`categoryIds`/`categorySlugs` on host-trade, alliance-lead and usage refs;
   - permissions enum plus guard re-count.
2. **core-db**
   - the 3 tables, `alliance_leads.category_slugs`, `host_trades.category` nullable, plus the generated migration;
   - models: the `EXISTS` predicate, batched hydration, and set replacement.
3. **core-seed**
   - baseline JSON for groups and categories;
   - `hostTrade/*.json` switched to `categorySlugs`;
   - the seed JSON-schema;
   - the data-migration (upsert, backfill, permission grants), with `requiresColumns`.
4. **core-services**
   - the catalog services and permissions;
   - the host-trade service filter, hydration and write validation;
   - provisioning;
   - lead create validation.
5. **api**
   - the public catalog route;
   - admin CRUD for groups and categories;
   - host-trade and alliance-lead route updates;
   - the cache tag and purge.
6. **web**
   - the `match-catalog-query` util;
   - `TradeCategoryMultiSelect`;
   - AllianceLead and the message builder;
   - TradesDirectory;
   - badges in the 5 views;
   - the marketing page;
   - the i18n cleanup.
7. **admin**
   - the catalog screens;
   - the host-trade form multi-select;
   - the columns;
   - the filters;
   - the i18n cleanup.
8. **testing**: the coverage in §10, plus guard updates.
9. **docs**
   - `packages/seed/CLAUDE.md`;
   - `apps/api/docs/route-architecture.md`;
   - a What's New entry candidate.
10. **contract (separate PR, next release)**
    - drop `host_trades.category`, its indexes, the pgEnum, `alliance_leads.category` and `HostTradeCategoryEnum`.

## Internal Review Notes

- Strengthened during review:
  - the explicit expand/contract split (HOS-433);
  - `onDelete: 'restrict'` backing the in-use rule at the DB level;
  - slug immutability, needed because leads store slugs;
  - the es fallback in search for non-es locales;
  - the max of 10 categories per provider;
  - the query-count assertion for hydration.
- Open for implementation:
  - the exact name of the business error code (`CATEGORY_IN_USE`) must not collide with an existing one; check the service error map;
  - whether `ENTITY_MULTISELECT` in admin supports a static-endpoint source without a custom loader (otherwise add a small loader, as `PoiCategorySelectField` does).
- External services: none.
