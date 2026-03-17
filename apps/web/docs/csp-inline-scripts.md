# CSP Inline Scripts Inventory

This document catalogs all `<script>` tags in `apps/web/src/` and describes how each one is handled under the Content Security Policy.

## Astro Script Processing

Astro processes `<script>` tags in two ways:

- **Bundled scripts** (default `<script>` without `is:inline`): Astro bundles, minifies, and deduplicates these at build time. They are served as external files via `<script type="module" src="...">` tags, which are CSP-compatible under `script-src 'self'`.
- **Inline scripts** (`<script is:inline>`): Rendered directly into the HTML output as inline `<script>` blocks. These require either `'unsafe-inline'` or a hash/nonce in the CSP `script-src` directive.
- **JSON-LD scripts** (`<script type="application/ld+json">`): Data-only, not executable. Not subject to CSP `script-src` restrictions.

## Current CSP Mode

The web app currently uses `Content-Security-Policy-Report-Only` (Phase 1). The `script-src` directive includes `'strict-dynamic' 'unsafe-inline'`. When a nonce or hash is added in Phase 2, `'unsafe-inline'` will be ignored by CSP2+ browsers (it serves as a CSP1 fallback).

---

## Script Inventory

### Inline Scripts (`is:inline`) -- Require CSP hash or unsafe-inline

| File | Line | Purpose | CSP Handling |
|------|------|---------|--------------|
| `src/layouts/BaseLayout.astro` | 84 | **FOUC prevention for dark mode.** Reads `localStorage` and sets `data-theme="dark"` before first paint to prevent flash of unstyled content. Must run synchronously before any rendering. | `is:inline` -- requires `'unsafe-inline'` or hash. Critical for UX. |
| `src/layouts/BaseLayout.astro` | 119 | **Scroll reveal observer.** Initializes an `IntersectionObserver` for `.scroll-reveal` elements. Uses `is:inline` to run after DOM is parsed, respects `prefers-reduced-motion`. | `is:inline` -- requires `'unsafe-inline'` or hash. |

### Bundled Scripts (default) -- Served as external files, CSP-compatible

| File | Line | Purpose | CSP Handling |
|------|------|---------|--------------|
| `src/layouts/Header.astro` | 161 | **Navbar scroll behavior.** Handles sticky navbar, scroll-based opacity changes for logo text, and hero-specific transparency logic. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/layouts/Footer.astro` | 116 | **Newsletter form handler.** Handles newsletter subscription form submission via fetch, shows success/error messages. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/components/destination/LitoralMap.astro` | 312 | **Interactive SVG map.** Handles hover tooltips, click navigation, and keyboard accessibility for the litoral region map. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/components/destination/DestinationCarousel.astro` | 116 | **Carousel navigation.** Touch/swipe support, keyboard navigation, and scroll-snap controls for destination image carousel. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/components/destination/DestinationPreview.astro` | 156 | **Map preview popup.** Calculates positioning for destination preview popups on the map component. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/components/sections/HeroSection.astro` | 103 | **Hero scroll effects.** Hides hero fixed elements (badges, indicators) when user scrolls past the hero viewport. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/components/shared/AccordionFAQ.astro` | 127 | **Accordion exclusivity.** Ensures only one accordion panel is open at a time within `[data-accordion]` sections. Re-scans DOM on `astro:page-load`. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/components/shared/NavigationProgress.astro` | 20 | **Navigation progress bar.** Shows a thin progress bar during page transitions using `astro:before-preparation` and `astro:after-swap` events. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/components/shared/SortDropdown.astro` | 57 | **Sort dropdown handler.** Navigates to a new URL when the sort dropdown value changes. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/components/ui/ThemeToggle.astro` | 70 | **Theme toggle button.** Synchronizes the toggle button icon with the current theme, persists preference to `localStorage`. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/pages/500.astro` | 169 | **Retry button handler.** Adds click listener to the retry button that reloads the page on the 500 error page. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/pages/[lang]/auth/forgot-password.astro` | 44 | **Forgot password form.** Handles forgot-password form submission via the Better Auth API. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |
| `src/pages/[lang]/mi-cuenta/index.astro` | 352 | **Dashboard stats loader.** Fetches user stats (favorites, reviews, plan) from the protected API and updates dashboard counters. | Bundled by Astro into external module. Compatible with `script-src 'self'`. |

### JSON-LD Scripts (data-only) -- Not subject to script-src

| File | Line | Purpose | CSP Handling |
|------|------|---------|--------------|
| `src/components/seo/JsonLd.astro` | 22 | **Generic JSON-LD structured data.** Renders any JSON-LD schema (Organization, WebSite, etc.) using `set:html`. | `type="application/ld+json"` -- data-only, not executable. Not affected by CSP `script-src`. |
| `src/components/shared/Breadcrumb.astro` | 114 | **Breadcrumb JSON-LD.** Renders BreadcrumbList structured data for SEO. | `type="application/ld+json"` -- data-only, not executable. Not affected by CSP `script-src`. |
| `src/pages/[lang]/propietarios/index.astro` | 96 | **FAQ JSON-LD.** Renders FAQPage structured data for the owners landing page. | `type="application/ld+json"` -- data-only, not executable. Not affected by CSP `script-src`. |

---

## Phase 2 Migration Notes

When moving from `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy`:

1. **Bundled scripts**: No changes needed. They are external files served from the same origin.
2. **JSON-LD scripts**: No changes needed. They are data-only and not subject to `script-src`.
3. **`is:inline` scripts** (2 scripts in BaseLayout.astro): These are the only scripts that need attention. Options:
   - **Hash-based CSP**: Compute SHA-256 hashes of the inline script content and add them to `script-src` (e.g., `'sha256-...'`). This is the most secure approach but requires updating the hash when the script content changes.
   - **Nonce-based CSP**: Astro's experimental CSP support can inject nonces into inline scripts automatically. This requires enabling `experimental.csp` in `astro.config.mjs`.
   - **Keep `'unsafe-inline'`**: Least secure but simplest. Not recommended for Phase 2.

The FOUC prevention script is particularly critical -- it must run synchronously before any rendering to avoid visible theme flashing. Any CSP solution must preserve this timing.
