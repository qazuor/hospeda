# SPEC-030: Web Pages Migration (web-old to web)

## Overview

Migrate all remaining pages and supporting components from `apps/web-old` to `apps/web`, adapting them to the new visual identity defined in `apps/web/STYLE_GUIDE.md`, Tailwind CSS v4 semantic tokens, Shadcn/Radix UI primitives, and the architecture already established in the new web app (layouts, shared components, data layer, middleware).

### Scope

- **39 pages** to migrate or recreate
- **~20 interactive React components** to port
- **~12 Astro components** to port (Pagination, Breadcrumb, etc.)
- **~10 utility/type files** to port or create
- Adaptation of all migrated code to new theming, i18n patterns, and API layer

### Out of Scope

- Homepage (already implemented)
- Auth pages (already implemented)
- Real map integration (Leaflet). placeholder is acceptable
- New features not present in web-old
- Content rewriting (copy stays the same unless noted)
- **Multi-language support (en, pt)**: This migration targets **Spanish (es) only**. The `[lang]` route parameter and middleware remain in place, but only `es` content will be verified and tested. English and Portuguese translations will be addressed in a separate follow-up effort after migration is complete.

### Dependencies

- None. The new `apps/web` already has all required infrastructure:
  - Layouts: `BaseLayout.astro`, `Header.astro`, `Footer.astro`
  - Design system: `STYLE_GUIDE.md` with all tokens, colors, typography, patterns
  - Shared components: 27 components in `src/components/shared/`
  - UI primitives: 8 Shadcn/Radix components in `src/components/ui/`
  - API layer: `src/lib/api/` (client, endpoints, transforms, types)
  - i18n: `src/lib/i18n.ts` with `@repo/i18n`
  - Auth: `src/lib/auth-client.ts` with Better Auth
  - Middleware: locale detection, auth guards, Server Islands support
  - Static data: `src/data/*.ts` (accommodations, destinations, navigation, etc.)
  - SEO components: `src/components/seo/` (JsonLd, ArticleJsonLd, EventJsonLd, etc.)
  - Skeletons: `src/components/skeletons/` for Server Island fallbacks

**Configuration note:** The new `apps/web/astro.config.mjs` must enable `experimental.serverIslands: true` to support `server:defer` directives used by FavoriteButton and ReviewList islands. This should be verified/added in the setup phase (T-001).

---

## Current State Analysis

### apps/web (new) - 7 pages implemented

| Page | Status |
|------|--------|
| `/` (root redirect) | Done |
| `/[lang]/` (homepage) | Done |
| `/[lang]/auth/signin` | Done |
| `/[lang]/auth/signup` | Done |
| `/[lang]/auth/forgot-password` | Done |
| `/[lang]/auth/reset-password` | Done |
| `/[lang]/auth/verify-email` | Done |

### apps/web-old - 46 pages total (39 pending migration)

| Group | Pages | Complexity |
|-------|-------|------------|
| Error pages | 2 (404, 500) | Simple |
| Accommodations | 5 (list, detail, pagination, type filter) | Complex |
| Destinations | 6 (list, detail, pagination, dest accommodations list, dest accommodations pagination) | Complex |
| Events | 5 (list, detail, pagination, category filter) | Medium-Complex |
| Blog/Posts | 5 (list, detail, pagination, tag filter) | Medium |
| Account (mi-cuenta) | 6 (dashboard, edit, favorites, preferences, subscription, reviews) | Medium |
| Search | 1 | Complex |
| Contact | 1 | Medium |
| Pricing | 2 (tourists, owners) | Medium |
| Static/Marketing | 3 (benefits, about, owners landing) | Medium |
| Legal | 3 (privacy, terms, sitemap) | Simple |

---

## Architecture Decisions

### AD-1: Migration Strategy per Page Type

| Action | Criteria | Pages |
|--------|----------|-------|
| **Copy+Adapt** | Core business logic, complex API integration, many filters | Accommodations, Destinations, Events, Blog, Account, Search |
| **Recreate** | Simple pages better served by new design system | 404, 500, Contact, Pricing, Benefits, About Us, Owners Landing |
| **Minimal Adapt** | Content-only pages with no interactive logic | Privacy, Terms, Sitemap, Pagination variants |

### AD-2: Component Reuse Strategy

Components already in `apps/web/src/components/shared/`:
- `AccommodationCard.astro` .. replaces AccommodationCard + CardV2 + CardFeatured
- `DestinationCard.astro` .. replaces DestinationCard + DestinationCard.client
- `EventCard.astro` .. replaces EventCard
- `FeaturedArticleCard.astro` + `SecondaryArticleCard.astro` .. replaces BlogPostCard
- `ReviewCard.astro` .. replaces ReviewCard + TestimonialCard
- `StatCard.astro` .. replaces statistics components
- `SectionHeader.astro` .. replaces SectionTitle + SectionSubtitle + SectionHeader
- `GradientButton.astro` .. replaces GradientButton + partial Button
- `EmptyState.astro` .. replaces EmptyState + ErrorState variants
- `WaveDivider.astro` .. replaces all wave dividers
- `ParallaxDivider.astro` .. replaces ParallaxDividerWrapper + ParallaxDivider.client (CSS-only, no React)
- `BackgroundPattern.astro` .. new, replaces inline pattern backgrounds
- `DecorativeElement.astro` .. replaces DecorativeCorner (more versatile)
- `Badge.astro`, `CategoryBadge.astro`, `LocationBadge.astro`, `RatingBadge.astro`, `AmenityTag.astro`, `StarsDisplay.astro` .. all exist

Components in `apps/web/src/components/ui/`:
- `button.tsx` (CVA) .. replaces Button.astro + ButtonReact.tsx
- `calendar.tsx` .. replaces CalendarReact.tsx (date picker only)
- `drawer.tsx` .. replaces DrawerReact.tsx
- `Modal.client.tsx` .. replaces Modal.client.tsx
- `popover.tsx` .. replaces PopoverReact.tsx
- `select.tsx` .. replaces SelectReact.tsx
- `ThemeToggle.astro` .. replaces ThemeToggle.client.tsx (Astro-only)
- `Toast.client.tsx` .. replaces Toast.client.tsx

### AD-3: Component Migration Strategy

These components do NOT exist in the new web and are needed for the migrated pages. **For each component, the implementor MUST evaluate the best approach before writing code**, choosing one of these 4 strategies:

| Strategy | When to use |
|----------|-------------|
| **Copy direct** | Component is clean, has no hardcoded colors, follows current patterns. Just copy and update import paths. |
| **Copy + adapt** | Component logic is sound but needs theming updates (color tokens, typography, spacing) and import path changes. |
| **Rewrite from scratch** | Component is poorly structured, has too much tech debt, or the new design system offers a significantly better approach. |
| **Use external/existing** | An existing shared component, Shadcn primitive, or `@repo/*` package already covers the need. No migration needed. |

The strategy column below is a **recommendation**, not a mandate. Each task should begin with a quick evaluation of the source component (read it, assess quality and compatibility) before deciding.

| Component | Source | Recommended Strategy | Needed For |
|-----------|--------|---------------------|------------|
| `Pagination.astro` | `web-old/ui/` | Copy+adapt | All list pages |
| `Breadcrumb.astro` | `web-old/ui/` | Copy+adapt | All pages |
| `FilterSidebar.client.tsx` | `web-old/accommodation/` | Evaluate (complex, 385 lines) | Accommodation list |
| `FilterSection.client.tsx` | `web-old/accommodation/` | Evaluate (FilterSidebar dep) | FilterSidebar dep |
| `PriceRangeFilter.client.tsx` | `web-old/accommodation/` | Evaluate (FilterSidebar dep) | FilterSidebar dep |
| `ActiveFilterChips.client.tsx` | `web-old/accommodation/` | Evaluate (FilterSidebar dep) | FilterSidebar dep |
| `FilterChipsBar.client.tsx` | `web-old/accommodation/` | Copy+adapt (sub-component of accommodation list page) | Accommodation list |
| `filter-sidebar.types.ts` | `web-old/accommodation/` | Copy+adapt | FilterSidebar dep |
| `ImageCarousel.client.tsx` | `web-old/accommodation/` | Copy+adapt (clean, 189 lines, no deps) | Accommodation cards in lists |
| `ImageGallery.client.tsx` | `web-old/ui/` | Copy+adapt (clean, 281 lines, no deps) | Detail pages |
| `FavoriteButton.client.tsx` | `web-old/ui/` | Copy+adapt (complex: API, auth, Sentry) | Detail pages, cards |
| `FavoriteButtonIsland.astro` | `web-old/ui/` | Copy+adapt | Astro wrapper for FavoriteButton |
| `ShareButtons.client.tsx` | `web-old/ui/` | Copy+adapt (clean, 219 lines) | Detail pages |
| `ReviewForm.client.tsx` | `web-old/review/` | Evaluate (manual validation vs RHF+Zod) | Accommodation detail |
| `ReviewList.client.tsx` | `web-old/review/` | Copy+adapt | Accommodation detail |
| `ReviewListIsland.astro` | `web-old/review/` | Copy+adapt | Astro wrapper for ReviewList |
| `SearchBar.client.tsx` | `web-old/search/` | Copy+adapt (simple, 183 lines) | Search page |
| `CalendarView.client.tsx` | `web-old/event/` | Evaluate (430 lines custom vs react-day-picker) | Events list |
| `MapView.client.tsx` | `web-old/map/` | Copy direct (placeholder, 205 lines) | Detail pages |
| `SortDropdown.astro` | `web-old/accommodation/` | Copy+adapt | List pages |
| `AccommodationCardDetailed.astro` | `web-old/accommodation/` | **NOT MIGRATED** - Use existing AccommodationCard (shared) for all contexts | N/A |
| `AmenitiesList.astro` | `web-old/accommodation/` | Evaluate (reuse AmenityTag from shared?) | Accommodation detail |
| `ContactForm.client.tsx` | `web-old/content/` | Evaluate (rewrite with RHF+Zod?) | Contact page |
| `CounterAnimation.client.tsx` | `web-old/content/` | Copy+adapt (animated stat counters) | Marketing pages |
| `useCountUp.ts` | `web-old/hooks/` | Copy+adapt | CounterAnimation dep |
| `PricingCard.astro` | `web-old/content/` | Copy+adapt | Pricing pages |
| `DestinationFilters.client.tsx` | `web-old/destination/` | Evaluate | Destinations list |
| `DestinationFilterPanel.client.tsx` | `web-old/destination/` | **NOT MIGRATED** - No filtering in destination listings | N/A |
| `LitoralMap.astro` | `web-old/destination/` | Copy+adapt | Destinations list |
| `DestinationCarousel.astro` | `web-old/destination/` | Copy+adapt | Destination list |
| `destination-carousel.utils.ts` | `web-old/destination/` | Copy+adapt | DestinationCarousel dep |
| `DestinationPreview.astro` | `web-old/destination/` | Copy+adapt | Destination detail |
| `destination-preview.utils.ts` | `web-old/destination/` | Copy+adapt | DestinationPreview dep |
| `AccordionFAQ.client.tsx` | `web-old/ui/` | Evaluate (React vs native `<details>`) | Accommodation detail, pricing |
| `LanguageSwitcher.astro` | `web-old/ui/` | Evaluate (needed now? es-only scope) | Header/Footer |
| `Tabs.client.tsx` | `web-old/ui/` | Copy+adapt (needed for Account pages) | Account pages |
| `NavigationProgress.astro` | `web-old/ui/` | Copy+adapt (add to BaseLayout) | BaseLayout |
| `ScrollReveal.astro` | `web-old/ui/` | Use existing (CSS classes in global.css) | N/A |
| `ViewToggle.client.tsx` | `web-old/ui/` | **NOT MIGRATED** - Always grid layout, no list/grid toggle | N/A |
| `RotatingPhrase.client.tsx` | `web-old/content/` | **NOT MIGRATED** - Not used in any migrated page | N/A |

Account page islands.. each should be evaluated individually:

| Component | Lines | Recommended Strategy |
|-----------|-------|---------------------|
| `ProfileEditForm.client.tsx` | ~200 | Evaluate |
| `PreferenceToggles.client.tsx` | ~150 | Evaluate |
| `UserFavoritesList.client.tsx` | ~250 | Evaluate |
| `UserReviewsList.client.tsx` | ~250 | Evaluate |
| `ReviewEditForm.client.tsx` | ~200 | Evaluate |
| `SubscriptionDashboard.client.tsx` | ~300 | Evaluate |
| `SubscriptionCard.client.tsx` | ~150 | Evaluate |
| `CancelSubscriptionDialog.client.tsx` | ~100 | Evaluate |
| `ChangePlanDialog.client.tsx` | ~150 | Evaluate |
| `InvoiceHistory.client.tsx` | ~200 | Evaluate |
| `PaymentHistory.client.tsx` | ~200 | Evaluate |
| `UsageOverview.client.tsx` | ~150 | Evaluate |
| `ActiveAddons.client.tsx` | ~150 | Evaluate |

**Evaluation criteria:** Read the source component. If it uses hardcoded colors, bad patterns, or excessive tech debt, rewrite. If it's clean and just needs import path updates, copy direct. If it needs theming changes, copy+adapt. If a better solution exists (Shadcn, `@repo/*`), use that instead.

### AD-4: Theming Adaptation Rules

All migrated code must follow these rules:

1. **Colors**: Replace hardcoded colors with semantic tokens from STYLE_GUIDE.md
   - `bg-white` .. `bg-card` or `bg-background`
   - `bg-gray-100` .. `bg-muted`
   - `text-gray-500` .. `text-muted-foreground`
   - `text-gray-900` .. `text-foreground`
   - `bg-blue-600` .. `bg-primary`
   - `bg-green-100` .. `bg-secondary`
   - `text-orange-500` .. `text-accent`
   - Custom brand colors .. use `hospeda-*` tokens

   **Full CSS token migration table:**
   | Old Token | New Token | Context |
   |-----------|-----------|---------|
   | `bg-white` | `bg-card` or `bg-background` | Cards, page background |
   | `bg-gray-50/100` | `bg-muted` | Subtle backgrounds |
   | `bg-gray-200` | `bg-muted/50` | Borders, dividers |
   | `text-gray-500/600` | `text-muted-foreground` | Secondary text |
   | `text-gray-900` | `text-foreground` | Primary text |
   | `bg-blue-600` | `bg-primary` | Primary actions |
   | `text-blue-600` | `text-primary` | Links, active states |
   | `bg-green-100` | `bg-secondary` | Secondary backgrounds |
   | `text-green-700` | `text-secondary-foreground` | Secondary text on green bg |
   | `text-orange-500` | `text-accent` | Accent/highlight text |
   | `bg-orange-500` | `bg-accent` | Accent backgrounds |
   | `border-gray-200` | `border-border` | Default borders |
   | `ring-blue-500` | `ring-ring` | Focus rings |
   | `bg-red-100` | `bg-destructive/10` | Error backgrounds |
   | `text-red-600` | `text-destructive` | Error text |

2. **Typography**: Apply STYLE_GUIDE font hierarchy
   - Section titles: `font-serif text-2xl md:text-3xl font-bold`
   - Subtitles: `font-sans text-xl md:text-2xl font-semibold`
   - Body: `text-base text-muted-foreground`
   - Use `text-balance` or `text-pretty` on headings

3. **Layout**: Use STYLE_GUIDE containers
   - Standard: `mx-auto max-w-5xl px-4 md:px-8`
   - Wide: `mx-auto max-w-6xl px-4 md:px-8`
   - Narrow: `mx-auto max-w-2xl px-4`

4. **Section spacing**: `py-16 md:py-24` (standard), `py-8 md:py-12` (compact)

5. **Decorative elements**: Apply per page type (see STYLE_GUIDE section 10)
   - List pages: 1 subtle pattern, 2-3 small decoratives, no illustrations
   - Detail pages: No background patterns, 1-2 decoratives in CTA area
   - Info pages: 1 subtle pattern, 2-3 thematic decoratives, 1 illustration
   - Error pages: No patterns, 1 custom illustration

   **Decorative patterns by page type:**
   | Page Type | Background Pattern | Decoratives | Illustrations |
   |-----------|-------------------|-------------|---------------|
   | List pages (accommodations, destinations, events, blog) | 1 subtle pattern (dots, diagonal, crosses, waves) at ~5% opacity | 2-3 small decoratives | None |
   | Detail pages | None | 1-2 subtle in CTA area | None |
   | Info/marketing pages (benefits, about, owners, pricing) | 1 subtle pattern | 2-3 thematic | 1 illustration |
   | Error pages (404, 500) | None | None | 1 custom illustration |
   | Account pages | None | None | None |
   | Legal pages (privacy, terms, sitemap) | None | None | None |

6. **Animations**: Use `scroll-reveal` / `scroll-reveal-left` / `scroll-reveal-right` classes

7. **Dark mode**: All tokens support dark mode via Tailwind CSS v4 `@custom-variant dark`

### AD-5: i18n Handling

- **Spanish only** for this migration. The `[lang]` route parameter stays, but only `es` locale content is verified and tested. Other locales (en, pt) will be handled in a follow-up.
- Use `t()` from `src/lib/i18n.ts` (same function signature as web-old)
- **React islands** use `useTranslation` hook (to be created as `src/hooks/useTranslation.ts`). This is a wrapper around `createT`/`createTranslations` from `src/lib/i18n.ts` for convenient use in React components. The old web had this hook; the new web does not yet.
- Use `Astro.locals.locale` for locale detection (middleware handles this)
- Use `@repo/i18n` for `formatDate`, `toBcp47Locale`, and locale definitions
- Verify all i18n keys exist for `es` locale before implementing. Missing keys should be added to `@repo/i18n`
- Do NOT spend time verifying or fixing `en`/`pt` translations

### AD-6: API Layer

The new web already has the complete API layer:
- `src/lib/api/client.ts` .. fetch wrapper with pagination
- `src/lib/api/endpoints.ts` .. all public endpoints (accommodations, destinations, events, posts, contact)
- `src/lib/api/endpoints-protected.ts` .. protected endpoints (auth, user, billing, bookmarks)
- `src/lib/api/transforms.ts` .. DTO transformers (toAccommodationCardProps, toDestinationCardProps, etc.)
- `src/lib/api/types.ts` .. shared types

No new endpoints need to be created. The existing transforms cover all card types.

### AD-7: Rendering Strategy

**Principle: Preserve the rendering strategy from web-old.** Each page type MUST use the same rendering approach (SSR vs SSG) that was established in the original `apps/web-old` implementation. Do NOT change a page's rendering strategy unless there is a documented technical reason requiring it.

| Page Type | Strategy | Reason | web-old Reference |
|-----------|----------|--------|-------------------|
| Error pages (404, 500) | SSR | Locale detection from URL/header | `404.astro`, `500.astro` |
| List pages (index) | SSR | Query params for filters/pagination | `alojamientos/index.astro`, `destinos/index.astro` |
| Detail pages ([slug]) | SSG + fallback | `getStaticPaths` + on-demand for new content | `alojamientos/[slug].astro`, `eventos/[slug].astro` |
| Pagination variants | SSR | Same as parent list page | `page/[page].astro` |
| Account pages | SSR | Auth-required, `noindex: true` | `mi-cuenta/*.astro` |
| Static pages | SSG | `prerender = true` | `privacidad.astro`, `terminos-condiciones.astro` |
| Search page | SSR | Dynamic query | `busqueda.astro` |

If a deviation from the original strategy is needed, document the reason in the task description and get approval before implementing.

### AD-8: StickyNav Decision

The old web had a `StickyNav.astro` component. The new web does NOT have it. Decision: **Do not port StickyNav**. The new Header component is already sticky by default with a simpler approach. If a secondary nav is needed for detail pages (e.g., "Description | Amenities | Reviews | Location" tabs), implement it as a page-level component, not a global layout component.

---

## Detailed Page Specifications

### Phase 1: Infrastructure Components

These shared components are required by multiple pages and must be implemented first.

#### P1-01: Port Pagination Component

**Source:** `web-old/src/components/ui/Pagination.astro` (181 lines)
**Target:** `web/src/components/shared/Pagination.astro`

**What it does:** Server-rendered pagination with two modes (URL-segment `/page/2/` and query-param `?page=2`). Ellipsis algorithm, responsive (3 pages mobile, 5 desktop), prev/next buttons.

**Adaptation:**
- Update import path for `t()` from `lib/i18n`
- Replace color classes: `bg-blue-600` .. `bg-primary`, `text-gray-500` .. `text-muted-foreground`, etc.
- Apply border-radius and padding consistent with STYLE_GUIDE
- Keep the same props interface

**Tests:** Verify ellipsis logic, both URL modes, edge cases (page 1, last page, single page)

---

#### P1-02: Port Breadcrumb Component

**Source:** `web-old/src/components/ui/Breadcrumb.astro`
**Target:** `web/src/components/shared/Breadcrumb.astro`

**Adaptation:**
- Update color tokens
- Verify `HOME_BREADCRUMB` constant from `lib/page-helpers`
- Ensure chevron separator uses `text-muted-foreground`

---

#### P1-03: Port FilterSidebar System

**Source:** `web-old/src/components/accommodation/` (FilterSidebar + FilterSection + PriceRangeFilter + ActiveFilterChips + filter-sidebar.types)
**Target:** `web/src/components/accommodation/`

**Total lines:** ~700 across 5 files

**Adaptation:**
- Replace `useTranslation` hook import path
- Replace `@repo/icons` imports (verify icon names still match)
- Replace hardcoded `DESTINATIONS` array with data from `src/data/destinations.ts` (DESTINATION_NAMES)
- Update color classes to semantic tokens
- URL sync with `window.history.pushState` stays the same

**Bug fix during migration:** The old `filter-sidebar.types.ts` hardcodes 5 destination names. The new web has `DESTINATION_NAMES` in `src/data/destinations.ts` with 9 destinations. Use the centralized data.

---

#### P1-04: Port ImageGallery Component

**Source:** `web-old/src/components/ui/ImageGallery.client.tsx` (281 lines)
**Target:** `web/src/components/shared/ImageGallery.client.tsx`

**What it does:** Main image + thumbnail strip + fullscreen lightbox. Keyboard navigation (Escape, arrows).

**Adaptation:**
- Update `useTranslation` import
- Update `@repo/icons` imports (CloseIcon, NextIcon, PreviousIcon)
- Apply new border-radius and shadow tokens

---

#### P1-05: Port FavoriteButton System

**Source:** `web-old/src/components/ui/FavoriteButton.client.tsx` (285 lines) + `FavoriteButtonIsland.astro`
**Target:** `web/src/components/shared/FavoriteButton.client.tsx` + `FavoriteButtonIsland.astro`

**What it does:** Heart toggle with optimistic updates, auth check, API calls, Sentry error tracking, toast notifications.

**Adaptation:**
- Update imports: `@sentry/astro`, `toast-store`, `lib/env`, `AuthRequiredPopover.client`
- Verify `userBookmarksApi` endpoints match in `endpoints-protected.ts`
- The `AuthRequiredPopover.client.tsx` already exists in `web/src/components/auth/`

---

#### P1-06: Port ShareButtons Component

**Source:** `web-old/src/components/ui/ShareButtons.client.tsx` (219 lines)
**Target:** `web/src/components/shared/ShareButtons.client.tsx`

**What it does:** Native Web Share API (mobile) with fallback to WhatsApp/Facebook/X buttons. Copy to clipboard.

**Adaptation:** Update icon imports, logger import, color tokens.

---

#### P1-07: Port ReviewList + ReviewForm System

**Source:** `web-old/src/components/review/` (ReviewForm 323 lines + ReviewList 314 lines + ReviewCard.astro + ReviewListIsland.astro)
**Target:** `web/src/components/review/`

**Note:** `ReviewCard.astro` already exists in `shared/`. Decide whether to reuse it from the ReviewList or keep the React rendering within ReviewList.

**Adaptation:**
- ReviewForm: Update icon imports, useTranslation, color tokens
- ReviewList: Update icon imports, formatDate import, useTranslation
- ReviewListIsland: Update Astro wrapper paths
- Consider: Should ReviewForm use React Hook Form + Zod (project pattern) instead of manual validation? (Lower priority, manual validation works)

**Note:** ReviewForm submit will be a placeholder (console.log or toast) during this migration. The review submission API endpoint may not be fully wired yet. The form UI should be complete and validated, but actual submission is deferred.

---

#### P1-08: Port SearchBar Component

**Source:** `web-old/src/components/search/SearchBar.client.tsx` (183 lines)
**Target:** `web/src/components/search/SearchBar.client.tsx`

**What it does:** Text input with 300ms debounce, clear button, navigates to `/busqueda/?q=`.

**Adaptation:** Update icon imports, useTranslation, color tokens.

---

#### P1-09: Port SortDropdown Component

**Source:** `web-old/src/components/accommodation/SortDropdown.astro`
**Target:** `web/src/components/shared/SortDropdown.astro`

**Adaptation:** Update color tokens, verify i18n keys.

---

#### P1-10: Port ImageCarousel Component

**Source:** `web-old/src/components/accommodation/ImageCarousel.client.tsx` (189 lines)
**Target:** `web/src/components/shared/ImageCarousel.client.tsx`

**What it does:** CSS scroll-snap carousel for cards. Max 5 images. Touch swipe native.

**Adaptation:** Update useTranslation import, color tokens.

---

#### P1-11: Port AmenitiesList Component

**Source:** `web-old/src/components/accommodation/AmenitiesList.astro`
**Target:** `web/src/components/shared/AmenitiesList.astro`

**Adaptation:** Update color tokens, use `AmenityTag.astro` from shared if compatible.

---

#### P1-12: Port AccordionFAQ Component

**Source:** `web-old/src/components/ui/AccordionFAQ.client.tsx`
**Target:** `web/src/components/shared/AccordionFAQ.client.tsx`

**Adaptation:** Update color tokens. Consider replacing with native `<details>/<summary>` (like `propietarios/index.astro` does) to avoid React hydration.

---

#### P1-13: Port MapView Placeholder

**Source:** `web-old/src/components/map/MapView.client.tsx` (205 lines)
**Target:** `web/src/components/shared/MapView.client.tsx`

**Note:** This is a PLACEHOLDER (no real map). Keep the same API surface for future Leaflet integration.

**Adaptation:** Update icon imports, useTranslation, color tokens.

---

#### P1-14: Port CalendarView Component

**Source:** `web-old/src/components/event/CalendarView.client.tsx` (430 lines)
**Target:** `web/src/components/event/CalendarView.client.tsx`

**What it does:** Custom monthly calendar (no external deps) that marks event dates. Not the same as `calendar.tsx` (which is a date picker for forms).

**Decision (resolved):** Copy + adapt the custom component (430 lines, no external dependencies). No need for react-day-picker since the existing implementation is self-contained and works well.

**Adaptation:** Update useTranslation, toBcp47Locale import path, color tokens.

---

#### P1-15: Port DestinationFilters Component

**Source:** `web-old/src/components/destination/DestinationFilters.client.tsx`
**Target:** `web/src/components/destination/DestinationFilters.client.tsx`

**Adaptation:** Update useTranslation, icon imports, color tokens.

---

#### P1-16: Port LitoralMap Component

**Source:** `web-old/src/components/destination/LitoralMap.astro`
**Target:** `web/src/components/destination/LitoralMap.astro`

**Adaptation:** Update color tokens.

---

#### P1-17: Port ContactForm Component

**Source:** `web-old/src/components/content/ContactForm.client.tsx`
**Target:** `web/src/components/content/ContactForm.client.tsx`

**Adaptation:** Update color tokens, API endpoint for contact form submission.

---

#### P1-18: Port PricingCard Component

**Source:** `web-old/src/components/content/PricingCard.astro`
**Target:** `web/src/components/shared/PricingCard.astro`

**Adaptation:** Update color tokens, button component usage.

---

#### P1-19: Port Account Page Islands

**Source:** `web-old/src/components/account/` (13 React components)
**Target:** `web/src/components/account/`

Components:
1. `ProfileEditForm.client.tsx` - Edit user profile
2. `PreferenceToggles.client.tsx` - User preferences
3. `UserFavoritesList.client.tsx` - Favorites list with tabs
4. `UserReviewsList.client.tsx` - User reviews list with tabs
5. `ReviewEditForm.client.tsx` - Edit review inline
6. `SubscriptionDashboard.client.tsx` - Main subscription view
7. `SubscriptionCard.client.tsx` - Subscription status card
8. `CancelSubscriptionDialog.client.tsx` - Cancel confirmation
9. `ChangePlanDialog.client.tsx` - Plan change dialog
10. `InvoiceHistory.client.tsx` - Invoice list
11. `PaymentHistory.client.tsx` - Payment list
12. `UsageOverview.client.tsx` - Usage stats
13. `ActiveAddons.client.tsx` - Active add-ons list

**Adaptation for all:**
- Update API base URL imports
- Update useTranslation hook
- Update color tokens to semantic
- Replace any direct icon imports with `@repo/icons`
- Verify all API endpoints exist in `endpoints-protected.ts`

---

#### P1-20: Port LanguageSwitcher Component

**Source:** `web-old/src/components/ui/LanguageSwitcher.astro`
**Target:** `web/src/components/shared/LanguageSwitcher.astro`

**Adaptation:** Update color tokens. Check if Header already has language switching built in.

---

### Phase 2: Error Pages (2 pages)

#### P2-01: Create 404 Page

**Target:** `web/src/pages/404.astro`
**Action:** Recreate (simple page, better with new design)

**Requirements:**
- SSR (no prerender) with locale detection from URL path, then `Accept-Language` header, fallback `es`
- Use `BaseLayout` with `noindex: true`
- Custom SVG illustration (nature/river theme per brand)
- i18n keys: `error.404.title`, `error.404.description`, `error.404.heading`, `error.404.message`, `error.404.goHome`
- Link to `/${locale}/` (home)
- Apply STYLE_GUIDE section spacing and typography
- No decorative patterns (detail page style per AD-4)

**Reference:** `web-old/src/pages/404.astro` (107 lines)

---

#### P2-02: Create 500 Page

**Target:** `web/src/pages/500.astro`
**Action:** Recreate

**Requirements:**
- Same structure as 404 but with retry button (`window.location.reload()`)
- i18n keys: `error.500.title`, `error.500.description`, `error.500.heading`, `error.500.message`, `error.500.retry`, `error.500.goHome`
- Two CTAs: Retry + Go Home

**Reference:** `web-old/src/pages/500.astro` (126 lines)

---

### Phase 3: Accommodation Pages (5 pages)

#### P3-01: Accommodation List Page

**Target:** `web/src/pages/[lang]/alojamientos/index.astro`
**Action:** Copy+Adapt
**Complexity:** Complex

**Source:** `web-old` (271 lines)

**Features to preserve:**
- SSR (`prerender = false`), filters via query params
- 11 filters: type, priceMin, priceMax, currency, minGuests, minBedrooms, minBathrooms, minRating, hasWifi, hasPool, allowsPets, hasParking
- 5 sort options via SORT_MAP
- `FilterChipsBar` React island (`client:idle`) for active filter visualization
- Responsive grid (1/2/3 columns)
- Pagination with filter preservation in URL
- Empty state when no results
- Error state on API failure

**API calls:**
- `accommodationsApi.list({ page, pageSize, q, sortBy, sortOrder, type, ...filters })`

**Components needed:** Container (or max-w wrapper), Breadcrumb, EmptyState, Pagination, AccommodationCardDetailed (or use AccommodationCard with more props), SortDropdown, FilterChipsBar, FilterSidebar

**Theming adaptation:**
- Use `bg-background` for page background
- Use `bg-muted/30` for filter sidebar background
- Apply `pattern-dots` background with 50% opacity per STYLE_GUIDE listing page rules
- 2-3 subtle decorative elements (deco-brujula top-right, deco-pin-location near filters)
- No large illustrations (interfere with card grid per STYLE_GUIDE)

**i18n namespace:** `accommodations.listPage`

**Decision (resolved):** Use the existing `AccommodationCard.astro` (shared) for ALL contexts including list pages. Do NOT migrate `AccommodationCardDetailed.astro`. The shared card already has sufficient information for list display. If minor adjustments are needed (e.g., showing more amenities), extend with props rather than creating a new component.

---

#### P3-02: Accommodation Detail Page

**Target:** `web/src/pages/[lang]/alojamientos/[slug].astro`
**Action:** Copy+Adapt
**Complexity:** Complex

**Source:** `web-old` (310 lines)

**Features to preserve:**
- SSG with `getStaticPaths` (all locales x all slugs) + on-demand fallback
- Image gallery with lightbox (`ImageGallery`, `client:visible`)
- Interactive map with marker (`MapView`, `client:visible`)
- Reviews section with `server:defer` (deferred rendering)
- FavoriteButton with `server:defer`
- Sticky sidebar with price, check-in/out, CTA
- TipTap content rendering + HTML sanitization
- JSON-LD `LodgingBusiness`
- View transitions (`transition:name`)
- Similar accommodations section (4 cards)
- Amenities list
- FAQ accordion
- Share buttons

**API calls:**
- `getStaticPaths`: `accommodationsApi.list()` via `fetchAllPages`
- `accommodationsApi.getBySlug({ slug })` (fallback)
- `accommodationsApi.list({ pageSize: 4 })` (similar)

**Components needed:** ImageGallery, MapView, ReviewListIsland, FavoriteButtonIsland, ShareButtons, AmenitiesList, AccordionFAQ, PriceDisplay (already in shared? check), Breadcrumb, Badge, Container, Section

**Theming:**
- No background patterns (detail page per STYLE_GUIDE)
- 1-2 subtle decoratives in CTA/footer area
- Gallery as visual protagonist
- Clean white card backgrounds

**i18n namespace:** `accommodations.detail`

---

#### P3-03: Accommodation Pagination Page

**Target:** `web/src/pages/[lang]/alojamientos/page/[page].astro`
**Action:** Copy+Adapt (near-identical to P3-01)

**Architecture decision (resolved):** Create a shared `_AccommodationListLayout.astro` partial that contains ALL the list page logic (filters, grid, pagination). The 3 variant pages (index, pagination, type filter) each import this layout and pass their specific params (page source, pre-applied filter). This eliminates code duplication across P3-01, P3-03, P3-04, P3-05.

**Pattern:** Create `src/pages/[lang]/alojamientos/_AccommodationListLayout.astro` as a partial (prefixed with `_`). Each variant page is a thin wrapper:
- `index.astro`: passes `page` from query params
- `page/[page].astro`: passes `page` from URL segment
- `tipo/[type]/index.astro`: passes `type` pre-filter
- `tipo/[type]/page/[page].astro`: passes both

---

#### P3-04: Accommodation Type Filter Page

**Target:** `web/src/pages/[lang]/alojamientos/tipo/[type]/index.astro`
**Action:** Copy+Adapt (variant of P3-01 with pre-applied type filter)

---

#### P3-05: Accommodation Type Filter Pagination

**Target:** `web/src/pages/[lang]/alojamientos/tipo/[type]/page/[page].astro`
**Action:** Copy+Adapt (variant of P3-04 with pagination)

---

### Phase 4: Destination Pages (5 pages)

#### P4-01: Destination List Page

**Target:** `web/src/pages/[lang]/destinos/index.astro`
**Action:** Copy+Adapt
**Complexity:** Medium

**Source:** `web-old` (217 lines)

**Features to preserve:**
- SSG with `getStaticLocalePaths`
- `DestinationFilters` React island (`client:visible`) for search
- Grid of destination cards
- Pagination
- "Provinces" section (hardcoded for Entre Rios, Corrientes, Santa Fe)
- Hero section with heading

**API calls:**
- `destinationsApi.list({ page, pageSize: 12, destinationType: 'CITY' })`

**Components needed:** Container, Breadcrumb, EmptyState, Pagination, DestinationCard (shared), DestinationFilters, SectionHeader

**Theming:**
- Use `bg-secondary` or `bg-hospeda-sky-light` for hero
- Apply `pattern-diagonal` background per STYLE_GUIDE
- 2-3 decoratives (deco-multi-pins, deco-ruta-punteada)

**i18n namespace:** `destination.listing`

---

#### P4-02: Destination Detail Page (Catch-all)

**Target:** `web/src/pages/[lang]/destinos/[...path].astro`
**Action:** Copy+Adapt
**Complexity:** Complex (most complex page in the app, 459 lines)

**Features to preserve:**
- Catch-all route `[...path]` for hierarchy (e.g., `entre-rios/colon`)
- SSG with `getStaticPaths` (all locales x all destinations)
- 5-6 API calls per render
- Dynamic breadcrumb hierarchy from API
- Climate section (4 conditional fields)
- Preview of 3 accommodations + 3 events with "view all" links
- Client-side filtering of events by city (API workaround)
- Image gallery, map, share buttons, favorite button
- JSON-LD `Place`
- `tPlural` for plural forms
- View transitions

**API calls:**
- `getStaticPaths`: `destinationsApi.list()` via `fetchAllPages`
- `destinationsApi.getByPath({ path })`
- `destinationsApi.getAccommodations({ id, pageSize: 6 })`
- `eventsApi.list({ pageSize: 100 })` + client-side city filter
- `destinationsApi.getBreadcrumb({ id })`

**Components needed:** ImageGallery, MapView, ShareButtons, FavoriteButtonIsland, AccommodationCardFeatured (use AccommodationCard), EventCard, Breadcrumb, Badge, Container, Section, EmptyState

**Theming:** Detail page rules (no patterns, minimal decoratives)

**i18n namespace:** `destinations.detailPage`

---

#### P4-03: Destination Pagination

**Target:** `web/src/pages/[lang]/destinos/page/[page].astro`
**Action:** Copy+Adapt (variant of P4-01)
**Rendering:** SSG with `getStaticLocalePaths`

---

#### P4-04: Destination Accommodations List

**Target:** `web/src/pages/[lang]/destinos/[slug]/alojamientos/index.astro`
**Action:** Copy+Adapt
**Rendering:** SSR (dynamic destination slug parameter)

**Features:** List of accommodations for a specific destination. Uses AccommodationCard (shared), Pagination, Breadcrumb with destination hierarchy.

---

#### P4-05: Destination Accommodations Pagination

**Target:** `web/src/pages/[lang]/destinos/[slug]/alojamientos/page/[page].astro`
**Action:** Copy+Adapt
**Rendering:** SSR (dynamic destination slug + page parameters)

**Note:** This brings the destination pages count to 6 (list, detail catch-all, pagination, dest accommodations list, dest accommodations pagination). The 6th count comes from `destinos/[slug]/alojamientos/page/[page].astro` being a separate route from `destinos/[slug]/alojamientos/index.astro`.

---

### Phase 5: Event Pages (5 pages)

#### P5-01: Event List Page

**Target:** `web/src/pages/[lang]/eventos/index.astro`
**Action:** Copy+Adapt
**Complexity:** Medium

**Source:** `web-old` (201 lines)

**Features to preserve:**
- SSR (query params for filters)
- Timeframe filter tabs (upcoming/past/all) as HTML links
- Category filter with native `<select>` + inline `<script>` for redirect
- 5 categories: festival, fair, sport, cultural, gastronomy
- Grid layout
- Pagination

**API calls:**
- `eventsApi.list({ page, pageSize: 12, q, sortBy, category })`

**Components needed:** Container, Breadcrumb, EmptyState, Pagination, EventCard (shared), SectionHeader

**Theming:**
- Apply `pattern-crosses` background
- 2-3 decoratives (deco-avion, deco-flecha-curva)

**i18n namespace:** `events.listPage`

**Decision:** The old page uses inline `<script>` for category change. Consider keeping this (simple, no React needed) vs using the select.tsx Radix component. Recommendation: keep inline script (simpler, less JS).

---

#### P5-02: Event Detail Page

**Target:** `web/src/pages/[lang]/eventos/[slug].astro`
**Action:** Copy+Adapt
**Complexity:** Complex

**Source:** `web-old` (368 lines)

**Features to preserve:**
- SSG with `getStaticPaths` + on-demand fallback
- Past event detection + visual indicator
- Agenda section (numbered items)
- Pricing section (conditional: only if price or ticketUrl)
- Organizer info
- Share buttons
- JSON-LD `Event`
- View transitions
- Related upcoming events (4, excluding current)
- Localized date/time formatting via `@repo/i18n`

**API calls:**
- `getStaticPaths`: `eventsApi.list()` via `fetchAllPages`
- `eventsApi.getBySlug({ slug })`
- `eventsApi.getUpcoming({ pageSize: 4 })`

**Components needed:** Container, Section, Breadcrumb, ShareButtons, EventCard (shared), Badge

**Icons needed:** CalendarIcon, ClockIcon, LocationIcon, ImageIcon from `@repo/icons`

**i18n namespace:** `events.detail`

---

#### P5-03: Event Pagination

**Target:** `web/src/pages/[lang]/eventos/page/[page].astro`
**Action:** Copy+Adapt (variant of P5-01)

---

#### P5-04: Event Category Filter

**Target:** `web/src/pages/[lang]/eventos/categoria/[category]/index.astro`
**Action:** Copy+Adapt (variant of P5-01 with pre-applied category)

---

#### P5-05: Event Category Filter Pagination

**Target:** `web/src/pages/[lang]/eventos/categoria/[category]/page/[page].astro`
**Action:** Copy+Adapt

---

### Phase 6: Blog/Posts Pages (5 pages)

#### P6-01: Blog List Page

**Target:** `web/src/pages/[lang]/publicaciones/index.astro`
**Action:** Copy+Adapt
**Complexity:** Medium

**Source:** `web-old` (268 lines)

**Features to preserve:**
- SSR (query params)
- Featured post in special layout (image + content side-by-side)
- Category filter as HTML links (6 categories)
- Grid of post cards
- Pagination

**API calls:**
- `postsApi.list({ page, pageSize: 12, q, sortBy, sortOrder, category })`
- `postsApi.getFeatured()`

**Components needed:** Container, Section, Breadcrumb, EmptyState, Pagination, SectionHeader. Use `FeaturedArticleCard` + `SecondaryArticleCard` from shared (they already exist in new web!).

**Theming:**
- Apply `pattern-waves` background (subtle)
- 2-3 decoratives

**i18n namespace:** `blog.listPage`

---

#### P6-02: Blog Detail Page

**Target:** `web/src/pages/[lang]/publicaciones/[slug].astro`
**Action:** Copy+Adapt
**Complexity:** Medium

**Source:** `web-old` (209 lines)

**Features to preserve:**
- SSG with `getStaticPaths` + on-demand fallback
- TipTap content rendering + HTML sanitization
- Author info with avatar
- Reading time display
- Tags as Badge components
- Share buttons
- JSON-LD `Article`
- View transitions
- Related posts (3, excluding current)
- Localized date formatting

**API calls:**
- `getStaticPaths`: `postsApi.list()` via `fetchAllPages`
- `postsApi.getBySlug({ slug })`
- `postsApi.list({ pageSize: 4 })` (related)

**Components needed:** Container, Section, Badge, Breadcrumb, ShareButtons, SecondaryArticleCard (for related posts)

**Theming:** Detail page rules (no patterns, Tailwind `prose` for content)

**i18n namespace:** `blog.detail`

---

#### P6-03: Blog Pagination

**Target:** `web/src/pages/[lang]/publicaciones/page/[page].astro`

---

#### P6-04: Blog Tag Filter

**Target:** `web/src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro`

---

#### P6-05: Blog Tag Filter Pagination

**Target:** `web/src/pages/[lang]/publicaciones/etiqueta/[tag]/page/[page].astro`

---

### Phase 7: Account Pages (6 pages)

All account pages are SSR, auth-guarded, `noindex: true`.

#### P7-01: Account Dashboard

**Target:** `web/src/pages/[lang]/mi-cuenta/index.astro`
**Action:** Copy+Adapt
**Complexity:** Medium

**Source:** `web-old` (315 lines)

**Features:**
- Avatar with initials from name
- Sidebar navigation (5 links)
- 3 stat cards (favorites, reviews, subscription)
- Client-side stats loading via `<script>` (fetch `/api/v1/protected/users/me/stats`)
- Subscription status with data attributes

**API calls (client-side):**
- `GET /api/v1/protected/users/me/stats`
- `GET /api/v1/protected/users/me/reviews?pageSize=1`

**i18n namespace:** `account.pages.dashboard`

---

#### P7-02: Edit Profile Page

**Target:** `web/src/pages/[lang]/mi-cuenta/editar.astro`
**Action:** Copy+Adapt
**Complexity:** Simple (89 lines, thin wrapper around ProfileEditForm island)

---

#### P7-03: Favorites Page

**Target:** `web/src/pages/[lang]/mi-cuenta/favoritos.astro`
**Action:** Copy+Adapt
**Complexity:** Simple (66 lines, thin wrapper around UserFavoritesList island)

---

#### P7-04: Preferences Page

**Target:** `web/src/pages/[lang]/mi-cuenta/preferencias.astro`
**Action:** Copy+Adapt
**Complexity:** Medium (133 lines, settings extraction + PreferenceToggles island)

---

#### P7-05: Subscription Page

**Target:** `web/src/pages/[lang]/mi-cuenta/suscripcion.astro`
**Action:** Copy+Adapt
**Complexity:** Simple (73 lines, thin wrapper around SubscriptionDashboard island)

---

#### P7-06: Reviews Page

**Target:** `web/src/pages/[lang]/mi-cuenta/resenas.astro`
**Action:** Copy+Adapt
**Complexity:** Simple (66 lines, thin wrapper around UserReviewsList island)

---

### Phase 8: Search Page

#### P8-01: Search Results Page

**Target:** `web/src/pages/[lang]/busqueda.astro`
**Action:** Copy+Adapt
**Complexity:** Complex

**Source:** `web-old` (331 lines)

**Features to preserve:**
- SSR (dynamic query param)
- Multi-entity simultaneous search (4 APIs in parallel)
- Differentiated empty states: no query vs. no results vs. error
- Popular searches from i18n
- "View all" links per category
- `noindex: true`

**API calls (SSR, Promise.all):**
- `accommodationsApi.list({ q, pageSize: 6 })`
- `destinationsApi.list({ q, pageSize: 6 })`
- `eventsApi.list({ q, pageSize: 6 })`
- `postsApi.list({ q, pageSize: 6 })`

**Components needed:** Container, Breadcrumb, EmptyState, AccommodationCard, DestinationCard, EventCard, FeaturedArticleCard/SecondaryArticleCard, SearchBar

**Theming:**
- Light background with `pattern-grid` at low opacity
- 1-2 decoratives

**i18n namespace:** `search.resultsPage`

---

### Phase 9: Contact Page

#### P9-01: Contact Page

**Target:** `web/src/pages/[lang]/contacto.astro`
**Action:** Recreate
**Complexity:** Medium

**Source:** `web-old` (167 lines)

**Features:**
- SSG (`prerender = true`)
- Two-column layout: form (left) + contact info (right)
- ContactForm React island (`client:visible`)
- Hardcoded email: `info@hospeda.com.ar`
- Social media links (Instagram, Facebook, Twitter)
- Office hours from i18n

**Components needed:** Container, Section, Breadcrumb, ContactForm island
- Contact form submission uses `contactApi.submit()` from `src/lib/api/endpoints.ts`

**Icons needed:** EmailIcon, LocationIcon, ClockIcon, InstagramIcon, FacebookIcon, TwitterIcon

**Theming:**
- Info page style: `pattern-waves` or `pattern-topo` background
- 2-3 thematic decoratives
- 1 illustration (ilustracion-destinos or similar)

**i18n namespace:** `contact.page`

---

### Phase 10: Pricing Pages (2 pages)

#### P10-01: Tourist Pricing Page

**Target:** `web/src/pages/[lang]/precios/turistas.astro`
**Action:** Recreate
**Complexity:** Medium

**Source:** `web-old` (156 lines)

**Features:**
- SSG (`prerender = true`)
- Plans fetched at build time via `plansApi.list()` from `src/lib/api/endpoints.ts` with hardcoded fallback from `lib/pricing-fallbacks.ts`
- PricingCard components with `highlighted` prop for recommended plan
- 3 FAQ items from i18n
- BreadcrumbList JSON-LD for SEO
- CTA toward registration

**Components needed:** Container, Section, Breadcrumb, PricingCard, JsonLd

**Theming:**
- Marketing page style with rich decoratives
- Gradient background for highlighted plan card
- Use accent colors for pricing

**i18n namespace:** `billing.pricing.tourist`

---

#### P10-02: Owner Pricing Page

**Target:** `web/src/pages/[lang]/precios/propietarios.astro`
**Action:** Recreate (identical structure to P10-01 but different data)

**Features:**
- SSG (`prerender = true`)
- Owner plans fetched via `plansApi.list()` with owner-specific filter, fallback from `lib/pricing-fallbacks.ts`
- PricingCard components with `highlighted` prop
- FAQ section using AccordionFAQ component with owner-specific FAQ items from i18n
- CTA toward owner registration / contact
- BreadcrumbList JSON-LD

**Components needed:** Container, Section, Breadcrumb, PricingCard, AccordionFAQ, JsonLd

**i18n namespace:** `billing.pricing.owner`

---

### Phase 11: Static/Marketing Pages (3 pages)

#### P11-01: Benefits Page

**Target:** `web/src/pages/[lang]/beneficios.astro`
**Action:** Recreate
**Complexity:** Medium

**Source:** `web-old` (260 lines)

**Features:**
- SSG
- 5 tourist benefits + 5 owner benefits with icons
- Dual CTA (tourist pricing + owner pricing)
- No API calls

**Bug fix:** Old page has broken CTA links (`/precios-turistas/` instead of `/precios/turistas/`). Fix during migration.

**Icons needed:** HomeIcon, ShieldIcon, LocationIcon, StarIcon, InfoIcon, UserIcon, CheckIcon, UsersIcon (8 icons)

**Theming:**
- Marketing page with rich visuals
- Alternate section backgrounds
- Decorative illustrations

**i18n namespace:** `benefits`

---

#### P11-02: About Us Page

**Target:** `web/src/pages/[lang]/quienes-somos.astro`
**Action:** Recreate
**Complexity:** Medium

**Source:** `web-old` (173 lines)

**Features:**
- SSG
- **Sections:** Hero with heading/subtitle, Mission statement (full-width), Values grid (2x2 with icons), Region/History (2 paragraphs about Litoral region), CTA to contact page
- All content is static, sourced from i18n keys under `about.*` namespace
- No API calls

**Icons needed:** CheckIcon, UsersIcon, CheckCircleIcon, GlobeIcon

**i18n namespace:** `about`

---

#### P11-03: Owners Landing Page

**Target:** `web/src/pages/[lang]/propietarios/index.astro`
**Action:** Recreate
**Complexity:** Medium-Complex

**Source:** `web-old` (223 lines)

**Features:**
- SSG
- Content from `lib/owners-page-data.ts` (localized object)
- 4 sections: Hero, Benefits grid (6), How It Works (numbered steps), FAQ (native `<details>`)
- FAQPage JSON-LD for SEO
- Full-width gradient CTA

**Components needed:** Container, Section, Breadcrumb, JsonLd

**Icons needed:** SearchIcon, DashboardIcon, StarIcon, StatisticsIcon, ChatIcon, SettingsIcon, CheckIcon

**i18n namespace:** `owners`

**Data dependency:** `lib/owners-page-data.ts` must be ported

---

### Phase 12: Legal Pages (3 pages)

#### P12-01: Privacy Policy Page

**Target:** `web/src/pages/[lang]/privacidad.astro`
**Action:** Minimal Adapt
**Complexity:** Simple

**Source:** `web-old` (149 lines)

**Features:**
- SSG
- 7 sections of hardcoded Spanish legal text
- Uses Tailwind `prose prose-lg` for typography
- Dynamic "last updated" date

**Known issue:** Content is NOT internationalized (Spanish only despite locale routing). Keep this as-is for now.

**Adaptation:** Update layout imports, apply semantic color tokens, use new Container/Section.

**i18n namespace:** `privacy` (only title and description keys)

---

#### P12-02: Terms & Conditions Page

**Target:** `web/src/pages/[lang]/terminos-condiciones.astro`
**Action:** Minimal Adapt (identical structure to P12-01)

**Features:**
- SSG (`prerender = true`)
- Same structure as privacy page: sections of hardcoded Spanish legal text
- Uses Tailwind `prose prose-lg` for typography
- Dynamic "last updated" date
- Content is NOT internationalized (Spanish only)

**Adaptation:** Update layout imports, apply semantic color tokens, use new Container/Section.

**i18n namespace:** `terms` (only title and description keys)

---

#### P12-03: Sitemap Page

**Target:** `web/src/pages/[lang]/mapa-del-sitio.astro`
**Action:** Minimal Adapt
**Complexity:** Simple

**Source:** `web-old` (155 lines)

**Features:**
- SSG
- 7 sections of links in 3-column grid
- All data in frontmatter

**Known issue:** Old page has inconsistent internal links (`/terminos-y-condiciones/` vs actual route `/terminos-condiciones/`, `/politica-de-privacidad/` vs `/privacidad/`). Fix during migration.

**i18n namespace:** `common.sitemap`

---

## Supporting Files to Port

### Lib utilities (already exist in new web)

All lib files from web-old already have equivalents in the new web:
- `lib/api/*` .. already migrated
- `lib/i18n.ts` .. already exists
- `lib/page-helpers.ts` .. already exists
- `lib/env.ts` .. already exists
- `lib/cn.ts` .. already exists
- `lib/auth-client.ts` .. already exists
- `lib/logger.ts` .. already exists
- `lib/media.ts` .. already exists
- `lib/middleware-helpers.ts` .. already exists
- `lib/sanitize-html.ts` .. already exists
- `lib/tiptap-renderer.ts` .. already exists
- `lib/urls.ts` .. already exists
- `lib/pricing-fallbacks.ts` .. already exists
- `lib/pricing-plans.ts` .. already exists
- `lib/owners-page-data.ts` .. already exists

### Hooks (need creation)
- `hooks/useTranslation.ts` .. Does NOT exist in apps/web. Must be created as a wrapper hook over `createT`/`createTranslations` from `src/lib/i18n.ts` for use in React islands. See new task T-109.

### Store (already exists)
- `store/toast-store.ts` .. already exists in new web

### Styles
- `styles/animations.css` .. check if scroll-reveal animations are in `global.css`
- `styles/components.css` .. likely not needed (Tailwind utility classes)
- `styles/textures.css` .. likely not needed (patterns are now in `BackgroundPattern.astro`)

### Project Documentation
- `apps/web/CLAUDE.md` .. Does NOT exist yet. Must be created as part of migration setup, adapted from web-old/CLAUDE.md but updated for the new architecture. See task T-110.

### New Utility Files to Create
- `src/lib/format-utils.ts` .. Generic formatting utilities to be used across all cards and pages. Functions:
  - `formatPrice({ amount, currency, locale })` .. "$12.500"
  - `formatLocationDisplay({ city, state })` .. "City, State"
  - `formatRating({ rating })` .. "4.6"
  - `buildDetailUrl({ locale, slug, type })` .. "/es/alojamientos/slug/"
  - `formatDate({ date, locale, format })` .. "15 de enero 2024"
  - `formatReadingTime({ minutes, locale })` .. "5 min"
  After creating, refactor existing card components to use these shared functions.

---

## Testing Strategy

### Unit Tests Required

**Important:** Tests should be REWRITTEN from scratch, not ported. The component and page structure has changed significantly enough that old tests won't work as-is. Use the old test files as REFERENCE for what to test (coverage, edge cases) but write new test code that matches the new component APIs and imports.

Each migrated component needs tests covering:
1. Renders correctly with minimum props
2. Handles empty/null data gracefully
3. i18n keys resolve correctly for all 3 locales
4. Accessibility: proper ARIA attributes, keyboard navigation
5. Interactive components: state changes, API call mocking

### Page Tests Required

Each page needs:
1. Renders with valid mock data
2. Handles API errors (empty state or error state)
3. SEO tags present (title, description, canonical)
4. Breadcrumb renders correctly
5. Pagination works with mock data (for list pages)
6. JSON-LD structured data is valid (for detail pages)

### Existing Test Files to Port

From `web-old/test/`:
- `components/accommodation/accommodation-card.test.ts`
- `components/accommodation/amenities-list.test.ts`
- `components/accommodation/filter-sidebar.test.tsx`
- `components/destination/*.test.ts` (11 files)
- `components/event/*.test.ts` (2 files)
- `components/blog/blog-post-card.test.ts`
- `components/content/contact-form.test.tsx`
- `components/content/pricing-card.test.ts`
- `components/content/statistics-section.test.ts`
- `components/content/testimonial-card.test.ts`
- `components/error/error-state.test.ts`
- `components/account/*.test.ts` (5 files)

---

## Migration Checklist (per page)

- [ ] Copy/create page file in new web
- [ ] Update all imports to new web paths
- [ ] Replace color classes with semantic tokens
- [ ] Apply STYLE_GUIDE typography hierarchy
- [ ] Apply STYLE_GUIDE container widths
- [ ] Apply STYLE_GUIDE section spacing
- [ ] Add decorative elements per page type rules
- [ ] Add scroll-reveal animations
- [ ] Verify i18n keys exist in `@repo/i18n`
- [ ] Verify API endpoints work via `endpoints.ts`
- [ ] Verify SEO (title, description, canonical, JSON-LD)
- [ ] Verify middleware handles the route (locale, auth)
- [ ] Port or write tests
- [ ] Run `pnpm typecheck` .. passes
- [ ] Run `pnpm lint` .. passes
- [ ] Run `pnpm test` in web .. passes
- [ ] Visual check in browser (3 viewports: mobile, tablet, desktop)
- [ ] Dark mode check:
  - [ ] All text is readable (contrast ratio >= 4.5:1)
  - [ ] No white/light backgrounds remain (all use semantic tokens)
  - [ ] Cards have visible borders or shadows in dark mode
  - [ ] Images have appropriate dark mode treatment (no bright flash)
  - [ ] Form inputs have visible borders and appropriate background
  - [ ] Active/focus states are visible in dark mode

### Final Visual Verification (T-108)

Use Playwright screenshots to verify ALL migrated pages in 3 viewports:
- **Mobile:** 375px width
- **Tablet:** 768px width
- **Desktop:** 1440px width

Checklist per page:
- [ ] Layout is correct at all 3 viewports
- [ ] No horizontal scrolling at any viewport
- [ ] Typography hierarchy is visually correct
- [ ] Decorative elements render and don't overlap content
- [ ] Dark mode toggle works and all elements are visible
- [ ] Images load with correct aspect ratios
- [ ] Cards have consistent styling
- [ ] Buttons and links are visually distinct and clickable

---

## Known Bugs to Fix During Migration

1. **`beneficios.astro`**: CTA links point to `/precios-turistas/` and `/precios-propietarios/` instead of `/precios/turistas/` and `/precios/propietarios/`
2. **`mapa-del-sitio.astro`**: Internal links use wrong paths (`/terminos-y-condiciones/` vs `/terminos-condiciones/`, `/politica-de-privacidad/` vs `/privacidad/`)
3. **`filter-sidebar.types.ts`**: Destinations hardcoded (5 cities) instead of using centralized `DESTINATION_NAMES` (9 cities)
4. **`destinos/[...path].astro`**: Fetches ALL events (pageSize: 100) and filters client-side by city name. Should use API-level filtering if available.
5. **`privacidad.astro` + `terminos-condiciones.astro`**: Legal content is hardcoded in Spanish only, not internationalized. Not blocking but should be noted.
6. **NewsletterForm**: Newsletter subscription form submit is a placeholder (no backend integration yet). Form should render and validate but actual submission is deferred.
7. **ReviewForm**: Review submission is a placeholder. Form renders and validates but does not actually submit to API.

---

## Estimated Task Count

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 0: Setup & config | 4 | P0 (blocks everything) |
| Phase 1: Infrastructure components | 28 | P0 (blocks pages) |
| Phase 2: Error pages | 3 | P1 |
| Phase 3: Accommodations | 8 | P1 (core business) |
| Phase 4: Destinations | 8 | P1 (core business) |
| Phase 5: Events | 8 | P2 |
| Phase 6: Blog | 8 | P2 |
| Phase 7: Account | 8 | P2 |
| Phase 8: Search | 2 | P2 |
| Phase 9: Contact | 2 | P3 |
| Phase 10: Pricing | 3 | P3 |
| Phase 11: Static/Marketing | 4 | P3 |
| Phase 12: Legal | 4 | P3 |
| Phase 13: Testing & verification | 2 | P3 |
| **Total** | **~92** | |

### Phase Dependencies

- **Phase 1** (Infrastructure Components) blocks ALL other phases. No page can be created until its required components exist.
- **Phases 2-12 are independent of each other** and can be worked on in parallel once their Phase 1 dependencies are met.
- Within each phase, pages can generally be implemented in parallel except where noted (e.g., detail pages may depend on list pages for shared layouts).

---

## Success Criteria

1. All 39 pages render correctly in the new web app
2. All pages pass typecheck, lint, and tests
3. All pages use semantic color tokens (no hardcoded colors)
4. All pages follow STYLE_GUIDE decorative rules per page type
5. All pages have correct SEO (title, description, canonical, JSON-LD where applicable)
6. All interactive components work (filters, search, favorites, reviews, etc.)
7. All pages work in Spanish (es) - other locales (en, pt) are out of scope for this migration
8. Dark mode works on all pages
9. Mobile/tablet/desktop responsive on all pages
10. Known bugs from web-old are fixed
11. `apps/web-old` can be safely deleted after migration is verified
