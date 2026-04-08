# SPEC-040 Gaps Report -- Critical Package Coverage

## Metadata

- **Spec**: SPEC-040
- **Audit Pass**: 1 (2026-03-18)
- **Auditors**: 4 specialized agents (auth-ui, billing, logger, email)
- **Scope**: All 4 packages, all test files, all source files, coverage analysis
- **Total Gaps Found**: 63

## Summary by Severity

| Severity | Count | Fix-Now | New-Spec | Defer |
|----------|-------|---------|----------|-------|
| High | 4 | 2 | 1 | 1 |
| Medium | 15 | 7 | 1 | 7 |
| Low | 44 | 12 | 0 | 32 |
| **Total** | **63** | **21** | **2** | **40** |

## Summary by Package

| Package | Gaps | Fix-Now | New-Spec | Defer |
|---------|------|---------|----------|-------|
| auth-ui | 19 | 7 | 2 | 10 |
| billing | 15 | 4 | 0 | 11 |
| logger | 20 | 9 | 1 | 10 |
| email | 9 | 7 | 0 | 2 |

---

## CRITICAL / HIGH SEVERITY

### AUTH-GAP-003: ResetPasswordForm token validation is post-render, not pre-render (audit-1)

- **Severity**: medium (spec-gap), but HIGH impact
- **Priority**: P2
- **Complexity**: 2
- **Type**: spec-gap / code-issue
- **Description**: Spec says "Si no hay token: muestra error y no renderiza formulario". But actual source checks `!token` inside `handleSubmit` -- the form IS rendered and user must fill+submit to discover the missing token. The test is correct for current behavior, but the spec's expectation was wrong.
- **Evidence**: `packages/auth-ui/src/reset-password-form.tsx:49-66` (token check inside handleSubmit)
- **Proposed solution**: Fix the component to check token before rendering the form
- **Recommendation**: **new-spec** -- component behavior fix, not a test issue

### LOGGER-GAP-003: redactSensitiveData crashes on circular references (audit-1)

- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 3
- **Type**: code-issue (production bug)
- **Description**: `redactSensitiveData` has no circular reference protection. Any circular object logged will cause a stack overflow. The `expandObject` function HAS circular detection (WeakSet), but `redactSensitiveData` runs FIRST and recurses infinitely. The test documents this as a thrown exception, but the spec expected `[Circular]` output.
- **Evidence**: `packages/logger/src/formatter.ts:130-162` (no cycle detection)
- **Proposed solution**: Add WeakSet-based circular reference detection to `redactSensitiveData`
- **Recommendation**: **new-spec** -- this is a production bug that needs a dedicated fix

### BILLING-GAP-002: config-validator.test.ts uses local reimplementation (audit-1)

- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 2
- **Type**: incorrect-test
- **Description**: `validateTestConfig` (lines 93-250) is a parallel reimplementation of the validation logic. The ~36 unit tests test a COPY of the logic, not the real `validateBillingConfig`. If source diverges, tests still pass. The `config-validator-source.test.ts` was added to mitigate but the old file still creates confusion.
- **Evidence**: `packages/billing/test/validation/config-validator.test.ts:93-250`
- **Proposed solution**: Add clear documentation that these are contract/specification tests, and source.test.ts provides actual source coverage. Or refactor to use real functions.
- **Recommendation**: **fix-now**

### LOGGER-GAP-001: Compiled .js files included in coverage (audit-1)

- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 1
- **Type**: code-issue
- **Description**: vitest.config.ts coverage `include` has `src/**/*.js` alongside `src/**/*.ts`. Compiled .js files are counted in metrics, and they diverge from .ts source (missing new exports).
- **Evidence**: `packages/logger/vitest.config.ts:26`
- **Proposed solution**: Remove `src/**/*.js` from include, add to exclude
- **Recommendation**: **fix-now**

---

## MEDIUM SEVERITY

### LOGGER-GAP-002: Mixed .js/.ts imports in formatter.test.ts (audit-1)

- **Severity**: medium
- **Priority**: P1
- **Complexity**: 2
- **Type**: code-issue
- **Description**: formatter.test.ts imports from both `.js` and `.ts` for the same module. Stale compiled .js files lack newer exports. Two import paths may resolve to different module instances.
- **Evidence**: `packages/logger/test/formatter.test.ts:21-22`
- **Proposed solution**: Delete compiled files from src/ or rebuild them
- **Recommendation**: **fix-now**

### LOGGER-GAP-006: Missing SSN, IPv6, and pk_/api_/key_ regex tests (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 2
- **Type**: missing-test
- **Description**: Of 11 regex pattern categories, 3 lack explicit tests: SSN (`XXX-XX-XXXX`), IPv6, and API keys with `pk_`/`api_`/`key_` prefixes.
- **Evidence**: No test in formatter.test.ts for these patterns
- **Proposed solution**: Add 3 test cases for the missing patterns
- **Recommendation**: **fix-now**

### LOGGER-GAP-008: LOG_STRINGIFY_OBJECTS and 3 other env vars not tested (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 1
- **Type**: missing-test
- **Description**: Spec requires testing LOG_STRINGIFY_OBJECTS, LOG_EXPAND_OBJECT_LEVELS, LOG_TRUNCATE_LONG_TEXT_AT, LOG_TRUNCATE_LONG_TEXT_ON_ERROR. Only LOG_LEVEL, LOG_SAVE, LOG_TRUNCATE_LONG_TEXT are tested.
- **Evidence**: `packages/logger/test/environment.test.ts:137-223`
- **Proposed solution**: Add 4 tests for the missing env vars
- **Recommendation**: **fix-now**

### LOGGER-GAP-012: formatValue stringifyObj option not tested (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 1
- **Type**: missing-test
- **Description**: `stringifyObj=true` produces compact JSON vs `stringifyObj=false` (pretty). No test verifies this.
- **Evidence**: `packages/logger/src/formatter.ts:499-504,376`
- **Proposed solution**: Add test comparing compact vs pretty JSON output
- **Recommendation**: **fix-now**

### LOGGER-GAP-013: categories.ts env config merge paths uncovered (audit-1)

- **Severity**: medium (low priority)
- **Priority**: P3
- **Complexity**: 2
- **Type**: missing-test
- **Description**: `registerCategoryInternal` env config fallback branches (lines 43, 50-56) never tested. Tests always provide minimal options.
- **Evidence**: Coverage: `categories.ts` 76.47% branches
- **Proposed solution**: Add test with env vars set before registering category
- **Recommendation**: **fix-now**

### EMAIL-GAP-001: Missing "Missing API key" error test (audit-1)

- **Severity**: HIGH (spec explicitly required it)
- **Priority**: P1
- **Complexity**: 2
- **Type**: missing-test
- **Description**: Spec line 906 requires testing createEmailClient without apiKey throws. client.test.ts only has happy-path tests.
- **Evidence**: `packages/email/test/client.test.ts` -- only 2 tests, both with valid keys
- **Proposed solution**: Add test calling createEmailClient with no apiKey and no RESEND_API_KEY env var
- **Recommendation**: **fix-now**

### EMAIL-GAP-002 + EMAIL-GAP-003: No href assertions on template buttons (audit-1)

- **Severity**: medium
- **Priority**: P1
- **Complexity**: 1
- **Type**: missing-test
- **Description**: Template tests check that button text and URL exist in HTML, but don't verify they're connected via `href` attribute. Button could be broken and test still passes.
- **Evidence**: `packages/email/test/templates/verify-email.test.tsx:51-58`, `reset-password.test.tsx:41-48`
- **Proposed solution**: Add `expect(html).toContain('href="..."')` assertions
- **Recommendation**: **fix-now**

### EMAIL-GAP-004: Missing CTA instruction text in reset-password test (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 1
- **Type**: missing-test
- **Description**: Spec requires testing "Haz clic en el boton de abajo para crear una nueva contrasena:". Test file doesn't contain this assertion.
- **Evidence**: `packages/email/test/templates/reset-password.test.tsx` -- no "Haz clic" match
- **Proposed solution**: Add the assertion
- **Recommendation**: **fix-now**

### EMAIL-GAP-006: index.ts at 0% statement coverage (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 1
- **Type**: missing-test
- **Description**: Spec says "No excluir index.ts: re-exporta templates y funciones, excluirlo podria ocultar re-exports rotos". Tests import directly from source files, not from index.
- **Evidence**: Coverage: `index.ts | 0% statements | lines 9-23`
- **Proposed solution**: Add a barrel import test verifying all exports are defined
- **Recommendation**: **fix-now**

### BILLING-GAP-003: Adapter tests exercise mocks, not real logic (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 3
- **Type**: incorrect-test
- **Description**: Customer/Subscription/Payment/Checkout/Webhook Operations tests verify mock return values, providing zero confidence about real adapter behavior. Also use `let adapter: any`.
- **Evidence**: `packages/billing/test/adapters/mercadopago-adapter.test.ts:265-631`
- **Proposed solution**: Remove mock-verification tests, keep configuration tests. Replace `any` with proper types.
- **Recommendation**: **defer** -- requires deeper adapter refactoring

### BILLING-GAP-004: Duplicate coverage between two adapter test files (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 2
- **Type**: incorrect-test
- **Description**: mercadopago.test.ts and mercadopago-adapter.test.ts test identical configuration scenarios with duplicated mock setups.
- **Evidence**: Compare `mercadopago.test.ts:102-262` with `mercadopago-adapter.test.ts:183-262`
- **Proposed solution**: Consolidate into single file
- **Recommendation**: **defer** -- works but adds maintenance burden

### BILLING-GAP-013: config-validator.test.ts imports without .js extension (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 1
- **Type**: code-issue
- **Description**: Spec warns imports MUST use .js extension (ESM). config-validator.test.ts imports without .js on lines 6-15.
- **Evidence**: `packages/billing/test/validation/config-validator.test.ts:6`
- **Proposed solution**: Add .js extensions
- **Recommendation**: **fix-now**

### AUTH-GAP-009: useAuthTranslations parameter replacement test is weak (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 1
- **Type**: incorrect-test
- **Description**: Tests try to verify `{min}` replacement but use keys that don't exist in fallback map. None of the 55 fallback strings contain `{param}` placeholders, so param replacement is effectively dead code.
- **Evidence**: `packages/auth-ui/test/hooks/use-auth-translations.test.ts:135-163`
- **Proposed solution**: Either add placeholder-containing fallback strings or remove param replacement code
- **Recommendation**: **new-spec**

### AUTH-GAP-018: window.location mock inconsistency across test files (audit-1)

- **Severity**: medium
- **Priority**: P2
- **Complexity**: 2
- **Type**: code-issue
- **Description**: Different test files mock window.location differently (global defineProperty, beforeEach redefine, setter pattern). Maintenance burden and potential test pollution.
- **Evidence**: Compare patterns across 5+ test files
- **Proposed solution**: Extract shared mock utility into test/setup.tsx
- **Recommendation**: **defer**

---

## LOW SEVERITY (21 fix-now + defer items)

### Fix-Now (Low)

| ID | Package | Description |
|----|---------|-------------|
| AUTH-GAP-004 | auth-ui | `act(...)` warnings in 3 test files -- wrap pending promises in act() |
| AUTH-GAP-005 | auth-ui | UserMenu dropdown image in expanded panel not tested (71.42% functions) |
| AUTH-GAP-010 | auth-ui | ForgotPasswordForm/ResetPasswordForm missing `role="alert"` on error divs |
| AUTH-GAP-011 | auth-ui | Fallback errors "Failed to send reset email"/"Failed to reset password" not tested |
| AUTH-GAP-012 | auth-ui | SignInForm OAuth Error-instance path not tested (only non-Error tested) |
| AUTH-GAP-013 | auth-ui | SignUpForm OAuth Error-instance path not tested |
| AUTH-GAP-014 | auth-ui | UserMenu dropdown with image -- directly causes low function coverage |
| EMAIL-GAP-005 | email | Missing "Tu contrasena actual seguira siendo valida..." assertion |
| EMAIL-GAP-007 | email | BaseLayout unsubscribe link not tested as href attribute |
| LOGGER-GAP-007 | logger | Truncation inconsistency recursive variant not explicitly tested |
| LOGGER-GAP-010 | logger | logger.ts WARN level in shouldLog uncovered |
| LOGGER-GAP-015 | logger | formatValue JSON.stringify error catch not tested |

### Defer (Low)

| ID | Package | Description |
|----|---------|-------------|
| AUTH-GAP-001/002 | auth-ui | Skeleton tests are false positives (jsdom limitation) |
| AUTH-GAP-006 | auth-ui | VerifyEmail cancelled-branch (useEffect cleanup race) |
| AUTH-GAP-007 | auth-ui | VerifyEmail dead code fallback (should be removed, not tested) |
| AUTH-GAP-008 | auth-ui | SignIn/SignUp mouseLeave handler on non-loading state |
| AUTH-GAP-015 | auth-ui | ForgotPasswordForm email trimming not tested |
| AUTH-GAP-016 | auth-ui | logger.ts excluded from coverage but has branching logic |
| AUTH-GAP-017 | auth-ui | SimpleUserMenu responsive CSS classes not asserted |
| AUTH-GAP-019 | auth-ui | OAuth buttons disabled during loading not tested |
| BILLING-GAP-001 | billing | getDefaultPlan throw branch (coverage 99%+, defensive) |
| BILLING-GAP-005 | billing | @repo/config mock may not match real API |
| BILLING-GAP-006 | billing | vitest resolve.alias inconsistency with mock approach |
| BILLING-GAP-007 | billing | getDefaultPlan invalid category (TS prevents at compile time) |
| BILLING-GAP-008 | billing | sponsorship-seeds.test.ts fragile filesystem dependency (wrong package) |
| BILLING-GAP-009 | billing | limit() helper tested only indirectly |
| BILLING-GAP-010 | billing | No direct promo-codes.config constant value tests |
| BILLING-GAP-011 | billing | validateBillingConfigOrThrow warning-logging not asserted |
| BILLING-GAP-012 | billing | Spec doesn't list config-validator-source.test.ts |
| BILLING-GAP-014 | billing | Negative limitIncrease not explicitly tested |
| EMAIL-GAP-008 | email | replyTo exclusion when not provided not asserted |
| EMAIL-GAP-009 | email | showUnsubscribe=true explicit (vs default) not tested |
| LOGGER-GAP-004 | logger | clearCategories spec says "except DEFAULT" but clears all |
| LOGGER-GAP-005 | logger | Not all 75 sensitive keys individually tested |
| LOGGER-GAP-009 | logger | LOG_FORMAT in CLAUDE.md but doesn't exist in code |
| LOGGER-GAP-011 | logger | registerCustomLogMethod dead code path |
| LOGGER-GAP-016 | logger | formatLogMessage USE_COLORS=true path not tested in unit |
| LOGGER-GAP-017 | logger | index.ts has default export violating project standards |
| LOGGER-GAP-018 | logger | getAllCategories function not directly tested |
| LOGGER-GAP-019 | logger | Spec says 22 regex patterns but source has 11 |
| LOGGER-GAP-020 | logger | resetLogger logic not tested as unit |

---

## Action Plan

### Immediate Fixes (21 items -- can be done in SPEC-040 scope)

These are test gaps and config issues that should be fixed directly:

1. **Logger vitest.config.ts**: Fix coverage include/exclude for compiled files
2. **Logger formatter.test.ts**: Fix mixed imports (delete compiled files or rebuild)
3. **Logger environment.test.ts**: Add 4 missing env var tests
4. **Logger formatter.test.ts**: Add SSN, IPv6, pk_/api_/key_ regex tests
5. **Logger formatter.test.ts**: Add stringifyObj option test
6. **Logger categories.test.ts**: Add env config merge test
7. **Logger formatter.test.ts**: Add recursive truncation test
8. **Logger index.test.ts**: Add WARN level shouldLog test
9. **Logger formatter.test.ts**: Add JSON.stringify error catch test
10. **Email client.test.ts**: Add "Missing API key" error test
11. **Email template tests**: Add href assertions for buttons
12. **Email reset-password.test.tsx**: Add CTA instruction text
13. **Email reset-password.test.tsx**: Add full security note text
14. **Email base-layout.test.tsx**: Add href assertion for unsubscribe
15. **Email**: Add barrel import test for index.ts
16. **Billing config-validator.test.ts**: Add .js extensions to imports
17. **Billing config-validator.test.ts**: Document as contract tests
18. **Auth-ui user-menu.test.tsx**: Add dropdown-with-image test
19. **Auth-ui sign-in/sign-up**: Add OAuth Error-instance tests
20. **Auth-ui forgot/reset**: Add fallback error message tests
21. **Auth-ui**: Fix act() warnings

### New Specs Required (2 items)

1. **Logger circular reference bug**: `redactSensitiveData` has no cycle detection -- production crash risk
2. **Auth-ui component fixes**: ResetPasswordForm token pre-render check + useAuthTranslations param replacement dead code + ForgotPasswordForm/ResetPasswordForm missing role="alert"

### Deferred (40 items)

Low-priority items that don't affect correctness or coverage thresholds. Can be addressed in future maintenance passes.
