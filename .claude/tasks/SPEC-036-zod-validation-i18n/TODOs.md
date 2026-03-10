# SPEC-036: Unified Zod Validation Error i18n System

## Progress: 0/24 tasks (0%)

**Average Complexity:** 2.7/4
**Critical Path:** T-004 -> T-005 -> T-008 -> T-009 -> T-010 (5 steps, Phase 1 pipeline)
**Parallel Tracks:** 4 identified

---

### Phase 0: API Validation Response Fix

- [ ] **T-001** (complexity: 2) - Add defaultHook to createRouter() in create-app.ts
  - Fix API validation response format bug with defaultHook calling transformZodError
  - Blocked by: none
  - Blocks: T-002, T-003

- [ ] **T-002** (complexity: 3) - Write tests for defaultHook validation behavior
  - 7 test cases covering envelope format, success pass-through, per-route hook override
  - Blocked by: T-001
  - Blocks: T-003

- [ ] **T-003** (complexity: 1) - Verify defaultHook with existing admin route
  - Manual/integration verification with real admin endpoint
  - Blocked by: T-001, T-002
  - Blocks: none

### Phase 1: i18n Infrastructure

- [ ] **T-004** (complexity: 4) - Create zodError key extraction script
  - Scan schemas + API files, resolve template literals, output ~1,037 keys to JSON
  - Blocked by: none
  - Blocks: T-005, T-006, T-007

- [ ] **T-005** (complexity: 4) - Generate Spanish validation.json translations
  - ~1,500-2,000 lines covering all entity keys + generic field keys
  - Blocked by: T-004
  - Blocks: T-008, T-009, T-010

- [ ] **T-006** (complexity: 3) - Create EN/PT placeholder validation.json files
  - [EN]/[PT] prefixed values to prevent MISSING errors
  - Blocked by: T-004
  - Blocks: T-008

- [ ] **T-007** (complexity: 2) - Create resolveValidationMessage helper
  - Maps zodError.*/validationError.* keys to validation.* namespace
  - Blocked by: none
  - Blocks: T-008, T-011, T-014, T-017, T-018

- [ ] **T-008** (complexity: 2) - Register validation namespace in i18n config
  - Add namespace, imports, rawTranslations entries
  - Blocked by: T-005, T-006, T-007
  - Blocks: T-009

- [ ] **T-009** (complexity: 1) - Regenerate i18n types and verify
  - Run generate-types, verify validation.* keys in TranslationKey union
  - Blocked by: T-008
  - Blocks: T-010

- [ ] **T-010** (complexity: 2) - Validate i18n integration end-to-end (Phase 1 smoke test)
  - Verify full pipeline: JSON -> config -> namespace -> helper -> translated string
  - Blocked by: T-005, T-009
  - Blocks: none

- [ ] **T-011** (complexity: 2) - Write tests for resolveValidationMessage
  - 7 test cases: prefix mapping, params, fallback, underscore keys
  - Blocked by: T-007
  - Blocks: none

### Phase 2: Unify Error Systems

- [ ] **T-012** (complexity: 3) - Update transformZodError to prefer schema message keys
  - Use zodError.* as primary message field when present, generic fallback otherwise
  - Blocked by: T-001
  - Blocks: T-013

- [ ] **T-013** (complexity: 2) - Write tests for transformer schema key preference
  - Test schema key priority and generic fallback
  - Blocked by: T-012
  - Blocks: none

### Phase 3: Admin Zod Integration

- [ ] **T-014** (complexity: 2) - Create schema registry
  - Map 12 entity types to 24 Zod schemas (create + edit)
  - Blocked by: T-007
  - Blocks: T-016, T-020

- [ ] **T-015** (complexity: 3) - Create Zod validation helpers
  - validateFormWithZod, validateFieldWithZod, extractZodIssueParams
  - Blocked by: T-007
  - Blocks: T-016, T-019

- [ ] **T-016** (complexity: 4) - Integrate Zod validation into EntityFormProvider
  - Wire zodSchema prop, validateForm before submit, validateField on blur, remove TODOs
  - Blocked by: T-014, T-015
  - Blocks: T-017, T-018, T-021

- [ ] **T-017** (complexity: 3) - Update EntityCreateContent
  - Remove formatZodErrorMessage, use resolveValidationMessage, pass zodSchema
  - Blocked by: T-007, T-016
  - Blocks: T-022

- [ ] **T-018** (complexity: 3) - Update EntityEditContent
  - Use resolveValidationMessage for server errors, pass zodSchema
  - Blocked by: T-007, T-016
  - Blocks: T-023

- [ ] **T-022** (complexity: 3) - Pass zodSchema to all 12 create pages
  - Import CreateInputSchema and pass to EntityCreateContent for each entity
  - Blocked by: T-017
  - Blocks: T-024

- [ ] **T-023** (complexity: 3) - Pass zodSchema to all 12 edit pages
  - Import UpdateInputSchema and pass to EntityEditContent for each entity
  - Blocked by: T-018
  - Blocks: T-024

### Phase 4: Testing & Verification

- [ ] **T-019** (complexity: 4) - Unit tests for validateFormWithZod and extractZodIssueParams
  - 13 test cases covering form validation, field validation, params extraction
  - Blocked by: T-015
  - Blocks: none

- [ ] **T-020** (complexity: 2) - Unit tests for schema registry
  - 5 test cases: all entity types, both modes, unknown type, schema behavior
  - Blocked by: T-014
  - Blocks: none

- [ ] **T-021** (complexity: 4) - Integration tests for admin form Zod validation
  - 5 test cases: submit validation, fallback, blur, translated messages, server errors
  - Blocked by: T-016
  - Blocks: none

- [ ] **T-024** (complexity: 2) - Full regression verification
  - typecheck, lint, test, build across all packages
  - Blocked by: T-022, T-023
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-004, T-007
Level 1: T-002, T-005, T-006, T-011, T-012, T-014, T-015
Level 2: T-003, T-008, T-013, T-016, T-019, T-020
Level 3: T-009, T-017, T-018, T-021
Level 4: T-010, T-022, T-023
Level 5: T-024
```

## Parallel Tracks

1. **API Track**: T-001 -> T-002 -> T-003 (Phase 0) + T-012 -> T-013 (Phase 2)
2. **i18n Infrastructure Track**: T-004 -> T-005/T-006 -> T-008 -> T-009 -> T-010
3. **Helper Track**: T-007 -> T-011 (can start immediately, no dependencies)
4. **Admin Integration Track**: T-014/T-015 -> T-016 -> T-017/T-018 -> T-022/T-023 -> T-024

## Suggested Start

Begin with **T-001** (complexity: 2), **T-004** (complexity: 4), and **T-007** (complexity: 2) in parallel - they have no dependencies and unblock the majority of downstream tasks.
