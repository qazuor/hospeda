# SPEC-036-gaps: Zod Validation i18n Gaps Remediation

## Progress: 0/29 tasks (0%)

**Average Complexity:** 1.7/2.5 (max)
**Critical Path:** T-001 -> T-009 -> T-011 -> T-012/T-013 (4 steps)
**Parallel Tracks:** 4 identified (core-api, web-forms, tooling, i18n-quality)

---

### Core API Phase (T-001 to T-008)

- [ ] **T-001** (complexity: 2) - Add 3 missing Zod v4 error codes to transformer maps
  - GAP-027: invalid_union, invalid_key, invalid_element + tests
  - Blocked by: none
  - Blocks: T-002, T-009, T-010

- [ ] **T-002** (complexity: 1) - Add Zod v4 translation keys to validation.json (3 locales)
  - GAP-027: translation keys for 3 new error codes
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-003** (complexity: 2) - Fix defaultHook response nesting — flatten details
  - GAP-022: remove error.details.details double nesting
  - Blocked by: none
  - Blocks: T-004, T-007, T-008

- [ ] **T-004** (complexity: 2) - Standardize validation middleware response format
  - GAP-030: align 3 response paths to same envelope
  - Blocked by: T-003
  - Blocks: T-007

- [ ] **T-005** (complexity: 2) - Rename TransformedValidationError message fields + JSDoc
  - GAP-029: message -> messageKey, translatedMessage -> zodMessage
  - Blocked by: none
  - Blocks: T-007, T-008

- [ ] **T-006** (complexity: 2) - Create ApiValidationErrorSchema + parseApiValidationErrors utility
  - GAP-032: shared Zod-validated error parser
  - Blocked by: T-003, T-005
  - Blocks: T-007, T-008

- [ ] **T-007** (complexity: 1.5) - Update EntityCreateContent to use parseApiValidationErrors
  - GAP-040: replace JSON.parse with shared utility
  - Blocked by: T-003, T-004, T-005, T-006
  - Blocks: none

- [ ] **T-008** (complexity: 1.5) - Update EntityEditContent to use parseApiValidationErrors
  - GAP-040: replace JSON.parse with shared utility
  - Blocked by: T-003, T-004, T-005, T-006
  - Blocks: none

### Cleanup Phase (T-009 to T-011)

- [ ] **T-009** (complexity: 1.5) - Remove dead code from transformer
  - GAP-024, GAP-028, GAP-036: dead functions, v3 cases, empty guard
  - Blocked by: T-001
  - Blocks: T-011

- [ ] **T-010** (complexity: 1) - Remove dead code in admin
  - GAP-006, GAP-007: schema registry, _zodSchema prop
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-011** (complexity: 2) - Split zod-error-transformer.ts into 3 files
  - GAP-001: types, messages, transformer (~300 lines each max)
  - Blocked by: T-009
  - Blocks: T-012, T-013

### Testing Phase (T-012 to T-016)

- [ ] **T-012** (complexity: 2) - Add transformer tests: error codes batch 1 (8 codes)
  - GAP-003/016: required, int, uuid, tooHigh, positive, tooLow, pattern, format
  - Blocked by: T-011
  - Blocks: none

- [ ] **T-013** (complexity: 2) - Add transformer tests: error codes batch 2 (7 codes + v4)
  - GAP-003/016: invalidDate, invalidBoolean, url, length, invalidUuid, + 3 v4 codes
  - Blocked by: T-011
  - Blocks: none

- [ ] **T-014** (complexity: 1.5) - Add defaultHook query/params tests + presence assertion
  - GAP-023, GAP-004: query/params smoke tests
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-015** (complexity: 2) - Create e2e i18n flow integration test
  - GAP-034: full pipeline Zod -> transform -> i18n resolve
  - Blocked by: T-011
  - Blocks: none

- [ ] **T-016** (complexity: 2) - Add array/nested field validation tests for admin forms
  - GAP-008: GalleryField, location, price nested tests
  - Blocked by: none
  - Blocks: none

### Tooling Phase (T-017 to T-019)

- [ ] **T-017** (complexity: 2) - Add verification mode to extract-zod-keys script
  - GAP-033: --verify flag, compare keys vs validation.json
  - Blocked by: none
  - Blocks: T-018, T-019

- [ ] **T-018** (complexity: 2) - Add tests for extract-zod-keys script
  - GAP-043, GAP-014: 6+ test cases for extraction + verification
  - Blocked by: T-017
  - Blocks: none

- [ ] **T-019** (complexity: 1.5) - Add CI job + vitest test for i18n key sync
  - GAP-010: CI step + local vitest test
  - Blocked by: T-017
  - Blocks: none

### Web Forms Phase (T-020 to T-025)

- [ ] **T-020** (complexity: 1.5) - Create shared FormError component with built-in ARIA
  - GAP-009/039: role="alert", aria-live, auto-id
  - Blocked by: none
  - Blocks: T-022, T-023, T-024, T-025

- [ ] **T-021** (complexity: 1.5) - Create validateField helper for web forms
  - GAP-009: lightweight validation (~20 lines, no Zod)
  - Blocked by: none
  - Blocks: T-022, T-023, T-024, T-025

- [ ] **T-022** (complexity: 2.5) - Create contactApi wrapper + migrate ContactForm
  - GAP-031, GAP-011: apiClient + validateField + FormError + email fix
  - Blocked by: T-020, T-021
  - Blocks: none

- [ ] **T-023** (complexity: 2) - Migrate ReviewForm to standardized validation + ARIA
  - GAP-041, GAP-009: ratings error ID + aria-describedby
  - Blocked by: T-020, T-021
  - Blocks: none

- [ ] **T-024** (complexity: 2) - Migrate ReviewEditForm with full ARIA compliance
  - GAP-026: from 0% to full ARIA compliance
  - Blocked by: T-020, T-021
  - Blocks: none

- [ ] **T-025** (complexity: 1.5) - Migrate ProfileEditForm to standardized pattern
  - GAP-042: fix missing aria-live on errors
  - Blocked by: T-020, T-021
  - Blocks: none

### i18n Quality Phase (T-026 to T-029)

- [ ] **T-026** (complexity: 1) - Fix 11 Spanish translations with English field names
  - GAP-035: homePhone, mobilePhone, etc.
  - Blocked by: none
  - Blocks: none

- [ ] **T-027** (complexity: 0.5) - Document 2-segment zodError key convention
  - GAP-037: document shorthand pattern
  - Blocked by: none
  - Blocks: none

- [ ] **T-028** (complexity: 1.5) - Create owner-promotion CRUD schema
  - GAP-013: follow existing pattern
  - Blocked by: none
  - Blocks: none

- [ ] **T-029** (complexity: 1.5) - Create sponsorship CRUD schema
  - GAP-013: follow existing pattern
  - Blocked by: none
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-003, T-005, T-016, T-017, T-020, T-021, T-026, T-027, T-028, T-029
Level 1: T-002, T-004, T-006, T-009, T-010, T-014, T-018, T-019
Level 2: T-007, T-008, T-011, T-022, T-023, T-024, T-025
Level 3: T-012, T-013, T-015
```

## Parallel Tracks

1. **Core API track**: T-001 -> T-002, T-009 -> T-011 -> T-012/T-013/T-015
2. **API response track**: T-003 -> T-004, T-005 -> T-006 -> T-007/T-008, T-014
3. **Tooling track**: T-017 -> T-018/T-019
4. **Web forms track**: T-020/T-021 -> T-022/T-023/T-024/T-025
5. **i18n quality track**: T-026, T-027, T-028, T-029 (all independent)

## Suggested Start

Begin with any Level 0 task. Recommended: **T-001** (complexity: 2, CRITICAL priority, unblocks T-002/T-009/T-010) or **T-003** (complexity: 2, P1 priority, unblocks T-004/T-007/T-008/T-014).

Tracks 3-5 can start immediately in parallel.

## GAP Coverage

| GAP ID | Task(s) | Status |
|--------|---------|--------|
| GAP-001 | T-011 | Pending |
| GAP-003 | T-012, T-013 | Pending |
| GAP-004 | T-014 | Pending |
| GAP-006 | T-010 | Pending |
| GAP-007 | T-010 | Pending |
| GAP-008 | T-016 | Pending |
| GAP-009 | T-020, T-021, T-022, T-023, T-024, T-025 | Pending |
| GAP-010 | T-019 | Pending |
| GAP-011 | T-022 | Pending |
| GAP-013 | T-028, T-029 | Pending |
| GAP-014 | T-018 | Pending |
| GAP-016 | T-012, T-013 | Pending |
| GAP-022 | T-003 | Pending |
| GAP-023 | T-014 | Pending |
| GAP-024 | T-009 | Pending |
| GAP-026 | T-024 | Pending |
| GAP-027 | T-001, T-002 | Pending |
| GAP-028 | T-009 | Pending |
| GAP-029 | T-005 | Pending |
| GAP-030 | T-004 | Pending |
| GAP-031 | T-022 | Pending |
| GAP-032 | T-006 | Pending |
| GAP-033 | T-017 | Pending |
| GAP-034 | T-015 | Pending |
| GAP-035 | T-026 | Pending |
| GAP-036 | T-009 | Pending |
| GAP-037 | T-027 | Pending |
| GAP-039 | T-020 | Pending |
| GAP-040 | T-007, T-008 | Pending |
| GAP-041 | T-023 | Pending |
| GAP-042 | T-025 | Pending |
| GAP-043 | T-018 | Pending |
