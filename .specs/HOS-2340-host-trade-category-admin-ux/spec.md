---
title: Provider trade category admin — restore deleted rows, keyword search in the selector, stable ordering
linear: HOS-2340
statusSource: linear
created: 2026-11-18
type: feature
smoke:
  - staging
areas:
  - admin
  - api
  - web
  - content
---

# Provider trade category admin — restore deleted rows, keyword search in the selector, stable ordering

## 1. Summary

HOS-919 shipped the admin-managed catalog of provider trade categories (groups and categories). Three
admin gaps remain, all observed on staging:

1. **Restore.** The API can restore a soft-deleted category or group, but the admin never shows deleted
   rows and has no restore button. A deleted row is unreachable from the UI.
2. **Keyword search.** The category selector on the provider form searches only the label, with
   `toLowerCase().includes()`: accents matter and the related words (`keywordsI18n`) are ignored, so
   «pozo» does not find *Destapaciones y desagotes* in the admin the way it does on the public form.
3. **Ordering.** The admin lists sort by `createdAt desc` by default, so seeded rows (all created in the
   same instant) come out in no meaningful order, and pagination is not stable. Observed on staging:
   Plomería (weight 10) listed after Vidriería.

### 1.1 Out of scope

| Item | Why |
|---|---|
| Hard delete of a category or group | Not exposed (HOS-919 §1.1) |
| Drag-and-drop reordering | Order stays editable through the `displayWeight` field |
| Changing the public web selector or its behaviour | Only its matcher is moved; behaviour must stay identical (AC-2.6) |
| Making the other client-mode selectors keyword-aware | They keep `includes()`; only options that carry `searchTerms` change (AC-2.4) |
| Raising `PAGE_SIZE` | Kept at 50 (D5) |
| Offering categories of an inactive group in the selector | Not part of this change |
| A restore flow for providers or partner types | Separate entities |

## 2. Current state (verified on this branch, 2026-11-18)

- Screen: `apps/admin/src/routes/_authed/content/host-trade-categories/index.tsx` renders `HostTradeCategoriesScreen.tsx`, with `HostTradeCategoriesSection.tsx` (`PAGE_SIZE = 50`, `GROUPS_PAGE_SIZE = 100`, `:42-43`) and `HostTradeCategoryGroupsSection.tsx` (`PAGE_SIZE = 100`, `:38`), a shared `CatalogTable.tsx`, `CatalogStateBadge.tsx` (active/inactive only) and `CatalogDeleteDialog.tsx`. Copy keys come from `lib/i18n-keys.ts` (`admin-pages.hostTradeCategories.*`).
- Hooks: `apps/admin/src/hooks/use-host-trade-categories.ts` has list/create/update/delete hooks and `hostTradeCategoryQueryKeys` (shared root `['host-trade-categories']`), but **no restore hook**, and `HostTradeCategoryFilters` has no `includeDeleted`.
- Restore API exists: `POST /api/v1/admin/host-trade-categories/:id/restore` (`apps/api/src/routes/host-trade-category/admin/restore.ts`) and the group twin, gated by `HOST_TRADE_CATEGORY_RESTORE`. `HostTradeCategoryService._beforeRestore` (`packages/service-core/src/services/host-trade-category/host-trade-category.service.ts`, `~:217`) refuses with a `VALIDATION_ERROR` naming `groupId` while the group is still soft-deleted.
- `AdminSearchBaseSchema` already accepts `includeDeleted` (`packages/schemas/src/common/admin-search.schema.ts`) and the base `adminList` honours it (`packages/service-core/src/base/base.crud.read.ts:553`, `~:582`). The UI never sends it.
- Ordering: `AdminSearchBaseSchema.sort` has a Zod **default** `'createdAt:desc'` (`admin-search.schema.ts:63-68`), so by the time the service sees params an omitted sort and an explicit `createdAt:desc` are indistinguishable. Both catalog services already override `adminList` and `_executeAdminSearch` to carry the raw search term through `hookState` (`ADMIN_SEARCH_TERM_KEY`, `host-trade-category.service.ts:~282-308`, `host-trade-category-group.service.ts:~181-210`); the base `_executeAdminSearch` delegates sorting to `model.findAll` with one `sortBy` column, which cannot order categories by their group's weight (a join).
- Selector: `apps/admin/src/features/host-trades/config/sections/basic-info.consolidated.ts:73-96` configures `ENTITY_MULTISELECT` with `searchMode: 'client'`, `loadAllFn: loadAllHostTradeCategories`, `showAllWhenEmpty`. `EntitySelectField.tsx:175-192` filters with `option.label.toLowerCase().includes(query.toLowerCase())`. `host-trade-category-api.utils.ts:51-55` (`toSelectOption`) builds `{ value, label, description }` only, although admin rows carry `keywordsI18n`. `SelectOption` already has `metadata?: Record<string, unknown>` (`field-config.types.ts:25-33`). Six other configs use `searchMode: 'client'` (amenities, features, POI categories, accommodations, posts relations, listing sections).
- The matcher: `apps/web/src/lib/search/match-catalog-query.ts` (pure TS; NFD diacritic folding, token-prefix on every query token, haystack = name + keywords in the current locale plus `es`, ranking name-first then keyword then catalog order). It takes the nested public catalog shape (`PublicHostTradeCatalog`) and is used by `apps/web/src/components/form/TradeCategoryMultiSelect.client.tsx:41,132`. Tests: `apps/web/test/lib/search/match-catalog-query.test.ts`.
- `@repo/utils` (`packages/utils/src/index.ts`) is browser-safe and aliased by admin; `packages/utils/test/barrel-server-only-exclusion.test.ts` guards that the barrel pulls no server-only module.

## 3. Decisions (approved by the owner on 2026-11-18)

| # | Decision |
|---|---|
| D1 | **Restore.** A «Mostrar borrados» toggle on both lists sends `includeDeleted=true`. Deleted rows appear mixed in with the others, carry a «Borrado» badge and a «Restaurar» button. New `useRestore` hooks invalidate both catalog query keys. The error «group is still deleted» is mapped to a clear message. |
| D2 | **Keyword search.** The matcher moves to `@repo/utils` as a **flat-item** matcher with its own minimal structural types (no `@repo/schemas` dependency). The web app keeps a thin adapter for the nested catalog, with behaviour unchanged and its tests still passing. `EntitySelectField` client mode accepts optional per-option `searchTerms` (carried in option metadata) and uses the shared matcher only when present; the default behaviour of the other client-mode selectors is unchanged. Category options include name and keywords in all locales. |
| D3 | **Ordering.** The categories admin list with no explicit sort orders by group display weight, category display weight, Spanish name, id (override of `_executeAdminSearch`). Groups order by display weight, name, id. The selector inherits the same order. |
| D4 | `PAGE_SIZE` stays at 50. |

### 3.1 Implementation choices inside the decisions

| Choice | Resolution | Reason |
|---|---|---|
| How a service knows "no explicit sort" | The existing `adminList` override reads the **raw** `params.sort` before validation and passes `hasExplicitSort` through `hookState`, next to `ADMIN_SEARCH_TERM_KEY` | The Zod default hides it afterwards (§2); this reuses the established pattern. Alternative: drop the default in the catalog admin-search schemas (`.optional()` override) and teach the base `parseAdminSort` to accept `undefined`: rejected, it touches the shared base for 2 entities |
| Where the join lives | A model method on `HostTradeCategoryModel` (`packages/db/src/models/hostTrade/host-trade-category.model.ts`), `findAdminPage`, that joins `host_trade_category_groups`, applies the `where`/extra conditions the base passes, honours `includeDeleted`, and orders as D3 | `model.findAll` takes one `sortBy` column |
| Explicit sort | Unchanged: when the caller sends `sort`, the base path runs as today | Keeps API behaviour for any existing consumer |
| Matcher locales | The shared matcher takes `locales: readonly Locale[]`. Web passes `[locale, 'es']` (as today); admin passes `['es', 'en', 'pt']` | Admin labels resolve `es → en → pt` (`apps/admin/src/utils/i18n-text.ts`), so an admin may type any language |

## 4. User stories and acceptance criteria

### US-1. An admin restores a deleted group or category

- **AC-1.1** Given the categories tab and the groups tab, when the page loads, then «Mostrar borrados» is **off** and no deleted row is listed (current behaviour).
- **AC-1.2** Given the toggle is turned on, then the list refetches with `includeDeleted=true`, page 1, and deleted rows appear **mixed in** with the rest in the normal order, each with a «Borrado» badge (text, not color only). The toggle state is per tab, kept while paging, reset to off on reload.
- **AC-1.3** Given a deleted row and an actor with `HOST_TRADE_CATEGORY_RESTORE`, then the row shows «Restaurar» and hides edit and delete. Given an actor without that permission, the button is not rendered (and the API would answer 403).
- **AC-1.4** Given the admin presses «Restaurar» on a deleted **group**, then `POST /api/v1/admin/host-trade-category-groups/:id/restore` is called, a success toast «Grupo restaurado» shows, the row loses the badge and returns to its sort position, and both the groups and categories lists refetch.
- **AC-1.5** Given the same on a deleted **category** whose group is active, then the category is restored with a toast «Categoría restaurada».
- **AC-1.6** Given a deleted category whose group is still deleted, when the admin presses «Restaurar», then the request is refused, nothing changes, and the toast reads «No se puede restaurar: el grupo de esta categoría está borrado. Restaurá primero el grupo.» (variant `error`). The button re-enables.
- **AC-1.7** Given any other restore failure (network, 5xx, 404 because another admin hard-changed the row), then a generic error toast «No se pudo restaurar» shows, the list refetches, and the button re-enables.
- **AC-1.8** Given a restore in flight, the row's button is disabled and shows «Restaurando...».
- **AC-1.9** Given the toggle is on and the admin deletes an active row, then the row stays visible with the «Borrado» badge after the refetch (it does not vanish).

### US-2. An admin finds a category by a related word when editing a provider

- **AC-2.1** Given the provider form's category selector, when the admin types `pozo`, then *Destapaciones y desagotes* is listed (its keywords include «pozo ciego»).
- **AC-2.2** Given the admin types `AIRE` or `aíre`, then *Climatización* is listed (accent and case insensitive).
- **AC-2.3** Given a multi-word query `pozo cie`, then every token must prefix some word of the haystack (all tokens must match). Given a query with no match, the existing empty state shows.
- **AC-2.4** Given a client-mode selector whose options carry no `searchTerms` (for example amenities, features, POI categories), then filtering behaves exactly as today (`label.toLowerCase().includes(query.toLowerCase())`), including for queries with accents.
- **AC-2.5** Given category options, then each option carries `metadata.searchTerms = { nameI18n, keywordsI18n }` built from the admin row, and the matcher searches name and keywords in `es`, `en` and `pt`. An English query (`plumbing`) finds *Plomería*.
- **AC-2.6** Given the public web selector (`TradeCategoryMultiSelect`), then its results and ordering are identical before and after the move (the existing `match-catalog-query.test.ts` passes unmodified).
- **AC-2.7** Ranking: an option whose **name** matches ranks before one that matches only through a **keyword**; within the same rank, the server order (D3) is kept.
- **AC-2.8** Given an empty query and `showAllWhenEmpty`, then all options show in the server order (unchanged).
- **AC-2.9** Given an inactive category the provider already has, it still resolves by id and shows its label (unchanged); inactive categories are not offered by search (unchanged, `loadAllHostTradeCategories` loads ACTIVE only).

### US-3. An admin sees catalogs in a predictable order

- **AC-3.1** Given the categories tab with no explicit sort, then rows are ordered by group `displayWeight` asc, category `displayWeight` asc, Spanish name asc (case- and accent-insensitive via `lower(unaccent(...))`), then `id` asc. On the staging seed, Plomería (weight 10) appears before Vidriería.
- **AC-3.2** Given the groups tab with no explicit sort, then rows are ordered by `displayWeight`, Spanish name, `id`.
- **AC-3.3** Given 60 categories and `pageSize=50`, then page 1 plus page 2 contain every row exactly once, with no duplicate and no gap, and repeating the requests returns the same order (stable, thanks to the `id` tie-break).
- **AC-3.4** Given a request with an explicit `sort` (for example `sort=slug:asc`), then it is honoured as today. An explicit `sort=createdAt:desc` is also honoured as sent.
- **AC-3.5** Given `search`, `groupId`, `lifecycleState` or `includeDeleted` filters, then the same ordering applies to the filtered rows and `pagination.total` counts the filtered rows.
- **AC-3.6** Given the provider form selector, then its options come in the AC-3.1 order (it inherits it from the list endpoint).
- **AC-3.7** Given the public catalog endpoint, its order is unchanged (it already orders by group weight, category weight and name).

## 5. Technical approach

### 5.1 Shared matcher (`packages/utils`)

- New `packages/utils/src/match-search-items.ts`, exported from `src/index.ts` (pure, no server-only imports, so `barrel-server-only-exclusion.test.ts` keeps passing). Minimal structural types, no `@repo/schemas`:
  - `SearchLocale = 'es' | 'en' | 'pt'`.
  - `SearchableTerms = { readonly nameI18n: Partial<Record<SearchLocale, string | null | undefined>>; readonly keywordsI18n?: Partial<Record<SearchLocale, readonly string[] | undefined>> }`.
  - `matchSearchItems<T>(input: { items: readonly T[]; query: string; locales: readonly SearchLocale[]; getTerms: (item: T) => SearchableTerms }): T[]` (RO-RO). Same algorithm as today: NFD, strip `\p{M}`, lowercase, collapse spaces; every query token must prefix a word; rank 0 name, rank 1 keyword; stable by original index; blank query returns the items unchanged; the input is never mutated.
  - Also export `normalizeSearchText`.
- `apps/web/src/lib/search/match-catalog-query.ts` becomes a thin adapter: for each group call `matchSearchItems` over `group.categories` with `locales = locale === 'es' ? ['es'] : [locale, 'es']`, drop groups with no match, keep the signature and types. `apps/web/test/lib/search/match-catalog-query.test.ts` is not edited.

### 5.2 Selector (`apps/admin`)

- `host-trade-category-api.utils.ts` `toSelectOption`: add `metadata: { searchTerms: { nameI18n: item.nameI18n, keywordsI18n: item.keywordsI18n } }`. `description: item.slug` stays.
- `EntitySelectField.tsx:175-192`: in client mode, an option with `metadata?.searchTerms` is filtered and ranked with `matchSearchItems` (`locales: ['es','en','pt']`); an option without it keeps the `includes()` predicate. Add a small exported type guard `getSearchTerms(option)` that validates the shape at runtime (metadata is `Record<string, unknown>`), so a malformed value falls back to `includes()` and never throws. When the filtered list contains ranked options, order them by rank, stable.
- A tiny type for the metadata key lives in `field-config.types.ts` (`SELECT_OPTION_SEARCH_TERMS_KEY = 'searchTerms'`), so producers and the consumer share one constant.

### 5.3 Ordering (`service-core` and `db`)

- `HostTradeCategoryService.adminList` (`host-trade-category.service.ts:~282`): compute `hasExplicitSort = typeof params.sort === 'string'` from the raw params and put it in `hookState`. `_executeAdminSearch` (`~:292`): when `!hasExplicitSort`, call `HostTradeCategoryModel.findAdminPage` with the assembled `where`, search condition and `includeDeleted`; otherwise delegate to `super`. Same shape for `HostTradeCategoryGroupService` (`~:181-210`), with a plain `ORDER BY display_weight, lower(name_i18n->>'es'), id` (no join, so it can use the generic model method with a custom order; add a model method if `findAll` cannot express a multi-key order).
- `findAdminPage` orders by `g.display_weight, lower(unaccent(g.name_i18n->>'es')), g.id, c.display_weight, lower(unaccent(c.name_i18n->>'es')), c.id`. `unaccent` is already used by the catalog search (`host-trade-category.search.ts:48`), so accents and case do not affect the order (the comparison itself still uses the DB collation). It selects only category columns (the join exists for ordering) and returns the same `{ items, total }` shape as `findAll`, so the service output is unchanged.
- No schema, migration, seed or API contract change.

### 5.4 Restore UI (`apps/admin`)

- `use-host-trade-categories.ts`: `includeDeleted?: boolean` on `HostTradeCategoryGroupFilters` (HOS-2339 needs the same filter; whichever change lands first adds it, the other reuses it); `useRestoreHostTradeCategoryGroup` and `useRestoreHostTradeCategory` (POST, `onSuccess` invalidates `hostTradeCategoryQueryKeys.all`). A helper `isGroupStillDeletedError(error)` identifies the refusal from `error.details.field === 'groupId'` (verify the shape `fetchApi` exposes on `ApiError`; fall back to a 400/422 status on the category restore route, which has no other business refusal).
- `HostTradeCategoriesSection.tsx` and `HostTradeCategoryGroupsSection.tsx`: a «Mostrar borrados» checkbox (labelled, keyboard operable), `includeDeleted` in the query, and a «Restaurar» row action guarded by `HOST_TRADE_CATEGORY_RESTORE`; deleted rows hide edit and delete.
- `CatalogStateBadge.tsx`: accept `deletedAt`; render «Borrado» (destructive/muted variant) when set, taking precedence over active/inactive.
- i18n (`packages/i18n/src/locales/{es,en,pt}/admin-pages.json`, under `hostTradeCategories`): `showDeleted`, `state.deleted`, `actions.restore`, `actions.restoring`, `groups.messages.restored`, `categories.messages.restored`, `categories.messages.restoreGroupDeleted`, `messages.restoreError`. Update the untranslated-Spanish baseline if its guard requires it.

## 6. Alternatives considered

| | Option | Why not |
|---|---|---|
| A | A separate «Papelera» tab for deleted rows | A second table and navigation for the same rows; the owner chose the inline toggle (D1) |
| B | Always show deleted rows with a badge | Clutters the default view for the 99% case |
| C | Keep the matcher in `apps/web` and copy it to admin | Two copies of the same algorithm drift (HOS-919 was written to avoid exactly that); `@repo/utils` already serves both apps |
| D | Put `@repo/schemas` types in the shared matcher | Adds a dependency edge utils does not have today; a structural type is enough (D2) |
| E | Make every client-mode selector use the new matcher | Changes behaviour of six unrelated selectors with no request; only opted-in options change (D2) |
| F | Sort in the browser | The list is paginated server-side (50); a client sort would only reorder one page |
| G | Add `?sort=weight` as a new explicit sort key | Pushes the default into every caller; D3 asks for a default |
| H | Drop the Zod default from `AdminSearchBaseSchema` | Shared by every admin list; much larger blast radius than reading the raw param (§3.1) |

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Moving the matcher changes web behaviour | The adapter delegates to the same algorithm; the existing web test file is the regression gate and is not edited; a utils test replays the same cases |
| R2 | Admin sends an explicit `sort` by default somewhere, hiding D3 | Grep admin callers of the two list endpoints for `sort`; AC-3.1 integration test runs through the real endpoint with no `sort` |
| R3 | Accents could distort the Spanish ordering | Mitigated: unaccent removes accents and case, the comparison still uses the DB collation; order by `lower(unaccent(name))`, the extension the catalog search already relies on; the AC-3.1 test includes accented names («Albañilería» before «Vidriería») |
| R4 | `metadata` is untyped (`Record<string, unknown>`) | Runtime type guard (§5.2); a malformed value falls back to `includes()` |
| R5 | `includeDeleted` with the join could expose deleted groups' categories oddly | The `findAdminPage` join is a LEFT/INNER on `group_id` without a `deleted_at` filter on the group; test covers a live category under a deleted group and the reverse |
| R6 | A concurrent restore and delete by two admins | Last write wins; AC-1.7 refetch shows the true state |
| R7 | Large `lifecycle`/deleted sets make the toggle slow | Catalog is ~30 rows; `PAGE_SIZE` unchanged |

## 8. Testing strategy

| AC | Level | Test |
|---|---|---|
| AC-1.1, 1.2, 1.9 | component (admin) | extend `__tests__/categories.test.tsx` and `groups.test.tsx`: toggle sends `includeDeleted=true`, deleted rows badged and in order, off by default, deleted row stays after delete |
| AC-1.3 | component (admin) | restore button hidden without `HOST_TRADE_CATEGORY_RESTORE`; edit/delete hidden on deleted rows |
| AC-1.4, 1.5, 1.8 | component (admin) | restore calls the right endpoint, toast, both query keys invalidated, disabled while pending |
| AC-1.6, 1.7 | component (admin) | `isGroupStillDeletedError` unit test; message mapping; generic error path |
| AC-2.1..2.3, 2.5, 2.7, 2.8 | unit (utils) | `packages/utils/test/match-search-items.test.ts`: accents, case, multi-token, empty, ranking, locales, no mutation (replay the web cases) |
| AC-2.4 | component (admin) | `EntitySelectField` with options lacking `searchTerms` still uses `includes()` (a query with an accent that `includes` would not match stays unmatched); malformed metadata falls back |
| AC-2.1, 2.2, 2.5, 2.9 | component (admin) | selector with category options built by `toSelectOption`: «pozo», «aíre», «plumbing»; update `host-trade-category-api.utils.test.ts` for the metadata |
| AC-2.6 | unit (web) | existing `match-catalog-query.test.ts`, unmodified, plus a test that the adapter calls the shared matcher |
| AC-3.1..3.5 | DB integration + service | `findAdminPage` and `adminList` over seeded rows: order, accents (R3), `id` tie-break, 60-row paging without duplicates or gaps, filters, `includeDeleted`, explicit sort passthrough (including explicit `createdAt:desc`) |
| AC-3.1, 3.4 | route | `apps/api/test/routes/host-trade-category/admin.test.ts`: assert on the service call params (`mock.calls`), not only the status code |
| AC-3.2 | service | groups ordering |
| AC-3.6, 3.7 | unit | selector loader preserves server order; public catalog order test unchanged |
| §5.1 | guard | `barrel-server-only-exclusion.test.ts` still passes |

Smoke (staging, label `status-needs-smoke-staging`): delete a test category, turn on «Mostrar borrados», restore it; delete a group with a deleted category and confirm the group-first message; on a provider form type «pozo» and «aíre»; open both lists and confirm Plomería precedes Vidriería and paging through 50+ rows repeats nothing.

## 9. Suggested tasks (phased)

**Phase 1, setup:** grep admin callers for explicit `sort` (R2).
**Phase 2, core (shared):** `match-search-items.ts` + utils tests; web adapter + confirm the web tests pass untouched.
**Phase 3, ordering:** `HostTradeCategoryModel.findAdminPage` + groups ordering; service `adminList`/`_executeAdminSearch` overrides with `hasExplicitSort`; DB integration and service tests.
**Phase 4, selector:** `toSelectOption` metadata; `EntitySelectField` shared-matcher branch with guard; component tests.
**Phase 5, restore UI:** hooks (`includeDeleted`, restore, error helper); `CatalogStateBadge`; section toggles and restore actions; i18n (es, en, pt); component tests.
**Phase 6, verification:** run tests and guards, staging smoke, sign-off comment.
