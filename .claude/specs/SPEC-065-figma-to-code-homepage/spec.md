---
spec-id: SPEC-065
title: "Figma to Code: Homepage Production Migration"
type: feature
complexity: high
status: completed
created: 2026-04-01T00:00:00-03:00
updated: 2026-04-04T00:00:00-03:00
completed: 2026-04-04T00:00:00-03:00
figma-file: ZBq2Rv2Dj0NaQfwbeoZgLB
figma-node: "20:3"
depends-on: [SPEC-048]
---

# SPEC-065: Figma to Code — Homepage Production Migration

## Part 1 — Functional Specification

### 1. Overview & Goals

#### Goal

Migrate the Hospeda homepage design from Figma (file `ZBq2Rv2Dj0NaQfwbeoZgLB`, node `20:3`) into production-ready Astro components inside `apps/web2`. The output must be pixel-accurate to the Figma design at 1440px viewport, fully responsive from 320px to 2560px, accessible to WCAG 2.1 AA standard, and wired to live API data where available.

This spec builds directly on SPEC-048 (Web2 Homepage Componentization & Tokenization), which established the component skeleton and design token system. SPEC-065 tightens fidelity requirements to the Figma source of truth and fills in the production details that SPEC-048 deferred: hover states, accessibility annotations, responsive breakpoints, live data wiring, and structural corrections that cannot be expressed inside Figma.

#### Motivation

The current `apps/web2` homepage renders a static HTML blob inherited from a Bootstrap template. SPEC-048 began the componentization work. SPEC-065 drives it to production completion using the cleaned-up Figma file as the definitive visual reference. The Figma file has been through a thorough review pass: naming conventions aligned, design tokens extracted, component structure clarified, and accessibility issues annotated for code-side resolution.

#### Guiding Principles

- **Figma is the single source of truth.** Every visual decision — spacing, colors, typography, layout proportions — must match the Figma design. When code and Figma disagree, Figma wins.
- **Homepage first, fix the rest later.** This spec may introduce breaking changes to other web2 pages (token renames, component renames, CSS restructuring). That is acceptable. The homepage must be pixel-perfect and clean. Other pages will be migrated individually in future specs.
- **Zero hardcoded values.** All colors, spacing, radii, and typography sizes must come from CSS custom properties. No exceptions.
- **Full internationalization.** Every user-facing string — including aria-labels, alt text, placeholder text, error messages, success messages, and button labels — must use `@repo/i18n` locale files via `t()` calls. Zero hardcoded strings in any language.
- **No scroll reveal animations.** Entrance animations on scroll are explicitly deferred. Components render immediately in their final state. This may be revisited in a future spec.
- **Consult before deleting.** If implementation requires removing existing CSS classes, JS utilities, or components that might be used by other pages, the implementer must flag the deletion for review before proceeding.

#### Success Criteria

- Lighthouse Performance score >= 90 on a cold mobile 3G simulation.
- Lighthouse Accessibility score >= 95 on desktop and mobile.
- All 12 sections render pixel-accurately at 1440px viewport width (Figma reference).
- Every breakpoint (320px, 375px, 768px, 1024px, 1440px, 2560px) passes visual QA against the responsive spec in Section 6.
- Zero hardcoded hex colors or spacing values. All values come from CSS custom properties defined in `global.css`.
- Zero hardcoded user-facing strings. All copy comes from `@repo/i18n` locale files.
- All interactive React islands are independently testable with Vitest + Testing Library.
- Cumulative Layout Shift (CLS) < 0.1 on desktop and mobile (Google "good" threshold).
- Images served via Astro `<Image>` component with correct `width`, `height`, `loading`, and `decoding` attributes.
- Page prerenders for all three locales (`es`, `en`, `pt`) via `export const prerender = true` + `getStaticPaths()` (selective prerendering in Astro's SSR hybrid mode). Note: the Vercel ISR config (`expiration: 86400`) in `astro.config.mjs` does NOT apply to prerendered pages — it only affects on-demand SSR pages. The homepage is fully static at build time.

#### Target Users

- Tourists discovering accommodations in the Litoral Entrerriano region of Argentina.
- Property owners evaluating listing their accommodation on Hospeda.
- Event-goers looking for upcoming experiences in Concepcion del Uruguay.

---

### 2. User Stories

#### US-065-01 — First-time visitor browses the homepage

As a tourist visiting the homepage for the first time,
I want to see a visually compelling hero with a clear value proposition, search bar, and featured accommodations,
so that I understand what Hospeda offers and can immediately start exploring.

**Acceptance Criteria:**

```
Given I land on the homepage in any supported locale,
When the page finishes loading,
Then the hero section is fully visible above the fold with the tagline, title, description, blob image, social proof row, and search bar.

Given the page has loaded,
When I look at the hero section,
Then the title text animation plays once on page load (staggered word fade-in), unless prefers-reduced-motion is active.

Given prefers-reduced-motion is set to "reduce" in my OS,
When the page loads,
Then all entrance animations are skipped and content appears immediately without motion.

Given the hero search bar is visible,
When I tab through the search bar fields,
Then every interactive input and the search button receives a visible focus ring (2px solid --brand-primary, 2px offset) in keyboard order: type select, destination select, check-in date, check-out date, adults input, children input, search button.
```

#### US-065-02 — Visitor filters accommodations by type

As a visitor browsing featured accommodations,
I want to click a filter chip to show only accommodations of that type on the homepage grid,
so that I can quickly preview what's available before navigating to the full listing.

**Acceptance Criteria:**

```
Given the Featured Accommodations section is visible,
When I click a filter chip (e.g., "Cabaña"),
Then the chip becomes visually active (filled background, distinct from unselected state), the accommodation grid updates to show only that type, and any previously active chip becomes inactive.

Given a filter chip is active,
When I click the same chip again,
Then the chip returns to its default state and the grid shows all accommodation types.

Given filter chips are rendered,
When I hover over an inactive chip,
Then the chip shows a hover state visually distinct from both the default and active states.

Given filter chips are rendered,
When I navigate to a chip using the keyboard (Tab key),
Then the focused chip has a visible focus ring (2px solid --brand-primary, 2px offset).

Given filter chips are rendered,
When I press Enter or Space on a focused chip,
Then it activates the same way as a click.

Given a chip is active and I use a screen reader,
When the chip is announced,
Then it is announced with its label and state (e.g., "Cabaña, selected, button").
```

#### US-065-03 — Visitor explores destinations via the map section

As a visitor curious about travel destinations,
I want to see an interactive map of Entre Rios with destination pins and browse a carousel of destination cards,
so that I can understand the geography and pick a destination that appeals to me.

**Acceptance Criteria:**

```
Given the Destinations section is visible,
When I look at the map area,
Then I see the Entre Rios province outline with pins marking each destination.

Given the map has destination pins,
When I click or tap a pin,
Then the carousel scrolls to the corresponding destination card and that card becomes visually highlighted.

Given the destination carousel is rendered,
When I click the next or previous navigation button,
Then the carousel scrolls by one card, with peek of adjacent cards visible on both sides.

Given the destination carousel is rendered,
When I swipe left or right on a touch device,
Then the carousel responds with natural inertia and snaps to the nearest card.

Given the destination carousel is rendered,
When I navigate carousel controls with the keyboard,
Then the previous and next buttons are reachable via Tab and respond to Enter/Space.

Given a carousel contains destination cards,
When a card is in view,
Then the card shows the destination image, name, province, and number of accommodations available.
```

#### US-065-04 — Visitor reads upcoming events

As a visitor planning a trip,
I want to see a curated grid of upcoming events near my destination,
so that I can time my visit around activities I enjoy.

**Acceptance Criteria:**

```
Given the Next Events section is visible,
When the section loads,
Then up to 6 event cards are displayed in a 2-column grid on desktop, each showing event image, title, date, location, and category badge.

Given an event card is rendered,
When I hover over the card,
Then internal card elements respond as specified in Section 3.1: image zooms within frame, category badge brightens, title changes color to --brand-primary, and destination link reveals an underline (200ms ease-out transitions).

Given an event card is rendered,
When I focus on the card link using a keyboard,
Then the card receives a visible focus ring (2px solid --brand-primary, 2px offset).

Given I am on a mobile viewport (<768px),
When the Next Events section is visible,
Then the event cards display in a single column.
```

#### US-065-05 — Property owner discovers the owner CTA

As a property owner browsing the page,
I want to find a dedicated call-to-action section explaining the benefits of listing on Hospeda,
so that I understand the value proposition and am motivated to sign up.

**Acceptance Criteria:**

```
Given I scroll past the Next Events section,
When the CTA for Owners section comes into view,
Then I see a section with a headline, a list of 3 feature items with icons, and a primary CTA button labeled with the i18n key for "Publicar mi alojamiento".

Given the CTA button is visible,
When I hover over it,
Then the button shows a brightness increase (filter: brightness(1.08)) with a smooth transition (200ms ease-out).

Given the CTA button is visible,
When I focus on it using the keyboard,
Then the button has a visible focus ring (2px solid --brand-primary, 2px offset).

Given the section is rendered,
When a screen reader encounters the feature icons,
Then each icon has a descriptive aria-label (e.g., "Publicaciones ilimitadas", "Panel de administración", "Soporte prioritario").
```

#### US-065-06 — Visitor browses the latest articles in bento layout

As a visitor interested in travel content,
I want to browse recent blog articles presented in an engaging mixed layout,
so that I can find articles relevant to my interests without going to the full blog.

**Acceptance Criteria:**

```
Given the Latest Articles section is visible,
When I look at the article grid,
Then I see 4 article cards in a bento-style layout: 1 horizontal large card (spanning 2 columns), 1 vertical tall card (spanning 2 rows), and 2 text-only compact cards.

Given an article card is rendered,
When I hover over the card,
Then internal card elements respond as specified in Section 3.1: effects vary by variant (featured, vertical, compact) and include image zoom, title color change, tag highlight, and content reveals (200ms ease-out transitions).

Given an article card is rendered,
When I click anywhere on the card,
Then I am taken to the article detail page.

Given I am on a mobile viewport (<768px),
When the Latest Articles section is visible,
Then all 4 article cards display in a single column with the standard card layout (no bento).
```

#### US-065-07 — Visitor reads testimonials with pagination

As a visitor considering booking,
I want to read testimonials from other travelers in a browsable carousel,
so that I can build trust in the platform before committing to a booking.

**Acceptance Criteria:**

```
Given the Testimonials section is visible,
When the section loads,
Then a sidebar title is shown on the left and 3 testimonial cards are visible in a horizontal row on the right, with pagination dots below indicating total count.

Given the testimonials carousel is rendered,
When I click a pagination dot,
Then the carousel scrolls to the corresponding testimonial group and the dot becomes active (filled).

Given the testimonials carousel is rendered,
When I swipe left on a touch device,
Then the carousel advances to the next group of testimonials.

Given a testimonial card is rendered,
Then the card shows reviewer avatar (or initials fallback), name, rating stars (with aria-label on the container and aria-hidden on each star icon), review excerpt, and accommodation name.

Given the rating stars container is rendered,
When a screen reader announces it,
Then the announcement is "4.5 de 5 estrellas" (localized) and individual star icons are aria-hidden.
```

#### US-065-08 — Visitor signs up for the newsletter via the footer

As a visitor who wants to stay updated,
I want to subscribe to the Hospeda newsletter from the footer using my email or WhatsApp number,
so that I receive travel tips and promotions without visiting the site every day.

**Acceptance Criteria:**

```
Given the footer newsletter form is visible,
When I enter a valid email address and submit,
Then the form performs client-side validation only and prevents actual submission. No success message is shown. Backend integration is deferred to a future spec.

Given the footer newsletter form is visible,
When I enter an invalid email address and attempt to submit,
Then an inline validation error is shown below the input without page reload.

Given the footer newsletter form is visible,
When I submit the form with an empty field,
Then the form field receives focus and an error message is shown.

Given the newsletter form is rendered,
When I focus the email/WhatsApp input using the keyboard,
Then the input has a visible focus ring (2px solid --brand-primary, 2px offset).
```

#### US-065-09 — Visitor navigates the page in a non-English locale

As a visitor whose preferred language is Portuguese,
I want the entire homepage to display in my language,
so that I can understand all content without needing to know Spanish.

**Acceptance Criteria:**

```
Given I navigate to the /pt/ route,
When the homepage loads,
Then all user-facing strings (navigation, hero, section titles, card labels, footer) render in Portuguese using keys from packages/i18n/src/locales/pt/home.json.

Given I navigate to the /en/ route,
When the homepage loads,
Then all user-facing strings render in English using keys from packages/i18n/src/locales/en/home.json.

Given any locale is active,
When I inspect the page source,
Then there are zero hardcoded user-facing strings. Every string is the output of a t() call from @repo/i18n.
```

#### US-065-10 — Visitor uses the page on a mobile device

As a tourist browsing on a smartphone,
I want the homepage to be fully usable on a small screen,
so that I can explore accommodations and destinations without needing a desktop.

**Acceptance Criteria:**

```
Given I open the homepage on a viewport narrower than 768px,
When the hero section is visible,
Then the layout stacks vertically: text column full-width on top, blob image below (or hidden on very small screens), search inputs stacked vertically (one per row).

Given I open the homepage on a mobile viewport,
When I tap the hamburger icon in the header,
Then a full-screen overlay menu slides in from the right and body scroll is locked while the menu is open.

Given the mobile menu is open,
When I press the Escape key or tap the close button,
Then the menu closes and body scroll is restored.

Given I am on a mobile viewport,
When the Destinations section is visible,
Then the map is hidden (or shown at reduced size) and the destination carousel occupies the full width.

Given I am on a mobile viewport,
When the Partners section is visible,
Then partner logos scroll horizontally in a snapping row instead of being laid out in a single static row.

Given I am on a mobile viewport,
When the Stats section is visible,
Then stat cards are arranged in a 2x2 grid (with the 5th card centered below) rather than a 5-column row.

Given I am on a mobile viewport,
When the Footer is visible,
Then the 4-column navigation stacks vertically with all sections always expanded and visible (no accordion behavior).
```

---

### 3. UX Considerations

#### 3.1 Hover States

Hover effects are internal to each element — no card-level `scale()` transforms. Effects target specific child elements to create subtle, intentional interactions. All effects use `200ms ease-out` transition unless noted otherwise, and must respect `prefers-reduced-motion` (disable transforms, keep color/opacity changes).

**AccommodationCard:**
- Image: zoom `scale(1.08)` within container (`overflow: hidden`, card does not grow)
- Type badge: background transitions to `--brand-primary`
- Price: font-size transitions from 14px to 16px (via CSS `font-size` transition) and color intensifies to brighter `--brand-accent` via `filter: brightness(1.15)`
- Accommodation name: color changes to `--brand-primary`
- Card shadow: no change

**DestinationCard:**
- Image: zoom `scale(1.08)` within container
- Gradient overlay: darkens (opacity from 0.3 → 0.5), making text stand out more
- Destination name: animated underline appears from left (`scaleX(0) → scaleX(1)`, `transform-origin: left`)
- Accommodation count: number changes color to `--brand-accent`
- Arrow/circle button (if present): fills with `--brand-primary` (from outlined to filled)

**EventCard:**
- Image: zoom `scale(1.06)` within container
- Category badge: increases saturation (`filter: brightness(1.15)`)
- Calendar icon (date area): changes color to `--brand-accent`
- Title: color changes to `--brand-primary`
- Location/destination link: animated underline appears from left, revealing it is navigable
- Description: lowers opacity slightly (1 → 0.7), creating contrast hierarchy

**FeaturedArticleCard (horizontal-large):**
- Image: zoom `scale(1.06)` within container
- First tag: background transitions to `--brand-primary` (other tags unchanged)
- Title: color changes to `--brand-primary`
- Excerpt: reveals one additional line (`line-clamp: 2 → 3`), inviting deeper reading
- Author avatar: gains 2px ring of `--brand-primary`
- Promoted badge (if present): single opacity pulse (0.8 → 1 → 0.8)

**VerticalArticleCard (vertical-tall):**
- Image: zoom `scale(1.06)` within container
- First tag: background transitions to `--brand-primary` (consistent with FeaturedArticleCard)
- Title: color changes to `--brand-primary`
- Related entity link (destination/accommodation/event): animated underline appears, revealing navigability
- Date/reading time: lowers opacity (→ 0.7), yielding prominence to title and tags

**CompactArticleCard (text-only):**
- Background: tints from `--core-card` (white) to a very subtle `--brand-secondary` (light blue)
- Title: color changes to `--brand-primary`
- First tag: background transitions to `--brand-primary` (consistent with other article cards)
- "Read more" link/arrow (if present): shifts 4px right via `translateX`, signaling the action
- Decorative separator line (if present): changes color to `--brand-accent`

**TestimonialCard:**
- Avatar: gains 2px ring of `--brand-primary`
- Rating stars: subtle brightness increase (`filter: brightness(1.2)`)
- Reviewer name: color changes to `--brand-primary`
- Referenced entity link (accommodation/destination): animated underline appears, revealing navigability
- Review text: no change (reading content should not be disturbed)

**PartnerLogo:**
- Default state: `opacity: 0.6` + `filter: grayscale(1)` (logos are muted/gray)
- Hover: `opacity: 1` + `filter: grayscale(0)` (logos reveal their real colors), `150ms ease-out`
- Cursor: `pointer`

**Primary CTA buttons (gradient pill):** `filter: brightness(1.08)`, `200ms ease-out`
**Secondary CTA buttons (outlined):** Background fills to `--brand-secondary`, `200ms ease-out`
**Filter chips (inactive):** Background darkens via `color-mix(in oklch, var(--brand-secondary), black 10%)`, `150ms ease-out`
**Filter chips (active):** No hover change
**Header nav links:** Underline via animated `scaleX` transform, `150ms ease-out`
**Footer nav links:** Color shifts from `--footer-fg-muted` to `--footer-fg`, `150ms ease-out`
**Pagination dots:** Subtle scale to `1.15x`, `150ms ease-out`

#### 3.2 Focus States

Every interactive element on the page must have a consistent, visible focus indicator:

```
outline: 2px solid var(--brand-primary);
outline-offset: 2px;
border-radius: var(--radius-md);
```

This applies to: all `<a>` links, `<button>` elements, `<input>`, `<select>`, filter chip buttons, carousel navigation buttons, pagination dots, accordion triggers (footer mobile), and the newsletter submit button.

The default browser focus outline must be suppressed with `outline: none` only when replaced by this custom indicator. Never suppress focus outlines without a replacement.

#### 3.3 Loading States

| Section | Loading Behavior |
|---|---|
| Featured Accommodations grid | Skeleton cards (same dimensions as real cards) rendered during API fetch |
| Destinations carousel | Skeleton cards (same width) during fetch |
| Next Events grid | Skeleton cards during fetch |
| Latest Articles | Skeleton cards matching bento layout during fetch |
| Testimonials | Skeleton cards during fetch |
| Stats | Animated counting numbers (from 0 to final value, 1.5s duration) once section enters viewport |
| Newsletter form submit button | Spinner icon replaces label text; button disabled |

Skeleton cards must match the exact dimensions and shape of their real counterparts to prevent CLS. This includes: outer dimensions, `border-radius` (use `--radius-card`), and internal grid layout (image area with same `aspect-ratio` as the real image + content area). Skeleton elements use `background: var(--core-muted-foreground)` at 10% opacity with a shimmer animation (`@keyframes shimmer` using `background-position` shift on a linear gradient). Animation disabled when `prefers-reduced-motion` is active.

#### 3.4 Empty States

| Section | Empty State |
|---|---|
| Featured Accommodations | Shows a message using `t('home.featuredAccommodations.emptyState')` and a CTA linking to `/alojamientos/` |
| Destinations carousel | Shows a minimal placeholder with `t('home.featuredDestinations.emptyState')` |
| Next Events | Shows `t('home.upcomingEvents.emptyState')` with a link to the events listing page |
| Latest Articles | Shows `t('home.latestPosts.emptyState')` |
| Testimonials | Section is hidden entirely if no testimonials are returned |
| Partners | Section is hidden entirely if no partners are configured |

**AccommodationCard with no reviews:** If an accommodation has no reviews/ratings, the rating stars row is replaced with the text `t('home.featuredAccommodations.noReviews')` (e.g., "Sin reseñas") in `--core-muted-foreground` at the same font size. The card layout must not shift.

#### 3.5 Error States

If an API fetch fails, the affected section must not crash the page. The section renders its empty state message with an additional note (from i18n) indicating a temporary loading issue. The error must be logged via `@repo/logger` but must not surface technical details to the user.

**Partial failures:** Each section fetches data independently. If one section's API call fails (e.g., accommodations returns error but events succeeds), only the failed section shows its empty state — all other sections render normally. Sections must never have cross-dependencies in data fetching.

**Error logging pattern:**
```typescript
import { logger } from '@repo/logger';
logger.error('Homepage: failed to fetch accommodations', { error, endpoint: '/api/v1/public/accommodations' });
```

#### 3.6 Accessibility — Specific Requirements

The following accessibility gaps were identified during the Figma review and must be resolved in code.

**Amenity icons (Accommodation cards):**
Each amenity icon must have an `aria-label` matching the amenity name. The icon itself must be `aria-hidden="true"`. Examples: `aria-label="Wi-Fi"`, `aria-label="Pileta"`, `aria-label="Estacionamiento"`.

**Rating stars:**
The star container must carry `aria-label="4.5 de 5 estrellas"` (populated from data, localized). Individual `<svg>` star icons must be `aria-hidden="true"`.

**Partner logos:**
Every partner logo `<img>` must have `alt="Logo de {nombre del partner}"` populated from data. If the partner name is unavailable, use `alt="Partner logo"`.

**Decorative images:**
Hero floating shapes, background blobs, and section decorative illustrations must all have `alt=""` and `role="presentation"`.

**Map pins:**
Each pin must be a `<button>` (not a `<div>`) with `aria-label="{destination name}"` and a visible focus ring.

**Destination carousel:**
The carousel region must be wrapped in `<section aria-label={t('home.featuredDestinations.ariaLabel')}>`. Navigation buttons must have `aria-label={t('common.carousel.previousSlide')}` and `aria-label={t('common.carousel.nextSlide')}`. The carousel must expose `aria-live="polite"` on the visible slide region.

**Stats section:**
If stat values are overlaid on a gradient background, each stat value and label must meet WCAG AA contrast ratio (4.5:1 minimum for normal text, 3:1 for large text). If contrast is borderline, a semi-opaque scrim or `text-shadow` must be applied.

**Footer (mobile):**
On mobile, the 4-column navigation stacks vertically with all sections always visible. No accordion behavior. Column headings remain `<h3>` elements (not buttons).

**Skip navigation link:**
A visually hidden "Saltar al contenido principal" link must appear as the first focusable element in the DOM, becoming visible on focus, linking to `#main-content`.

#### 3.7 Structural Changes vs. Figma

Figma uses absolute positioning for layout in several sections. The following structural decisions must be made at implementation time, deviating from Figma's layer structure while preserving the visual result.

| Section | Figma approach | Code approach |
|---|---|---|
| Hero search bar | Absolutely positioned over hero bottom edge | Relative positioning with negative margin-top or CSS Grid overlap. Must not cause CLS. |
| Map destination pins | 20+ absolute-positioned layers on a static image | Static SVG map with `<button>` elements as hotspots, positioned via percentage-based `top`/`left` relative to the SVG container. |
| About photo collage | Absolute-positioned overlapping images | CSS Grid with `grid-row` and `grid-column` spanning, `object-fit: cover`, `border-radius` per cell. |
| Destination carousel cards | Absolute-positioned layers | Embla Carousel (already used in SPEC-048) with `overflow: hidden` container. |
| Article bento grid | Non-componentized layers | CSS Grid with named grid areas. Three separate components: `FeaturedArticleCard.astro`, `VerticalArticleCard.astro`, `CompactArticleCard.astro` (see Section 7 for details). |

#### 3.8 Scroll to Top Button

A floating button fixed to the bottom-right corner of the viewport.

**Appearance:** Circular button (48px desktop, 40px mobile) containing an upward arrow icon from `@repo/icons`. Surrounded by a circular SVG progress ring that fills as the user scrolls down the page.

**Progress ring:** SVG `<circle>` with radius 18px (within the 48px button), stroke-width 2px, `stroke-dasharray` and `stroke-dashoffset` driven by scroll percentage (0% at top, 100% at bottom). Ring color: `--brand-primary`. Background track: `--core-muted-foreground` at 20% opacity. Ring is hidden until scroll > 300px, then fades in with the button.

**Behavior:**
- Hidden when the user is at the top of the page (scroll position < 300px).
- Fades in with `opacity` transition when scroll exceeds 300px.
- On click: smooth scroll to top of page (`window.scrollTo({ top: 0, behavior: 'smooth' })`).
- Progress ring updates in real-time via `scroll` event listener with `requestAnimationFrame`.

**Styling:**
- Background: `--core-card` with `box-shadow`.
- Hover: background transitions to `--brand-primary`, icon color to `--button-label-on-dark`.
- Focus: standard focus ring (2px solid `--brand-primary`, 2px offset).

**Accessibility:** `<button>` element with `aria-label={t('common.scrollToTop')}`.

**Implementation:** Astro component (`ScrollToTop.astro`) with inline `<script>` for scroll listener. Does not require a React island.

---

### 4. Section Specifications

#### Section 1: Header

**Layout:** Sticky fixed bar, full width, `max-height: 80px`, `z-index: var(--z-nav)`.

**Left:** Hospeda wordmark logo (SVG, `aria-label="Hospeda"`).

**Center:** Desktop navigation links. Each link uses an `<a>` tag with `href` built via `buildUrl(locale, path)`. Active link has `aria-current="page"`. Links: Home, Alojamientos, Destinos, Eventos, Blog, Contacto.

**Right:** Search icon button (links to `/busqueda/`) + user avatar or login CTA.

**Mobile behavior:** Navigation links hidden. Hamburger button shown. Tap opens full-screen overlay sliding from the right. Body scroll is locked while open. ESC key and the close button both close the menu.

**Scroll behavior:** At scroll position 0, header background is transparent. When any pixel of the page has scrolled out of view, background transitions to `bg-card/95` with `backdrop-blur-md` and a bottom border shadow. Implemented via IntersectionObserver on a sentinel `<div>` at the very top of the document.

**Responsive collapse progression:**
1. **Desktop (>= 1024px):** Full navigation links visible + username/avatar + search icon
2. **Tablet (768-1023px):** Full navigation links visible + search icon. Username/avatar hidden.
3. **Mobile (< 768px):** Navigation links hidden. Hamburger button + search icon visible. Hamburger opens full-screen overlay sliding from right.

**Smooth scroll on homepage:**
Navigation links on the homepage point to section anchors (e.g., `#featured-accommodations`, `#destinations`, `#events`). When clicked on the homepage, they trigger smooth scroll to the target section via `scroll-behavior: smooth` or JS `scrollIntoView({ behavior: 'smooth' })`. When on any other page, the same links navigate to their corresponding full pages (e.g., `/alojamientos/`, `/destinos/`).

#### Section 2: Hero

**Layout:** Two-column, left 60% / right 40%, min-height of `calc(100vh - 80px)`. Left column contains text stack + search bar. Right column contains blob image.

**Tagline:** Caveat Bold 64px, color `--brand-primary`. Text: `t('home.hero.tagline')`.

**Title:** Geologica Bold 96px, color `--core-foreground`. Multi-word, staggered entrance animation (see acceptance criteria US-065-01). `prefers-reduced-motion` respected.

**Description:** Roboto Regular 18px, `--core-muted-foreground`, max-width for readability.

**Social proof row:** 3 circular avatar images (AvatarGroup style) + star rating display + short copy. `aria-label` on the stars container (localized).

**Search bar:** Horizontal pill containing 5 input groups separated by subtle vertical dividers. Visually complete but non-functional in phase 1 (no submit handler; the search button links to `/{locale}/alojamientos/`).

Input groups:
1. **Accommodation type** — `<select>` with autocomplete and multiple selection. Label above, placeholder text as default. On focus: label text changes to placeholder text; on blur: reverts unless a selection exists. No visible border on the input — clean, minimal look matching Figma.
2. **Destination** — `<select>` with autocomplete and multiple selection. Same focus/blur label behavior.
3. **Date range** — Single date range picker (check-in to check-out). Displays as two visual fields but controlled by one range input.
4. **Guests** — On click, reveals a dropdown with two rows: "Adults" and "Children". Each row has left arrow, number, right arrow (increment/decrement pattern). Minimum 1 adult, minimum 0 children.
5. **Search button** — Primary gradient pill button with search icon. Links to `/{locale}/alojamientos/`. In phase 1, the search bar is visually complete but non-functional: selected filter values are NOT carried as query params. The button is a plain `<a>` link. In a future phase, selected values will be passed as query params: `/{locale}/alojamientos/?tipo={type}&destino={slug}&checkIn={date}&checkOut={date}&adults={n}&children={n}`.

**Input styling:** Inputs have no visible border (matching Figma). On focus, the entire input group container gets a subtle highlight (using CSS `:has(input:focus)` on the group wrapper). The label transitions to placeholder behavior on focus.

**Mobile behavior (< 768px):** The full search bar is hidden. A single CTA button ("Buscar alojamiento") or a simplified search input is shown instead. On tap/focus, a `<dialog>` drawer slides up from the bottom of the screen (300ms ease-out, covering bottom 70% of viewport) containing the full search form with all 5 groups stacked vertically. The drawer uses `<dialog>.showModal()` which automatically handles inert behavior on background content. Close via swipe-down gesture, close button, or ESC key. Closing animation: 200ms ease-in slide down.

**Secondary CTA:** Outlined pill button below the search bar. `t('home.hero.secondaryCta')`.

**Blob image:** The hero image is masked with the exact organic blob SVG path from the Figma design. Three images crossfade on a 5-second interval using CSS opacity transitions.

**Blob decorative icons:** The circular icons positioned around the blob shape have subtle randomized floating animations (small `translateX`/`translateY` movements, ~5-10px range, randomized duration 3-6s per icon, infinite loop). Implemented with CSS `@keyframes` with slightly different timing per icon. Disabled when `prefers-reduced-motion` is active.

**Blob image rotation:** Three images crossfade on a 5-second cycle. Each image displays for 4.5 seconds, then fades out over 0.5 seconds while the next image simultaneously fades in (total cycle: 5s per image, 15s full rotation). The blob area must never be transparent — both images overlap at full opacity during the crossfade. Implementation: stack images with `position: absolute`, animate `opacity` between 0 and 1 with overlapping transitions.

**Blob parallax:** The image within the blob moves slightly slower than the page scroll, creating a subtle depth effect. Implemented with `transform: translateY()` driven by scroll position via IntersectionObserver + `requestAnimationFrame`. Maximum displacement: 30px. Disabled when `prefers-reduced-motion` is active.

**Decorative shapes:** 3 floating shape images from `public/assets/images/shapes/`. `aria-hidden="true"`, hidden on mobile (`display: none` below 768px). Parallax on scroll using IntersectionObserver-based vanilla JS (~20 lines) with `prefers-reduced-motion` check.

#### Section 3: Featured Accommodations

**Background:** `--core-background` (off-white).

**Section header:** Accent tagline (Caveat, `--brand-primary`) + section title (Geologica Bold 48px) + description (Roboto Regular 16px).

**Filter chips row:** One chip per accommodation type. The "All" chip is selected by default. Chips are `<button>` elements managed by a React island (`FilterChips.client.tsx`). Active chip: `background-color: --brand-primary; color: --button-label-on-dark`. Inactive chip: `background-color: --brand-secondary; color: --brand-secondary-foreground`.

**Accommodation grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` with `gap-card`. Default 6 cards on the homepage (3x2). Configurable via `homepage-config.ts`.

**AccommodationCard fields:** Organic blob-masked image, name (Geologica Bold 20px), type badge (colored by type), location (city + province), price per night (Roboto Bold, `--brand-accent` color), rating stars + review count, featured badge when applicable. Amenity strip (up to 3 icons) with `aria-label` on each icon wrapper.

**Data:** Use placeholder data that matches the actual API response shape from `GET /api/v1/public/accommodations`. Ensure all field names, types, and value ranges match the real API schema. Do not invent fields that don't exist in the API. Analyze the Figma component variants to ensure all visual states are covered (with/without featured badge, with/without amenity icons, different accommodation types, price ranges).

**Filter chips behavior (hybrid):** Chips filter the homepage grid **in-page** (no navigation). The `FilterChips.client.tsx` React island manages toggle state. When a chip is clicked, the grid shows only cards matching that accommodation type (client-side filter on the already-loaded data). The "All" chip resets the filter to show all types. The mock data must include cards of multiple types so filtering is demonstrable. The accommodation cards themselves link to the listing page: `/{locale}/alojamientos/{slug}/`.

**AccommodationCard Figma variants:** The implementer must inspect the Figma component for all variant combinations (featured/not featured, with/without amenities, with/without rating, different type badges) and ensure the card component handles every case present in the design.

**Footer of section:** "Ver todos los alojamientos" CTA button, center-aligned, linking to `/{locale}/alojamientos/`. This is the only element in this section that navigates away from the homepage.

#### Section 4: CTA for Owners

> **Note:** This section replaces the existing `BestFeaturesBanner.astro` component from SPEC-048, which will be renamed to `CtaOwnersSection.astro` and reimplemented to match the Figma design. The existing `BestFeaturesBanner` and this "CTA for Owners" section are the same conceptual section.

**Layout:** Two-column. Left: decorative illustration or property image. Right: headline, description, feature list (3 items), primary CTA button.

**Headline:** Geologica Bold 48px.

**Feature list:** 3 items, each with an icon (from `@repo/icons`), feature title (Roboto SemiBold 16px), and one-line description (Roboto Regular 14px). Each icon has `aria-label` on its wrapping element.

> **i18n migration note:** The existing flat keys use a split pattern: `home.ownerCta.feature1` (title string) + `home.ownerCta.feature1Description` (description string), and similarly for `feature2`/`feature2Description` and `feature3`/`feature3Description`. These must be migrated to nested objects: `home.ownerCta.feature1.title` and `home.ownerCta.feature1.description` (and likewise for feature2, feature3). The old `feature1Description` keys must be removed after migration.

**Feature icons:** Each of the 3 feature items must use an icon that semantically matches its accompanying text. Icons from `@repo/icons`. Not generic/decorative — each icon must clearly represent the feature it describes.

**CTA button:** Primary gradient pill, `t('home.ownerCta.button')`. Links to `/suscriptores/propietarios/`.

**Left image animation:** The decorative image/illustration on the left side has a subtle randomized floating animation (similar to hero blob icons: small `translateX`/`translateY` movements, ~5-8px range, 4-5s duration, infinite loop). Disabled when `prefers-reduced-motion` is active.

> **Note:** A floating CTA button that appears after scrolling past this section was considered but is explicitly **out of scope** for this spec. See Section 10.

#### Section 5: Destinations

**Layout:** Left column (map, ~60%) + right column (carousel, ~40%) on desktop. On mobile, map collapses and carousel takes full width.

**Map:** The map MUST be a single SVG element with a `viewBox` defining the coordinate system. Destination pins are `<button>` elements positioned via percentage-based coordinates relative to the SVG `viewBox`. This ensures pins remain correctly positioned regardless of the SVG's rendered size (scaling, resizing, different viewports). Never use pixel-based absolute positioning for pins. Pins have `aria-label={destinationName}`.

**Map-carousel synchronization:**
- Clicking a map pin scrolls the carousel to the corresponding destination card and highlights it.
- Selecting a destination in the carousel highlights the corresponding pin on the map (bidirectional sync).
- The active destination's pin on the map should have a visually distinct state (e.g., larger size, different color, pulse animation).

**Destination carousel:** Embla Carousel. Navigation arrows + pagination dots. The carousel region has `aria-label` and `aria-live="polite"` on the visible slide window.

**Carousel behavior:**
- The carousel does NOT auto-play. It is only controlled by the user (arrows, dots, swipe, or map pin clicks).
- Three cards visible at a time: previous, active, and next.
- The previous and next cards have a **blur effect** (`filter: blur(2px)`) and **edge fade** using `mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)` so they don't show hard-cut borders as in the Figma.
- The active card is in full focus and slightly elevated.
- If fewer than 3 destinations exist, the carousel shows all available cards without blur on edge cards. If only 1 destination exists, carousel navigation arrows are hidden and only the single card is displayed.

Each card shows: destination image, name, province, accommodation count.

**Section background:** A subtle topographic line pattern SVG overlay at 3-5% opacity on top of the section's base background color. The pattern reinforces the geographic theme without competing with the map or carousel content.

**Data source:** `GET /api/v1/public/destinations?isFeatured=true`.

#### Section 6: About Us

**Layout:** Two-column. Left: photo collage (CSS Grid, overlapping images). Right: vertical stack with section title, descriptive text, key facts, and a secondary CTA.

**Photo collage:** 3-4 images arranged in an overlapping grid using `grid-row`/`grid-column` spans. No absolute positioning. Each image `object-fit: cover`. The collage has a decorative accent shape behind it (`aria-hidden="true"`).

**Text column:** Accent tagline + title (Geologica Bold 48px) + body paragraphs (Roboto Regular 16px, `--core-muted-foreground`) + secondary CTA button linking to `/nosotros/`.

**Decorative airplane illustrations:** The small airplane/travel illustrations visible in this section have subtle randomized floating animations (small `translateX`/`translateY` movements, ~5-8px range, randomized duration 3-5s, infinite loop with slight rotation ±3°). Implemented with CSS `@keyframes`. Disabled when `prefers-reduced-motion` is active. Images have `aria-hidden="true"` and `alt=""`.

**Data source:** Static content from i18n keys. No API call.

#### Section 7: Next Events

**Section header:** Same pattern as Section 3 (accent tagline + title + description).

**Grid:** `grid-cols-1 md:grid-cols-2` with `gap-card`. Up to 6 cards.

**EventCard fields:** Cover image, category badge, title (Geologica Bold 20px), date (formatted via `formatDate()`), location (city), short description.

**Category icon:** The icon displayed in the date area of each event card must correspond to the event's category (e.g., music icon for concerts, trophy for sports, palette for cultural events). Icons from `@repo/icons`.

**Destination link:** The event's location/destination text must be a navigable link to the destination detail page: `/{locale}/destinos/{destinationSlug}/`. Styled as subtle link (underline on hover, color change).

**Footer:** "Ver todos los eventos" CTA linking to `/eventos/`.

**Data source:** `GET /api/v1/public/events/upcoming?pageSize=6`.

#### Section 8: Stats

**Layout:** 5-column row on desktop (120+ alojamientos, 25 destinos, 500+ reseñas, 15 tipos de experiencias, 2000+ turistas).

**StatCard fields:** Numeric value (Geologica Bold 48px, `--brand-primary`), label (Roboto Regular 16px, `--core-muted-foreground`).

**Count-up animation:** When the section enters the viewport (IntersectionObserver), numeric values animate from 0 to their final value over 1.5 seconds using `requestAnimationFrame` with ease-out easing (`cubic-bezier(0.25, 0.46, 0.45, 0.94)`). Numbers with "+" suffix (e.g., "500+") animate to the base number and then the "+" appears. `prefers-reduced-motion`: skip animation, show final values immediately.

**Icon mapping:** Each stat card displays an icon from `@repo/icons`. The mapping is fixed:

| Stat | Icon | Icon name |
|---|---|---|
| Alojamientos | Building/house | `BuildingIcon` |
| Destinos | Map pin / location | `LocationIcon` |
| Reseñas | Star | `StarIcon` |
| Tipos de experiencia | Compass | `CompassIcon` |
| Turistas | Users/people | `UsersIcon` |

Each icon has `aria-hidden="true"` (the stat label provides the semantic meaning).

**Contrast:** If the background is a gradient, each stat card must have sufficient contrast (4.5:1 AA). A semi-opaque scrim or `text-shadow` must be applied if needed.

**Mobile:** 2x2 grid with the 5th stat card centered below on a third row.

**Data source:** Static values in `homepage-config.ts`. No public stats endpoint exists.

#### Section 9: Latest Articles

**Section header:** Same accent tagline + title + description pattern.

**Component architecture:** Three separate Astro components sharing a common utility:

1. `FeaturedArticleCard.astro` — Horizontal layout: image left, content right. Spans 2 grid columns.
2. `VerticalArticleCard.astro` — Vertical layout: image top, content below. Spans 2 grid rows.
3. `CompactArticleCard.astro` — Text-only layout: no image. Standard single cell.

Shared logic extracted to `src/lib/article-card-utils.ts` (NEW file to create):
- Tag truncation (max 3 visible tags + "+N more" badge showing remaining count)
- Excerpt truncation by variant
- Related entity link resolution (destination, accommodation, or event)
- Promoted badge logic
- Date/reading time formatting

Shared base props type: `ArticleCardBaseProps` in `src/data/types.ts`.
Shared CSS classes in `components.css` for common elements (`.article-card__tag`, `.article-card__meta`, `.article-card__author`, etc.).

**Bento grid (desktop):** CSS Grid with 2 columns and variable row heights.

| Card slot | Variant | Grid position |
|---|---|---|
| Card 1 | `FeaturedArticleCard` (image left, text right) | Column 1-2, Row 1 |
| Card 2 | `VerticalArticleCard` (image top, text below, tall) | Column 1, Row 2-3 |
| Card 3 | `CompactArticleCard` (no image, text only) | Column 2, Row 2 |
| Card 4 | `CompactArticleCard` (no image, text only) | Column 2, Row 3 |

**Mobile (< 768px):** All 4 cards render as standard single-column cards. `FeaturedArticleCard` and `VerticalArticleCard` use image-top layout. `CompactArticleCard` remains text-only (no image added on mobile). Bento grid collapses to single column with `gap: var(--space-card-gap)`.

**ArticleCard fields:** Category badge, title (Geologica Bold 20px or 24px depending on variant), publication date, author avatar + name, excerpt (text-only and horizontal-large variants only), reading time.

**Tags display:** Each article card shows a maximum of 3 tag badges. If the article has more than 3 tags, a 4th badge shows "+N" (e.g., "+2") indicating remaining tags count.

**Related entities:** Articles can have a related destination, accommodation, or event. Each related entity must render as a navigable link to its detail page:
- Destination: `/{locale}/destinos/{slug}/`
- Accommodation: `/{locale}/alojamientos/{slug}/`
- Event: `/{locale}/eventos/{slug}/`

Per-variant display rules:
- `FeaturedArticleCard`: Related entity shown below excerpt (optional — hidden if no relation exists).
- `VerticalArticleCard`: Related entity shown as a link below tags (always visible if relation exists).
- `CompactArticleCard`: Related entity NOT shown (space constraints).

**Promoted indicator:** Articles that are promoted/sponsored show a "Promocionado" badge (from i18n). The badge is visually distinct from category tags (different color scheme, e.g., `--brand-accent` background).

**Footer:** "Ver todos los artículos" CTA linking to `/blog/`.

**Data source:** `GET /api/v1/public/posts?sortBy=publishedAt&sortOrder=desc&pageSize=4`.

#### Section 10: Partners

**Section header:** Minimal header with `t('home.partners.title')`.

**Carousel behavior:**
- Horizontal carousel with autoplay (continuous slow scroll, ~30px/second).
- Autoplay **pauses on mouse hover** over the carousel area and **resumes on mouse leave**. Use Embla autoplay plugin with `{ stopOnMouseEnter: true, stopOnInteraction: false }` — the plugin's `pause()` method stores remaining time and `play()` resumes from where it paused.
- Each logo is wrapped in an `<a>` tag linking to the partner's URL (can be external or internal). External links open in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).
- Partner data includes `name`, `logoUrl`, `linkUrl`, and `isExternal` fields.

Each logo is an `<img>` with `alt="Logo de {partner name}"`.

**Mobile:** Same autoplay carousel behavior, touch-swipeable.

**Data source:** Static data in `src/data/homepage-partners.ts`. No partners endpoint exists.

#### Section 11: Testimonials

**Layout:** Left sidebar (~30%) with section title and subtitle. Right area (~70%) with carousel of 3 testimonial cards visible simultaneously on desktop.

**TestimonialCard fields:** Reviewer avatar (circular, 48px, with initials fallback if no image — initials are first letter of first name + first letter of last name, uppercase, on a `--brand-secondary` background with `--brand-primary` text), reviewer name (Roboto SemiBold 16px, truncated to 1 line with ellipsis), rating stars (with `aria-label` on container, `aria-hidden` on individual icons), review excerpt (Roboto Regular 14px, 3 lines max with text ellipsis), accommodation name and location.

**Carousel behavior:**
- Embla Carousel with **autoplay** enabled (advances every 5 seconds).
- Autoplay can be overridden by user interaction (arrow clicks, dot clicks, swipe). After user interaction, autoplay resumes after 8 seconds of inactivity. Embla autoplay plugin options: `{ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }`. The `stopOnInteraction: false` combined with Embla's internal timer ensures autoplay resumes automatically. Use `plugin.reset()` to restart the 5s timer after manual navigation.
- Navigation controlled by the left-side controls (previous/next arrows and pagination dots).
- Maximum **10 testimonials** loaded (even if API returns more).

**Pagination:** Dots below the carousel. Active dot: filled `--brand-primary`. Inactive: outlined. Clickable. The active dot scales to 1.15x on hover.

**Swipe support:** Embla Carousel with touch support enabled.

**Card height consistency:** All testimonial cards must have the same fixed height within a carousel page. Shorter reviews get extra padding to fill the space. Longer reviews are truncated with `line-clamp` and ellipsis. The fixed height is determined by the design (from Figma measurements).

**Entity links:** The accommodation or destination referenced in each testimonial must be a navigable link to its detail page. Styled as subtle link (color change + underline on hover).

**Data source:** Static mock data from `src/data/homepage-reviews.ts`. No public reviews endpoint exists. 3 cards per "page".

#### Section 12: Footer

**Background:** `--footer-bg` (`#0d1917`). Text: `--footer-fg`. Muted text: `--footer-fg-muted`.

**Layout:** 4-column grid on desktop (Logo + description + social icons | Nav col 1: DESCUBRI | Nav col 2: PROPIETARIOS | Nav col 3: EMPRESA).

**Newsletter strip (top of footer):** Full-width strip above the 4-column grid. Contains heading (`t('footer.newsletterTitle')`), description, and an email/WhatsApp input with submit button. The input placeholder is `t('footer.newsletter.placeholder')` ("Tu email o WhatsApp"). Form is a React island (`NewsletterForm.client.tsx`).

**PROPIETARIOS column** must include "Publicá tu alojamiento" as the first link in the column, linking to `/suscriptores/propietarios/`.

**Social icons:** Icon buttons for Facebook, Instagram, WhatsApp, X (Twitter). Each has `aria-label="{network name}"`.

**Copyright bar:** Full-width bottom strip with copyright text (dynamically including current year) and a brief legal disclaimer.

**Newsletter form:** The newsletter subscription form is **visual only in this phase** — no backend submission logic. The form renders with all visual states (default, focus, validation errors). The submit handler performs client-side validation only (email format via HTML5 `type="email"` + pattern check). On valid submission, the button is disabled and the form does nothing — no API call, no success message, no loading state. The form simply prevents submission. A `TODO` comment in the code must mark the submit handler for future API integration. Backend implementation is out of scope (listed in Section 10).

**Mobile:** The 4-column grid stacks into a single column with all sections always visible. Column headings remain as `<h3>` elements. No accordion or collapse behavior — all links are always accessible.

---

### 5. Design System Reference

All values below must be consumed as CSS custom properties. No hardcoded values in component markup or stylesheets.

#### 5.1 Colors

> **Implementation note:** The hex values in this table are the Figma reference values for visual identification. In `global.css`, tokens are implemented using **OKLCH color space** (e.g., `oklch(0.55 0.12 220)`) to support dark mode via relative color syntax. The implementer must convert Figma hex values to OKLCH equivalents when defining tokens. Use a tool like [oklch.com](https://oklch.com) for conversion.
>
> **Browser support caveat:** Basic `oklch()` has ~93% support. However, **relative color syntax** (`oklch(from var(--base) calc(l - 0.2) c h)`) has slightly lower support (~89-90%). Firefox has partial support from 128-132 (no `currentcolor`/system color keywords); full support starts at Firefox 133+. For this phase, define all dark mode token values explicitly (pre-computed OKLCH values) rather than relying on browser-side relative color syntax. Relative color syntax can be adopted when support reaches 95%+.

| Token | Value (Figma hex reference) | Usage |
|---|---|---|
| `--brand-primary` | `#3685fb` | Brand blue, active states, links, focus rings |
| `--brand-secondary` | `#e3f4ff` | Light blue, inactive chip backgrounds |
| `--brand-tertiary` | `#d6ebdc` | Light green, section backgrounds |
| `--brand-accent` | `#f07900` | Orange, prices, badges, high-emphasis CTAs |
| `--brand-secondary-foreground` | `#0c2442` | Dark navy, text on light brand backgrounds |
| `--core-foreground` | `#0b181c` | Near-black, primary text |
| `--core-background` | `#f9fafb` | Off-white, default page background |
| `--core-card` | `#ffffff` | White, card backgrounds |
| `--core-muted-foreground` | `#4a5568` | Gray, secondary text |
| `--brand-feature-strip` | `#72f595` | Green, amenity strip backgrounds |
| `--rating-star` | `#f59e0b` | Amber, star rating icons |
| `--footer-bg` | `#0d1917` | Dark green-black, footer background |
| `--footer-fg` | `#dee5eb` | Light gray, footer primary text |
| `--footer-fg-muted` | `#a6b2bf` | Muted gray, footer secondary text |
| `--button-label-on-light` | `#0b181c` | Button text on light backgrounds |
| `--button-label-on-dark` | `#e5edf5` | Button text on dark backgrounds |

**Phase 0 — Token Rename (prerequisite):** The current codebase in `global.css` uses unprefixed token names. Before any component work begins, all tokens must be renamed to use the `--brand-` and `--core-` prefixes shown above. This rename is a breaking change for other `web2` pages, which will be fixed when those pages are migrated in their respective specs.

| Current (unprefixed) | New (prefixed) |
|---|---|
| `--primary` | `--brand-primary` |
| `--secondary` | `--brand-secondary` |
| `--tertiary` | `--brand-tertiary` |
| `--accent` | `--brand-accent` |
| `--secondary-foreground` | `--brand-secondary-foreground` |
| `--feature-strip` | `--brand-feature-strip` |
| `--foreground` | `--core-foreground` |
| `--background` | `--core-background` |
| `--card` | `--core-card` |
| `--muted-foreground` | `--core-muted-foreground` |

#### 5.2 Typography

| Font | Weight | Sizes used | Purpose |
|---|---|---|---|
| Caveat | Bold | 32px (section taglines), 48px (logo), 64px (hero tagline) | Decorative, warm accent |
| Geologica | Bold | 20px (card titles), 24px (sub-headings), 48px (section titles), 96px (hero title) | Display headings |
| Roboto | Regular | 13-16px (body) | Body text, UI labels |
| Roboto | SemiBold | 14px | Labels, chip text |
| Roboto | Bold | 10-12px (badges), 14px | Badge text, price |
| Roboto | Medium | 12px | Button labels |

#### 5.3 Border Radius

Base variable: `--radius: 0.75rem` (12px).

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `calc(var(--radius) - 4px)` | Small elements, badges |
| `--radius-md` | `calc(var(--radius) - 2px)` | Cards, chips, input fields |
| `--radius-lg` | `var(--radius)` | Larger interactive elements |
| `--radius-xl` | `calc(var(--radius) + 4px)` | Larger containers |
| `--radius-card` | `24px` | Card containers |
| `--radius-pill` | `9999px` | Pills, avatars, dots, full-round elements |
| `--radius-button` | `8px` | Buttons |
| `--radius-organic` | `0px 100px` | Hospeda signature asymmetric border-radius |
| `--radius-organic-sm` | `0px 75px` | Smaller organic elements |
| `--radius-organic-alt` | `100px 0px` | Reversed organic (mirrored direction) |

> The `--radius-organic*` tokens are the visual signature of Hospeda's brand identity. They produce asymmetric, organic-feeling border radii and must be used on cards, images, and featured containers throughout the homepage.

#### 5.4 Spacing

The spacing system uses a hybrid approach: a base numeric scale plus semantic aliases.

**Base numeric scale** (defined in `global.css`): `--space-{n}` where `n` is the pixel value.

`--space-4: 4px`, `--space-8: 8px`, `--space-12: 12px`, `--space-16: 16px`, `--space-20: 20px`, `--space-24: 24px`, `--space-32: 32px`, `--space-40: 40px`, `--space-48: 48px`, `--space-64: 64px`, `--space-80: 80px`, `--space-96: 96px`, `--space-120: 120px`, `--space-160: 160px`.

**Semantic aliases** (built on top of the numeric scale):

| Token | Maps to | Usage |
|---|---|---|
| `--space-section` | `var(--space-120)` | Vertical padding between sections |
| `--space-section-sm` | `var(--space-80)` | Reduced section spacing on mobile |
| `--space-section-lg` | `var(--space-160)` | Larger section spacing for hero/CTA |
| `--space-container-x` | `15px` | Horizontal page margin |
| `--space-card-content` | `27px 30px 26px` | Internal card padding |
| `--space-card-gap` | `30px` | Gap between cards in grids |
| `--space-section-header-mb` | `50px` | Margin below section headers |

> Component layouts must use semantic tokens where one exists. For one-off spacing needs, use the numeric scale directly. Never hardcode pixel values.

#### 5.5 Modern CSS Features

The implementation must leverage these modern CSS features for cleaner, more maintainable code. All have 90%+ browser support (specific percentages noted where relevant).

| Feature | Usage |
|---|---|
| `clamp()` | All responsive typography and spacing. Extend beyond existing `--text-*` tokens to padding, gaps, and margins where values should scale with viewport. |
| `container queries (@container)` | Cards that must adapt to their container width, not the viewport. Register card wrappers as `container-type: inline-size` and use `@container` queries for card-internal layout changes. |
| `:has()` selector (~96%) | Parent styling based on child state. Primary use: search bar input groups (`.search-group:has(input:focus)` to highlight the entire group). Also useful for cards with optional elements. |
| `:focus-visible` | Focus rings only on keyboard navigation, not mouse clicks. Use `:focus-visible` instead of `:focus` for all custom focus indicators. |
| `scroll-snap` | Native carousel behavior on mobile for partners section and destination carousel fallback. `scroll-snap-type: x mandatory` on container, `scroll-snap-align: center` on items. |
| `aspect-ratio` | Fixed aspect ratios on all card images (`aspect-ratio: 16/9`, `4/3`, `1/1` depending on card type). Prevents CLS without padding hacks. |
| `color-mix()` | Dynamic hover states without creating new tokens. Example: `color-mix(in oklch, var(--brand-primary), black 10%)` for darkened hover variants. |
| `subgrid` | Align card content across grid siblings. Parent grid defines tracks, card uses `display: grid; grid-template-rows: subgrid` to align prices, titles, and ratings at the same vertical position. |
| `@layer` | CSS specificity organization: `@layer base, tokens, components, sections, utilities`. Prevents specificity wars between global and component styles. |
| `logical properties` | Use `margin-inline`, `padding-block`, `inset-inline` instead of directional properties. Future-proofs for potential RTL support. |

#### 5.6 Modern HTML Features

The implementation must use these semantic HTML features for better accessibility, reduced JavaScript, and native browser behavior. Browser support percentages noted where relevant.

| Feature | Usage |
|---|---|
| `<dialog>` (~97%) | Mobile search drawer, any modal overlays. Use `.showModal()` for modal behavior — it automatically makes background content inert, provides ESC-to-close, and `::backdrop` styling. No manual focus trap needed. |
| `loading="lazy"` (~97%) | All images below the fold. Native lazy loading without IntersectionObserver or libraries. |
| `decoding="async"` (~97%) | Paired with `loading="lazy"` on all non-critical images. Browser decodes on a separate thread, avoiding render blocking. |
| `fetchpriority="high"` (~93%) | Hero blob image (LCP candidate) and any above-the-fold critical images. Tells the browser to prioritize these resources. Alternatively, use Astro's `priority` prop on `<Image>` which sets `loading="eager"` + `decoding="sync"` + `fetchpriority="high"` automatically. |
| `<search>` (~89%) | Semantic wrapper for the hero search bar. Replaces `<div role="search">`. Degrades gracefully (treated as generic block element by older browsers). |
| `inert` attribute (~96%) | Applied to page content behind **non-dialog** modals only. When using `<dialog>.showModal()`, the browser handles inert behavior automatically — do NOT add `inert` manually in that case. Only needed if building custom overlays without `<dialog>`. |
| `popover` API (~90%) | Tooltips, dropdown menus in the search bar (guest counter, type selector). Native dismiss-on-outside-click via `popover="auto"`. **Note:** CSS Anchor Positioning (for auto-positioning relative to trigger) is a separate specification with lower support (~80%). For search bar dropdowns, use manual CSS positioning (absolute/relative) rather than relying on anchor positioning. |
| `<time datetime="">` (~99%) | All rendered dates (events, articles). Provides machine-readable dates for screen readers and search engines. |

---

### 6. Responsive Breakpoints

All breakpoints use `min-width` media queries (mobile-first).

| Breakpoint | Min-width | Key layout changes |
|---|---|---|
| xs | 320px | Baseline. Hero stacks vertically. Search bar 1 input per row. All grids 1-column. Stats 2x2 grid. Testimonials single card. Partners horizontal scroll. Footer stacks vertically (all sections visible). |
| sm | 640px | Accommodation grid 2 columns. Event grid still 1 column. |
| md | 768px | Hero reduced title size (64px). Search bar 2x2 grid. Event grid 2 columns. Destination map visible at reduced size. Stats 2-3 wrap. Footer 2x2 nav grid. |
| lg | 1024px | Hero full 2-column layout (60/40). Accommodation grid 3 columns. Destinations 2-column (map + carousel). Full footer 4-column. Stats 5-column. |
| xl | 1440px | Figma reference breakpoint. Full design at intended proportions. |
| 2xl | 2560px | Content constrained to `max-width: 1440px; margin: 0 auto`. Background extends to full viewport. |

---

### 7. Data Sources

> **API pagination note:** All list endpoints default to `pageSize=20`. The `pageSize` parameter MUST be passed explicitly in each request to get the desired number of items. Max `pageSize` is 100. All endpoints use `page` + `pageSize` pagination (NOT `offset` + `limit`). Response format: `{ items: [...], pagination: { page, pageSize, total, totalPages, hasNextPage, hasPreviousPage } }`.

| Section | API endpoint | Fallback |
|---|---|---|
| Featured Accommodations | `GET /api/v1/public/accommodations?isFeatured=true&pageSize=6` | Static mock data in `src/data/homepage-accommodations.ts` |
| Destinations | `GET /api/v1/public/destinations?isFeatured=true&pageSize=10` | Static mock data in `src/data/homepage-destinations.ts` |
| Next Events | `GET /api/v1/public/events/upcoming?pageSize=6&daysAhead=60` | Static mock data in `src/data/homepage-events.ts` |
| Latest Articles | `GET /api/v1/public/posts?sortBy=publishedAt&sortOrder=desc&pageSize=4` | Static mock data in `src/data/homepage-posts.ts` |
| Testimonials | Static mock data (no public reviews endpoint exists) | `src/data/homepage-reviews.ts` |
| Stats | Static values in `homepage-config.ts` (no public stats endpoint exists) | N/A |
| Partners | Static data in `src/data/homepage-partners.ts` (no partners endpoint exists) | N/A |
| About | Static i18n content | N/A |

> **Events endpoint note:** The `/events/upcoming` endpoint accepts a `daysAhead` parameter (default: 30, max: 365) controlling how far ahead to look for events. The homepage uses `daysAhead=60` to show a broader range. It also accepts optional `city`, `country`, and `maxPrice` filters. It does NOT accept `isFeatured` — all upcoming events are returned sorted by date.

> **Destinations endpoint note:** Pass `pageSize=10` (or the desired carousel item count) explicitly. The endpoint also accepts `includeEventCount=true` to enrich each destination with event counts.

Astro is configured with `output: 'server'` (SSR by default). The homepage uses `export const prerender = true` combined with `getStaticPaths()` for selective prerendering (hybrid mode). This means the homepage is statically generated at build time even though the app is SSR overall. The Vercel ISR config (`expiration: 86400`) does NOT apply to the homepage since it is prerendered — ISR only affects on-demand SSR pages.

**API client layer:** The implementation must create `apps/web2/src/lib/api/` following the same architecture as `apps/web/src/lib/api/`:
- `client.ts` — Typed fetch wrapper returning `ApiResult<T>` (`{ ok: true, data }` or `{ ok: false, error }`). Base URL from env config. 10s timeout.
- `endpoints.ts` — Public endpoint methods: `accommodationsApi.list()`, `destinationsApi.list()`, `eventsApi.listUpcoming()`, `postsApi.list()`.
- `transforms.ts` — API response → component props converters: `toAccommodationCardProps()`, `toDestinationCardProps()`, `toEventCardProps()`, `toPostCardProps()`.
- `types.ts` — Shared types: `ApiResult<T>`, `PaginationMeta`, `PaginatedResponse<T>`, `ApiError`.

**Data fetching strategy:** All data fetching happens at build time in each section's Astro component. Each section independently calls its API endpoint via the client layer. If the API call fails (network error, timeout, non-200), the section silently falls back to its static mock data file and logs the error via `@repo/logger`. The build must NEVER fail due to API unavailability. Pattern:

```typescript
const result = await accommodationsApi.list({ isFeatured: true, pageSize: 6 });
const items = result.ok ? result.data.items.map(toAccommodationCardProps) : fallbackAccommodations;
```

**Existing data files from SPEC-048:** Mock data files already exist and should be reused or extended as needed:
- `src/data/types.ts` — Type definitions (AccommodationCardData, DestinationCardData, EventCardData, BlogPostCardData, ReviewCardData, etc.)
- `src/data/homepage-config.ts` — Homepage configuration (hero images, rotation intervals, item counts)
- `src/data/homepage-accommodations.ts`, `homepage-destinations.ts`, `homepage-events.ts`, `homepage-posts.ts`, `homepage-reviews.ts`, `homepage-features.ts`, `homepage-partners.ts`, `homepage-stats.ts`

---

### 8. Component Architecture

#### Astro Components (static, server-rendered)

| Component | Path | Notes |
|---|---|---|
| `Header.astro` | `src/components/layout/Header.astro` | Includes mobile menu toggle via React island |
| `HeroSection.astro` | `src/components/sections/HeroSection.astro` | Contains `HeroSearchBar` React island |
| `FeaturedAccommodationsSection.astro` | `src/components/sections/FeaturedAccommodationsSection.astro` | Contains `FilterChips` React island |
| `AccommodationCard.astro` | `src/components/shared/AccommodationCard.astro` | Pure Astro, no interactivity needed. Already exists in `shared/` |
| `DestinationsSection.astro` | `src/components/sections/DestinationsSection.astro` | Contains `DestinationsCarousel` React island |
| `NextEventsSection.astro` | `src/components/sections/NextEventsSection.astro` | Pure Astro grid |
| `EventCard.astro` | `src/components/shared/EventCard.astro` | Pure Astro. Already exists in `shared/` |
| `CtaOwnersSection.astro` | `src/components/sections/CtaOwnersSection.astro` | Pure Astro |
| `LatestArticlesSection.astro` | `src/components/sections/LatestArticlesSection.astro` | Pure Astro bento grid |
| `FeaturedArticleCard.astro` | `src/components/shared/FeaturedArticleCard.astro` | NEW. Horizontal layout (image left, text right). See Section 7 |
| `VerticalArticleCard.astro` | `src/components/shared/VerticalArticleCard.astro` | NEW. Vertical layout (image top, text below, tall) |
| `CompactArticleCard.astro` | `src/components/shared/CompactArticleCard.astro` | NEW. Text-only layout (no image) |
| `AboutUsSection.astro` | `src/components/sections/AboutUsSection.astro` | Pure Astro |
| `PartnersSection.astro` | `src/components/sections/PartnersSection.astro` | Pure Astro |
| `StatsSection.astro` | `src/components/sections/StatsSection.astro` | Contains `AnimatedCounter` React island |
| `TestimonialsSection.astro` | `src/components/sections/TestimonialsSection.astro` | Contains `TestimonialsCarousel` React island |
| `Footer.astro` | `src/components/layout/Footer.astro` | Contains `NewsletterForm` React island. Mobile: columns stack vertically, no accordion |

#### React Islands (interactive, `client:idle` or `client:visible`)

| Island | Directive | Purpose |
|---|---|---|
| `MobileMenu.client.tsx` | `client:idle` | Full-screen overlay menu, scroll lock, ESC handler |
| `HeroSearchBar.client.tsx` | `client:idle` | Select dropdowns, date inputs, guest counter |
| `FilterChips.client.tsx` | `client:visible` | Toggle state for accommodation type filter |
| `DestinationsCarousel.client.tsx` | `client:visible` | Embla Carousel with pin-to-card sync |
| `AnimatedCounter.client.tsx` | `client:visible` | Number animation on viewport entry |
| `TestimonialsCarousel.client.tsx` | `client:visible` | Embla Carousel with pagination dots |
| `NewsletterForm.client.tsx` | `client:visible` | Form submission, validation, success state |

> **Locale prop threading:** Astro components access the locale via `const locale = Astro.locals.locale` or receive it as a prop from the page. React islands MUST receive `locale` as an explicit prop (they cannot access `Astro.locals`). Every React island interface includes `locale: 'es' | 'en' | 'pt'` as a required prop.

> Each React island uses a co-located CSS Module file (e.g., `TestimonialsCarousel.module.css` alongside `TestimonialsCarousel.client.tsx`). Styles in CSS Modules use camelCase class names and consume global CSS custom properties via `var()`. No inline styles or hardcoded values.

#### Existing Utilities

The implementation must use these existing utility files in `apps/web2/src/lib/`:

- `src/lib/cn.ts` — Conditional class joining (clsx wrapper)
- `src/lib/colors.ts` — Color mapping by entity type (accommodation type, event category, post category, destination). Returns `ColorScheme` objects for dynamic badge/label coloring.
- `src/lib/format-utils.ts` — Locale-aware formatting: `formatPrice()`, `formatDate()`, `formatRelativeTime()`, `formatNumber()`
- `src/lib/i18n.ts` — Translation helpers: `createTranslations()`, `createT()`
- `src/lib/urls.ts` — URL builder: `buildUrl({ locale, path })`, `buildUrlWithParams()`
- `src/lib/scroll-reveal.ts` — IntersectionObserver-based scroll animation system (already used by SPEC-048 components)

#### Existing Shared Components (from SPEC-048)

These shared components already exist and must be reused rather than reimplemented:

- `src/components/shared/Badge.astro`, `BadgeRow.astro` — Color-coded badges
- `src/components/shared/RatingStars.astro` — Star rating display
- `src/components/shared/SectionHeader.astro` — Section title with tagline/description
- `src/components/shared/FeatureItem.astro` — Feature/benefit tile
- `src/components/shared/GradientButton.astro` — CTA button with gradient
- `src/components/shared/Logo.astro` — Brand logo
- `src/components/shared/SkipToContent.astro` — Accessibility skip link
- `src/components/shared/ScrollToTop.astro` — Floating scroll-to-top button
- `src/components/shared/SocialLinks.astro` — Social media links
- `src/components/shared/NavMenu.astro` — Navigation menu
- `src/components/shared/NewsletterForm.astro` — Newsletter signup (Astro version)

#### SPEC-048 to SPEC-065 Component Rename Mapping

The following table maps existing SPEC-048 component names to their SPEC-065 names, so the implementer knows exactly what to rename:

| SPEC-048 (current name) | SPEC-065 (new name) | Notes |
|---|---|---|
| `HeroSection.astro` | `HeroSection.astro` | No change |
| `AccommodationsSection.astro` | `FeaturedAccommodationsSection.astro` | Rename |
| `BestFeaturesBanner.astro` | `CtaOwnersSection.astro` | Rename + reimplement per Figma |
| `DestinationsSection.astro` | `DestinationsSection.astro` | No change |
| `AboutSection.astro` | `AboutUsSection.astro` | Rename |
| `EventsSection.astro` | `NextEventsSection.astro` | Rename |
| `FeaturesCtaSection.astro` | *(removed or merged)* | Evaluate if Figma has this section; if not, remove |
| `PartnersSection.astro` | `PartnersSection.astro` | No change |
| `PostsSection.astro` | `LatestArticlesSection.astro` | Rename |
| `ReviewsSection.astro` | `TestimonialsSection.astro` | Rename |
| `StatsSection.astro` | `StatsSection.astro` | No change |
| `HeroImageRotator.client.tsx` | `HeroSearchBar.client.tsx` | Replace (different component) |
| `DestinationCarousel.client.tsx` | `DestinationsCarousel.client.tsx` | Rename (plural) |
| `PostCarousel.client.tsx` | *(removed)* | Posts section becomes static bento grid |
| `ReviewCarousel.client.tsx` | `TestimonialsCarousel.client.tsx` | Rename |
| `StatCounter.client.tsx` | `AnimatedCounter.client.tsx` | Rename |
| `MobileMenu.client.tsx` | `MobileMenu.client.tsx` | No change |
| `SearchBar.astro` | *(absorbed into `HeroSearchBar.client.tsx`)* | Static search bar replaced by interactive React island |
| `DestinationCard.tsx` (React) | `DestinationCard.astro` | Convert to Astro if carousel wrapper handles all interactivity; keep as `.tsx` only if card itself needs client-side state |
| `PostCard.tsx` (React) | *(replaced by 3 article card components)* | See Section 7: `FeaturedArticleCard.astro`, `VerticalArticleCard.astro`, `CompactArticleCard.astro` |
| `ReviewCard.tsx` (React) | `TestimonialCard.astro` | Convert to Astro; carousel wrapper (`TestimonialsCarousel.client.tsx`) handles interactivity |

Co-located CSS Module files must be renamed accordingly (e.g., `ReviewCarousel.module.css` → `TestimonialsCarousel.module.css`). CSS Modules for removed React card components (`PostCard.module.css`, `ReviewCard.module.css`, `DestinationCard.module.css`) should be deleted and their styles migrated to Astro scoped `<style>` blocks or `components.css`.

#### Implementation Rules

**Astro View Transitions:** The site uses Astro View Transitions (`<ClientRouter />`) for smooth page-to-page transitions. All internal navigation links must work correctly with view transitions. Components must not hold state that breaks on transition.

**Image optimization:** ALL images must use Astro's `<Image>` component (`import { Image } from 'astro:assets'`) for local/imported images, or `<img>` with `loading="lazy"` and `decoding="async"` for remote/dynamic images. Never use raw `<img>` tags for local images. Always provide `width` and `height` attributes to prevent CLS. For LCP images (hero blob), use Astro's `priority` prop which automatically sets `loading="eager"`, `decoding="sync"`, and `fetchpriority="high"`. For other above-the-fold images, use `fetchpriority="high"` manually.

**Icons:** ALL icons must come from `@repo/icons` via the icon resolver. No inline SVGs, no direct phosphor-react imports, no icon CDNs.

**Section backgrounds:** Section background colors must always span the full viewport width (`width: 100vw` or `margin-inline` negative technique), even when the section content is constrained to `max-width`. The content container centers within the full-width background.

**CSS organization:**
- Reusable styles shared by multiple components → `global.css` or `components.css`
- Component-specific styles → Astro scoped `<style>` blocks or co-located CSS Modules (for React islands)
- No duplicate style definitions across components

**Componentization:** Every visually distinct, reusable piece must be its own component. Prefer many small focused components over few large ones. If a pattern appears in 2+ sections, extract it.

---

### 9. i18n Requirements

All user-facing text must use `@repo/i18n` locale files. The primary locale is `es` (Spanish, Argentina).

Locale files affected: `packages/i18n/src/locales/{es,en,pt}/home.json` and `packages/i18n/src/locales/{es,en,pt}/footer.json`.

Missing keys that must be added (to all three locales) before implementation begins:

- `home.hero.tagline`
- `home.hero.secondaryCta`
- `home.hero.imageAlt`
- `home.featuredAccommodations.emptyState`
- `home.featuredAccommodations.noReviews`
- `home.featuredDestinations.ariaLabel`
- `home.featuredDestinations.emptyState`
- `home.upcomingEvents.emptyState`
- `home.latestPosts.emptyState`
- `home.ownerCta.feature1.title`
- `home.ownerCta.feature1.description`
- `home.ownerCta.feature2.title`
- `home.ownerCta.feature2.description`
- `home.ownerCta.feature3.title`
- `home.ownerCta.feature3.description`
- `footer.newsletter.placeholder`
- `footer.newsletter.errorMessage`
- `common.carousel.previousSlide`
- `common.carousel.nextSlide`
- `common.skipToContent`
- `common.scrollToTop`

> **i18n migration note:** The existing flat keys `home.ownerCta.feature1`, `feature2`, `feature3` (plain strings) must be migrated to nested objects with `.title` and `.description` subkeys.

> **Existing keys that are already present and should NOT be recreated:** `home.hero.title`, `home.hero.subtitle`, `home.featuredAccommodations.title`, `home.featuredAccommodations.accentSubtitle`, `home.statistics.*`, `home.testimonials.regionAriaLabel`, `footer.newsletterTitle`, `footer.newsletterDescription`.
>
> **Additional existing key namespaces** (present in locale files from SPEC-048, available for reuse):
> - `home.heroCarousel.*` — accentSubtitle, headline, subheadline, stats, phrases (8 phrase keys)
> - `home.searchBar.*` — 14 keys for input placeholders, labels, aria, button text
> - `home.counter.*` — accommodations.label, destinations.label (count-up labels)
> - `home.categories.*` — title, accentSubtitle, and 6 accommodation type labels
> - `home.about.*` — title, accentSubtitle, description, feature1/2 with title/description
> - `home.newsletter.*` — title, accentSubtitle, alreadySubscribed
> - `home.partners.title` — partners section title
> - `home.sections.*` — navigation/section display names
> - `home.page.*` — page title and meta description for SEO
> - `home.ownerCta.*` — title, accentSubtitle, description, button, statsLabel, feature1-3 (flat keys, see migration note above)
>
> The implementer should review the full key inventory in `packages/i18n/src/locales/es/home.json` before creating new keys, to avoid duplicates or inconsistent naming.

---

### 10. Out of Scope

The following items are explicitly excluded from this specification. They belong to separate specs or future iterations.

| Item | Reason |
|---|---|
| Dark mode | The design system has dark mode tokens but the Figma dark design has not been created. |
| Mobile-specific Figma design refinements | Responsive layouts are defined in this spec at a code level, not from a separate Figma mobile frame. A dedicated mobile Figma pass may produce a future SPEC. |
| Authentication flows in the header | Login, registration, and user avatar menu are part of the auth system. The header renders a static "Ingresar" link in this phase. |
| Functional search (backend) | The search bar is visually complete but non-functional. Backend search is a separate feature. |
| Article detail pages | This spec covers only the homepage article cards. Detail page design is out of scope. |
| Destination detail pages | The carousel navigates to existing destination pages if they exist; new pages are out of scope. |
| Newsletter backend submission | The form is visual only with mock success state. No public newsletter subscription endpoint exists. Backend subscription service is out of scope. |
| E2E automated tests | Playwright E2E tests for the full page are out of scope for this spec. Visual regression tests are a future concern. |
| Performance budget enforcement CI gates | Lighthouse CI gates are a desirable future addition but are not part of this spec's implementation tasks. |
| Scroll reveal / entrance animations | Deferred to a future iteration. Components render in final state immediately. |
| Parallax background images on sections | Considered but deferred. Only the hero blob image uses parallax in this phase. |
| Floating CTA button | A floating "Publicá tu alojamiento" button that appears after scrolling past the CTA Owners section was considered but deferred. |
| Existing CSS/JS deletion without review | Any CSS classes, JS utilities, or components from SPEC-048 that are unused by the new homepage must be flagged for review before deletion, as they may be used by other web2 pages. |

---

### 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| API endpoints return unexpected data shapes | Medium | High | Static fallback data prevents broken builds. The API client layer uses `ApiResult<T>` type-safe responses. If the response shape is unexpected, the `ok: false` path triggers fallback to mock data. Runtime Zod validation on API responses is deferred to SPEC-062. |
| Blob SVG mask path differs from SPEC-048 implementation | Low | Medium | Treat the Figma blob path as the definitive source. Compare SVG paths against the Figma node before implementation. |
| Embla Carousel upgrade breaking changes | Low | Low | Pin Embla to `^8.6.0` (latest stable 8.x). **Note:** The current `package.json` has `^8.5.1` for both `embla-carousel-react` and `embla-carousel-autoplay` — these must be upgraded to `^8.6.0` as a Phase 0 prerequisite. v9 is in early release candidate stage (only `9.0.0-rc01` exists, no stable release). The v8 API uses `scrollTo(index)` for programmatic scrolling. Do not upgrade to v9 until it reaches stable and all carousel code is audited. |
| Missing i18n keys block build | Medium | High | All missing keys listed in Section 9 must be added as the first implementation task, before any component work. |
| Map SVG pin positioning breaks on non-1440px viewports | Medium | Medium | Use percentage-based `top`/`left` relative to the SVG viewBox, not fixed pixel values. |
| SPEC-062 field stripping affects public API responses | Low | Low | SPEC-062 (Runtime Response Validation) strips admin-only fields from public endpoints. Homepage only uses public fields (title, images, description, etc.) so impact is minimal. However, if SPEC-062 completes after SPEC-065 and strips a field the homepage consumes, the static fallback data prevents build failures. Soft dependency: prefer completing SPEC-062 before SPEC-065 enters production. **Pre-implementation audit**: verify that `PublicSchema` definitions in `packages/schemas/src/entities/*/access.schema.ts` include ALL fields needed by the homepage for these 5 entities: `Accommodation`, `Destination`, `Event`, `Post`, `AccommodationReview`. |
| CLS from images without explicit dimensions | Medium | High | Always provide `width` and `height` on all `<Image>` components. Use `aspect-ratio` CSS on containers. |
| SPEC-063 `lifecycleState` in public tier | Low | Medium | SPEC-063 adds `lifecycleState` to AccommodationReview. If exposed in `AccommodationReviewPublicSchema`, the homepage must filter testimonials by `lifecycleState=ACTIVE`. Coordinate with SPEC-063 implementer on public tier inclusion. If NOT exposed, the API layer handles filtering internally. |

---

### 12. Edge Cases

| Scenario | Behavior |
|---|---|
| JavaScript disabled | Page renders all static sections normally (Astro SSG). React islands (carousels, filters, counters) show their initial static content without interactivity. Carousels display all cards in a horizontal scrollable row via CSS `overflow-x: auto` + `scroll-snap`. Filter chips are hidden (require JS). Stats show final values without animation. |
| Viewport < 320px | Content constrained to 320px `min-width`. Horizontal overflow hidden. Test at 280px to verify no content breaks or horizontal scrollbar appears. |
| Viewport > 2560px | Content centers at `max-width: 1440px; margin: 0 auto`. Section backgrounds extend to full viewport width. Tested up to 3840px. |
| Very long card titles | Card titles truncated to 2 lines with `text-overflow: ellipsis` and `-webkit-line-clamp: 2`. |
| Very long reviewer names | Reviewer name truncated to 1 line with ellipsis. |
| Article with > 3 tags | First 3 tags shown as badges + a "+N" badge (e.g., "+2") for remaining count. |
| Accommodation without amenities | Amenity strip row is hidden. Card layout adjusts (no empty space). |
| Mixed content: articles without images | If a `FeaturedArticleCard` or `VerticalArticleCard` has no image, fall back to a placeholder gradient background using `--brand-secondary`. `CompactArticleCard` never shows images by design. |
| Destination carousel with < 3 cards | Show all available cards without edge blur. If 1 card, hide navigation arrows. |
| Button text on narrow viewports | Primary CTA buttons use `white-space: nowrap` and never truncate. Secondary CTA buttons allow wrapping to 2 lines if needed. |

---

### 13. Implementation Sequence

Tasks must be executed in this order. Each phase can contain parallel work within it.

**Phase 0 — Prerequisites (must complete before any component work):**
1. Rename all CSS tokens in `global.css` per the rename table in Section 5.1 (breaking change for other pages — acceptable per Guiding Principles).
2. Add all missing i18n keys listed in Section 9 to `packages/i18n/src/locales/{es,en,pt}/home.json` and `common.json`. Migrate `ownerCta` feature keys from flat to nested structure (see migration note in Section 9).
3. Upgrade `embla-carousel-react` and `embla-carousel-autoplay` from `^8.5.1` to `^8.6.0` in `apps/web2/package.json`. Run `pnpm install` to update lockfile.
4. Create the API client layer in `apps/web2/src/lib/api/` (adapted from `apps/web/src/lib/api/`): `client.ts`, `endpoints.ts`, `transforms.ts`, `types.ts`.
5. Rename existing SPEC-048 components per the rename mapping table in Section 8 (update all imports in `[lang]/index.astro` and any other consumers). Delete old files after verifying no orphaned imports.
6. Update `src/data/types.ts` (file already exists from SPEC-048) with any additional shared card prop types needed (`AccommodationCardData`, `DestinationCardData`, `EventCardData`, `BlogPostCardData`, `ReviewCardData`). Verify existing type definitions match the API response shapes before adding new ones.
7. Remove `FeaturesCtaSection.astro` (duplicate of `BestFeaturesBanner.astro`, which gets renamed to `CtaOwnersSection.astro`).

**Phase 1 — Static sections (no React islands needed):**
8. Header (`Header.astro`) — sticky behavior, scroll transparency, responsive collapse.
9. Hero section — text stack, blob image with crossfade (React island), social proof row, secondary CTA.
10. About Us section — photo collage grid, text column, decorative animations.
11. CTA for Owners section — feature list, primary CTA, decorative animation.
12. Stats section — 5-column grid, icon mapping, mobile 2x2 layout.
13. Footer — 4-column grid, social icons, copyright bar, newsletter form shell.

**Phase 2 — Data-driven sections (API integration + grids):**
14. Featured Accommodations — grid, AccommodationCard updates, empty/loading states.
15. Next Events — grid, EventCard updates, category icons, destination links.
16. Latest Articles — bento grid, 3 new article card components, `article-card-utils.ts`.
17. Partners — autoplay carousel, logo styling.

**Phase 3 — Interactive islands:**
18. `FilterChips.client.tsx` — toggle state, client-side filtering.
19. `HeroSearchBar.client.tsx` — select dropdowns, date inputs, guest counter, mobile dialog drawer.
20. `DestinationsCarousel.client.tsx` — Embla carousel, map-pin synchronization.
21. `TestimonialsCarousel.client.tsx` — Embla carousel, autoplay, pagination dots.
22. `AnimatedCounter.client.tsx` — IntersectionObserver, count-up animation.
23. `NewsletterForm.client.tsx` — validation-only form (no submission).
24. `MobileMenu.client.tsx` — full-screen overlay, scroll lock, ESC handler.

**Phase 4 — Polish & QA:**
25. Responsive testing at all 6 breakpoints (320, 640, 768, 1024, 1440, 2560px).
26. Accessibility audit: keyboard navigation, screen reader testing, contrast checks.
27. Lighthouse performance check (target >= 90 on mobile 3G).
28. CLS verification (target < 0.1) on desktop and mobile.
29. Cross-browser testing (Chrome, Firefox, Safari, Edge).

---

### 14. Test Strategy

**React islands** (Vitest + Testing Library):
- Each React island has a co-located `*.test.tsx` file.
- Carousel tests: correct slide count, `scrollTo(index)` navigation, touch swipe simulation, autoplay start/pause/resume, pagination dot state sync.
- FilterChips tests: toggle activation, "All" reset, keyboard Enter/Space, aria-pressed state.
- AnimatedCounter tests: counts from 0 to target, respects `prefers-reduced-motion`, "+" suffix appears after count completes.
- NewsletterForm tests: email validation (valid/invalid), submit prevention, error message display.
- HeroSearchBar tests: dropdown open/close, guest increment/decrement (min 1 adult, min 0 children), mobile dialog open/close.
- Minimum 90% coverage per island.

**Astro components** (Vitest):
- Card components: render all field combinations (with/without image, with/without rating, with/without amenities, with/without featured badge).
- Section components: render with mock data, render empty state, render with fallback data.
- Snapshot tests for static card rendering (detect unintended visual regressions).

**Integration** (manual checklist, not automated in this spec):
- All 12 sections render in correct order on `/{locale}/` for each locale.
- Internal links resolve correctly (accommodation → `/alojamientos/{slug}/`, etc.).
- Images load with correct `width`, `height`, `loading`, and `decoding` attributes.

---

## Part 2 — Technical Notes (Non-Prescriptive)

> These notes capture implementation context gathered during the Figma review. They are observations, not requirements. The `tech-analyzer` agent decides on the final technical approach.
>
> **Astro version:** The project uses Astro 5.x (`^5.9.0` in `package.json`, latest 5.x is 5.18.1). Astro 6 has been released (6.1.3) but migration is out of scope for this spec. All Astro APIs referenced in this spec (selective prerendering, `<Image>`, `<ClientRouter>`, view transitions) are stable in Astro 5.x. Note: `<Image priority>` prop was added in `astro@5.10.0` — resolved by the `^5.9.0` range.

- The hero search bar is absolutely positioned in Figma and overlaps the bottom edge of the hero and the top of the accommodations section. In code, CSS Grid `grid-template-rows` overlap or negative `margin-top` on the following section can produce this without absolute positioning, preventing CLS.
- The map of Entre Rios in the Destinations section has 20+ absolute-positioned pin layers in Figma. These are not interactive in Figma. In code, the map should be a single SVG with `<button>` elements inside it. The SVG viewBox defines the coordinate system and pins use `x`/`y` percentage offsets within that viewBox.
- The Article bento grid in Figma is a flat set of frames, not a component hierarchy. Code uses three separate Astro components (`FeaturedArticleCard`, `VerticalArticleCard`, `CompactArticleCard`) sharing a common utility file (`article-card-utils.ts`) — see Section 7 for details.
- The stats section background in the Figma design is a gradient. If stat numbers are rendered directly on top of the gradient without a scrim, contrast ratios for `--core-muted-foreground` on that gradient may fail AA. This is not correctable in Figma and must be resolved in code.
- The footer newsletter area was added to Figma after the initial design pass. The input has a placeholder "Tu email o WhatsApp". The WhatsApp subscription option (send a WhatsApp message to subscribe) is a nice-to-have interaction that can be deferred to a secondary phase.

---

## Revision Log

### Revision 1 — 2026-04-02

**Reviewer:** Automated spec audit (exhaustive analysis pass)

**Changes applied:**

1. **[CRITICAL FIX]** Embla API method: `goTo(index)` → `scrollTo(index)` (2 occurrences). The v8 API uses `scrollTo()`, not `goTo()`.
2. **[CRITICAL FIX]** Section order realigned to match Figma frame hierarchy (source of truth). Sections renumbered 1-12.
3. **[FIX]** CTA for Owners layout: Image moved to LEFT column, text/features to RIGHT column (matching Figma).
4. **[FIX]** US-065-08 newsletter acceptance criteria: Removed success message and loading state criteria. Form is visual-only with client-side validation. Backend deferred.
5. **[FIX]** i18n key names updated to match existing locale file structure (`featuredDestinations`, `upcomingEvents`, `latestPosts`, `statistics`, `regionAriaLabel`, `footer.*`).
6. **[FIX]** Feature keys: Documented migration from flat strings to nested `.title`/`.description` objects.
7. **[FIX]** Added `common.scrollToTop` to missing i18n keys list.
8. **[FIX]** ~~Astro latest 5.x version corrected: 5.18.0 (not 5.18.1)~~ — *Reverted in Revision 3: 5.18.1 is the correct latest 5.x.*
9. **[FIX]** OKLCH browser support corrected: ~93% (not ~95%).
10. **[FIX]** Relative color syntax support corrected: ~89-90% (not ~90-92%).
11. **[FIX]** Pagination response: Documented `hasNextPage` and `hasPreviousPage` fields.
12. **[FIX]** Documented existing i18n keys that should NOT be recreated.

### Revision 2 — 2026-04-02

**Reviewer:** Exhaustive cross-analysis (codebase + sibling specs + external libs + i18n audit)

**Analysis scope:** 4 parallel audits: (1) web2 codebase verification, (2) SPEC-050 to SPEC-064 overlap analysis, (3) external library/browser API verification, (4) i18n key inventory.

**Changes applied:**

1. **[FIX]** Stats icon mapping: `MapPinIcon` → `LocationIcon`. The `@repo/icons` package exports `LocationIcon` (wrapping Phosphor's MapPin), not `MapPinIcon`.
2. **[FIX]** Phase 0 task 5: Changed "Create `src/data/types.ts`" to "Update" — file already exists from SPEC-048.
3. **[FIX]** ownerCta i18n migration note: Corrected current structure description. Actual structure uses `feature1` + `feature1Description` split pattern (not just a single flat string per feature). Migration now documents removing old `*Description` keys.
4. **[FIX]** Firefox relative color syntax: Clarified that Firefox 128-132 has partial support (no `currentcolor`/system color keywords); full support starts at Firefox 133+.
5. **[FIX]** Embla upgrade: Added explicit note that current `package.json` has `^8.5.1` and must be upgraded to `^8.6.0`. Added as Phase 0 task 3.
6. **[FIX]** Phase 0 tasks renumbered (1-7) after inserting Embla upgrade task. All subsequent phase task numbers updated accordingly (total: 29 tasks, up from 28).
7. **[ENHANCEMENT]** i18n Section 9: Added comprehensive inventory of ALL existing key namespaces from SPEC-048 (`heroCarousel`, `searchBar`, `counter`, `categories`, `about`, `newsletter`, `partners`, `sections`, `page`, `ownerCta`) so implementer knows what's already available.
8. **[ENHANCEMENT]** Risks table: Added SPEC-062 (Runtime Response Validation) as a soft dependency. Public endpoints may have fields stripped after SPEC-062 completes, but fallback data prevents build failures.
9. **[ENHANCEMENT]** Phase 0 task 2: Added explicit instruction to migrate ownerCta feature keys from flat to nested structure.

**No changes required (verified correct):**
- All external library/browser support claims verified accurate (Embla v8 API, OKLCH, dialog, popover, container queries, etc.) except Astro 5.x latest version (corrected in Revision 3)
- All existing components, utilities, and data files from SPEC-048 confirmed present in codebase
- All 4 public API endpoints confirmed to exist with correct query params
- Zero contradictions found with SPEC-050 through SPEC-064
- All 21 "missing" i18n keys confirmed absent; all 8 "existing" keys confirmed present
- All 3 locales (es, en, pt) confirmed in perfect sync

### Revision 3 — 2026-04-02

**Reviewer:** Exhaustive 3-agent parallel audit (codebase verification + sibling spec overlap + external library verification)

**Analysis scope:** (1) All SPEC-065 codebase claims verified against actual files, (2) All 15 sibling specs (SPEC-050 to SPEC-064) checked for overlaps/contradictions, (3) 22 external library/browser API claims verified via documentation and web search.

**Changes applied:**

1. **[FIX]** Astro 5.x latest version: Reverted Revision 1's incorrect correction. Latest 5.x is **5.18.1** (not 5.18.0). Added note that `<Image priority>` prop requires `astro@5.10.0+` (resolved by `^5.9.0` range).
2. **[ENHANCEMENT]** Embla autoplay plugin: Added exact configuration options for testimonials carousel (`delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true`) and `plugin.reset()` method for timer restart after manual navigation.
3. **[ENHANCEMENT]** Partners carousel autoplay: Added Embla autoplay plugin details (`stopOnMouseEnter: true, stopOnInteraction: false`) and documented `pause()`/`play()` API for mouse enter/leave behavior.
4. **[ENHANCEMENT]** Risks table: Added SPEC-063 `lifecycleState` coordination risk for AccommodationReview public tier exposure.
5. **[ENHANCEMENT]** SPEC-062 risk entry: Added explicit pre-implementation audit checklist — verify `PublicSchema` for 5 entities (Accommodation, Destination, Event, Post, AccommodationReview) includes all homepage-required fields.

**Verification results (no changes needed):**
- **Codebase**: All 13 groups of claims verified (components, data files, utilities, icons, API routes, package versions, CSS tokens, i18n keys, Astro config, homepage page file). Zero discrepancies beyond the 2 already documented as Phase 0 prerequisites (token rename + i18n migration).
- **Sibling specs**: Zero critical contradictions across all 15 specs. SPEC-062 (field stripping) and SPEC-063 (lifecycleState) identified as coordination points — now documented in Risks table.
- **External libraries**: 21 of 22 claims verified correct. 1 correction applied (Astro version). All browser support percentages accurate to within 1-2%.
- **Total revision passes completed: 3**
