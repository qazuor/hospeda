# SPEC-030 Audit Report v4 -- Post-Fix Comprehensive Analysis

**Date:** 2026-03-06
**Scope:** Exhaustive contrast of SPEC-030 specification vs actual `apps/web` codebase
**Method:** 4 parallel audit agents covering components, pages, theming, and known bugs

---

## Executive Summary

The migration is **substantially complete** with all 39 pages and 19/20 infrastructure components implemented. Build, typecheck, lint, and tests all pass (3767/3767). However, the audit reveals **1 critical issue**, **5 high-priority gaps**, **7 medium issues**, and **6 low-priority items**.

| Category | Total |
|----------|-------|
| Critical | 1 |
| High | 5 |
| Medium | 7 |
| Low | 6 |
| Info/Accepted | 4 |

---

## CRITICAL

### C-1: `dark:` variant misconfigured -- all `dark:` Tailwind utilities are dead code

**File:** `src/styles/global.css:4`

The Tailwind `@custom-variant` is configured as:
```css
@custom-variant dark (&:is(.dark *));
```

But the app uses `data-theme="dark"` (set by `BaseLayout.astro:86` FOUC script and `ThemeToggle.astro:96`). This means **every `dark:` prefixed class in the codebase has zero effect** -- they watch for `.dark` CSS class which is never applied.

The semantic token system works correctly (CSS custom properties switch via `[data-theme="dark"]`), but any component using explicit `dark:` overrides gets NO dark mode styling.

**Affected files with dead `dark:` classes:**
| File | Dead Classes |
|------|-------------|
| `account/ChangePlanDialog.client.tsx:249` | `dark:bg-warning/20 dark:text-warning` |
| `account/UsageOverview.client.tsx:45-47,57-58,204,211` | Multiple `dark:bg-*`, `dark:text-*` |
| `account/ActiveAddons.client.tsx:25-27,237` | `dark:bg-*`, `dark:hover:bg-*` |
| `alojamientos/[slug].astro:329` | `dark:prose-invert` |
| `destination/DestinationCard.client.tsx:129,143` | `dark:bg-primary/20`, `dark:hover:bg-primary/30` |
| `shared/ShareButtons.client.tsx:163,177,191` | `dark:` brand color overrides |

**Fix:** Change `global.css:4` to:
```css
@custom-variant dark (&:is([data-theme="dark"] *));
```
Or remove all `dark:` classes and rely exclusively on the semantic token system (preferred).

---

## HIGH PRIORITY

### H-1: `publicaciones/etiqueta/[tag]/index.astro` uses protected API on public page

**File:** `src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro:24`

This public page imports `tagsApi` from `endpoints-protected.ts`. If the endpoint requires auth cookies, unauthenticated users will get failures. Should use a public endpoint or move the tag API to `endpoints.ts`.

### H-2: `ReviewListIsland` missing `server:defer` in accommodation detail

**File:** `src/pages/[lang]/alojamientos/[slug].astro:365-370`

`ReviewListIsland` is designed for `server:defer` (reads `Astro.locals.user`), but in the accommodation detail page it's used **without** the `server:defer` directive. Since this page has `prerender = true`, `Astro.locals.user` will always be `null` at build time, meaning the review auth check never works.

### H-3: `destinos/[...path].astro` fetches ALL events with `pageSize: 100`

**File:** `src/pages/[lang]/destinos/[...path].astro:122`

Fetches up to 100 events and filters client-side by city name (line 132). This is a performance concern that grows with event count. Should use a server-side `destination` or `city` filter parameter, or at minimum reduce `pageSize` to match the 3 preview items actually displayed.

**Spec acknowledges this** (Known Bug #4) but labels it as something to fix during migration. It was not fixed.

### H-4: Test coverage at 47.75% (target: 80%+)

Coverage breakdown:
| Metric | Actual | Threshold |
|--------|--------|-----------|
| Statements | 47.75% | 80% |
| Functions | 65.28% | 80% |
| Lines | 47.75% | 80% |

Key uncovered files: `transforms.ts` (0%), `types.ts` (0%), `api/index.ts` (0%), `endpoints.ts` (69%), `endpoints-protected.ts` (77%), `middleware-helpers.ts` (58%).

### H-5: No `_AccommodationListLayout.astro` shared partial (code duplication)

**Spec AD (P3-03)** explicitly calls for creating `src/pages/[lang]/alojamientos/_AccommodationListLayout.astro` as a shared partial that `index.astro`, `page/[page].astro`, `tipo/[type]/index.astro`, and `tipo/[type]/page/[page].astro` all import as thin wrappers. This was not implemented -- accommodation list logic is duplicated across these files.

---

## MEDIUM PRIORITY

### M-1: Info/marketing pages missing ALL decorative elements

Per STYLE_GUIDE and spec AD-4, info/marketing pages should have "1 pattern + 2-3 decoratives + 1 illustration". None of these pages have any:

| Page | BackgroundPattern | DecorativeElement | Illustration |
|------|:-:|:-:|:-:|
| `contacto.astro` | MISSING | MISSING | MISSING |
| `quienes-somos.astro` | MISSING | MISSING | MISSING |
| `propietarios/index.astro` | MISSING | MISSING | MISSING |
| `beneficios.astro` | MISSING | MISSING | MISSING |
| `precios/turistas.astro` | MISSING | MISSING | MISSING |
| `precios/propietarios.astro` | MISSING | MISSING | MISSING |

The homepage sections correctly use all decorative elements. The gap is only in non-homepage pages.

### M-2: List pages missing decorative elements

Per spec AD-4, list pages should have "1 subtle pattern + 2-3 small decoratives, no illustrations":

| Page | BackgroundPattern | DecorativeElement |
|------|:-:|:-:|
| `destinos/index.astro` | MISSING | MISSING |
| `eventos/index.astro` | MISSING | MISSING |
| `publicaciones/index.astro` | MISSING | MISSING |
| `_AccommodationListLayout.astro` (if created) | MISSING | MISSING |

### M-3: Error pages missing custom illustrations

**Files:** `src/pages/404.astro`, `src/pages/500.astro`

Spec requires "1 custom illustration" for error pages. Both pages use only an icon (`AlertTriangleIcon`) and decorative text ("404"/"500"), not a proper thematic illustration (nature/river theme per brand guidelines).

### M-4: `destinos/[...path].astro` uses `text-card` instead of hero text token

**File:** `src/pages/[lang]/destinos/[...path].astro:214`

The hero heading uses `text-card` for white text on dark gradient. `text-card` is a semantic token for card **surface** background color, not text. Should use `text-hero-text` or `text-primary-foreground`. Currently renders correctly only because the `card` token value happens to be white.

### M-5: `precios/turistas.astro` breadcrumb uses hardcoded template literals

**File:** `src/pages/[lang]/precios/turistas.astro:49-52`

Uses `/${locale}/` template literals instead of `buildUrl()` for breadcrumb hrefs. All other pages consistently use `buildUrl()`. Inconsistency, not a functional bug.

### M-6: `alojamientos/[slug].astro` uses `prose-neutral`

**File:** `src/pages/[lang]/alojamientos/[slug].astro:329`

`prose-neutral` is a Tailwind typography plugin preset that applies hardcoded gray colors internally, bypassing the semantic token system. The content section may not theme correctly in dark mode. Consider using `prose` without a color modifier and customizing via CSS tokens.

### M-7: No scroll-reveal animations on non-homepage pages

The spec says info pages should use scroll-reveal ("Yes, all content"). No page outside the homepage sections uses `scroll-reveal`, `scroll-reveal-left`, or `scroll-reveal-right` classes.

---

## LOW PRIORITY

### L-1: `LanguageSwitcher.astro` not migrated

**Expected:** `src/components/shared/LanguageSwitcher.astro`
**Status:** MISSING

The spec notes this should be evaluated given the es-only scope. Acceptable to defer since only Spanish is verified in this migration.

### L-2: Legal page content not internationalized

**Files:** `privacidad.astro`, `terminos-condiciones.astro`

Legal body text is hardcoded in Spanish, not wrapped in `t()` calls. Only page titles and descriptions use i18n. The spec acknowledges this as a known issue (Known Bug #5).

### L-3: ReviewForm is a placeholder (no API submission)

**File:** `src/components/review/ReviewForm.client.tsx:164`

Has a TODO comment: `// TODO: Replace with actual API call to POST /api/v1/protected/reviews`. Shows a toast on submit but makes no API call. The spec explicitly allows this (Known Bug #7).

### L-4: Newsletter form is a placeholder (no backend)

**File:** `src/layouts/Footer.astro:116-126`

On submit, hides the form and shows a thank-you message without making any API call. The spec acknowledges this (Known Bug #6).

### L-5: `AccordionFAQ` filename mismatch with spec

Spec references `AccordionFAQ.client.tsx` (React) but implementation is `AccordionFAQ.astro` (pure Astro using native `<details>`/`<summary>`). The Astro approach is **superior** -- zero JS, progressive enhancement. Spec should be updated to reflect reality.

### L-6: Container widths deviate from spec

Spec AD-4 says standard `max-w-5xl`, wide `max-w-6xl`, narrow `max-w-2xl`. The STYLE_GUIDE and actual implementation use `max-w-7xl` as standard. The codebase is internally consistent with the STYLE_GUIDE, but the STYLE_GUIDE deviates from the original spec.

---

## ACCEPTED / INFO

### I-1: ShareButtons uses hardcoded brand colors

`bg-green-500` (WhatsApp), `bg-blue-600` (Facebook), `bg-black` (X/Twitter). Intentional per brand guidelines, documented in code with comments at lines 152-156.

### I-2: `experimental.serverIslands` not needed

Spec mentions this flag but Astro 5.7+ has `server:defer` stable. No flag needed. Correct as-is.

### I-3: `alojamientos/tipo/[type]/index.astro` rendering ambiguity

No explicit `prerender` export but has no `getStaticPaths` either (removed in prior session). Defaults to SSR in `output: 'server'` mode. Functionally correct for a filtered list page that accepts query params.

### I-4: Pagination pages are thin rewrites

`page/[page].astro` files across accommodations, destinations, events, blog are minimal rewrite-only pages (extract page param, redirect or delegate). Correct architecture pattern.

---

## Spec Completeness Scorecard

| Success Criteria (from spec) | Status |
|------------------------------|--------|
| 1. All 39 pages render correctly | PASS (39/39 exist, build succeeds) |
| 2. All pages pass typecheck, lint, tests | PASS (0 errors, 3767/3767 tests) |
| 3. All pages use semantic color tokens | PASS (0 hardcoded colors in pages) |
| 4. All pages follow STYLE_GUIDE decorative rules | FAIL (M-1, M-2, M-3) |
| 5. All pages have correct SEO | PASS (all have SEOHead, JSON-LD on details) |
| 6. All interactive components work | PARTIAL (L-3, L-4 are placeholders per spec) |
| 7. All pages work in Spanish (es) | PASS |
| 8. Dark mode works on all pages | FAIL (C-1: dark: variant dead code) |
| 9. Mobile/tablet/desktop responsive | NOT VERIFIED (no Playwright screenshots) |
| 10. Known bugs from web-old are fixed | PARTIAL (H-3 not fixed) |
| 11. web-old can be safely deleted | BLOCKED (issues above need resolution first) |

---

## Recommended Action Priority

1. **Fix C-1** (dark: variant) -- 1 line change in `global.css`, prevents dark mode visual regressions
2. **Fix H-1** (protected API on public page) -- Move tag API to public endpoints
3. **Fix H-2** (ReviewListIsland server:defer) -- Add `server:defer` to accommodation detail usage
4. **Fix H-3** (pageSize:100 events) -- Reduce to pageSize:6 or add server-side filter
5. **Fix M-4** (text-card in hero) -- Replace with text-hero-text
6. **Fix M-5** (buildUrl consistency) -- Quick find/replace in turistas.astro
7. **Fix M-6** (prose-neutral) -- Use prose without color modifier
8. **Address M-1, M-2, M-3** (decoratives) -- Per-page work, can be batched
9. **Address H-4** (test coverage) -- Incremental, prioritize transforms.ts and endpoints
10. **Address H-5** (_AccommodationListLayout) -- Refactor to reduce duplication
