# Hospeda Spec Audit Report

**Date**: 2026-02-17
**Auditor**: Claude Code (exhaustive code-level audit)
**Method**: Spec requirements contrasted against actual source code, line by line

---

## Table of Contents

- [SPEC-005: Web Public UI](#spec-005-web-public-ui)
- [SPEC-006: Destination Hierarchy System](#spec-006-destination-hierarchy-system)
- [SPEC-007: Exchange Rate Integration](#spec-007-exchange-rate-integration)
- [SPEC-008: Phosphor Icons Migration](#spec-008-phosphor-icons-migration)
- [SPEC-010: Mi Cuenta Live Data](#spec-010-mi-cuenta-live-data)
- [SPEC-011: SEO Routes & Landing Pages](#spec-011-seo-routes--landing-pages)
- [Combined Gap Summary](#combined-gap-summary)
- [Prioritized Action Plan](#prioritized-action-plan)

---

## SPEC-005: Web Public UI

**Overall Status**: ~92% implemented. 95/95 tasks marked complete, but 11 quality/completeness gaps found in code review.

- All 95 tasks in state.json are marked as completed
- All required pages (46 .astro files) exist with correct file structure
- All required components exist (layout, entity cards, content, React islands)
- Design system, animation system, SEO infrastructure, accessibility, and API client fully implemented
- 11 gaps found ranging from code quality (as any) to missing functionality (non-functional search, placeholder components)

**Cross-reference with later specs:**

- Mi-cuenta React islands (editar, favoritos, preferencias, resenas): **Fixed by SPEC-010**
- Pricing API migration (turistas, propietarios): **Fixed by SPEC-011**
- ContactForm integration in contacto.astro: **Already working** (ContactForm.client.tsx used with client:visible)
- Propietarios landing page: **Created by SPEC-011**
- MobileMenu wired into Header: **Already working** (MobileMenuWrapper.client.tsx exists)

---

## SPEC-005: Verified as Complete

### Components (Categories 1-4)

All components verified as existing and structurally complete:

| Category | Components | Status |
|----------|-----------|--------|
| Layout & UI (17) | BaseLayout, Header, Footer, SEOHead, Breadcrumb, Pagination, Button, Input, Label, Textarea, Select, EmptyState, GenericErrorState, AccommodationNotFound, etc. | ALL OK |
| Entity Cards (5) | AccommodationCard, DestinationCard, EventCard, BlogPostCard, PricingCard | ALL OK |
| Content (5) | SearchBar, ContactForm, ViewToggle, MobileMenu, AccordionFAQ | ALL OK |
| React Islands (12+) | SignInIsland, SignUpIsland, ContactForm.client, SearchBar.client, ImageGallery.client, ShareButtons.client, FavoriteButton.client, MapView.client, ReviewList.client, ProfileEditForm.client, PreferenceToggles.client, UserFavoritesList.client, UserReviewsList.client | ALL OK |

### Pages (Categories 5-9)

All 46 page files verified. Summary:

| Category | Pages | Rendering | Status |
|----------|-------|-----------|--------|
| Public (6) | index, contacto, precios/turistas, precios/propietarios, propietarios, quienes-somos | SSG | ALL EXIST |
| Entity Listings (5) | alojamientos, alojamientos/tipo/[type], destinos, eventos, publicaciones | Mixed SSG/SSR | ALL EXIST |
| Entity Details (4) | alojamientos/[slug], destinos/[...path], eventos/[slug], publicaciones/[slug] | SSG+ISR | ALL EXIST |
| Auth (2+3) | signin, signup + forgot-password, reset-password, verify-email | SSR | ALL EXIST |
| Mi Cuenta (6) | index, editar, favoritos, preferencias, resenas, suscripcion | SSR + auth guard | ALL EXIST |
| Pagination (5+) | alojamientos/page, tipo/[type]/page, destinos/page, eventos/page, publicaciones/page | SSR (rewrite) | ALL EXIST |
| Error (2) | 404, 500 | SSG | ALL EXIST |

### Cross-cutting Concerns

| Area | Status | Details |
|------|--------|---------|
| CSS Design System | OK | Complete token system in global.css, mapped to Tailwind v4 in tailwind.css |
| Animation System | OK | 5 keyframes, stagger delays, prefers-reduced-motion support |
| View Transitions | OK | Entity card-to-detail morphing, fade transitions |
| SEO Components | OK | SEOHead, JsonLd, ArticleJsonLd, EventJsonLd, LodgingBusinessJsonLd |
| Sitemap | OK | @astrojs/sitemap with auth/mi-cuenta exclusion filter |
| robots.txt | OK | Correct disallow rules and sitemap reference |
| Accessibility | OK | Skip-to-content, ARIA in 50 files, focus-visible styles |
| i18n | OK | 3 locales (es/en/pt), middleware redirect, type-safe locale validation |
| API Client | OK | Discriminated union ApiResult<T>, timeout, error handling, 10 namespaces |
| Middleware | OK | Locale extraction, session validation, protected route guard |
| Error Pages | OK | 404 and 500 with proper layout and noindex |

---

## SPEC-005: Gaps Found

### SPEC-005 Gap 1: Widespread `as any` type assertions

**Severity**: Medium (violates project TypeScript strict rules)
**Effort**: ~3-4 hours (after Gap 11 is fixed)
**Scope**: **110 instances across 9 files**

| File | `as any` count |
|------|---------------|
| `alojamientos/[slug].astro` | 37 |
| `eventos/[slug].astro` | 30 |
| `publicaciones/[slug].astro` | 24 |
| `publicaciones/index.astro` | 11 |
| `busqueda.astro` | 4 |
| `eventos/index.astro` | 1 |
| `eventos/categoria/[category]/index.astro` | 1 |
| `destinos/[slug]/alojamientos/index.astro` | 1 |
| `alojamientos/tipo/[type]/index.astro` | 1 |

**Note**: `destinos/[...path].astro` uses `as Record<string, unknown>` instead of `as any` (slightly better, but still unsafe).

**Root cause**: API response types from `endpoints.ts` return `Record<string, unknown>` instead of concrete types from `@repo/schemas` (Gap 11). Pages then need unsafe casts to access properties.

**Fix**: Fix Gap 11 first (type the endpoints), then remove all `as any` casts from pages.

---

### SPEC-005 Gap 2: Homepage missing explicit SEOHead

**Severity**: Low
**Effort**: ~15 min
**File**: `apps/web/src/pages/[lang]/index.astro`

The homepage does not use `<SEOHead slot="head">` like all other pages. It passes title/description via BaseLayout props. This works but is inconsistent with the pattern used across the rest of the site and may miss some meta tags that SEOHead generates.

**Fix**: Add `<SEOHead slot="head" ... />` to homepage, matching the pattern of all other pages.

---

### SPEC-005 Gap 3: `quienes-somos.astro` body content not localized

**Severity**: Medium (affects en/pt users)
**Effort**: ~1-2 hours
**File**: `apps/web/src/pages/[lang]/quienes-somos.astro`

The `<h1>` title uses `titles[locale]` correctly, but ALL body content ("Nuestra Mision", "Nuestros Valores", "Nuestra Region", "Conectemos y Crezcamos Juntos") is hardcoded in Spanish. English and Portuguese visitors see Spanish-only content despite the locale routing.

**Fix**: Create localized content objects for each section (mission, values, region, CTA) and render based on `locale`.

---

### SPEC-005 Gap 4: Pagination inline HTML in `alojamientos/tipo/[type]`

**Severity**: Low (functional, but inconsistent)
**Effort**: ~30 min
**File**: `apps/web/src/pages/[lang]/alojamientos/tipo/[type]/index.astro`

Uses hand-built `<nav>` with `?page=N` query params instead of the standard `Pagination.astro` component with URL-segment pattern (`/page/N/`). Every other listing page uses the Pagination component.

**Fix**: Replace inline pagination HTML with `<Pagination>` component using URL-segment pattern.

---

### SPEC-005 Gap 5: `ReviewList` hardcodes `isAuthenticated={false}`

**Severity**: Medium (blocks user reviews on accommodation detail)
**Effort**: ~15 min
**File**: `apps/web/src/pages/[lang]/alojamientos/[slug].astro`

The `ReviewList` React island receives `isAuthenticated={false}` as a hardcoded prop instead of reading `Astro.locals.user`. Authenticated users cannot submit reviews from the accommodation detail page.

**Fix**: Pass `isAuthenticated={!!Astro.locals.user}` and optionally `userId={Astro.locals.user?.id}`.

---

### SPEC-005 Gap 6: Share buttons placeholder in `eventos/[slug].astro`

**Severity**: Low (cosmetic)
**Effort**: ~15 min
**File**: `apps/web/src/pages/[lang]/eventos/[slug].astro`

The event detail page has empty placeholder `<div>` elements where share buttons should be, instead of using the existing `ShareButtons.client.tsx` component (which IS used in alojamientos/[slug], destinos/[...path], and publicaciones/[slug]).

**Fix**: Import and use `ShareButtons.client.tsx` with `client:visible`, matching the pattern from other detail pages.

---

### SPEC-005 Gap 7: Non-functional search bar in `destinos/index.astro`

**Severity**: Low (cosmetic, misleads users)
**Effort**: ~1 hour
**File**: `apps/web/src/pages/[lang]/destinos/index.astro`

The search input is a static `<input>` placeholder with no handler. Typing into it does nothing. Also, the page fetches `pageSize: 100` with no pagination, truncating results beyond 100.

**Fix**: Either implement client-side filtering with the SearchBar island, or remove the non-functional input to avoid misleading users. Add pagination if needed.

---

### SPEC-005 Gap 8: Skip-to-content link text in English only

**Severity**: Low (accessibility, minor)
**Effort**: ~15 min
**File**: `apps/web/src/layouts/BaseLayout.astro`

The skip-to-content link says "Skip to content" regardless of locale. Should use localized text.

**Fix**: Pass locale to layout and render localized skip link text (e.g., "Saltar al contenido" / "Skip to content" / "Pular para o conteudo").

---

### SPEC-005 Gap 9: FAQ heading hardcoded in Spanish on pricing pages

**Severity**: Low
**Effort**: ~15 min
**Files**: `precios/turistas.astro`, `precios/propietarios.astro`

The `<h2>Preguntas Frecuentes</h2>` heading is hardcoded in Spanish. The `faqContent` object only has `{ question, answer }[]` per locale.. it does NOT have a `sectionTitle` property (unlike propietarios which does).

**Fix**: Add a separate localized heading object (e.g., `faqHeadings: Record<SupportedLocale, string>`) and render `faqHeadings[locale]` instead of the hardcoded string.

---

### SPEC-005 Gap 10: i18n missing most English and all Portuguese translations

**Severity**: Medium-High (en/pt users see all-Spanish content)
**Effort**: ~8-16 hours (translation effort, not code)
**File**: `@repo/i18n` package

Current state of `packages/i18n/src/locales/`:

- `es/`: **32 JSON files** (complete.. home, about, contact, event, destination, terms, etc.)
- `en/`: **6 JSON files** (admin-only.. admin-entities, admin-billing, admin-dashboard, admin-pages, billing, exchange-rate)
- `pt/`: **directory does not exist**

English is missing all public-facing translations (home, about, contact, event, destination, etc.). Portuguese has zero translations. The web app falls back to Spanish for all untranslated strings.

**Note**: This is a content/translation task, not a code task. The code infrastructure (locale routing, middleware, fallback) is correct.

---

### SPEC-005 Gap 11: API endpoint types use `Record<string, unknown>`

**Severity**: Medium (weakens type safety, root cause of Gap 1's 110 `as any` casts)
**Effort**: ~2-3 hours
**File**: `apps/web/src/lib/api/endpoints.ts` (34 occurrences of `Record<string, unknown>`)

All API endpoint methods return `ApiResult<Record<string, unknown>>` or `ApiResult<PaginatedResponse<Record<string, unknown>>>` instead of concrete types. This forces pages to use `as any` casts (Gap 1).

**Fix**: Import types from `@repo/schemas` and type each endpoint return value properly. This is the root cause fix for Gap 1.

---

## SPEC-005: Gaps Already Fixed by Later Specs

| Original Gap | Fixed By | Details |
|-------------|----------|---------|
| Mi-cuenta pages use hardcoded/static HTML | SPEC-010 | All 6 pages now have React islands (ProfileEditForm, PreferenceToggles, UserFavoritesList, UserReviewsList) |
| Pricing pages use hardcoded plans | SPEC-011 | Both pages now fetch from billing API with hardcoded fallback |
| contacto.astro has raw `<form>` with no handler | Already working | ContactForm.client.tsx is imported and used with `client:visible` |
| No propietarios landing page | SPEC-011 | Created with hero, benefits, how-it-works, FAQ, CTA |
| MobileMenu not wired into Header | Already working | MobileMenuWrapper.client.tsx exists and is integrated |

---

## SPEC-006: Destination Hierarchy System

**Overall Status**: ~90% implemented. Backend 100% complete, frontend partially wired.

- Spec status is "draft" with 0/43 tasks marked, but the code is largely implemented
- DB schema (5 hierarchy columns + 5 indexes + self-referencing relation): COMPLETE
- Zod schemas (enum, hierarchy schemas, filters): COMPLETE
- Model layer (findDescendants, findAncestors, isDescendant, updateDescendantPaths): COMPLETE
- Service layer (getChildren, getDescendants, getAncestors, getBreadcrumb, getByPath, _beforeCreate/_beforeUpdate hooks): COMPLETE
- API routes (5 hierarchy endpoints + hierarchy filters on list): COMPLETE
- Web API client (all hierarchy methods in endpoints.ts): COMPLETE
- Seeds (Argentina > Litoral > Entre Rios > Depto Uruguay hierarchy + 11 cities): COMPLETE
- Frontend: PARTIALLY IMPLEMENTED (catch-all route works, breadcrumb not wired)

---

## SPEC-006: Verified as Complete

### Backend (100%)

| Layer | Components | Status |
|-------|-----------|--------|
| DB Schema | `parentDestinationId`, `destinationType` (enum), `level`, `path`, `pathIds`, 5 indexes, self-ref relation | ALL OK |
| Zod Schemas | `DestinationTypeEnum` (7 values), `GetDestinationChildrenInput`, `GetDestinationDescendantsInput`, `GetDestinationAncestorsInput`, `GetDestinationByPathInput`, `GetDestinationBreadcrumbInput`, `BreadcrumbItemSchema`, hierarchy filters in search | ALL OK |
| Model | `findChildren`, `findDescendants`, `findAncestors`, `findByPath`, `isDescendant`, `updateDescendantPaths` | ALL OK |
| Service | `getChildren`, `getDescendants`, `getAncestors`, `getBreadcrumb`, `getByPath`, `_beforeCreate`, `_beforeUpdate` with cycle detection + cascade | ALL OK |
| Helpers | `validateDestinationTypeLevel`, `getExpectedParentType`, `computeHierarchyPath`, `computeHierarchyPathIds`, `isValidParentChildRelation` | ALL OK |
| API Routes | `GET /:id/children`, `GET /:id/descendants`, `GET /:id/ancestors`, `GET /:id/breadcrumb`, `GET /by-path`, hierarchy filters on list | ALL OK |
| API Client | `destinationsApi.getByPath`, `.getChildren`, `.getDescendants`, `.getAncestors`, `.getBreadcrumb` + hierarchy params in `.list` | ALL OK |
| Seeds | 4 hierarchy nodes (Argentina, Litoral, Entre Rios, Depto Uruguay) + 11 cities with parentDestinationId | ALL OK |

### Frontend (60%)

| Component | Status | Details |
|-----------|--------|---------|
| `[...path].astro` catch-all route | OK | Uses `destinationsApi.getByPath()`, `getStaticPaths` builds hierarchical URLs from `d.path` |
| Breadcrumb component | OK | `Breadcrumb.astro` supports arbitrary items + JSON-LD BreadcrumbList |
| Breadcrumb data wiring | **MISSING** | See Gap 1 |
| Destination search/filter UI hierarchy support | **NOT IMPLEMENTED** | No hierarchy filter controls on destinos/index.astro |

---

## SPEC-006: Gaps Found

### SPEC-006 Gap 1: Breadcrumb not wired to hierarchy API

**Severity**: Medium (breaks spec requirement for full hierarchy breadcrumb)
**Effort**: ~1 hour
**File**: `apps/web/src/pages/[lang]/destinos/[...path].astro`

The breadcrumb in the destination detail page is hardcoded to 3 levels:

```
Home > Destinos > [destination name]
```

The spec requires the full hierarchy:

```
Home > Destinos > Argentina > Litoral > Entre Rios > Depto Uruguay > Concepcion del Uruguay
```

The `destinationsApi.getBreadcrumb({ id })` method and `Breadcrumb.astro` component both exist and are ready. The page just needs to call the API and pass the result to the component.

**Fix**: In the page frontmatter, call `destinationsApi.getBreadcrumb({ id: destinationId })` and map the result to breadcrumb items.

---

### SPEC-006 Gap 2: Destination search page lacks hierarchy filter controls

**Severity**: Low-Medium (UX improvement)
**Effort**: ~2-3 hours
**File**: `apps/web/src/pages/[lang]/destinos/index.astro`

The destination listing page has no filter controls for hierarchy (country, region, province, department). The API supports these filters (`parentDestinationId`, `destinationType`, `level`, `ancestorId`), but the UI doesn't expose them.

**Fix**: Add filter dropdowns or a hierarchy tree navigator to the destination listing page.

---

### SPEC-006 Gap 3: `pathIds` stored as text instead of UUID array

**Severity**: Cosmetic (functionally equivalent)
**Effort**: Not recommended to change (would require migration)
**File**: `packages/db/src/schemas/destination/destination.dbschema.ts`

The spec says `pathIds` should be a UUID array, but it's implemented as `text` with `/`-separated UUIDs. This works identically for the materialized path pattern and avoids PostgreSQL array-specific query complexity. **No action needed**.

---

### SPEC-006 Gap 4: Missing `POI` destination type

**Severity**: Low (not needed for current deployment)
**Effort**: ~15 min
**File**: `packages/schemas/src/enums/destination-type.enum.ts`

The spec mentions `poi` (Point of Interest) as a destination type. The enum has `TOWN` instead. If POI is needed in the future, it can be added then. **No action needed now**.

---

### SPEC-006 Gap 5: Task state not updated

**Severity**: Administrative
**Effort**: ~15 min
**File**: `.claude/tasks/SPEC-006-destination-hierarchy/state.json`

All 43 tasks are marked as `pending` (0/43), but the backend implementation is ~100% complete and frontend is ~60% complete. The state.json should be updated to reflect actual progress.

---

## SPEC-007: Exchange Rate Integration

**Overall Status**: ~95% implemented. Full backend + admin UI, but PriceDisplay not connected to API.

- Spec status is "draft" but code is almost fully implemented
- DB schema (exchangeRates + exchangeRateConfig tables): COMPLETE
- Service layer (ExchangeRateService, ExchangeRateConfigService, ExchangeRateFetcher): COMPLETE
- External API clients (DolarAPI, ExchangeRate-API): COMPLETE
- API routes (7 endpoints: list, convert, manual override, delete, config, fetch-now, history): COMPLETE
- Admin UI (3-tab dashboard: current rates, history, config): COMPLETE
- Admin i18n (ES + EN): COMPLETE
- Cron job (15-minute fetch): COMPLETE with env var bug
- PriceDisplay component: EXISTS but uses hardcoded rates

---

## SPEC-007: Verified as Complete

### Backend (100%)

| Layer | Components | Status |
|-------|-----------|--------|
| DB Schema | `exchangeRates` table (rate, inverseRate, rateType, source, isManualOverride, expiresAt, fetchedAt) | OK |
| DB Schema | `exchangeRateConfig` singleton table (defaultRateType, fetch intervals, disclaimer settings) | OK |
| Service | `ExchangeRateService` (getLatestRate, getLatestRates, createManualOverride, removeManualOverride) | OK |
| Service | `ExchangeRateConfigService` (getConfig, updateConfig) | OK |
| Service | `ExchangeRateFetcher` (fetchAndStore, getRate, getRateWithFallback) with priority chain: manual > DolarAPI > ExchangeRate-API > stale DB | OK |
| Clients | `DolarApiClient` (/dolares, /cotizaciones), `ExchangeRateApiClient` (/latest/USD) | OK |
| API | `GET /public/exchange-rates`, `GET /public/exchange-rates/convert`, `POST /protected/exchange-rates`, `DELETE /protected/exchange-rates/:id`, `PUT /protected/exchange-rates/config`, `POST /protected/exchange-rates/fetch-now`, `GET /protected/exchange-rates/history` | ALL OK |
| Cron | 15-minute fetch job registered in cron registry | OK (with bug) |
| Env | `HOSPEDA_EXCHANGE_RATE_API_KEY` defined and documented | OK |

### Admin UI (100%)

| Component | Status |
|-----------|--------|
| Exchange rates page (`billing/exchange-rates.tsx`) | OK |
| Current rates tab with table | OK |
| History tab with pagination | OK |
| Config tab (fetch intervals, disclaimer, auto-fetch) | OK |
| Manual override dialog | OK |
| Fetch-now action | OK |
| i18n keys (ES + EN) | OK |

### Web Frontend (50%)

| Component | Status |
|-----------|--------|
| `PriceDisplay.astro` | EXISTS but hardcoded rates |
| `PriceDisplay.client.tsx` | EXISTS but hardcoded rates |

---

## SPEC-007: Gaps Found

### SPEC-007 Gap 1: PriceDisplay uses hardcoded exchange rates

**Severity**: Medium (core feature not connected)
**Effort**: ~1-2 hours
**Files**: `apps/web/src/components/ui/PriceDisplay.astro`, `apps/web/src/components/ui/PriceDisplay.client.tsx`

Both components have:

```typescript
const CONVERSION_RATES = { ARS: 1, USD: 1000, BRL: 200 }; // hardcoded placeholders
```

The full exchange rate API exists (`GET /api/v1/public/exchange-rates`) with real DolarAPI integration, but PriceDisplay doesn't consume it.

**Fix**: Fetch rates from `/api/v1/public/exchange-rates` (in Astro frontmatter for SSR, or client-side for the React island) and pass them as props or use them directly.

---

### SPEC-007 Gap 2: Cron job uses wrong env var name

**Severity**: Medium (bug.. cron job silently fails for ExchangeRate-API)
**Effort**: ~5 min
**File**: `apps/api/src/cron/jobs/exchange-rate-fetch.job.ts`

The cron job reads `process.env.EXCHANGERATE_API_KEY` but the app's env schema defines `HOSPEDA_EXCHANGE_RATE_API_KEY`. The DolarAPI calls work (no key needed), but ExchangeRate-API calls always get an empty API key.

**Fix**: Change `process.env.EXCHANGERATE_API_KEY` to use the validated env config `env.HOSPEDA_EXCHANGE_RATE_API_KEY`.

---

## SPEC-008: Phosphor Icons Migration

**Overall Status**: ~95% implemented. All phases mostly complete, minor cleanup remaining.

- Phase 0 (Normalize IconProps): COMPLETE (weight, mirrored, ICON_SIZES)
- Phase 1 (Admin Lucide imports): COMPLETE (0 lucide-react imports, 108 files using @repo/icons)
- Phase 1b (Admin inline SVGs): 7 files remain with inline SVGs
- Phase 2 (Web inline SVGs): ALMOST COMPLETE (only 404.astro and 500.astro, intentional illustrations)
- Phase 2b (Package cleanup): COMPLETE (no active package uses lucide-react)
- Phase 3 (Phosphor internals): COMPLETE (434+ icons using createPhosphorIcon factory wrapping @phosphor-icons/react)
- Phase 4 (Final cleanup): 58 old Lucide SVG files still in packages/icons/src/svg/

---

## SPEC-008: Verified as Complete

| Phase | Status | Details |
|-------|--------|---------|
| Phase 0: IconProps | COMPLETE | `weight` (default: 'duotone'), `mirrored`, `ICON_SIZES`, `duotoneColor` extra prop |
| Phase 1: Admin Lucide | COMPLETE | 0 lucide-react imports, `lucide-react` removed from package.json, 108 files using @repo/icons |
| Phase 1b: Admin SVGs | 7 files remain | BooleanCell.tsx (check/X SVGs), 3 error boundaries, signin Google logo, VirtualizedEntityList examples |
| Phase 2: Web SVGs | COMPLETE | Only 404.astro and 500.astro have SVGs (decorative illustrations, intentional) |
| Phase 2b: Package cleanup | COMPLETE | No active package has lucide-react |
| Phase 3: Phosphor | COMPLETE | `@phosphor-icons/react` in package.json, `createPhosphorIcon` factory, 434+ icons in 12 categories |
| Phase 4: Cleanup | PARTIAL | 58 old `.svg` files in `packages/icons/src/svg/` (not imported, residual) |

---

## SPEC-008: Gaps Found

### SPEC-008 Gap 1: 58 old Lucide SVG files not deleted

**Severity**: Low (dead code, no functional impact)
**Effort**: ~5 min
**File**: `packages/icons/src/svg/` (58 .svg files)

These are the original Lucide SVG source files. All icon components now wrap Phosphor via `createPhosphorIcon`. The SVGs are not imported anywhere but still exist in the repo.

**Fix**: `rm -rf packages/icons/src/svg/`

---

### SPEC-008 Gap 2: 7 admin files still have inline SVGs

**Severity**: Low (cosmetic inconsistency)
**Effort**: ~30 min
**Files**:

- `apps/admin/src/components/table/cells/BooleanCell.tsx` - check/X SVGs (should use CheckIcon/XIcon)
- `apps/admin/src/lib/error-boundaries/GlobalErrorBoundary.tsx` - error illustration
- `apps/admin/src/lib/error-boundaries/QueryErrorBoundary.tsx` - error illustration
- `apps/admin/src/lib/error-boundaries/EntityErrorBoundary.tsx` - error illustration
- `apps/admin/src/routes/auth/signin.tsx` - Google OAuth logo SVG (intentional, third-party brand)
- `apps/admin/src/components/entity-list/VirtualizedEntityList.tsx`
- `apps/admin/src/components/entity-list/examples/VirtualizedEntityListExample.tsx`

**Fix**: Replace BooleanCell SVGs with @repo/icons. Error boundary and Google logo SVGs can be kept as intentional (not icon replacements).

---

### SPEC-008 Gap 3: IconProps doesn't extend SVGAttributes

**Severity**: Low (cosmetic, functionally equivalent)
**Effort**: ~15 min
**File**: `packages/icons/src/types.ts`

The spec says IconProps should extend `React.SVGAttributes<SVGSVGElement>`. Instead it uses a catch-all `[key: string]: unknown`. Functionally equivalent (extra SVG props pass through), but less type-safe.

**Fix**: Replace `[key: string]: unknown` with `extends React.SVGAttributes<SVGSVGElement>`. This would give better autocomplete and type checking for SVG-specific props.

---

## SPEC-010: Mi Cuenta Live Data

**Overall Status**: ~90% implemented. 5 gaps found, 2 actionable now.

- 22 of 27 task requirements are fully implemented and verified in code
- 5 gaps found ranging from trivial (15 min) to medium effort (3h)
- All React islands use correct `result.ok` pattern (not `result.success`)
- All 6 mi-cuenta pages have auth guards, localization (es/en/pt), and proper island directives
- Billing-dependent features (gaps 2, 3, 5) are blocked by billing system readiness

---

## SPEC-010: Verified as Complete

### Layer 1: API Endpoints

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-001 | User `settings` JSONB column | `packages/db` schema | OK | Column name is `settings`, not `metadata` or `preferences` |
| T-002 | `AccommodationReviewService.listByUser()` | `packages/service-core/.../accommodationReview.service.ts:195-217` | OK | Accepts userId, page, pageSize. Returns `{ accommodationReviews[], total }` |
| T-003 | `DestinationReviewService.listByUser()` | `packages/service-core/.../destinationReview.service.ts:146-180` | OK | Accepts userId, page, pageSize. Returns `{ data[], pagination }` |
| T-004 | `GET /protected/user-bookmarks` (list) | `apps/api/src/routes/user-bookmark/protected/list.ts` | OK | Pagination + entityType filter, rate limit 100/min |
| T-004 | `GET /protected/user-bookmarks/count` | `apps/api/src/routes/user-bookmark/protected/count.ts` | OK | Optional entityType filter, cache 30s |
| T-005 | `POST /protected/user-bookmarks` (create) | `apps/api/src/routes/user-bookmark/protected/create.ts` | OK | Validates entityId + entityType via schema |
| T-005 | `DELETE /protected/user-bookmarks/{id}` | `apps/api/src/routes/user-bookmark/protected/delete.ts` | OK | Ownership check via `_canUpdate()`, soft delete |
| T-006 | `GET /protected/users/me/reviews` | `apps/api/src/routes/user/protected/reviews.ts` | OK | Merges both review types, type filter, parallel fetch |
| T-008 | PATCH accepts `settings` field | `apps/api/src/routes/user/protected/patch.ts` | OK | Via `UserPatchInputSchema` which includes settings |
| T-009 | All routes registered in index | `apps/api/src/routes/index.ts:32,33,85,88` | OK | user-bookmarks + protected user routes both registered |

### Layer 2: Web API Client

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-010 | `userBookmarksApi.list()` | `apps/web/src/lib/api/endpoints.ts:306-312` | OK | entityType filter + pagination |
| T-010 | `userBookmarksApi.count()` | `endpoints.ts:315-319` | OK | Optional entityType |
| T-010 | `userBookmarksApi.create()` | `endpoints.ts:322-329` | OK | entityId, entityType, notes, displayName |
| T-010 | `userBookmarksApi.delete()` | `endpoints.ts:332-334` | OK | By bookmark ID |
| T-011 | `userApi.getProfile()` | `endpoints.ts:340-342` | OK | By user ID |
| T-011 | `userApi.patchProfile()` | `endpoints.ts:345-347` | OK | id + data object |
| T-011 | `userApi.getStats()` | `endpoints.ts:350-352` | OK | Returns `{ bookmarkCount, plan }` |
| T-011 | `userApi.getReviews()` | `endpoints.ts:355-365` | OK | page, pageSize, type filter |

### Layer 3: React Islands

| Task | Component | File | Status | Key Verifications |
|------|-----------|------|--------|-------------------|
| T-012 | `ProfileEditForm.client.tsx` | `apps/web/src/components/account/` | OK | Props: userId, initialName, initialBio, email(readonly), locale. Validation: name required min 2, bio max 500. Uses `result.ok`. Toast feedback. Localized es/en/pt. |
| T-013 | `PreferenceToggles.client.tsx` | same dir | OK | Props: userId, initialSettings, locale. Toggles: allowEmails, allowSms, allowPush. Language selector. Uses `result.ok`. Saves via patchProfile. Localized. |
| T-014 | `UserFavoritesList.client.tsx` | same dir | OK | 4 tabs (ACCOMMODATION, DESTINATION, EVENT, POST). Optimistic unfavorite with rollback. Load more pagination. Uses `result.ok`. Localized. |
| T-015 | `UserReviewsList.client.tsx` | same dir | OK | 3 tabs (all, accommodation, destination). Star rating display. Merge + sort reviews. Load more pagination. Uses `result.ok`. Localized. |

### Layer 4: Page Integration

| Task | Page | File | Status | Key Verifications |
|------|------|------|--------|-------------------|
| T-016 | `index.astro` | `apps/web/src/pages/[lang]/mi-cuenta/index.astro` | OK | Stat IDs: `stat-favorites`, `stat-reviews`, `stat-subscription`. Client `<script>` fetches from `/users/me/stats` + `/users/me/reviews?pageSize=1` in parallel. Fallback on error. |
| T-017 | `editar.astro` | same dir | OK | `<ProfileEditForm client:visible />` with userId, initialName, initialBio (from user.profile.bio), email, locale. No raw HTML form. |
| T-018 | `favoritos.astro` | same dir | OK | `<UserFavoritesList client:visible locale={locale} />`. No static HTML tabs. |
| T-019 | `preferencias.astro` | same dir | OK | `<PreferenceToggles client:visible />` with userId, initialSettings (extracted from user.settings with safe defaults), locale. Timezone section kept as static HTML. |
| T-020 | `resenas.astro` | same dir | OK | `<UserReviewsList client:visible locale={locale} />`. No static empty state. |
| T-021 | `suscripcion.astro` | same dir | PARTIAL | See Gap #3 and #5 below. Auth guard OK. Static "Free Plan" with upgrade CTA. |

### Cross-cutting Concerns

| Concern | Status | Details |
|---------|--------|---------|
| Auth guards on all 6 pages | OK | All check `Astro.locals.user`, redirect to `/${locale}/auth/signin` |
| `result.ok` pattern | OK | Verified in all 4 React components (not `result.success`) |
| Localization es/en/pt | OK | All components and pages have 3-locale support |
| `client:visible` directives | OK | All 4 React islands use `client:visible` |
| Toast notifications | OK | All components use `addToast()` for success/error feedback |
| Error handling / fallbacks | OK | Dashboard falls back to 0/"Free", components show toast on error |

---

## SPEC-010: Gaps Found

### SPEC-010 Gap 1: `stats.ts` missing `reviewCount` field

**Severity**: Low (compensated in frontend)
**Effort**: ~15 minutes
**File**: `apps/api/src/routes/user/protected/stats.ts`

**Spec says** (Section "1c. User Stats Endpoint"):

```json
{ "bookmarkCount": 12, "reviewCount": 5, "currentPlan": "tourist-free" }
```

**Code returns** (line 49-52):

```typescript
return {
    bookmarkCount,
    plan: null
};
```

`reviewCount` is completely absent from the response schema and handler.

**Frontend workaround**: `index.astro` compensates by making a separate fetch to `/users/me/reviews?pageSize=1` and reading `totals.total`. This works but means the stats endpoint is incomplete per spec.

**Fix**: Import both review services, call `listByUser()` with `pageSize: 1` for both, sum totals, add `reviewCount` to response schema and return value.

---

### SPEC-010 Gap 2: `stats.ts` plan always `null`

**Severity**: Low (billing not priority)
**Effort**: ~30 minutes
**File**: `apps/api/src/routes/user/protected/stats.ts:51`

**Spec says** (US-001): "the current subscription plan name (from billing API)"

**Code**: `plan: null` hardcoded. No billing service import or lookup.

**Frontend workaround**: Dashboard shows "Free Plan" as static default. The `stat-subscription` element text is only updated if `statsData.data?.plan?.name` exists (which it never does since plan is always null).

**Fix**: Import billing customer/subscription lookup, fetch current plan for user, return `{ name, status }` or null. Requires billing package integration.

**Blocked by**: Billing system readiness. Acceptable to defer.

---

### SPEC-010 Gap 3: `SubscriptionCard.client.tsx` never created

**Severity**: Medium (spec explicitly lists it)
**Effort**: ~2 hours
**File**: Does not exist at `apps/web/src/components/account/SubscriptionCard.client.tsx`

**Spec says** (Section "Layer 4: React Islands > New components to create"):
> "SubscriptionCard.client.tsx - Shows plan info, upgrade CTA (needs billing data)"

**Current state**: `suscripcion.astro` uses pure static HTML with hardcoded "Plan Gratuito" and feature list. No React island, no dynamic data.

**Fix**: Create the component with props for plan data, fetch billing info client-side, display plan name/features/billing info dynamically. Fall back to "Free Plan" if no subscription.

**Blocked by**: Billing API integration (Gap #2). Can be created with fallback-only behavior now.

---

### SPEC-010 Gap 4: Reviews list missing edit/delete functionality

**Severity**: Medium (spec explicitly requires it)
**Effort**: ~3 hours
**File**: `apps/web/src/components/account/UserReviewsList.client.tsx`

**Spec says** (US-005):
> "Given a review is displayed, When the user clicks 'edit', Then inline editing is enabled (via ReviewForm.client.tsx) with prefilled data"

**Current state**: `UserReviewsList.client.tsx` only displays reviews with star rating, title, content, date, and type badge. There are NO edit or delete buttons. No import of `ReviewForm.client.tsx`. The component is read-only.

**Fix**:

1. Add edit button per review card
2. On click, show inline `ReviewForm` (or create one) with prefilled data
3. Add delete button with confirmation
4. Wire to appropriate API endpoints (accommodation review PATCH/DELETE, destination review PATCH/DELETE)

**Note**: This requires review update/delete API endpoints to exist for the authenticated user. Verify they exist before implementing.

---

### SPEC-010 Gap 5: `suscripcion.astro` has no API fetch

**Severity**: Low (depends on billing readiness)
**Effort**: ~1 hour
**File**: `apps/web/src/pages/[lang]/mi-cuenta/suscripcion.astro`

**Spec says** (US-006):
> "the current plan is fetched from billing API (customer + subscription)"
> "billing info (next renewal date, payment method) is shown"

**Current state**: Page is 100% static HTML. No API import, no fetch in frontmatter, no client-side data loading. Shows hardcoded "Plan Gratuito" with hardcoded feature list.

**Fix**: Either fetch billing data in Astro frontmatter (SSR) or use `SubscriptionCard.client.tsx` (Gap #3) as a React island.

**Blocked by**: Gaps #2 and #3. Billing system readiness.

---

### SPEC-010 Dependency Analysis

```
Gap 1 (reviewCount in stats) ---- standalone, fix now
Gap 4 (edit/delete reviews) ----- standalone, fix now (if review PATCH/DELETE APIs exist)

Gap 2 (plan in stats) ----------- requires billing integration
  |
  +-- Gap 3 (SubscriptionCard) -- requires Gap 2
  |     |
  |     +-- Gap 5 (suscripcion fetch) -- requires Gap 3
```

---
---

## SPEC-011: SEO Routes & Landing Pages

**Overall Status**: ~96% implemented. 1 gap found (JSON-LD structured data).

- 23 of 24 task requirements are fully implemented and verified in code
- 1 gap found: JSON-LD structured data not added to any new page (spec task T-023)
- All 7 new page routes exist with correct file structure
- All API endpoints registered and functional
- All rendering strategies (SSG/SSR) correct per spec
- hreflang works via SEOHead on all new pages
- Pricing pages fetch from API with hardcoded fallback
- 8 test files created covering all new functionality

---

## SPEC-011: Verified as Complete

### Layer 1: API Endpoints

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-001 | Public tag by slug endpoint | `apps/api/src/routes/tag/public/getBySlug.ts` | OK | `GET /api/v1/public/tags/by-slug/{slug}`, returns tag object or 404 |
| T-002 | Public plans list endpoint | `apps/api/src/routes/billing/public/listPlans.ts` | OK | `GET /api/v1/public/plans`, returns plans with no auth required |
| T-003 | Routes registered in API index | `apps/api/src/routes/index.ts:34,35,150-155` | OK | `publicTagRoutes` at `/api/v1/public/tags`, `publicBillingRoutes` at `/api/v1/public/plans` |
| T-004 | API tests | `apps/api/test/routes/tag-public.test.ts` (8 tests), `billing-public.test.ts` (15 tests) | OK | Found, not found, invalid slug. Plan tiers, structure, no auth |

### Layer 2: Web API Client

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-009 | `tagsApi.getBySlug()` | `apps/web/src/lib/api/endpoints.ts:371` | OK | Fetches tag by slug from public endpoint |
| T-016 | `plansApi.list()` | `apps/web/src/lib/api/endpoints.ts:381` | OK | Fetches plans with optional pagination |
| T-007 | `eventsApi` category filter | `endpoints.ts` (existing) | OK | Already supported category param in list method |

### Layer 3: Event Category Pages

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-005 | `eventos/categoria/[category]/index.astro` | `apps/web/src/pages/[lang]/eventos/categoria/[category]/index.astro` | OK | SSG with `export const prerender = true` and `getStaticPaths()` for 5 categories x 3 locales = 15 paths |
| T-006 | `eventos/categoria/[category]/page/[page].astro` | Same dir `/page/[page].astro` | OK | Pagination route with page 1 redirect to canonical |
| T-008 | Event category tests | `apps/web/test/pages/event-category-pages.test.ts` (100 tests) | OK | SSG config, categories, breadcrumb, SEO, grid, pagination |

**Verified details:**

- Categories: festival, fair, sport, cultural, gastronomy
- SEOHead with locale-specific title/description
- Breadcrumb component with proper hierarchy
- EventCard grid + Pagination component
- Localized category names for es/en/pt

### Layer 4: Post Tag Pages

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-010 | `publicaciones/etiqueta/[tag]/index.astro` | `apps/web/src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro` | OK | SSR (no prerender, no getStaticPaths). Tag resolved via `tagsApi.getBySlug()` |
| T-011 | `publicaciones/etiqueta/[tag]/page/[page].astro` | Same dir `/page/[page].astro` | OK | Pagination route with page 1 redirect |
| T-012 | Post tag tests | `apps/web/test/pages/post-tag-pages.test.ts` (105 tests) | OK | SSR config, tag resolution, breadcrumb, SEO, grid, pagination |

**Verified details:**

- SSR rendering (tags are dynamic, unbounded)
- Fetches tag by slug, then posts filtered by tag UUID
- BlogPostCard grid + Pagination
- EmptyState for no posts
- Localized breadcrumb: Home > Blog > Tag: [name]

### Layer 5: Property Owner Landing Page

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-013 | Hero + Benefits sections | `apps/web/src/pages/[lang]/propietarios/index.astro` | OK | SSG with `export const prerender = true` and `getStaticPaths()` for 3 locales |
| T-014 | How-it-works + FAQ + Final CTA | Same file | OK | 3-step process, 5 FAQ questions with `<details>/<summary>`, gradient CTA |
| T-015 | Propietarios tests | `apps/web/test/pages/propietarios-page.test.ts` (100 tests) | OK | All sections verified |

**Verified sections:**

1. Hero section with headline and CTA
2. Benefits grid (6 benefit cards)
3. How-it-works (3-step numbered process)
4. FAQ accordion (5 questions with collapsible answers)
5. Final CTA with link to `/precios/propietarios/`

### Layer 6: Pricing API Migration

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-017 | `precios/turistas.astro` API fetch | `apps/web/src/pages/[lang]/precios/turistas.astro:20,167` | OK | Imports `fetchTouristPlans`, calls in frontmatter |
| T-018 | `precios/propietarios.astro` API fetch | `apps/web/src/pages/[lang]/precios/propietarios.astro:20,167` | OK | Imports `fetchOwnerPlans`, calls in frontmatter |
| - | Shared pricing module | `apps/web/src/lib/pricing-plans.ts` | OK | `fetchTouristPlans()` and `fetchOwnerPlans()` with hardcoded fallback |
| T-019 | Pricing tests | `apps/web/test/pages/pricing-pages.test.ts` (181 tests) | OK | API call, fallback, plan rendering |

**Verified fallback pattern:**

- Calls `plansApi.list()` from billing API
- Filters by category (tourist/owner)
- Maps API response to plan card structure
- Falls back to `TOURIST_FALLBACK_PLANS` / `OWNER_FALLBACK_PLANS` on any error
- Price conversion: centavos to ARS/USD display

### Layer 7: Destination Accommodations Sub-page

| Task | Requirement | File | Status | Details |
|------|------------|------|--------|---------|
| T-020 | `destinos/[slug]/alojamientos/index.astro` | `apps/web/src/pages/[lang]/destinos/[slug]/alojamientos/index.astro` | OK | SSR. Resolves destination by slug, fetches accommodations |
| T-021 | `destinos/[slug]/alojamientos/page/[page].astro` | Same dir `/page/[page].astro` | OK | Pagination route |
| T-022 | Destination accommodation tests | `apps/web/test/pages/destination-accommodations-pages.test.ts` (106 tests) | OK | SSR config, destination resolution, breadcrumb, grid, pagination |

**Verified routing coexistence:**

- `[slug]/alojamientos/` is a more specific route and takes priority over `[...path].astro`
- Astro resolves specific routes before catch-all routes.. no conflict

### Layer 8: SEO & Cross-cutting

| Task | Requirement | Status | Details |
|------|------------|--------|---------|
| T-023 (partial) | hreflang on all new pages | OK | All pages use `SEOHead.astro` which auto-generates hreflang for es/en/pt + x-default |
| T-023 (partial) | JSON-LD structured data | **MISSING** | See Gap #1 below |
| T-024 | Full test suite | OK | 4914 tests passing across 99 files (verified in session) |
| - | hreflang verification tests: `apps/web/test/pages/spec011-hreflang-verification.test.ts` (62 tests) | OK | Verifies SEOHead presence on all new pages |

### SPEC-011 Test Coverage

| Test File | Tests | Scope |
|-----------|-------|-------|
| `event-category-pages.test.ts` | 100 | Event category index + pagination |
| `post-tag-pages.test.ts` | 105 | Post tag index + pagination |
| `propietarios-page.test.ts` | 100 | Owner landing page all sections |
| `pricing-pages.test.ts` | 181 | Both pricing pages with API migration |
| `destination-accommodations-pages.test.ts` | 106 | Destination accommodations + pagination |
| `spec011-hreflang-verification.test.ts` | 62 | hreflang on all SPEC-011 pages |
| `tag-public.test.ts` (API) | 8 | Tag by slug endpoint |
| `billing-public.test.ts` (API) | 15 | Public plans endpoint |
| **Total SPEC-011 tests** | **677** | |

---

## SPEC-011: Gaps Found

### SPEC-011 Gap 1: JSON-LD structured data not added to any new page

**Severity**: Low-Medium (SEO improvement, not blocking functionality)
**Effort**: ~2-3 hours
**Task reference**: T-023 description says: "Add JSON-LD structured data where appropriate: BreadcrumbList for all pages, CollectionPage for listing pages, FAQPage for propietarios"

**Current state**: None of the 7 new pages include any JSON-LD structured data. The components exist and are ready to use:

- `apps/web/src/components/seo/JsonLd.astro` (generic)
- `apps/web/src/components/seo/ArticleJsonLd.astro`
- `apps/web/src/components/seo/EventJsonLd.astro`
- `apps/web/src/components/seo/LodgingBusinessJsonLd.astro`

**Pages that should have JSON-LD:**

| Page | JSON-LD Type | Priority |
|------|-------------|----------|
| `propietarios/index.astro` | `FAQPage` (has 5 Q&A pairs) | High.. Google shows FAQ rich results |
| `eventos/categoria/[category]/index.astro` | `CollectionPage` + `BreadcrumbList` | Medium |
| `publicaciones/etiqueta/[tag]/index.astro` | `CollectionPage` + `BreadcrumbList` | Medium |
| `destinos/[slug]/alojamientos/index.astro` | `CollectionPage` + `BreadcrumbList` | Medium |
| `precios/turistas.astro` | `BreadcrumbList` | Low |
| `precios/propietarios.astro` | `BreadcrumbList` | Low |

**Fix**:

1. Import `JsonLd.astro` into each page
2. Add `<JsonLd slot="head" data={...} />` with appropriate schema
3. For propietarios: use `FAQPage` schema (highest SEO value)
4. For listing pages: use `CollectionPage` schema
5. Optionally add `BreadcrumbList` to all pages

---

## SPEC-011: File Inventory

### New Pages (7)

- `apps/web/src/pages/[lang]/eventos/categoria/[category]/index.astro`
- `apps/web/src/pages/[lang]/eventos/categoria/[category]/page/[page].astro`
- `apps/web/src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro`
- `apps/web/src/pages/[lang]/publicaciones/etiqueta/[tag]/page/[page].astro`
- `apps/web/src/pages/[lang]/propietarios/index.astro`
- `apps/web/src/pages/[lang]/destinos/[slug]/alojamientos/index.astro`
- `apps/web/src/pages/[lang]/destinos/[slug]/alojamientos/page/[page].astro`

### New API Routes (4 files)

- `apps/api/src/routes/tag/public/getBySlug.ts`
- `apps/api/src/routes/tag/public/index.ts`
- `apps/api/src/routes/billing/public/listPlans.ts`
- `apps/api/src/routes/billing/public/index.ts`

### Modified Files (4)

- `apps/api/src/routes/index.ts` (route registration)
- `apps/web/src/lib/api/endpoints.ts` (tagsApi + plansApi)
- `apps/web/src/pages/[lang]/precios/turistas.astro` (API migration)
- `apps/web/src/pages/[lang]/precios/propietarios.astro` (API migration)

### New Shared Module (1)

- `apps/web/src/lib/pricing-plans.ts`

### New Test Files (8)

- `apps/web/test/pages/event-category-pages.test.ts`
- `apps/web/test/pages/post-tag-pages.test.ts`
- `apps/web/test/pages/propietarios-page.test.ts`
- `apps/web/test/pages/pricing-pages.test.ts`
- `apps/web/test/pages/destination-accommodations-pages.test.ts`
- `apps/web/test/pages/spec011-hreflang-verification.test.ts`
- `apps/api/test/routes/tag-public.test.ts`
- `apps/api/test/routes/billing-public.test.ts`

---
---

## Combined Gap Summary

## All Gaps by Spec

| # | Spec | Gap | Severity | Effort | Actionable Now? |
|---|------|-----|----------|--------|-----------------|
| 1 | SPEC-005 | Widespread `as any` type assertions (110 instances, 9 files) | Medium | ~3-4h | Yes (fix Gap 11 first) |
| 2 | SPEC-005 | Homepage missing explicit SEOHead | Low | ~15 min | Yes |
| 3 | SPEC-005 | `quienes-somos.astro` body not localized | Medium | ~1-2h | Yes |
| 4 | SPEC-005 | Pagination inline HTML in tipo/[type] | Low | ~30 min | Yes |
| 5 | SPEC-005 | `ReviewList` hardcodes `isAuthenticated={false}` | Medium | ~15 min | Yes |
| 6 | SPEC-005 | Share buttons placeholder in eventos/[slug] | Low | ~15 min | Yes |
| 7 | SPEC-005 | Non-functional search bar in destinos/index | Low | ~1h | Yes |
| 8 | SPEC-005 | Skip-to-content link English only | Low | ~15 min | Yes |
| 9 | SPEC-005 | FAQ heading hardcoded in pricing pages | Low | ~15 min | Yes |
| 10 | SPEC-005 | i18n missing most English and all Portuguese translations | Medium-High | ~8-16h | Yes (content task) |
| 11 | SPEC-005 | API endpoint types use `Record<string, unknown>` (34 occurrences) | Medium | ~2-3h | Yes (root cause of Gap 1) |
| 12 | SPEC-006 | Breadcrumb not wired to hierarchy API | Medium | ~1h | Yes |
| 13 | SPEC-006 | Destination search page lacks hierarchy filter controls | Low-Medium | ~2-3h | Yes |
| 14 | SPEC-006 | `pathIds` stored as text instead of UUID array | Cosmetic | N/A | No (no action needed) |
| 15 | SPEC-006 | Missing `POI` destination type in enum | Low | ~15 min | No (not needed now) |
| 16 | SPEC-006 | Task state.json not updated (0/43 but ~90% done) | Administrative | ~15 min | Yes |
| 17 | SPEC-007 | PriceDisplay uses hardcoded exchange rates | Medium | ~1-2h | Yes |
| 18 | SPEC-007 | Cron job uses wrong env var name | Medium | ~5 min | Yes (bug fix) |
| 19 | SPEC-008 | 58 old Lucide SVG files not deleted | Low | ~5 min | Yes |
| 20 | SPEC-008 | 7 admin files still have inline SVGs | Low | ~30 min | Yes |
| 21 | SPEC-008 | IconProps doesn't extend SVGAttributes | Low | ~15 min | Yes |
| 22 | SPEC-010 | `stats.ts` missing `reviewCount` | Low | ~15 min | Yes |
| 23 | SPEC-010 | `stats.ts` plan always `null` | Low | ~30 min | No (billing) |
| 24 | SPEC-010 | `SubscriptionCard.client.tsx` never created | Medium | ~2h | No (billing) |
| 25 | SPEC-010 | Reviews list missing edit/delete | Medium | ~3h | Yes |
| 26 | SPEC-010 | `suscripcion.astro` no API fetch | Low | ~1h | No (billing) |
| 27 | SPEC-011 | JSON-LD structured data missing on all new pages | Low-Medium | ~2-3h | Yes |

**Total gaps**: 27 (across 6 specs)
**Actionable now**: 21 gaps (~20-27 hours excluding i18n translations)
**Deferred (billing)**: 3 gaps (~3.5 hours)
**No action needed**: 2 gaps (cosmetic/not needed now)
**Administrative**: 1 gap (~15 min)
**i18n translations**: ~8-16 hours (content task, not code)

---

## Prioritized Action Plan

### Priority 0: Critical Bug Fixes (< 10 min, ~5 min total)

1. **Gap 18 - SPEC-007** (~5 min) .. Fix cron job env var name (`EXCHANGERATE_API_KEY` → `HOSPEDA_EXCHANGE_RATE_API_KEY`). Silent failure bug.

### Priority 1: Quick Wins (< 30 min each, ~3.5h total)

2. **Gap 5 - SPEC-005** (~15 min) .. Fix `isAuthenticated={false}` hardcoded in ReviewList.
3. **Gap 6 - SPEC-005** (~15 min) .. Replace share button placeholders in eventos/[slug] with ShareButtons.client.tsx.
4. **Gap 9 - SPEC-005** (~15 min) .. Use localized FAQ heading in pricing pages.
5. **Gap 8 - SPEC-005** (~15 min) .. Localize skip-to-content link text.
6. **Gap 2 - SPEC-005** (~15 min) .. Add explicit SEOHead to homepage.
7. **Gap 22 - SPEC-010** (~15 min) .. Add `reviewCount` to stats endpoint.
8. **Gap 4 - SPEC-005** (~30 min) .. Replace inline pagination in tipo/[type] with Pagination component.
9. **Gap 19 - SPEC-008** (~5 min) .. Delete 58 old Lucide SVG files from packages/icons/src/svg/.
10. **Gap 21 - SPEC-008** (~15 min) .. Extend IconProps from React.SVGAttributes instead of `[key: string]: unknown`.
11. **Gap 16 - SPEC-006** (~15 min) .. Update task state.json to reflect actual progress (administrative).
12. **Gap 20 - SPEC-008** (~30 min) .. Replace inline SVGs in BooleanCell.tsx and other admin files with @repo/icons.

### Priority 2: Type Safety (root cause fix, ~5-7h total)

13. **Gap 11 - SPEC-005** (~2-3h) .. Type API endpoints with `@repo/schemas` types instead of `Record<string, unknown>`.
14. **Gap 1 - SPEC-005** (~3-4h) .. Remove all `as any` casts from pages (enabled by Gap 11 fix).

### Priority 3: Functionality (medium effort, ~12-16h total)

15. **Gap 12 - SPEC-006** (~1h) .. Wire breadcrumb to hierarchy API in destinos/[...path].astro.
16. **Gap 17 - SPEC-007** (~1-2h) .. Connect PriceDisplay to exchange rate API instead of hardcoded rates.
17. **Gap 27 - SPEC-011** (~2-3h) .. Add JSON-LD to SPEC-011 pages. Highest: FAQPage on propietarios.
18. **Gap 25 - SPEC-010** (~3h) .. Add edit/delete to UserReviewsList.
19. **Gap 13 - SPEC-006** (~2-3h) .. Add hierarchy filter controls to destination listing page.
20. **Gap 3 - SPEC-005** (~1-2h) .. Localize quienes-somos.astro body content.
21. **Gap 7 - SPEC-005** (~1h) .. Fix or remove non-functional search in destinos/index.

### Priority 4: Content (separate effort)

22. **Gap 10 - SPEC-005** (~8-16h) .. Create English and Portuguese translations for `@repo/i18n`. Content/translation task, not code.

### Deferred (blocked by billing integration)

23. **Gap 23 - SPEC-010** (~30 min) .. Wire billing lookup into stats endpoint.
24. **Gap 24 - SPEC-010** (~2h) .. Create `SubscriptionCard.client.tsx`.
25. **Gap 26 - SPEC-010** (~1h) .. Wire billing data into `suscripcion.astro`.

### No Action Needed

- **Gap 14 - SPEC-006** .. `pathIds` as text is functionally equivalent to UUID array. No change recommended.
- **Gap 15 - SPEC-006** .. `POI` destination type not needed for current deployment.

### Dependency Graph

```
PRIORITY 0 (bug fix):
  Gap 18 (cron env var) ------ standalone, critical

PRIORITY 1 (quick wins):
  Gap 5 (isAuthenticated) ---- standalone
  Gap 6 (share buttons) ------ standalone
  Gap 9 (FAQ heading) -------- standalone
  Gap 8 (skip-to-content) ---- standalone
  Gap 2 (SEOHead homepage) --- standalone
  Gap 22 (reviewCount) ------- standalone
  Gap 4 (pagination) --------- standalone
  Gap 19 (delete old SVGs) --- standalone
  Gap 21 (IconProps type) ---- standalone
  Gap 16 (task state) -------- standalone (administrative)
  Gap 20 (admin inline SVGs) - standalone

PRIORITY 2 (type safety):
  Gap 11 (endpoint types) ---- root cause
    |
    +-- Gap 1 (as any) ------- depends on Gap 11

PRIORITY 3 (functionality):
  Gap 12 (breadcrumb wiring) - standalone
  Gap 17 (PriceDisplay API) -- standalone
  Gap 27 (JSON-LD) ----------- standalone
  Gap 25 (edit/delete) ------- standalone (verify PATCH/DELETE APIs exist)
  Gap 13 (hierarchy filters) - standalone (benefits from Gap 12)
  Gap 3 (quienes-somos) ------ standalone
  Gap 7 (search bar) --------- standalone

PRIORITY 4 (content):
  Gap 10 (i18n translations) - standalone, no code dependency

DEFERRED (billing):
  Gap 23 (plan in stats) ----- requires billing integration
    |
    +-- Gap 24 (SubscriptionCard) -- requires Gap 23
    |     |
    |     +-- Gap 26 (suscripcion fetch) -- requires Gap 24
```
