---
spec-id: SPEC-099
title: Home Page Audit Remediation
type: remediation
complexity: high
status: completed
created: 2026-05-07T00:00:00.000Z
completed: 2026-05-08T00:00:00.000Z
effort_estimate_hours: 32-48
tags: [web, home, ui, ux, a11y, i18n, performance, security, tokens, css]
branch: fix/home-audit-remediation
worktree: ../hospeda-home-audit
---

# SPEC-099: Home Page Audit Remediation

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Remediate 41 confirmed defects across security, correctness, accessibility, internationalization,
visual design, performance, theming, and CSS token usage on the public home page (`apps/web/src/pages/[lang]/index.astro`)
and the components it consumes.

**Motivation:**

- The home page is the single highest-traffic surface of the platform. Defects here have outsized impact
  on conversion, brand perception, accessibility compliance, and SEO across all three locales.
- A full audit (code review + visual review at 5 viewports + light/dark themes + 3 locales) surfaced
  4 blocker-level defects, several latent security risks (SSRF, XSS-adjacent), multiple WCAG 2.1 failures,
  and broad i18n / theming gaps.
- Each finding listed in this spec was **independently re-investigated against the live codebase** to
  confirm the diagnosis and propose a precise fix. False positives detected during re-investigation are
  documented in §3 (Out of Scope) so they are not silently re-introduced into future audits.

**Success Criteria:**

- All 41 confirmed defects in §4 closed and individually verified (visual diff or test).
- No new visual or functional regressions introduced (verified via design review at 4 viewports + dark mode + 3 locales).
- Zero hydration mismatches reported by React in production for the home page tree.
- Lighthouse mobile score for `/es/`, `/en/`, `/pt/` improves on LCP and CLS metrics relative to baseline captured before this work.
- CI passes (typecheck, biome, vitest, e2e relevant tests). Coverage target ≥90% for changed files where pure logic.

### 2. Target Users

- All anonymous and authenticated users who land on the home page in `es`, `en`, or `pt`, on mobile or desktop, in light or dark theme.
- Users with accessibility needs who depend on keyboard navigation, screen readers, or `prefers-reduced-motion`.
- Search engines (SEO) — page-level metadata title/description per locale.

### 3. Out of Scope (False Positives + Deferred)

The following items appeared in the original audit report but were **invalidated by re-investigation**.
They MUST NOT be fixed under this spec (and should not silently reappear in follow-up audits):

| Item | Original claim | Re-investigation outcome |
|---|---|---|
| **I-2** | Filter pill labels show Spanish names in EN/PT | False positive. `AccommodationTypeBadge` correctly resolves labels via `t('common.enums.accommodationType.*')`, keys exist in all 3 locales. If still seen at runtime, root cause is namespace loader, not the home page. |
| **I-9** | Filter pills active state distinguished only by color (WCAG 1.4.1) | False positive on this surface. Pills on the home are **anchor links** to `/alojamientos/tipo/{type}/`, not toggleable filter chips. No active state to fix here. The same concern may apply to the listing page filter chips — handled separately. |
| **V-3 (scroll mechanism)** | Filter pills row has no horizontal scroll on mobile | False positive. `FeaturedAccommodationsSection.astro:112-127` already implements `overflow-x: auto`, scroll-snap, hidden scrollbar, and a mask-image fade. Only the **scroll affordance** (fade gradient is too subtle at 3%) needs improvement — see V-3' in §4. |
| **P-11** | Brushstroke decorative SVG in CtaOwners barely visible in dark mode | Cannot be fixed via CSS. Brushstrokes are baked into the PNG `feature-3-1.png`. Requires asset re-export or a separate dark-mode PNG. **Deferred** until verified visually in dark mode (panel uses `--brand-tertiary` which barely shifts between themes). Not a code fix. |
| **P-12** | Footer trust-badges row word-breaks "Soporte lo / cal" on mobile | False positive. No such row exists in `apps/web/src/layouts/Footer.astro` (907 LOC scanned, zero matches). Audit was likely against a Figma reference that was never implemented. |

**Also deferred (not a defect, requires product decision):**

- **CategoryTiles imagery (V-2):** The 7 placeholder gradients are blocking but require **marketing-supplied imagery** for cabins, hotels, houses, music, culture, gastronomy, posts. Spec includes the wiring task; the asset sourcing is a parallel work-stream owned by marketing.
- **Bridge icon (P-9):** Replacing the 🌉 emoji in `DestinationsMap` requires a product decision on icon style (generic "Path" vs. illustrated bridge silhouette evocative of the Concepción del Uruguay International Bridge). Spec lists the task; design owns the visual.

### 4. Findings Catalog (Confirmed Defects)

All file paths refer to the actual code locations as of `main @ 2e7858af4`. **Note:** components live under `apps/web/src/components/sections/`, not `components/home/` (an earlier audit error).

---

#### B — BLOCKERS (4 items)

##### **B-1. Hydration mismatch in `@repo/feedback` FAB causes blank page on PT mobile**

- **Files:** `packages/feedback/src/components/FeedbackFAB.tsx:317-318`, `packages/feedback/src/components/FeedbackModal.tsx:88-92`
- **Root cause:** Two distinct mismatches, both site-wide (not PT-specific):
  1. FAB renders the modal via `typeof document !== 'undefined' ? createPortal(...) : modalContent` — server inlines the dialog; client portals it to `document.body`. React sees a structural mismatch on every page, every locale.
  2. `useState(() => typeof window === 'undefined' ? false : window.innerWidth < MOBILE_BREAKPOINT)` produces server=`false` / client=`true` at <768px, so the drag handle renders on client only.
- The PT-mobile blank symptom is a **downstream** failure: the hydration error rolls back the island, and a separate (suspected) missing PT translation key inside the feedback form throws on render.
- **Fix direction:** Gate both the portal and the `isMobile`-derived markup behind a `useEffect`-set `mounted` boolean (return `null` server-side, render after mount). Do **not** use `suppressHydrationWarning` — it hides the warning but the structural diff still costs hydration time. After fixing structural mismatch, capture the actual PT-mobile console error to confirm the i18n key culprit.
- **Acceptance:**
  - No React hydration warning in console on any locale at any viewport.
  - PT mobile renders the full home page below the navbar.

##### **B-2. Feedback FAB occludes "Buscar" submit and CTA Owners button on mobile**

- **Files:** `packages/feedback/src/components/FeedbackFAB.css:32-36`, `apps/web/src/components/sections/SearchBar.module.css:500-506`
- **Root cause:** FAB is `position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 2147483646`. SearchBar mobile submit is full-width in the document flow with no isolated stacking context. FAB visually overlaps the right portion of the submit at 375-414px. Same conflict on the CTA Owners panel button.
- **Fix direction:** Add a `@media (max-width: 768px)` override in `FeedbackFAB.css` raising `bottom` so the FAB clears both the search submit AND the cookie banner. Keep the high z-index — the FAB is intentionally above all surfaces. Affects admin app too (single fix, both apps benefit).
- **Acceptance:**
  - Search submit fully visible and tappable at 375px and 414px.
  - CTA Owners "Publicá tu alojamiento" button fully visible and tappable at the same viewports.
  - FAB still tappable, not pushed off-screen by combined offsets.

##### **B-3. Horizontal overflow at 375 / 768 / 320 px (PARTIAL — needs visual confirmation)**

- **Files:** `apps/web/src/styles/global.css:280,291` (html/body `overflow-x: clip`), `apps/web/src/styles/components.css:35` (section `overflow: clip`), candidate culprits in `HeroSection.astro:408`, `AboutUsSection.astro:198`, `components.css:527` (`destination-carousel-wrapper`).
- **Root cause:** Body and sections already use `overflow-x: clip`, so there is **no visible horizontal scrollbar**. The reported 99/13/151px overflow is `scrollWidth` minus `innerWidth`, which `overflow-x: clip` does not flatten in measurement. This is most likely a **measurement artifact**, not a perceptible defect. Likely contributors to the artifact: `.hero__visual { width: 480px }` on the base rule, `.about-us__collage { width: 432px }` base, and `destination-carousel-wrapper`'s edge-bleed math.
- **Fix direction:** Live-verify in DevTools at 375/768/320 whether the page actually scrolls horizontally:
  - **If it does:** add `word-wrap: break-word; hyphens: auto` on `.hero__title`, audit floating-icon visibility at intermediate breakpoints, narrow `.hero__visual` base width.
  - **If it does not:** document the metric as a clip-related artifact and update the audit tooling to measure visible overflow only (`scrollWidth > innerWidth && getComputedStyle(html).overflowX !== 'clip'`).
- **Acceptance:** No visible horizontal scroll at 320, 375, 414, 768, 1024, 1280, 1920 px viewports.

##### **B-4. SearchBar `role="button"` panels do not respond to Space key (WCAG 2.1.1)**

- **File:** `apps/web/src/components/sections/SearchBar.client.tsx` lines 291, 329, 367, 399
- **Root cause:** All four column triggers are `<div role="button" tabIndex={0}>` with `onKeyDown={(e) => e.key === 'Enter' && togglePanel(...)}`. ARIA Authoring Practices require both `Enter` and `Space` for `role="button"`. Pressing Space currently scrolls the page.
- **Fix direction:** Two options.
  - **Option A (cheap):** Add `e.key === ' '` plus `e.preventDefault()` to each handler.
  - **Option B (correct, more invasive):** Replace each `<div role="button">` with `<button type="button">` and flatten nested `<div class="icon">` / `<div class="content">` into `<span>` so they are valid HTML inside `<button>`. Mind the `type="button"` to avoid form-submit semantics.
- **Recommendation:** Ship Option A in this spec (quick win). File a follow-up for Option B as part of a broader SearchBar refactor.
- **Acceptance:** Pressing Space on any of the 4 column triggers opens the corresponding panel without scrolling the page.

---

#### S — SECURITY & CORRECTNESS (11 items, 1 false-positive-but-fix-recommended)

##### **S-1. SSRF vector via build-time `getImage()` on unvalidated remote URLs (CONFIRMED)**

- **Files:** `apps/web/src/components/sections/DestinationsSection.astro:51-64`, `LatestArticlesSection.astro:35-48`, `TestimonialsSection.astro:42-55`. Astro config at `apps/web/astro.config.mjs:86-102` defines `image.remotePatterns` with 7 hostnames.
- **Root cause:** `getImage({ src: img })` is called with arbitrary URLs from API responses (avatar URLs, post images). `remotePatterns` gates the runtime image service but build-time `getImage` may fetch the URL to read dimensions/format. User-controllable avatar URLs in the DB are a potential SSRF vector during builds.
- **Fix direction:** Add `apps/web/src/lib/media.ts::isAllowedRemoteHost(url)` mirroring the `remotePatterns` allowlist (extract hostnames into a single source-of-truth constant, share between `astro.config.mjs` and the helper). Skip `getImage` and fall back to original URL when host is not in allowlist.
- **Acceptance:** Test that an allowed host calls `getImage`, a non-allowed host bypasses it. Unit test in `apps/web/test/lib/media.test.ts`.

##### **S-2. `averageRating.toFixed(1)` guard insufficient (PARTIAL)**

- **File:** `apps/web/src/pages/[lang]/index.astro:70` and surrounding social-proof guard.
- **Root cause:** Schema (`packages/schemas/src/entities/stats/public-stats-summary.schema.ts:43-46`) types `averageRating` as `z.number().min(0).max(5)`, never NaN at boundary. **However**, the current guard `reviewsCount > 0` is a different condition than `averageRating > 0`: aggregated review count includes destination reviews while `averageRating` is accommodation-only. So `reviewsCount > 0 && averageRating === 0` is a real case that renders "0.0/5".
- **Fix direction:** Tighten guard to `reviewsCount > 0 && Number.isFinite(averageRating) && averageRating > 0`. Defense-in-depth.
- **Acceptance:** Hero social-proof block hidden when `averageRating === 0` even if `reviewsCount > 0`. Snapshot or unit test on the page-level guard.

##### **S-3. `AnimatedCounter` hardcodes `'es-AR'` locale (CONFIRMED)**

- **Files:** `apps/web/src/components/sections/AnimatedCounter.client.tsx:25`, `StatsSection.astro:17,71-78`
- **Root cause:** `n.toLocaleString('es-AR')` ignores the user's locale. `StatsSection.astro` has `locale` available and other components already use `toBcp47Locale(locale)` from `@repo/i18n` (see `lib/format-utils.ts:15`).
- **Fix direction:** Add `locale: SupportedLocale` prop to `AnimatedCounter`, replace hardcoded with `new Intl.NumberFormat(toBcp47Locale(locale)).format(n)`. Pass `locale={locale}` from each `<AnimatedCounter>` call site.
- **Acceptance:** Numbers in EN render with thousands separator `,`, in ES/PT with `.`.

##### **S-4. TestimonialsCarousel uses Embla private API `internalEngine().slideRegistry` (CONFIRMED)**

- **File:** `apps/web/src/components/sections/TestimonialsCarousel.client.tsx:119` (used by `isActiveSlide`)
- **Root cause:** `internalEngine()` is documented private; can break on any minor version. Used to identify the active slide group with `slidesToScroll: 2`.
- **Fix direction:** Replace with public `mainApi.slidesInView()` or `selectedScrollSnap()` + arithmetic. With `loop:true`, test against current `embla-carousel-react` version for cloned-slide handling.
- **Acceptance:** Replace usage; behavior unchanged (active slide opacity / aria-hidden still works).

##### **S-5. `canScrollPrev/Next` state with `loop: true` is dead state (CONFIRMED)**

- **File:** `TestimonialsCarousel.client.tsx:76-78, 85, 97-98, 161, 215`
- **Root cause:** With `loop: true`, both Embla methods always return `true`. The `disabled` state never activates. State updates churn renders for nothing. ARIA `disabled` is also incorrect (always false but tracked).
- **Fix direction:** Drop the two `useState` declarations, the `setCan*` calls inside `onSelect`, and the `disabled` props on the IconButtons.
- **Acceptance:** Carousel arrows render and behave identically; no state churn.

##### **S-6. `StatsSection` resize listener leaks + no debounce (CONFIRMED)**

- **File:** `apps/web/src/components/sections/StatsSection.astro:99-198`
- **Root cause:** Inline `<script>` registers `window.addEventListener('resize', initWave)` with no cleanup. With `<ClientRouter />` enabled in `BaseLayout.astro`, the script re-runs on each visit, accumulating listeners. `initWave` does heavy work (~2000 path samples + per-card rect queries) on every resize tick.
- **Fix direction:** Wrap registration inside `astro:page-load`; clean up via `astro:before-swap`. Debounce ~150ms. Consider `ResizeObserver` on the section element instead. Pattern already used in `BaseLayout.astro:282`.
- **Acceptance:** Repeated SPA navigation does not multiply listeners (DevTools event listeners panel verification). Resize is smooth without jank.

##### **S-7. `lang` from `Astro.params` instead of `Astro.locals.locale` (CONFIRMED)**

- **File:** `apps/web/src/pages/[lang]/index.astro:32-33`
- **Root cause:** Cast `lang as SupportedLocale` bypasses the middleware-validated locale. Most pages use `Astro.locals.locale` (verified in `[lang]/busqueda/index.astro`, `alojamientos/[slug].astro`, `mapa.astro`, etc.). 3 legacy pages still use `Astro.params.lang ?? 'es'` (suscriptores/turistas, suscriptores/planes, guest/messages/verify-expired).
- **Fix direction:** Replace with `const locale = Astro.locals.locale as SupportedLocale`. Validate `Astro.locals.locale` is populated during `prerender = true` (middleware should still run). Fix the 3 stragglers in a follow-up sweep, not in this spec.
- **Acceptance:** Type-check clean; runtime page renders correctly in all 3 locales.

##### **S-8. Section comment numbering out of order (CONFIRMED)**

- **File:** `apps/web/src/pages/[lang]/index.astro:137-172`
- **Root cause:** Comments `5` (About Us, line 156, should be 6), `8` (CTA Owners, line 162, should be 8 but appears before 7), `7` (Testimonials, line 165, should be 9). Visual order in DOM: Hero, Featured, CategoryTiles, Destinations, NextEvents, AboutUs, LatestArticles, CtaOwners, Testimonials, Stats, Partners → 1..11.
- **Fix direction:** Renumber 1..11 to match DOM render order.
- **Acceptance:** Comments match render order; trivial.

##### **S-9. `title`/`description` meta hardcoded in Spanish (CONFIRMED)**

- **File:** `apps/web/src/pages/[lang]/index.astro:133-134`
- **Root cause:** `title="Inicio"` and Spanish description hardcoded. `home.title` and `home.description` keys exist in `packages/i18n/src/locales/es/home.json:2-3`. Need to verify EN and PT carry equivalents.
- **Fix direction:** Replace with `t('home.title')` / `t('home.description')`. Add to en/pt if missing. Note: existing `home.title` value is "Alojamientos en Entre Ríos", not "Inicio" — reconcile with product before shipping.
- **Acceptance:** Tab titles localized correctly; SEO snippets match locale.

##### **S-10. Cast pattern `raw as Record<string, unknown>` in 5 sections (CONFIRMED)**

- **Files:** `FeaturedAccommodationsSection.astro:42`, `DestinationsSection.astro:43`, `NextEventsSection.astro:41`, `LatestArticlesSection.astro:34`, `TestimonialsSection.astro:34`. Transform definitions in `apps/web/src/lib/api/transforms.ts`.
- **Root cause:** Transform signatures accept `{ item: Record<string, unknown> }` while API returns properly-typed `XPublic`. Sections widen to satisfy untyped transforms.
- **Fix direction:** Type each transform's `item` parameter as the corresponding `*Public` type from `@repo/schemas`. Drop the casts in 5 sections. Sweep for any other consumer (listing pages, related-content cards) and update accordingly.
- **Acceptance:** Type-check clean; existing transform tests pass.

##### **S-11. Zero tests on critical home islands (CONFIRMED)**

- **Files affected:** `DestinationsIsland.client.tsx` (411 LOC, untested), `TestimonialsCarousel.client.tsx` (249 LOC, untested), `AnimatedCounter.client.tsx` (211 LOC, untested), `HostLandingCta.client.tsx` (untested), `SearchBar.client.tsx` (only `buildSearchUrl` pure-function tested).
- **Fix direction:** Add 3 highest-leverage tests in this spec (defer the rest):
  1. `AnimatedCounter.test.tsx`: mock `IntersectionObserver`, assert text transitions from "0" to formatted final value with locale.
  2. `TestimonialsCarousel.test.tsx`: render with 6 reviews, assert dot count, click next button calls `scrollNext`, hover stops autoplay.
  3. `SearchBar.test.tsx` (extend): RTL-rendered panel cases — opening destinations panel, filtering list, building URL on submit.
- **Acceptance:** 3 new test files passing; coverage uplift visible in report.

---

#### V — VISUAL / UI (10 items)

##### **V-1. Hero subtitle visual artifact on mobile (PARTIAL)**

- **File:** `apps/web/src/components/sections/HeroSection.astro:316-324` (subtitle), `:310-313` (title `line-height: 0.896, letter-spacing: -0.02em`)
- **Root cause:** No explicit `overflow:hidden` rule on the subtitle. Likely artifact: descender clipping from the title's tight `line-height: 0.896` bleeding into the description's top margin at small sizes. There's no width constraint actually clipping the subtitle at <480px.
- **Fix direction:** Confirm the artifact in DevTools at 375/414. Then either (a) bump `.hero__title { line-height: 1.0 }` at <=640px, or (b) add `padding-bottom: 4px` on `.hero__title` for that breakpoint. Add `overflow-wrap: anywhere; line-height: 1.5` to the description explicitly.
- **Acceptance:** Subtitle fully visible at 375 and 414 with no glyph clipping.

##### **V-2. CategoryTiles missing per-tile imagery (CONFIRMED)**

- **Files:** `apps/web/src/pages/[lang]/index.astro:92-128` (data array), `apps/web/src/components/CategoryTiles.astro:72-74` (gradient fallback)
- **Root cause:** Data array provides only `title`, `description`, `href`. `image` and `icon` props absent → component renders gradient placeholders. Tile categories: cabins, hotels, houses, music, culture, gastronomy, posts (artículos).
- **Fix direction:** Source 7 marketing-approved images, place under `apps/web/public/assets/images/categories/{slug}.{webp|jpg}`, pass via the data array. **Marketing must approve imagery before merge.**
- **Acceptance:** All 7 tiles render real images at all viewports and themes.

##### **V-3'. Filter pills mobile scroll affordance too subtle (CONFIRMED — affordance only)**

- **File:** `apps/web/src/components/sections/FeaturedAccommodationsSection.astro:112-127`
- **Root cause:** Mask gradient stops at 97%, only 3% wide → invisible on small viewports. Scrollbar is also hidden.
- **Fix direction:** Widen right-fade mask stop to ~88%. Add `padding-inline-end: 1rem` so last pill never sits flush against the edge. Optional: subtle right-edge chevron indicator that fades when scrolled to end.
- **Acceptance:** Visible fade on right edge at 375/414/768; pill row scrolls smoothly with snap.

##### **V-4. Empty states bare across 3 sections (CONFIRMED)**

- **Files:** `FeaturedAccommodationsSection.astro:81-85`, `NextEventsSection.astro:72-75`, `LatestArticlesSection.astro:71-74`. Shared `EmptyState.astro` exists at `apps/web/src/components/shared/feedback/EmptyState.astro` but is **not used** by these sections.
- **Fix direction:** Replace inline `.section__empty-state` with `<EmptyState>` invocation including: thematic icon (BedIcon / CalendarIcon / ArticleIcon), localized message, CTA to broader listing/search. Extend `EmptyState.astro` with `tone` prop (`muted | warm | brand`) and custom-icon slot if not already present. Add `home.{section}.emptyAction` keys to es/en/pt; consider a single shared `home.emptyState.cta` key.
- **Acceptance:** Each section's empty state shows icon + message + CTA. Visual review at 4 viewports.

##### **V-5. Cookie banner consumes ~30-40% of mobile viewport (CONFIRMED)**

- **File:** `apps/web/src/components/legal/CookieConsentBanner.module.css`
- **Root cause:** `<768px` `.inner` is `flex-direction: column` with 16px gap. Title + description + 3-button row stacks vertically → ~200-220px tall. iOS bottom safe-area + chrome reduce visible viewport further.
- **Fix direction:** Compact mobile bottom-sheet variant: `.inner` row at <768px, hide `.title` at <640px, single-line truncated `.description` with `-webkit-line-clamp: 2`, render only "Aceptar" + "Personalizar" by default (move "Rechazar" to customize panel), reduce button padding to `6px 12px` and height to 32px at <640px. Target compact height ~76-88px.
- **Acceptance:** Banner ≤96px tall at 375/414; search bar fully visible above the banner on first paint.

##### **V-6. Footer copyright clipped by Scroll-To-Top button (CONFIRMED)**

- **Files:** `apps/web/src/components/shared/navigation/ScrollToTop.astro:73-76,141-148`, `apps/web/src/layouts/Footer.astro:705-715`
- **Root cause:** ScrollToTop fixed at `bottom: 4rem; right: 1rem` on mobile (40x40px). Footer `.footer__bottom-inner` has no end-padding to clear it.
- **Fix direction:** Add `@media (max-width: 768px) { .footer__bottom-inner { padding-inline-end: 3.5rem; } }`. Optional: hide ScrollToTop when footer is mostly in view via IntersectionObserver. Coordinate with cookie-banner offset adjustment from V-5.
- **Acceptance:** Copyright fully readable at 375/414 with ScrollToTop visible.

##### **V-7. Newsletter input promises WhatsApp on email-typed unwired field (CONFIRMED)**

- **Files:** `packages/i18n/src/locales/{es,en,pt}/footer.json` (key `footer.newsletterPlaceholder`), `apps/web/src/layouts/Footer.astro:231-254` (form `data-prevent-submit`).
- **Root cause:** Placeholder advertises "Tu email o WhatsApp" but `<input type="email">` rejects non-emails. Form is wired to nothing (`event.preventDefault()` only). Misleading.
- **Fix direction (recommended):** Drop WhatsApp from copy. Update placeholder to "Tu correo electrónico" / "Your email" / "Seu e-mail". Wire form when newsletter endpoint exists (out of scope here). Rename i18n key to `footer.newsletterEmailPlaceholder` to make the change explicit.
- **Acceptance:** Placeholder text matches input type; copy reviewed by marketing.

##### **V-8. Dark mode contrast issues (filter pills + category tiles) (CONFIRMED)**

- **Files:** `apps/web/src/styles/global.css:189-256` (dark block), `apps/web/src/lib/colors.ts:202-211` (`getAccommodationTypeColorSolid`), `apps/web/src/components/CategoryTiles.astro:93` (`--surface-warm`), `apps/web/src/components/shared/ui/AccommodationTypeBadge.astro`.
- **Root cause:** No `--surface-elevated` token in dark block. `--core-card` (oklch 0.19) is **darker** than `--surface-warm` (oklch 0.20) so tiles recede instead of elevate. Pill colors computed from light-mode formulas land at low contrast on the dark page.
- **Fix direction:** (a) Add `--surface-elevated: oklch(0.24 0.025 220)` in dark block. Apply to `.category-tiles__tile`. (b) Branch `getAccommodationTypeColorSolid` on `[data-theme="dark"]`: clamp `bg` luminance ≥0.55, `text` to near-black. Easiest path: CSS-only via `oklch(from var(--acc-type-bg) ...)`. (c) Add a 1px theme-aware outline on `.acc-type-badge` in dark.
- **Acceptance:** Visual review confirms cards visibly elevated in dark; pill text contrast ≥4.5:1; pill border defined.

##### **V-9. About Us heading wraps to 3 lines on tablet 768 (CONFIRMED)**

- **File:** `apps/web/src/components/sections/AboutUsSection.astro:336-344`
- **Root cause:** `font-size: clamp(2rem, 4vw, 3rem)` resolves to `2rem` at 768px. Title is 57+ chars. Layout is already centered single-column at this breakpoint. Result: 3 lines.
- **Fix direction:** Tighten clamp lower bound: `clamp(1.5rem, 3.5vw + 0.25rem, 3rem)` (resolves ~31px at 768). Add `text-wrap: balance`. Optionally `max-width: 18ch`. Consider a shorter ES title via i18n if still 3 lines.
- **Acceptance:** Heading ≤2 lines at 768; balanced line-break distribution.

##### **V-10. "Ver todos" CTAs use two different styles (CONFIRMED)**

- **Files:** `FeaturedAccommodationsSection.astro:62-63` (passes to `SectionHeader.astro:83-102` which renders inline `<a class="section-header__action">`), `LatestArticlesSection.astro:101-109,162-167` (uses `<GradientButton variant="primary" icon="true">` separately).
- **Root cause:** Two different button shapes (filled-pill vs. outline-pill+arrow), two placements (inline-header vs. centered-below), two content densities. Design-system primitive `GradientButton` is canonical; `SectionHeader.section-header__action` is a duplicated one-off.
- **Fix direction:** Refactor `SectionHeader` to defer to `GradientButton` (e.g. `<GradientButton href={actionHref} label={actionLabel} variant="outline-primary" size="sm" icon="true" />`). Sweep all section consumers (Featured, NextEvents, Destinations, LatestArticles, others).
- **Acceptance:** All "Ver todos" CTAs across the home use the same component, same variant, same placement.

---

#### I — i18n / A11y / TOKENS (8 items, 2 false positives moved to §3)

##### **I-1. `home.categoryTiles.*` keys missing in all 3 locale files (CONFIRMED)**

- **Files:** `packages/i18n/src/locales/{es,en,pt}/home.json` (no `categoryTiles` block), `apps/web/src/pages/[lang]/index.astro:147` (`t("home.categoryTiles.sectionTagline", "Para cada gusto")`).
- **Root cause:** Keys do not exist; fallback string "Para cada gusto" renders for all locales including `/en/`. Same for `sectionTitle` and `tiles.*.{title,description}`.
- **Fix direction:** Add a `categoryTiles` block under each `home.json` with `sectionTitle`, `sectionTagline`, `tiles.{cabins,hotels,houses,music,culture,gastronomy,posts}.{title,description}` translated for es/en/pt.
- **Acceptance:** `/en/` and `/pt/` show translated eyebrow and tile copy.

##### **I-3. Empty-state typos: `proximos` / `articulos` without tildes (CONFIRMED)**

- **File:** `packages/i18n/src/locales/es/home.json:60` (`upcomingEvents.emptyState`), `:69` (`latestPosts.emptyState`).
- **Fix direction:** Replace with `próximos` and `artículos`. EN and PT already correct.
- **Acceptance:** ES strings show correct accented characters.

##### **I-4. Three hero images share single alt key (CONFIRMED)**

- **Files:** `HeroSection.astro:104-108`, `packages/i18n/src/locales/{es,en,pt}/home.json`.
- **Root cause:** All three (playa/atardecer/isla) use `t('home.hero.imageAlt', '<fallback>')`. Once the canonical key exists, fallbacks differ but resolution returns the same string.
- **Fix direction:** Use `home.hero.imageAlt.playa`, `home.hero.imageAlt.atardecer`, `home.hero.imageAlt.isla`. Add to all 3 locales.
- **Acceptance:** Each rotated image has a distinct, accurate alt.

##### **I-5. SearchBar shows "Cargando..." when destinations are simply empty (CONFIRMED)**

- **File:** `apps/web/src/components/sections/SearchBar.client.tsx:502-509`
- **Root cause:** Uses `t('home.searchBar.loadingText', 'Cargando...')` for the empty case. Data is fetched at build time so by hydration it is final, not "loading".
- **Fix direction:** Add `home.searchBar.noDestinationsText` key to es/en/pt. Render that when list is empty. Keep `loadingText` only if a future async loading state needs it (otherwise remove).
- **Acceptance:** Empty list shows "No hay destinos disponibles" / equivalent.

##### **I-6. `var(--border)` legacy alias in StatsSection (CONFIRMED)**

- **File:** `apps/web/src/components/sections/StatsSection.astro:334`
- **Root cause:** `--border` is a Shadcn-era unprefixed alias defined in `global.css:30`. Style-guide prohibits these aliases (`--primary`, `--accent`, `--background`, `--border` etc.).
- **Fix direction (small scope):** Replace local usage with `oklch(from var(--core-muted-foreground) l c h / 0.3)` to keep the muted dashed-wave aesthetic across themes.
- **Out of scope:** Repo-wide deprecation of `--border` (would also touch `* { border-color: var(--border) }` reset). File a follow-up.
- **Acceptance:** Dashed wave remains visually unchanged; no `var(--border)` reference in the file.

##### **I-7. `var(--radius-organic)` deprecated token in CategoryTiles (CONFIRMED)**

- **File:** `apps/web/src/components/CategoryTiles.astro:186`
- **Root cause:** Token deprecated by style guide. Fallback `0px 100px` is invalid border-radius shorthand (renders elliptical TL only). Tile top-corner intent is asymmetric round.
- **Fix direction:** Replace with `border-radius: var(--radius-card) var(--radius-card) 0 0;` (uniform card radius on top, flat bottom). If asymmetric blob is product intent, document exception and use explicit values.
- **Acceptance:** Tile radii match the style-guide pattern; visual review confirms no regression.

##### **I-8. `prefers-reduced-motion` ignored in HeroImageRotator and AnimatedCounter (CONFIRMED)**

- **Files:** `HeroImageRotator.client.tsx:57-69` (5s setInterval), `AnimatedCounter.client.tsx:98-141` (RAF count-up).
- **Root cause:** Neither checks `matchMedia('(prefers-reduced-motion: reduce)')`. CSS keyframes elsewhere already do.
- **Fix direction:** Add a shared hook `apps/web/src/hooks/useReducedMotion.ts` (or `lib/use-reduced-motion.ts` to match flat layout). HeroImageRotator: short-circuit interval, freeze on first image. AnimatedCounter: set final value immediately on mount.
- **Acceptance:** With OS reduced-motion enabled: hero rotator does not animate; counters snap to final value.

##### **I-10. SearchBar focus appearance below WCAG 2.4.13 threshold (PARTIAL)**

- **Files:** `apps/web/src/styles/global.css:273-277` (global `:focus-visible`), `apps/web/src/components/sections/SearchBar.module.css:106,200,251,282,463`.
- **Root cause:** Global rule applies 2px outline using `--brand-primary` (oklch 0.63). Marginal at 4.5:1 against white card. WCAG 2.4.13 (focus appearance v2) wants thicker / higher contrast.
- **Fix direction:** Add `.col:focus-visible { outline: 3px solid var(--brand-accent); outline-offset: 3px; }` to make column focus distinct. Optionally bump global ring to 3px and use `--brand-accent` for hue contrast.
- **Acceptance:** Focus ring visible and ≥3px on each search column when tabbing.

---

#### P — PERFORMANCE / NITS (9 items, 2 false positives moved to §3)

##### **P-1. SearchBar `client:load` ships react-day-picker bundle above the fold (CONFIRMED)**

- **Files:** `apps/web/src/components/sections/SearchBar.client.tsx` (701 LOC; imports react-day-picker + 3 locales + style.css at top level), `HeroSection.astro:204-209` (mounts with `client:load`).
- **Root cause:** Calendar JSX renders only when `activePanel === 'dates'` but the module is statically imported. Above-the-fold bundle includes react-day-picker.
- **Fix direction:** Extract calendar block into `SearchBarCalendar.client.tsx`. Lazy-load via `React.lazy(() => import('./SearchBarCalendar.client'))` + `<Suspense fallback={null}>` only when dates panel opens. Keep `client:load` on the form shell. Optionally `<link rel="modulepreload">` on hover.
- **Acceptance:** Hero JS bundle reduced by 30-80KB; calendar fetches on first dates-panel open without UX regression.

##### **P-2. Hero LCP image lacks responsive srcset (CONFIRMED)**

- **Files:** `HeroSection.astro:63-67,102-110`, `HeroImageRotator.client.tsx:81-95`
- **Root cause:** `getImage({ src, width: 800 })` produces single fixed-width WebP. `<img>` has no `srcset` / `sizes`. Mobile (375@2x = 750 target) downloads same 800w as desktop.
- **Fix direction:** Build srcset with widths `[480, 800, 1200]`, set `sizes="(max-width: 768px) 100vw, 50vw"`. Add `fetchpriority="high"` on the active image. Update HeroImageRotator props to accept `srcset`/`sizes`.
- **Acceptance:** Mobile downloads ~480w variant; LCP improves on Lighthouse mobile.

##### **P-3. Partner logos missing `width` → CLS (CONFIRMED)**

- **File:** `apps/web/src/components/sections/PartnersSection.astro` lines 58-64, 67-74, 89-95, 98-105.
- **Root cause:** `height="60"` only. CSS `width: auto` lets logos inflate as they decode.
- **Fix direction:** Add `aspectRatio: number` to PartnerData type and the data file; render `style="aspect-ratio: ${ratio}"` plus `width={Math.round(60 * ratio)}`. Marquee duplicates the track — both copies must use the same widths.
- **Acceptance:** No CLS contribution from partners section.

##### **P-4. `aria-hidden="false"` redundant in DestinationsIsland (CONFIRMED)**

- **File:** `DestinationsIsland.client.tsx:170`
- **Fix direction:** Delete the attribute.
- **Acceptance:** Attribute gone; no a11y regression.

##### **P-5. `any` with ineffective `biome-ignore` in CategoryTiles (CONFIRMED)**

- **File:** `apps/web/src/components/CategoryTiles.astro:23-24`
- **Root cause:** `readonly icon?: any` with biome-ignore. CLAUDE.md notes this suppression doesn't apply to type members.
- **Fix direction:** Type as `import type { ComponentType } from 'react'; import type { IconProps } from '@repo/icons';` → `readonly icon?: ComponentType<IconProps>;`. Remove biome-ignore.
- **Acceptance:** Type-check clean; no `any`.

##### **P-6. Stale "Inter Regular" Figma comment in AboutUsSection (CONFIRMED)**

- **File:** `AboutUsSection.astro:346`
- **Fix direction:** Delete or rewrite to reference `var(--font-sans)` (Roboto).
- **Acceptance:** No misleading font references.

##### **P-7. Inconsistent `path:` form in `buildUrl` calls (CONFIRMED)**

- **Files:** `DestinationsIsland.client.tsx:163` (`'destinos'`), `LatestArticlesSection.astro:104` (`'publicaciones'`).
- **Root cause:** Some calls use `'/destinos/'`, others `'destinos'`. `buildUrl` normalizes, but the inconsistency is a trap.
- **Fix direction:** Normalize to `'/destinos/'` and `'/publicaciones/'`. Optional sweep across the repo for stragglers.
- **Acceptance:** All home-page `buildUrl({ path })` calls use leading + trailing slash.

##### **P-9. `🌉` emoji bridge marker in DestinationsMap (CONFIRMED)**

- **File:** `apps/web/src/components/sections/DestinationsMap.tsx:265`
- **Root cause:** Emoji renders inconsistently across OS/browsers. Bridge represents the Concepción del Uruguay International Bridge — strong cultural significance, generic icon would weaken meaning.
- **Fix direction:** Add a custom `BridgeIcon` to `@repo/icons` (small inline SVG of bridge silhouette, ~24x24). Replace the emoji span with `<BridgeIcon size={...} />`. **Design must approve the icon style.**
- **Acceptance:** Bridge marker renders identically on Windows/macOS/Linux/iOS/Android.

##### **P-10. 20 ASCII-banner section comments in SearchBar (CONFIRMED)**

- **File:** `SearchBar.client.tsx` (lines 31, 33, 56, 58, 89, 91, 169, 178, 200, 215, 221, 242, 249, 262, 268, 430, 461, 513, 597, 631).
- **Fix direction:** Replace banner blocks with single-line `// section name` comments. Drops ~60 LOC of visual noise.
- **Acceptance:** File reads cleaner; line count reflects only meaningful code.

---

### 5. Phased Implementation Plan

Order minimizes risk, batches related concerns, and front-loads bug fixes that gate downstream work.

#### **Phase 0 — Pre-flight (0.5 day)**
- Confirm dev tooling: dev server runs, vitest+RTL setup verified for islands, Playwright reachable.
- Capture **baseline screenshots** at 4 viewports × light/dark × 3 locales (24 images) for diff comparison after each phase.
- Capture baseline Lighthouse mobile scores (LCP, CLS) for `/es/`, `/en/`, `/pt/`.

#### **Phase 1 — Blockers (1.5 days)**
- B-1, B-2, B-3 (verify+fix), B-4.
- Why first: hydration mismatch and FAB occlusion are user-visible, accessibility-critical, and gate any visual reviewer's ability to do their job (a blank PT mobile page invalidates downstream visual checks).

#### **Phase 2 — Security & Correctness (1 day)**
- S-1, S-2, S-3, S-4, S-5, S-6, S-7, S-8.
- Why second: low UI risk, high latent risk reduction. Done before invasive UI work to keep diff focused.

#### **Phase 3 — i18n & A11y (1 day)**
- I-1, I-3, I-4, I-5, I-6, I-7, I-8, I-10, S-9.
- Why grouped: all touch i18n loader and reduced-motion / focus tokens. Atomic block.

#### **Phase 4 — Visual / UI cleanups (2 days)**
- V-1 (after DevTools confirmation), V-3' (affordance), V-4 (shared EmptyState), V-5 (compact cookie banner), V-6 (footer copyright clearance), V-7 (newsletter copy), V-8 (dark surfaces), V-9 (About heading), V-10 (CTA standardization via SectionHeader refactor).

#### **Phase 5 — Performance & nits (1 day)**
- P-1 (lazy date picker), P-2 (responsive hero), P-3 (partner logos CLS), P-4, P-5, P-6, P-7, P-10. (P-9 deferred until icon designed.)

#### **Phase 6 — Asset-dependent (parallel, blocked on marketing/design)**
- V-2 (CategoryTiles imagery — 7 marketing images required).
- P-9 (BridgeIcon — design approval required).
- Can land independently after Phase 5.

#### **Phase 7 — Tests (0.5 day)**
- S-11 (3 highest-leverage tests).
- Final phase so tests assert post-fix behavior.

#### **Phase 8 — S-10 cast cleanup (0.5 day, optional within this spec)**
- Type transforms properly. May be split into a separate spec if blast radius extends to listing pages.

### 6. Acceptance Criteria (Spec-Level)

1. All 41 confirmed findings (4 B + 11 S + 10 V + 8 I + 8 P) closed individually with evidence (test, screenshot, or DevTools verification).
2. Visual review at 4 viewports (375, 768, 1280, 1920) × light + dark × 3 locales: no regression vs. baseline outside the items being changed.
3. CI green: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:web` (or equivalent web-app suite).
4. Coverage report: 3 new test files for S-11 add net positive coverage; no drop on changed files.
5. Lighthouse mobile (post Phase 5): LCP improves vs. baseline on `/es/`; CLS not worsened.
6. No `var(--border)` or `var(--radius-organic)` references remain in changed files.
7. No raw `ilike()` introduced (per repo policy).
8. No `console.log` introduced; logger via `@repo/logger` only.
9. Each change committed atomically following Conventional Commits.

### 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Fixing FAB position breaks admin app layout | Verify in admin app at the same viewports before merging. |
| Compact cookie banner hides legal-required info | Coordinate with legal to confirm "Personalizar" panel can carry the deferred details. |
| Reduced-motion hook exists elsewhere and we duplicate it | Search `apps/web/src/{hooks,lib}` and `packages/` for `useReducedMotion` / `prefers-reduced-motion` before adding. |
| `Astro.locals.locale` not populated during prerender | Validate in dev and in `pnpm build`; fallback to `Astro.params.lang` validated through i18n helper if needed. |
| `--surface-elevated` token addition cascades to other tiles | Apply only to `.category-tiles__tile` initially. Broader rollout in a follow-up theming spec. |
| Embla `slidesInView()` returns clones with `loop:true` in current package version | Pin a unit test against the actual installed version; fall back to `selectedScrollSnap()` arithmetic if needed. |
| SearchBar lazy-load chunk fetch on first dates-click is slow on poor networks | Pre-warm via `<link rel="modulepreload">` on hover or `requestIdleCallback`. |
| `transforms.ts` type tightening (S-10) ripples beyond home consumers | Spike the change first; if blast radius >5 files outside home, split S-10 into its own spec. |

### 8. Deferred / Follow-up Items

These are **not** in scope for SPEC-099 but should be filed as separate tickets:

1. SearchBar `<div role="button">` → native `<button>` refactor (B-4 Option B).
2. Repo-wide deprecation of `--border` and other Shadcn-era unprefixed aliases.
3. Investigation of listing page (`/alojamientos/`) filter chip active state (WCAG 1.4.1 — moved out of scope from I-9).
4. Newsletter form backend wiring + WhatsApp channel (or final removal).
5. Three legacy pages still using `Astro.params.lang ?? 'es'` (S-7 stragglers).
6. Brushstroke dark-mode visual (P-11) — re-test after Phase 4 dark surface fixes; if still problematic, asset re-export.
7. Test coverage for `DestinationsIsland`, `HostLandingCta`, broader SearchBar interactions (S-11 deferred tests).

---

## Part 2 — Technical Notes

### Worktree
- **Branch:** `fix/home-audit-remediation`
- **Path:** `/home/qazuor/projects/WEBS/hospeda-home-audit`
- **Created from:** `main @ 2e7858af4`

### Path Correction
Earlier audit reports referenced `apps/web/src/components/home/`. The **actual** location is `apps/web/src/components/sections/`, with `CategoryTiles.astro` and `EmptyState.astro` at non-`sections/` locations:
- `apps/web/src/components/CategoryTiles.astro`
- `apps/web/src/components/shared/feedback/EmptyState.astro`

### Testing Setup Reference
- Vitest + jsdom + @testing-library/react already wired (verified via `apps/web/test/components/` existing islands).
- IntersectionObserver may need polyfill in `apps/web/vitest.config.ts` setup file — confirm before writing AnimatedCounter test.
- Embla mock pattern: stub the `mainApi` object with deterministic methods.

### Commit Discipline
- One Conventional Commit per finding (or per tightly-coupled finding cluster, e.g. all i18n key additions).
- Stage files individually (CLAUDE.md rule). Never `git add -A` or `git add .`.
- No "Co-Authored-By" trailers (CLAUDE.md rule).
