# SPEC-036 Gaps Remediation - Implementation Plan

## Overview
27 gaps to fix from SPEC-036 (Unified Zod Validation Error i18n System).
All tasks must have complexity <= 2.5.

## Batch 1: Critical API Response Fix (P1)
Dependencies: None. Must be done FIRST.

### Task 1.1: Add 3 missing Zod v4 error codes (GAP-027)
- Add `invalid_union`, `invalid_key`, `invalid_element` to ZOD_ERROR_CODE_MAP and ZOD_ERROR_MESSAGE_MAP
- Add cases to `generateUserFriendlyMessage()` and `generateSuggestion()`
- Add `extractErrorParams()` handling
- Add translation keys to validation.json (es/en/pt)
- Add 3+ tests
- File: `apps/api/src/utils/zod-error-transformer.ts`
- Complexity: 2

### Task 1.2: Fix defaultHook response nesting + standardize 3 paths (GAP-022, GAP-030)
- Fix `create-app.ts:92`: change `details: transformedError` to `details: transformedError.details, summary: transformedError.summary`
- Standardize validation middleware paths to same envelope format
- Update defaultHook tests to validate new structure
- Files: `apps/api/src/utils/create-app.ts`, `apps/api/src/middleware/validation.ts`
- Complexity: 2

### Task 1.3: Rename message fields + JSDoc (GAP-029)
- Rename `message` to `messageKey` and `translatedMessage` to `zodMessage` in TransformedValidationError
- Add JSDoc to interface explaining each field
- Update all references in transformer, tests, and admin parsing
- File: `apps/api/src/utils/zod-error-transformer.ts`
- Complexity: 2

### Task 1.4: Update admin error parsing + create shared utility (GAP-040, GAP-032)
- Create `apps/admin/src/lib/errors/parse-api-validation-errors.ts`
- Define `ApiValidationErrorSchema` with Zod
- Create `parseApiValidationErrors()` utility using the schema
- Update EntityCreateContent.tsx and EntityEditContent.tsx to use the utility
- Remove duplicated JSON.parse patterns
- Depends on: Task 1.2, Task 1.3
- Complexity: 2.5

## Batch 2: Dead Code Cleanup + File Split (P2-P3)
Dependencies: Batch 1 (transformer file changes)

### Task 2.1: Remove dead code from transformer (GAP-024, GAP-028, GAP-036)
- Remove `groupErrorsByField()` and `getSimplifiedErrors()` (lines 613-640)
- Remove 7 unreachable Zod v3 switch cases
- Add guard for `totalErrors === 0` in `generateOverallMessage()`
- File: `apps/api/src/utils/zod-error-transformer.ts`
- Complexity: 1

### Task 2.2: Remove dead code in admin (GAP-006, GAP-007)
- Verify `getEntitySchema()` has zero production imports, remove if confirmed
- Remove `_zodSchema` prop from EntityEditContentProps
- Remove unused ZodSchema import from EntityEditContent
- Files: `apps/admin/src/lib/validation/schema-registry.ts`, `apps/admin/src/components/entity-pages/EntityEditContent.tsx`
- Complexity: 1

### Task 2.3: Split zod-error-transformer.ts into 3 files (GAP-001)
- Extract `zod-error-types.ts` (interfaces, ~75 lines)
- Extract `zod-error-messages.ts` (generateUserFriendlyMessage + generateSuggestion, ~260 lines)
- Keep main file with transformZodError + helpers (~305 lines)
- Update all imports across codebase
- Depends on: Task 2.1
- Complexity: 2

## Batch 3: Test Coverage (P3)

### Task 3.1: Add transformer test coverage for 15 error codes (GAP-003, GAP-016)
- Add tests for: required, int, uuid, tooHigh, positive, tooLow, pattern, format, invalidDate, invalidBoolean, url, length, plus 3 new Zod v4 codes
- File: `apps/api/test/utils/zod-error-transformer.test.ts`
- Depends on: Batch 1 (codes added), Batch 2 (file split)
- Complexity: 2.5

### Task 3.2: Add defaultHook query/params tests + assertion (GAP-023, GAP-004)
- Add 2-3 tests for query param validation via defaultHook
- Add 1 test for path param validation
- Add `defaultHook: expect.any(Function)` assertion to create-app.test.ts
- Files: `apps/api/test/utils/create-app.defaulthook.test.ts`, `apps/api/test/utils/create-app.test.ts`
- Complexity: 1.5

### Task 3.3: Create e2e i18n flow integration test (GAP-034)
- Create `apps/api/test/integration/zod-i18n-flow.test.ts`
- Test full pipeline: Zod validation error -> transformZodError() -> resolve key in validation.json -> verify translated message
- Use real i18n files, not mocks
- Complexity: 2

### Task 3.4: Add array/nested field validation tests (GAP-008)
- Add tests for GalleryField array validation
- Add tests for nested object validation (location.country, price.basePrice)
- File: `apps/admin/test/components/entity-form/` (new test files)
- Complexity: 2

## Batch 4: Tooling + CI (P2-P3)
Dependencies: Batch 2 (file split may affect extract script references)

### Task 4.1: Add verification mode to extract script (GAP-033)
- Add `--verify` flag to `scripts/extract-zod-keys.ts`
- Load all 3 locale validation.json files after key discovery
- Compare extracted keys with translation entries
- Report missing translations per locale
- Exit non-zero if gaps found
- Complexity: 2

### Task 4.2: Add tests for extract script (GAP-043, GAP-014)
- Create `scripts/__tests__/extract-zod-keys.test.ts`
- Test: static key extraction, template literal resolution, factory function mapping, 2-segment key warning, output format, verification mode
- Complexity: 2

### Task 4.3: Add CI job for i18n key sync (GAP-010)
- Add step to `.github/workflows/ci.yml`
- Run extract-zod-keys.ts with --verify flag
- Fail CI if zodError keys don't match validation.json
- Also add as vitest test for local development
- Depends on: Task 4.1
- Complexity: 1.5

## Batch 5: Web Forms Standardization (P2-P3)
Dependencies: None (independent from API changes)

### Task 5.1: Create shared FormError component + validateField helper (GAP-009 base)
- Create `apps/web/src/components/ui/FormError.tsx` with built-in ARIA (role="alert", aria-live, id for describedby)
- Create `apps/web/src/lib/validation/validate-field.ts` helper (~20 lines)
- Support: required, minLength, maxLength, email, pattern
- Use validation.json keys for messages
- Complexity: 2

### Task 5.2: Migrate ContactForm to apiClient + validateField (GAP-031, GAP-009, GAP-011)
- Create `apps/web/src/lib/api/endpoints-public.ts` with `contactApi.sendContactMessage()`
- Replace raw fetch() with contactApi wrapper
- Replace manual validation with validateField helper
- Replace manual error display with FormError component
- Fix email regex inconsistency (GAP-011)
- Depends on: Task 5.1
- Complexity: 2

### Task 5.3: Migrate ReviewForm + ReviewEditForm to standardized pattern (GAP-009, GAP-026, GAP-041)
- Replace manual validation with validateField helper
- Replace manual error display with FormError component
- Add ARIA to ReviewEditForm (GAP-026: currently 0% compliance)
- Add id="ratings-error" + aria-describedby to ReviewForm ratings (GAP-041)
- Depends on: Task 5.1
- Complexity: 2.5

### Task 5.4: Migrate ProfileEditForm to standardized pattern (GAP-009, GAP-042)
- Replace manual validation with validateField helper
- Replace manual error display with FormError component
- Fix missing aria-live on bio and name errors (GAP-042)
- Depends on: Task 5.1
- Complexity: 1.5

## Batch 6: i18n Quality + Schema Completeness (P3-P4)

### Task 6.1: Fix 11 Spanish translations with English field names (GAP-035)
- Fix translations in `packages/i18n/src/locales/es/validation.json`
- homePhone -> teléfono particular, mobilePhone -> teléfono celular, etc.
- Complexity: 1

### Task 6.2: Document 2-segment key convention (GAP-037)
- Add documentation in `packages/i18n/docs/` or `packages/schemas/docs/`
- Explain that 2-segment keys (zodError.dateRange.*) are intentional shorthand for generic/utility messages
- Complexity: 0.5

### Task 6.3: Create missing CRUD schemas (GAP-013)
- Create `owner-promotion.crud.schema.ts`
- Create `sponsorship.crud.schema.ts`
- Follow existing patterns from other 18 entity crud schemas
- Complexity: 1.5

## Execution Order
1. Batch 1 (Critical API) -> 2 (Cleanup) -> 3 (Tests)
2. Batch 4 (Tooling) can run in parallel with Batch 3
3. Batch 5 (Web Forms) can run in parallel with Batches 1-4
4. Batch 6 (i18n Quality) can run anytime, no dependencies
