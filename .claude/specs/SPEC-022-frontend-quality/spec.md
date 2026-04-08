---
spec-id: SPEC-022
title: Frontend Quality: Theming, i18n, Performance & Code Quality
type: improvement
complexity: medium
status: pending
created: 2026-02-27T00:00:00.000Z
approved: 2026-02-27T00:00:00.000Z
last-revised: 2026-03-16T00:00:00.000Z
completed: null
---

## SPEC-022: Frontend Quality — Theming, i18n, Performance & Code Quality

> **Revision note (2026-03-16):** Full codebase audit performed. ~90% of the original spec was completed by other teams/SPECs. This revision marks completed items, removes obsolete scope, updates the remaining gaps, and adds newly discovered quality issues.

---

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Resolve the remaining quality gaps in the Hospeda platform after multiple implementation passes. The original audit (2026-02-27) identified 19 issues across theming, i18n, and performance. A re-audit on 2026-03-16 confirmed ~90% are resolved. This spec now covers: 3 remaining dark mode bugs, 3 code quality gaps (TypeScript `any`, technical debt TODOs, accessibility), and 1 newly discovered item (composite indexes). Plural locale coverage (US-I06) was verified 100% complete during the re-audit and moved to the completed list.

#### What Was Already Completed (Do Not Re-Implement)

The following original scope items are **fully implemented** as of 2026-03-16:

| Original Item | Status | Evidence |
|--------------|--------|---------|
| CSS variables dark mode foundation (US-T02) | ✅ DONE | `global.css` has 23 light/dark token pairs under `[data-theme="dark"]` |
| Z-index strategy (US-T03) | ✅ DONE | Documented and consistent |
| Shared Tailwind config decision (US-T04) | ✅ DONE | Apps intentionally use separate design systems |
| Admin shadcn semantic colors (US-T07) | ✅ DONE | All admin pages use `bg-background`, `text-foreground` etc. |
| Admin hardcoded strings → i18n (US-I01) | ✅ DONE | 100% of user-facing strings use `t()`. CacheMonitor, invoices, exchange-rates all migrated |
| Admin language strategy (US-I02) | ✅ DONE | English-first admin i18n with consistent namespace structure |
| Date/number formatting centralized (US-I03) | ✅ DONE | 31+ files use `formatDate/formatCurrency/formatNumber` from `@repo/i18n`. Zero hardcoded `'es-AR'` in executable code |
| 404/500 locale-aware error pages (US-I04) | ✅ DONE | Error pages derive locale from URL |
| Pluralization system (US-I05) | ✅ DONE | CLDR `_one`/`_other` pattern in `packages/i18n/src/pluralization.ts`. 20+ plural keys. Zero manual ternaries |
| N+1 query fix — users (US-P01) | ✅ DONE | `user.service.ts` uses `findAllWithCounts()` single query |
| N+1 query fix — amenity/feature (US-P02) | ✅ DONE | `Promise.all()` batch pattern consistent |
| API cache middleware (US-P03) | ✅ DONE | In-memory LRU cache, 20+ routes with TTL, X-Cache headers |
| Users table indexes (US-P04) | ✅ DONE | 122 `index()` calls across 31 schema files |
| Search index materialized view refresh (US-P05) | ✅ DONE | Cron job every 6 hours with `CONCURRENTLY` |
| Health check middleware bypass (US-P06) | ✅ DONE | 5 routes with `skipValidation: true` |
| Hero hydration directives (US-P07) | ✅ DONE | `client:load`/`client:idle`/`client:visible` correctly distributed |
| Vite aliases (US-P08) | ✅ DONE | 8 aliases in both `vite.config.ts` and `astro.config.mjs` with production code-splitting |
| Plural keys es/pt coverage (US-I06) | ✅ DONE | 38 `_one`/`_other` key pairs confirmed in all 3 locales (en/es/pt). Verified by exhaustive re-audit 2026-03-16 |

---

#### Remaining Scope

Three categories of work remain:

1. **Dark mode bugs** — 3 issues in `apps/web` components (undefined CSS variables, `!important` abuse, social button contrast)
2. **Code quality** — TypeScript `any` types (6 files), TODO/FIXME debt (14 active), accessibility gaps (ReviewForm buttons)
3. **Performance optimization** — Composite indexes for high-frequency billing query patterns

#### Success Metrics

- Zero undefined CSS variable references in `apps/web` components
- Social share buttons maintain WCAG AA contrast in both light and dark mode
- Zero `!important` declarations in component stylesheets
- Zero `any` types in production admin component code (`entity-form/`, `entity-list/`, `lib/`)
- All TODO/FIXME comments in identified files resolved or filed as separate tasks
- ReviewForm submit/cancel buttons have `aria-label` attributes
- Composite indexes exist for the top billing and entity query patterns

---

### 2. User Stories & Acceptance Criteria

---

#### THEME GROUP: Remaining Dark Mode Bugs

---

##### US-T01: LitoralMap uses valid CSS variable references

**As a** visitor viewing a destination detail page,
**I want** the Litoral region map to render correctly with proper colors,
**so that** the map is visually useful and not broken with invisible shapes or text.

**Maps to:** THEME-01 (partial — most dark mode work is done; this is the remaining bug)

**Root cause:** `LitoralMap.astro` references 3 CSS variables that do not exist in `global.css`. They render as transparent/invalid, breaking the map visually.

**Broken variable → correct variable mapping:**

| File | Line | Broken | Correct |
|------|------|--------|---------|
| `LitoralMap.astro` | 98–99 | `var(--color-surface)` | `var(--color-card)` |
| `LitoralMap.astro` | 110 | `var(--color-text-secondary)` | `var(--color-muted-foreground)` |
| `LitoralMap.astro` | 194, 222 | `var(--color-bg)` | `var(--color-background)` |

**Acceptance Criteria:**

- **Given** `LitoralMap.astro` is rendered, **When** the SVG component mounts, **Then** the province shape has a visible fill color (not transparent)
- **Given** the map title text (line 110), **When** rendered, **Then** it is visible in both light and dark mode
- **Given** marker strokes (line 194) and tooltip backgrounds (line 222), **When** rendered, **Then** they are visible against the page background
- **Given** `global.css`, **When** searched for `--color-surface`, `--color-text-secondary`, `--color-bg`, **Then** zero occurrences remain in `LitoralMap.astro` referencing these undefined variables
- **Given** dark mode is active, **When** the map renders, **Then** all map elements use the correct dark-mode token values

---

##### US-T05: No `!important` overrides in component stylesheets

**As a** developer maintaining CSS,
**I want** no `!important` declarations in component stylesheets,
**so that** specificity conflicts are solved at source and cascade order is predictable.

**Remaining violation:** `LitoralMap.astro:290` — `opacity: 0 !important` used to hide river SVG paths before scroll animation.

**Acceptance Criteria:**

- **Given** `LitoralMap.astro`, **When** the scroll animation requires hidden paths, **Then** the hidden state is achieved via CSS specificity, data-attributes, or JavaScript class toggling, not `!important`
- **Given** the full `apps/web` codebase, **When** searched for `!important`, **Then** zero occurrences remain in component stylesheets (inline critical CSS and verified third-party overrides explicitly excluded)

---

##### US-T06: Social share buttons maintain contrast in dark mode

**As a** visitor in dark mode viewing accommodation or event detail pages,
**I want** the social share buttons (WhatsApp, Facebook, Twitter/X) to be visually legible,
**so that** I can use them without straining to see them against the dark background.

**Maps to:** THEME-06 (partial — HeroCarousel and other rgba issues were resolved; social buttons remain)

**Root cause:** `ShareButtons.client.tsx` uses hardcoded palette classes that break dark mode contrast:

| Line | Current | Problem |
|------|---------|---------|
| 163 | `bg-green-500 text-white` | Brand color acceptable; verify contrast is AA in dark mode |
| 177 | `bg-blue-600 text-white` | Brand color acceptable; verify contrast |
| 191 | `bg-black text-white` | `bg-black` on dark background = invisible button |

**Acceptance Criteria:**

- **Given** dark mode is active, **When** `ShareButtons.client.tsx` renders, **Then** all three social buttons (WhatsApp, Facebook, Twitter/X) are visually distinct from the page background
- **Given** the Twitter/X button (`bg-black`), **When** dark mode is active, **Then** the button has sufficient contrast (minimum 3:1 against the card background per WCAG AA for UI components), achieved via `dark:bg-gray-700` or equivalent
- **Given** WhatsApp and Facebook buttons, **When** rendered in dark mode, **Then** their existing palette colors (`bg-green-500`, `bg-blue-600`) maintain sufficient contrast against the dark background — if they pass 3:1, no change is needed
- **Given** the fix, **When** light mode is active, **Then** all three buttons remain unchanged in appearance (no light mode regression)

---

#### CODE QUALITY GROUP

---

##### US-Q01: Zero `any` types in admin component and utility code

**As a** developer working on the admin panel,
**I want** all TypeScript types to be explicit and accurate,
**so that** the type system provides safety guarantees and IDE tooling works correctly.

**Known violations (10+ instances across 7 files):**

| File | Line(s) | Usage |
|------|---------|-------|
| `lib/cache/strategies/memoryOptimization.ts` | 325 | `estimateQuerySize(query: any)` |
| `lib/api/client.ts` | 23, 26 | `(globalThis as any).import` |
| `lib/utils/schema-extraction.utils.ts` | 16 | `let currentSchema: any` |
| `components/entity-form/EntityViewSection.tsx` | 123, 211 | `getNestedValue(obj: any, path: string): any` |
| `components/entity-form/sections/EntitlementGatedSection.tsx` | 16, 19 | `children: any; fallback?: any` |
| `components/entity-form/utils/unflatten-values.utils.ts` | 12, 82 | `let current: any` |
| `components/entity-list/types.ts` | 216 | `route: any` |

**Acceptance Criteria:**

- **Given** `getNestedValue(obj: any, path: string)`, **When** refactored, **Then** `obj` is typed as `Record<string, unknown>` and the return type is `unknown` (caller narrows the type)
- **Given** `EntitlementGatedSection` props, **When** refactored, **Then** `children` uses `React.ReactNode` and `fallback` uses `React.ReactNode | undefined`
- **Given** `unflatten-values.utils.ts`, **When** refactored, **Then** `let current` uses `Record<string, unknown>` or a recursive type
- **Given** `entity-list/types.ts`, **When** refactored, **Then** `route` is typed using TanStack Router's `AnyRoute` or equivalent generic
- **Given** `lib/api/client.ts`, **When** refactored, **Then** `globalThis as any` is replaced with a proper type narrowing check or typed global augmentation
- **Given** the full admin app, **When** `pnpm typecheck` runs, **Then** zero `@ts-ignore` or `as any` suppressions exist in the 7 identified files

---

##### US-Q02: Technical debt TODOs are resolved or filed

**As a** developer working on accommodations and entity form features,
**I want** TODO/FIXME comments to be either resolved or tracked as separate tasks,
**so that** the codebase does not silently accumulate unfinished features that may surprise users.

**Known TODOs (20 items in 2 areas):**

**Accommodations config (`features/accommodations/config/sections/`):**
- `amenities.consolidated.ts:15` — Category options for amenities not implemented
- `basic-info.consolidated.ts:60` — RICH_TEXT field type missing
- `gallery.consolidated.ts:15, 29` — Image/video type options missing
- `states-moderation.consolidated.ts:88` — DATE field type not implemented
- `statistics.consolidated.ts:207, 221` — DATE fields not implemented

**Entity form (`components/entity-form/`):**
- `GalleryField.tsx:168` — Error toast on upload failure not shown
- `ImageField.tsx:107, 114, 141` — Error toasts on 3 failure paths not shown (3 items)
- `EntityViewSection.tsx:137, 415` — Field visibility check + tabs layout not implemented
- `EntityFormSection.tsx:102, 431, 435` — Visibility checks + layout variants not implemented
- `fields/entity-selects/index.ts:15` — "Add more entity select fields" placeholder
- `components/entity-form/views/index.ts:34` — "Implement additional view field types"
- `components/entity-form/sections/index.ts:21` — "Add specialized section components"
- `components/entity-form/layouts/index.ts:20` — "Implement additional layout types"
- `components/entity-form/navigation/index.ts:16` — "Add more navigation components"

**Acceptance Criteria:**

- **Given** each TODO item, **When** reviewed, **Then** it is either: (a) implemented in this spec, (b) removed if obsolete, or (c) extracted as a new task in the task system with a clear description
- **Given** `GalleryField.tsx` and `ImageField.tsx`, **When** an image/gallery upload fails, **Then** an error toast is displayed to the user (these are user-facing failures that currently fail silently)
- **Given** the 5 field type TODOs (RICH_TEXT, DATE, image/video options), **When** reviewed, **Then** each is either implemented or becomes a tracked task in the appropriate SPEC
- **Given** the `index.ts` placeholder TODOs (entity-selects, views, sections, layouts, navigation), **When** reviewed, **Then** each is removed if the placeholder mechanism is sufficient, or a real task is created
- **Given** the full admin codebase after this work, **When** searched for `// TODO`, **Then** zero untracked TODOs remain in the 20 identified files

---

##### US-A01: Interactive web components have accessible labels

**As a** screen reader user or keyboard-only user,
**I want** all interactive elements (buttons, inputs) to have descriptive labels,
**so that** I can navigate and use the site without relying on visual context.

**Already fixed (re-audit 2026-03-16):**

| File | Status |
|------|--------|
| `components/review/ReviewForm.client.tsx` — star rating buttons (line 262) | ✅ Fixed — `aria-label={tUi('accessibility.rateStars', ...)}` |
| `components/accommodation/PriceRangeFilter.client.tsx` — min/max inputs | ✅ Fixed — `<label>` elements with `htmlFor` association present |

**Remaining violations:**

| File | Line(s) | Issue |
|------|---------|-------|
| `components/review/ReviewForm.client.tsx` | 382–396 | Cancel/submit buttons have no `aria-label` |
| `components/ui-wrapped/Input.tsx` | 102–122 | Generic input wrapper does not enforce `aria-label` or `aria-labelledby` at the TypeScript level |

**Acceptance Criteria:**

- **Given** `ReviewForm.client.tsx` submit and cancel buttons (lines 382–396), **When** a screen reader encounters them, **Then** each button has a descriptive `aria-label` (e.g., "Submit review", "Cancel review")
- **Given** `Input.tsx`, **When** used without an explicit label, **Then** TypeScript props enforce that either a `label` prop or an `aria-label` prop is provided (union type or conditional requirement)
- **Given** all fixed components, **When** audited with axe-core or equivalent, **Then** no "button-name" violations are reported on the review form

---

#### PERFORMANCE GROUP: Remaining Optimizations

---

##### US-P09: Composite indexes on high-frequency billing query patterns

**As a** platform operator loading billing admin pages,
**I want** common filter+sort combinations to use index scans,
**so that** billing list pages remain fast as transaction volume grows.

**Context:** 122 single-column indexes exist. Composite indexes for common query patterns are missing in billing tables that are frequently filtered by multiple columns simultaneously.

> **Note:** `billing_dunning_attempts` already has a partial composite index `(customer_id, result)` from migration `0015_bent_nekra.sql`. What's missing is `created_at DESC` in the trailing column. The new index is a separate `CREATE INDEX CONCURRENTLY` — do NOT drop the existing one.

**Target patterns:**

| Table | Filter+Sort Pattern | Proposed Composite Index | Existing Index |
|-------|---------------------|--------------------------|----------------|
| `billing_dunning_attempt` | `WHERE customer_id = X AND result = Y ORDER BY created_at DESC` | `(customer_id, result, created_at DESC)` | `(customer_id, result)` — exists, incomplete |
| `billing_notification_log` | `WHERE customer_id = X AND type = Y ORDER BY created_at DESC` | `(customer_id, type, created_at DESC)` | None |
| Entity tables (accommodation, destination, event, post) | `WHERE deleted_at IS NULL AND created_at < X` | `(deleted_at, created_at DESC)` | None |

**Acceptance Criteria:**

- **Given** a `billing_dunning_attempt` query filtered by customer + result + sorted by date, **When** `EXPLAIN ANALYZE` is run, **Then** an index scan is used (not a sequential scan)
- **Given** a `billing_notification_log` query filtered by customer + type + sorted by date, **When** `EXPLAIN ANALYZE` is run, **Then** an index scan is used
- **Given** standard entity list queries filtered by `deleted_at IS NULL` + paginated by `created_at`, **When** `EXPLAIN ANALYZE` is run, **Then** the composite index is used
- **Given** the migration, **When** applied, **Then** it is a non-destructive `CREATE INDEX CONCURRENTLY` that does not lock tables

---


### 3. UX Considerations

#### User Flows Affected

1. **Destination detail page map**: Visitors navigating to any destination page see the Litoral region map. Currently, the SVG has invisible/transparent shapes due to undefined CSS variables. After this fix, the map renders with correct colors in both light and dark mode.

2. **Social sharing flow**: Visitors sharing accommodation or event links via social buttons. The Twitter/X button is currently invisible in dark mode. After this fix, all social buttons are legible.

3. **Review submission flow**: Keyboard-only and screen reader users filling out the review form. Currently, submit/cancel buttons lack accessible names. After this fix, the form is fully operable without a mouse.

4. **Billing admin list pages**: Operators filtering billing records by customer + type + date. Composite indexes ensure these queries remain fast as data grows.

5. **Locale switching on Spanish/Portuguese sites**: Visitors already see grammatically correct pluralized counts — plural key coverage is fully verified (US-I06 completed).

#### Error States

- If an image upload fails in `GalleryField` or `ImageField`, an error toast must appear (currently fails silently — US-Q02)
- Dark mode fixes must not break light mode (all changes must include visual verification in both modes)

#### Accessibility

- All dark mode changes must maintain WCAG 2.1 AA contrast ratios (4.5:1 normal text, 3:1 large text and UI components)
- Accessibility fixes (US-A01) must not break existing functionality — only add labels and type constraints

---

### 4. Out of Scope

- **Admin dark mode**: Already fully implemented via shadcn semantic tokens
- **Admin i18n**: Already fully implemented — all strings use `t()`, all formats use `@repo/i18n` utilities
- **Pluralization system and locale coverage (US-I06)**: Fully implemented and verified — 38 `_one`/`_other` pairs in all 3 locales
- **Performance (N+1, cache, indexes, cron)**: All implemented — only composite index opportunity (US-P09) is new
- **New design features or new visual components**
- **RTL language support**
- **Redis cache implementation**: In-memory LRU is sufficient (already implemented)
- **New i18n locales beyond es, en, pt**
- **Full entity form overhaul**: US-Q02 only covers filing/resolving TODO comments, not implementing all missing field types

---

### 5. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CSS variable rename breaks other components that accidentally used broken variable names | Low | Medium | Search full codebase for `--color-surface`, `--color-text-secondary`, `--color-bg` before renaming |
| TypeScript `any` replacement breaks compilation due to type narrowing | Medium | Low | Fix one file at a time, run `pnpm typecheck` after each file |
| TODO resolution reveals hidden scope (e.g. DATE field type requires schema changes) | High | High | If a TODO requires >1 day of work, create a new task and remove the TODO comment (do not block this spec) |
| `CREATE INDEX CONCURRENTLY` fails on a table with active transactions | Low | Low | Use `CONCURRENTLY` to avoid table locks. Run during low-traffic window |
| Plural key additions in es/pt introduce grammatically incorrect translations | Medium | Medium | Native speaker review for Spanish keys before merge |

---

### 6. Dependencies

| Dependency | Required For | Change Needed |
|------------|-------------|---------------|
| `apps/web/src/components/destination/LitoralMap.astro` | US-T01 | Replace 3 undefined CSS variable references |
| `apps/web/src/components/shared/ShareButtons.client.tsx` | US-T06 | Add dark mode variant for `bg-black` button |
| `apps/admin/src/components/entity-form/**` | US-Q01 | Replace `any` types with proper TypeScript types |
| `apps/admin/src/lib/**` | US-Q01 | Replace `any` types in cache and API client utilities |
| `apps/web/src/components/review/ReviewForm.client.tsx` | US-A01 | Add `aria-label` to buttons |
| `apps/web/src/components/accommodation/PriceRangeFilter.client.tsx` | US-A01 | Add `<label>` or `aria-label` to number inputs |
| `apps/admin/src/components/ui-wrapped/Input.tsx` | US-A01 | Enforce accessibility props at component level |
| `packages/db/src/schemas/billing/**` | US-P09 | New Drizzle migration with composite indexes |
| `apps/admin/src/components/entity-form/fields/GalleryField.tsx` | US-Q02 | Implement error toast on upload failure |
| `apps/admin/src/components/entity-form/fields/ImageField.tsx` | US-Q02 | Implement error toast on 3 failure paths |

---

## Part 2 - Implementation Phases

### Phase 1: Dark Mode Bug Fixes (US-T01, US-T05, US-T06)

1. Fix `LitoralMap.astro` — replace 5 undefined variable references with correct token names
2. Fix `LitoralMap.astro:290` — remove `!important`, replace with attribute-based CSS
3. Fix `ShareButtons.client.tsx` — add `dark:bg-gray-700` (or equivalent) to the Twitter/X `bg-black` button; verify WhatsApp/Facebook contrast
4. Visual verification in both light and dark modes for all 3 components

### Phase 2: Accessibility Fixes (US-A01)

5. Add `aria-label` to ReviewForm buttons (submit, cancel, star rating buttons)
6. Add `<label>` element to PriceRangeFilter number inputs
7. Update `Input.tsx` props type to enforce `label` or `aria-label` (TypeScript union)
8. Run axe-core validation on affected pages

### Phase 3: TypeScript Quality (US-Q01)

9. Fix `entity-form/EntityViewSection.tsx` — replace `obj: any` with `Record<string, unknown>`
10. Fix `entity-form/sections/EntitlementGatedSection.tsx` — replace `any` with `React.ReactNode`
11. Fix `entity-form/utils/unflatten-values.utils.ts` — type `current` as `Record<string, unknown>`
12. Fix `entity-list/types.ts` — type `route` with TanStack Router's `AnyRoute`
13. Fix `lib/cache/strategies/memoryOptimization.ts` and `lib/api/client.ts`
14. Run `pnpm typecheck` — must pass with zero errors

### Phase 4: Technical Debt Resolution (US-Q02)

15. Implement error toasts in `GalleryField.tsx:168` and `ImageField.tsx:107, 114, 141` (4 toast calls)
16. Review each of the 5 accommodations config TODOs: implement if small, create task if large, remove if obsolete
17. Review each of the 11 entity form placeholder TODOs: same decision tree
18. All 20 TODOs must be either resolved, tracked as a new task, or removed

### Phase 5: Performance — Composite Indexes (US-P09)

19. Write Drizzle migration with `CREATE INDEX CONCURRENTLY` for billing tables
20. Write Drizzle migration for entity table `(deleted_at, created_at DESC)` composite indexes
21. Apply migrations and verify with `EXPLAIN ANALYZE` queries

### Phase 6: Verification

22. Full dark mode visual pass: LitoralMap, ShareButtons, and spot-check 10 other web components
23. Accessibility audit with axe-core on accommodation detail, review form, and search pages
24. `pnpm typecheck` — zero errors
25. `pnpm lint` — zero errors
26. `pnpm test` — all tests pass with ≥90% coverage

---

### Testing Strategy

**Unit Tests:**

- `UnflattenValues.utils.ts` after `any` → typed refactor: existing tests must still pass

**Integration Tests:**

- Composite index verification: `EXPLAIN ANALYZE` query output includes "Index Scan" (not "Seq Scan") for billing filter patterns

**Manual Verification Checklist:**

- [ ] LitoralMap renders with visible province shape in light mode
- [ ] LitoralMap renders with visible province shape in dark mode
- [ ] LitoralMap text and tooltip are visible in both modes
- [ ] Twitter/X share button is visible in dark mode (not invisible against dark background)
- [ ] WhatsApp/Facebook buttons pass contrast check in dark mode
- [ ] ReviewForm submit/cancel buttons announced correctly by screen reader (VoiceOver or NVDA)
- [ ] `pnpm typecheck` passes with zero errors after US-Q01 changes
- [ ] Error toast appears on gallery upload failure
- [ ] Error toast appears on image field upload failure (3 failure paths)
- [ ] Billing admin list pages load without performance regression
