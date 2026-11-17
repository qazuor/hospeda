# HOS-919: Provider trade categories — admin-managed catalog, multi-category providers, grouped searchable selector

## Progress: 0/54 tasks (0%)

**Average Complexity:** 2.5/3 (max 3 per task)
**Critical Path:** T-001 -> T-004 -> T-005 -> T-008 -> T-009 -> T-010 -> T-018 -> T-019 -> T-020 -> T-027 -> T-033 -> T-036 -> T-039 -> T-040 -> T-042 -> T-049 -> T-050 -> T-053 -> T-054 (19 steps; 17 in release N, last 2 are release N+1)
**Parallel Tracks:** 6 identified (A schemas+permissions, B db+seed, C services+api, D web, E admin, F cache tag + search util)

> Release N = T-001..T-052 (one PR to staging). T-053 and T-054 (cleanup) are a SEPARATE PR in the NEXT release, only after N is deployed and the data-migration is ledgered applied (expand/contract, HOS-433).
> Never run `pnpm db:fresh-dev` in a worktree. Run only the changed test files locally; CI runs the full suites.

---

### Setup Phase

- [x] **T-001** (complexity: 3) - Create host-trade-category catalog entity schemas
  - Create packages/schemas/src/entities/host-trade-category/ following the poi-category files: host-tra...
  - Blocked by: none
  - Blocks: T-002, T-004

- [x] **T-002** (complexity: 3) - Update host-trade, alliance-lead and usage-ref schemas to multi-category
  - packages/schemas: in entities/host-trade/host-trade.schema.ts replace category with categories: Host...
  - Blocked by: T-001
  - Blocks: T-010, T-023, T-033

- [x] **T-003** (complexity: 2) - Add HOST_TRADE_CATEGORY_* permissions and re-count frozen guards
  - Add HOST_TRADE_CATEGORY_VIEW|CREATE|UPDATE|DELETE|RESTORE to PermissionEnum (packages/schemas/src/en...
  - Blocked by: none
  - Blocks: T-010, T-016, T-018, T-049

### Core Phase

- [x] **T-004** (complexity: 3) - Create host_trade_category_groups and host_trade_categories dbschemas
  - Create packages/db/src/schemas/host-trade/host-trade-category-group.dbschema.ts and host-trade-categ...
  - Blocked by: T-001
  - Blocks: T-005

- [x] **T-005** (complexity: 3) - Create r_host_trade_category join and alter host_trades and alliance_leads dbschemas
  - Create packages/db/src/schemas/host-trade/r_host_trade_category.dbschema.ts (host_trade_id FK -> hos...
  - Blocked by: T-004
  - Blocks: T-006, T-007, T-008

- [x] **T-006** (complexity: 2) - Generate and review structural migration (expand step)
  - Run pnpm db:generate to produce the versioned migration in packages/db/src/migrations/ (carril 1): c...
  - Blocked by: T-005
  - Blocks: T-010

- [x] **T-007** (complexity: 3) - Create HostTradeCategoryGroupModel and HostTradeCategoryModel
  - Create packages/db/src/models/hostTrade/host-trade-category-group.model.ts and host-trade-category.m...
  - Blocked by: T-005
  - Blocks: T-010, T-018, T-022, T-024

- [x] **T-008** (complexity: 3) - Add category EXISTS predicate, name ordering and batched hydration to HostTradeModel
  - Edit packages/db/src/models/hostTrade/host-trade.model.ts: (1) order the directory by name only (was...
  - Blocked by: T-005
  - Blocks: T-009, T-021

- [x] **T-009** (complexity: 3) - Add transactional replaceCategories to HostTradeModel
  - In packages/db/src/models/hostTrade/host-trade.model.ts add replaceCategories({hostTradeId, category...
  - Blocked by: T-008
  - Blocks: T-010, T-022, T-024

- [x] **T-010** (complexity: 1) - Rebuild packages after schema changes before running dependant tests
  - After merging staging into the worktree and finishing the schema/db changes, rebuild dist of the aff...
  - Blocked by: T-002, T-003, T-006, T-007, T-009
  - Blocks: T-012, T-018, T-021, T-024

- [x] **T-011** (complexity: 1) - Add CACHE_TAG_HOST_TRADE_CATEGORIES to @repo/cache-tags
  - Add the constant CACHE_TAG_HOST_TRADE_CATEGORIES to packages/cache-tags/src (follow the existing tag...
  - Blocked by: none
  - Blocks: T-027, T-028, T-029, T-041

- [x] **T-012** (complexity: 3) - Create seed baseline JSON for catalog groups and categories
  - Add packages/seed/src/data/hostTradeCategoryGroup/*.json (5 groups) and packages/seed/src/data/hostT...
  - Blocked by: T-010
  - Blocks: T-013, T-014

- [x] **T-013** (complexity: 3) - Switch hostTrade seed fixtures to categorySlugs and seed join rows
  - Edit packages/seed/src/data/hostTrade/*.json: replace category (enum) with categorySlugs: string[] u...
  - Blocked by: T-012
  - Blocks: T-017

- [x] **T-014** (complexity: 3) - Create seed data-migration step A: upsert catalog groups and categories
  - Run pnpm db:seed:make host-trade-category-catalog (carril 3) to create the numbered module in packag...
  - Blocked by: T-012
  - Blocks: T-015

- [x] **T-015** (complexity: 3) - Add backfill step B to the data-migration with meta.requiresColumns
  - In the same data-migration module (steps A and B are ONE migration so order is guaranteed): after th...
  - Blocked by: T-014
  - Blocks: T-016

- [x] **T-016** (complexity: 2) - Add permission grants for HOST_TRADE_CATEGORY_* (baseline and data-migration)
  - Dual-write: (1) baseline: grant the 5 new permissions to the admin roles in the role-permission seed...
  - Blocked by: T-015, T-003
  - Blocks: T-017

- [x] **T-017** (complexity: 2) - Verify seed dual-write guard and run the data-migration locally
  - Commit the baseline and the data-migration, then run scripts/check-seed-dual-write.sh against the CO...
  - Blocked by: T-013, T-016
  - Blocks: T-049, T-051

- [x] **T-018** (complexity: 3) - Create HostTradeCategoryGroupService with permissions and CATEGORY_IN_USE error
  - Create packages/service-core/src/services/host-trade-category/host-trade-category-group.service.ts e...
  - Blocked by: T-007, T-010, T-003
  - Blocks: T-019, T-028

- [x] **T-019** (complexity: 3) - Create HostTradeCategoryService with in-use delete semantics
  - Create packages/service-core/src/services/host-trade-category/host-trade-category.service.ts extendi...
  - Blocked by: T-018
  - Blocks: T-020, T-029

- [x] **T-020** (complexity: 2) - Implement getPublicCatalog() in the category services
  - Add getPublicCatalog() to packages/service-core/src/services/host-trade-category/ returning PublicHo...
  - Blocked by: T-019
  - Blocks: T-025, T-027

- [x] **T-021** (complexity: 3) - Update HostTradeService search, count and admin search for the categories filter
  - Edit packages/service-core/src/services/hostTrade/host-trade.service.ts (_executeSearch,_executeCou...
  - Blocked by: T-008, T-010
  - Blocks: T-022, T-026, T-031, T-048

- [x] **T-022** (complexity: 3) - Add categoryIds validation and atomic set replacement to HostTradeService create/update
  - Edit host-trade.service.ts create/update: with categoryIds validate every id exists and is not delet...
  - Blocked by: T-021, T-009, T-007
  - Blocks: T-031, T-048

- [x] **T-023** (complexity: 1) - Update HOST_TRADE_OWNER_FORBIDDEN_FIELDS for categoryIds
  - Edit packages/schemas/src/entities/host-trade/host-trade-managed-fields.ts: add categoryIds and remo...
  - Blocked by: T-002
  - Blocks: T-031

- [x] **T-024** (complexity: 3) - Update alliance-lead provisioning to resolve categorySlugs
  - Edit the alliance-lead provisioning (alliance-lead.provisioning.ts in packages/service-core/src/serv...
  - Blocked by: T-009, T-007, T-010
  - Blocks: T-032, T-048

- [x] **T-025** (complexity: 2) - Validate lead categorySlugs against the active catalog on create
  - In the alliance-lead create path of packages/service-core/src/services/allianceLead/ (service create...
  - Blocked by: T-020
  - Blocks: T-032

- [x] **T-026** (complexity: 2) - Hydrate categories in benefit-usage provider refs
  - Where HostTradeUsage provider refs are built (host-trade benefit usage service in packages/service-c...
  - Blocked by: T-021
  - Blocks: T-048

- [x] **T-034** (complexity: 2) - Create pure match-catalog-query search util
  - Create apps/web/src/lib/search/match-catalog-query.ts (RO-RO, JSDoc): normalizes via NFD, strips \p{...
  - Blocked by: none
  - Blocks: T-035

### Integration Phase

- [x] **T-027** (complexity: 2) - Add public GET /api/v1/public/host-trade-categories route with cache tag
  - Create apps/api/src/routes/host-trade-category/public/list.ts + index (createSimpleRoute/createOpenA...
  - Blocked by: T-020, T-011
  - Blocks: T-033

- [x] **T-028** (complexity: 3) - Add admin CRUD routes for host-trade-category-groups
  - Create apps/api/src/routes/host-trade-category-group/admin/ (list with page+pageSize, getById, creat...
  - Blocked by: T-018, T-011
  - Blocks: T-030

- [x] **T-029** (complexity: 3) - Add admin CRUD routes for host-trade-categories
  - Create apps/api/src/routes/host-trade-category/admin/ (list with filters groupId, lifecycleState, q ...
  - Blocked by: T-019, T-011
  - Blocks: T-030

- [x] **T-030** (complexity: 2) - Purge CACHE_TAG_HOST_TRADE_CATEGORIES on every admin catalog write
  - Wire the existing purge fan-out (find it with rg for how other admin writes purge cache tags in apps...
  - Blocked by: T-028, T-029
  - Blocks: T-049, T-051

- [x] **T-031** (complexity: 3) - Update host-trade protected and admin routes for categories and categoryIds
  - Edit the existing host-trade list routes (protected GET /api/v1/protected/host-trades and admin list...
  - Blocked by: T-021, T-022, T-023
  - Blocks: T-050

- [x] **T-032** (complexity: 2) - Update alliance-lead submit and approve routes for categorySlugs
  - Edit apps/api/src/routes/alliance/public/create-lead.ts to accept categorySlugs (service validates a...
  - Blocked by: T-024, T-025
  - Blocks: T-050

- [x] **T-033** (complexity: 1) - Rebuild packages before web and admin tests
  - Before running web/admin tests rebuild dist of @repo/schemas, @repo/cache-tags and @repo/i18n (and @...
  - Blocked by: T-002, T-027
  - Blocks: T-035, T-036, T-043, T-045

- [x] **T-035** (complexity: 3) - Create TradeCategoryMultiSelect.client.tsx grouped multi-select combobox
  - Create apps/web/src/components/form/TradeCategoryMultiSelect.client.tsx + TradeCategoryMultiSelect.m...
  - Blocked by: T-034, T-033
  - Blocks: T-037

- [x] **T-036** (complexity: 2) - Retype web endpoint responses and add getHostTradeCatalog()
  - Edit apps/web/src/lib/api/endpoints-protected.ts and endpoints-public.ts: retype the 3 host-trade re...
  - Blocked by: T-033
  - Blocks: T-037, T-038, T-039, T-041

- [x] **T-037** (complexity: 3) - Switch AllianceLead form and message builder to multiselect categorySlugs
  - Edit apps/web/src/components/alliance/AllianceLead.client.tsx and apps/web/src/lib/forms/...
  - Blocked by: T-035, T-036
  - Blocks: T-042

- [x] **T-038** (complexity: 3) - Update TradesDirectory.client.tsx to any-of multi-category filter
  - Edit apps/web/src/components/**/TradesDirectory.client.tsx (lines ~48-149): active filter becomes Re...
  - Blocked by: T-036
  - Blocks: T-042, T-050

- [x] **T-039** (complexity: 3) - Render category badges in TradeCard and BenefitUsageCard
  - Create apps/web/src/lib/trade-category-labels.ts (RO-RO helper: label = nameI18n[locale] ?? nameI18n...
  - Blocked by: T-036
  - Blocks: T-040, T-042

- [x] **T-040** (complexity: 3) - Render all category badges on edit form and mi-cuenta detail pages
  - Edit apps/web/src/components/account/HostTradeEditForm.client.tsx (~line 224, read-only badges, cate...
  - Blocked by: T-039
  - Blocks: T-042

- [x] **T-041** (complexity: 3) - Render marketing page chips from the public catalog at SSR
  - Edit apps/web/src/pages/[lang]/presentacion/proveedores/index.astro (hand-written 17 chips at ~227-2...
  - Blocked by: T-036, T-011
  - Blocks: T-042, T-049

- [x] **T-042** (complexity: 3) - Web i18n cleanup: remove host-trades.categories, update baseline and zod-keys inventory
  - packages/i18n: remove host-trades.categories.* from es, en and pt locale files (only after all web c...
  - Blocked by: T-037, T-038, T-039, T-040, T-041
  - Blocks: T-049

- [x] **T-043** (complexity: 3) - Create admin catalog route and groups table with dialogs
  - Create apps/admin/src/routes/_authed/content/host-trade-categories/ (index route, file-based routing...
  - Blocked by: T-033
  - Blocks: T-044, T-047

- [x] **T-044** (complexity: 3) - Add categories table with keywords editor to the admin catalog screen
  - In the same admin feature add the categories TanStack table (filters groupId, lifecycleState, q) and...
  - Blocked by: T-043
  - Blocks: T-047, T-050

- [x] **T-045** (complexity: 3) - Replace host-trade admin form category SELECT with catalog multi-select
  - Edit apps/admin/src/features/host-trades/config/sections/basic-info.consolidated.ts (lines ~61-77): ...
  - Blocked by: T-033
  - Blocks: T-046

- [x] **T-046** (complexity: 3) - Admin list: multi-badge cell and catalog-driven multi filter
  - Edit apps/admin/src/features/host-trades/config/host-trades.columns.ts (one badge per category) and ...
  - Blocked by: T-045
  - Blocks: T-047, T-050

- [x] **T-047** (complexity: 2) - Admin i18n cleanup: remove admin-filters.hostTradeCategory
  - packages/i18n: delete the admin-filters.hostTradeCategory block in es, en and pt (superseded by cata...
  - Blocked by: T-046, T-043, T-044
  - Blocks: T-049

### Testing Phase

- [ ] **T-048** (complexity: 3) - Write service-level DB integration tests for catalog and provider categories
  - Create packages/service-core/test/integration/host-trade-categories.integration.test.ts (isDbAvailab...
  - Blocked by: T-021, T-022, T-024, T-026
  - Blocks: none

- [ ] **T-049** (complexity: 2) - Run guards and frozen-count sweep before opening the PR
  - Run (targeted, not full-package suites): pnpm check:guards and each CI Guards step touched (check-se...
  - Blocked by: T-003, T-017, T-030, T-041, T-042, T-047
  - Blocks: T-050

- [ ] **T-050** (complexity: 1) - Apply status-needs-smoke-staging label and prepare smoke checklist
  - When the final PR for this spec is opened (PR body must follow the HOS-919 magic-word rules: only th...
  - Blocked by: T-049, T-031, T-032, T-038, T-044, T-046
  - Blocks: T-053

### Docs Phase

- [ ] **T-051** (complexity: 2) - Document catalog carril, endpoints and error code
  - Edit packages/seed/CLAUDE.md (new catalog entities, deterministic ids, data-migration with requiresC...
  - Blocked by: T-017, T-030
  - Blocks: T-052

- [ ] **T-052** (complexity: 1) - Draft What's New entry candidate in the PR description
  - Draft (do NOT commit to apps/api/src/data/whats-new/whats-new.ts, that is written at smoke sign-off ...
  - Blocked by: T-051
  - Blocks: T-053

### Cleanup (release N+1) Phase

- [ ] **T-053** (complexity: 3) - RELEASE N+1 ONLY: structural contract migration dropping legacy category columns
  - MUST be a SEPARATE PR in the NEXT release, only after release N (expand + data-migration) is deploye...
  - Blocked by: T-050, T-052
  - Blocks: T-054

- [ ] **T-054** (complexity: 2) - RELEASE N+1 ONLY: delete HostTradeCategoryEnum and its schema
  - In the same N+1 PR as the contract migration (or the follow-up commit of it): delete packages/schema...
  - Blocked by: T-053
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003, T-011, T-034
Level 1: T-002, T-004
Level 2: T-005, T-023
Level 3: T-006, T-007, T-008
Level 4: T-009
Level 5: T-010
Level 6: T-012, T-018, T-021, T-024
Level 7: T-013, T-014, T-019, T-022, T-026, T-028
Level 8: T-015, T-020, T-029, T-031, T-048
Level 9: T-016, T-025, T-027, T-030
Level 10: T-017, T-032, T-033
Level 11: T-035, T-036, T-043, T-045, T-051
Level 12: T-037, T-038, T-039, T-041, T-044, T-046, T-052
Level 13: T-040, T-047
Level 14: T-042
Level 15: T-049
Level 16: T-050
Level 17: T-053
Level 18: T-054

## Suggested Start

Begin with **T-001** (complexity: 3), the head of the critical path (unblocks T-002, T-004). In parallel start **T-003** (permissions + guard re-count), **T-011** (cache tag) and **T-034** (pure search util), none has dependencies.
