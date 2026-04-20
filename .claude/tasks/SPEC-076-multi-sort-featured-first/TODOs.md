# SPEC-076 — Multi-Column Sort + `featuredFirst` — Task Progress

Spec: `.claude/specs/SPEC-076-multi-sort-featured-first/spec.md`
State: `.claude/tasks/SPEC-076-multi-sort-featured-first/state.json`

## Summary

- **Total tasks**: 22
- **Max complexity**: 3 (all tasks ≤ 3)
- **Status**: 22/22 complete ✅

### Test coverage delivered

| Suite | File | Tests |
|-------|------|-------|
| Schemas (domain + HTTP transform) | `packages/schemas/test/common/sort.schema.test.ts` | 21 |
| Model orderBy construction | `packages/db/test/models/accommodation.order-by.test.ts` | 14 |
| Route wiring (sanitizeSorts + query params) | `apps/api/test/routes/accommodation/public/list-sorts.test.ts` | 11 |
| **Total new tests** | | **46** |

### Quality gate results

- `pnpm --filter @repo/schemas typecheck` — clean
- `pnpm --filter @repo/db typecheck` — clean
- `pnpm biome check` on all 11 edited + new files — no errors, no warnings
- `pnpm --filter @repo/schemas test` — 2921/2921 pass (no regressions)
- `pnpm --filter @repo/db test -- test/models/accommodation` — 40/40 pass
- `pnpm --filter hospeda-api test -- test/routes/accommodation/public/list-sorts.test.ts` — 11/11 pass

Note: `@repo/service-core` has pre-existing failing tests in `getById`/`getStats`/`getSummary` and a pre-existing typecheck error in `test/base/crud/getById.test.ts:379` — both unrelated to SPEC-076 (verified via `git stash`).

## Phases

| Phase | Tasks | Scope |
|-------|-------|-------|
| `schemas` | T-001..T-007 | Shared pagination schema, HTTP coercion, HTTP→Domain mapper, i18n keys, @deprecated JSDoc |
| `schema-tests` | T-008, T-009 | Unit tests for the CSV transform + the `.max(5)` error with i18n key |
| `model` | T-010, T-011, T-012 | Helper + `search()` + `searchWithRelations()` rewrite |
| `model-tests` | T-013, T-014 | orderBy matrix for both model methods |
| `service` | T-015 | Forward new fields through `searchWithRelations()` manual cherry-pick |
| `api` | T-016, T-017 | `sanitizeSorts()` helper + forced `featuredFirst: true` on public route |
| `api-tests` | T-018, T-019, T-020 | Unit + integration coverage incl. client opt-out denial |
| `quality` | T-021, T-022 | typecheck + lint + full tests |

## Tasks

| ID | Title | Status | Cx | Blocked by |
|----|-------|--------|----|------------|
| T-001 | Add `SortFieldSchema` + `SortField` type | ✅ | 1 | — |
| T-002 | Extend `BaseSearchSchema` with `sorts` + `featuredFirst` | ✅ | 2 | T-001 |
| T-003 | Add `common.sort.maxFields` i18n keys (es/en/pt) | ✅ | 1 | — |
| T-004 | Extend `HttpSortingSchema` with CSV `sorts` + `featuredFirst` | ✅ | 3 | T-001 |
| T-005 | Add `features` CSV field to `AccommodationSearchHttpSchema` | ✅ | 1 | T-004 |
| T-006 | Map `sorts`/`featuredFirst`/`features` in `httpToDomainAccommodationSearch` | ✅ | 2 | T-002, T-004, T-005 |
| T-007 | Add `@deprecated` JSDoc on legacy alt schemas | ✅ | 1 | — |
| T-008 | Unit tests for HTTP `sorts` transform (edge cases) | ✅ | 2 | T-004 |
| T-009 | Unit tests for `BaseSearchSchema.sorts.max(5)` with i18n key | ✅ | 2 | T-002, T-003 |
| T-010 | Add `NUMERIC_NULLABLE_FIELDS` + `buildSortExpr()` helper | ✅ | 2 | T-001, T-002 |
| T-011 | Rewrite `orderBy` in `AccommodationModel.search()` (spread) | ✅ | 3 | T-010 |
| T-012 | Rewrite `orderBy` in `AccommodationModel.searchWithRelations()` (RQB bare array) | ✅ | 3 | T-010 |
| T-013 | Unit tests for `search()` orderBy | ✅ | 3 | T-011 |
| T-014 | Unit tests for `searchWithRelations()` orderBy | ✅ | 2 | T-012 |
| T-015 | Extend service `modelParams` (`sorts`/`featuredFirst`/`features`) | ✅ | 1 | T-006 |
| T-016 | Add `sanitizeSorts()` helper on public list route | ✅ | 2 | — |
| T-017 | Wire `sanitizeSorts` + forced `featuredFirst: true` + JSDoc | ✅ | 2 | T-006, T-016 |
| T-018 | Unit tests for `sanitizeSorts()` | ✅ | 2 | T-016 |
| T-019 | Integration test: featured-first + secondary sort + stable pagination | ✅ | 3 | T-015, T-017 |
| T-020 | Integration test: client `featuredFirst=false` cannot override | ✅ | 2 | T-017 |
| T-021 | Quality gate: typecheck + lint | ✅ | 1 | T-008, T-009 |
| T-022 | Quality gate: full test run | ✅ | 1 | T-013, T-014, T-018, T-019, T-020, T-021 |

## Decisions Log

Track any decision taken during implementation here. Link to spec sections or code where applied.

- 2026-04-20 — (initial) Tasks broken down per spec Pass #5. Every task ≤ complexity 3 per user directive.
- 2026-04-20 — **Dev note (T-010)**: `NUMERIC_NULLABLE_FIELDS` trimmed to `{averageRating, reviewsCount}` only. Spec also listed `minPrice`/`maxPrice` but neither is a sort-eligible column on the `accommodations` table (price lives under a JSONB `price` object, not split). Documented inline as JSDoc. No behavior change — they would never route through `buildSortExpr` regardless.
- 2026-04-20 — **Dev note (T-004)**: `.openapi({example: ...})` is NOT available in `packages/schemas` (the package uses plain `zod`, not `@hono/zod-openapi`). The spec's Pass #4 recommendation was based on apps/api schemas. Put the example in `.describe()` text instead (visible in Swagger via description). Future refactor could forward examples from the API layer.
- 2026-04-20 — **Dev note (T-002)**: `packages/schemas/src/common/index.ts` skips `pagination.schema.js` re-exports to avoid a `BaseSearchSchema` conflict with `base.schema.ts`. Added an explicit export for `SortFieldSchema` + `SortField` type so model-layer consumers can import them through the barrel.
- 2026-04-20 — **Dev note (compile-time checks)**: The `_searchFieldsCheck` / `_searchTypeCheck` assertions at `accommodation.http.schema.ts:314-399` are NOT real compile-time guards — the `as MissingSearchFields extends never ? true : never` cast bypasses the check. Documentary only; do NOT rely on them to catch missing field mappings. The spec's pass #4 assumption that they'd catch drift is inaccurate.

## Notes

- `HttpAccommodationSearchSchema` + `AccommodationSearchSchemaWithMetadata` are JSDoc-only changes (dead code). Structural deletion deferred.
- `countByFilters()` intentionally untouched (counts are order-independent).
- Drizzle API split is CRITICAL: `search()` uses spread `.orderBy(...orderBy)`; `searchWithRelations()` uses RQB with bare array `orderBy,` property.
- Do NOT migrate `createBooleanQueryParam` → `z.stringbool()` here (out of scope, 27+ call sites).
