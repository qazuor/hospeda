# Style Guide - Hospeda Web App

Tourist Portal for the Litoral Entrerriano region. This guide documents the **actual implementation** in `apps/web` and serves as the reference for all new pages and components.

---

## 1. Color System

### 1.1 Semantic Tokens (Light Mode)

| Token | Tailwind Class | Value (OKLCH) | Usage |
|-------|---------------|---------------|-------|
| `--background` | `bg-background` | `oklch(0.985 0.002 210)` | Page backgrounds |
| `--foreground` | `text-foreground` | `oklch(0.20 0.02 220)` | Primary text |
| `--card` | `bg-card` | `oklch(1 0 0)` | Card backgrounds |
| `--card-foreground` | `text-card-foreground` | `oklch(0.20 0.02 220)` | Text on cards |
| `--primary` | `bg-primary` | `oklch(0.55 0.12 220)` | Buttons, links, accents |
| `--primary-foreground` | `text-primary-foreground` | `oklch(0.99 0 0)` | Text on primary |
| `--secondary` | `bg-secondary` | `oklch(0.92 0.03 155)` | Highlighted sections |
| `--secondary-foreground` | `text-secondary-foreground` | `oklch(0.25 0.06 155)` | Text on secondary |
| `--muted` | `bg-muted` | `oklch(0.95 0.01 210)` | Neutral backgrounds |
| `--muted-foreground` | `text-muted-foreground` | `oklch(0.50 0.02 220)` | Descriptions, secondary text |
| `--accent` | `bg-accent` | `oklch(0.70 0.18 55)` | CTAs, prices, highlights |
| `--accent-foreground` | `text-accent-foreground` | `oklch(0.99 0 0)` | Text on accent |
| `--destructive` | `bg-destructive` | `oklch(0.577 0.245 27.325)` | Error states |
| `--border` | `border-border` | `oklch(0.90 0.02 210)` | Card borders, inputs |
| `--ring` | `ring-ring` | `oklch(0.55 0.12 220)` | Focus rings |
| `--overlay` | `bg-overlay` | `oklch(0.20 0.02 220 / 0.5)` | Modal overlays |
| `--radius` | `rounded-lg` | `0.75rem` | Base border radius |

### 1.2 Dark Mode Tokens (`[data-theme="dark"]`)

| Token | Value (OKLCH) |
|-------|---------------|
| `--background` | `oklch(0.14 0.02 220)` |
| `--foreground` | `oklch(0.92 0.01 210)` |
| `--card` | `oklch(0.19 0.02 220)` |
| `--primary` | `oklch(0.65 0.14 220)` |
| `--secondary` | `oklch(0.25 0.05 155)` |
| `--muted` | `oklch(0.22 0.02 220)` |
| `--muted-foreground` | `oklch(0.60 0.02 220)` |
| `--accent` | `oklch(0.72 0.19 55)` |
| `--border` | `oklch(0.28 0.02 220)` |
| `--overlay` | `oklch(0.05 0.01 220 / 0.7)` |

Dark mode activates via `data-theme="dark"` on `<html>` (NOT `.dark` class). FOUC prevented by inline script in BaseLayout reading `localStorage.getItem('theme')`.

### 1.3 Hospeda Brand Tokens

| Token | Tailwind Class | Value | Usage |
|-------|---------------|-------|-------|
| `--hospeda-sky` | `bg-hospeda-sky` | `oklch(0.80 0.08 220)` | Sky, light backgrounds |
| `--hospeda-sky-light` | `bg-hospeda-sky-light` | `oklch(0.88 0.06 220)` | Very light backgrounds |
| `--hospeda-river` | `text-hospeda-river` | `oklch(0.55 0.12 220)` | River, water |
| `--hospeda-forest` | `text-hospeda-forest` | `oklch(0.50 0.14 155)` | Vegetation, nature |
| `--hospeda-sand` | `bg-hospeda-sand` | `oklch(0.93 0.03 85)` | Beaches, sand |
| `--hospeda-sunset` | `text-hospeda-sunset` | `oklch(0.70 0.18 55)` | Sunsets, warm accents |

### 1.4 Feedback Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `oklch(0.58 0.15 150)` | Success states |
| `--warning` | `oklch(0.75 0.18 85)` | Warning states |
| `--info` | `oklch(0.55 0.12 220)` | Info states |

### 1.5 Section Background Assignment (actual implementation)

| Section | Background |
|---------|------------|
| Hero | Image + `bg-gradient-to-b from-black/55 via-black/40 to-black/65` overlay |
| Accommodations | `bg-hospeda-sky-light` |
| Destinations | `bg-secondary` |
| Stats | `bg-muted/30` |
| List Property CTA | `bg-background` |
| Footer | `bg-foreground text-card` |

---

## 2. Typography

### 2.1 Fonts

| Font | CSS Variable | Tailwind | Usage |
|------|-------------|----------|-------|
| Inter (300-700) | `--font-sans` | `font-sans` | Body text, UI, paragraphs |
| Dancing Script (400,700) | `--font-serif` | `font-serif` | Decorative titles, brand accents |

Loaded from Google Fonts in `BaseLayout.astro`. Body uses `font-sans antialiased`.

### 2.2 Type Scale (actual usage)

| Context | Exact Classes |
|---------|--------------|
| Hero H1 | `font-serif font-bold text-white` + `font-size: clamp(2.5rem, 1rem + 6vw, 8rem)` |
| Hero tagline | `font-medium uppercase tracking-ultra text-white/80` + `font-size: clamp(0.75rem, 0.5rem + 0.8vw, 1rem)` |
| Hero subtitle | `text-balance text-white/90` + `font-size: clamp(0.875rem, 0.7rem + 0.6vw, 1.25rem)` |
| Section H2 (default) | `font-serif font-bold text-foreground text-balance text-4xl md:text-5xl` |
| Section H2 (sm) | `font-serif font-bold text-foreground text-balance text-2xl md:text-3xl` |
| Section tagline | `text-sm font-semibold uppercase tracking-widest` + tagline color (default `text-accent`) |
| Section subtitle | `text-muted-foreground mt-3` |
| Card title | `text-sm font-semibold text-card-foreground leading-snug` |
| Card summary | `text-xs text-muted-foreground line-clamp-2 leading-relaxed` |
| Date/meta | `font-mono text-xs uppercase tracking-wider text-muted-foreground` |
| Logo (navbar) | `font-serif text-2xl font-bold tracking-tight md:text-3xl` |
| Nav links (desktop) | `text-sm font-medium tracking-wide uppercase` |
| Footer column headers | `text-sm font-semibold uppercase tracking-wider text-card/50` |
| Footer links | `text-sm text-card/70 hover:text-accent` |

### 2.3 Custom Type Utilities (defined in global.css)

| Utility | Size | Line-height |
|---------|------|-------------|
| `text-2xs` | `0.625rem` | `1.25` |
| `text-xs-alt` | `0.6875rem` | `1.3` |
| `text-3xs` | `0.8rem` | `1.3` |
| `tracking-ultra` | `letter-spacing: 0.3em` | - |

### 2.4 Text Rules

- Use `text-balance` or `text-pretty` on headings
- Paragraphs: `leading-relaxed` or `leading-6`
- Max 65-75 characters per line for body text

---

## 3. Layout and Spacing

### 3.1 Containers (actual implementation)

| Usage | Classes |
|-------|---------|
| Main sections, navbar, footer | `mx-auto max-w-7xl px-4 md:px-8` |
| Stats, CTA sections | `mx-auto max-w-5xl px-4 md:px-8` |
| Narrow content (forms, text) | `mx-auto max-w-2xl px-4` |

**Note:** `px-4 md:px-8` is used consistently across ALL containers.

### 3.2 Section Spacing (actual values)

| Type | Classes |
|------|---------|
| Standard sections | `py-16 pb-20 md:py-24 md:pb-24` |
| Compact sections (stats) | `py-12 md:py-16` |
| CTA sections | `py-10 md:py-14` |
| Wave overlap (negative margin) | `-mt-10 md:-mt-12` |

### 3.3 Grid System

| Content | Columns |
|---------|---------|
| Accommodations | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6` |
| Destinations | `md:grid-cols-3 gap-6` |
| Events (bento) | Custom flex layout with `reversed` prop |
| Stats | `grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4` |
| Blog (magazine) | `lg:grid-cols-12` with 7-col featured + 5-col secondary |
| Footer links | `grid gap-10 sm:grid-cols-2 md:grid-cols-5` |
| Filter chips | `flex flex-wrap justify-center gap-2` |

### 3.4 SectionHeader Component

```astro
<SectionHeader
  tagline="Optional tagline"
  taglineColor="text-accent"       // default
  title="Section Title"
  subtitle="Optional subtitle"
  align="center"                    // "center" | "left"
  size="default"                    // "default" | "sm"
  spacing="default"                 // "default" (mb-12) | "compact" (mb-5)
/>
```

---

## 4. Shadows

### 4.1 Custom Shadow Tokens (defined in global.css)

| Utility | Value | Usage |
|---------|-------|-------|
| `shadow-card` | `0 4px 12px -2px (8%)` | Default card shadow |
| `shadow-card-hover` | `0 12px 24px -4px (12%)` | Hovered card shadow |
| `shadow-nav` | `0 2px 4px (15%), 0 6px 20px -2px (18%)` | Navbar (scrolled) |
| `shadow-brutal-sm` | `4px 4px 0 0 (10%)` | Secondary article cards |
| `shadow-brutal-sm-hover` | `10px 10px 0 0 (15%)` | Secondary cards hover |
| `shadow-brutal-lg` | `5px 5px 0 0 (10%)` | Featured article cards |
| `shadow-brutal-lg-hover` | `12px 12px 0 0 (15%)` | Featured cards hover |
| `shadow-search` | `0 25px 50px -12px (25%)` | Search form |

All shadows use `oklch(from var(--foreground) ...)` for automatic dark mode adaptation.

---

## 5. Cards

### 5.1 Common Card Patterns

| Pattern | Classes |
|---------|---------|
| Border radius | `rounded-2xl` (all cards except StatCard: `rounded-xl`) |
| Default shadow | `shadow-card` |
| Hover elevation | `hover:-translate-y-1 hover:shadow-card-hover` |
| Image hover zoom | `group-hover:scale-110` with `transition-transform duration-500` |
| Image gradient | `bg-gradient-to-t from-foreground/60 via-transparent to-transparent` |
| Badge position on image | `absolute left-3 top-3 flex flex-wrap gap-1.5` |
| Glass badge on image | `bg-card/90 backdrop-blur-sm` |
| Circular arrow link | `flex h-7 w-7 rounded-full text-primary hover:bg-primary hover:text-primary-foreground` |
| Card footer separator | `border-t border-border pt-4` |
| Card content padding | `p-4` (standard) or `p-6 md:p-8` (featured) |

### 5.2 Card Types

**AccommodationCard**: `rounded-2xl bg-card shadow-card` + image (`h-48`) + badges + price pill (`bg-card/90 backdrop-blur-sm`) + content
**DestinationCard**: Full-height image card (`h-80 md:h-96`) + gradient overlay + text at bottom. Stagger via `transition-delay: {index * 150}ms`
**EventCard**: Bento layout with `reversed` prop. Uses `-mt-6` overlap technique (text overlaps image). No explicit card background.
**FeaturedArticleCard**: Brutalist shadow + 3D tilt (`perspective: 1000px`, `rotateY(-4deg) rotateX(2deg)`) + bookmark ribbon. Takes `lg:col-span-7`.
**SecondaryArticleCard**: Horizontal layout + smaller brutalist shadow + 3D tilt (`perspective: 600px`). Arrow appears on hover (`opacity-0 -> opacity-100`).
**ReviewCard**: `rounded-2xl bg-card p-6 shadow-card`. Quote icon decorative. StarsDisplay + reviewer info.
**StatCard**: `rounded-xl bg-card p-4 shadow-sm`. Icon in `bg-primary/10` circle.

### 5.3 Skeleton Pattern

```
animate-pulse rounded-2xl bg-card shadow-sm overflow-hidden
```

Placeholders use `bg-muted`. Pills: `rounded-full`. Lines: `rounded`. Grid matches the real card grid breakpoints.

---

## 6. Buttons

### 6.1 Button Component (CVA - `button.tsx`)

**Variants:**

| Variant | Classes |
|---------|---------|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `outline` | `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |

**Sizes:** `default` (h-9 px-4), `sm` (h-8 px-3), `lg` (h-10 px-6), `icon` (size-9), `icon-sm` (size-8), `icon-lg` (size-10)

### 6.2 GradientButton (Astro - CTAs)

```
rounded-full bg-gradient-to-r from-primary to-hospeda-river
h-10 px-8 text-sm font-medium text-primary-foreground
shadow-md hover:shadow-lg hover:brightness-110
```

### 6.3 Accent CTA (Navbar, Owner CTA)

```
rounded-full bg-accent text-accent-foreground hover:bg-accent/90
```

Nav: `px-6 h-10 text-sm font-medium`. Owner CTA: `px-7 py-3.5 text-sm font-semibold shadow-lg`.

---

## 7. Badges and Tags

| Component | Base Classes |
|-----------|-------------|
| `Badge` (primary) | `rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary` |
| `Badge` (accent) | `bg-accent/15 text-accent` |
| `Badge` (outline) | `border border-border text-muted-foreground` |
| `Badge` (featured) | `bg-accent/90 text-accent-foreground backdrop-blur-sm` |
| `CategoryBadge` | `rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide` |
| `LocationBadge` (glass) | `rounded-full px-2.5 py-1 text-2xs font-medium bg-card/90 text-foreground backdrop-blur-sm` |
| `RatingBadge` | `absolute right-3 top-3 rounded-full bg-card/90 px-2 py-1 backdrop-blur-sm` |
| `AmenityTag` | `rounded-full bg-muted px-2 py-0.5 text-xs-alt text-muted-foreground` |
| `FilterChip` (primary) | `rounded-full px-3 py-1.5 bg-card shadow-sm hover:bg-primary hover:text-primary-foreground` |
| `FilterChip` (accent) | `rounded-full px-3 py-1.5 border border-border bg-background hover:border-accent hover:bg-accent` |

---

## 8. Decorative Elements

### 8.1 BackgroundPattern Component

```astro
<BackgroundPattern
  pattern="/images/patterns/pattern-dots.svg"
  size="60px 60px"        // default
  opacity="opacity-50"    // default
/>
```

Renders: `absolute inset-0 pointer-events-none` with `background-image`, `background-size`, `background-repeat: repeat`.

**Available patterns:**

| Pattern | Size | Opacity | Recommended sections |
|---------|------|---------|---------------------|
| `pattern-dots.svg` | `60px 60px` | 50% | Accommodations, stats |
| `pattern-diagonal.svg` | `40px 40px` | 80% | Destinations, events |
| `pattern-grid.svg` | `50px 50px` | 50-60% | Search, forms |
| `pattern-crosses.svg` | `30px 30px` | 60-70% | Reviews, testimonials |
| `pattern-waves.svg` | `200px 50px` | 40-50% | Blog, water content |
| `pattern-topo.svg` | `300px 300px` | 30-40% | Owner CTA, maps |

### 8.2 DecorativeElement Component

```astro
<DecorativeElement
  src="/images/decoratives/deco-brujula.svg"
  position="top-4 left-4 md:left-12"
  size="w-16 md:w-24"           // default: "w-20 md:w-28"
  opacity="opacity-50"           // default: "opacity-40"
  rotate="rotate-12"             // optional
  hidden="hidden md:block"       // default
  flip={false}                   // adds -scale-x-100
/>
```

**Available decoratives:**
`deco-avion.svg`, `deco-brujula.svg`, `deco-flecha-curva.svg`, `deco-flecha-doble.svg`, `deco-kayak.svg`, `deco-multi-pins.svg`, `deco-olas.svg`, `deco-pin-location.svg`, `deco-rio-uruguay.svg`, `deco-ruta-punteada.svg`

### 8.3 Illustration Component

```astro
<Illustration
  src="/images/illustrations/ilustracion-destinos.svg"
  position="-top-8 right-0"
  size="h-28 w-28 md:h-40 md:w-40 lg:h-52 lg:w-52"  // default
/>
```

Opacity: `opacity-40` (mobile) `md:opacity-80` (desktop). Always `pointer-events-none aria-hidden="true"`.

**Available illustrations:**
`ilustracion-anfitriones.svg`, `ilustracion-buscar-alojamiento.svg`, `ilustracion-destinos.svg`, `ilustracion-eventos.svg`, `ilustracion-notas.svg`, `ilustracion-publica-alojamiento.svg`, `ilustracion-reviews.svg`

### 8.4 Rules per Page Type

| Page Type | Pattern | Decoratives | Illustrations | Scroll Reveal |
|-----------|---------|-------------|---------------|---------------|
| **Landing (home)** | Varied per section | 3-5 per section | Large, one per section | Yes, all content |
| **List pages** (accommodations, destinations) | 1 consistent pattern | 2-3 subtle | None (interfere with cards) | Optional |
| **Detail pages** (accommodation, event) | None (focus on content images) | 1-2 in CTA area only | None | Optional |
| **Info pages** (about, contact) | 1 subtle pattern | 2-3 thematic | 1 related to theme | Yes |
| **Account pages** | None | None | None | No |

---

## 9. Animations

### 9.1 Scroll Reveal (CSS + IntersectionObserver)

```html
<div class="scroll-reveal">        <!-- from bottom (translateY 40px) -->
<div class="scroll-reveal-left">   <!-- from left (translateX -60px) -->
<div class="scroll-reveal-right">  <!-- from right (translateX 60px) -->
```

Duration: `0.8s ease-out`. Trigger: `threshold: 0.1`, `rootMargin: "0px 0px -50px 0px"`. Class `.revealed` added on intersection. Respects `prefers-reduced-motion`.

### 9.2 Card Stagger

```astro
style={`transition-delay: ${index * 150}ms`}
```

### 9.3 Hover Transitions

| Element | Classes |
|---------|---------|
| Cards | `transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1` |
| Card images | `transition-transform duration-500 group-hover:scale-110` |
| Buttons | `transition-colors` (built into Button component) |
| Links | `transition-colors hover:text-accent` |

### 9.4 3D Card Transforms (blog cards)

| Type | Perspective | Tilt | Translate |
|------|------------|------|-----------|
| Featured | `1000px` | `rotateY(-4deg) rotateX(2deg)` | `-translate-x-1.5 -translate-y-1.5` |
| Secondary | `600px` | `rotateY(-3deg) rotateX(1deg)` | `-translate-x-1 -translate-y-1` |

---

## 10. Waves and Separators

### 10.1 CSS Wave Classes (defined in global.css)

```
.wave-bottom-hero   → Hero section bottom
.wave-bottom-a      → Accommodations section
.wave-bottom-b      → Destinations section
.wave-bottom-c      → Variant C
.wave-bottom-d      → Variant D
```

Each section overlaps the next with `-mt-10 md:-mt-12` and descending `z-index`.

### 10.2 WaveDivider Component

```astro
<WaveDivider
  path="M0,30 C360,60 720,0 1080,30 L1440,60 L0,60 Z"
  fillClass="fill-background"
  position="bottom"    // "top" | "bottom" | "inline"
  height="60"
/>
```

### 10.3 ParallaxDivider Component

```astro
<ParallaxDivider
  image="/images/parallax/parallax-nature.jpg"
  title="Section Title"
  subtitle="Section subtitle"
  variant="cloud1"              // "cloud1" | "cloud2" | "cloud3"
  topWaveClass="fill-secondary"
  bottomWaveClass="fill-background"
/>
```

Height: `h-64 md:h-80`. Overlay: `bg-foreground/50`. Text: `font-serif text-3xl md:text-5xl font-bold text-card`. Parallax disabled on mobile.

---

## 11. Navbar

### 11.1 States

| State | Background | Text | Border |
|-------|------------|------|--------|
| Initial (scroll <= 50px) | `bg-transparent` | `text-white` | `border-white/40` |
| Scrolled (scroll > 50px) | `bg-card/95 backdrop-blur-md shadow-nav` | `text-foreground` | `border-foreground/20` |

Transition: `transition-all duration-500`.

### 11.2 Structure

- Fixed: `fixed top-0 left-0 right-0 z-50`
- Container: `max-w-7xl px-4 py-3 md:px-8`
- Logo: `h-10 w-10 md:h-12 md:w-12`
- Desktop links: `hidden md:flex` + `text-sm font-medium tracking-wide uppercase`
- CTA: `rounded-full bg-accent px-6 h-10 text-sm font-medium text-accent-foreground`
- Mobile menu: `fixed inset-0 z-40 bg-card` with staggered link animations

---

## 12. Footer

### 12.1 Structure

```
bg-foreground text-card
```

- Newsletter box: `rounded-2xl bg-card/5 p-6 md:p-8`
- Newsletter input: `rounded-full bg-card/10 px-4 text-sm text-card placeholder:text-card/40 focus:ring-2 focus:ring-accent`
- Column headers: `text-sm font-semibold uppercase tracking-wider text-card/50`
- Links: `text-sm text-card/70 hover:text-accent`
- Separator: `border-card/10`

---

## 13. Z-Index Stack

| Z-Index | Element |
|---------|---------|
| `z-[12]` | Hero section |
| `z-[10]` | Accommodations section |
| `z-[8]` | Destinations section |
| `z-[1]` | Stats section |
| `z-50` | Navbar (fixed) |
| `z-40` | Mobile menu overlay |
| `z-20` | Wave SVGs in parallax |
| `z-10` | Content in parallax |
| `z-100` | Toast notifications (`--z-toast`) |

---

## 14. Section Template

Standard pattern for all sections:

```astro
<section class="wave-bottom-X relative z-[N] -mt-10 md:-mt-12 bg-[section-color] py-16 pb-20 md:py-24 md:pb-24 overflow-hidden">
  <!-- 1. Background pattern -->
  <BackgroundPattern pattern="/images/patterns/pattern-dots.svg" />

  <!-- 2. Decorative elements (3-5, hidden on mobile) -->
  <DecorativeElement src="/images/decoratives/deco-brujula.svg" position="top-4 left-4 md:left-12" />
  <DecorativeElement src="/images/decoratives/deco-flecha-curva.svg" position="bottom-8 right-8" />

  <!-- 3. Illustration (optional) -->
  <Illustration src="/images/illustrations/ilustracion-destinos.svg" position="-top-8 right-0" />

  <!-- 4. Content (always relative for z-index) -->
  <div class="relative mx-auto max-w-7xl px-4 md:px-8">
    <SectionHeader tagline="Tagline" title="Section Title" subtitle="Description" />

    <div class="scroll-reveal grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Cards -->
    </div>

    <div class="mt-10 text-center scroll-reveal">
      <GradientButton href="/path/" label="View All" />
    </div>
  </div>
</section>
```

---

## 15. New Section Checklist

- [ ] Choose appropriate background color (alternate with adjacent sections)
- [ ] Select a background pattern different from adjacent sections
- [ ] Add 3-5 decorative elements distributed across corners/edges
- [ ] Include illustration if applicable (per page type rules)
- [ ] Apply `scroll-reveal` to content blocks
- [ ] Verify text contrast on chosen background
- [ ] Hide decoratives on mobile with `hidden md:block`
- [ ] Add wave separator if background color changes between sections
- [ ] Use `aria-hidden="true"` on all decorative elements
- [ ] Content wrapper must have `relative` class (for z-index above decoratives)
- [ ] Use `overflow-hidden` on section to clip decoratives

---

## 16. Color Migration Reference

When adapting code from `web-old`, replace hardcoded colors:

| Old (hardcoded) | New (semantic token) |
|-----------------|---------------------|
| `bg-white` | `bg-card` or `bg-background` |
| `bg-gray-50`, `bg-gray-100` | `bg-muted` |
| `bg-gray-200` | `bg-muted` or `bg-border` |
| `text-gray-900`, `text-black` | `text-foreground` |
| `text-gray-500`, `text-gray-600` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground/60` |
| `bg-blue-600`, `bg-blue-500` | `bg-primary` |
| `text-blue-600` | `text-primary` |
| `bg-green-100`, `bg-green-50` | `bg-secondary` |
| `text-green-800` | `text-secondary-foreground` |
| `bg-orange-500`, `bg-amber-500` | `bg-accent` |
| `text-orange-500` | `text-accent` |
| `border-gray-200`, `border-gray-300` | `border-border` |
| `shadow-md`, `shadow-lg` | `shadow-card` / `shadow-card-hover` |

---

## 17. Asset Directories

```
public/images/
  decoratives/     deco-*.svg           10 decorative graphics
  hero/            hero-*.jpg           16 hero slideshow images
  illustrations/   ilustracion-*.svg    7 section illustrations
  parallax/        parallax-*.jpg       6 parallax background photos
  patterns/        pattern-*.svg        6 background texture patterns
  placeholder-*.svg                     5 placeholder images
  logo.webp                             Brand logo
```

---

## 18. Reference Files

| Purpose | File |
|---------|------|
| All CSS tokens and animations | `src/styles/global.css` |
| Font loading and base structure | `src/layouts/BaseLayout.astro` |
| Section header pattern | `src/components/shared/SectionHeader.astro` |
| CTA button pattern | `src/components/shared/GradientButton.astro` |
| Card patterns | `src/components/shared/AccommodationCard.astro` |
| Background pattern component | `src/components/shared/BackgroundPattern.astro` |
| Decorative element component | `src/components/shared/DecorativeElement.astro` |
| Button variants (CVA) | `src/components/ui/button.tsx` |
| Complete section example | `src/components/sections/AccommodationsSection.astro` |
| Static data files | `src/data/*.ts` |
