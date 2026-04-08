# SPEC-065: Figma to Code — Homepage Production Migration

## Progress: 0/66 tasks (0%)

**Average Complexity:** 2.7/4
**Critical Path:** T-001 → T-002 → T-003 → T-028 → T-029 → [T-059] → T-060 → T-061 → T-065 → T-066 (10 steps)
**Parallel Tracks:** 6 tracks identified (tokens, i18n, API client, component renames, Embla upgrade, independent sections)

---

### Setup Phase (Phase 0)

- [ ] **T-001** (complexity: 1) - Rename CSS tokens in global.css (brand prefix)
  - Rename 6 brand-prefixed tokens (`--primary`, `--secondary`, etc.) in `:root` block only. Do NOT update references.
  - Blocked by: none
  - Blocks: T-002, T-003

- [ ] **T-002** (complexity: 1) - Rename CSS tokens in global.css (core prefix)
  - Rename 4 core tokens (`--foreground`, `--background`, `--card`, `--muted-foreground`) in `:root` block.
  - Blocked by: T-001
  - Blocks: T-003

- [ ] **T-003** (complexity: 3) - Update all CSS token references across web2 codebase
  - Search-replace all old token `var()` references across all `.astro`, `.tsx`, `.ts`, `.css` files in `apps/web2/src/`.
  - Blocked by: T-001, T-002
  - Blocks: T-008, T-009, T-010, T-011, T-012, T-013

- [ ] **T-004** (complexity: 2) - Add missing i18n keys to home.json for all locales (part 1: hero + accommodations)
  - Add `home.hero.tagline`, `home.hero.secondaryCta`, `home.hero.imageAlt`, `home.featuredAccommodations.emptyState`, `home.featuredAccommodations.noReviews` to es/en/pt.
  - Blocked by: none
  - Blocks: T-009, T-014

- [ ] **T-005** (complexity: 2) - Add missing i18n keys to home.json for all locales (part 2: destinations + events + articles)
  - Add `home.featuredDestinations.ariaLabel`, `home.featuredDestinations.emptyState`, `home.upcomingEvents.emptyState`, `home.latestPosts.emptyState` to es/en/pt.
  - Blocked by: none
  - Blocks: T-015, T-016, T-017, T-020

- [ ] **T-006** (complexity: 2) - Migrate ownerCta i18n keys from flat to nested structure and add missing keys
  - Remove 6 flat keys, add 6 nested keys (`feature1.title`, `feature1.description`, etc.) in all 3 locales.
  - Blocked by: none
  - Blocks: T-011

- [ ] **T-007** (complexity: 2) - Add missing i18n keys to common.json and footer.json for all locales
  - Add 4 carousel/nav keys to common.json and 2 newsletter keys to footer.json in all 3 locales.
  - Blocked by: none
  - Blocks: T-013, T-021, T-022, T-024, T-025

- [ ] **T-008** (complexity: 1) - Upgrade embla-carousel-react and embla-carousel-autoplay to ^8.6.0
  - Version bump in package.json + `pnpm install` + verify compilation and existing tests.
  - Blocked by: none
  - Blocks: T-020, T-021

- [ ] **T-009** (complexity: 3) - Create API client types.ts and client.ts
  - Create `ApiResult<T>`, `ApiError`, `PaginationMeta`, `PaginatedResponse<T>` types, and `apiFetch<T>` wrapper with AbortController timeout.
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-010** (complexity: 3) - Create API client endpoints.ts
  - Implement typed methods: `accommodationsApi.list()`, `destinationsApi.list()`, `eventsApi.listUpcoming()`, `postsApi.list()` using `apiFetch`.
  - Blocked by: T-009
  - Blocks: T-011

- [ ] **T-011** (complexity: 3) - Create API client transforms.ts
  - Implement 4 transform functions mapping API response shapes to card component props. Create barrel `index.ts`.
  - Blocked by: T-009, T-010
  - Blocks: T-014, T-015, T-016, T-017

- [ ] **T-012** (complexity: 3) - Rename SPEC-048 section components per mapping table
  - Rename 6 section `.astro` files, update all import statements, delete `FeaturesCtaSection.astro`.
  - Blocked by: none
  - Blocks: T-014, T-015, T-016, T-017, T-018, T-019, T-020, T-021, T-022

- [ ] **T-013** (complexity: 3) - Rename SPEC-048 React island files per mapping table
  - Rename 3 island `.tsx` files and `.module.css` files, convert `DestinationCard.tsx` to Astro, delete obsolete files.
  - Blocked by: none
  - Blocks: T-020, T-021, T-022

- [ ] **T-014** (complexity: 2) - Update src/data/types.ts with complete card prop types
  - Add missing fields to existing card types, add `ArticleCardBaseProps` interface.
  - Blocked by: T-012
  - Blocks: T-016, T-027, T-028, T-029

- [ ] **T-058** (complexity: 2) - Add global focus ring and CSS layer organization to global.css
  - Add `:focus-visible` global rule, organize into `@layer` blocks, add `scroll-behavior: smooth`.
  - Blocked by: T-003
  - Blocks: (none — feeds into T-062 audit)

---

### Core Phase (Phase 1 — Header, Hero, Layout)

- [ ] **T-015** (complexity: 3) - Implement Header.astro sticky scroll-transparency behavior
  - Add scroll sentinel div + IntersectionObserver to toggle `.scrolled` class with backdrop-filter.
  - Blocked by: T-003
  - Blocks: T-016

- [ ] **T-016** (complexity: 3) - Implement Header.astro responsive layout (desktop/tablet/mobile)
  - 3-tier responsive layout: desktop full nav, tablet condensed, mobile hamburger. Add skip link.
  - Blocked by: T-015
  - Blocks: T-023

- [ ] **T-017** (complexity: 3) - Implement Header.astro smooth-scroll for homepage anchors
  - Conditional anchor `href`: section IDs on homepage, full URLs on other pages.
  - Blocked by: T-016
  - Blocks: none

- [ ] **T-018** (complexity: 4) - Implement HeroSection.astro two-column layout and text stack
  - Two-column grid (60/40), tagline, h1 with word-span markup, description, social proof row.
  - Blocked by: T-003, T-004
  - Blocks: T-019

- [ ] **T-019** (complexity: 4) - Implement HeroSection.astro blob image with crossfade and parallax
  - SVG blob mask, 3 crossfading images, parallax script, floating icon animations, reduced-motion guards.
  - Blocked by: T-018
  - Blocks: none

- [ ] **T-020** (complexity: 3) - Implement HeroSection.astro staggered title animation
  - Wrap title words in indexed spans, `fadeInUp` keyframe with `calc(N * 150ms)` delays, reduced-motion check.
  - Blocked by: T-018
  - Blocks: none

- [ ] **T-021** (complexity: 3) - Implement HeroSection.astro hero mobile layout
  - Stack vertically below 768px, reduce title font-size, hide blob decorative shapes, full-width CTA.
  - Blocked by: T-018
  - Blocks: none

- [ ] **T-022** (complexity: 3) - Implement AboutUsSection.astro photo collage and text column
  - CSS Grid photo collage (3-4 images, `grid-row/column` spans), text column with h2 and CTA.
  - Blocked by: T-003
  - Blocks: T-023

- [ ] **T-023** (complexity: 2) - Add floating animations to AboutUsSection.astro airplane illustrations
  - Add decorative airplane `<img aria-hidden>` elements with `float-airplane` keyframe, staggered delays.
  - Blocked by: T-022
  - Blocks: none

- [ ] **T-024** (complexity: 3) - Implement CtaOwnersSection.astro layout and feature list
  - Two-column layout, 3-item feature list with `@repo/icons` icons and `aria-label`, gradient CTA button.
  - Blocked by: T-003, T-006
  - Blocks: T-025

- [ ] **T-025** (complexity: 2) - Add floating animation to CtaOwnersSection.astro left image
  - `float-cta-image` keyframe, reduced-motion check, appropriate alt/aria-hidden on image.
  - Blocked by: T-024
  - Blocks: none

- [ ] **T-026** (complexity: 3) - Implement StatsSection.astro desktop 5-column grid layout
  - 5-column grid, 5 icons from `@repo/icons`, static numeric values from config, semi-opaque scrim.
  - Blocked by: T-003
  - Blocks: T-038

- [ ] **T-027** (complexity: 3) - Add mobile 2x2 layout to StatsSection.astro
  - `grid-cols-2` below 1024px, 5th card `grid-column: 1 / -1` centered on 3rd row.
  - Blocked by: T-026
  - Blocks: none

- [ ] **T-028** (complexity: 3) - Implement Footer.astro 4-column grid and navigation
  - 4-column grid (logo+social, DESCUBRI, PROPIETARIOS, EMPRESA), hover states, mobile stacked layout.
  - Blocked by: T-003
  - Blocks: T-029

- [ ] **T-029** (complexity: 3) - Add newsletter strip and copyright bar to Footer.astro
  - Newsletter strip above grid (NewsletterForm island placeholder), copyright bar with `new Date().getFullYear()`.
  - Blocked by: T-028
  - Blocks: T-041

- [ ] **T-057** (complexity: 3) - Implement ScrollToTop.astro floating button with progress ring
  - Fixed button with SVG `stroke-dashoffset` progress ring, show/hide at 300px threshold, reduced-motion.
  - Blocked by: T-007
  - Blocks: none

---

### Core Phase (Phase 2 — Content Sections and Cards)

- [ ] **T-030** (complexity: 3) - Implement FeaturedAccommodationsSection.astro layout and data fetching
  - 3-column grid, API call with fallback to static data, transform with `toAccommodationCardProps()`, empty state.
  - Blocked by: T-011, T-012
  - Blocks: T-031, T-035

- [ ] **T-031** (complexity: 3) - Implement AccommodationCard.astro with all visual states
  - Blob-masked image, type badge, rating stars, amenity strip (aria-labels), featured badge, hover CSS states.
  - Blocked by: T-030
  - Blocks: none

- [ ] **T-032** (complexity: 2) - Add loading skeleton states to FeaturedAccommodationsSection.astro
  - Create `SkeletonCard.astro` with shimmer animation, matching card dimensions, reduced-motion disable.
  - Blocked by: T-031
  - Blocks: none

- [ ] **T-033** (complexity: 3) - Implement NextEventsSection.astro layout and data fetching
  - 2-column grid, API call with fallback, transform with `toEventCardProps()`, empty state.
  - Blocked by: T-011, T-012, T-005
  - Blocks: T-034

- [ ] **T-034** (complexity: 3) - Update EventCard.astro with category icons and destination links
  - Category-to-icon mapping, `<time datetime>`, destination link, hover states.
  - Blocked by: T-033
  - Blocks: none

- [ ] **T-035** (complexity: 3) - Create article-card-utils.ts with shared article card logic
  - `truncateTags()`, `truncateExcerpt()`, `resolveRelatedEntity()`, `isPromoted()`, `formatArticleDate()`.
  - Blocked by: T-014
  - Blocks: T-036, T-037, T-038

- [ ] **T-036** (complexity: 3) - Create FeaturedArticleCard.astro (horizontal-large variant)
  - Horizontal layout (image left, content right), 2-column span, promoted badge, related entity link.
  - Blocked by: T-035
  - Blocks: T-039

- [ ] **T-037** (complexity: 3) - Create VerticalArticleCard.astro (vertical-tall variant)
  - Vertical layout (image top), 2-row span, no excerpt, gradient image fallback.
  - Blocked by: T-035
  - Blocks: T-039

- [ ] **T-038** (complexity: 3) - Create CompactArticleCard.astro (text-only variant)
  - Text-only, tags with '+N' badge, background-tint hover, arrow shift animation.
  - Blocked by: T-035
  - Blocks: T-039

- [ ] **T-039** (complexity: 4) - Implement LatestArticlesSection.astro bento grid and data fetching
  - CSS Grid named areas (bento), 4-slot card variant dispatch, API call with fallback, mobile single-column.
  - Blocked by: T-036, T-037, T-038, T-011, T-005
  - Blocks: none

- [ ] **T-040** (complexity: 3) - Implement PartnersSection.astro with Embla autoplay carousel
  - Embla continuous-scroll carousel, grayscale-on-default → color-on-hover logos, external link handling.
  - Blocked by: T-008, T-012
  - Blocks: none

- [ ] **T-045** (complexity: 4) - Implement DestinationsSection.astro layout and SVG map
  - Two-column layout, SVG province outline, `<button>` destination pins with aria-labels, topographic overlay.
  - Blocked by: T-011, T-012, T-005
  - Blocks: T-046

- [ ] **T-048** (complexity: 3) - Implement TestimonialsSection.astro layout and TestimonialCard.astro
  - Two-region layout (30/70), TestimonialCard with initials avatar fallback and rating ARIA.
  - Blocked by: T-012
  - Blocks: T-049

---

### Integration Phase (Phase 3 — React Islands)

- [ ] **T-041** (complexity: 3) - Implement FilterChips.client.tsx React island
  - Chip toggle state, `aria-pressed`, client-side filtering, keyboard Enter/Space, focus ring.
  - Blocked by: T-031, T-007
  - Blocks: none

- [ ] **T-042** (complexity: 3) - Implement HeroSearchBar.client.tsx — type select and destination select fields
  - Pill container, 2 `<select>` fields with floating labels, vertical dividers, module CSS.
  - Blocked by: T-018
  - Blocks: T-043

- [ ] **T-043** (complexity: 3) - Implement HeroSearchBar.client.tsx — date range field and guest counter dropdown
  - Date range inputs, guest counter popover (Adults/Children), min validation.
  - Blocked by: T-042
  - Blocks: T-044

- [ ] **T-044** (complexity: 3) - Implement HeroSearchBar.client.tsx — search button and mobile dialog drawer
  - Search `<a>` button, mobile trigger, `<dialog>` drawer with showModal(), slide-down close animation.
  - Blocked by: T-043
  - Blocks: none

- [ ] **T-046** (complexity: 3) - Implement DestinationsCarousel.client.tsx Embla carousel base
  - 3-card visible config, blur + mask on adjacent cards, navigation arrows with aria-labels, edge-case handling.
  - Blocked by: T-008, T-013, T-045, T-007
  - Blocks: T-047

- [ ] **T-047** (complexity: 4) - Implement DestinationsCarousel.client.tsx map-pin bidirectional sync
  - Pin click → `emblaApi.scrollTo()`, carousel scroll → active pin highlight, pulse animation.
  - Blocked by: T-046
  - Blocks: none

- [ ] **T-049** (complexity: 3) - Implement TestimonialsCarousel.client.tsx with autoplay and pagination dots
  - 3-card Embla, autoplay 5s with pause on hover, resume after 8s inactivity, pagination dots with scrollTo.
  - Blocked by: T-048, T-008, T-013
  - Blocks: none

- [ ] **T-050** (complexity: 3) - Implement AnimatedCounter.client.tsx with IntersectionObserver
  - Count-up via rAF with ease-out, IntersectionObserver trigger, suffix append, reduced-motion instant display.
  - Blocked by: T-026, T-013
  - Blocks: none

- [ ] **T-051** (complexity: 2) - Wire AnimatedCounter into StatsSection.astro
  - Replace static numeric slots with `<AnimatedCounter client:visible>` per stat card.
  - Blocked by: T-026, T-050
  - Blocks: none

- [ ] **T-052** (complexity: 3) - Implement NewsletterForm.client.tsx with email validation
  - Email input + submit, inline error message on invalid, disable button on valid (no API call yet).
  - Blocked by: T-007
  - Blocks: none

- [ ] **T-053** (complexity: 3) - Implement MobileMenu.client.tsx full-screen overlay
  - `<dialog>` with showModal(), slide-in animation, scroll lock, nav links list, ESC close.
  - Blocked by: T-013, T-007
  - Blocks: T-054

- [ ] **T-054** (complexity: 2) - Wire MobileMenu island into Header.astro
  - Replace hamburger placeholder with `<MobileMenu client:idle>`, pass locale and navLinks.
  - Blocked by: T-053, T-016
  - Blocks: none

- [ ] **T-055** (complexity: 2) - Wire HeroSearchBar island into HeroSection.astro
  - Replace search bar placeholder with `<HeroSearchBar client:idle>`, pass types and destinations.
  - Blocked by: T-044, T-018
  - Blocks: none

- [ ] **T-056** (complexity: 2) - Wire FilterChips and DestinationsCarousel islands into their sections
  - Wire FilterChips into FeaturedAccommodationsSection, DestinationsCarousel into DestinationsSection.
  - Blocked by: T-041, T-047, T-030, T-045
  - Blocks: none

---

### Testing Phase (Phase 4 — QA, Accessibility, Performance)

- [ ] **T-059** (complexity: 2) - Responsive QA at xs and sm breakpoints (320px, 640px)
  - Snapshot tests at 320px and 640px; verify hero stacking, 1-column grids, no overflow-x.
  - Blocked by: T-021, T-027, T-030, T-033, T-039, T-040, T-028
  - Blocks: T-060

- [ ] **T-060** (complexity: 2) - Responsive QA at md and lg breakpoints (768px, 1024px)
  - Snapshot tests at 768px and 1024px; verify 2-column events, 3-column accommodations, 5-column stats.
  - Blocked by: T-059
  - Blocks: T-061

- [ ] **T-061** (complexity: 2) - Responsive QA at xl and 2xl breakpoints (1440px, 2560px)
  - Snapshot at 1440px vs Figma reference; verify `max-width: 1440px` container at 2560px.
  - Blocked by: T-060
  - Blocks: T-065

- [ ] **T-062** (complexity: 3) - Accessibility audit — keyboard navigation and focus rings
  - axe-core scan + Tab order verification + focus ring audit across all interactive elements.
  - Blocked by: T-058, T-054, T-056, T-057
  - Blocks: T-063

- [ ] **T-063** (complexity: 3) - Accessibility audit — screen reader and ARIA
  - Audit rating star ARIA, amenity labels, decorative alt, carousel aria-live, heading hierarchy.
  - Blocked by: T-062
  - Blocks: T-064

- [ ] **T-064** (complexity: 3) - Accessibility audit — contrast ratios
  - WCAG AA check (4.5:1 normal, 3:1 large) for stats gradient, muted text, footer text, badges.
  - Blocked by: T-063
  - Blocks: T-065

- [ ] **T-065** (complexity: 3) - Lighthouse performance audit and CLS verification
  - Mobile 3G Lighthouse (target: Perf >= 90, A11y >= 95), CLS < 0.1, image attributes audit.
  - Blocked by: T-061, T-064
  - Blocks: T-066

- [ ] **T-066** (complexity: 2) - Cross-browser testing on Chrome, Firefox, Safari, Edge
  - Verify blob mask, OKLCH, color-mix, :has(), dialog, @layer, Embla swipe across 4 browsers.
  - Blocked by: T-065
  - Blocks: none

---

## Dependency Graph

**Level 0 (no blockers):** T-001, T-004, T-005, T-006, T-007, T-008, T-009, T-012, T-013

**Level 1 (blocked by Level 0 only):** T-002 (←T-001), T-010 (←T-009), T-014 (←T-012)

**Level 2:** T-003 (←T-001,T-002), T-011 (←T-009,T-010)

**Level 3:** T-015 (←T-003), T-022 (←T-003), T-024 (←T-003,T-006), T-026 (←T-003), T-028 (←T-003), T-030 (←T-011,T-012), T-033 (←T-011,T-012,T-005), T-035 (←T-014), T-040 (←T-008,T-012), T-045 (←T-011,T-012,T-005), T-048 (←T-012), T-052 (←T-007), T-057 (←T-007), T-058 (←T-003)

**Level 4:** T-016 (←T-015), T-018 (←T-003,T-004), T-023 (←T-022), T-025 (←T-024), T-027 (←T-026), T-029 (←T-028), T-031 (←T-030), T-034 (←T-033), T-036 (←T-035), T-037 (←T-035), T-038 (←T-035), T-046 (←T-045,T-008,T-013,T-007), T-049 (←T-048,T-008,T-013)

**Level 5:** T-017 (←T-016), T-019 (←T-018), T-020 (←T-018), T-021 (←T-018), T-032 (←T-031), T-039 (←T-036,T-037,T-038,T-011,T-005), T-041 (←T-031,T-007), T-042 (←T-018), T-047 (←T-046), T-050 (←T-026,T-013), T-053 (←T-013,T-007)

**Level 6:** T-043 (←T-042), T-051 (←T-026,T-050), T-054 (←T-053,T-016)

**Level 7:** T-044 (←T-043), T-055 (←T-044,T-018), T-056 (←T-041,T-047,T-030,T-045)

**Level 8 (QA gate):** T-059 (←T-021,T-027,T-030,T-033,T-039,T-040,T-028)

**Level 9:** T-060 (←T-059), T-062 (←T-058,T-054,T-056,T-057)

**Level 10:** T-061 (←T-060), T-063 (←T-062)

**Level 11:** T-064 (←T-063), T-065 (←T-061,T-064)

**Level 12:** T-066 (←T-065)

---

## Parallel Tracks

**Track A — CSS Tokens (serial, must run first):** T-001 → T-002 → T-003
**Track B — i18n (all parallel):** T-004, T-005, T-006, T-007 (can all run simultaneously)
**Track C — API Client (serial chain):** T-009 → T-010 → T-011
**Track D — Component Renames (parallel):** T-012, T-013 (can run in parallel)
**Track E — Embla Upgrade (independent):** T-008
**Track F — Type Update:** T-014 (after T-012)

After all Level 0-2 tasks complete, 6+ parallel tracks open up simultaneously.

---

## Suggested Start

Begin with **T-001** (complexity: 1) - Rename CSS tokens in global.css (brand prefix)

This is the root of the critical dependency chain. While T-001 and T-002 are in progress, immediately also start the fully-independent parallel tracks: T-004, T-005, T-006, T-007 (i18n additions), T-008 (Embla upgrade), T-009 (API client types), T-012 (section renames), and T-013 (island renames). These have zero dependencies and can all proceed in parallel.

The most constrained path is through CSS tokens (T-001→T-002→T-003), which gates the majority of Phase 1 work.
