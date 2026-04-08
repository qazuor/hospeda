# SPEC-022: Frontend Quality (Theming, i18n, Performance) - Gap Analysis

> Generated: 2026-03-04
> Last updated: 2026-03-08
> Based on: Exhaustive code audit contrasted against spec requirements

---

## Audit History

| Pass | Date | Gaps Found | New | Notes |
|------|------|-----------|-----|-------|
| 1st | 2026-03-02 | 10+ | 10+ | Initial audit. Most gaps were fixed immediately |
| 2nd | 2026-03-04 | 3 | 0 | Confirmed fixes, only 3 LOW gaps remained |
| 3rd | 2026-03-04 | 8 | 5 | Deep re-audit found undefined CSS tokens, StickyNav, contacto i18n, deprecated patterns |
| 4th | 2026-03-04 | 9 | 1 | Found shadow tokens missing dark mode overrides |
| **5th** | **2026-03-08** | **20** | **11** | **Exhaustive multi-agent audit with 5 parallel expert agents. Major new findings in undefined Tailwind tokens (95 usages in 12 files), z-index tokens unused, hardcoded hex in feedback.astro, admin theming violations, i18n aria-labels** |

---

## Executive Summary

**SPEC-022 is ~90% complete.** The 5th audit pass used 5 parallel expert agents (dark mode web, dark mode admin, i18n, performance, CSS tokens) for an exhaustive review. Performance items are 100% complete. Theming and i18n have significant residual gaps that were missed in previous audits.

| Dimension | Status | Gaps Found | Severity Profile |
|-----------|--------|-----------|-----------------|
| Dark Mode - Web (THEME) | ~88% complete | 7 gaps | 1 HIGH, 3 MEDIUM, 3 LOW |
| Dark Mode - Admin (THEME) | ~92% complete | 4 gaps | 1 HIGH, 2 MEDIUM, 1 LOW |
| CSS Token System | ~85% complete | 3 gaps | 1 CRITICAL, 1 HIGH, 1 MEDIUM |
| i18n - Web (I18N) | ~94% complete | 3 gaps | 1 HIGH, 1 MEDIUM, 1 LOW |
| i18n - Admin (I18N) | ~92% complete | 2 gaps | 1 MEDIUM, 1 LOW |
| Performance (PERF) | 100% complete | 0 gaps | -- |

**Total gaps: 20 (1 CRITICAL, 3 HIGH, 7 MEDIUM, 9 LOW)**

---

## Gap Registry

### Gap #1 (Audit 1) - ACCEPTED EXCEPTION

**Image overlay gradients use `from-black/80` instead of CSS variable tokens**

- **Spec Reference:** US-T06 (zero hardcoded hex values)
- **Severity:** LOW | **Priority:** LOW | **Complexity:** Trivial
- **Status:** ACCEPTED EXCEPTION (design-correct)
- **First found:** Audit 1 (2026-03-02) | **Confirmed in:** Audits 2-5

Four components use `from-black/80` gradients for text-over-image overlays. Black overlays work correctly in both light and dark mode since they overlay images, not background colors.

**Files:** AccommodationCardFeatured.astro:111, DestinationCard.astro:58, destinos/[...path].astro:255, HeroSection.astro:102

**Decision:** Accept as-is. Not a theming violation.

---

### Gap #2 (Audit 1) - ACCEPTED EXCEPTION

**`!important` declarations in SVG/accessibility contexts**

- **Spec Reference:** US-T05 (no !important)
- **Severity:** LOW | **Priority:** LOW | **Complexity:** Trivial
- **Status:** ACCEPTED EXCEPTION (spec-excluded)
- **First found:** Audit 1 (2026-03-02) | **Confirmed in:** Audits 2-5

4 `!important` declarations remain in SVG overrides (RiverWavesDivider, LitoralMap, global.css) and `prefers-reduced-motion` accessibility patterns (animations.css). Spec explicitly states "inline critical CSS and third-party overrides explicitly excluded."

**Decision:** Accept as-is. Spec-excluded.

---

### Gap #3 (Audit 1) - ACCEPTED EXCEPTION

**`bg-white/20` in admin lightbox overlay controls**

- **Spec Reference:** US-T07 (admin shadcn classes)
- **Severity:** LOW | **Priority:** LOW | **Complexity:** Trivial
- **Status:** ACCEPTED EXCEPTION (image overlay controls)
- **First found:** Audit 1 (2026-03-02) | **Confirmed in:** Audits 2-5

Semi-transparent white overlays on lightbox image controls. Same pattern as web image overlays.

**Files:** GalleryViewField.tsx:191,202,213, ImageViewField.tsx:177,188

**Decision:** Accept as-is. Image overlay controls, not surface colors.

---

### Gap #4 (Audit 3) - NEEDS FIX .. UPDATED IN AUDIT 5

**Undefined CSS tokens used extensively across web app**

- **Spec Reference:** US-T02 (CSS variables dark coverage), US-T01 (dark mode web components)
- **Severity:** CRITICAL | **Priority:** P0 | **Complexity:** Low (~30 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 3 (2026-03-04) | **Confirmed + expanded in:** Audit 5

**Audit 5 update:** Previous audits identified `bg-bg-secondary`, `bg-bg-alt`, `text-text-primary` as the undefined tokens. Audit 5 reveals a MUCH LARGER scope of undefined tokens:

**Tokens used in components but NOT defined in global.css or @theme:**

| Token Class | CSS Variable Expected | Occurrences | Files |
|------------|----------------------|-------------|-------|
| `bg-surface` | `--color-surface` | 26+ | 12 files |
| `bg-surface-alt` | `--color-surface-alt` | 7+ | 4 files |
| `text-text` | `--color-text` | 42+ | 15+ files |
| `text-text-secondary` | `--color-text-secondary` | 30+ | 10+ files |
| `text-text-tertiary` | `--color-text-tertiary` | 11+ | 5+ files |
| `text-error` / `border-error` | `--color-error` | 8+ | 3 files |
| `text-star` / `text-star-empty` | `--color-star` / `--color-star-empty` | 4 | 3 files |
| `bg-bg-secondary` | `--color-bg-secondary` | ~8 | 8 files (auth pages, etc.) |
| `bg-bg-alt` | `--color-bg-alt` | ~2 | 404.astro, 500.astro |
| `bg-bg-tertiary` | `--color-bg-tertiary` | ~1 | MobileMenu.client.tsx |
| `text-text-primary` | `--color-text-primary` | 115 | 26 files |
| **TOTAL** | | **~254+** | **40+ files** |

**Impact:** Components using these tokens render with NO styling (Tailwind v4 treats undefined token references as transparent/empty). Dark mode is broken for ~40+ files including auth pages, account pages, contact form, filter sidebar, review forms, image gallery, search page.

**Root Cause:** Two incomplete token migrations happened independently. Components were updated to use semantic token names, but the token definitions in `global.css` and `@theme` block were never created to match.

**Proposed Solution:**
1. **(Recommended) Define all missing tokens as aliases** in `global.css` `:root` and `[data-theme="dark"]`, then map in `@theme`. Map to existing tokens where logical:
   - `--color-surface` -> similar to `--card` but slightly different shade
   - `--color-text` -> `var(--foreground)`
   - `--color-text-secondary` -> `var(--muted-foreground)`
   - `--color-text-tertiary` -> lighter than muted-foreground
   - `--color-error` -> `var(--destructive)`
   - `--color-star` -> amber/gold color
   - `--color-bg-secondary` / `--color-bg-alt` -> `var(--muted)`
   - `--color-text-primary` -> `var(--foreground)`
2. OR replace all component usages with existing tokens (e.g., `bg-surface` -> `bg-card`, `text-text` -> `text-foreground`). Higher effort (~2 hours), touches 40+ files.

**Files (most critical):**
- apps/web/src/components/account/*.client.tsx (7 files)
- apps/web/src/components/accommodation/FilterChipsBar.client.tsx
- apps/web/src/components/accommodation/FilterSidebar.client.tsx
- apps/web/src/components/content/ContactForm.client.tsx
- apps/web/src/components/shared/ImageGallery.client.tsx
- apps/web/src/components/shared/FavoriteButton.client.tsx
- apps/web/src/components/destination/DestinationPreview.astro
- apps/web/src/pages/[lang]/auth/*.astro (5 files)
- apps/web/src/pages/[lang]/contacto.astro
- apps/web/src/pages/[lang]/busqueda.astro
- apps/web/src/styles/global.css (needs token additions)

**Recommendation:** Fix directly. Should be part of SPEC-022 completion, not a new spec.

---

### Gap #5 (Audit 3) - NEEDS VERIFICATION

**`StickyNavController` uses `client:load` instead of `client:idle`**

- **Spec Reference:** US-P07 (hero hydration)
- **Severity:** LOW | **Priority:** LOW | **Complexity:** Trivial (1 min)
- **Status:** NEEDS VERIFICATION (StickyNav may have been removed)
- **First found:** Audit 3 (2026-03-04)

**Audit 5 update:** Grep for `StickyNavController` returns no results. Component may have been removed or renamed since audit 3. Needs verification before marking resolved.

**Recommendation:** Verify if component still exists. If removed, mark as RESOLVED.

---

### Gap #6 (Audit 3) - ACCEPTED EXCEPTION

**`AccommodationCardFeatured.astro` dynamic hsl() for star colors**

- **Spec Reference:** US-T06
- **Severity:** LOW | **Priority:** LOW | **Complexity:** N/A
- **Status:** ACCEPTED EXCEPTION
- **First found:** Audit 3 (2026-03-04)

Dynamic star color computed in JS. Dark mode override works via CSS. Design-correct exception.

**Decision:** Accept as-is. Documented exception.

---

### Gap #7 (Audit 3) - NEEDS FIX

**`contacto.astro` has 2 hardcoded i18n strings + 3 hardcoded aria-labels**

- **Spec Reference:** US-I01 (i18n completeness), UX Considerations (preserve aria-labels)
- **Severity:** LOW | **Priority:** LOW | **Complexity:** Trivial (~10 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 3 (2026-03-04) | **Expanded in:** Audit 5

Lines 82, 100: hardcoded "Email" and "Location" labels (i18n keys exist but unused).
Lines 145, 154, 163: hardcoded `aria-label="Instagram"`, `aria-label="Facebook"`, `aria-label="Twitter / X"`.

**Recommendation:** Fix directly. Trivial change within SPEC-022 scope.

---

### Gap #8 (Audit 3) - NEEDS FIX

**`bg-opacity-*` deprecated Tailwind v3 pattern**

- **Spec Reference:** US-T01, US-T07
- **Severity:** LOW | **Priority:** LOW | **Complexity:** Trivial (~5 min)
- **Status:** OPEN - needs fix (only 1 instance remains)
- **First found:** Audit 3 (2026-03-04) | **Updated in:** Audit 5

**Audit 5 update:** contacto.astro instances may have been fixed (not re-verified). 1 confirmed remaining instance:
- `apps/admin/src/components/table/cells/GalleryCell.tsx:125`: `bg-black bg-opacity-60` -> should be `bg-black/60`

**Recommendation:** Fix directly. 1-line change.

---

### Gap #9 (Audit 4) - NEEDS VERIFICATION

**Shadow tokens no dark mode overrides**

- **Spec Reference:** US-T02 (CSS variables dark coverage, shadows visible against dark surfaces)
- **Severity:** MEDIUM-HIGH | **Priority:** P1 | **Complexity:** Low (~15 min)
- **Status:** NEEDS VERIFICATION
- **First found:** Audit 4 (2026-03-04)

**Audit 5 update:** Audit 5 CSS token agent found that shadow tokens use `oklch(from var(--foreground) l c h / opacity)` expressions, which AUTOMATICALLY adapt based on the current `--foreground` value. This means shadows derive their color from the foreground token and SHOULD adapt to dark mode automatically.

**Previous assessment said shadows were broken. New assessment says they auto-adapt. This needs visual verification.**

If shadows use `oklch(from var(--foreground) ...)`:
- Light mode: foreground is dark -> dark shadows on light backgrounds (correct)
- Dark mode: foreground is light -> light shadows on dark backgrounds (should be correct)

**Recommendation:** Visually verify shadow visibility in dark mode. If auto-adaptation works, downgrade to RESOLVED. If shadows are still invisible, add explicit dark mode overrides.

---

### Gap #10 (Audit 5) - NEW - NEEDS FIX

**Hardcoded hex colors in feedback.astro (standalone page)**

- **Spec Reference:** US-T06 (no hardcoded hex/rgba), US-T01 (dark mode)
- **Severity:** MEDIUM | **Priority:** P2 | **Complexity:** Low (~20 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 5 (2026-03-08)

`apps/web/src/pages/[lang]/feedback.astro` contains inline `<style>` with 6 hardcoded hex values:
- Line 52: `background-color: #f8fafc;` (light slate)
- Line 58: `color: #1e293b;` (dark slate text)
- Line 61: `background: #ffffff;` (white container)
- Line 75: `color: #1e293b;` (dark slate heading)
- Line 80: `color: #64748b;` (medium slate)
- Line 91: `color: #2563eb;` (blue link)

This page intentionally avoids the main app shell (crash-resistant design), but it has NO dark mode support at all. White container + dark text on a dark OS theme creates readability issues.

**Proposed Solutions:**
1. **(Recommended) Add `prefers-color-scheme: dark` media query** to the inline styles with inverted colors. Maintains crash-resistance while supporting dark mode. ~15 min.
2. Use CSS variables from global.css. Breaks crash-resistance principle.

**Recommendation:** Fix directly. Small scope, clear solution.

---

### Gap #11 (Audit 5) - NEW - NEEDS FIX

**Z-index tokens defined but NEVER used in components**

- **Spec Reference:** US-T03 (z-index consistent and intentional)
- **Severity:** MEDIUM | **Priority:** P2 | **Complexity:** Medium (~45 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 5 (2026-03-08)

Z-index CSS variable tokens defined in global.css:
```css
--z-content: 10;
--z-wave: 20;
--z-menu: 40;
--z-overlay: 50;
--z-toast: 100;
```

**0 components use these tokens.** All 13 z-index usages across 10 files use hardcoded Tailwind classes:
- `z-50`: 12 instances (Header, Toast, select, drawer, popover, ImageGallery, FavoriteButton, DestinationPreview, NavigationProgress, UserNav)
- `z-40`: 1 instance (Header mobile menu)

**Problems:**
1. Toast container (`z-50`) and Header nav (`z-50`) have SAME z-index, so toasts can render behind the header
2. US-T03 requires "exactly one approach documented.. not both" but BOTH CSS tokens AND hardcoded Tailwind exist
3. Token scale was defined but never adopted by any component

**Proposed Solutions:**
1. **(Recommended) Document decision to use Tailwind classes only**, remove unused CSS variable tokens. Ensure Toast is z-[100] and Header is z-50. ~20 min.
2. Migrate all components to use CSS variable tokens via `z-[var(--z-toast)]` etc. More effort but consistent. ~45 min.

**Recommendation:** Fix directly. US-T03 acceptance criteria is clear. Could be part of SPEC-022 completion.

---

### Gap #12 (Audit 5) - NEW - NEEDS FIX

**Admin BooleanCell.tsx uses hardcoded green/red bypassing shadcn**

- **Spec Reference:** US-T07 (admin shadcn semantic classes)
- **Severity:** MEDIUM | **Priority:** P2 | **Complexity:** Low (~10 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 5 (2026-03-08)

`apps/admin/src/components/table/cells/BooleanCell.tsx:22-35` uses:
- `bg-green-100 dark:bg-green-900` + `text-green-600 dark:text-green-400` (true state)
- `bg-red-100 dark:bg-red-900` + `text-red-600 dark:text-red-400` (false state)

While dark: variants exist (so it works), this bypasses the shadcn semantic class system. Should use `bg-success/10 text-success` and `bg-destructive/10 text-destructive`.

**Proposed Solution:** Replace with shadcn semantic classes: `bg-success/10 text-success-foreground` and `bg-destructive/10 text-destructive-foreground`.

**Recommendation:** Fix directly. Small, clear change.

---

### Gap #13 (Audit 5) - NEW - NEEDS FIX

**Admin DataTable.tsx native `<select>` without shadcn styling**

- **Spec Reference:** US-T07 (admin shadcn semantic classes)
- **Severity:** HIGH | **Priority:** P1 | **Complexity:** Low (~15 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 5 (2026-03-08)

`apps/admin/src/components/table/DataTable.tsx:453-467` uses a native `<select>` for page size with minimal classes (`rounded border px-2 py-1`). Missing:
- `bg-background` / `text-foreground` (dark mode text is invisible on native selects)
- `border-input` (inconsistent border color)
- Focus ring styles

In dark mode, the native `<select>` renders with browser-default styling, making text potentially unreadable.

**Proposed Solution:** Replace with shadcn `Select` component or add full shadcn-compatible classes: `bg-background text-foreground border-input rounded focus-visible:ring-2 focus-visible:ring-ring`.

**Recommendation:** Fix directly. User-visible dark mode issue.

---

### Gap #14 (Audit 5) - NEW - NEEDS FIX

**Admin Badge.tsx success variant uses hardcoded green**

- **Spec Reference:** US-T07 (admin shadcn semantic classes)
- **Severity:** MEDIUM | **Priority:** P2 | **Complexity:** Trivial (~5 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 5 (2026-03-08)

`apps/admin/src/components/ui/badge.tsx:17` defines success variant as:
```tsx
success: 'border-transparent bg-green-100 text-green-800 hover:bg-green-200'
```

No dark mode variant. Other badge variants correctly use shadcn tokens (`bg-primary`, `bg-destructive`).

**Proposed Solution:** Change to `'border-transparent bg-success/10 text-success-foreground hover:bg-success/20'` or `'border-transparent bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800'`.

**Recommendation:** Fix directly. 1-line change.

---

### Gap #15 (Audit 5) - NEW - NEEDS FIX

**Admin hardcoded green/red colors across 10+ files**

- **Spec Reference:** US-T07 (admin shadcn semantic classes)
- **Severity:** MEDIUM | **Priority:** P2 | **Complexity:** Medium (~45 min)
- **Status:** OPEN - partially has dark: variants
- **First found:** Audit 5 (2026-03-08)

20+ instances of `bg-green-*`, `text-green-*`, `bg-red-*`, `text-red-*` across admin components. Most DO have `dark:` variants (e.g., `text-green-600 dark:text-green-400`), so they're functionally correct but inconsistent with the shadcn system.

**Affected files:**
- `components/icons/Icon.tsx:118,120` - `text-green-600`, `text-red-600` (NO dark variant)
- `routes/auth/change-password.tsx:78-99` - mixed green/red with dark variants
- `components/entity-form/navigation/SmartBreadcrumbs.tsx:59` - green with dark variant
- `components/entity-form/navigation/SmartNavigation.tsx:69,230,232,283` - green/red with dark variants
- `routes/_authed/accommodations/$id_.pricing.tsx:527` - green with dark variant
- `routes/_authed/posts/$id_.seo.tsx:62,89` - green with dark variant
- `routes/_authed/access/users/$id_.activity.tsx:129-130` - green with dark variant
- `components/entity-list/BulkOperationsToolbar.tsx:91` - red with dark variant
- `routes/_authed/analytics/debug.tsx:180` - green with dark variant
- `components/entity-list/examples/OptimisticEntityListExample.tsx:144,243` - red/green with dark variant

**Proposed Solutions:**
1. **(Recommended) Replace with semantic shadcn tokens** (`text-success`, `text-destructive`, `bg-success/10`, `bg-destructive/10`). Ensures consistency and automatic dark mode.
2. **Accept as-is** since most have dark: variants. Document as known debt.

**Recommendation:** Separate SPEC for comprehensive admin color cleanup. The 2 files WITHOUT dark variants (Icon.tsx) should be fixed directly as part of SPEC-022.

---

### Gap #16 (Audit 5) - NEW - NEEDS FIX

**Web ThemeToggle.astro hardcoded aria-label and title**

- **Spec Reference:** US-I04 (locale-aware), UX Considerations (preserve aria-labels, translate)
- **Severity:** HIGH | **Priority:** P1 | **Complexity:** Trivial (~5 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 5 (2026-03-08)

`apps/web/src/components/ui/ThemeToggle.astro:24-25`:
```html
aria-label="Toggle dark mode"
title="Toggle dark mode"
```

`title` is visible on hover to ALL users. Shows English regardless of locale. The spec's UX Considerations section says "All i18n migrations must preserve any existing aria-label attributes (translate their values, not remove them)."

**Proposed Solution:** Accept locale prop and use `t('ui.themeToggle.label')` for both aria-label and title.

**Recommendation:** Fix directly. 5-minute change.

---

### Gap #17 (Audit 5) - NEW - COSMETIC

**Web Footer.astro hardcoded social media aria-labels**

- **Spec Reference:** UX Considerations (translate aria-labels)
- **Severity:** LOW | **Priority:** P3 | **Complexity:** Trivial (~5 min)
- **Status:** OPEN - cosmetic
- **First found:** Audit 5 (2026-03-08)

Footer.astro lines 69, 72, 75: `aria-label="Instagram"`, `aria-label="Facebook"`, `aria-label="Youtube"`.

These are brand names (same in all languages), so arguably correct. However, a more accessible pattern would be `aria-label="${t('footer.social.instagram')}"` where the translation is "Visitar Instagram" / "Visit Instagram" / "Visitar Instagram".

**Recommendation:** Low priority. Consider fixing if touching Footer for other reasons.

---

### Gap #18 (Audit 5) - NEW - NEEDS FIX

**Web `client:load` used where `client:idle` or `client:visible` would suffice**

- **Spec Reference:** US-P07 (hero hydration, appropriate directives)
- **Severity:** LOW | **Priority:** P3 | **Complexity:** Low (~15 min)
- **Status:** OPEN - performance optimization
- **First found:** Audit 5 (2026-03-08)

Several `client:load` usages could be `client:idle` or `client:visible`:

| File | Component | Current | Suggested | Reason |
|------|-----------|---------|-----------|--------|
| BaseLayout.astro:104 | ToastContainer | `client:load` | `client:idle` | Toasts don't fire on page load |
| feedback.astro:115 | FeedbackForm | `client:load` | `client:idle` | Form doesn't need immediate hydration |

**Note:** Auth pages (signin, signup, etc.) correctly use `client:load` since forms must be immediately interactive. Account pages (editar, preferencias, suscripcion) also correctly use `client:load`.

**Recommendation:** Consider changing in a performance pass. Not blocking.

---

### Gap #19 (Audit 5) - NEW - NEEDS FIX

**Admin error boundaries with hardcoded aria-labels**

- **Spec Reference:** US-I01 (admin i18n completeness)
- **Severity:** MEDIUM | **Priority:** P2 | **Complexity:** Trivial (~10 min)
- **Status:** OPEN - needs fix
- **First found:** Audit 5 (2026-03-08)

3 error boundary components have hardcoded English aria-labels:
- `lib/error-boundaries/GlobalErrorBoundary.tsx:76` - `aria-label="Global error icon"`
- `lib/error-boundaries/QueryErrorBoundary.tsx:108` - `aria-label="Query error icon"`
- `lib/error-boundaries/EntityErrorBoundary.tsx:104` - `aria-label="Error icon"`

Plus 17 additional hardcoded aria-labels across admin components (ValidatedForm, ValidatedInput, GridCard, PageTabs, Sidebar, MobileMenu, Header, BooleanCell, SmartBreadcrumbs, VirtualizedEntityListPage, BaseLayout).

**Proposed Solution:** Use `t('common.aria.*')` translation keys for all aria-labels.

**Recommendation:** Fix directly as part of SPEC-022 admin i18n completion. The admin app uses `useTranslations()` everywhere else.

---

### Gap #20 (Audit 5) - NEW - COSMETIC

**Admin GalleryField.tsx dynamic Tailwind classes (broken pattern)**

- **Spec Reference:** Not directly in SPEC-022 (code quality)
- **Severity:** LOW | **Priority:** P3 | **Complexity:** Trivial (~5 min)
- **Status:** OPEN - code quality issue
- **First found:** Audit 5 (2026-03-08)

`apps/admin/src/components/entity-form/fields/GalleryField.tsx:310-311`:
```tsx
maxWidth && `max-w-[${maxWidth}px]`,
maxHeight && `max-h-[${maxHeight}px]`
```

Tailwind cannot compile dynamically generated class names. These classes are never applied.

**Proposed Solution:** Use inline styles instead:
```tsx
style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined, maxHeight: maxHeight ? `${maxHeight}px` : undefined }}
```

**Recommendation:** Fix directly. Bug regardless of SPEC-022.

---

## Items Previously Flagged as Gaps (Now Resolved)

### RESOLVED: Admin hardcoded 'es-AR' (was CRITICAL)
**Current status:** RESOLVED. Admin uses `@repo/i18n` via `format-helpers.ts`. Zero hardcoded `Intl.NumberFormat('es-AR')` calls remain.

### RESOLVED: CacheMonitor.tsx without i18n (was CRITICAL)
**Current status:** RESOLVED. Uses `useTranslations()` and `t()` calls.

### RESOLVED: Admin hardcoded strings in routes (was ~70 strings)
**Current status:** RESOLVED. All admin routes use `t('...')` calls.

### RESOLVED: Pluralization not implemented (was 0%)
**Current status:** RESOLVED. `pluralize()` in `@repo/i18n`, `tPlural` in web, used in 6+ components.

### RESOLVED: Web rgba() in Header/StickyNav (was 22 violations)
**Current status:** RESOLVED. Zero `rgba(` in web components.

### RESOLVED: bg-white without dark: in web (was 2 violations)
**Current status:** RESOLVED. Zero `bg-white` without `dark:` in web.

### RESOLVED: Admin bg-gray-*/text-gray-* violations
**Current status:** RESOLVED. Zero `bg-gray-` / `text-gray-` in admin.

---

## Performance Items (All Complete - Confirmed Audit 5)

| Item | Status | Evidence |
|------|--------|----------|
| US-P01: N+1 user.service | COMPLETE | `findAllWithCounts()` with correlated subqueries |
| US-P02: N+1 amenity/feature | COMPLETE | Batch `countAccommodationsByAmenityIds/FeatureIds()` |
| US-P03: Cache middleware | COMPLETE | Map-based, X-Cache HIT/MISS, TTL, FIFO eviction, config via env vars |
| US-P04: Users table indexes | COMPLETE | 8 indexes (5 individual + 2 composite + unique slug) |
| US-P05: Search index refresh | COMPLETE | `search-index-refresh.job.ts`, CONCURRENT, every 6h, 120s timeout |
| US-P06: Health check bypass | COMPLETE | Registered before middleware chain, selective skipAuth |
| US-P07: Hero hydration | COMPLETE | HeroSlideshow: `client:idle`, HeroSearchForm: `client:idle` |
| US-P08: Vite aliases | N/A BY DESIGN | Vite transpiles/treeshakes from src/ |

---

## Theming Items Status

| Item | Status | Gaps | Evidence |
|------|--------|------|----------|
| US-T01: Dark mode web components | PARTIAL | Gap #4, #10 | Undefined tokens cause broken rendering in 40+ files |
| US-T02: CSS variables dark coverage | PARTIAL | Gap #4, #9 | Missing token definitions; shadows need verification |
| US-T03: Z-index strategy | PARTIAL | Gap #11 | Tokens defined but 0% adoption |
| US-T04: Tailwind config strategy | COMPLETE | -- | Documented: separate design systems |
| US-T05: No !important | COMPLETE* | Gap #2 | Spec-excluded exceptions only |
| US-T06: No hex/rgba hardcoded | PARTIAL | Gap #1, #6, #10 | feedback.astro has 6 hardcoded hex values |
| US-T07: Admin shadcn classes | PARTIAL | Gap #12,13,14,15 | Several components bypass shadcn system |

---

## i18n Items Status

| Item | Status | Gaps | Evidence |
|------|--------|------|----------|
| US-I01: Admin i18n completeness | PARTIAL | Gap #19 | 20 hardcoded aria-labels in 15 files |
| US-I02: Admin language strategy | COMPLETE | -- | English base, documented |
| US-I03: Centralized formatting | COMPLETE | -- | `format-helpers.ts` wraps `@repo/i18n` |
| US-I04: 404/500 locale-aware | COMPLETE | -- | Dynamic locale detection |
| US-I05: Pluralization | COMPLETE | -- | `tPlural` used in 6+ components |

---

## Prioritized Action Plan

### P0 - Must fix before production (blocks spec completion)

| Gap | Fix | Effort | Impact |
|-----|-----|--------|--------|
| **#4** | Define missing CSS tokens in global.css + @theme | 30 min | 254+ usages in 40+ files rendered correctly |

### P1 - Should fix before production (user-visible issues)

| Gap | Fix | Effort | Impact |
|-----|-----|--------|--------|
| **#9** | Verify shadow dark mode (may be auto-resolved by oklch) | 15 min | 84 usages in 55 files |
| **#13** | Add shadcn classes to DataTable select | 15 min | Dark mode usability |
| **#16** | Translate ThemeToggle aria-label + title | 5 min | Visible on hover in all locales |

### P2 - Should fix (consistency and code quality)

| Gap | Fix | Effort | Impact |
|-----|-----|--------|--------|
| **#10** | Add prefers-color-scheme to feedback.astro | 20 min | Dark mode support |
| **#11** | Resolve z-index dual approach (tokens vs classes) | 20-45 min | Architecture clarity |
| **#12** | Replace BooleanCell green/red with shadcn | 10 min | Consistency |
| **#14** | Fix Badge success variant | 5 min | Dark mode |
| **#19** | Translate admin aria-labels | 10 min | Accessibility i18n |

### P3 - Nice to have (cosmetic or low impact)

| Gap | Fix | Effort | Impact |
|-----|-----|--------|--------|
| **#7** | Fix contacto.astro 2 strings + 3 aria-labels | 10 min | Minor i18n |
| **#8** | Fix bg-opacity-60 in GalleryCell | 5 min | Deprecated pattern |
| **#15** | Replace admin green/red with shadcn (10+ files) | 45 min | Consistency |
| **#17** | Translate Footer social aria-labels | 5 min | Cosmetic |
| **#18** | Change ToastContainer to client:idle | 5 min | Minor perf |
| **#20** | Fix GalleryField dynamic Tailwind classes | 5 min | Bug fix |

### Accepted Exceptions (no action needed)

| Gap | Reason |
|-----|--------|
| **#1** | Image overlays design-correct in both modes |
| **#2** | SVG/accessibility patterns excluded by spec |
| **#3** | Lightbox controls over images |
| **#6** | Dynamic star colors with CSS dark override |

---

## Estimated Total Effort

| Priority | Count | Total Effort |
|----------|-------|-------------|
| P0 | 1 gap | ~30 min |
| P1 | 3 gaps | ~35 min |
| P2 | 5 gaps | ~1.5 hours |
| P3 | 6 gaps | ~1.25 hours |
| **Total** | **15 actionable** | **~3.5 hours** |

---

## Recommendation: Fix Directly vs New SPEC

| Action | Gaps | Rationale |
|--------|------|-----------|
| **Fix directly (SPEC-022 completion)** | #4, #7, #8, #9, #10, #11, #12, #13, #14, #16, #18, #19, #20 | All are within SPEC-022 scope (theming, i18n, performance) and total ~2.5 hours |
| **New SPEC recommended** | #15 | Admin-wide green/red -> shadcn migration touches 10+ files and is a systematic refactor beyond SPEC-022's original scope |
| **Accept as-is** | #1, #2, #3, #5, #6, #17 | Design-correct exceptions, spec-excluded, or cosmetic with near-zero impact |

---

## Cross-Spec Delegation Check

| From Spec | Delegated to SPEC-022 | Status |
|-----------|----------------------|--------|
| SPEC-021 | i18n of billing admin pages | RESOLVED |
| SPEC-021 | Cache middleware (Web Cache API) | RESOLVED |
| SPEC-018 | Missing i18n keys for validation errors | RESOLVED |

**Gap #15 (admin green/red colors)** could be delegated to a future SPEC-039 or similar admin UI consistency spec.

---

## Final Verdict (Audit 5)

**SPEC-022 is NOT production-ready** due to Gap #4 (CRITICAL: 254+ undefined CSS token usages across 40+ files). This gap causes broken dark mode rendering on auth pages, account pages, search, contact, filters, and gallery components.

**After fixing Gap #4 (~30 min), SPEC-022 can be considered production-ready** with the remaining gaps being non-blocking (P1-P3 can be fixed post-launch without user impact).

**Recommended next steps:**
1. Fix Gap #4 immediately (P0)
2. Fix P1 gaps (#9, #13, #16) in same session
3. Fix remaining P2-P3 gaps before or shortly after launch
4. Create new spec for admin color system cleanup (#15)
