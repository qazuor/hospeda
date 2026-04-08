# SPEC-036: Gaps & Issues Report

> **Spec**: SPEC-036 - Unified Zod Validation Error i18n System
> **Audit Passes**: #1 (2026-03-10), #2 (2026-03-10), #3 (2026-03-10), #4 (2026-03-10), #5 (2026-03-10), #6 (2026-03-10)
> **Auditors**: Audit #1-5: multiple specialized agents | Audit #6: 6 specialized agents (Phase 0 API response deep audit, Phase 1 i18n infra + translations, Phase 2 transformer line-by-line + Zod v4, Phase 3 admin form integration + 24 pages verification, Cross-cutting web forms + ARIA accessibility, Schema sync + test coverage matrix)
> **Methodology**: Exhaustive code reading + spec contrast + cross-cutting analysis + gap status verification + Zod v4 compatibility analysis + full line-count verification + ARIA compliance matrix + error response flow tracing

---

## Executive Summary

SPEC-036 is **85-88% implemented** across all 4 phases. The core system (defaultHook, validation translations, error unification, admin form integration) works correctly for the happy path. All 24 tasks are marked as completed in `state.json`, and the implementation covers all 12 entity types with both create and edit schemas wired.

**Audit #6 update**: 6 agentes especializados ejecutaron una auditoria exhaustiva independiente. Resultados clave:
- **2 gaps reclasificados**: GAP-017 reclasificado como NOT A GAP (by design), GAP-038 reclasificado como SAFE (all casts guarded)
- **4 gaps nuevos encontrados** (GAP-040 a GAP-043): incompatibilidad de parseo admin/defaultHook, ReviewForm ratings missing error ID, ProfileEditForm bio error missing aria-live, extract script sin tests
- **Ningún gap previo fue corregido** desde Audit #5
- Se baja la estimacion de 88-90% a **85-88%** al descubrir que la incompatibilidad de parseo entre admin y defaultHook (GAP-040) es mas critica de lo reportado.. el admin app NO puede parsear correctamente los errores del defaultHook en su formato actual
- Los 6 agentes coinciden en: sistema funcionalmente correcto para el happy path, pero con deuda tecnica significativa en compatibilidad Zod v4, cobertura de tests (75% error codes sin test), calidad de traducciones EN/PT, consistencia de respuesta API, y accesibilidad web

**Findings totals**:
| | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| Audit #1 | 0 | 4 | 7 | 4 | 15 |
| Audit #2 (new) | 0 | 1 | 3 | 2 | 6 |
| Audit #3 (new) | 0 | 1 | 2 | 2 | 5 |
| Audit #4 (new) | 1 | 3 | 4 | 2 | 10 |
| Audit #5 (new) | 0 | 0 | 2 | 1 | 3 |
| Audit #6 (new) | 0 | 1 | 2 | 1 | 4 |
| **Reclassified (not a gap)** | 0 | 0 | 2 | 0 | **2** |
| **Fixed** | 0 | 1 | 1 | 1 | **3** |
| **False Positive** | 0 | 0 | 1 | 1 | **2** |
| **Open** | 1 | 8 | 15 | 10 | **34** |

---

## Gap Status Tracker

| GAP ID | Severity | Status | Audit Found | Notes |
|--------|----------|--------|-------------|-------|
| GAP-036-001 | HIGH | OPEN | #1 | 640 lines, still over 500 limit (confirmed #6: 640 lines, 3 exported funcs + 7 internal + 3 interfaces) |
| GAP-036-002 | HIGH | FIXED | #1 | env.ts ZodError property fixed |
| GAP-036-003 | MEDIUM | PARTIALLY FIXED | #1 | 9 tests in transformer, 38 total across 3 files. ~5/20 top error codes tested (confirmed #6: 75% untested) |
| GAP-036-004 | LOW | OPEN | #1 | createRouter test still only checks `strict: false` (confirmed #6) |
| GAP-036-005 | LOW | FIXED | #1 | Dedicated defaulthook test file with 16 tests |
| GAP-036-006 | LOW | OPEN | #1 | `getEntitySchema()` dead code (confirmed #6: zero production imports) |
| GAP-036-007 | LOW | OPEN | #1 | Dead prop `_zodSchema` in EntityEditContent:34 (confirmed #6: prefixed as `_zodSchema`, intentionally unused) |
| GAP-036-008 | MEDIUM | OPEN | #1 | No admin integration tests for array/list field validation (confirmed #6: GalleryField 0 tests) |
| GAP-036-009 | HIGH | OPEN | #1 | Web forms use manual validation (confirmed #6: 5 forms audited, 0 Zod imports, 0 @repo/schemas imports) |
| GAP-036-010 | HIGH | OPEN | #1 | No CI check for i18n key sync (confirmed #6: ci.yml has zero i18n/validation/extract steps) |
| GAP-036-011 | MEDIUM | OPEN | #1 | Email regex inconsistency: ContactForm `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` vs Zod `.email()` RFC 5322 (confirmed #6) |
| GAP-036-012 | MEDIUM | FIXED | #1 | ContactForm now has `role="alert"` |
| GAP-036-013 | MEDIUM | OPEN | #1 | 3 entities lack .crud.schema.ts: owner-promotion, permission, sponsorship (confirmed #6: 18/21 present) |
| GAP-036-014 | LOW | PARTIALLY FIXED | #1 | 40+ factory functions mapped in extract script. No verification test (confirmed #6) |
| GAP-036-015 | LOW | OPEN | #1 | No debounce on blur validation (confirmed #6: Zod is fast, no action needed) |
| GAP-036-016 | MEDIUM | OPEN | #2 | Transformer test coverage: 5/20 top error codes tested (confirmed #6: 15 codes untested including required, uuid, int, pattern) |
| GAP-036-017 | MEDIUM | NOT A GAP (RECLASSIFIED #6) | #2 | By design: validation errors caught in form layer before reaching error boundary. EntityFormProvider returns field errors as Record, not throws |
| GAP-036-018 | LOW | OPEN | #2 | Feedback form uses Zod with custom mapping (confirmed #6: acceptable, YAGNI) |
| GAP-036-019 | LOW | OPEN | #2 | Auth UI forms use Better Auth validation (confirmed #6: by design) |
| GAP-036-020 | MEDIUM | FALSE POSITIVE | #2 | Feature translations exist at line 1603+ |
| GAP-036-021 | HIGH | OPEN | #2 | EN/PT 100% placeholders (confirmed #6: 2,732 lines each, all [EN]/[PT] prefixed, 0 real translations) |
| GAP-036-022 | HIGH | OPEN | #3 | defaultHook `details: transformedError` creates error.details.details nesting (confirmed #6: test at line 230 validates this broken structure) |
| GAP-036-023 | MEDIUM | OPEN | #3 | defaultHook 16 tests all body-only (confirmed #6: 0 query, 0 path params, 0 headers tests) |
| GAP-036-024 | LOW | OPEN | #3 | Dead code: `groupErrorsByField()` line 613 + `getSimplifiedErrors()` line 632 (confirmed #6: zero production calls) |
| GAP-036-025 | LOW | FALSE POSITIVE | #3 | Shorthand keys exist at root level in validation.json |
| GAP-036-026 | MEDIUM | OPEN | #3 | ReviewEditForm missing all ARIA (confirmed #6: 0/6 fields have aria-invalid/required/describedby) |
| GAP-036-027 | CRITICAL | OPEN | #4 | Missing 3 Zod v4 codes: `invalid_union`, `invalid_key`, `invalid_element` (confirmed #6: ZOD_ERROR_CODE_MAP has 23 entries, these 3 missing) |
| GAP-036-028 | MEDIUM | OPEN | #4 | Unreachable v3 code: 4 cases in generateUserFriendlyMessage + 3 in generateSuggestion (confirmed #6: ~20 dead lines) |
| GAP-036-029 | HIGH | OPEN | #4 | Field naming confusion: `message` and `translatedMessage` both contain i18n keys (confirmed #6: both fields duplicative) |
| GAP-036-030 | MEDIUM | OPEN | #4 | defaultHook wraps `details: transformedError`, middleware assigns `error: transformedError` directly (confirmed #6: 3 different response shapes identified) |
| GAP-036-031 | HIGH | OPEN | #4 | ContactForm raw fetch() at line 134 (confirmed #6: bypasses apiClient, no centralized error parsing) |
| GAP-036-032 | HIGH | OPEN | #4 | JSON.parse in EntityEditContent:115 AND EntityCreateContent:199 (confirmed #6: both files do unsafe parse, no schema validation, silent fallback) |
| GAP-036-033 | HIGH | OPEN | #4 | Extract script ends at line 352 with JSON write, no verification phase (confirmed #6: no comparison with validation.json) |
| GAP-036-034 | MEDIUM | OPEN | #4 | No e2e i18n flow test (confirmed #6: 38 total test cases across 3 files but none chain full pipeline) |
| GAP-036-035 | LOW | OPEN | #4 | 11 Spanish translations with English field names (confirmed #6: homePhone, mobilePhone, personalEmail, workEmail, workPhone, isEmailVerified, linkUrl, allowEmails, etc.) |
| GAP-036-036 | LOW | OPEN | #4 | generateOverallMessage() returns "0 errors across 0 fields" for empty issues (confirmed #6: lines 541-557, no guard for totalErrors===0) |
| GAP-036-037 | MEDIUM | OPEN | #5 | Malformed 2-segment zodError keys in entity-template.schema.ts (confirmed #6: 6 warnings in inventory, keys resolve via root-level fallbacks) |
| GAP-036-038 | MEDIUM | NOT A GAP (RECLASSIFIED #6) | #5 | All `as` type casts on typeConfig are guarded by `config.type === FieldTypeEnum.X` checks. 14 instances verified safe |
| GAP-036-039 | MEDIUM | OPEN | #5 | Inconsistent ARIA: ContactForm A+, ReviewForm A-, ProfileEditForm B, ReviewEditForm F (confirmed #6 with detailed matrix) |
| GAP-036-040 | HIGH | OPEN | #6 | Admin app error parsing incompatible with defaultHook response format |
| GAP-036-041 | MEDIUM | OPEN | #6 | ReviewForm ratings fieldset missing error ID for aria-describedby |
| GAP-036-042 | LOW | OPEN | #6 | ProfileEditForm bio error missing aria-live="polite" |
| GAP-036-043 | LOW | OPEN | #6 | Extract script (scripts/extract-zod-keys.ts) has no test file |

---

## Gap Registry

### GAP-036-001: `zod-error-transformer.ts` exceeds 500-line limit
- **Audit**: #1 | **Status**: OPEN (verified #2, #3, #4, #5, #6)
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 2/4
- **Type**: Code Quality Violation
- **Phase**: Phase 2

**Description**: `apps/api/src/utils/zod-error-transformer.ts` is 640 lines, violating the project's 500-line maximum per file rule.

**Evidence** (Audit #6): File confirmed at 640 lines. Contains 3 exported functions (transformZodError, groupErrorsByField, getSimplifiedErrors) + 7 internal functions + 3 interfaces. Largest functions: `generateUserFriendlyMessage()` (~130 lines) and `generateSuggestion()` (~130 lines). Also contains ~28 lines of dead code (GAP-024) and ~20 lines of unreachable code (GAP-028).

**Proposed Solution**:
- **Option A (recommended)**: Extract into 3 files: `zod-error-types.ts` (interfaces, ~75 lines), `zod-error-messages.ts` (generateUserFriendlyMessage + generateSuggestion, ~260 lines), main file (~305 lines). Also remove dead code (GAP-024, GAP-028).
- **Option B**: Extract maps + param extraction into `zod-error-maps.ts`.

**Recommendation**: Fix directly, combining with GAP-024 and GAP-028. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Opción A: split en 3 archivos (types, messages, principal) + remover dead code (GAP-024, GAP-028). Hacer DESPUÉS de GAP-027 y GAP-029.

---

### GAP-036-002: TypeScript compilation error in `@repo/config`
- **Audit**: #1 | **Status**: FIXED (verified #2)
- **Severity**: HIGH

**Resolution**: Fixed. The code now uses `.errors` which is valid in Zod 3.x/4.x.

---

### GAP-036-003: Missing test coverage for complex Zod patterns in transformer
- **Audit**: #1 | **Status**: PARTIALLY FIXED (verified #2, #3, #4, #5, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 3/4
- **Type**: Test Coverage Gap
- **Phase**: Phase 2

**Description**: `zod-error-transformer.test.ts` has 9 test blocks (263 lines) but covers only ~5 of 20 most common error codes.

**Evidence** (Audit #6 - complete matrix):

| Error Code | Key Count | Tested? | Test File |
|-----------|-----------|---------|-----------|
| `min` (too_small) | 227 | YES | validate-form.test.ts:81 |
| `required` | 226 | NO | -- |
| `invalidType` | 197 | YES | zod-error-transformer.test.ts:49 |
| `max` (too_big) | 171 | YES | validate-form.test.ts:119 |
| `invalid` (email) | 72 | YES | zod-error-transformer.test.ts:156 |
| `int` | 37 | NO | -- |
| `uuid` | 29 | NO | -- |
| `enum` | 16 | YES | zod-error-transformer.test.ts:162 |
| `tooHigh` | 15 | NO | -- |
| `positive` | 14 | NO | -- |
| `tooLow` | 14 | NO | -- |
| `pattern` | 13 | NO | -- |
| `format` | 11 | NO | -- |
| `invalidDate` | 8 | NO | -- |
| `min_value` | 7 | NO | -- |
| `max_value` | 6 | NO | -- |
| `invalidBoolean` | 6 | NO | -- |
| `invalidUuid` | 5 | NO | -- |
| `url` | 5 | NO | -- |
| `length` | 4 | NO | -- |

**Test coverage: 5/20 (25%) of most common error codes**

**Proposed Solution**: Add 15+ test cases covering untested codes. Combine with GAP-016 work.

**Recommendation**: Fix directly. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Agregar ~15 tests para códigos faltantes. Combinar con GAP-016 (mismo scope).

---

### GAP-036-004: `create-app.test.ts` doesn't validate defaultHook presence
- **Audit**: #1 | **Status**: OPEN (verified #2, #3, #4, #5, #6)
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 1/4
- **Type**: Test Coverage Gap
- **Phase**: Phase 0

**Description**: `apps/api/test/utils/create-app.test.ts` lines 146-149 only verifies `strict: false` but doesn't verify `defaultHook: expect.any(Function)`.

**Mitigating Factor**: `create-app.defaulthook.test.ts` (16 tests) validates defaultHook behavior e2e. But if defaultHook is accidentally removed, the main test suite won't catch it.

**Recommendation**: Fix directly (1-line change). No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Agregar assertion de 1 línea para defaultHook presence.

---

### GAP-036-005: No explicit tests for query/params/headers validation via defaultHook
- **Audit**: #1 | **Status**: FIXED (verified #2)

**Resolution**: Dedicated test file provides comprehensive body validation coverage. Hook is target-agnostic.

---

### GAP-036-006: Schema registry `getEntitySchema()` unused but exists
- **Audit**: #1 | **Status**: OPEN (verified #2, #3, #4, #5, #6)
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 1/4
- **Type**: Dead Code
- **Phase**: Phase 3

**Description**: `getEntitySchema()` and `SCHEMA_REGISTRY` in `apps/admin/src/lib/validation/schema-registry.ts` (line 117) are never called from production code. All 24 pages import schemas directly.

**Evidence** (Audit #6): Grep confirms zero production usage. Schema is passed directly via `zodSchema` prop to EntityFormProvider from each page.

**Recommendation**: Remove (YAGNI). Fix directly. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Confirmar zero production imports durante implementación y remover si es dead code (YAGNI). Si se encuentra uso real, mantener.

---

### GAP-036-007: `EntityEditContent` accepts but ignores `zodSchema` prop
- **Audit**: #1 | **Status**: OPEN (verified #4, #5, #6)
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 1/4
- **Type**: Dead Prop / Code Smell
- **Phase**: Phase 3

**Description**: `EntityEditContent.tsx` line 34 destructures `zodSchema: _zodSchema` (unused, underscore-prefixed).

**Evidence** (Audit #6): Validation happens upstream: EntityPageBase passes zodSchema to EntityFormProvider directly (line 317). EntityEditContent accesses validation via `useEntityForm()` context hook. The prop is vestigial.

**Proposed Solution**: Remove `zodSchema` from `EntityEditContentProps` and stop passing it.

**Recommendation**: Fix directly (cleanup). No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Remover prop muerto `zodSchema` de EntityEditContentProps.

---

### GAP-036-008: No array/list field validation tests in admin integration
- **Audit**: #1 | **Status**: OPEN (verified #2, #3, #4, #5, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 2/4
- **Type**: Test Coverage Gap
- **Phase**: Phase 4

**Description**: Admin form integration tests cover flat and nested dot-notation fields but NOT array field errors, dynamic add/remove validation, or file upload validation.

**Evidence** (Audit #6): GalleryField.tsx handles GalleryImage[] with 0 tests. No `GalleryField.test.ts` exists. Also missing tests for nested objects (location.country, price.basePrice).

**Recommendation**: Fix directly. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Agregar tests para array fields (GalleryField) y nested objects (location, price).

---

### GAP-036-009: Web app forms don't use Zod validation or validation translations
- **Audit**: #1 | **Status**: OPEN (verified #2, #3, #4, #5, #6)
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 4/4
- **Type**: Cross-cutting Scope Gap

**Description**: Web app forms use custom validation logic with manual i18n keys, bypassing the Zod schema validation system.

**Evidence** (Audit #6 - complete form audit):

| Form | File | Validation | Zod? | @repo/schemas? | ARIA Grade |
|------|------|-----------|------|---------------|------------|
| ContactForm | `components/content/ContactForm.client.tsx` (354 lines) | Manual regex + string length | NO | NO | A+ |
| ReviewForm | `components/review/ReviewForm.client.tsx` (406 lines) | Manual array checks | NO | NO | A- |
| ReviewEditForm | `components/account/ReviewEditForm.client.tsx` (194 lines) | None (delegates to parent) | NO | NO | F |
| ProfileEditForm | `components/account/ProfileEditForm.client.tsx` (315 lines) | Manual string length | NO | NO | B |
| HeroSearchForm | `components/hero/HeroSearchForm.tsx` | None (search form) | NO | NO | N/A |

All forms use `useTranslation()` for labels/messages but none use validation.json or `resolveValidationMessage()`.

**Contrast**: `packages/feedback/src/components/FeedbackForm.tsx` DOES use `feedbackFormSchema.safeParse()` correctly, proving the pattern works.

**Impact**: Validation rule drift between client and server. Duplicated validation logic.

**Recommendation**: NEW SPEC required. Architectural decisions needed about web form Zod integration.

**Decisión (2026-03-10)**: HACER. Opción B (validación manual estandarizada, SIN Zod en web). Razón: 11 campos simples con reglas triviales no justifican el overhead de Zod en bundle web (Astro islands). Implementación:
1. Crear helper ligero `validateField()` compartido en web (~20 líneas, sin Zod)
2. Estandarizar patrón de error display con ARIA (resuelve GAP-039/026 de paso)
3. Usar claves de `validation.json` para mensajes (mensajes centralizados aunque lógica no)
Fix directo sin SPEC formal.

---

### GAP-036-010: No automated i18n key sync detection for schema changes
- **Audit**: #1 | **Status**: OPEN (verified #2, #3, #4, #5, #6)
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 3/4
- **Type**: Process / Tooling Gap

**Description**: No CI check validates that zodError.* keys in schemas have corresponding translations.

**Evidence** (Audit #6): `.github/workflows/ci.yml` has zero matches for "i18n", "validation", "extract", or "sync". Extract script exists (`scripts/extract-zod-keys.ts`, 353 lines) but is manual-only and has no verification logic (see GAP-033).

**Proposed Solution**:
- **Option A (recommended)**: Add CI job: run extract-zod-keys.ts -> compare with validation.json -> fail if gaps
- **Option B**: Add as vitest test that runs during `pnpm test`

**Recommendation**: Fix directly with Option A. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Ambas opciones: vitest test que valida sync de claves zodError vs validation.json + CI job dedicado que lo ejecuta. Combinar con GAP-033 y GAP-043.

---

### GAP-036-011: Email validation inconsistency between web forms and Zod schemas
- **Audit**: #1 | **Status**: OPEN (verified #4, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 1/4
- **Type**: Validation Mismatch

**Description**: ContactForm uses `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (permissive, accepts `a@b.c`), Zod uses `.email()` (RFC 5322, stricter).

**Recommendation**: Part of GAP-036-009 (web form Zod integration). No separate fix needed.

**Decisión (2026-03-10)**: HACER. Se resuelve como parte de GAP-009 (helper `validateField()` con regex email estandarizado).

---

### GAP-036-012: ContactForm missing `role="alert"` on error messages
- **Audit**: #1 | **Status**: FIXED (verified #2, #3, #6)

**Resolution**: All error `<p>` elements include `role="alert"` and `aria-live="polite"`.

---

### GAP-036-013: Missing CRUD schemas for 3 entities
- **Audit**: #1 | **Status**: OPEN (verified #4, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 2/4
- **Type**: Pre-existing / Schema Completeness

**Description**: Three entities lack `.crud.schema.ts` files: owner-promotion, permission, sponsorship.

**Evidence** (Audit #6): 18/21 entities have CRUD schemas. The 3 missing entities don't have dedicated admin CRUD pages yet.

**Recommendation**: Track as tech debt for when those admin pages are built.

**Decisión (2026-03-10)**: HACER PARCIAL. Crear crud schemas para owner-promotion y sponsorship. Permission descartado: los permisos se gestionan solo por código, no desde admin panel.

---

### GAP-036-014: Dynamic keys in extraction script require manual updates
- **Audit**: #1 | **Status**: PARTIALLY FIXED (verified #4, #6)
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 1/4
- **Type**: Maintenance / Documentation

**Description**: `scripts/extract-zod-keys.ts` hardcodes 40+ factory function key mappings. No verification test.

**Evidence** (Audit #6): All factory functions (priceField, guestField, roomField, ratingField, coordinateField, distanceField, dateField, booleanField, ageField, plus HttpFieldSets) verified complete. But script has no tests (see GAP-043).

**Recommendation**: Fix directly (add tests). No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Se resuelve como parte de GAP-043 (tests del extract script).

---

### GAP-036-015: Admin forms lack debounce on blur validation
- **Audit**: #1 | **Status**: OPEN (verified #4, #5, #6)
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 2/4
- **Type**: UX / Performance

**Description**: `EntityFormProvider.tsx` calls `validateField()` synchronously on blur with no debounce.

**Mitigating Factor**: Zod validation is synchronous and fast (< 1ms). Only a concern with very complex schemas.

**Recommendation**: No action needed now. Monitor performance.

**Decisión (2026-03-10)**: DESCARTAR. Zod validation es sincrónica y <1ms. Agregar debounce es YAGNI y agrega complejidad innecesaria.

---

### GAP-036-016: Transformer test coverage: only ~5/20 top error codes tested
- **Audit**: #2 | **Status**: OPEN (verified #3, #4, #5, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 3/4
- **Type**: Test Coverage Gap
- **Phase**: Phase 2

**Description**: Transformer maps 23 error codes but tests only cover ~5 of top 20 most common.

**Evidence** (Audit #6): Missing tests for: `required` (226 keys!), `int` (37), `uuid` (29), `tooHigh` (15), `positive` (14), `tooLow` (14), `pattern` (13), `format` (11), `invalidDate` (8), `invalidBoolean` (6), `url` (5), `length` (4), plus Zod v4 codes from GAP-027.

**Recommendation**: Fix directly. Combine with GAP-003. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Combinado con GAP-003 (mismo scope de test coverage).

---

### GAP-036-017: Error boundaries don't differentiate Zod validation errors
- **Audit**: #2 | **Status**: NOT A GAP (RECLASSIFIED #6)
- **Severity**: N/A
- **Priority**: N/A

**Evidence** (Audit #6): This is BY DESIGN. The validation architecture works as follows:
1. EntityFormProvider catches Zod validation errors and returns `Record<string, string>` of field errors (lines 131-160)
2. EntityCreateContent (lines 191-235) and EntityEditContent (lines 89-163) catch API validation errors BEFORE they reach the error boundary
3. Error boundaries only see uncaught exceptions, which are never ZodErrors in the current architecture

Validation errors are shown as field-level messages, never thrown as exceptions. The error boundary correctly handles only unexpected errors (404, 403, network, generic).

**Resolution**: Reclassified as NOT A GAP. No action needed.

---

### GAP-036-018: Feedback form uses Zod with custom mapping
- **Audit**: #2 | **Status**: OPEN (verified #4, #6)
- **Severity**: LOW
- **Priority**: P4

**Evidence** (Audit #6): FeedbackForm DOES use Zod (`feedbackFormSchema.safeParse()`). Maps errors via custom `mapZodMessage()` to `FEEDBACK_STRINGS`. Self-contained package.

**Recommendation**: No action needed. YAGNI.

**Decisión (2026-03-10)**: DESCARTAR. YAGNI. Paquete self-contained que funciona correctamente. Migrar no agrega valor.

---

### GAP-036-019: Auth UI forms don't use Zod client-side validation
- **Audit**: #2 | **Status**: OPEN (verified #4, #6)
- **Severity**: LOW
- **Priority**: P4

**Evidence** (Audit #6): Auth forms use Better Auth's built-in validation. By design.

**Recommendation**: No action needed.

**Decisión (2026-03-10)**: DESCARTAR. By design. Better Auth maneja su propia validación. Agregar Zod sería duplicar lógica.

---

### GAP-036-020: Schema fields with missing zodError.* message keys
- **Audit**: #2 | **Status**: FALSE POSITIVE (verified #3, #4)

**Resolution**: Feature translations exist at line 1603+ of `es/validation.json`.

---

### GAP-036-021: EN/PT translations are placeholder-only, not real translations
- **Audit**: #2 | **Status**: OPEN (verified #3, #4, #5, #6)
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 3/4
- **Type**: Incomplete Implementation
- **Phase**: Phase 1

**Description**: All ~2,732 lines in EN and PT validation.json are Spanish text with `[EN]`/`[PT]` prefixes. Zero real translations.

**Evidence** (Audit #6): 1,134 validation keys in each locale file, all prefixed with `[EN]` or `[PT]`. Per spec, this was intentional as a Phase 1 non-goal, but the translations need to be done.

**Recommendation**: NEW SPEC or formal translation task.

**Decisión (2026-03-10)**: POSTERGAR. Mercado actual es Argentina (español). Traducir 1,134 claves a EN/PT cuando se expanda a mercados no-hispanos.

---

### GAP-036-022: defaultHook response structure has redundant nesting
- **Audit**: #3 | **Status**: OPEN (verified #4, #5, #6)
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 1/4
- **Type**: API Response Bug
- **Phase**: Phase 0

**Description**: `create-app.ts` line 92 sets `details: transformedError` (entire ValidationErrorResponse), creating `error.details.details` nesting.

**Evidence** (Audit #6 - full flow trace):
```
defaultHook returns:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "validationError.validation.failed",
    "details": {                           // <-- PROBLEM: entire object
      "code": "VALIDATION_ERROR",          // <-- duplicated
      "message": "...",                    // <-- duplicated
      "translatedMessage": "...",
      "userFriendlyMessage": "...",
      "details": [ /* field errors */ ],   // <-- actual errors nested here
      "summary": { ... }
    }
  }
}
```

Test at `create-app.defaulthook.test.ts` line 230 validates this broken structure: `expect(Array.isArray(details.details)).toBe(true)`.

**Related**: GAP-036-030, GAP-036-040.

**Proposed Solution**: Change line 92 to `details: transformedError.details, summary: transformedError.summary`.

**Recommendation**: Fix directly. No new SPEC needed. MUST coordinate with GAP-040 (admin parsing).

**Decisión (2026-03-10)**: HACER. Fix directo en batch junto con GAP-030 y GAP-040. Aplanar estructura de respuesta.

---

### GAP-036-023: defaultHook tests only cover body validation, not query/params/headers
- **Audit**: #3 | **Status**: OPEN (verified #4, #5, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 2/4
- **Type**: Test Coverage Gap
- **Phase**: Phase 0

**Description**: 16 tests all use body schema. Zero tests for query, path params, or headers.

**Mitigating Factor**: Hook is target-agnostic (same code path for all validation targets).

**Recommendation**: Fix directly. Add 2-3 tests. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Agregar 2-3 smoke tests para query y path params.

---

### GAP-036-024: `groupErrorsByField()` and `getSimplifiedErrors()` are dead code
- **Audit**: #3 | **Status**: OPEN (verified #4, #5, #6)
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 1/4
- **Type**: Dead Code
- **Phase**: Phase 2

**Description**: Two exported functions at lines 613-640 never called from production code. Neither has tests.

**Recommendation**: Remove as part of GAP-001 refactoring. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Remover como parte de GAP-001 (split del archivo).

---

### GAP-036-025: 3 shorthand zodError keys (2-segment) missing from validation.json
- **Audit**: #3 | **Status**: FALSE POSITIVE (reclassified #4)

**Resolution**: Keys exist at root level in validation.json. `resolveValidationMessage()` correctly maps them.

---

### GAP-036-026: ReviewEditForm.client.tsx has no accessibility attributes on error states
- **Audit**: #3 | **Status**: OPEN (verified #4, #5, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 1/4
- **Type**: Accessibility Gap
- **Phase**: Cross-cutting

**Description**: `ReviewEditForm.client.tsx` (194 lines) lacks all form accessibility attributes.

**Evidence** (Audit #6 - detailed matrix):

| Attribute | rating | title | content |
|-----------|--------|-------|---------|
| `aria-required` | NO | NO | NO |
| `aria-invalid` | NO | NO | NO |
| `aria-describedby` | NO | NO | NO |
| Error `role="alert"` | NO | NO | NO |
| Field labels | YES | YES | YES |
| `role="radiogroup"` for stars | YES | N/A | N/A |
| `role="radio"` + `aria-checked` | YES | N/A | N/A |

Star rating uses proper radiogroup pattern but form fields lack accessibility. WCAG 2.1 Level A violation.

**Recommendation**: Fix directly. Part of GAP-039 scope. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Se resuelve como parte de GAP-009 (helper validateField + patrón ARIA compartido).

---

### GAP-036-027: Missing Zod v4 error codes in transformer (CRITICAL)
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: CRITICAL
- **Priority**: P1
- **Complexity**: 2/4
- **Type**: Compatibility Bug
- **Phase**: Phase 2

**Description**: `zod-error-transformer.ts` maps 23 error codes in `ZOD_ERROR_CODE_MAP` (lines 105-130) and `ZOD_ERROR_MESSAGE_MAP` (lines 135-160), but **3 Zod v4 error codes are missing**: `invalid_union`, `invalid_key`, `invalid_element`.

**Evidence** (Audit #6): Verified 23 exact entries in each map. Missing codes:
- `invalid_union`: Raised by `z.union()` and `z.discriminatedUnion()` when no variant matches
- `invalid_key`: Raised by `z.record()` when key validation fails
- `invalid_element`: Raised by `z.array()` / `z.set()` when element validation fails

Current behavior: Falls back to `'UNKNOWN_VALIDATION_ERROR'` + generic message. Users get unhelpful error messages for union/record/array failures.

**Proposed Solution**:
1. Add 3 entries to `ZOD_ERROR_CODE_MAP` and `ZOD_ERROR_MESSAGE_MAP`
2. Add cases to `generateUserFriendlyMessage()` and `generateSuggestion()`
3. Add `extractErrorParams()` handling for union errors
4. Add translation keys to `validation.json` for all 3 locales
5. Add 3+ tests

**Recommendation**: Fix directly. CRITICAL priority. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Agregar los 3 códigos faltantes + tests + traducciones. Fix directo sin SPEC.

---

### GAP-036-028: Unreachable Zod v3 code in transformer
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 1/4
- **Type**: Dead Code / Zod Version Mismatch
- **Phase**: Phase 2

**Description**: Switch cases for Zod v3 error codes that Zod v4 never generates.

**Evidence** (Audit #6): In `generateUserFriendlyMessage()`:
- Line 342: `case 'invalid_date'` (v4 uses `invalid_format` with `format: 'date'`)
- Line 345: `case 'invalid_email'` (v4 uses `invalid_format` with `format: 'email'`)
- Line 348: `case 'invalid_url'` (v4 uses `invalid_format` with `format: 'url'`)
- Line 351: `case 'invalid_uuid'` (v4 uses `invalid_format` with `format: 'uuid'`)

Same pattern in `generateSuggestion()` lines 481-488. Total ~20 unreachable lines.

**Recommendation**: Remove as part of GAP-001 refactoring. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Remover 7 cases muertos como parte de GAP-001 (split del archivo).

---

### GAP-036-029: Message field naming confusion
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 2/4
- **Type**: Misleading API / Documentation
- **Phase**: Phase 2

**Description**: In `zod-error-transformer.ts` line 588:
```typescript
message: err.message.startsWith('zodError.') ? err.message : translationKey,
translatedMessage: err.message,
```

Both `message` and `translatedMessage` end up containing i18n **keys**, not actual translated text. API consumers see:
```json
{
  "message": "zodError.accommodation.name.required",
  "translatedMessage": "zodError.accommodation.name.required",
  "userFriendlyMessage": "Name is required"
}
```

**Impact**: Naming is misleading but logic works. Admin app calls `resolveValidationMessage()` on these.

**Proposed Solution**:
- **Option A**: Rename fields for clarity: `messageKey`, `zodMessage`
- **Option B (recommended)**: Add JSDoc to `TransformedValidationError` interface clarifying what each field contains

**Recommendation**: Fix directly with Option B. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Opción A (renombrar campos a `messageKey`/`zodMessage`) + Opción B (agregar JSDoc post-rename). Breaking change en API response, coordinar con fix de GAP-022/030/040 que ya toca la misma estructura.

---

### GAP-036-030: Inconsistent response format between defaultHook and validation middleware
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/4
- **Type**: API Consistency Issue
- **Phase**: Phase 0/2

**Description**: The transformer is used in 3 places with **different response structures**.

**Evidence** (Audit #6 - 3 paths identified):

```typescript
// Path 1: defaultHook (create-app.ts:86-98)
error: { code, message, details: transformedError }  // Wraps ENTIRE object

// Path 2: validation middleware Zod handler (validation.ts:117-131)
error: transformedError  // Direct assignment

// Path 3: validation middleware ValidationError handler (validation.ts:159-177)
error: { code, message, details: error.details }  // Wraps only details
```

**Impact**: API clients get different response shapes: `response.error.details.details` (Path 1) vs `response.error.details` (Path 2) vs `response.error.details` (Path 3).

**Proposed Solution**: Standardize all 3 to use the same envelope format. Fix in conjunction with GAP-022.

**Recommendation**: Fix directly. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Parte del batch GAP-022/030/040. Estandarizar los 3 paths al mismo formato.

---

### GAP-036-031: ContactForm uses raw fetch() instead of centralized apiClient
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 2/4
- **Type**: Architecture Violation
- **Phase**: Cross-cutting

**Description**: `apps/web/src/components/content/ContactForm.client.tsx` line 134 uses raw `fetch()` to `/api/v1/public/contact`.

**Evidence** (Audit #6): Manual error handling, no timeout, no structured error parsing, no Sentry tracking. Other forms (ReviewForm, ProfileEditForm) correctly use API wrapper helpers (`reviewsApi`, `userApi`).

**Proposed Solution**: Create `contactApi.sendContactMessage()` wrapper using apiClient.

**Recommendation**: Fix directly. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Crear wrapper `contactApi.sendContactMessage()` usando apiClient existente.

---

### GAP-036-032: Fragile Zod error parsing in EntityEditContent AND EntityCreateContent
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 2/4
- **Type**: Error Handling Fragility
- **Phase**: Phase 3

**Description**: Both files parse API validation errors via `JSON.parse(error.message)`, assuming error message is JSON-stringified array of Zod issues.

**Evidence** (Audit #6):
- EntityCreateContent.tsx lines 197-220: `JSON.parse(error.message)`
- EntityEditContent.tsx lines 112-147: `JSON.parse(apiError.body.error.message)`

Both have try-catch fallbacks (won't crash), but:
- No validation of parsed structure
- Silently loses field-level errors on parse failure
- Couples frontend to backend error serialization format
- Code duplication between two files

**Proposed Solution**:
- **Option A (recommended)**: Create shared `parseApiValidationErrors()` utility with structure validation
- **Option B**: Type the API error response with Zod schema

**Recommendation**: Fix directly. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Opción A+B combinadas: crear utility compartido `parseApiValidationErrors()` que usa internamente un Zod schema (`ApiValidationErrorSchema`) para parsear respuestas de error de forma segura. Elimina JSON.parse crudo y duplicación entre EntityCreateContent/EntityEditContent.

---

### GAP-036-033: Extract script doesn't verify keys exist in i18n files
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 2/4
- **Type**: Tooling Gap
- **Phase**: Phase 1

**Description**: `scripts/extract-zod-keys.ts` (353 lines) discovers zodError.* keys and outputs to `zod-keys-inventory.json`, but does NOT verify that extracted keys have corresponding entries in `validation.json`.

**Evidence** (Audit #6): Script extracts 1,112 unique keys. No comparison logic with `packages/i18n/src/locales/{es,en,pt}/validation.json`. No tests for the script (see GAP-043).

**Proposed Solution**: Add verification mode:
1. Load all locale validation.json files after key discovery
2. Compare extracted keys with translation entries
3. Report missing translations per locale
4. Exit non-zero if gaps found
5. Use in CI (combines with GAP-010)

**Recommendation**: Fix directly. Combine with GAP-010. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Agregar modo verificación al script (comparar claves vs validation.json, exit non-zero si gaps). Combinar con GAP-010 (CI) y GAP-043 (tests).

---

### GAP-036-034: No end-to-end i18n flow integration test
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 2/4
- **Type**: Test Coverage Gap
- **Phase**: Phase 4

**Description**: Individual components tested in isolation but no test validates the complete flow: Zod validation error -> error transformation -> i18n message resolution -> actual translation lookup.

**Evidence** (Audit #6): 38 total test cases across 3 files but none chain the full pipeline with real i18n files.

**Recommendation**: Fix directly. Create `test/integration/zod-i18n-flow.test.ts`. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Crear test de integración e2e del pipeline Zod → transformer → i18n resolution.

---

### GAP-036-035: Auto-generated translation quality issues
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 2/4
- **Type**: Localization Quality
- **Phase**: Phase 1

**Description**: 11 Spanish translations contain English field names.

**Evidence** (Audit #6):
- `"El home phone no es valido"` (should be "telefono particular")
- `"El mobile phone no es valido"` (should be "telefono celular")
- `"El personal email no es valido"` (should be "email personal")
- `"El work email no es valido"` (should be "email laboral")
- `"El work phone no es valido"` (should be "telefono laboral")
- `"El is email verified debe ser verdadero o falso"` (English identifier)
- `"El link url no es valido"` (should be "URL del enlace")
- `"El allow emails es obligatorio"` (should be "permitir emails")
- Plus 3 more in user.settings namespace

**Recommendation**: Track as tech debt. Native speaker review needed.

**Decisión (2026-03-10)**: HACER. Corregir las 11 traducciones con nombres de campos en español correcto.

---

### GAP-036-036: Empty ZodError (0 issues) edge case not handled
- **Audit**: #4 | **Status**: OPEN (verified #5, #6)
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 1/4
- **Type**: Defensive Programming
- **Phase**: Phase 2

**Description**: `generateOverallMessage()` (lines 541-557) has no case for `totalErrors === 0`. Returns `"Please fix the validation errors (0 errors across 0 fields)"`.

**Recommendation**: Fix directly. Add guard: `if (totalErrors === 0) return 'No validation errors found'`. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Agregar guard de 1 línea para totalErrors === 0.

---

### GAP-036-037: Malformed 2-segment zodError keys in entity-template.schema.ts
- **Audit**: #5 | **Status**: OPEN (verified #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 1/4
- **Type**: Schema Key Convention Violation
- **Phase**: Phase 1

**Description**: 6 zodError keys with only 2 segments (e.g., `zodError.required`, `zodError.positive`) in entity-template.schema.ts and validation-messages.ts.

**Evidence** (Audit #6): Extract script logged 6 warnings. Keys resolve correctly via root-level fallbacks in validation.json, but pattern is inconsistent with the 3+ segment convention used by all other ~1,100 keys.

**Recommendation**: Fix directly: document 2-segment shorthand as intentional convention for generic messages. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Documentar 2-segment shorthand como convención intencional para mensajes genéricos.

---

### GAP-036-038: Unsafe `as` type casts on typeConfig in admin field components
- **Audit**: #5 | **Status**: NOT A GAP (RECLASSIFIED #6)
- **Severity**: N/A
- **Priority**: N/A

**Evidence** (Audit #6): All 14 instances of `as` type casts on typeConfig are properly guarded by type checks:
```typescript
const selectConfig =
    config.type === FieldTypeEnum.SELECT    // <-- type guard
        ? (config.typeConfig as SelectFieldConfig)  // <-- safe cast
        : undefined;
```

Pattern confirmed in: GalleryField.tsx:90, SelectField.tsx:101, CurrencyField.tsx:87, RichTextField.tsx:97, ImageField.tsx:81, TextareaField.tsx:76, EntitySelectField.tsx:77, EntityFormSection.tsx:181, EntityViewSection.tsx:174/268, and 5 more.

**Resolution**: Reclassified as NOT A GAP. All casts are safe via discriminant checks.

---

### GAP-036-039: Inconsistent ARIA attribute coverage across web form components
- **Audit**: #5 | **Status**: OPEN (verified #6)
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 2/4
- **Type**: Accessibility Gap
- **Phase**: Cross-cutting

**Description**: Web form components have inconsistent ARIA coverage.

**Evidence** (Audit #6 - comprehensive matrix):

| Form | aria-required | aria-invalid | aria-describedby | Error role="alert" | aria-live | Grade |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| ContactForm | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | **A+** |
| ReviewForm | 1/3 (fieldset) | 3/3 | 3/3 | 3/3 | 3/3 | **A-** |
| ProfileEditForm | 2/3 | 3/3 | 3/3 | 2/3 | 0/3 | **B** |
| ReviewEditForm | 0/6 | 0/6 | 0/6 | 0/6 | 0/6 | **F** |
| HeroSearchForm | N/A | N/A | N/A | N/A | N/A | **N/A** |

**Recommendation**: Fix ReviewEditForm (GAP-026) + ProfileEditForm gaps. Create shared `FormError` component with built-in ARIA. Part of GAP-009 scope.

**Decisión (2026-03-10)**: HACER. Se resuelve como parte de GAP-009. Crear componente `FormError` compartido con ARIA built-in. Cubre GAP-026, GAP-041, GAP-042.

---

### GAP-036-040: Admin app error parsing incompatible with defaultHook response format (NEW)
- **Audit**: #6 | **Status**: OPEN
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 2/4
- **Type**: Integration Bug
- **Phase**: Phase 0/3

**Description**: The admin app's error parsing logic cannot correctly parse the defaultHook's nested response structure.

**Evidence** (Audit #6):

The defaultHook returns:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "validationError.validation.failed",
    "details": { "code": "...", "message": "...", "details": [...], "summary": {...} }
  }
}
```

But EntityCreateContent.tsx:199 does:
```typescript
const zodErrors = JSON.parse(error.message);  // Expects JSON-stringified array
```

And `apps/admin/src/lib/errors/api-error.ts` (lines 167-188) `getValidationErrors()` doesn't parse the nested `details.details` structure.

**Impact**: Field-level validation errors from route-level validation (defaultHook path) may not be correctly displayed. The catch block silently falls back to generic error messages.

**Related**: GAP-022 (nesting), GAP-030 (inconsistency), GAP-032 (fragile parsing).

**Proposed Solution**:
1. Fix defaultHook response structure (GAP-022) to flatten `details`
2. Update admin error parsing to handle both current and fixed formats
3. Create shared `parseApiValidationErrors()` utility (GAP-032)

**Recommendation**: Fix directly as part of GAP-022 batch. No new SPEC needed. HIGH priority because it affects actual user experience.

**Decisión (2026-03-10)**: HACER. Parte del batch GAP-022/030/040. Actualizar parsing en admin para acceder a details directamente.

---

### GAP-036-041: ReviewForm ratings fieldset missing error ID for aria-describedby (NEW)
- **Audit**: #6 | **Status**: OPEN
- **Severity**: MEDIUM
- **Priority**: P3
- **Complexity**: 1/4
- **Type**: Accessibility Bug
- **Phase**: Cross-cutting

**Description**: `ReviewForm.client.tsx` renders error message for ratings without an `id` attribute, but the fieldset has `aria-describedby` that references this missing ID.

**Evidence** (Audit #6): Error message at line 308 is rendered without `id="ratings-error"`. The fieldset uses aria-describedby to reference a non-existent element.

**Impact**: Screen readers cannot associate the error message with the fieldset. WCAG 2.1 Level A violation.

**Recommendation**: Fix directly (add `id="ratings-error"` to error element). No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Se resuelve como parte de GAP-009/039 (componente FormError compartido).

---

### GAP-036-042: ProfileEditForm bio error missing aria-live (NEW)
- **Audit**: #6 | **Status**: OPEN
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 1/4
- **Type**: Accessibility Gap
- **Phase**: Cross-cutting

**Description**: `ProfileEditForm.client.tsx` lines 277-285: bio field error message lacks `aria-live="polite"`.

**Evidence** (Audit #6): Error messages for name field have `role="alert"` but bio error messages lack `aria-live`. Char count does have `aria-live="polite"` (line 272), but not the error state.

**Impact**: Screen readers won't announce bio validation errors dynamically.

**Recommendation**: Fix directly. No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Se resuelve como parte de GAP-009/039 (componente FormError compartido).

---

### GAP-036-043: Extract script has no test file (NEW)
- **Audit**: #6 | **Status**: OPEN
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: 2/4
- **Type**: Test Coverage Gap
- **Phase**: Phase 1

**Description**: `scripts/extract-zod-keys.ts` (353 lines) is a critical infrastructure script with no test file.

**Evidence** (Audit #6): No `scripts/extract-zod-keys.test.ts` or equivalent exists. Script handles complex regex patterns, template literal resolution, factory function mapping.. all untested.

**Proposed Solution**: Create `scripts/__tests__/extract-zod-keys.test.ts` with tests for:
- Static key extraction from schemas
- Template literal resolution
- Factory function key mapping
- 2-segment key warning detection
- Output format correctness

**Recommendation**: Fix directly. Combine with GAP-014 (factory verification). No new SPEC needed.

**Decisión (2026-03-10)**: HACER. Crear tests para extract script. Combinar con GAP-010 y GAP-033.

---

## Summary by Severity (All Gaps, Current Status)

| Severity | Total | Open | Fixed | False Positive | Not a Gap |
|----------|-------|------|-------|----------------|-----------|
| CRITICAL | 1 | 1 | 0 | 0 | 0 |
| HIGH | 10 | 9 | 1 | 0 | 0 |
| MEDIUM | 17 | 13 | 1 | 1 | 2 |
| LOW | 15 | 11 | 1 | 1 | 0 |
| **TOTAL** | **43** | **34** | **3** | **2** | **2** |

## Open Gaps by Priority

### P1 (Must fix immediately)
| GAP | Severity | Type | Action |
|-----|----------|------|--------|
| GAP-036-027 | CRITICAL | Zod v4 Compatibility | Fix directly: add 3 missing error codes + tests |
| GAP-036-022 | HIGH | API Response Bug | Fix directly: flatten response structure |
| GAP-036-040 | HIGH | Integration Bug | Fix directly: coordinate with GAP-022 response fix |

### P2 (Should fix soon)
| GAP | Severity | Type | Action |
|-----|----------|------|--------|
| GAP-036-001 | HIGH | Code Quality | Fix directly: split file + remove dead code |
| GAP-036-009 | HIGH | Scope Gap | NEW SPEC: web form Zod integration |
| GAP-036-010 | HIGH | Tooling Gap | Fix directly: add CI check |
| GAP-036-021 | HIGH | Incomplete | NEW SPEC or translation task |
| GAP-036-029 | HIGH | Field Naming | Fix directly: add JSDoc clarification |
| GAP-036-030 | MEDIUM | API Consistency | Fix with GAP-022 (standardize 3 paths) |
| GAP-036-031 | HIGH | Architecture | Fix directly: use apiClient |
| GAP-036-032 | HIGH | Error Handling | Fix directly: create shared utility |
| GAP-036-033 | HIGH | Tooling Gap | Fix directly: add verification to extract script |

### P3 (Fix when convenient)
| GAP | Severity | Type | Action |
|-----|----------|------|--------|
| GAP-036-003 | MEDIUM | Test Gap | Fix directly: add 15+ tests |
| GAP-036-008 | MEDIUM | Test Gap | Fix directly: add array tests |
| GAP-036-011 | MEDIUM | Mismatch | Covered by GAP-009 |
| GAP-036-013 | MEDIUM | Completeness | Track as tech debt |
| GAP-036-016 | MEDIUM | Test Gap | Combine with GAP-003 |
| GAP-036-023 | MEDIUM | Test Gap | Fix directly: add query/params tests |
| GAP-036-026 | MEDIUM | Accessibility | Part of GAP-039 scope |
| GAP-036-028 | MEDIUM | Dead Code | Fix with GAP-001 refactoring |
| GAP-036-034 | MEDIUM | Test Gap | Fix directly: add integration test |
| GAP-036-037 | MEDIUM | Key Convention | Fix directly: document as convention |
| GAP-036-039 | MEDIUM | Accessibility | Fix directly: ARIA + shared FormError component |
| GAP-036-041 | MEDIUM | Accessibility | Fix directly: add error ID |

### P4 (Nice to have)
| GAP | Severity | Type | Action |
|-----|----------|------|--------|
| GAP-036-004 | LOW | Test Gap | Fix directly: 1-line change |
| GAP-036-006 | LOW | Dead Code | Fix directly: remove |
| GAP-036-007 | LOW | Dead Prop | Fix directly: remove prop |
| GAP-036-014 | LOW | Maintenance | Fix directly: add verification test |
| GAP-036-015 | LOW | UX | Monitor, no action now |
| GAP-036-018 | LOW | Scope Gap | No action (YAGNI) |
| GAP-036-019 | LOW | Scope Gap | No action (by design) |
| GAP-036-024 | LOW | Dead Code | Fix with GAP-001 |
| GAP-036-035 | LOW | Translation Quality | Track as tech debt |
| GAP-036-036 | LOW | Edge Case | Fix directly: add guard |
| GAP-036-042 | LOW | Accessibility | Fix directly: add aria-live |
| GAP-036-043 | LOW | Test Gap | Fix directly: add test file |

## Summary by Action

| Action | Count | GAP IDs |
|--------|-------|---------|
| Fix directly (no SPEC) | 25 | 001, 003, 004, 006, 007, 008, 010, 014, 016, 022, 023, 024, 027, 028, 029, 030, 032, 033, 034, 036, 037, 040, 041, 042, 043 |
| New SPEC required | 2 | 009 (web form Zod), 021 (EN/PT translations) |
| No action / monitor | 7 | 011, 013, 015, 018, 019, 035, 039 (partial - ReviewEditForm needs fix) |
| Already fixed | 3 | 002, 005, 012 |
| False positive | 2 | 020, 025 |
| Not a gap (reclassified) | 2 | 017 (by design), 038 (safe casts) |

## Summary by Phase

| Phase | Open Gaps | Status |
|-------|-----------|--------|
| Phase 0: API defaultHook | 004, 022, 023, 030, 040 | Response structure has critical nesting bug + admin incompatibility |
| Phase 1: i18n Infrastructure | 010, 021, 033, 035, 037, 043 | Core works. CI sync, EN/PT translations, script verification + tests |
| Phase 2: Error Unification | 001, 003, 016, 024, 027, 028, 029, 036 | **Most issues**. Zod v4 compat, dead code, test coverage, naming |
| Phase 3: Admin Integration | 006, 007, 008, 032 | Core works. Dead code/props, test gaps, fragile parsing |
| Phase 4: Testing | 034 | Missing integration test |
| Cross-cutting | 009, 011, 026, 031, 039, 041, 042 | Web forms, accessibility, architecture |

---

## Recommended Fix Order

### Batch 1: Critical + API Response Fix (estimated 2-3h)
1. **GAP-036-027** (45 min) - Add 3 missing Zod v4 error codes + tests **[CRITICAL]**
2. **GAP-036-022 + GAP-036-030 + GAP-036-040** (60 min) - Fix defaultHook response nesting + standardize all 3 validation paths + update admin parsing **[HIGH - interconnected]**
3. **GAP-036-029** (15 min) - Add JSDoc to TransformedValidationError interface

### Batch 2: File Cleanup + Dead Code (estimated 1h)
4. **GAP-036-024** (10 min) - Remove dead functions (groupErrorsByField, getSimplifiedErrors)
5. **GAP-036-028** (10 min) - Remove unreachable Zod v3 switch cases
6. **GAP-036-006** (10 min) - Remove dead getEntitySchema()
7. **GAP-036-007** (10 min) - Remove dead _zodSchema prop
8. **GAP-036-036** (5 min) - Add empty issues guard
9. **GAP-036-001** (30 min) - Split zod-error-transformer.ts (after dead code removed)

### Batch 3: Test Coverage (estimated 3-4h)
10. **GAP-036-003 + GAP-036-016** (2h) - Add 15+ transformer tests for untested error codes
11. **GAP-036-023** (30 min) - Add query/params/headers tests for defaultHook
12. **GAP-036-004** (5 min) - Add defaultHook presence assertion
13. **GAP-036-034** (45 min) - Create e2e i18n flow integration test
14. **GAP-036-008** (30 min) - Add array/nested field validation tests

### Batch 4: Tooling + CI (estimated 2h)
15. **GAP-036-033** (45 min) - Add verification mode to extract script
16. **GAP-036-010** (30 min) - Add CI job for i18n key sync
17. **GAP-036-043** (30 min) - Add tests for extract script
18. **GAP-036-032** (30 min) - Create shared parseApiValidationErrors utility

### Batch 5: Web + Accessibility (estimated 1-2h)
19. **GAP-036-031** (30 min) - Replace ContactForm raw fetch() with apiClient
20. **GAP-036-026** (20 min) - Add ARIA to ReviewEditForm
21. **GAP-036-041** (10 min) - Add error ID to ReviewForm ratings
22. **GAP-036-042** (10 min) - Add aria-live to ProfileEditForm bio error
23. **GAP-036-037** (15 min) - Document 2-segment key convention

### Deferred: Requires New SPEC
24. **GAP-036-009** - Web form Zod integration (complexity 4/4, architectural decisions needed)
25. **GAP-036-021** - Real EN/PT translations (1,134 keys each, professional translation needed)

### No Action Required
- GAP-036-011 (covered by GAP-009)
- GAP-036-013 (tech debt, no admin pages yet)
- GAP-036-015 (Zod is fast enough)
- GAP-036-018 (YAGNI)
- GAP-036-019 (by design)
- GAP-036-035 (tech debt, low impact)
