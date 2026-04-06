# SPEC-054 Gaps Report: Admin Entity List Filter Bar & Default Filters Indicator

> **Spec**: SPEC-054-default-filters-ui-indicator
> **Spec Status**: completed
> **Report Created**: 2026-04-04
> **Last Audit**: 2026-04-04 (Audit #4)

---

## Audit History

| # | Date | Auditor | Gaps Found | Gaps Resolved | Notes |
|---|------|---------|------------|---------------|-------|
| 1 | 2026-04-04 | Claude Opus 4.6 (multi-agent: 4 expert agents) | 6 | 0 | Initial exhaustive audit. Covered components, types, utils, hooks, entity configs, i18n, backend alignment, tests, accessibility, edge cases, integration. |
| 2 | 2026-04-04 | Claude Opus 4.6 (multi-agent: 4 expert agents) | 14 new | 0 | Deep second pass with 4 specialized agents: Frontend Components, State Management & Integration, i18n & Entity Config, Testing & Accessibility. Total gaps: 20. |
| 3 | 2026-04-04 | Claude Opus 4.6 (multi-agent: 4 expert agents) | 8 new | 0 | Third exhaustive pass with 4 specialized agents (code-reviewer type): Frontend Components, State Management & Integration, Entity Configs & i18n & Backend Schemas, Tests & Accessibility & Edge Cases. All 20 previous gaps re-verified. Test counts corrected. Total gaps: 28. |
| 4 | 2026-04-04 | Claude Opus 4.6 (multi-agent: Explore + code-reviewer) | 7 new | 1 resolved | Fourth exhaustive pass: re-verified all 28 existing gaps (1 fixed: GAP-054-014), code review found 7 new gaps (029-035) including sentinel leak to API, discriminated union, i18n violation. Total gaps: 34 (27 open from previous + 7 new). |
| 5 | 2026-04-04 | Claude Opus 4.6 (multi-agent: 4 code-reviewer agents) | 13 new | 3 resolved | Fifth exhaustive pass with 4 specialized agents: Frontend Components, State Management & Integration, Entity Configs & i18n & Backend Schemas, Tests & Accessibility. Re-verified all 34 gaps. Resolved: GAP-054-006 (output implicit role), GAP-054-007 (Enter fixed, Space variant → GAP-054-036), GAP-054-014 (re-opened: callbacks missing computedDefaults dep). Found 13 new gaps (036-048) focusing on testing gaps, Space key double-fire, and type safety. Total gaps: 44 (31 open from previous + 13 new). |
| 6 | 2026-04-04 | Claude Opus 4.6 (multi-agent: 4 code-reviewer agents) | 18 new | 2 resolved | Sixth exhaustive pass with 4 specialized code-reviewer agents: Frontend Components, State Management & Integration, Entity Configs & i18n & Backend Schemas, Tests & Accessibility. Re-verified ALL 48 prior gaps. Resolved: GAP-054-014 (memo deps functionally correct), GAP-054-029 (sentinel can't reach API via current data flow). Reclassified GAP-054-015 (defensive guard, not live bug). Found 18 new gaps (049-066): redundant handleKeyDown (050, root cause of 036), FilterControlType not exported (052), filter label invisible in trigger (053), FilterActions.test.tsx absent (062), plus nits. Enum alignment 100%, i18n parity 100%. Total gaps: 62 (44 open from previous + 18 new). |

---

## Overall Assessment

**Implementation Compliance**: ~72% (good core, significant testing, accessibility, and type safety gaps)
**Files**: 10/10 new files exist, 12/12 modified files updated correctly
**Entity Configs**: 5/5 fully compliant with spec, all enum values match backend schemas EXACTLY (re-verified against Zod schemas in Audit #6)
**i18n**: 3/3 locale files complete with all keys, namespace properly registered in `packages/i18n/src/config.ts`. All 3 locales have IDENTICAL key structure (verified exhaustively in Audit #6).
**Tests**: 89 total test cases across 7 files (FilterActions.test.tsx absent). ~40/60 spec scenarios covered (~67%). Integration harness covers 5/8 spec cases. Component interaction tests blocked by jsdom/Radix limitation. `createEntityApi` filter logic has ZERO real test coverage.
**Backend Alignment**: 100%.. all filter option values match schema enums exactly (all 5 entity schemas cross-referenced in every audit)
**Accessibility**: 7 open gaps (001-003, 011-012, 036, 053). Space key double-fire (036) is P1. Focus management incomplete (011). Filter label invisible in trigger (053).
**Type Safety**: Flat FilterControlConfig type allows invalid configurations (032). Double cast bypasses type system (016/037). EntityListSearchParams missing index signature (037). FilterControlType not exported (052).
**Defensive Guards**: Sentinel value `__cleared__` stripped by extractActiveFilters before reaching API (029 resolved). createEntityApi lacks belt-and-suspenders guard (015 reclassified as defensive). Unknown URL params pass through unfiltered (015).

The core infrastructure (filter-utils, useFilterState, createEntityApi dual-path, entity configs, i18n) is production-quality. Gaps concentrate in five areas: (1) **testing coverage** (~67% vs spec target, with `createEntityApi` at 0%, FilterActions at 0%), (2) **accessibility compliance** (aria-labels, focus management, Space key bug, label invisible in trigger), (3) **type safety** (flat union type, double casts, missing index signature, unexported types), (4) **minor architectural divergences** from spec (FilterBar props API, unused props, duplicated constants, redundant handleKeyDown), and (5) **test infrastructure** (Radix Select in jsdom blocks interaction tests).

**Audit #6 status**: 2 gaps resolved (GAP-054-014 memo deps correct, GAP-054-029 sentinel can't reach API). 18 new gaps found (049-066). **Total: 62 gaps (42 open from previous + 18 new + 2 resolved)**.

---

## Gaps from Audit #1 (status update from Audit #3)

### GAP-054-001: Missing `role="status"` on ActiveFilterChips live region

- **Found in**: Audit #1
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Trivial (1 line change)
- **Category**: Accessibility (WCAG)
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. Agregar `role="status"` explícito por robustez con AT viejos, aunque `<output>` ya lo cubre implícitamente.

#### Description

Spec section 10 requires the `ActiveFilterChips` container to have both `aria-live="polite"` AND `role="status"`. The implementation uses `<output>` element which has an implicit `role="status"` per HTML spec, but the explicit attribute is missing.

**File**: `apps/admin/src/components/entity-list/filters/ActiveFilterChips.tsx:53`
**Current**: `<output ... aria-live="polite" aria-label="Active filters">`
**Expected**: `<output role="status" aria-live="polite" aria-label="Active filters">`

#### Impact

Some older assistive technologies may not recognize `<output>` as `role="status"`. Modern AT handles it correctly via the implicit role.

#### Proposed Solution

Add `role="status"` to the `<output>` element. **Fix directly**: Yes. Trivial, no risk.

---

### GAP-054-002: FilterSelect aria-label missing current value

- **Found in**: Audit #1
- **Severity**: Medium (WCAG 4.1.2 Name/Role/Value)
- **Priority**: P2
- **Complexity**: Low (5-10 lines)
- **Category**: Accessibility (WCAG 4.1.2)
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. Violación WCAG 4.1.2 confirmada. Concatenar valor actual al aria-label.

#### Description

Spec section 10 requires FilterSelect trigger to have `aria-label="{filterLabel}: {currentValue}"`. Current implementation only has `aria-label="{filterLabel}"`.

**File**: `apps/admin/src/components/entity-list/filters/FilterSelect.tsx:72`
**Current**: `aria-label={t(config.labelKey as TranslationKey)}`
**Expected**: `aria-label={value ? \`${t(config.labelKey)}: ${translatedValue}\` : t(config.labelKey)}`

#### Impact

Screen reader users cannot determine the current filter selection without opening the dropdown. Violates WCAG 4.1.2 (Name, Role, Value).

#### Proposed Solution

Compute the translated option label from `config.options` for the current value and concatenate:

```tsx
const currentValueLabel = isActive
    ? (config.options?.find(o => o.value === value)?.labelKey
        ? t(config.options.find(o => o.value === value)!.labelKey as TranslationKey)
        : value ?? '')
    : t(allLabelKey);
aria-label={`${t(config.labelKey as TranslationKey)}: ${currentValueLabel}`}
```

**Fix directly**: Yes. Low risk, improves accessibility.

---

### GAP-054-003: FilterBoolean aria-label missing current state

- **Found in**: Audit #1
- **Severity**: Medium (WCAG 4.1.2)
- **Priority**: P2
- **Complexity**: Low (5-10 lines)
- **Category**: Accessibility (WCAG 4.1.2)
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. Misma violación WCAG 4.1.2 que GAP-002. Concatenar estado actual al aria-label.

#### Description

Spec section 10 requires FilterBoolean trigger to have `aria-label="{filterLabel}: {Yes/No/All}"`. Current implementation only has `aria-label="{filterLabel}"`.

**File**: `apps/admin/src/components/entity-list/filters/FilterBoolean.tsx:71`

#### Proposed Solution

```tsx
const currentStateLabel = value === 'true'
    ? t('admin-filters.booleanYes' as TranslationKey)
    : value === 'false'
    ? t('admin-filters.booleanNo' as TranslationKey)
    : t('admin-filters.allOption' as TranslationKey);
aria-label={`${t(config.labelKey as TranslationKey)}: ${currentStateLabel}`}
```

**Fix directly**: Yes. Low risk.

---

### GAP-054-004: No console warning for select filter with empty options

- **Found in**: Audit #1
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (3-5 lines)
- **Category**: Developer Experience
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. DX nice-to-have, trivial, cero riesgo en producción.

#### Description

Spec section 12 states: "In development mode, log a console warning: `[FilterBar] Select filter "${paramKey}" has no options configured`". Not implemented.

**File**: `apps/admin/src/components/entity-list/filters/FilterSelect.tsx`

#### Proposed Solution

Add `if (import.meta.env.DEV && (!config.options || config.options.length === 0)) { console.warn(...) }`.

**Fix directly**: Yes. Zero production risk.

---

### GAP-054-005: Zero-results message uses generic key instead of filter-specific key

- **Found in**: Audit #1
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Low (10-15 lines)
- **Category**: UX / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. Mejora UX clara, renderizado condicional en empty state según hasActiveFilters.

#### Description

Spec section 12: when `hasActiveFilters` is true and results are empty, should use `t('admin-filters.noResults')` with Clear all / Reset to defaults actions. Current implementation uses generic `t('admin-entities.list.noResults')` for all empty states.

#### Proposed Solution

Conditional rendering based on `filterState.hasActiveFilters` in the empty state.

**Fix directly**: Yes.

---

### GAP-054-006: Integration test expects `role="status"` but component lacks it

- **Found in**: Audit #1
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Test Consistency
- **Status**: **RESOLVED** (Audit #5: `<output>` element has implicit ARIA `role="status"` per HTML spec. Tests correctly find it via `getByRole('status')`. No explicit attribute needed.)

---

## Gaps from Audit #2 (status update from Audit #3)

### GAP-054-007: FilterChip double-fires `onRemove` on Enter key

- **Found in**: Audit #2
- **Severity**: High
- **Priority**: P1
- **Complexity**: Trivial (remove 5 lines)
- **Category**: Correctness / Accessibility Bug
- **Status**: **HACER** (decidido 2026-04-04) — fix único que resuelve 007 + 036 + 050
- **Decisión**: Hacer. Eliminar handleKeyDown completo. El `<button>` nativo maneja Enter y Space vía onClick. Bug de correctness confirmado.

#### Description

`FilterChip.tsx` has both an `onKeyDown` handler (lines 33-37) that calls `onRemove()` on Enter/Space AND an `onClick` handler (line 50) that also calls `onRemove()`. Native `<button>` elements already fire `onClick` when Enter or Space is pressed. This means pressing Enter on a chip X button triggers `onRemove()` **twice**.

**File**: `apps/admin/src/components/entity-list/filters/FilterChip.tsx:33-37`

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRemove();
    }
};
```

#### Impact

Keyboard users trigger double removal. The second call may throw errors or cause unexpected state changes.

#### Proposed Solution

Remove the `handleKeyDown` handler entirely. Standard `<button>` elements handle Enter and Space natively, firing `onClick`. The `onKeyDown` is redundant and harmful.

**Fix directly**: Yes. **Urgent** -- this is a correctness bug.

---

### GAP-054-008: Integration test suite does not match spec 13.6 structure

- **Found in**: Audit #2
- **Severity**: High
- **Priority**: P1
- **Complexity**: High (requires TanStack Router test setup)
- **Category**: Testing / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-04) — los 3 casos, incluyendo Router mock
- **Decisión**: Hacer completo. Agregar: (1) FilterBar ausente sin config, (2) URL state con Router mock, (3) Legacy entities con defaultFilters only.

#### Audit #3 Update

An integration test file now EXISTS at `apps/admin/src/components/entity-list/filters/__tests__/integration.test.tsx` with 12 test cases using a `FilterIntegrationHarness`. However, it tests `FilterBar + useFilterState` directly with local state, WITHOUT TanStack Router, EntityListPage, or createEntityApi.

**Mapping of 8 spec cases vs harness coverage:**

| Spec 13.6 Case | Harness Coverage | Status |
|-----------------|-----------------|--------|
| 1. FilterBar renders when config present | Test #4 (renders comboboxes) | PARTIAL |
| 2. FilterBar absent when no config | NOT PRESENT | MISSING |
| 3. Selecting filter updates URL | NOT PRESENT (harness uses local state) | MISSING |
| 4. URL filter state restores on mount | Tests #2, #3 (via `initialParams`) | PARTIAL |
| 5. Filter change resets page to 1 | Test #10 | COVERED |
| 6. Default filters applied on first visit | Test #1 | COVERED |
| 7. Clear default sends unfiltered request | Test #8 | COVERED |
| 8. Legacy entities unaffected | NOT PRESENT | MISSING |

**3 of 8 spec cases missing**. Cases 2, 3, and 8 require `EntityListPage` with real/mocked TanStack Router.

#### Proposed Solution

Add 3 missing test cases to the harness or create a separate `EntityListPage`-level integration test with TanStack Router mocking.

**Recommend**: Can be addressed in existing test file for cases 2 and 8 (FilterBar absent, legacy entities). Case 3 (URL updates) requires Router mock.

---

### GAP-054-009: FilterBar component tests miss spec cases (corrected count)

- **Found in**: Audit #2
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Medium (20-30 lines)
- **Category**: Testing / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. Agregar 5 tests faltantes + reemplazar selectores CSS frágiles con queries semánticas.

#### Audit #3 Correction

FilterBar.test.tsx has 6 `it()` blocks. Exact mapping vs spec 13.3:

| Spec 13.3 Case | Status |
|-----------------|--------|
| 1. Renders filter controls for each config entry | COVERED |
| 2. Renders FilterSelect for select type | COVERED |
| 3. Renders FilterBoolean for boolean type | COVERED |
| 4. Shows active filter chips when hasActiveFilters true | COVERED |
| 5. Hides chips when no active filters | COVERED |
| 6. Skips unknown filter types (e.g., 'relation') | MISSING |
| 7. Chip shows "(default)" badge for default filters | MISSING |
| 8. Chip click removes filter (user-event) | MISSING |
| 9. "Clear all" hidden when hasActiveFilters false | MISSING |
| 10. "Reset to defaults" visibility based on hasNonDefaultFilters | MISSING |

**5/10 covered. 5 missing.** Additionally, line 79 uses fragile CSS class assertion (`.flex.items-center.gap-1`) instead of semantic queries.

#### Proposed Solution

Add the 5 missing test cases and replace CSS class queries with role-based or data-testid queries.

**Fix directly**: Yes, as part of a test improvement pass.

---

### GAP-054-010: FilterSelect/FilterBoolean interaction tests absent (refined counts)

- **Found in**: Audit #2
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Medium (requires Radix Select mocking strategy)
- **Category**: Testing / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer con Opción A (mock Radix Select con `<select>` nativo). Más robusto que depender del `<select>` oculto interno de Radix. Crear utilidad de test compartida.

#### Audit #3 Refinement

**FilterSelect (spec 13.4)**: 1/5 fully covered, 1/5 partially (CSS class check, not value text), 3/5 absent (interaction tests blocked by jsdom/Radix).

| Spec 13.4 Case | Status |
|-----------------|--------|
| 1. Renders with "All" selected by default | COVERED |
| 2. Shows current value when set | PARTIAL (class check only) |
| 3. Selecting "All" calls onChange(undefined) | MISSING |
| 4. Selecting value calls onChange(value) | MISSING |
| 5. Shows translated option labels | MISSING |

**FilterBoolean (spec 13.5)**: 1/6 fully covered, 1/6 partially, 4/6 absent.

| Spec 13.5 Case | Status |
|-----------------|--------|
| 1. Renders with "All" selected | COVERED |
| 2. Shows "Yes" when value is "true" | PARTIAL (no text verification) |
| 3. Shows "No" when value is "false" | MISSING |
| 4. Selecting "Yes" calls onChange("true") | MISSING |
| 5. Selecting "No" calls onChange("false") | MISSING |
| 6. Selecting "All" calls onChange(undefined) | MISSING |

#### Proposed Solution

Two approaches:

1. **Mock Radix Select** with a native `<select>` in test environment
2. **Use the hidden native `<select>`** that Radix renders for accessibility

**Fix directly**: Yes, with the mocking approach. May require shared test utility.

---

### GAP-054-011: Focus not recovered after last chip removal

- **Found in**: Audit #2
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Low (10-15 lines)
- **Category**: Accessibility (WCAG 2.4.3 Focus Order)
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. Violación WCAG 2.4.3 confirmada. Implementar cascada de foco: siguiente chip → Clear all → primer filter control.

#### Description

Spec section 10: "After removing a filter chip, focus moves to the next chip, or to the **'Clear all' button** if no chips remain, or to the **first filter control** if no actions remain."

Current implementation in `ActiveFilterChips.tsx` (lines 28-46): when `buttons.length === 0` after removal, the code returns early WITHOUT moving focus anywhere.

| Scenario | Spec | Implementation |
|----------|------|---------------|
| More chips remain | Focus next chip | CORRECT |
| No chips remain | Focus "Clear all" button | MISSING |
| No chips, no actions | Focus first filter control | MISSING |

#### Proposed Solution

When `buttons.length === 0`, query parent for `[data-filter-actions] button` or the first filter control `[role="combobox"]` and focus it. Requires coordination with FilterBar for fallback focus target (callback prop or ref).

**Fix directly**: Yes, but requires coordination with FilterBar.

---

### GAP-054-012: ActiveFilterChips aria-label hardcoded in English

- **Found in**: Audit #2
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Trivial (1 line)
- **Category**: i18n / Accessibility
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. String hardcodeada en inglés, locale default es español. Reemplazar con t('admin-filters.activeFilters').

#### Description

`ActiveFilterChips.tsx:57` has `aria-label="Active filters"` hardcoded in English. The i18n key `admin-filters.activeFilters` exists in all 3 locale files but is not used here. The project's default locale is Spanish (`es`), so this is functionally wrong in production.

**File**: `apps/admin/src/components/entity-list/filters/ActiveFilterChips.tsx:57`
**Current**: `aria-label="Active filters"`
**Expected**: `aria-label={t('admin-filters.activeFilters' as TranslationKey)}`

#### Proposed Solution

Import `useTranslations` and replace hardcoded string with `t('admin-filters.activeFilters' as TranslationKey)`.

**Fix directly**: Yes. Trivial.

---

### GAP-054-013: FilterChip aria-label format deviates from spec

- **Found in**: Audit #2
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial (1 line)
- **Category**: Spec Compliance / Accessibility
- **Status**: **RESOLVED** (Audit #5: The implementation uses `"Remove filter ${label}: ${value}"` which matches the consensus across spec lines 1424 and 1593. Line 487 is the spec outlier/typo. The current format is the correct one.)

#### Description

Spec section 6.7: `aria-label="Remove filter: {label} {value}"` (colon after "filter").
Implementation: `aria-label="Remove filter ${label}: ${chip.displayValue}"` (colon after label name).

**File**: `apps/admin/src/components/entity-list/filters/FilterChip.tsx:41`
**Current**: `Remove filter Status: Active`
**Expected**: `Remove filter: Status Active`

#### Impact

Minor screen reader announcement difference. Not functionally broken.

#### Proposed Solution

Change to `` `Remove filter: ${label} ${chip.displayValue}` ``.

**Fix directly**: Yes. Trivial.

---

### GAP-054-014: useFilterState memoization deps deviate from spec

- **Found in**: Audit #2
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial (add deps)
- **Category**: Spec Compliance / Correctness
- **Status**: **RESOLVED** (Audit #6: `computedDefaults` derives exclusively from `filterBarConfig`. The callbacks read `filter.defaultValue` from `filterBarConfig` directly, never from `computedDefaults`. Including `computedDefaults` in deps would be functionally redundant since it is a pure derivation of `filterBarConfig`. The spec's explicit dep list is aspirational, not a correctness requirement. Implementation is provably correct.)

#### Audit #4 Resolution (SUPERSEDED by Audit #5)

Audit #4 marked this resolved based on `activeFilters` memo and `handleFilterChange` callback. Those two ARE correct (computedDefaults is derived from filterBarConfig).

#### Audit #5 Re-opening (SUPERSEDED by Audit #6)

Audit #5 re-opened because `handleClearAll` and `handleResetDefaults` omit `computedDefaults` from deps. Audit #6 closes this definitively: the implementation is technically safe (deps are functionally equivalent since `computedDefaults` derives from `filterBarConfig`). The spec deviation is cosmetic, not a correctness issue.

---

### GAP-054-015: validateSearch doesn't sanitize filter params to strings

- **Found in**: Audit #2
- **Severity**: Very Low (downgraded in Audit #6)
- **Priority**: P4 (downgraded in Audit #6)
- **Complexity**: Low (5 lines)
- **Category**: Robustness / Type Safety / Defensive Guard
- **Status**: **HACER** (decidido 2026-04-04)
- **Decisión**: Hacer. Guard defensivo, no es bug vivo pero cierra la puerta a futuros bypasses.

#### Description

`EntityListPage.tsx` `validateSearch` spreads `...filterParams` from URL without type validation. A malformed URL (e.g., `?status[]=foo`) could inject non-string values. Downstream guards in `extractActiveFilters` handle this safely, but the upstream contamination is architectural debt.

#### Proposed Solution

Add string normalization in validateSearch.

**Fix directly**: Yes. Low risk.

---

### GAP-054-016: EntityListPage double type cast for onUpdateSearch

- **Found in**: Audit #2
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Medium (requires type extraction per spec 5.4)
- **Category**: Type Safety / Code Quality
- **Status**: **HACER** (decidido 2026-04-04) — se resuelve automáticamente con GAP-054-037
- **Decisión**: Hacer como parte de GAP-054-037. No requiere fix independiente.

#### Description

`EntityListPage.tsx:259-265` uses `as unknown as` double cast for `onUpdateSearch` because the type system doesn't align between `EntityListSearchParams` and `Record<string, unknown>`.

The spec section 5.4 recommends extracting `EntityListSearchParams` as a named type with an index signature, which would eliminate this cast.

#### Proposed Solution

Extract `EntityListSearchParams` to `types.ts` with the index signature.

**Fix directly**: Yes, but impacts type definitions used elsewhere.

---

### GAP-054-017: computedDefaults prop received but unused in FilterBar

- **Found in**: Audit #2
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: API Cleanliness
- **Status**: **HACER** (decidido 2026-04-05) — junto con GAP-054-021
- **Decisión**: Hacer. Remover computedDefaults de FilterBarProps. Dead code confuso.

#### Description

`FilterBar.tsx` receives `computedDefaults` in its props but immediately discards it as `_computedDefaults`. This is related to GAP-054-021 (FilterBar receiving `chips` pre-computed, making `computedDefaults` unnecessary).

#### Proposed Solution

Either remove from `FilterBarProps` (and update spec) or document as reserved. If GAP-054-021 is resolved by keeping `chips` in props, then `computedDefaults` should be removed entirely.

**Fix directly**: Yes if removing.

---

### GAP-054-018: Implicit reliance on backend 'all' default for status filter

- **Found in**: Audit #2
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: N/A (design awareness)
- **Category**: Backend Alignment / Coupling
- **Status**: **DESCARTADO** (decidido 2026-04-05)
- **Decisión**: Descartar. Informacional puro, patrón REST estándar, no hay acción concreta.

No action needed.

---

### GAP-054-019: activeFilters memo depends on entire searchParams object

- **Found in**: Audit #2
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Low (10 lines)
- **Category**: Performance
- **Status**: **POSTERGADO** (decidido 2026-04-05)
- **Decisión**: Postergar. Impacto negligible con 3-5 filtros. Optimización prematura.

#### Description

`useFilterState.ts:112-115` memoizes `activeFilters` with `[searchParams, filterBarConfig]` as deps. Any change to any param (page, pageSize, q, sort, etc.) invalidates and triggers recomputation.

#### Impact

Negligible with current filter counts (3-5 per entity).

**Fix directly**: Optional. Low priority.

---

### GAP-054-020: Accessibility tests mostly absent

- **Found in**: Audit #2
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Medium (20-30 lines)
- **Category**: Testing / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Agregar 3 tests de accessibility faltantes (tab navigation, aria-live, aria-label preciso).

#### Audit #3 Refinement

Spec section 13.7 mandates 4 accessibility test cases:

| Spec 13.7 Case | Status |
|-----------------|--------|
| 1. Tab navigation through all filter controls | MISSING |
| 2. Chip keyboard removal through ActiveFilterChips | PARTIAL (tested on FilterChip in isolation) |
| 3. aria-live announcements | MISSING |
| 4. aria-label on chip X button | PARTIAL (regex `/^Remove filter/` matches both correct and incorrect format) |

**1/4 covered. 3 missing.** The integration test at line 371 uses `/^Remove filter/` regex which doesn't discriminate between spec format ("Remove filter: Status Active") and current format ("Remove filter Status: Active").

---

## New Gaps from Audit #3

### GAP-054-021: FilterBar receives `chips` as extra prop not defined in spec

- **Found in**: Audit #3
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Low
- **Category**: Architecture / Spec Divergence
- **Status**: **HACER** (decidido 2026-04-05) — junto con GAP-054-017
- **Decisión**: Hacer. Actualizar spec: agregar `chips` a FilterBarProps, remover `computedDefaults`. Implementación es mejor diseño.

#### Description

Spec section 6.3 defines `FilterBarProps` with exactly 8 fields. The implementation adds a 9th field: `readonly chips: ReadonlyArray<FilterChipData>`. The spec's design has `useFilterState` computing chips and `EntityListPage` coordinating the data flow. The implementation passes pre-computed chips through `FilterBar`.

**File**: `apps/admin/src/components/entity-list/filters/FilterBar.tsx:24`
**Spec**: `FilterBarProps` has 8 fields (config, activeFilters, computedDefaults, onFilterChange, onClearAll, onResetDefaults, hasActiveFilters, hasNonDefaultFilters)
**Code**: 9 fields (adds `chips`)

#### Impact

The implementation's approach is arguably better (avoids `FilterBar` needing `t()` internally), but creates an inconsistency where `computedDefaults` is passed but unused (GAP-054-017) since chips already encode `isDefault`. Two related inconsistencies:

1. `computedDefaults` is dead prop (can't remove without updating spec)
2. Render condition uses `chips.length > 0` instead of `hasActiveFilters` (see GAP-054-023)

#### Proposed Solution

**Option A**: Update spec to match implementation -- add `chips` to `FilterBarProps`, remove `computedDefaults`.
**Option B**: Revert to spec design -- remove `chips` from props, have `FilterBar` call `buildFilterChips` internally (requires `useTranslations()` in FilterBar).

**Recommendation**: Option A (update spec). The implementation is cleaner.

---

### GAP-054-022: `defaultFilters` still present in destinations.config.ts alongside filterBarConfig

- **Found in**: Audit #3
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial (1 line removal)
- **Category**: Code Cleanliness / Migration Debt
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Borrar defaultFilters redundante. filterBarConfig ya define el default.

#### Description

Spec section 8.1 states: "defaultFilters should be REMOVED or ignored when filterBarConfig present". Spec section 5.2: "When `filterBarConfig` is defined, `defaultFilters` is ignored".

**File**: `apps/admin/src/features/destinations/config/destinations.config.ts:19`
**Current**: `defaultFilters: { destinationType: 'CITY' }` is still present alongside `filterBarConfig` that sets `defaultValue: 'CITY'` on `destinationType`.

#### Impact

Runtime: none (filterBarConfig takes precedence). Maintenance: misleading for future developers who see both and assume `defaultFilters` is authoritative.

#### Proposed Solution

Remove `defaultFilters: { destinationType: 'CITY' }` from destinations config. The `defaultValue: 'CITY'` in filterBarConfig fully replaces it.

**Fix directly**: Yes. Trivial, zero risk.

---

### GAP-054-023: FilterBar render condition uses `chips.length` instead of `hasActiveFilters`

- **Found in**: Audit #3
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (1 line)
- **Category**: Spec Compliance
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Alinear con spec, trivial.

#### Description

Spec section 6.3: "Below the controls, renders ActiveFilterChips when `hasActiveFilters` is true".

**File**: `apps/admin/src/components/entity-list/filters/FilterBar.tsx:120`
**Current**: `{chips.length > 0 && ...}`
**Expected**: `{hasActiveFilters && ...}`

#### Impact

In practice, `chips.length > 0` and `hasActiveFilters` should always be equivalent. This is a minor spec deviation.

#### Proposed Solution

Change condition to `{hasActiveFilters && ...}`. Trivial.

**Fix directly**: Yes.

---

### GAP-054-024: `filtersEqual` function doesn't use RO-RO pattern

- **Found in**: Audit #3
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (1 call site)
- **Category**: Code Conventions
- **Status**: **DESCARTADO** (decidido 2026-04-05)
- **Decisión**: Descartar. Firma posicional es más natural para un comparador puro de 2 args. Excepción justificada.

#### Description

Project convention and CLAUDE.md mandate RO-RO (Receive Object, Return Object) for all functions. All 4 other exported functions in `filter-utils.ts` use RO-RO. `filtersEqual` is the sole exception.

**File**: `apps/admin/src/components/entity-list/filters/filter-utils.ts:115`
**Current**: `filtersEqual(a: ActiveFilters, b: ActiveFilters): boolean`
**Expected**: `filtersEqual({ a, b }: { readonly a: ActiveFilters; readonly b: ActiveFilters }): boolean`

#### Impact

Minor inconsistency. The positional signature is arguably more natural for a pure comparator.

#### Proposed Solution

Either convert to RO-RO for consistency, or document as intentional exception.

**Fix directly**: Optional.

---

### GAP-054-025: Chips row layout classes split between FilterBar and ActiveFilterChips

- **Found in**: Audit #3
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Layout / Spec Compliance
- **Status**: **DESCARTADO** (decidido 2026-04-05)
- **Decisión**: Descartar. Resultado visual idéntico, split de clases entre componentes es razonable.

#### Description

Spec section 6.3 specifies chips row: `flex flex-wrap items-center gap-1.5 pt-2`.

**File**: `apps/admin/src/components/entity-list/filters/FilterBar.tsx:121`
**Current**: The wrapper `div` has only `className="pt-2"`. The `flex flex-wrap items-center gap-1.5` classes are applied inside `ActiveFilterChips` component itself.

#### Impact

Functionally equivalent. Visual result is identical.

**Fix directly**: Optional. No visual impact.

---

### GAP-054-026: Barrel exports incomplete (internal components not exported)

- **Found in**: Audit #3
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (5 lines)
- **Category**: Module API
- **Status**: **DESCARTADO** (decidido 2026-04-05)
- **Decisión**: Descartar. Encapsulación correcta. No exportar componentes internos desde el barrel es buen diseño.

#### Description

`index.ts` only exports `FilterBar`, `useFilterState`, `FILTER_CLEARED_SENTINEL`, and types. Internal components (`FilterSelect`, `FilterBoolean`, `ActiveFilterChips`, `FilterChip`, `FilterActions`) are not exported from the barrel.

**File**: `apps/admin/src/components/entity-list/filters/index.ts`

#### Impact

Tests import components directly from their files (e.g., `from '../FilterSelect'`), which works. The missing barrel exports are defensible as encapsulation.

#### Proposed Solution

Add exports only if test files or other consumers need them via the barrel. Currently not blocking anything.

**Fix directly**: Optional.

---

### GAP-054-027: Integration test aria-label regex doesn't discriminate format

- **Found in**: Audit #3
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (1 character)
- **Category**: Test Quality
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Ajustar regex para validar formato vigente con mayor precisión.

#### Description

`integration.test.tsx:371` uses regex `/^Remove filter/` to match chip remove buttons. This regex matches BOTH:

- `"Remove filter: Status Active"` (spec format, GAP-054-013 fix)
- `"Remove filter Status: Active"` (current format, deviation)

The test passes regardless of whether GAP-054-013 is fixed or not.

**File**: `apps/admin/src/components/entity-list/filters/__tests__/integration.test.tsx:371`

#### Proposed Solution

Change regex to `/^Remove filter:/` to enforce the spec format.

**Fix directly**: Yes, after GAP-054-013 is fixed.

---

### GAP-054-028: UserAdminSearchSchema JSDoc example uses lowercase role

- **Found in**: Audit #3
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (1 line)
- **Category**: Documentation
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Corregir JSDoc a uppercase para evitar confusión.

#### Description

`UserAdminSearchSchema` has a JSDoc example showing `role: 'admin'` (lowercase), but `RoleEnumSchema` defines all values as uppercase (`ADMIN`, `SUPER_ADMIN`, etc.). The filter config correctly uses uppercase.

**File**: `packages/schemas/src/entities/user/user.admin-search.schema.ts:12`

#### Impact

No runtime bug. Misleading documentation that could cause a developer to send invalid values.

#### Proposed Solution

Change JSDoc example from `role: 'admin'` to `role: 'ADMIN'`.

**Fix directly**: Yes. Trivial.

---

## Summary Table (Gaps #1-#28 — status as of Audit #5)

| Gap ID | Title | Severity | Priority | Complexity | Audit | Status | Fix Directly? |
|--------|-------|----------|----------|------------|-------|--------|---------------|
| GAP-054-001 | Missing explicit `role="status"` | Medium | P2 | Trivial | #1 | Open | Yes |
| GAP-054-002 | FilterSelect aria-label missing value | Medium | P2 | Low | #1 | Open | Yes |
| GAP-054-003 | FilterBoolean aria-label missing state | Medium | P2 | Low | #1 | Open | Yes |
| GAP-054-004 | No console warning for empty options | Very Low | P4 | Trivial | #1 | Open | Yes |
| GAP-054-005 | Zero-results uses generic message | Low | P3 | Low | #1 | Open | Yes |
| GAP-054-006 | Test expects role="status" | Very Low | P4 | Trivial | #1 | **RESOLVED (#5)** | N/A |
| GAP-054-007 | FilterChip Enter double-fire | High | P1 | Trivial | #2 | **PARTIAL (#5)** | Space → 036 |
| GAP-054-008 | Integration tests miss spec cases | High | P1 | High | #2,#3 | Partially addressed | SPEC task |
| GAP-054-009 | FilterBar tests miss 5/10 cases | Medium | P2 | Medium | #2,#3 | Open | Yes |
| GAP-054-010 | FilterSelect 1/5, Boolean 1/6 tests | Medium | P2 | Medium | #2,#3 | Open (jsdom blocked) | Partial |
| GAP-054-011 | Focus lost after last chip removal | Medium | P2 | Low | #2 | Open | Yes |
| GAP-054-012 | ActiveFilterChips aria-label hardcoded EN | Medium | P2 | Trivial | #2 | Open | Yes |
| GAP-054-013 | FilterChip aria-label format | Low | P3 | Trivial | #2 | **RESOLVED (#5)** | N/A |
| GAP-054-014 | useFilterState memo deps | Very Low | P4 | Trivial | #2 | **RE-OPENED (#5)** | Optional |
| GAP-054-015 | validateSearch no filter sanitization | Low | P3 | Low | #2 | Open | Yes |
| GAP-054-016 | Double type cast for onUpdateSearch | Low | P3 | Medium | #2 | Open (→ via 037) | Yes |
| GAP-054-017 | computedDefaults prop unused | Very Low | P4 | Trivial | #2 | Open | Yes |
| GAP-054-018 | Implicit backend 'all' coupling | Very Low | P4 | N/A | #2 | Open (info) | No |
| GAP-054-019 | searchParams perf (full object memo) | Very Low | P4 | Low | #2 | Open | Optional |
| GAP-054-020 | Accessibility tests partially covered | Medium | P2 | Medium | #2,#3,#5 | Open (3/4 now) | Yes |
| GAP-054-021 | FilterBar.chips not in spec | Low | P3 | Low | #3 | Open | Update spec |
| GAP-054-022 | destinations defaultFilters not removed | Medium | P2 | Trivial | #3,#5 | Open | Yes |
| GAP-054-023 | Render condition chips.length vs hasActiveFilters | Very Low | P4 | Trivial | #3 | Open | Yes |
| GAP-054-024 | filtersEqual not RO-RO | Very Low | P4 | Trivial | #3 | Open | Optional |
| GAP-054-025 | Chips row classes split across components | Very Low | P4 | Trivial | #3 | Open | Optional |
| GAP-054-026 | Barrel exports incomplete | Very Low | P4 | Trivial | #3 | Open | Optional |
| GAP-054-027 | Test regex doesn't discriminate format | Very Low | P4 | Trivial | #3 | Open | Yes |
| GAP-054-028 | Schema JSDoc uses lowercase role | Very Low | P4 | Trivial | #3 | Open | Yes |

---

## Test Coverage Summary (Audit #3 verified)

| Suite (Spec Section) | Required | Covered | Coverage |
|----------------------|----------|---------|----------|
| 13.1 filter-utils.test.ts | 10 | 10 | 100% |
| 13.2 useFilterState.test.ts | 10 | 9 | 90% |
| 13.3 FilterBar.test.tsx | 10 | 5 | 50% |
| 13.4 FilterSelect.test.tsx | 5 | 1 | 20% |
| 13.5 FilterBoolean.test.tsx | 6 | 1 | 17% |
| 13.6 Integration tests | 8 | 5 | 63% |
| 13.7 Accessibility tests | 4 | 1 | 25% |
| **Total** | **53** | **32** | **60%** |

---

## Recommendation

### PR 1 - Urgent correctness + accessibility (P1-P2, ~1-2 hours)

- GAP-054-007 (double-fire bug, remove 5 lines)
- GAP-054-001 (role="status", 1 line)
- GAP-054-002 + 003 (aria-labels, ~15 lines total)
- GAP-054-011 (focus recovery, ~15 lines)
- GAP-054-012 (aria-label i18n, 1 line)
- GAP-054-013 (aria-label format, 1 line)
- GAP-054-022 (remove stale defaultFilters, 1 line)
- GAP-054-014 (memo deps, 3 lines)
- GAP-054-004 (console warning, 3 lines)
- GAP-054-005 (zero-results message, 10 lines)
- GAP-054-006 (auto-resolved by 001)
- GAP-054-017 + 021 (update spec to document chips prop, remove computedDefaults from FilterBarProps)
- GAP-054-023 (render condition, 1 line)
- GAP-054-027 (test regex, 1 character)
- GAP-054-028 (JSDoc fix, 1 line)

### PR 2 - Test coverage (P1-P2, ~3-4 hours)

- GAP-054-009 (FilterBar 5 missing tests)
- GAP-054-010 (interaction tests with Radix mocking)
- GAP-054-020 (accessibility tests)
- GAP-054-008 (integration tests -- 3 missing cases)

### Defer / Optional

- GAP-054-015 (sanitization, low risk with existing guards)
- GAP-054-016 (type cast, medium complexity)
- GAP-054-018 (informational only)
- GAP-054-019 (performance, negligible impact)
- GAP-054-024 (filtersEqual RO-RO, convention nit)
- GAP-054-025 (layout classes, visual equivalent)
- GAP-054-026 (barrel exports, encapsulation defensible)

### Formal SPEC not needed

All gaps can be addressed as direct fixes within existing SPEC-054 scope. No new spec required.

---

## New Gaps from Audit #4

### GAP-054-029: FILTER_CLEARED_SENTINEL not guarded in createEntityApi

- **Found in**: Audit #4
- **Severity**: Very Low (downgraded in Audit #6)
- **Priority**: P4 (downgraded in Audit #6)
- **Complexity**: Trivial (1 line)
- **Category**: Defensive Programming (not a live bug)
- **Status**: **RESOLVED** (Audit #6: data flow analysis proves sentinel CAN'T reach API. `extractActiveFilters` strips sentinels before producing `activeFilters`, which is what `EntityQueryParams.filters` receives. The `createEntityApi` filter loop operates on cleaned data. Belt-and-suspenders guard is optional.)

#### Description

`createEntityApi.ts:88-93` iterates `filters` and sets URL params for any value that is not `undefined`, `null`, or `''`. The sentinel `__cleared__` passes this guard. While `extractActiveFilters` correctly strips sentinels before producing `activeFilters`, there is no defensive guard at the API layer itself. If a future code path bypasses `extractActiveFilters` (e.g., constructs filters manually), the sentinel string `__cleared__` would be sent to the backend as a literal filter value.

**File**: `apps/admin/src/components/entity-list/api/createEntityApi.ts:90`
**Current**: `if (value !== undefined && value !== null && value !== '')`
**Expected**: `if (value !== undefined && value !== null && value !== '' && value !== FILTER_CLEARED_SENTINEL)`

#### Proposed Solution

Import `FILTER_CLEARED_SENTINEL` from `./filters` and add it to the guard:

```typescript
import { FILTER_CLEARED_SENTINEL } from '../filters';
// ...
if (value !== undefined && value !== null && value !== '' && value !== FILTER_CLEARED_SENTINEL) {
    params.set(key, String(value));
}
```

**Fix directly**: Yes. Trivial, zero risk, purely defensive.

---

### GAP-054-030: buildFilterChips boolean fallback shows "No" for any non-'true' string

- **Found in**: Audit #4
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial (3 lines)
- **Category**: Correctness / Edge Case
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Agregar branch explícito para 'false' y raw fallback para valores inesperados.

#### Description

`filter-utils.ts:178-184` handles boolean chip display values with a simple ternary: `activeValue === 'true' ? t('booleanYes') : t('booleanNo')`. Any non-'true' string (including malformed values from crafted URLs like `isFeatured=maybe`) will display as "No" in the chip, which is misleading. The chip should show the raw value for unexpected inputs.

**File**: `apps/admin/src/components/entity-list/filters/filter-utils.ts:178-184`

#### Proposed Solution

```typescript
if (activeValue === 'true') {
    displayValue = t('admin-filters.booleanYes');
} else if (activeValue === 'false') {
    displayValue = t('admin-filters.booleanNo');
} else {
    displayValue = activeValue; // raw fallback for unexpected values
}
```

**Fix directly**: Yes. Trivial.

---

### GAP-054-031: buildFilterChips O(n*m) sort complexity

- **Found in**: Audit #4
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (3 lines)
- **Category**: Performance
- **Status**: **DESCARTADO** (decidido 2026-04-05)
- **Decisión**: Descartar. Impacto negligible con 3-5 filtros por entidad. Optimización prematura.

#### Description

`filter-utils.ts:197-201` sorts chips by doing `filterBarConfig.filters.find()` TWICE per comparator call (once for each chip being compared). With `n` chips and `m` filter configs, sorting is `O(n log n * m)`. The `order` value is already available during the chip-building loop above but is discarded.

#### Proposed Solution

Build a `Map<string, number>` of `paramKey -> order` before the loop:

```typescript
const orderMap = new Map(filterBarConfig.filters.map((f) => [f.paramKey, f.order ?? 0]));
chips.sort((a, b) => (orderMap.get(a.paramKey) ?? 0) - (orderMap.get(b.paramKey) ?? 0));
```

**Fix directly**: Optional. Negligible real-world impact with 3-5 filters.

---

### GAP-054-032: FilterControlConfig is flat type, not discriminated union

- **Found in**: Audit #4
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Medium (20-30 lines, all consumers need update)
- **Category**: Type Safety / Architecture
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Refactorizar a discriminated union para type safety en compile time.

#### Description

`filter-types.ts:14-34` defines `FilterControlConfig` as a single flat type with optional fields for all filter types. This means a `boolean` config can silently include `options` with no type error, and a `select` config can omit `options` without compile-time error.

**Current**:

```typescript
export type FilterControlConfig = {
    readonly type: FilterControlType;
    readonly options?: ReadonlyArray<...>; // valid for 'select', dead for 'boolean'
    readonly allLabelKey?: string;         // valid for both, but semantically different
    // ...
};
```

**Expected** (proper discriminated union):

```typescript
type BaseFilterConfig = {
    readonly paramKey: string;
    readonly labelKey: string;
    readonly defaultValue?: string;
    readonly order?: number;
};

type SelectFilterConfig = BaseFilterConfig & {
    readonly type: 'select';
    readonly options: ReadonlyArray<{ readonly value: string; readonly labelKey: string; readonly icon?: string }>;
    readonly allLabelKey?: string;
};

type BooleanFilterConfig = BaseFilterConfig & {
    readonly type: 'boolean';
};

export type FilterControlConfig = SelectFilterConfig | BooleanFilterConfig;
```

#### Impact

With a discriminated union, TypeScript would catch misconfigured filter entries at compile time (e.g., `select` without `options`, `boolean` with spurious `options`). Currently these are silent runtime issues.

#### Proposed Solution

Refactor to discriminated union as shown above. Update `FilterSelect` to use `config.options` without optional chaining (guaranteed by type). Update `FilterBoolean` type annotation.

**Fix directly**: Possible but medium effort. Could be a separate PR. **Recommend**: fix directly as a type-safety improvement.

---

### GAP-054-033: ALL_VALUE sentinel duplicated in FilterSelect and FilterBoolean

- **Found in**: Audit #4
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (move to shared file)
- **Category**: Code Quality / Single Source of Truth
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Mover a archivo compartido como FILTER_ALL_VALUE. Single Source of Truth.

#### Description

Both `FilterSelect.tsx:20` and `FilterBoolean.tsx:20` define `const ALL_VALUE = '__all__'` independently. CLAUDE.md mandates Single Source of Truth for all constants.

#### Proposed Solution

Move to `filter-utils.ts` or `filter-types.ts` as an exported constant:

```typescript
export const FILTER_ALL_VALUE = '__all__' as const;
```

**Fix directly**: Yes. Trivial.

---

### GAP-054-034: Hardcoded Spanish "Crear" fallback in EntityListPage

- **Found in**: Audit #4
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Low (5 lines)
- **Category**: i18n Violation
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Violación i18n directa. Reemplazar con t() y agregar key a los 3 locales.

#### Description

`EntityListPage.tsx:396` has a hardcoded Spanish fallback:

```typescript
const buttonText = config.layoutConfig.createButtonText || `Crear ${entitySingular}`;
```

`"Crear"` is Spanish and will display incorrectly for `en` and `pt` locales. The project uses `@repo/i18n` for all user-facing strings (CLAUDE.md: "i18n for all user-facing text").

**Note**: This is not strictly a SPEC-054 gap (it predates the filter bar), but was discovered during filter integration review and affects the same file. Documenting here for completeness.

#### Proposed Solution

Replace with i18n key:

```typescript
const buttonText = config.layoutConfig.createButtonText
    || t('admin-entities.list.createButton' as TranslationKey, { entity: entitySingular });
```

Add the key to all 3 locale files if not already present.

**Fix directly**: Yes. Low risk.

---

### GAP-054-035: Missing test for buildFilterChips select fallback (unknown option value)

- **Found in**: Audit #4
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial (5-10 lines)
- **Category**: Testing
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Edge case importante sin cobertura. Test trivial.

#### Description

`filter-utils.ts:175-177` has a fallback path: when a `select` filter's active value does not match any configured option, `displayValue` falls back to the raw `activeValue` string. This is an important edge case (stale URLs, crafted values) but has no dedicated test.

**File**: `apps/admin/src/components/entity-list/filters/__tests__/filter-utils.test.ts`

#### Proposed Solution

Add test:

```typescript
it('falls back to raw value when select option is not found in config', () => {
    const result = buildFilterChips({
        activeFilters: { status: 'UNKNOWN_VALUE' },
        filterBarConfig: configWithSelectFilter,
        defaultFilters: {},
        t: mockT,
    });
    expect(result[0].displayValue).toBe('UNKNOWN_VALUE');
});
```

**Fix directly**: Yes. Trivial.

---

## Summary Table (Gaps #29-#35 from Audit #4 — status as of Audit #5)

| Gap ID | Title | Severity | Priority | Complexity | Audit | Status | Fix Directly? |
|--------|-------|----------|----------|------------|-------|--------|---------------|
| **GAP-054-029** | **Sentinel not guarded in createEntityApi** | **Very Low** | **P4** | **Trivial** | **#4** | **RESOLVED (#6)** | **Optional** |
| **GAP-054-030** | **Boolean chip "No" for any non-true string** | **Low** | **P3** | **Trivial** | **#4** | **Open** | **Yes** |
| **GAP-054-031** | **buildFilterChips O(n*m) sort** | **Very Low** | **P4** | **Trivial** | **#4** | **Open** | **Optional** |
| **GAP-054-032** | **FilterControlConfig not discriminated union** | **Low** | **P3** | **Medium** | **#4** | **Open** | **Yes** |
| **GAP-054-033** | **ALL_VALUE duplicated in two files** | **Very Low** | **P4** | **Trivial** | **#4** | **Open** | **Yes** |
| **GAP-054-034** | **Hardcoded Spanish "Crear" in EntityListPage** | **Medium** | **P2** | **Low** | **#4** | **Open** | **Yes** |
| **GAP-054-035** | **Missing test for select fallback raw value** | **Low** | **P3** | **Trivial** | **#4** | **Open** | **Yes** |

---

## Updated Recommendation (Audit #4)

### PR 1 - Urgent correctness + accessibility + defensive guards (P1-P2, ~2-3 hours)

- GAP-054-007 (double-fire bug, remove 5 lines)
- GAP-054-029 (sentinel guard in createEntityApi, 1 line)
- GAP-054-001 (role="status", 1 line)
- GAP-054-002 + 003 (aria-labels, ~15 lines total)
- GAP-054-011 (focus recovery, ~15 lines)
- GAP-054-012 (aria-label i18n, 1 line)
- GAP-054-034 (hardcoded Spanish "Crear", 5 lines)
- GAP-054-022 (remove stale defaultFilters, 1 line)
- GAP-054-004 (console warning, 3 lines)
- GAP-054-005 (zero-results message, 10 lines)
- GAP-054-006 (auto-resolved by 001)
- GAP-054-013 (aria-label format, 1 line)
- GAP-054-017 + 021 (update spec for chips prop, remove computedDefaults)
- GAP-054-023 (render condition, 1 line)
- GAP-054-027 (test regex, 1 character)
- GAP-054-028 (JSDoc fix, 1 line)
- GAP-054-030 (boolean fallback, 3 lines)
- GAP-054-033 (dedupe ALL_VALUE, 3 lines)
- GAP-054-035 (missing test, 10 lines)

### PR 2 - Test coverage (P1-P2, ~3-4 hours)

- GAP-054-009 (FilterBar 5 missing tests)
- GAP-054-010 (interaction tests with Radix mocking)
- GAP-054-020 (accessibility tests)
- GAP-054-008 (integration tests -- 3 missing cases)

### PR 3 - Type safety (P3, ~2-3 hours)

- GAP-054-032 (discriminated union refactor)
- GAP-054-016 (eliminate double cast)
- GAP-054-015 (validateSearch sanitization)

### Defer / Optional

- GAP-054-018 (informational only)
- GAP-054-019 (performance, negligible impact)
- GAP-054-024 (filtersEqual RO-RO, convention nit)
- GAP-054-025 (layout classes, visual equivalent)
- GAP-054-026 (barrel exports, encapsulation defensible)
- GAP-054-031 (sort perf, negligible with 3-5 filters)

---

## New Gaps from Audit #5

### GAP-054-036: Space key double-fires `onRemove` on FilterChip X button

- **Found in**: Audit #5
- **Severity**: High
- **Priority**: P1
- **Complexity**: Trivial (remove Space from handleKeyDown condition)
- **Category**: Correctness / Accessibility Bug
- **Status**: **HACER** (decidido 2026-04-05) — resuelto automáticamente con GAP-054-007/050
- **Decisión**: Se resuelve con el fix de GAP-054-007 (eliminar handleKeyDown completo).

#### Description

FilterChip.tsx has both an `onKeyDown` handler (lines 33-37) that calls `onRemove()` on Enter/Space AND an `onClick` handler (line 50). For Space key specifically: (1) `keydown` fires → `handleKeyDown` calls `onRemove()`. (2) On `keyup`, the browser fires a synthetic `click` event on buttons for Space — `e.preventDefault()` on `keydown` does NOT suppress this `keyup`-triggered click per the DOM spec. Result: `onRemove` fires twice for Space.

Note: Enter is correctly handled because `e.preventDefault()` on `keydown` DOES prevent the `keydown`-triggered click for Enter. This is a split from GAP-054-007.

**File**: `apps/admin/src/components/entity-list/filters/FilterChip.tsx:33-37`

#### Proposed Solution

Remove `' '` (Space) from the `handleKeyDown` condition. The browser natively fires `click` on `keyup` for Space on `<button>` elements. Alternatively, remove the entire `handleKeyDown` handler and rely on native button behavior for both keys.

**Fix directly**: Yes. **Urgent** — keyboard users trigger double filter removal.

---

### GAP-054-037: EntityListSearchParams missing index signature, not extracted to types.ts

- **Found in**: Audit #5
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Low (add index signature + move type)
- **Category**: Type Safety / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-05) — resuelve 037 + 016 + 056
- **Decisión**: Hacer. Mover a types.ts + agregar index signature. Elimina root cause de double cast.

#### Description

Spec section 5.4 explicitly says to extend `EntityListSearchParams` with `[filterParamKey: string]: string | number | boolean | undefined` and extract it as a named type in `types.ts`. The implementation keeps it as a local `interface` inside `EntityListPage.tsx` (lines 24-30) with no index signature.

This is the ROOT CAUSE of GAP-054-016 (double type cast). When filter params like `status` or `destinationType` are written back to search params via `useFilterState` callbacks, they're not typed in `EntityListSearchParams`, forcing the `as unknown as` cast.

**File**: `apps/admin/src/components/entity-list/EntityListPage.tsx:24-30`

#### Proposed Solution

1. Move `EntityListSearchParams` to `types.ts`
2. Add index signature: `[filterParamKey: string]: string | number | boolean | undefined`
3. This automatically resolves GAP-054-016 (the double cast becomes unnecessary)

**Fix directly**: Yes. Resolves 2 gaps at once.

---

### GAP-054-038: Props types use `interface` instead of spec's `type` keyword

- **Found in**: Audit #5
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Code Conventions
- **Status**: **POSTERGADO** (decidido 2026-04-05)
- **Decisión**: Postergar. Nit cosmético sin impacto funcional.

#### Description

Spec defines `type FilterSelectProps = {...}`, `type FilterBooleanProps = {...}`, `type FilterActionsProps = {...}` but implementation uses `export interface`. The codebase convention prefers `type` for component props.

**Files**: `FilterSelect.tsx:25`, `FilterBoolean.tsx:25`, `FilterActions.tsx:15`

**Fix directly**: Optional. No runtime impact.

---

### GAP-054-039: No test for Space key on FilterChip remove button

- **Found in**: Audit #5
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Testing / Accessibility
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Test de regresión esencial post-fix del double-fire bug.

#### Description

FilterChip.test.tsx covers Enter key at line 115 but has NO test for Space key activation. Given the Space key double-fire bug (GAP-054-036), a test is essential.

**File**: `apps/admin/src/components/entity-list/filters/__tests__/FilterChip.test.tsx`

**Fix directly**: Yes. Add `userEvent.keyboard('{Space}')` test case.

---

### GAP-054-040: FilterBar missing test for "skips unknown filter types"

- **Found in**: Audit #5
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Testing
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Test de robustez útil para futuros tipos de filtro.

#### Description

Spec section 13.3 requires a test: "Config with `type: 'relation'` → No crash, no render for that filter". FilterBar implementation handles this correctly (returns `null` for unknown types) but no test verifies it.

**File**: `apps/admin/src/components/entity-list/filters/__tests__/FilterBar.test.tsx`

**Fix directly**: Yes.

---

### GAP-054-041: FilterBar missing test for chip click calls `onFilterChange`

- **Found in**: Audit #5
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Low
- **Category**: Testing / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Contrato comportamental crítico sin cobertura.

#### Description

Spec section 13.3: "Chip click removes filter → `onFilterChange` called". The `onFilterChange` mock is defined in `defaultProps` but never asserted on. No test clicks a chip and verifies the callback fires. This is a critical behavioral contract between `ActiveFilterChips.onRemove` and `FilterBar.onFilterChange`.

**File**: `apps/admin/src/components/entity-list/filters/__tests__/FilterBar.test.tsx`

**Fix directly**: Yes. Requires `userEvent`, rendering with a chip, clicking remove, asserting mock.

---

### GAP-054-042: FilterBar missing test for "Reset to defaults" visibility

- **Found in**: Audit #5
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Testing
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Test trivial para visibilidad condicional.

#### Description

Spec section 13.3: "`Reset to defaults` visible when `hasNonDefaultFilters`". No test sets `hasNonDefaultFilters: true` and asserts the button is visible. Only the default `false` state is implicitly tested.

**File**: `apps/admin/src/components/entity-list/filters/__tests__/FilterBar.test.tsx`

**Fix directly**: Yes.

---

### GAP-054-043: Integration test missing "FilterBar absent when no config"

- **Found in**: Audit #5
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Testing / Backward Compatibility
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Test de backward compatibility esencial.

#### Description

Spec section 13.6: "FilterBar absent when no config". All integration tests use configs with filters. No test passes `filterBarConfig: undefined` to verify backward compatibility.

**File**: `apps/admin/src/components/entity-list/filters/__tests__/integration.test.tsx`

**Fix directly**: Yes.

---

### GAP-054-044: Integration test missing "Legacy entities unaffected"

- **Found in**: Audit #5
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Testing / Backward Compatibility
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Test de backward compatibility para path legacy.

#### Description

Spec section 13.6: "Entity with only `defaultFilters`, no `filterBarConfig` → No FilterBar, defaults still silently applied". No test verifies this path.

**File**: `apps/admin/src/components/entity-list/filters/__tests__/integration.test.tsx`

**Fix directly**: Yes.

---

### GAP-054-045: `createEntityApi` filter mode-switching has ZERO test coverage

- **Found in**: Audit #5
- **Severity**: High
- **Priority**: P1
- **Complexity**: Low
- **Category**: Testing / Critical Path
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Coverage fantasma, cero cobertura real. Regresión rompe 5 entidades silenciosamente. Prioridad alta.

#### Description

`createEntityApi.test.ts` tests a hand-written local implementation (`createTestEntityApi`), NOT the actual `createEntityApi` from `src/`. The real `createEntityApi`'s filterBarConfig vs defaultFilters mode-switching logic (lines 85-104) has **zero test coverage**. This is a critical contract: filterBarConfig present → ignore defaultFilters; absent → apply defaultFilters.

**File**: `apps/admin/test/components/entity-list/createEntityApi.test.ts`

#### Proposed Solution

Rewrite or supplement the test to import the REAL `createEntityApi` function and test:

1. With `filterBarConfig` present: `defaultFilters` ignored, only `filters` applied
2. With only `defaultFilters` (no filterBarConfig): defaults applied as before
3. With neither: no filter params set

**Fix directly**: Yes. High priority — a regression here silently breaks all 5 configured entities.

---

### GAP-054-046: Tab navigation accessibility test missing

- **Found in**: Audit #5
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Medium (jsdom/Radix limitation)
- **Category**: Testing / Accessibility
- **Status**: **POSTERGADO** (decidido 2026-04-05)
- **Decisión**: Postergar. P3, complejidad media, posibles issues de confiabilidad en jsdom con portals de Radix.

#### Description

Spec section 13.7.1: "All filter controls reachable via Tab". No test uses `userEvent.tab()` to verify focus traversal across filter controls. Radix Select handles keyboard navigation natively, reducing architectural risk, but the spec explicitly requires this test.

**Fix directly**: Yes, but may have reliability issues in jsdom with Radix portals.

---

### GAP-054-047: FilterBar tests missing default chip badge and sort order assertions

- **Found in**: Audit #5
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Testing
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. 2 assertions triviales que mejoran coverage de spec 13.3.

#### Description

Two missing spec 13.3 cases:

1. "Chip shows '(default)' badge" — No test renders `isDefault: true` chip and verifies badge text. (Covered in FilterChip.test.tsx and integration test, but not FilterBar unit test.)
2. "Sort order respected" — Fixture has `order: 1` and `order: 2` but no assertion on rendering order.

**Fix directly**: Yes. Trivial additions.

---

### GAP-054-048: UserAdminSearchSchema missing module-level JSDoc header

- **Found in**: Audit #5
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Documentation / Consistency
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Consistencia con los otros 4 entity schemas.

#### Description

All other admin-search schemas (destination, accommodation, event, post) have a module-level JSDoc header `/** Admin Search Schema for ... */`. The user schema lacks this.

**File**: `packages/schemas/src/entities/user/user.admin-search.schema.ts:1`

**Fix directly**: Yes. Trivial.

---

## Updated Summary Table (All 48 Gaps — Audits #1-#5)

| Gap ID | Title | Severity | Priority | Complexity | Audit | Status | Fix Directly? |
|--------|-------|----------|----------|------------|-------|--------|---------------|
| GAP-054-001 | Missing explicit `role="status"` | Medium | P2 | Trivial | #1 | Open | Yes |
| GAP-054-002 | FilterSelect aria-label missing value | Medium | P2 | Low | #1 | Open | Yes |
| GAP-054-003 | FilterBoolean aria-label missing state | Medium | P2 | Low | #1 | Open | Yes |
| GAP-054-004 | No console warning for empty options | Very Low | P4 | Trivial | #1 | Open | Yes |
| GAP-054-005 | Zero-results uses generic message | Low | P3 | Low | #1 | Open | Yes |
| GAP-054-006 | Test expects role="status" | Very Low | P4 | Trivial | #1 | **RESOLVED (#5)** | N/A |
| GAP-054-007 | FilterChip Enter key double-fire | High | P1 | Trivial | #2 | **PARTIALLY RESOLVED (#5)** | Space → GAP-054-036 |
| GAP-054-008 | Integration tests miss spec cases | High | P1 | High | #2,#3 | Partially addressed | SPEC task |
| GAP-054-009 | FilterBar tests miss 5/10 cases | Medium | P2 | Medium | #2,#3 | Open | Yes |
| GAP-054-010 | FilterSelect 1/5, Boolean 1/6 tests | Medium | P2 | Medium | #2,#3 | Open (jsdom blocked) | Partial |
| GAP-054-011 | Focus lost after last chip removal | Medium | P2 | Low | #2 | Open | Yes |
| GAP-054-012 | ActiveFilterChips aria-label hardcoded EN | Medium | P2 | Trivial | #2 | Open | Yes |
| GAP-054-013 | FilterChip aria-label format deviation | Low | P3 | Trivial | #2 | **RESOLVED (#5)** | N/A |
| GAP-054-014 | useFilterState memo deps deviate | Very Low | P4 | Trivial | #2 | **RESOLVED (#6)** | N/A |
| GAP-054-015 | validateSearch no filter sanitization | Low | P3 | Low | #2 | Open | Yes |
| GAP-054-016 | Double type cast for onUpdateSearch | Low | P3 | Medium | #2 | Open (→ fix via 037) | Yes |
| GAP-054-017 | computedDefaults prop unused | Very Low | P4 | Trivial | #2 | Open | Yes |
| GAP-054-018 | Implicit backend 'all' coupling | Very Low | P4 | N/A | #2 | Open (info) | No |
| GAP-054-019 | searchParams perf (full object memo) | Very Low | P4 | Low | #2 | Open | Optional |
| GAP-054-020 | Accessibility tests partially covered | Medium | P2 | Medium | #2,#3,#5 | Open (3/4 now) | Yes |
| GAP-054-021 | FilterBar.chips not in spec | Low | P3 | Low | #3 | Open | Update spec |
| GAP-054-022 | destinations defaultFilters not removed | Medium | P2 | Trivial | #3,#5 | Open | Yes |
| GAP-054-023 | Render condition chips.length vs hasActiveFilters | Very Low | P4 | Trivial | #3 | Open | Yes |
| GAP-054-024 | filtersEqual not RO-RO | Very Low | P4 | Trivial | #3 | Open | Optional |
| GAP-054-025 | Chips row classes split across components | Very Low | P4 | Trivial | #3 | Open | Optional |
| GAP-054-026 | Barrel exports incomplete | Very Low | P4 | Trivial | #3 | Open | Optional |
| GAP-054-027 | Test regex doesn't discriminate format | Very Low | P4 | Trivial | #3 | Open | Yes |
| GAP-054-028 | Schema JSDoc uses lowercase role | Very Low | P4 | Trivial | #3 | Open | Yes |
| GAP-054-029 | Sentinel not guarded in createEntityApi | Medium | P2 | Trivial | #4 | Open | Yes |
| GAP-054-030 | Boolean chip "No" for any non-true string | Low | P3 | Trivial | #4 | Open | Yes |
| GAP-054-031 | buildFilterChips O(n*m) sort | Very Low | P4 | Trivial | #4 | Open | Optional |
| GAP-054-032 | FilterControlConfig not discriminated union | Low | P3 | Medium | #4 | Open | Yes |
| GAP-054-033 | ALL_VALUE duplicated in two files | Very Low | P4 | Trivial | #4 | Open | Yes |
| GAP-054-034 | Hardcoded Spanish "Crear" in EntityListPage | Medium | P2 | Low | #4 | Open | Yes |
| GAP-054-035 | Missing test for select fallback raw value | Low | P3 | Trivial | #4 | Open | Yes |
| **GAP-054-036** | **Space key double-fires onRemove** | **High** | **P1** | **Trivial** | **#5** | **Open** | **Yes (urgent)** |
| **GAP-054-037** | **EntityListSearchParams missing index sig** | **Medium** | **P2** | **Low** | **#5** | **Open** | **Yes (fixes 016 too)** |
| **GAP-054-038** | **Props use interface vs type keyword** | **Very Low** | **P4** | **Trivial** | **#5** | **Open** | **Optional** |
| **GAP-054-039** | **No Space key test for FilterChip** | **Low** | **P3** | **Trivial** | **#5** | **Open** | **Yes** |
| **GAP-054-040** | **FilterBar test: skip unknown filter types** | **Very Low** | **P4** | **Trivial** | **#5** | **Open** | **Yes** |
| **GAP-054-041** | **FilterBar test: chip click → onFilterChange** | **Medium** | **P2** | **Low** | **#5** | **Open** | **Yes** |
| **GAP-054-042** | **FilterBar test: Reset visibility** | **Low** | **P3** | **Trivial** | **#5** | **Open** | **Yes** |
| **GAP-054-043** | **Integration test: absent config** | **Low** | **P3** | **Trivial** | **#5** | **Open** | **Yes** |
| **GAP-054-044** | **Integration test: legacy entities** | **Low** | **P3** | **Trivial** | **#5** | **Open** | **Yes** |
| **GAP-054-045** | **createEntityApi ZERO real test coverage** | **High** | **P1** | **Low** | **#5** | **Open** | **Yes** |
| **GAP-054-046** | **Tab navigation accessibility test** | **Low** | **P3** | **Medium** | **#5** | **Open** | **Yes** |
| **GAP-054-047** | **FilterBar tests: badge + sort order** | **Very Low** | **P4** | **Trivial** | **#5** | **Open** | **Yes** |
| **GAP-054-048** | **UserAdminSearchSchema missing JSDoc** | **Very Low** | **P4** | **Trivial** | **#5** | **Open** | **Yes** |

---

## Test Coverage Summary (Audit #5 updated)

| Suite (Spec Section) | Required | Covered | Partial | Missing | Coverage % |
|----------------------|----------|---------|---------|---------|-----------|
| 13.1 filter-utils.test.ts | 17 | 17 | 0 | 0 | **100%** |
| 13.2 useFilterState.test.ts | 10 | 10 | 0 | 0 | **100%** |
| 13.3 FilterBar.test.tsx | 10 | 4 | 1 | 5 | **40%** |
| 13.4 FilterSelect.test.tsx | 5 | 1 | 1 | 3 | **20%** |
| 13.5 FilterBoolean.test.tsx | 6 | 1 | 1 | 4 | **17%** |
| 13.6 Integration tests | 8 | 5 | 0 | 3 | **63%** |
| 13.7 Accessibility tests | 4 | 2 | 1 | 1 | **50%** |
| **Total** | **60** | **40** | **4** | **16** | **67%** |

Total actual test cases across all files: **89** (`it`/`test` blocks)

---

## Updated Recommendation (Audit #5)

### PR 1 - Urgent correctness + accessibility + defensive guards (P1-P2, ~3-4 hours)

- GAP-054-036 (Space key double-fire, remove Space from handleKeyDown)
- GAP-054-045 (createEntityApi real test coverage, new test file)
- GAP-054-029 (sentinel guard, 1 line)
- GAP-054-037 (EntityListSearchParams index signature → also resolves 016)
- GAP-054-022 (remove stale defaultFilters, 1 line)
- GAP-054-034 (hardcoded Spanish "Crear", 5 lines)
- GAP-054-001 (role="status", 1 line)
- GAP-054-002 + 003 (aria-labels with current value, ~15 lines)
- GAP-054-011 (focus recovery, ~15 lines)
- GAP-054-012 (aria-label i18n, 1 line)
- GAP-054-041 (FilterBar test chip → onFilterChange)

### PR 2 - Test coverage (P2-P3, ~4-5 hours)

- GAP-054-009 (FilterBar 5 missing tests)
- GAP-054-010 (interaction tests with Radix mocking)
- GAP-054-020 (accessibility tests)
- GAP-054-008 (integration tests — 3 missing cases: 043, 044, +URL update)
- GAP-054-039 (Space key test)
- GAP-054-042 (Reset visibility test)
- GAP-054-046 (Tab navigation test)
- GAP-054-047 (badge + sort order tests)
- GAP-054-035 (select fallback test)

### PR 3 - Type safety + code quality (P3, ~2-3 hours)

- GAP-054-032 (discriminated union refactor)
- GAP-054-015 (validateSearch sanitization)
- GAP-054-033 (dedupe ALL_VALUE)
- GAP-054-030 (boolean fallback)
- GAP-054-005 (zero-results message)
- GAP-054-004 (console warning)
- GAP-054-017 + 021 (update spec for chips prop, remove computedDefaults)
- GAP-054-023 (render condition)
- GAP-054-028 (JSDoc fix)
- GAP-054-048 (UserSchema JSDoc)

### Defer / Optional

- GAP-054-014 (memo deps, functionally safe)
- GAP-054-018 (informational only)
- GAP-054-019 (performance, negligible)
- GAP-054-024 (filtersEqual RO-RO)
- GAP-054-025 (layout classes split)
- GAP-054-026 (barrel exports)
- GAP-054-027 (test regex)
- GAP-054-031 (sort perf)
- GAP-054-038 (interface vs type)
- GAP-054-040 (unknown filter type test)

### Formal SPEC not needed

All gaps can be addressed as direct fixes within existing SPEC-054 scope. No new spec required.

---

## Gaps Resolved in Audit #6

### GAP-054-014: RESOLVED

Memo deps for callbacks are functionally correct. `computedDefaults` derives exclusively from `filterBarConfig`, so omitting it from `useCallback` deps is safe. See updated gap entry above.

### GAP-054-029: RESOLVED

Data flow analysis proves sentinel CAN'T reach API. `extractActiveFilters` strips sentinels before producing `activeFilters`. The `createEntityApi` filter loop operates on cleaned data only. Belt-and-suspenders guard is optional (not a live bug).

### GAP-054-015: RECLASSIFIED (Medium → Very Low)

Related to GAP-054-029. The `validateSearch` spread of `filterParams` does pass sentinel strings through to the search object, but `useFilterState.extractActiveFilters` strips them before they enter `activeFilters`. Downstream consumers never see sentinels. Reclassified as a defensive guard recommendation, not a live bug.

---

## New Gaps from Audit #6

### GAP-054-049: FilterChip `tabIndex={0}` redundant on native `<button>`

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (1 line removal)
- **Category**: HTML Hygiene
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Limpieza mínima, elimina atributo misleading en button nativo.

#### Description

`FilterChip.tsx:53` adds `tabIndex={0}` on a native `<button>` element. Native buttons are focusable by default (implicit tabIndex 0). The explicit attribute is harmless but misleading.. suggests the element needs it. The spec (section 6.7) calls for it, but the spec is wrong on this point.

**Fix directly**: Optional. Remove attribute or leave as-is.

---

### GAP-054-050: FilterChip `handleKeyDown` entirely redundant on native button (root cause of GAP-054-036)

- **Found in**: Audit #6
- **Severity**: High
- **Priority**: P1
- **Complexity**: Trivial (remove entire handler + onKeyDown prop)
- **Category**: Correctness / Architecture
- **Status**: **HACER** (decidido 2026-04-05) — se resuelve junto con GAP-054-007/036
- **Decisión**: Hacer. Eliminar handleKeyDown completo. Root cause del double-fire bug.

#### Description

The entire `handleKeyDown` function in `FilterChip.tsx:33-37` is unnecessary on a native `<button>`. Native buttons handle Enter and Space via the `click` event automatically. The handler:

1. Is **redundant** for Enter (native button fires `onClick` on Enter keydown)
2. Is **harmful** for Space (causes double-fire per GAP-054-036 since browser fires synthetic `click` on keyup for Space, and `preventDefault()` on keydown does NOT suppress it)

This is a more precise root-cause analysis than GAP-054-036 (which documents the Space symptom). The complete fix for BOTH GAP-054-036 AND GAP-054-050 is to **remove the entire `handleKeyDown` handler and its `onKeyDown` prop**.

#### Proposed Solution

```diff
- const handleKeyDown = (e: React.KeyboardEvent) => {
-     if (e.key === 'Enter' || e.key === ' ') {
-         e.preventDefault();
-         onRemove();
-     }
- };
```

And remove `onKeyDown={handleKeyDown}` from the button JSX. Native button behavior handles both keys correctly.

**Fix directly**: Yes. **Urgent** -- fixes GAP-054-036 as a side effect.

---

### GAP-054-051: `buildFilterParamUpdate` not re-exported from barrel

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (1 line)
- **Category**: Module API
- **Status**: **DESCARTADO** (decidido 2026-04-05)
- **Decisión**: Descartar. Encapsulación correcta, mismo criterio que GAP-054-026. No hay consumidor externo.

#### Description

`filter-utils.ts:236` exports `buildFilterParamUpdate` but `filters/index.ts` does not re-export it. Used internally by `useFilterState`. No external consumer currently needs it, so this is defensible encapsulation.

**Fix directly**: Optional.

---

### GAP-054-052: `FilterControlType` not exported from `filter-types.ts`

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (add `export` keyword)
- **Category**: Type Safety / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Trivial, complementa GAP-054-032 (discriminated union).

#### Description

`filter-types.ts:7` declares `type FilterControlType = 'select' | 'boolean'` without `export`. Spec section 5.1 defines it as `export type FilterControlType`. Consumers needing to reference this type by name cannot import it.

**Fix directly**: Yes. 1 character (`export`).

---

### GAP-054-053: Filter label not visible in trigger when value is selected

- **Found in**: Audit #6
- **Severity**: Low
- **Priority**: P3
- **Complexity**: Low (10-15 lines per component)
- **Category**: UX / Spec Compliance
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Mostrar "Label: Valor" en el trigger para dar contexto visual.

#### Description

Spec section 6.4: "Trigger shows the translated label when no value selected, translated value when active." The implication is that users see context for which filter they're looking at.

Current behavior: `FilterSelect.tsx:67-75` and `FilterBoolean.tsx` only show the selected value (e.g., "Active") in the trigger when active. The filter's label (e.g., "Status") disappears. A row of dropdowns all showing "Active", "City", "Yes" has no visual context.

**Note**: GAP-054-002/003 cover the accessibility (aria-label) dimension. This gap covers the **visual/UX** dimension.. the label is not rendered in the trigger's visible text content.

#### Proposed Solution

Show label prefix in trigger: "Status: Active" instead of just "Active". Common pattern in admin UIs.

**Fix directly**: Possible. Recommend consulting user on desired visual approach.

---

### GAP-054-054: FilterBoolean ignores `allLabelKey` from config

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Flexibility / Informational
- **Status**: **DESCARTADO** (decidido 2026-04-05)
- **Decisión**: Descartar. Se resuelve por diseño con GAP-054-032 (discriminated union): allLabelKey no aplica a BooleanFilterConfig. Ninguna config actual necesita label distinto de "All" para boolean.

#### Description

`FilterBoolean.tsx:73` always uses `t('admin-filters.allOption')` for the "All" option, ignoring any `allLabelKey` on the config. Since the flat `FilterControlConfig` type allows setting `allLabelKey` on boolean configs, but FilterBoolean never reads it.

**Fix directly**: Optional. Informational.

---

### GAP-054-055: `requestAnimationFrame` in ActiveFilterChips untestable in jsdom

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: N/A (informational)
- **Category**: Test Infrastructure
- **Status**: **DESCARTADO** (decidido 2026-04-05)
- **Decisión**: Descartar. Informacional, no es bug. Tests de focus se resuelven con vi.spyOn/runAllTimersAsync.

#### Description

`ActiveFilterChips.tsx:34` uses `requestAnimationFrame` for post-DOM focus management. In jsdom (Vitest), `requestAnimationFrame` runs synchronously or is unavailable, making focus management tests unreliable. This explains why GAP-054-011 and GAP-054-020 remain untested.

**Fix directly**: No direct fix. Consider wrapping in a testable utility or using `queueMicrotask` as alternative.

---

### GAP-054-056: `validateSearch` `as const` assertion prevents filter param type widening

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (remove `as const`)
- **Category**: Type Safety
- **Status**: **HACER** (decidido 2026-04-05) — se resuelve junto con GAP-054-037
- **Decisión**: Hacer como parte de GAP-054-037. Al agregar index signature, el as const deja de ser problemático.

#### Description

`EntityListPage.tsx:149` returns `{ page, pageSize, view, q, sort, cols, ...filterParams } as const`. The `as const` freezes the object type. Combined with missing index signature on `EntityListSearchParams` (GAP-054-037), this prevents TypeScript from correctly typing the spread `filterParams`. Related to GAP-054-016/037 root cause.

**Fix directly**: Yes, as part of GAP-054-037 fix.

---

### GAP-054-057: `FILTER_CLEARED_SENTINEL` exported as public API from barrel

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: API Surface / Encapsulation
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Remover del barrel export, es detalle de implementación interna.

#### Description

`filters/index.ts:7` exports `FILTER_CLEARED_SENTINEL` and `index.ts:54` re-exports it via `export * from './filters'`. The sentinel is an internal implementation detail of the three-state URL encoding scheme. Exposing it encourages direct manipulation bypassing the controlled mutation paths (`handleFilterChange`, `handleClearAll`).

**Fix directly**: Optional. Check if any consumer imports it directly first.

---

### GAP-054-058: `useEntityQuery` creates `queryKeys` on every render

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (move outside hook or memoize)
- **Category**: Performance
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Memoizar con useMemo para evitar allocation innecesaria.

#### Description

`hooks/useEntityQuery.ts:14` calls `createEntityQueryKeys(entityName)` on every render. If the factory creates a new object per call, this is unnecessary allocation. TanStack Query uses deep equality for query keys so this is not a functional bug.

**Fix directly**: Optional. Negligible real-world impact.

---

### GAP-054-059: `useEntityQuery` identity `select` function is a no-op

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (remove option)
- **Category**: Code Quality
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Eliminar 1 línea, cero riesgo, elimina overhead innecesario en TanStack Query.

#### Description

`hooks/useEntityQuery.ts:34` has `select: (data) => data` which does nothing. The identity selector forces TanStack Query to run the selector on every cache update. Should be removed.

**Fix directly**: Yes. Trivial.

---

### GAP-054-060: `eventsConfig` missing JSDoc

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Documentation
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Consistencia con los demás entity configs. Junto con GAP-054-061.

#### Description

`apps/admin/src/features/events/config/events.config.ts:8` -- exported `eventsConfig` const has no JSDoc. Other entity configs (destinations, accommodations, users) have JSDoc.

**Fix directly**: Yes.

---

### GAP-054-061: `postsConfig` missing JSDoc

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Documentation
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Consistencia con los demás entity configs. Junto con GAP-054-060.

#### Description

`apps/admin/src/features/posts/config/posts.config.ts:8` -- same as GAP-054-060. No JSDoc on exported `postsConfig`.

**Fix directly**: Yes.

---

### GAP-054-062: `FilterActions.test.tsx` entirely absent

- **Found in**: Audit #6
- **Severity**: Medium
- **Priority**: P2
- **Complexity**: Low (15-20 lines)
- **Category**: Testing / Coverage
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Crear test file con 6 test cases para lógica condicional de FilterActions.

#### Description

`FilterActions` is an exported component with conditional rendering logic (Clear all visible when `hasActiveFilters`, Reset visible when `hasNonDefaultFilters`). It has **zero** dedicated test coverage. The spec (section 13.3) expects some of this to be tested via FilterBar tests, but FilterBar tests are also incomplete on these scenarios (GAP-054-009, 010).

#### Proposed Solution

Create `apps/admin/src/components/entity-list/filters/__tests__/FilterActions.test.tsx` with:

1. "Clear all" button visible when `hasActiveFilters: true`
2. "Clear all" button hidden when `hasActiveFilters: false`
3. "Reset to defaults" visible when `hasNonDefaultFilters: true`
4. "Reset to defaults" hidden when `hasNonDefaultFilters: false`
5. Click "Clear all" calls `onClearAll`
6. Click "Reset to defaults" calls `onResetDefaults`

**Fix directly**: Yes.

---

### GAP-054-063: FilterBoolean `value="false"` branch untested

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial (5 lines)
- **Category**: Testing
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Test trivial que completa la matrix de valores del componente.

#### Description

`FilterBoolean.test.tsx` tests `value="true"` and `value={undefined}` but never `value="false"`. The `false` branch shares logic with `true` (`isActive = value !== undefined`), but explicit coverage prevents regressions.

**Fix directly**: Yes.

---

### GAP-054-064: Integration test `aria-label` regex is English-only

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Test Quality
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Ajustar regex para usar translation key pattern en vez de string hardcodeado.

#### Description

`integration.test.tsx:371` uses `{ name: /^Remove filter/ }` which hardcodes English. The mock `t` function returns keys directly so this works, but it's fragile if the mock changes.

**Fix directly**: Optional.

---

### GAP-054-065: FilterBar test uses CSS-brittle `.flex.items-center.gap-1` selector

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Test Quality
- **Status**: **HACER** (decidido 2026-04-05) — junto con GAP-054-009
- **Decisión**: Hacer como parte de GAP-054-009 (FilterBar test improvements). Reemplazar con query semántica.

#### Description

`FilterBar.test.tsx:79` uses `container.querySelector('.flex.items-center.gap-1')` to find the FilterActions area. If CSS classes change, test breaks silently. Should use `data-testid` or role-based query.

**Fix directly**: Optional.

---

### GAP-054-066: FilterChip test `.focus()` bypasses tab order validation

- **Found in**: Audit #6
- **Severity**: Very Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Test Quality
- **Status**: **HACER** (decidido 2026-04-05)
- **Decisión**: Hacer. Reemplazar .focus() con userEvent.tab() para validar keyboard reachability.

#### Description

`FilterChip.test.tsx:114` calls `button.focus()` directly instead of `userEvent.tab()`. This verifies Enter-key invocation but not keyboard reachability.

**Fix directly**: Optional.

---

## Updated Summary Table (All 66 Gaps -- Audits #1-#6)

| Gap ID | Title | Severity | Priority | Audit | Status | Fix? |
|--------|-------|----------|----------|-------|--------|------|
| 001 | Missing explicit `role="status"` | Medium | P2 | #1 | Open | Yes |
| 002 | FilterSelect aria-label missing value | Medium | P2 | #1 | Open | Yes |
| 003 | FilterBoolean aria-label missing state | Medium | P2 | #1 | Open | Yes |
| 004 | No console warning for empty options | Very Low | P4 | #1 | Open | Yes |
| 005 | Zero-results uses generic message | Low | P3 | #1 | Open | Yes |
| 006 | Test expects role="status" | Very Low | P4 | #1 | **RESOLVED (#5)** | N/A |
| 007 | FilterChip Enter key double-fire | High | P1 | #2 | **PARTIAL (#5)** | → 036/050 |
| 008 | Integration tests miss spec cases | High | P1 | #2 | Partially addressed | Yes |
| 009 | FilterBar tests miss 5/10 cases | Medium | P2 | #2 | Open | Yes |
| 010 | FilterSelect/Boolean interaction tests | Medium | P2 | #2 | Open (jsdom) | Partial |
| 011 | Focus lost after last chip removal | Medium | P2 | #2 | Open | Yes |
| 012 | ActiveFilterChips aria-label hardcoded EN | Medium | P2 | #2 | Open | Yes |
| 013 | FilterChip aria-label format | Low | P3 | #2 | **RESOLVED (#5)** | N/A |
| 014 | useFilterState memo deps | Very Low | P4 | #2 | **RESOLVED (#6)** | N/A |
| 015 | validateSearch no filter sanitization | Very Low | P4 | #2 | Open (reclassified #6) | Optional |
| 016 | Double type cast onUpdateSearch | Low | P3 | #2 | Open (→ fix via 037) | Yes |
| 017 | computedDefaults prop unused | Very Low | P4 | #2 | Open | Yes |
| 018 | Implicit backend 'all' coupling | Very Low | P4 | #2 | Open (info) | No |
| 019 | searchParams perf (full object memo) | Very Low | P4 | #2 | Open | Optional |
| 020 | Accessibility tests partially covered | Medium | P2 | #2 | Open | Yes |
| 021 | FilterBar.chips not in spec | Low | P3 | #3 | Open | Spec update |
| 022 | destinations defaultFilters not removed | Medium | P2 | #3 | Open | Yes |
| 023 | Render condition chips.length vs hasActiveFilters | Very Low | P4 | #3 | Open | Yes |
| 024 | filtersEqual not RO-RO | Very Low | P4 | #3 | Open | Optional |
| 025 | Chips row classes split | Very Low | P4 | #3 | Open | Optional |
| 026 | Barrel exports incomplete | Very Low | P4 | #3 | Open | Optional |
| 027 | Test regex doesn't discriminate format | Very Low | P4 | #3 | Open | Yes |
| 028 | Schema JSDoc uses lowercase role | Very Low | P4 | #3 | Open | Yes |
| 029 | Sentinel not guarded in createEntityApi | Very Low | P4 | #4 | **RESOLVED (#6)** | N/A |
| 030 | Boolean chip "No" for non-true string | Low | P3 | #4 | Open | Yes |
| 031 | buildFilterChips O(n*m) sort | Very Low | P4 | #4 | Open | Optional |
| 032 | FilterControlConfig not discriminated union | Low | P3 | #4 | Open | Yes |
| 033 | ALL_VALUE duplicated in two files | Very Low | P4 | #4 | Open | Yes |
| 034 | Hardcoded Spanish "Crear" | Medium | P2 | #4 | Open | Yes |
| 035 | Missing test for select fallback | Low | P3 | #4 | Open | Yes |
| 036 | Space key double-fires onRemove | High | P1 | #5 | Open (→ fix via 050) | Yes |
| 037 | EntityListSearchParams missing index sig | Medium | P2 | #5 | Open | Yes |
| 038 | Props use interface vs type | Very Low | P4 | #5 | Open | Optional |
| 039 | No Space key test for FilterChip | Low | P3 | #5 | Open | Yes |
| 040 | FilterBar test: skip unknown types | Very Low | P4 | #5 | Open | Yes |
| 041 | FilterBar test: chip → onFilterChange | Medium | P2 | #5 | Open | Yes |
| 042 | FilterBar test: Reset visibility | Low | P3 | #5 | Open | Yes |
| 043 | Integration test: absent config | Low | P3 | #5 | Open | Yes |
| 044 | Integration test: legacy entities | Low | P3 | #5 | Open | Yes |
| 045 | createEntityApi ZERO real test coverage | High | P1 | #5 | Open | Yes |
| 046 | Tab navigation a11y test | Low | P3 | #5 | Open | Yes |
| 047 | FilterBar tests: badge + sort order | Very Low | P4 | #5 | Open | Yes |
| 048 | UserAdminSearchSchema missing JSDoc | Very Low | P4 | #5 | Open | Yes |
| **049** | **FilterChip tabIndex redundant on button** | **Very Low** | **P4** | **#6** | **Open** | **Optional** |
| **050** | **handleKeyDown entirely redundant (root of 036)** | **High** | **P1** | **#6** | **Open** | **Yes (urgent)** |
| **051** | **buildFilterParamUpdate not re-exported** | **Very Low** | **P4** | **#6** | **Open** | **Optional** |
| **052** | **FilterControlType not exported** | **Very Low** | **P4** | **#6** | **HACER** | **Yes** |
| **053** | **Filter label invisible in trigger when active** | **Low** | **P3** | **#6** | **Open** | **Consult user** |
| **054** | **FilterBoolean ignores allLabelKey** | **Very Low** | **P4** | **#6** | **Open** | **Optional** |
| **055** | **rAF untestable in jsdom** | **Very Low** | **P4** | **#6** | **Open** | **Informational** |
| **056** | **as const prevents filter param widening** | **Very Low** | **P4** | **#6** | **Open** | **Fix via 037** |
| **057** | **FILTER_CLEARED_SENTINEL public export** | **Very Low** | **P4** | **#6** | **Open** | **Optional** |
| **058** | **queryKeys created on every render** | **Very Low** | **P4** | **#6** | **Open** | **Optional** |
| **059** | **Identity select no-op in useEntityQuery** | **Very Low** | **P4** | **#6** | **Open** | **Yes** |
| **060** | **eventsConfig missing JSDoc** | **Very Low** | **P4** | **#6** | **Open** | **Yes** |
| **061** | **postsConfig missing JSDoc** | **Very Low** | **P4** | **#6** | **Open** | **Yes** |
| **062** | **FilterActions.test.tsx entirely absent** | **Medium** | **P2** | **#6** | **Open** | **Yes** |
| **063** | **FilterBoolean value="false" untested** | **Very Low** | **P4** | **#6** | **Open** | **Yes** |
| **064** | **Integration test English-only regex** | **Very Low** | **P4** | **#6** | **Open** | **Optional** |
| **065** | **FilterBar test CSS-brittle selector** | **Very Low** | **P4** | **#6** | **Open** | **Optional** |
| **066** | **FilterChip test .focus() bypasses tab** | **Very Low** | **P4** | **#6** | **Open** | **Optional** |

### Statistics (Audit #6)

| Metric | Count |
|--------|-------|
| Total gaps (all audits) | 66 |
| Resolved | 5 (006, 013, 014, 029 + 007 partial) |
| Open P1 (urgent) | 3 (036/050 doubled, 045, 008) |
| Open P2 | 13 |
| Open P3 | 13 |
| Open P4 / Optional | 30 |
| Informational (no action) | 2 (018, 055) |

---

## Updated Recommendation (Audit #6)

### PR 1 - Urgent correctness + accessibility (P1-P2, ~3-4 hours)

- GAP-054-050 (remove entire handleKeyDown → fixes 036 and 007 fully)
- GAP-054-045 (createEntityApi real test coverage)
- GAP-054-037 (EntityListSearchParams to types.ts + index sig → fixes 016 + 056)
- GAP-054-022 (remove stale defaultFilters, 1 line)
- GAP-054-034 (hardcoded Spanish "Crear", 5 lines)
- GAP-054-001 (role="status", 1 line)
- GAP-054-002 + 003 (aria-labels with current value, ~15 lines)
- GAP-054-011 (focus recovery after last chip, ~15 lines)
- GAP-054-012 (aria-label i18n, 1 line)
- GAP-054-041 (FilterBar test chip → onFilterChange)
- GAP-054-062 (create FilterActions.test.tsx)

### PR 2 - Test coverage (P2-P3, ~4-5 hours)

- GAP-054-009 (FilterBar 5 missing tests)
- GAP-054-010 (interaction tests with Radix mocking)
- GAP-054-020 (accessibility tests — Tab navigation)
- GAP-054-008 (integration tests: 043, 044, URL update)
- GAP-054-039 (Space key test)
- GAP-054-042 (Reset visibility test)
- GAP-054-046 (Tab navigation test)
- GAP-054-047 (badge + sort order tests)
- GAP-054-035 (select fallback test)
- GAP-054-063 (FilterBoolean false branch)

### PR 3 - Type safety + code quality (P3, ~2-3 hours)

- GAP-054-032 (discriminated union refactor)
- GAP-054-033 (dedupe ALL_VALUE)
- GAP-054-030 (boolean fallback for non-true/false)
- GAP-054-005 (zero-results message)
- GAP-054-053 (filter label in trigger — consult user on UX)
- GAP-054-004 (console warning)
- GAP-054-017 + 021 (update spec for chips prop, remove computedDefaults)
- GAP-054-023 (render condition)
- GAP-054-028, 048, 060, 061 (JSDoc fixes)
- GAP-054-052 (export FilterControlType)
- GAP-054-059 (remove identity select)

### Defer / Optional

- GAP-054-015 (defensive guard, not live bug)
- GAP-054-018 (informational only)
- GAP-054-019, 031, 058 (performance, negligible)
- GAP-054-024 (filtersEqual RO-RO)
- GAP-054-025 (layout classes split)
- GAP-054-026, 051 (barrel exports)
- GAP-054-027, 064, 065, 066 (test quality nits)
- GAP-054-038 (interface vs type)
- GAP-054-049 (redundant tabIndex)
- GAP-054-054 (allLabelKey on boolean)
- GAP-054-055, 057 (informational)

### Formal SPEC not needed

All 66 gaps can be addressed as direct fixes within existing SPEC-054 scope. No new spec required.
