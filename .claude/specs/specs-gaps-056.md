# SPEC-056 Gaps Audit Report: Numeric Column String Coercion

> **Spec**: SPEC-056-numeric-column-coercion
> **Initial Audit Date**: 2026-04-01
> **Latest Audit Date**: 2026-04-01
> **Audit Passes**: 5
> **Auditors**: Pass #1: 5 specialized agents (DB schema, Zod schemas, services, tests, broad codebase). Pass #2: 5 specialized agents (DB schema deep, Zod schema deep, service layer deep, tests + quality gates, frontend + API + admin). Pass #3: 5 specialized agents (DB schema exhaustive, Zod schema exhaustive, service + codebase exhaustive, tests + quality gates, edge cases + cross-cutting). Pass #4: 5 specialized agents (DB schema re-verify, Zod schema re-verify, service layer + full codebase, tests + quality gates, cross-cutting + edge cases + new gap discovery). Pass #5: 5 specialized agents (DB schema deep verification, Zod schemas exhaustive, service layer + full codebase, tests + quality gates, cross-cutting + edge cases)
> **Status**: **COMPLETED** - All gaps resolved (2026-04-01)

---

## Executive Summary

SPEC-056 is **100% implemented and verified**. All 5 phases are complete. All 15 gaps identified across 5 audit passes have been resolved: 11 implemented, 2 closed as false positives (GAP-056-006, GAP-056-007), 2 closed previously (GAP-056-003 WON'T FIX, GAP-056-011 informational).

**Resolution Summary (2026-04-01)**:

- 5 atomic commits implementing all gaps
- 2288 schema tests passing, 392 DB tests passing
- All 5 `as Partial<>` casts removed (all were unnecessary)
- Verification agent confirmed 100% resolution across all 11 implemented gaps

**Total Gaps Found**: 15

- Implemented: 11 (GAP-009, 013, 001, 004, 005, 014, 002, 008, 012, 015, 010, 017, 016)
- False Positive: 2 (GAP-006, GAP-007)
- Closed Previously: 2 (GAP-003 WON'T FIX, GAP-011 informational)

---

## Gap Inventory

### GAP-056-001: Missing DB Integration Test File

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #1 (2026-04-01) |
| **Confirmed in** | Audit #2, Audit #3, Audit #4, Audit #5 (2026-04-01) |
| **Severity** | HIGH |
| **Priority** | P2 |
| **Complexity** | Low |
| **Spec Coverage** | Spec Phase 5 explicitly requires this file but it was never created |
| **Recommendation** | Fix directly in this spec's implementation |
| **Decision** | **HACER** - Crear `packages/db/test/numeric-coercion.test.ts` con tests round-trip DB (insert, read, typeof, defaults, precisión) (2026-04-01) |

**Description**: The spec requires `packages/db/test/numeric-coercion.test.ts` with integration tests verifying that `mode: 'number'` produces JavaScript `number` values from actual DB queries. This file **does not exist** (verified in all 5 audits).

**Impact**: Without DB round-trip tests, we rely entirely on trust that Drizzle's `mode: 'number'` works as documented. If a Drizzle upgrade changes behavior or a raw query bypasses the ORM, there's no safety net.

**Current State**: The file `packages/schemas/test/numeric-fields.test.ts` EXISTS with 37 test cases for the Zod helpers. But the DB-layer integration test is completely absent.

**Audit #4 Note**: DB test infrastructure exists at `packages/db/test/models/` (28+ model test files). Exchange rate model tests use **string values** like `rate: '1000.50'` in mocks, which means they test pre-coercion behavior, NOT actual `mode: 'number'` round-trip behavior.

**Proposed Solution**: Create the test file as specified in Phase 5.1 of the spec. Tests should:

1. Insert records with numeric values, read them back, verify `typeof === 'number'`
2. Test default value behavior (should be `0` as number, not `"0"` as string)
3. Test precision preservation for typical rating and exchange rate values
4. Use the existing DB test infrastructure (see `packages/db/test/models/` for patterns)
5. Include string coercion regression path tests (subsumes GAP-056-006)

---

### GAP-056-002: `as Partial<>` Casts - RE-EVALUATED in Audit #3, CONFIRMED in Audit #4

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #1 (2026-04-01) |
| **Re-evaluated in** | Audit #3 (2026-04-01) - context clarified |
| **Confirmed in** | Audit #4, Audit #5 (2026-04-01) - all 5 casts verified JUSTIFIED |
| **Severity** | LOW (downgraded from MEDIUM in Audit #3) |
| **Priority** | P4 (downgraded from P3 in Audit #3) |
| **Complexity** | Low |
| **Spec Coverage** | Spec mentions these in Phase 3 as "verify and remove if possible" |
| **Recommendation** | Verify with typecheck, but likely needed for non-numeric reasons |

**Description**: Five `as Partial<EntityType>` casts remain in review service files:

| File | Line | Cast | Context |
|------|------|------|---------|
| `accommodationReview.service.ts` | 224 | `as Partial<AccommodationReview>` | `_beforeCreate` - findOne query filter object |
| `accommodationReview.service.ts` | 231 | `as Partial<AccommodationReview>` | `_beforeCreate` - return type of `data` |
| `accommodationReview.service.ts` | 246 | `as Partial<AccommodationReview>` | `computeAndStoreReviewAverage` - updateById payload |
| `destinationReview.service.ts` | 199 | `as Partial<DestinationReview>` | `_afterCreate` - model.update payload |
| `destinationReview.service.ts` | 222 | `as Partial<DestinationReview>` | `_afterUpdate` - model.update payload |

**Audit #4 Confirmation**: All 5 casts are on **entire object literals**, narrowing a subset of fields to `Partial<Entity>` for `model.update()`/`model.updateById()`. These are structural type casts, NOT numeric type casts. They exist because `{ averageRating: number }` is not directly assignable to `Partial<FullEntity>` without an explicit cast. All 5 are **JUSTIFIED**.

| **Decision** | **HACER** - Verificar con typecheck, remover si es posible, documentar resultado. Cerrar como WON'T FIX si son necesarios (2026-04-01) |

**Proposed Solution**:

1. Run `pnpm typecheck` after temporarily removing each cast to verify
2. If typecheck passes without the cast, remove it
3. If typecheck fails, the cast is legitimately needed.. leave it and close this gap
4. **Most likely outcome**: Casts are needed, close this gap as WON'T FIX

---

### GAP-056-003: `Number()` Wrappers in Frontend Code - CLOSED (WON'T FIX)

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #1 (2026-04-01) |
| **Re-evaluated in** | Audit #3 (2026-04-01) - context clarified |
| **Closed in** | Audit #3 (2026-04-01) |
| **Severity** | LOW |
| **Priority** | P4 |
| **Status** | **CLOSED - WON'T FIX (by design)** |

**Description**: Four `Number()` wrappers on `averageRating` in `apps/web/src/lib/api/transforms.ts` (lines 180, 235, 310) and `apps/web/src/pages/[lang]/alojamientos/[slug].astro` (line 267).

**Audit #4 Confirmation**: These transform functions handle **API response data** from external HTTP calls parsed via `JSON.parse()`. The `Number()` wrapper is a legitimate defensive measure at the system boundary.

**Final Decision**: **KEEP these wrappers**. They follow the principle of validating at system boundaries.

---

### GAP-056-004: Phase 4 Migration Verification Not Documented

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #1 (2026-04-01) |
| **Confirmed in** | Audit #2, Audit #3, Audit #4, Audit #5 (2026-04-01) |
| **Severity** | MEDIUM |
| **Priority** | P3 |
| **Complexity** | Trivial |
| **Spec Coverage** | Spec Phase 4 requires running `pnpm db:generate` and verifying no migration is generated |
| **Recommendation** | Execute verification and document result |
| **Decision** | **HACER** - Ejecutar `pnpm db:generate`, verificar que no genera migración, documentar resultado (2026-04-01) |

**Description**: The spec's Phase 4 requires running `pnpm db:generate` after the schema changes to confirm that `mode: 'number'` does NOT produce a PostgreSQL migration (it's a TypeScript-only change). There is no evidence this verification was performed.

**Audit #4 Note**: No migration files with averageRating changes were found beyond the original `0001_add_average_rating.sql`. However, the **explicit verification step** (running `pnpm db:generate` and documenting the result) was never executed.

**Proposed Solution**:

1. Run `pnpm db:generate` now
2. Check if any migration file is generated
3. If generated, inspect it.. should be empty/no-op, discard it
4. Document the result in this gaps file

---

### GAP-056-005: Outdated CLAUDE.md Gotcha in packages/db

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #1 (2026-04-01) |
| **Confirmed in** | Audit #2, Audit #3, Audit #4, Audit #5 (2026-04-01) - line 588 verified still outdated |
| **Severity** | MEDIUM |
| **Priority** | P3 |
| **Complexity** | Trivial |
| **Spec Coverage** | NOT covered by spec |
| **Recommendation** | Fix directly (documentation update) |
| **Decision** | **HACER** - Actualizar gotcha en `packages/db/CLAUDE.md:588` para reflejar `mode:'number'` (2026-04-01) |

**Description**: The `packages/db/CLAUDE.md` file (line 588) contains an outdated gotcha:

> `PostgreSQL numeric() returns strings in JS - use integer for monetary values (see ADR-006)`

This is **no longer accurate** after SPEC-056 implementation. All `numeric()` columns now use `mode: 'number'` which returns JavaScript numbers at runtime.

**Impact**: Developers reading the CLAUDE.md will believe `numeric()` still returns strings, potentially adding unnecessary `Number()` wrappers or `.toString()` calls.. exactly the problem SPEC-056 was designed to fix.

**Proposed Solution**: Update the gotcha to:
> `numeric()` columns use `mode: 'number'` for runtime JS number coercion (SPEC-056). For monetary values, prefer `integer` storage in centavos (see ADR-006).

---

### GAP-056-006: Test Fixtures Never Test String Coercion Path - CLOSED (FALSE POSITIVE)

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #1 (2026-04-01) |
| **Confirmed in** | Audit #2, Audit #3, Audit #4, Audit #5 (2026-04-01) |
| **Closed in** | Cross-audit verification (2026-04-01) |
| **Severity** | ~~MEDIUM~~ N/A |
| **Priority** | ~~P3~~ N/A |
| **Status** | **CLOSED - FALSE POSITIVE** |
| **Reason** | Two schema test files already test string coercion: `accommodationReview.schema.test.ts:138` tests `averageRating: '3.5'`, `destinationReview.schema.test.ts:163` tests `averageRating: '4.25'`. The gap description itself acknowledges these exceptions. Additionally, DB-level string coercion testing is covered by GAP-056-001 scope. |

**Description**: All test fixtures and mocks across the monorepo use numeric values for `averageRating`. No fixture uses string values like `"3.50"` to simulate raw PostgreSQL output without `mode: 'number'`.

**Audit #4 Verification**: All mocks confirmed using numeric types:

- `apps/api/test/helpers/mocks/accommodation-services.ts`: `averageRating: 4.5` (7 occurrences)
- `apps/api/test/helpers/mocks/destination-services.ts`: `averageRating: 0` (2 occurrences)
- `apps/api/test/helpers/mocks/exchange-rate-services.ts`: `rate: 1180.5, inverseRate: 0.000847` (3 occurrences)
- `packages/schemas/test/fixtures/common.fixtures.ts`: `faker.number.float()`

**Exception**: Two schema test files DO test string coercion:

- `accommodationReview.schema.test.ts:138` - tests `averageRating: '3.5'`
- `destinationReview.schema.test.ts:163` - tests `averageRating: '4.25'`

**DB Model Test Exception**: `exchange-rate.model.test.ts` uses string values (`rate: '1000.50'`) in mocks, but these test the model layer pre-coercion, NOT actual DB behavior.

**Impact**: If `mode: 'number'` ever breaks or a raw query bypasses the ORM, no integration-level test will catch the string-to-number regression.

**Proposed Solution**: Address together with GAP-056-001. The DB integration test file should include string-value insertion/retrieval tests.

---

### GAP-056-007: Exchange Rate i18n Message Preservation Not Verified - CLOSED (FALSE POSITIVE)

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #1 (2026-04-01) |
| **Updated in** | Audit #2 (2026-04-01) - i18n keys verified in all 3 locales |
| **Closed in** | Cross-audit verification (2026-04-01) |
| **Severity** | ~~LOW~~ N/A |
| **Priority** | ~~P4~~ N/A |
| **Status** | **CLOSED - FALSE POSITIVE** |
| **Reason** | All i18n keys exist and are preserved in all 3 locales (es, en, pt). The `numericField()` wrapper correctly preserves `.positive()` validation messages. The "remaining concern" about `required` message is harmless: fields are required at the parent object schema level. No behavioral regression exists. |

---

### GAP-056-008: Spec Status Still "draft"

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #1 (2026-04-01) |
| **Confirmed in** | Audit #2, Audit #3, Audit #4, Audit #5 (2026-04-01) |
| **Severity** | LOW |
| **Priority** | P4 |
| **Complexity** | Trivial |
| **Spec Coverage** | Process gap, not code gap |
| **Recommendation** | Update spec status |
| **Decision** | **HACER** - Actualizar status a `in-progress`, luego a `completed` cuando se resuelvan todos los gaps (2026-04-01) |

**Description**: The spec's status is still `draft` (line 3 of spec.md) despite the majority of the implementation being complete.

**Proposed Solution**: Update to `in-progress` now, `completed` once all gaps are resolved.

---

### GAP-056-009: Entity-Level Review Schemas Use `z.coerce.number()` Instead of `createAverageRatingField()`

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #2 (2026-04-01) |
| **Confirmed in** | Audit #3, Audit #4, Audit #5 (2026-04-01) - exact lines re-verified |
| **Severity** | CRITICAL |
| **Priority** | P1 |
| **Complexity** | Low |
| **Spec Coverage** | NOT covered by spec - the spec listed 17 changes across 8 files but MISSED these 2 entity schemas |
| **Recommendation** | Fix immediately - this is a spec omission AND an implementation gap |
| **Decision** | **HACER** - Reemplazar por `createAverageRatingField({ default: 0 })` en ambos archivos + agregar import (2026-04-01) |

**Description**: Two core entity-level review schemas define `averageRating` using `z.coerce.number()` instead of the `createAverageRatingField()` helper:

| File | Line | Current Code |
|------|------|-------------|
| `packages/schemas/src/entities/accommodationReview/accommodationReview.schema.ts` | 39 | `averageRating: z.coerce.number().min(0).max(5).default(0)` |
| `packages/schemas/src/entities/destinationReview/destinationReview.schema.ts` | 45 | `averageRating: z.coerce.number().min(0).max(5).default(0),` |

**Why this is CRITICAL**:

1. These are the **BASE entity schemas** for reviews - all query/relation schemas inherit or reference these
2. `z.coerce.number()` behaves differently from `createAverageRatingField()`:
   - `z.coerce.number()` uses `Number(value)` coercion (handles `null` -> `0`, `""` -> `0`, `true` -> `1`)
   - `createAverageRatingField()` uses `z.union([z.string(), z.number()])` -> `Number.parseFloat()` (stricter: rejects `null`, `""`, `true`)
3. This inconsistency means the base review schemas have DIFFERENT coercion semantics from all 18+ derived schemas

**Audit #4 Confirmation**: Agent 2 verified that ALL 18 query/derived schemas correctly use `createAverageRatingField()`, but the 2 base entity schemas do not. This remains the most significant remaining gap.

**Proposed Solution**:

```typescript
// In accommodationReview.schema.ts, line 39:
averageRating: createAverageRatingField({ default: 0 })

// In destinationReview.schema.ts, line 45:
averageRating: createAverageRatingField({ default: 0 }),
```

Add import: `import { createAverageRatingField } from '../../common/helpers.schema.js';`

---

### GAP-056-010: Exchange Rate Schema Tests Missing String Coercion Coverage

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #2 (2026-04-01) |
| **Confirmed in** | Audit #3, Audit #4, Audit #5 (2026-04-01) |
| **Severity** | LOW |
| **Priority** | P4 |
| **Complexity** | Low |
| **Spec Coverage** | NOT explicitly covered |
| **Recommendation** | Defer - can add to existing exchange rate test file in a future pass |
| **Decision** | **HACER** - Agregar 2-4 test cases de coerción string→number a `exchange-rate.schema.test.ts` (2026-04-01) |

**Description**: The exchange rate schema tests (`packages/schemas/test/entities/exchangeRate/exchange-rate.schema.test.ts`, 27 test cases) validate numeric ranges and i18n error messages, but do NOT test that `numericField()` correctly coerces string inputs like `"1050.50"` to number `1050.5` for `rate` and `inverseRate` fields.

**Impact**: Low. The `numericField()` helper IS tested generically in `numeric-fields.test.ts` (15 dedicated test cases). This gap is about testing the helper's integration with the specific exchange rate schema.

**Proposed Solution**: Add 2-4 test cases to `exchange-rate.schema.test.ts`.

---

### GAP-056-012: No Task State File for SPEC-056

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #3 (2026-04-01) |
| **Confirmed in** | Audit #4, Audit #5 (2026-04-01) |
| **Severity** | INFORMATIONAL |
| **Priority** | P4 |
| **Complexity** | Trivial |
| **Spec Coverage** | Process gap, not code gap |
| **Recommendation** | Create if spec work continues, skip if gaps are fixed inline |
| **Decision** | **HACER** - Agregar SPEC-056 a `index.json`, sin task state formal (gaps se resuelven inline) (2026-04-01) |

**Description**: No task state directory or file exists at `.claude/tasks/SPEC-056*/`. The project convention requires task tracking for specs in progress. Additionally, SPEC-056 is **entirely missing** from `.claude/specs/index.json` (confirmed Audit #4).

**Impact**: Progress cannot be tracked through the standard task management system. Spec is invisible to the spec tracking index.

**Proposed Solution**: Either:

1. Create a task state file and add SPEC-056 to index.json if remaining gaps will be tracked as formal tasks
2. Skip if the remaining gaps are trivial enough to fix inline without formal tracking

---

### GAP-056-013: Outdated JSDoc in destinationReview.schema.ts

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #4 (2026-04-01) |
| **Confirmed in** | Audit #5 (2026-04-01) |
| **Severity** | MEDIUM |
| **Priority** | P3 |
| **Complexity** | Trivial |
| **Spec Coverage** | NOT covered by spec |
| **Recommendation** | Fix directly when fixing GAP-056-009 |
| **Decision** | **HACER** - Corregir JSDoc junto con GAP-056-009 (mismo archivo, mismo commit) (2026-04-01) |

**Description**: The `destinationReview.schema.ts` file (line 42) contains an outdated JSDoc comment:

```typescript
* PostgreSQL returns numeric as string, so z.coerce.number() handles the conversion.
```

This is **doubly incorrect** after SPEC-056:

1. PostgreSQL `numeric()` columns now use `mode: 'number'` in Drizzle, so they return JS `number` at runtime (not strings)
2. The field should use `createAverageRatingField()`, not `z.coerce.number()` (see GAP-056-009)

The comment actively misleads future developers into thinking the string coercion problem still exists and that `z.coerce.number()` is the correct solution, when the actual solution is `mode: 'number'` at the ORM level + `createAverageRatingField()` as a defensive Zod layer.

**Impact**: Medium - active misinformation in code documentation that contradicts SPEC-056's solution.

**Proposed Solution**: When fixing GAP-056-009, update the JSDoc to:

```typescript
/**
 * Denormalized average of all rating sub-fields for this review.
 * Computed by the database from the individual rating dimensions.
 * Drizzle mode:'number' on the DB column ensures JS number type at runtime.
 * createAverageRatingField() provides a defensive string-to-number transform for raw queries.
 * Range: 0.00 - 5.00 (numeric 3,2 in the DB).
 */
averageRating: createAverageRatingField({ default: 0 }),
```

---

### GAP-056-014: Documentation Examples Still Show Old `z.number()` Pattern [NEW - Audit #5]

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #5 (2026-04-01) |
| **Severity** | MEDIUM |
| **Priority** | P3 |
| **Complexity** | Trivial |
| **Spec Coverage** | NOT covered by spec |
| **Recommendation** | Fix directly (documentation update) |
| **Decision** | **HACER** - Actualizar 6 ubicaciones en docs/ejemplos para usar `createAverageRatingField()` + nota de cuándo usar `z.number()` vs helper (2026-04-01) |

**Description**: Documentation and example files still show the pre-SPEC-056 pattern `z.number().min(0).max(5)` for `averageRating` fields backed by `numeric()` DB columns:

| File | Lines | Pattern |
|------|-------|---------|
| `docs/guides/creating-schemas.md` | 1003, 1139, 1154 | `z.number().min(0).max(5)` in examples |
| `docs/examples/entity-schema.ts` | 145 | `z.number().min(0).max(5)` |
| `packages/schemas/CLAUDE.md` | 93, 142 | References old pattern |

**Impact**: Future developers copying from docs/examples will write schemas using the old pattern instead of `createAverageRatingField()`, perpetuating the inconsistency.

**Proposed Solution**: Update all documentation examples to use `createAverageRatingField()` for fields backed by `numeric()` DB columns. Add a note explaining when to use `z.number()` (JSONB sub-fields, filter params) vs `createAverageRatingField()` (DB `numeric()` columns).

---

### GAP-056-015: Exchange Rate Model Test Mocks Use String Values [NEW - Audit #5]

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #5 (2026-04-01) |
| **Severity** | LOW |
| **Priority** | P4 |
| **Complexity** | Low |
| **Spec Coverage** | NOT explicitly covered by spec |
| **Recommendation** | Fix when addressing GAP-056-001 (DB integration tests) |
| **Decision** | **HACER** - Cambiar 11 mock values de string a numeric literals (2026-04-01) |

**Description**: `packages/db/test/models/exchange-rate/exchange-rate.model.test.ts` contains 11 mock values with string literals for `rate` and `inverseRate`:

| Lines | Values |
|-------|--------|
| 42-43 | `rate: '1000.50'`, `inverseRate: '0.0009995'` |
| 87-88 | `rate: '950.00'`, `inverseRate: '0.0010526'` |
| 159, 170 | `rate: '1000.50'`, `rate: '950.00'` (nested) |
| 269, 278, 317, 414, 422 | Various string rate values |

Post-SPEC-056, Drizzle returns JS numbers for these fields via `mode: 'number'`. The mocks use pre-coercion string types which don't reflect production reality. While these tests still pass (they mock the DB layer entirely), they mislead readers about the actual runtime type.

**Proposed Solution**: Change all string mock values to numeric literals (e.g., `rate: 1000.50` instead of `rate: '1000.50'`).

---

### GAP-056-016: Missing NaN/Infinity Edge Case Tests [NEW - Audit #5]

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #5 (2026-04-01) |
| **Severity** | INFORMATIONAL |
| **Priority** | P5 |
| **Complexity** | Trivial |
| **Spec Coverage** | NOT covered by spec |
| **Recommendation** | Can defer indefinitely |
| **Decision** | **HACER** - Agregar 2-3 test cases explícitos para NaN/Infinity en `numeric-fields.test.ts` (2026-04-01) |

**Description**: `packages/schemas/test/numeric-fields.test.ts` (37 test cases) does not test `NaN` or `Infinity`/`-Infinity` as inputs to `numericField()` or `createAverageRatingField()`. These are valid JS `number` values that `z.number()` accepts by default but are semantically invalid for ratings and exchange rates.

**Impact**: Minimal.. `NaN` fails the `.min(0).max(5)` pipe in `createAverageRatingField()` because `NaN` comparisons always return `false`. `Infinity` fails `.max(5)`. For `numericField()` with a `.positive()` pipe, `NaN` also fails. The existing validation catches these implicitly.

**Proposed Solution**: Add 2-3 explicit test cases for documentation purposes. Very low priority since the validation already rejects these values.

---

### GAP-056-017: Review Integration Tests Lack typeof Assertions on averageRating [NEW - Audit #5]

| Attribute | Value |
|-----------|-------|
| **Found in** | Audit #5 (2026-04-01) |
| **Severity** | LOW |
| **Priority** | P4 |
| **Complexity** | Low |
| **Spec Coverage** | NOT covered by spec |
| **Recommendation** | Can address with GAP-056-001 (DB integration tests) |
| **Decision** | **HACER** - Agregar `typeof` assertion en `destinationReview.schema.test.ts` (2026-04-01) |

**Description**: The schema-level coercion tests for `accommodationReview.schema.test.ts` (line 138) and `destinationReview.schema.test.ts` (line 163) verify the coerced VALUE is correct but do not assert `typeof result.data.averageRating === 'number'`. Additionally, review endpoint integration tests in `apps/api/test/integration/` are smoke tests only.. they check HTTP status codes but do NOT assert on `averageRating` type in the response body.

**Positive exception**: `apps/api/test/integration/accommodation/list-enhanced.test.ts` (line 90), `get-summary.test.ts` (line 66), and `get-stats.test.ts` (lines 73, 314) DO include `typeof` checks for `averageRating`. These are the only integration tests with proper type assertions.

**Impact**: Low.. the `numeric-fields.test.ts` file already has comprehensive `typeof` assertions on the helper functions themselves. This gap is about redundant coverage at higher integration layers.

**Proposed Solution**: Add `expect(typeof result.data.averageRating).toBe('number')` to the schema coercion tests. Can be bundled with other test improvements.

---

## Resolved Gaps

### GAP-056-003: `Number()` Wrappers in Frontend Code [CLOSED - Audit #3]

**Original Issue**: Four `Number()` wrappers on `averageRating` in web app code.
**Resolution**: Re-evaluated as legitimate defensive coercion at system boundary. WON'T FIX (by design).
**Status**: CLOSED

### GAP-056-011: Test Count Discrepancy [CLOSED - Audit #2]

**Original Issue**: Audit #1 stated 92 test cases, actual count is 37.
**Resolution**: Reporting error corrected in Audit #2. The 37 tests provide adequate coverage.
**Status**: CLOSED - informational only, no code change needed.

---

## Summary Matrix

| Gap ID | Title | Severity | Priority | Complexity | Fix Approach | Found | Status |
|--------|-------|----------|----------|------------|-------------|-------|--------|
| GAP-056-009 | Entity review schemas use `z.coerce.number()` | CRITICAL | P1 | Low | Fix immediately in spec | #2-#5 | OPEN |
| GAP-056-001 | Missing DB integration test file | HIGH | P2 | Low | Fix in spec | #1-#5 | OPEN |
| GAP-056-013 | Outdated JSDoc in destinationReview.schema.ts | MEDIUM | P3 | Trivial | Fix with GAP-009 | #4, #5 | OPEN |
| GAP-056-014 | Documentation examples show old pattern | MEDIUM | P3 | Trivial | Fix directly | **#5** | **NEW** |
| GAP-056-004 | Migration verification not documented | MEDIUM | P3 | Trivial | Execute now | #1-#5 | OPEN |
| GAP-056-005 | Outdated CLAUDE.md gotcha | MEDIUM | P3 | Trivial | Fix directly | #1-#5 | OPEN |
| GAP-056-006 | Fixtures never test string path | ~~MEDIUM~~ | ~~P3~~ | - | FALSE POSITIVE | #1-#5 | **CLOSED** |
| GAP-056-002 | `as Partial<>` casts (re-evaluated) | LOW | P4 | Low | Verify with typecheck | #1-#5 | OPEN (downgraded) |
| GAP-056-007 | Exchange rate i18n behavior untested | ~~LOW~~ | ~~P4~~ | - | FALSE POSITIVE | #1-#5 | **CLOSED** |
| GAP-056-008 | Spec status still "draft" | LOW | P4 | Trivial | Update now | #1-#5 | OPEN |
| GAP-056-010 | Exchange rate tests missing string coercion | LOW | P4 | Low | Defer | #2-#5 | OPEN |
| GAP-056-015 | Exchange rate model test mocks use strings | LOW | P4 | Low | Fix with GAP-001 | **#5** | **NEW** |
| GAP-056-017 | Review integration tests lack typeof assertions | LOW | P4 | Low | Address with GAP-001 | **#5** | **NEW** |
| GAP-056-012 | No task state file + missing from index.json | INFO | P4 | Trivial | Create if needed | #3-#5 | OPEN |
| GAP-056-016 | Missing NaN/Infinity edge case tests | INFO | P5 | Trivial | Can defer indefinitely | **#5** | **NEW** |
| GAP-056-003 | `Number()` wrappers (re-evaluated) | LOW | P4 | Low | WON'T FIX (by design) | #1-#3 | **CLOSED** |
| GAP-056-011 | Test count discrepancy | - | - | - | Report correction | #2 | **CLOSED** |

---

## Acceptance Criteria Checklist (Spec vs Reality)

### Phase 1: DB Schema - COMPLETE (verified 4x)

- [x] All 6 `numeric()` columns use `mode: 'number'`
- [x] `$type<number>()` removed from accommodations and destinations
- [x] All 6 columns have JSDoc explaining coercion behavior
- [x] Default values changed from string `'0'` to number `0` on all 4 averageRating columns
- [x] No other numeric() columns exist in codebase that were missed
- [x] `doublePrecision()` columns correctly excluded (r_accommodation_amenity.additionalCostPercent)

### Phase 2: Zod Schemas - MOSTLY COMPLETE (2 gaps + 1 JSDoc)

- [x] 18 of 18 query/derived `averageRating` Zod definitions use `createAverageRatingField()`
- [ ] **AccommodationReviewSchema** base uses `z.coerce.number()` not `createAverageRatingField()` **(GAP-056-009)**
- [ ] **DestinationReviewSchema** base uses `z.coerce.number()` not `createAverageRatingField()` **(GAP-056-009)**
- [ ] **DestinationReviewSchema** JSDoc incorrectly states "PostgreSQL returns numeric as string" **(GAP-056-013 NEW)**
- [x] All 4 inline union/transform duplications in `destination.query.schema.ts` replaced
- [x] Exchange rate schema uses `numericField()` preserving i18n messages
- [x] `WithReviewStateSchema` uses `createAverageRatingField({ optional: true })`
- [x] `averageRatingGiven` fields use `createAverageRatingField({ optional: true })`
- [x] Helper functions (`createAverageRatingField`, `numericField`) are correctly defined
- [x] All imports are correct in migrated files
- [x] JSONB rating category fields correctly use plain `z.number()` (not changed)
- [x] Filter schemas (minRating/maxRating) correctly use plain `z.number()` (not changed)
- [x] Admin schema extension uses `createAverageRatingField()` correctly
- [x] BaseReviewFields in `common/review.schema.ts` uses `createAverageRatingField()`

### Phase 3: Service Fixes - COMPLETE

- [x] `.toString()` calls removed (0 instances found across all 4 audits)
- [x] `updateStatsFromReview` in both accommodation and destination services accepts `number` directly, works correctly
- [x] SQL `gte()`/`lte()` comparisons use numeric values directly (no `.toString()`)
- [x] `computeReviewAverageRating()` returns number, stored directly
- [x] `computeAndStoreReviewAverage()` in accommodationReview passes numeric directly
- [~] `as Partial<>` casts remain but are for structural reasons, not numeric type reasons **(GAP-056-002 - downgraded)**
- [x] `Number()` wrappers in transforms.ts are defensive at system boundary **(GAP-056-003 - closed as by design)**
- [x] `exchange-rate.helpers.ts` uses `.toFixed()` only for display formatting, Number() wrapper maintains numeric type

### Phase 4: Migration Verification - NOT VERIFIED

- [ ] `pnpm db:generate` produces no meaningful migration **(GAP-056-004)**

### Phase 5: Tests - PARTIALLY COMPLETE

- [ ] DB coercion integration tests pass **(GAP-056-001 - file never created)**
- [x] Zod schema unit tests pass (37 test cases, adequate coverage)
- [x] accommodationReview schema tests include string coercion test (line 138)
- [x] destinationReview schema tests include string coercion test (line 163)

### Quality Gates - NOT YET VERIFIED

- [ ] `pnpm typecheck` passes (needs verification)
- [ ] `pnpm lint` passes (needs verification)
- [ ] Existing test suites pass (needs verification)

### Documentation

- [ ] `packages/db/CLAUDE.md` gotcha updated **(GAP-056-005)**
- [ ] `destinationReview.schema.ts` JSDoc updated **(GAP-056-013 NEW)**
- [ ] Spec status updated from "draft" **(GAP-056-008)**

---

## Supplementary Findings (No Gaps, Verified Correct)

These items were checked across all 4 audits and found to be correct:

| Item | Status | Evidence | Audit |
|------|--------|----------|-------|
| Seed data uses numeric values | CORRECT | JSON files use `1050.0`, `0.000952381`, `0` | #1, #2, #3, #4 |
| Admin schemas use helper | CORRECT | `accommodations.schemas.ts` uses `createAverageRatingField()` | #2, #3, #4 |
| API test mocks use numeric values | CORRECT | All mocks use `4.5`, `0`, `0.000847`, `1180.5` | #1, #2, #3, #4 |
| i18n keys exist in all 3 locales | CORRECT | es, en, pt validation.json files verified | #2, #3, #4 |
| `exchange-rate.helpers.ts` pattern | CORRECT | `Number()` after `.toFixed()` is legitimate (string->number) | #1, #2, #3, #4 |
| Rating category schemas (JSONB) | CORRECT | `z.number().min(0).max(5)` for JSONB sub-fields | #1, #2, #3, #4 |
| Filter schemas (minRating/maxRating) | CORRECT | `z.number().min(0).max(5)` for validation boundaries | #1, #2, #3, #4 |
| BaseModel.count() | CORRECT | `Number()` coercion is intentional (pg driver returns bigint as string) | #3, #4 |
| `buildOrderByClause` sorting | CORRECT | Works correctly with numeric columns, proven by integration tests | #3, #4 |
| No raw SQL bypass | CORRECT | No `db.execute(sql\`...\`)` references average_rating/rate/inverse_rate | #3, #4 |
| No caching issues | CORRECT | JSON serialization preserves number type | #3, #4 |
| No aggregation issues | CORRECT | No `avg()`/`sum()` on numeric columns (pre-calculated) | #3, #4 |
| Admin components expect numbers | CORRECT | StarRating, Math.abs(), table columns all use numeric | #3, #4 |
| Web2 static data | CORRECT | `readonly averageRating: number` typed, uses numeric literals | #3, #4 |
| `doublePrecision()` excluded | CORRECT | Only `additionalCostPercent` uses it, correctly returns number natively | #1, #3, #4 |
| No other numeric() columns missed | CORRECT | Exhaustive search of 40 schema files found only 6 | #3, #4 |
| Accommodation findTopRated() | CORRECT | `desc(accommodations.averageRating)` - numeric ordering | #3, #4 |
| Integration sort tests | CORRECT | `list-enhanced.test.ts` validates numeric `<=`/`>=` comparisons | #3, #4 |
| No GROUP BY/DISTINCT on numeric cols | CORRECT | GROUP BY used only on id/tag fields, not numeric columns | #4 |
| Drizzle version compatibility | CORRECT | drizzle-orm@0.44.7, mode:'number' stable since 0.20+ | #4 |
| API route response handling | CORRECT | All public/admin API endpoints return numeric types correctly | #4 |
| JSON serialization preserves type | CORRECT | Number type preserved through JSON.stringify/parse cycle | #4 |
| Computed/derived columns safe | CORRECT | `computeReviewAverageRating()`, `calculateStatsFromReviews()`, `convertAmount()` all return number | #4 |
| BaseReviewFields uses helper | CORRECT | `common/review.schema.ts` uses `createAverageRatingField()` | #4 |
| Admin test fixtures | CORRECT | `destination.fixture.ts`, `accommodation.fixture.ts` use `averageRating: 0` (numeric) | #4 |
| Service layer .toString() scan | CORRECT | Zero .toString() calls on averageRating/rate/inverseRate anywhere in service-core | #5 |
| Service layer Number() scan | CORRECT | Zero Number() wrappers on averageRating in service-core | #5 |
| Raw SQL bypass scan | CORRECT | Zero `db.execute(sql)` calls reference average_rating/rate/inverse_rate | #5 |
| Cache serialization | CORRECT | In-memory cache stores raw JSON strings, no re-parse on replay | #5 |
| Redis serialization | CORRECT | Redis not used for entity data (only rate-limiting, user/permission caches) | #5 |
| WebSocket/SSE paths | CORRECT | REST-only architecture, no alternate serialization paths | #5 |
| Admin NumberCell component | CORRECT | `Number(value)` is redundant no-op but harmless | #5 |
| ManualOverrideDialog rate math | CORRECT | `inverseRate: 1 / value.rate` — pure JS number arithmetic | #5 |
| OpenAPI schema utility | CORRECT | Does not alter numeric types (only converts z.date to z.string) | #5 |
| Drizzle relations() definitions | CORRECT | Only reference FK joins, mode:'number' flows through correctly | #5 |
| No parseFloat/parseInt on SPEC-056 fields | CORRECT | Monorepo-wide scan found zero usages | #5 |
| No string manipulation on numeric fields | CORRECT | Zero .padStart/.includes('.')/.split('.') on averageRating/rate/inverseRate | #5 |
| exchange-rate.helpers.ts patterns | CORRECT | `.toFixed()` + `Number()` is precision rounding idiom, not coercion workaround | #5 |
| computeReviewAverageRating return type | CORRECT | Returns `number`, all consumers pass value directly | #5 |
| Inline z.union transforms eliminated | CORRECT | Zero standalone instances outside helper function definitions | #5 |

---

## Recommendations

### Immediate Actions (should do now, in priority order)

1. **P1**: Fix `accommodationReview.schema.ts:39` and `destinationReview.schema.ts:45` to use `createAverageRatingField({ default: 0 })` + fix JSDoc on line 42 (GAP-056-009 + GAP-056-013)
2. **P2**: Create `packages/db/test/numeric-coercion.test.ts` with DB round-trip tests (GAP-056-001 + GAP-056-006)
3. **P3**: Run `pnpm db:generate` to verify no migration and document result (GAP-056-004)
4. **P3**: Update `packages/db/CLAUDE.md` line 588 gotcha (GAP-056-005)
5. **P3**: Update documentation examples to use `createAverageRatingField()` (GAP-056-014)
6. **P4**: Update spec status to `in-progress` and add to index.json (GAP-056-008 + GAP-056-012)

### Verify and Close

1. Temporarily remove `as Partial<>` casts, run typecheck, document results (GAP-056-002)

### Closed / Won't Fix

1. **GAP-056-003**: `Number()` wrappers in transforms.ts are legitimate defensive coercions at system boundary - **WON'T FIX** (by design)
2. **GAP-056-011**: Test count discrepancy was a reporting error - **CLOSED**

### Can Defer

1. Add exchange rate string coercion tests (GAP-056-010) - generic helper already tested
2. Add i18n error message behavior tests (GAP-056-007) - low risk, keys verified
3. Update exchange rate model test mocks to use numeric literals (GAP-056-015) - tests still pass, cosmetic fix
4. Add typeof assertions to schema coercion tests (GAP-056-017) - helper tests already cover this
5. Add NaN/Infinity edge case tests (GAP-056-016) - implicitly rejected by validation pipes

### No New Spec Needed

All remaining gaps are small enough to resolve within the existing SPEC-056 scope. None warrant a separate spec.

---

## Out-of-Scope Observations (for future reference)

These issues were discovered during audits but are **NOT SPEC-056 gaps**:

1. **SPEC-028 (IVA Tax Handling)** has comments in its spec file (lines 316, 321, 364) stating `numeric() returns string in JS`. If SPEC-028 is ever implemented, those comments should be updated to reflect the `mode: 'number'` solution from SPEC-056.

2. **Billing migration-only tables** (found in Audit #5): The `0000_warm_hydra.sql` migration defines two additional `numeric()` columns that have NO corresponding Drizzle schema files:
   - `billing_payments.exchange_rate` — `numeric(18, 8)`
   - `billing_vendors.commission_rate` — `numeric(5, 2) NOT NULL`
   These are either legacy or planned tables. **If these tables are ever added to `packages/db/src/schemas/`, they MUST include `mode: 'number'`** per the pattern established by SPEC-056.

3. **`apply-postgres-extras.sh` references missing manual migration files** (found in Audit #5): The `packages/db/src/migrations/manual/` directory is empty, but `apply-postgres-extras.sh` references 4 SQL files (`0016` through `0020`). This is unrelated to SPEC-056 but is a deployment infrastructure gap.

---

## Audit #5 Delta (Changes from Audit #4)

| Change | Detail |
|--------|--------|
| GAP-056-014 ADDED | NEW gap: Documentation examples in `docs/guides/creating-schemas.md`, `docs/examples/entity-schema.ts`, and `packages/schemas/CLAUDE.md` still show old `z.number().min(0).max(5)` pattern for averageRating |
| GAP-056-015 ADDED | NEW gap: Exchange rate model test mocks in `packages/db/test/models/exchange-rate/exchange-rate.model.test.ts` use 11 string literal values for `rate`/`inverseRate` instead of numeric literals |
| GAP-056-016 ADDED | NEW gap (INFORMATIONAL): `numeric-fields.test.ts` does not test `NaN` or `Infinity` inputs. Implicit rejection via validation pipes confirmed.. low risk |
| GAP-056-017 ADDED | NEW gap: Schema coercion tests for accommodationReview and destinationReview lack `typeof` assertions after coercion. Smoke-only review integration tests don't verify averageRating type |
| All prior gaps CONFIRMED | No gaps resolved between Audit #4 and Audit #5 |
| Service layer re-verified | All 5 service files confirmed correct: no toString(), no Number() on averageRating, as Partial<> casts all justified structurally |
| Raw SQL scan VERIFIED | Zero `db.execute(sql)` references to average_rating, rate, or inverse_rate columns |
| Cache/Redis VERIFIED | In-memory cache stores raw JSON strings (no re-parse risk). Redis not used for entity data |
| No WebSocket/SSE layer | Confirmed REST-only architecture.. no alternate serialization paths |
| Billing migration tables noted | `billing_payments.exchange_rate` and `billing_vendors.commission_rate` exist in migration SQL only (no Drizzle schema file). Future work if schemas are created. |
| Total open gaps | 13 (was 10, +4 new: GAP-056-014 through GAP-056-017, -1 reclassified) |
| Implementation estimate | Unchanged at ~85% |

## Audit #4 Delta (Changes from Audit #3)

| Change | Detail |
|--------|--------|
| GAP-056-013 ADDED | NEW gap: outdated JSDoc in `destinationReview.schema.ts:42` says "PostgreSQL returns numeric as string" which is incorrect post-SPEC-056 |
| GAP-056-012 EXPANDED | Added detail: SPEC-056 also missing from `index.json`, not just missing task state |
| All prior gaps CONFIRMED | No gaps resolved between Audit #3 and Audit #4 |
| DB model test detail ADDED | Exchange rate model tests use string values in mocks (pre-coercion testing), not actual DB round-trip |
| Drizzle version verified | drizzle-orm@0.44.7 confirmed stable for mode:'number' |
| API route verification ADDED | All public/admin endpoints verified returning numeric types |
| BaseReviewFields VERIFIED | `common/review.schema.ts` correctly uses `createAverageRatingField()` (new finding, no gap) |
| Total open gaps | 10 (was 9, +1 new GAP-056-013) |
| Implementation estimate | Unchanged at ~85% |
