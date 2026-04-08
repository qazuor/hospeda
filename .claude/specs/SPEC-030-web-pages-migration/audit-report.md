# SPEC-030 Audit Report: Web Pages Migration

**Date:** 2026-03-06
**Scope:** Exhaustive analysis of SPEC-030 spec vs actual code state in `apps/web/`

---

## Executive Summary

The migration from `apps/web-old` to `apps/web` is **structurally complete** -- all 39+ pages exist, all required components exist, all lib files exist. However, the implementation has **significant quality issues** that need attention before the migration can be considered truly done.

| Metric | Status |
|--------|--------|
| Pages created (39/39) | COMPLETE |
| Components migrated | COMPLETE (missing only LanguageSwitcher -- debatable need) |
| Lib files / hooks / data | COMPLETE |
| Task state integrity | PROBLEMATIC (124/124 marked complete, 0/124 subtasks verified) |
| TypeScript compilation | FAILING (6 errors) |
| Lint (Biome) | FAILING (65 errors) |
| Tests | FAILING (3 files, 26 failed tests, 1 unhandled error) |
| `experimental.serverIslands` | MISSING from astro.config.mjs |
| Hardcoded colors | 12 files still use hardcoded palette colors |
| Missing images | 40 images missing (all hero, all placeholders) |
| `_AccommodationListLayout` partial | NOT created (spec called for it) |
| Rendering strategy alignment | Partially divergent from spec |
| CLAUDE.md accuracy | Outdated (claims "no pre-rendering" but many pages use it) |

---

## 1. CRITICAL ISSUES (Must Fix)

### 1.1 Missing placeholder images cause broken UI

**40 images** referenced in code do NOT exist in `apps/web/public/images/`:

| Category | Count | Impact |
|----------|-------|--------|
| Placeholder SVGs (accommodation, avatar, blog, destination, event) | 5 | **Cards show broken images when API returns no image** |
| Hero images (32 hero/ files) | 32 | **Homepage slideshow broken** |
| Parallax images (2 missing) | 2 | Parallax dividers show broken images |
| Other (banner-shape.png, thumb-mask-image.png) | 1 | Minor UI issues |

**Files affected by missing placeholders (confirmed in code):**
- `lib/api/transforms.ts` -- references `/images/placeholder-accommodation.svg`, `/images/placeholder-event.svg`, `/images/placeholder-destination.svg`
- `publicaciones/[slug].astro` -- references `/images/placeholder-avatar.svg`, `/images/placeholder-blog.svg`
- `alojamientos/[slug].astro` -- references `/images/placeholder-accommodation.svg`
- `destinos/[...path].astro` -- references `/images/placeholder-destination.svg`
- `ImageCarousel.client.tsx` -- references `/images/placeholder-accommodation.svg`
- `DestinationCard.client.tsx` -- references `/images/placeholder-destination.svg`

**Fix:** Copy missing images from `apps/web-old/public/images/` to `apps/web/public/images/`.

### 1.2 `experimental.serverIslands` NOT enabled

The code uses `server:defer` directives in 8+ locations but `astro.config.mjs` does NOT have `experimental: { serverIslands: true }`.

**Files using `server:defer`:**
- `Header.astro` (2 uses for AuthSection)
- `FavoriteButtonIsland.astro`
- `ReviewListIsland.astro`
- `[lang]/index.astro` (4 uses for AccommodationsSection, DestinationsSection, EventsSection, PostsSection)

**Impact:** Server Islands may silently fail or throw runtime errors depending on Astro version.
**Fix:** Add `experimental: { serverIslands: true }` to astro.config.mjs.

### 1.3 TypeScript compilation fails (6 errors)

All errors are `string` not assignable to `"es" | "en" | "pt"`:

| File | Line |
|------|------|
| `HeroSearchForm.tsx` | 74, 183 |
| `GuestCounter.tsx` | 53 |
| `SearchFieldDestination.tsx` | 49 |
| `SearchFieldType.tsx` | 49 |
| `use-search-form.ts` | 31 |

These are homepage search-form components that pre-date the migration. They pass `locale` as `string` instead of `SupportedLocale`.

### 1.4 Test failures (26 tests across 3 files)

| File | Failed | Issue |
|------|--------|-------|
| `subscription-billing.test.tsx` | 24/32 | Tests don't match component API. **115s timeout per test.** |
| `review-system.test.tsx` | 1/38 | `getByRole('form')` can't find form element |
| `user-nav.test.ts` | 1/11 | 1 test failing |

Plus: 1 unhandled rejection in `favorite-button.test.tsx`.

**Total: 2166 passing / 2192 total (98.8% pass rate)**

### 1.5 Lint errors (65 errors)

Breakdown:
- **Formatter issues:** ~8+ files need formatting
- **CSS class sorting:** 5+ instances of unsorted Tailwind classes
- **Accessibility (`a11y/noLabelWithoutControl`):** 3 instances of `<label>` without `for`/`htmlFor`
- **Array index as key:** 1 instance
- **Negation test inversion:** 1 instance
- **46+ additional errors** (truncated in lint output)

---

## 2. SPEC vs CODE DIVERGENCES

### 2.1 Hardcoded colors in 12 source files

The spec (AD-4) explicitly requires replacing all hardcoded palette colors with semantic tokens. **12 source files** still contain hardcoded colors:

| Pattern | Files |
|---------|-------|
| `bg-white` (should be `bg-card`/`bg-background`) | Header.astro, HeroSearchForm.tsx, ThemeToggle.astro, HeroSlideshow.tsx, AuthSection.astro, UserNav.client.tsx |
| `bg-blue-` (should be `bg-primary`) | ShareButtons.client.tsx, SubscriptionCard.client.tsx |
| `bg-green-` (should be `bg-secondary`) | ReviewList.client.tsx, ShareButtons.client.tsx, SubscriptionCard.client.tsx |
| `bg-red-` (should be `bg-destructive`) | CancelSubscriptionDialog.client.tsx, UserFavoritesList.client.tsx, SubscriptionCard.client.tsx |
| `text-blue-` (should be `text-primary`) | SubscriptionCard.client.tsx |

**Note:** Some `bg-white` uses in the header/hero area may be intentional (white text over dark images), but they should use `text-white` not `bg-white` for those contexts. Each needs case-by-case review.

### 2.2 `_AccommodationListLayout.astro` NOT created

The spec (P3-03 architecture decision) calls for a shared partial `_AccommodationListLayout.astro` to eliminate duplication across 4 accommodation list variants. This file does NOT exist. The 4 pages likely duplicate list logic.

### 2.3 Rendering Strategy Mismatch

The spec (AD-7) defines rendering per page type:
- Detail pages should use **SSG with `getStaticPaths`**
- Static pages should use **SSG with `prerender = true`**

The CLAUDE.md claims:
> "All pages use SSR.. No static pre-rendering is used in this app."

**Reality (from code):**
- `publicaciones/[slug].astro` -- HAS `prerender = true` + `getStaticPaths()` (follows spec)
- Static pages (privacidad, terminos, beneficios, contacto, propietarios, quienes-somos, destinos/index) -- HAVE `prerender = true` (follows spec)
- `alojamientos/[slug].astro`, `eventos/[slug].astro`, `destinos/[...path].astro` -- Status unverified

**Conclusion:** Code partially follows spec, but CLAUDE.md documentation is wrong.

### 2.4 LanguageSwitcher NOT migrated

The spec mentions porting LanguageSwitcher.astro. It does NOT exist in web. Impact is low given es-only scope.

### 2.5 Task State Integrity

124 tasks ALL marked "completed" but 0/124 have subtasks marked as done. Tasks were bulk-completed without individual verification.

---

## 3. GAPS NOT DECLARED IN SPEC

### 3.1 Hero images directory missing entirely

The `public/images/hero/` directory with 32 images doesn't exist in web. The homepage HeroSlideshow component likely references these images. This was not mentioned as a migration step in the spec.

### 3.2 Homepage components pre-dating migration have type errors

The 6 TypeScript errors are in homepage components declared "out of scope" by the spec but they block `pnpm typecheck` for the entire app.

### 3.3 Subscription billing tests broken (24 failures, 115s timeouts)

Not in spec scope but blocks quality gate T-107.

### 3.4 `feedback.astro` page not in spec

Exists in web, not in web-old. Comes from SPEC-031 -- not a problem but undocumented.

### 3.5 Dark mode and visual verification not done

T-107 (regression) and T-108 (Playwright screenshots) could not have been legitimately completed given failing tests and lint errors.

### 3.6 `useTranslation` vs `createTranslations` inconsistency

Homepage components use `createTranslations` directly with `string` locale (causing type errors). Migrated components likely use the `useTranslation` hook. There's no enforced consistency.

---

## 4. WHAT'S ACTUALLY COMPLETE (Positive Findings)

### 4.1 All 39 pages exist with substantial implementations

| Page | Lines | Assessment |
|------|-------|-----------|
| `alojamientos/index.astro` | 330 | Real implementation with filters, API, grid |
| `alojamientos/[slug].astro` | 437 | Real implementation with gallery, reviews, map |
| `destinos/[...path].astro` | 360 | Real implementation with catch-all, climate |
| `eventos/[slug].astro` | 468 | Real implementation with agenda, pricing |
| `mi-cuenta/index.astro` | 427 | Real implementation with avatar, stats |
| `busqueda.astro` | 383 | Real implementation with 4-entity search |
| `publicaciones/[slug].astro` | 290 | Real implementation with TipTap, related |

### 4.2 All required components exist

Every component from the spec's migration table exists:
- All infrastructure components (Pagination, Breadcrumb, filters, galleries, etc.)
- All 13 account islands
- All review, search, calendar, map components
- NavigationProgress, CounterAnimation, Tabs

### 4.3 Complete lib/hooks/data layer

- API layer (client, endpoints, transforms, types)
- All utilities (i18n, auth, env, cn, logger, etc.)
- New files per spec: format-utils.ts, useTranslation.ts, useCountUp.ts, CLAUDE.md

### 4.4 Comprehensive test suite

57 test files, 2192 test cases, 98.8% pass rate. Coverage spans components, pages, libs, stores.

### 4.5 Design system infrastructure complete

- All SEO components (SEOHead, 5 JsonLd variants)
- All shared components from AD-2 (cards, badges, dividers, decoratives)
- Skeleton loading components for all entity types
- New web-specific images (decoratives, illustrations, patterns, parallax)

---

## 5. PRIORITIZED ACTION PLAN

### P0 -- Blocking issues (prevent deployment)

| # | Issue | Fix |
|---|-------|------|
| 1 | **Copy 40 missing images** from web-old to web | `cp -r` hero/, placeholders, etc. |
| 2 | **Add `experimental.serverIslands`** to astro.config.mjs | 1-line config change |
| 3 | **Fix 6 TypeScript errors** in homepage components | Cast locale to `SupportedLocale` |
| 4 | **Fix 65 lint errors** | `biome check --fix` + manual a11y fixes |

### P1 -- Test reliability

| # | Issue | Fix |
|---|-------|------|
| 5 | **Fix 24 subscription-billing tests** | Rewrite to match component API |
| 6 | **Fix review-system test** (1 failure) | Fix form role query |
| 7 | **Fix user-nav test** (1 failure) | Debug and fix |
| 8 | **Fix favorite-button unhandled rejection** | Proper mock cleanup |

### P2 -- Quality / spec compliance

| # | Issue | Fix |
|---|-------|------|
| 9 | **Fix 12 files with hardcoded colors** | Replace with semantic tokens |
| 10 | **Create `_AccommodationListLayout.astro`** or document why skipped | Extract shared logic |
| 11 | **Verify rendering strategy** on detail pages | Check SSG vs SSR alignment |
| 12 | **Run dark mode check** on all pages | Visual verification |
| 13 | **Run Playwright visual verification** (T-108) | 3 viewports x 39 pages |

### P3 -- Documentation

| # | Issue | Fix |
|---|-------|------|
| 14 | **Update CLAUDE.md** -- "no pre-rendering" claim is wrong | Fix rendering docs |
| 15 | **Fix task state** -- subtasks all marked incomplete | Update or regenerate |
| 16 | **Document LanguageSwitcher skip** | Add note to spec |

---

## 6. RISK ASSESSMENT

| Risk | Severity | Likelihood | Status |
|------|----------|------------|--------|
| Broken images (placeholders + hero) | **HIGH** | **CERTAIN** | 40 files missing |
| `server:defer` broken without config | **HIGH** | **HIGH** | Config missing |
| Type errors block CI/CD | **HIGH** | **CERTAIN** | 6 errors |
| Lint errors block pre-commit hooks | **HIGH** | **CERTAIN** | 65 errors |
| Hardcoded colors break dark mode | **MEDIUM** | **HIGH** | 12 files affected |
| Broken tests mask regressions | **MEDIUM** | **HIGH** | 26 failures |
| Code duplication without shared layout | **LOW** | **CERTAIN** | Layout not created |
| CLAUDE.md misleads future developers | **LOW** | **CERTAIN** | Wrong rendering docs |

---

## Appendix A: Complete Page Inventory

All 45 web-old pages migrated 1:1. Plus 1 new page (`feedback.astro`).

## Appendix B: Missing Images List

```
public/images/placeholder-accommodation.svg
public/images/placeholder-avatar.svg
public/images/placeholder-blog.svg
public/images/placeholder-destination.svg
public/images/placeholder-event.svg
public/images/banner-shape.png
public/images/thumb-mask-image.png
public/images/hero/ (32 files - entire directory)
public/images/parallax/parallax-aventura.jpg
public/images/parallax/parallax-termas.jpg
```

## Appendix C: Files with Hardcoded Colors

```
src/layouts/Header.astro                              (bg-white)
src/components/HeroSearchForm.tsx                      (bg-white)
src/components/HeroSlideshow.tsx                       (bg-white)
src/components/ui/ThemeToggle.astro                    (bg-white)
src/components/auth/AuthSection.astro                  (bg-white)
src/components/auth/UserNav.client.tsx                 (bg-white)
src/components/shared/ShareButtons.client.tsx          (bg-blue, bg-green)
src/components/review/ReviewList.client.tsx             (bg-green)
src/components/account/SubscriptionCard.client.tsx     (bg-blue, bg-green, bg-red, text-blue)
src/components/account/CancelSubscriptionDialog.client.tsx (bg-red)
src/components/account/UserFavoritesList.client.tsx    (bg-red)
```
