# SPEC-065: Web2 Homepage Figma Match - Execution Plan

## Figma Reference
- **File**: ZBq2Rv2Dj0NaQfwbeoZgLB
- **Page node**: 20:3 (Desktop)
- **URL**: https://www.figma.com/design/ZBq2Rv2Dj0NaQfwbeoZgLB/HOSPEDA?node-id=20-3

## Status Key
- DONE = Completed and verified
- TODO = Not started
- PARTIAL = Some work done, needs finishing

---

## Phase 0: Section Order Fix (DONE)

The homepage section order in `apps/web2/src/pages/[lang]/index.astro` does NOT match Figma.

**Current web2 order:**
1. Hero
2. FeaturedAccommodations
3. CtaOwners ← WRONG POSITION
4. Destinations
5. About
6. NextEvents
7. Partners ← WRONG POSITION
8. LatestArticles
9. Testimonials
10. Stats

**Figma order (correct):**
1. Hero
2. FeaturedAccommodations
3. Destinations
4. NextEvents
5. About
6. LatestArticles
7. Testimonials
8. CtaOwners
9. Stats
10. Partners

**Action**: Reorder section imports in `[lang]/index.astro` to match Figma.

---

## Phase 1: Hero Section (DONE)

- **Figma node**: 21:1665
- **File**: `apps/web2/src/components/sections/HeroSection.astro`
- **Changes completed**:
  - Blob clip-path flipped vertically (scaleY(-1))
  - Blob bg shadow color/position adjusted
  - Blob accent replaced (blue pin shapes from web-test)
  - Floating icons: 136px container, deco arrows positioned to wrap circles
  - Social proof shifted right (margin-left: 240px)
  - SearchBar restyled: pill button, 16px icons, correct placeholders
  - Design tokens corrected (brand-primary, brand-secondary-fg, core-muted-fg, rating-star)
  - i18n texts updated (tagline, title, subtitle, CTA)

---

## Phase 2: Featured Accommodations (DONE)

- **Figma node**: 21:1666
- **File**: `apps/web2/src/components/sections/FeaturedAccommodationsSection.astro`
- **Changes completed**:
  - SectionHeader: added `actionLabel`/`actionHref` props for inline pill button
  - Header alignment changed to `left` with "Ver todos los alojamientos →" pill at right
  - Badge row: added `uniformDark` prop for filled-dark badges (all same style)
  - Badge.astro: added `variant="filled-dark"` support
  - Grid changed from 4 columns to 3 columns (3x2 layout)
  - Removed bottom CTA GradientButton (not in Figma)
  - Badge order updated to match Figma (country_house, cabin, camping, etc.)
  - Action button vertically aligned with title area

---

## Phase 3: Destinations (DONE)

- **Figma node**: 687:2559
- **Files modified**:
  - `apps/web2/src/components/sections/DestinationsSection.astro` - Rewritten wrapper, padding/overflow fixes
  - `apps/web2/src/components/sections/DestinationsIsland.client.tsx` - NEW: main React island (map + carousel)
  - `apps/web2/src/components/sections/DestinationsIsland.module.css` - NEW: island styles
  - `apps/web2/src/components/sections/DestinationsMap.tsx` - NEW: interactive SVG map component
  - `apps/web2/src/components/sections/DestinationsMap.module.css` - NEW: map styles with exact Figma SVG positioning
  - `apps/web2/src/data/homepage-destinations.ts` - Expanded from 4 to 21 destinations (all cities on map)
- **Changes completed**:
  - Full rewrite: DestinationsIsland.client.tsx replaces DestinationsCarousel.client.tsx
  - Interactive SVG map (rio.svg + rutas.svg) positioned with exact Figma coordinates
  - ALL 21 cities clickable (6 main + 15 secondary), all synced with carousel
  - 3 bridge markers with horizontal layout (icon + label stack)
  - Active pin: orange with CSS pulse animation, syncs bidirectionally with carousel
  - Embla carousel with peek cards (blur(5px) sides, sharp center, loop: true)
  - Cards: full-image bg + light gradient overlay (transparent→white) + dark text
  - Rating aligned to the right per Figma
  - Tagline color: blue (--brand-primary) per Figma, not orange
  - Slide counter "1 / 21" replaces dots (too many items for dot nav)
  - Dark CTA pill button "Ver todos los destinos →"
  - Responsive: map hidden on mobile, 40/60 tablet, 45/55 desktop
  - Pending: background image (deferred by user request)
  - Known minor: Chajarí/Federación slightly behind sticky nav on exact scroll position
- **Files deprecated** (still exist but no longer imported):
  - `apps/web2/src/components/sections/DestinationsCarousel.client.tsx`
  - `apps/web2/src/components/sections/DestinationsCarousel.module.css`
  - `apps/web2/src/components/shared/DestinationCard.tsx`
  - `apps/web2/src/components/shared/DestinationCard.module.css`

---

## Phase 4: Next Events (DONE)

- **Figma node**: 26:824
- **Files modified**:
  - `apps/web2/src/components/sections/NextEventsSection.astro` - Removed BadgeRow, GradientButton; SectionHeader left-aligned with actionLabel pill; grid changed to 2 columns
  - `apps/web2/src/components/shared/EventCardHorizontal.astro` - NEW: horizontal card with photo + blue date block (rotated month abbr) + content + circular arrow CTA
  - `apps/web2/src/data/homepage-events.ts` - Expanded from 4 to 6 events matching Figma data
  - `packages/i18n/src/locales/es/home.json` - Updated accentSubtitle to "Agenda Litoral", description text, added viewAll key
- **Changes completed**:
  - Horizontal card layout matching Figma (photo left, blue date block, content center, arrow right)
  - Blue date block with rotated month abbreviation (ENE, FEB, MAR, etc.) and date range + time
  - Smart date formatting: single-day shows "14 febrero 2026", multi-day shows "6 al 8 de febrero"
  - Title wraps to 2 lines (line-clamp) instead of truncating with ellipsis
  - Location badge pill with pin icon per card
  - Circular blue arrow CTA button on right side
  - 2-column grid (1 col mobile, 2 cols 768px+)
  - Removed destination filter badges and bottom GradientButton CTA
- **Files deprecated** (still exist but no longer imported in this section):
  - `apps/web2/src/components/shared/EventCard.astro` - vertical card variant, may be used on other pages

---

## Phase 5: About Us (DONE)

- **Figma node**: 26:251
- **Files modified**:
  - `apps/web2/src/components/sections/AboutUsSection.astro` - Full rewrite from 2-col owner CTA to 3-col about us section
  - `packages/i18n/src/locales/es/home.json` - Added about.accentSubtitle, title, description, experienceBadge, photo alts
  - `apps/web2/public/assets/images/shapes/airplane-deco.svg` - NEW: decorative airplane silhouette
- **Changes completed**:
  - 3-column grid layout (3fr/4fr/3fr) matching Figma: photo collage / text / traveler photo
  - Light blue background via var(--brand-secondary)
  - Photo collage with 2 overlapping images (organic + alt radius), decorative airplane + dashed path
  - "2 años de experiencia" badge rotated -90deg along left edge
  - Tagline in Caveat italic, title in Geologica, description in Roboto
  - Traveler photo on right (about-man.png placeholder)
  - Removed all owner CTA content (features, GradientButton, social proof, counter badge)
  - Responsive: 2-col tablet, 1-col mobile

---

## Phase 6: Latest Articles (DONE)

- **Figma node**: 26:527
- **Files modified**:
  - `apps/web2/src/components/sections/LatestArticlesSection.astro` - Grid changed to 3-col bento, GradientButton replaced with dark pill CTA
  - `apps/web2/src/components/shared/CompactArticleCard.astro` - Fixed missing i18n key (articles.readMore → common.readMore)
  - `packages/i18n/src/locales/es/home.json` - Updated tagline to "Informate, Inspirate, Conoce", title, subtitle, viewAll
- **Changes completed**:
  - 3-column bento grid: featured cols 1-2 row 1, vertical col 3 rows 1-2, 2 compacts cols 1-2 row 2
  - Dark pill CTA button replacing GradientButton
  - Updated i18n texts to match Figma
  - Fixed [MISSING: articles.readMore] error in compact cards

---

## Phase 7: Testimonials (DONE)

- **Figma node**: 26:1419
- **Files modified**:
  - `apps/web2/src/components/sections/TestimonialsSection.astro` - Full rewrite: sidebar + 3 static cards layout
  - `apps/web2/src/data/homepage-reviews.ts` - Updated first 3 reviews with Figma content (names, quotes, badges, locations, ratingCount)
  - `apps/web2/src/data/types.ts` - Added badge, ratingCount, location fields to ReviewCardData
  - `packages/i18n/src/locales/es/home.json` - Testimonials texts already matched
- **Changes completed**:
  - Replaced React carousel with static Astro layout (zero client JavaScript)
  - Sidebar (267px): SectionHeader left-aligned + 7 decorative pagination dots (3rd active, elongated blue)
  - 3 testimonial cards in horizontal row (flex, gap 32px)
  - Card design: avatar 60px circle (1px border) + name (Caveat Bold 32px) + badge (Inter Bold 13px, brand-primary) + quote (Inter Regular 14px, line-clamp 5) + star rating with SVG half-star (linearGradient) + location row (border-top, pin SVG)
  - Responsive: tablet 2-col, mobile 1-col
  - TestimonialsCarousel.client.tsx preserved (not deleted, just not imported)

---

## Phase 8: CTA Owners (DONE)

- **Figma node**: 22:1890
- **Files modified**:
  - `apps/web2/src/components/sections/CtaOwnersSection.astro` - Background from dark to sage/green, text colors from white to dark, icons from orange to blue, play button hidden
  - `packages/i18n/src/locales/es/home.json` - Updated title, button text, and 3 feature items to match Figma
- **Changes completed**:
  - Background panel changed from dark (oklch 0.18) to sage/green (oklch 0.92 0.02 145)
  - All text colors changed from white to dark (core-foreground, core-muted-foreground)
  - Icon circles changed from orange filled to blue tinted (brand-primary with 15% opacity bg)
  - Tagline color from brand-accent to brand-primary
  - Play button overlay hidden
  - Feature items updated: "Publicación en minutos", "Visibilidad donde importa", "Sin comisiones ocultas"
  - CTA button text: "Publicá tu alojamiento →"

---

## Phase 9: Stats (DONE)

- **Figma node**: 26:797
- **Files modified**:
  - `apps/web2/src/components/sections/StatsSection.astro` - Full layout rewrite with gradient bg, map SVG, traveler image slot, horizontal flex
  - `apps/web2/src/data/homepage-stats.ts` - Updated values to match Figma (120, 25, 500, 15, 2000)
  - `apps/web2/src/styles/global.css` - Added --brand-tertiary token (light + dark mode)
  - `packages/i18n/src/locales/es/home.json` - Updated stat labels to match Figma
- **Changes completed**:
  - Gradient background: linear-gradient brand-secondary → brand-tertiary
  - Inline SVG world map texture as decorative background (12% opacity)
  - Traveler image placeholder on left (hidden on tablet/mobile, asset not yet created)
  - Horizontal flex layout: traveler | SectionHeader (left-aligned) | 5 stat cards
  - Stat values: 120+, 25, 500+, 15, 2.000+ with correct suffixes per card
  - Stat labels: "Alojamientos verificados", "Destinos en Entre Ríos", "Reseñas de viajeros", "Tipos de experiencias", "Turistas conectados"
  - Responsive: desktop horizontal flex, tablet/mobile stack with 3-col/2-col grid
  - Removed section--warm class (gradient replaces warm background)

---

## Phase 10: Partners (DONE)

- **Figma node**: 30:2746
- **Files modified**:
  - `apps/web2/src/components/sections/PartnersSection.astro` - Added tagline in Caveat, updated title
  - `packages/i18n/src/locales/es/home.json` - Added tagline "Nuestros partners", updated title
- **Changes completed**:
  - Tagline "Nuestros partners" in Caveat italic added above title
  - Title updated to "Empresas e instituciones que confían y apoyan"
  - Kept marquee animation (Figma shows static row, but marquee is a UX improvement)

---

## Phase 11: Header (DONE)

- **Figma node**: 560:408
- **File**: `apps/web2/src/layouts/Header.astro`
- **Changes completed**:
  - Already matched Figma: 1440px max-width, 110px height, 12px/48px padding
  - Logo: 83x90 icon + Caveat Bold 48px wordmark — correct
  - Nav links: uppercase, 16px Inter, 16px gap, 30px dividers — correct
  - Right area: "Iniciar sesión" login link (Figma shows logged-in state with avatar; intentionally different for unauthenticated state)
  - No code changes needed

---

## Phase 12: Footer (DONE)

- **Figma node**: 560:436
- **Files modified**:
  - `apps/web2/src/layouts/Footer.astro` - Full layout rewrite: 2-column top row (brand left + newsletter/nav right)
  - `apps/web2/src/components/shared/SocialLinks.astro` - Twitter→WhatsApp, icon size 24→28, order: FB/IG/YT/WA
  - `apps/web2/src/styles/global.css` - Added --footer-fg-muted and --footer-newsletter-border tokens (light + dark)
  - `packages/i18n/src/locales/es/footer.json` - Updated texts, added column title keys, subscribe button, destination San José
- **Changes completed**:
  - Wave SVG decoration overlapping previous section (60px)
  - LEFT BLOCK: logo (icon 58x63 + "Hospeda" Caveat Bold 48px horizontal) + description (centered, 205px) + social icons (28px)
  - RIGHT BLOCK: newsletter white card (rounded 24px, Geologica Bold 24px title, input 12px radius, dark pill "Suscribirse →")
  - 4-column nav grid: EXPLORAR, DESTINOS, PROPIETARIOS, HOSPEDA (headings Geologica Bold 20px)
  - Bottom bar: email+phone left, copyright right
  - Removed mate tagline from footer (key preserved in i18n for other uses)
  - Responsive: mobile vertical stack, tablet 2-col, desktop full Figma layout
  - NewsletterForm.astro no longer imported (inlined in footer; component preserved for other potential uses)

---

## Global Token Changes (DONE)

Tokens corrected in `apps/web2/src/styles/global.css`:

| Token | Old (oklch) | New (oklch) | Figma hex |
|-------|------------|------------|-----------|
| --brand-primary | 0.55 0.12 220 | 0.63 0.19 259 | #3685fb |
| --brand-secondary | 0.95 0.03 230 | 0.96 0.02 236 | #e3f4ff |
| --brand-secondary-foreground | 0.25 0.06 155 | 0.26 0.06 255 | #0c2442 |
| --core-muted-foreground | 0.5 0.02 220 | 0.45 0.03 261 | #4a5568 |
| --rating-star | 0.77 0.17 85 | 0.77 0.17 70 | #f59e0b |

Dark mode equivalents also updated with consistent hue shifts.

---

## Execution Strategy

For each section (Phase 2-12):
1. Get Figma screenshot of the section node
2. Take Playwright screenshot of current implementation
3. Compare side by side and identify all differences
4. Delegate to astro-engineer agent with specific fix instructions
5. Verify with new screenshot
6. Iterate until match

### Priority Order (by visual impact):
1. **Phase 0**: Section order fix (quick win)
2. **Phase 2**: Accommodations (most visible after hero)
3. **Phase 3**: Destinations
4. **Phase 4**: Events
5. **Phase 5**: About
6. **Phase 6**: Articles
7. **Phase 7**: Testimonials
8. **Phase 8**: CTA Owners
9. **Phase 9**: Stats
10. **Phase 10**: Partners
11. **Phase 11**: Header
12. **Phase 12**: Footer

---

## All Files Modified (cumulative)

### Phase 1: Hero
- `apps/web2/src/components/sections/HeroSection.astro` - Major rewrite
- `apps/web2/src/components/sections/SearchBar.astro` - Restyled
- `apps/web2/src/styles/global.css` - Token corrections (light + dark mode)
- `packages/i18n/src/locales/es/home.json` - Hero text updates
- `apps/web2/public/assets/images/shapes/hero-blob-accent.png` - New asset
- `apps/web2/public/assets/images/shapes/deco-arrow-1.svg` - New asset
- `apps/web2/public/assets/images/shapes/deco-arrow-2.svg` - New asset
- `apps/web2/public/assets/images/shapes/social-proof-arrow.svg` - New asset

### Phase 0: Section Order
- `apps/web2/src/pages/[lang]/index.astro` - Reordered sections to match Figma

### Phase 2: Featured Accommodations
- `apps/web2/src/components/sections/FeaturedAccommodationsSection.astro` - Left-aligned header with action pill, 3-col grid, removed bottom CTA
- `apps/web2/src/components/shared/SectionHeader.astro` - Added actionLabel/actionHref props, flex row layout
- `apps/web2/src/components/shared/Badge.astro` - Added variant="filled-dark"
- `apps/web2/src/components/shared/BadgeRow.astro` - Added uniformDark prop

### Phase 3: Destinations
- `apps/web2/src/components/sections/DestinationsSection.astro` - Rewritten wrapper
- `apps/web2/src/components/sections/DestinationsIsland.client.tsx` - NEW: main React island
- `apps/web2/src/components/sections/DestinationsIsland.module.css` - NEW: island styles
- `apps/web2/src/components/sections/DestinationsMap.tsx` - NEW: interactive SVG map
- `apps/web2/src/components/sections/DestinationsMap.module.css` - NEW: map styles
- `apps/web2/src/data/homepage-destinations.ts` - Expanded to 21 destinations
- `apps/web2/public/assets/images/destination/rio.svg` - NEW: exported from Figma
- `apps/web2/public/assets/images/destination/rutas.svg` - NEW: exported from Figma

### Phase 4: Next Events
- `apps/web2/src/components/sections/NextEventsSection.astro` - Removed BadgeRow/GradientButton, 2-col grid, left-aligned header
- `apps/web2/src/components/shared/EventCardHorizontal.astro` - NEW: horizontal event card
- `apps/web2/src/data/homepage-events.ts` - Expanded to 6 events
- `packages/i18n/src/locales/es/home.json` - upcomingEvents keys updated

### Phase 5: About Us
- `apps/web2/src/components/sections/AboutUsSection.astro` - Full rewrite: 3-zone flex layout, inline SVG flight path
- `packages/i18n/src/locales/es/home.json` - about keys added
- `apps/web2/public/assets/images/shapes/airplane-deco.svg` - DELETED (replaced by inline SVG)

### Phase 6: Latest Articles
- `apps/web2/src/components/sections/LatestArticlesSection.astro` - 3-col bento grid, dark pill CTA
- `apps/web2/src/components/shared/CompactArticleCard.astro` - Fixed readMore i18n key
- `packages/i18n/src/locales/es/home.json` - latestPosts keys updated

### Phase 7: Testimonials
- `apps/web2/src/components/sections/TestimonialsSection.astro` - SectionHeader alignment="left"
- `packages/i18n/src/locales/es/home.json` - testimonials keys updated

### Phase 8: CTA Owners
- `apps/web2/src/components/sections/CtaOwnersSection.astro` - Sage bg, dark text, blue icons, hidden play button
- `packages/i18n/src/locales/es/home.json` - ownerCta keys updated

### Phase 9: Stats
- `apps/web2/src/components/sections/StatsSection.astro` - Updated SectionHeader with subtitle
- `packages/i18n/src/locales/es/home.json` - statistics keys updated

### Phase 10: Partners
- `apps/web2/src/components/sections/PartnersSection.astro` - Added Caveat tagline
- `packages/i18n/src/locales/es/home.json` - partners keys updated

---

## Known Issues / Cache Gotcha

**Astro dev server CSS cache**: When modifying scoped `<style>` blocks in `.astro` files, the dev server sometimes serves stale CSS with the old `data-astro-cid-*` selectors. The fix is:
1. Kill the astro process: `pkill -f astro`
2. Clear cache: `rm -rf apps/web2/node_modules/.astro`
3. Restart: `pnpm --filter hospeda-web2 dev`

This happened multiple times during development (AboutUsSection, NextEventsSection).
