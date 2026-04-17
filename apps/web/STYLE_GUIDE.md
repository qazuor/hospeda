# Style Guide - Hospeda Web

Tourist accommodation platform for the Litoral Entrerriano region. This guide is the **single source of truth** for all visual decisions in `apps/web`. Every value here maps to a CSS custom property.. nothing is hardcoded.

Design reference: TravHub index3 template, adapted for Hospeda brand identity.

---

## 1. Design Principles

### 1.1 Core Identity

**Warm, modern, trustworthy, adventurous, with strong personality.**

The design balances organic, nature-inspired shapes with clean modern typography. It feels approachable and inviting (tourism for the Litoral region), not corporate or sterile.

### 1.2 Key Visual Traits

| Trait | How it manifests |
|-------|-----------------|
| **Organic shapes** | Asymmetric border-radius (`0 100px`), blob backgrounds, rounded images |
| **Warm palette** | Peach tints, sunset orange accent, earthy dark tones |
| **Layered depth** | Overlapping elements, negative margins, subtle shadows |
| **Nature connection** | SVG decoratives (birds, waves, compass), parallax nature photos |
| **Playful typography** | Handwritten taglines (Caveat), geometric headings (Geologica) |
| **Generous whitespace** | 120px section padding, spacious card content areas |

### 1.3 Design Rules

- **NEVER** hardcode colors, spacing, or font values.. always use tokens
- **NEVER** use uniform border-radius on cards/images.. use asymmetric organic shapes
- **ALWAYS** alternate section backgrounds (white / peach tint)
- **ALWAYS** use scroll-reveal animations on content entering the viewport
- **ALWAYS** stagger animations on repeated elements (cards, list items)
- **ALWAYS** respect `prefers-reduced-motion`

---

## 2. Token Architecture

All tokens are plain CSS custom properties defined in `src/styles/global.css` under the `:root` selector. This app does NOT use Tailwind.. tokens are consumed directly as `var(--token)` from three places: Astro `<style>` scoped blocks, React island CSS Modules (`*.module.css`), and the shared BEM-lite classes in `src/styles/components.css`. Adding a new theme means adding a new `[data-theme="X"]` block in `global.css` with overridden values; no build step, no framework integration.

### 2.1 Color Tokens

#### Semantic Colors (Light Mode)

| Token | Value | Usage |
|-------|-------|-------|
| `--core-background` | `oklch(0.985 0.002 210)` | Page backgrounds |
| `--core-foreground` | `oklch(0.2 0.02 220)` | Primary text |
| `--core-card` | `oklch(1 0 0)` | Card backgrounds |
| `--card-foreground` | `oklch(0.2 0.02 220)` | Text on cards |
| `--popover` | `oklch(1 0 0)` | Dropdown/popover surfaces |
| `--popover-foreground` | `oklch(0.2 0.02 220)` | Text in popovers |
| `--brand-primary` | `oklch(0.63 0.19 259)` | Primary brand (blue) |
| `--primary-foreground` | `oklch(0.99 0 0)` | Text on primary |
| `--brand-secondary` | `oklch(0.96 0.02 236)` | Secondary surfaces |
| `--brand-secondary-foreground` | `oklch(0.26 0.06 255)` | Text on secondary |
| `--brand-tertiary` | `oklch(0.92 0.03 155)` | Tertiary surfaces (green tint) |
| `--brand-accent` | `oklch(0.7 0.18 55)` | CTA, highlights (sunset orange) |
| `--accent-foreground` | `oklch(0.99 0 0)` | Text on accent |
| `--rating-star` | `oklch(0.82 0.19 95)` | Rating stars (gold/yellow) |
| `--muted` | `oklch(0.95 0.01 210)` | Subtle backgrounds |
| `--core-muted-foreground` | `oklch(0.45 0.03 261)` | Secondary text |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Error states |
| `--destructive-foreground` | `oklch(0.98 0 0)` | Text on destructive |

#### Interactive/UI Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `oklch(0.9 0.02 210)` | Dividers, input borders |
| `--input` | `oklch(0.9 0.02 210)` | Form input borders |
| `--ring` | `oklch(0.63 0.19 259)` | Focus ring |
| `--overlay` | `oklch(0.2 0.02 220 / 0.5)` | Modal/dialog overlays |

#### Feedback Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `oklch(0.58 0.15 150)` | Success states |
| `--success-foreground` | `oklch(0.99 0 0)` | Text on success |
| `--warning` | `oklch(0.75 0.18 85)` | Warning states |
| `--warning-foreground` | `oklch(0.2 0.02 85)` | Text on warning |
| `--info` | `oklch(0.63 0.19 259)` | Info states |
| `--info-foreground` | `oklch(0.99 0 0)` | Text on info |

#### Section/Surface Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-warm` | `oklch(0.95 0.03 250)` | Peach-tinted sections (tours, features, testimonials) |
| `--surface-warm-foreground` | `oklch(0.35 0.03 250)` | Text on warm surfaces |
| `--surface-dark` | `oklch(0.15 0.02 160)` | Dark sections (features CTA, footer) |
| `--surface-dark-foreground` | `oklch(0.92 0.01 210)` | Text on dark surfaces |

#### Footer Surface Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--footer-bg` | `var(--surface-dark)` | Footer main background |
| `--footer-fg` | `var(--surface-dark-foreground)` | Footer primary text |
| `--footer-fg-muted` | `oklch(0.74 0.02 240)` | Footer secondary text |
| `--footer-link` | `oklch(from var(--surface-dark-foreground) l c h / 0.7)` | Footer link color |
| `--footer-link-hover` | `var(--surface-dark-foreground)` | Footer link hover color |
| `--footer-border` | `oklch(from var(--surface-dark-foreground) l c h / 0.15)` | Footer dividers |
| `--footer-newsletter-bg` | `white` | Newsletter panel background |
| `--footer-newsletter-fg` | `var(--core-muted-foreground)` | Newsletter panel text |
| `--footer-newsletter-border` | `transparent` | Newsletter panel border |

#### Brand Colors (Hospeda-specific)

| Token | Value | Usage |
|-------|-------|-------|
| `--hospeda-sky` | `oklch(0.8 0.08 259)` | Sky, light water |
| `--hospeda-sky-light` | `oklch(0.88 0.06 259)` | Very light sky |
| `--hospeda-river` | `oklch(0.63 0.19 259)` | River, water |
| `--hospeda-forest` | `oklch(0.5 0.14 155)` | Vegetation, nature |
| `--hospeda-sand` | `oklch(0.93 0.03 85)` | Beaches, sand |

#### Social Proof Avatar Gradients

Linear-gradient stops used for stacked avatar placeholders in social proof blocks (hero, testimonials).

| Token | Value | Usage |
|-------|-------|-------|
| `--avatar-1-from` | `oklch(0.25 0.08 255)` | Avatar 1 gradient start |
| `--avatar-1-to` | `oklch(0.36 0.12 255)` | Avatar 1 gradient end |
| `--avatar-2-from` | `oklch(0.65 0.15 75)` | Avatar 2 gradient start |
| `--avatar-2-to` | `oklch(0.78 0.17 80)` | Avatar 2 gradient end |
| `--avatar-3-from` | `oklch(0.5 0.1 195)` | Avatar 3 gradient start |
| `--avatar-3-to` | `oklch(0.65 0.13 195)` | Avatar 3 gradient end |
| `--avatar-4-from` | `oklch(0.42 0.12 155)` | Avatar 4 gradient start |
| `--avatar-4-to` | `oklch(0.62 0.16 155)` | Avatar 4 gradient end |

#### Chart Colors

| Token | Value |
|-------|-------|
| `--chart-1` | `oklch(0.63 0.19 259)` |
| `--chart-2` | `oklch(0.6 0.14 155)` |
| `--chart-3` | `oklch(0.7 0.18 55)` |
| `--chart-4` | `oklch(0.75 0.1 190)` |
| `--chart-5` | `oklch(0.5 0.08 240)` |

#### Dark Mode (`[data-theme="dark"]`)

All semantic tokens are overridden. Brand colors adjust for contrast on dark backgrounds. See `global.css` for the full dark mode block. Key differences:

| Token | Dark Value |
|-------|-----------|
| `--core-background` | `oklch(0.14 0.02 220)` |
| `--core-foreground` | `oklch(0.92 0.01 210)` |
| `--core-card` | `oklch(0.19 0.02 220)` |
| `--card-foreground` | `oklch(0.92 0.01 210)` |
| `--brand-primary` | `oklch(0.68 0.17 259)` |
| `--brand-secondary` | `oklch(0.25 0.05 255)` |
| `--brand-tertiary` | `oklch(0.28 0.05 155)` |
| `--brand-accent` | `oklch(0.72 0.19 55)` |
| `--rating-star` | `oklch(0.85 0.19 95)` |
| `--core-muted-foreground` | `oklch(0.6 0.03 261)` |
| `--surface-warm` | `oklch(0.2 0.03 50)` |
| `--surface-dark` | `oklch(0.1 0.02 160)` |
| `--border` | `oklch(0.28 0.02 220)` |
| `--ring` | `oklch(0.68 0.17 259)` |
| `--footer-bg` | `oklch(0.12 0.02 220)` |
| `--footer-fg` | `oklch(0.85 0.01 210)` |
| `--footer-fg-muted` | `oklch(0.6 0.02 240)` |
| `--footer-newsletter-bg` | `oklch(0.18 0.025 220)` |
| `--footer-newsletter-fg` | `oklch(0.8 0.01 210)` |
| `--footer-newsletter-border` | `oklch(0.3 0.02 220)` |
| `--footer-link` | `oklch(0.65 0.01 210)` |
| `--footer-link-hover` | `oklch(0.9 0.01 210)` |
| `--footer-border` | `oklch(from var(--brand-accent) l c h / 0.2)` |

Dark mode activates via `data-theme="dark"` on `<html>` (NOT `.dark` class). FOUC is prevented by an inline `<script>` in the HTML `<head>` that reads `localStorage` before first paint.

### 2.2 Spacing Tokens

Each token has an optional shared utility class in `components.css` that applies it to `padding-block`, `gap`, etc. Apply tokens directly via `var(--space-*)` in scoped styles when the shared class does not fit.

| Token | Value | Shared class | Usage |
|-------|-------|--------------|-------|
| `--space-section` | `120px` | `.py-section` | Standard section vertical padding |
| `--space-section-sm` | `80px` | `.py-section-sm` | Compact section padding |
| `--space-section-lg` | `160px` | `.py-section-lg` | Hero/extra-tall sections |
| `--space-container-x` | `15px` | _(applied inside `.section__container`)_ | Container horizontal padding |
| `--space-card-content` | `27px 30px 26px` | _(applied inside `.card__content`)_ | Card content area padding |
| `--space-card-gap` | `30px` | `.gap-card` | Gap between cards in grid |
| `--space-section-header-mb` | `50px` | `.mb-section-header` | Margin below section headers |

### 2.3 Border Radius Tokens

The design uses **asymmetric organic radius** as a signature visual element. Instead of a uniform radius on all four corners, shapes have one or two rounded corners.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` | Default small radius (buttons, inputs) |
| `--radius-sm` | `calc(var(--radius) - 4px)` | Tight radius |
| `--radius-md` | `calc(var(--radius) - 2px)` | Medium radius |
| `--radius-lg` | `var(--radius)` | Standard radius |
| `--radius-xl` | `calc(var(--radius) + 4px)` | Large radius |
| `--radius-organic` | `0px 100px` | Signature asymmetric shape (cards, images) |
| `--radius-organic-sm` | `0px 75px` | Smaller organic radius (card content) |
| `--radius-organic-alt` | `100px 0px` | Reversed organic shape (blog thumbnails) |
| `--radius-card` | `24px` | Card outer container |
| `--radius-pill` | `9999px` | Pills, tags, full-round |
| `--radius-button` | `8px` | Buttons |

#### Organic Radius Patterns

```
Standard card image:    border-radius: 0px 100px;   (top-left sharp, others rounded)
Card content area:      border-radius: 0px 75px;    (slightly less rounded)
Blog thumbnail:         border-radius: 100px 0px;   (reversed)
Gallery items:          border-radius: 0px 100px;   (consistent with cards)
Team member photos:     border-radius: 0px 100px;
Blog card outer:        border-radius: 24px;        (uniform, wraps the inner organic shapes)
```

### 2.4 Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 4px 12px -2px oklch(from var(--core-foreground) l c h / 0.08)` | Default card shadow |
| `--shadow-card-hover` | `0 12px 24px -4px oklch(from var(--core-foreground) l c h / 0.12)` | Hovered card shadow |
| `--shadow-search` | `0 4px 60px oklch(from var(--core-foreground) l c h / 0.1)` | Search form shadow |
| `--shadow-nav` | `0 2px 4px oklch(from var(--core-foreground) l c h / 0.15)` | Sticky navbar shadow |

All shadows use `oklch(from var(--core-foreground) ...)` so they automatically adapt to dark mode. For "no shadow", use the CSS keyword `none` directly.. there is no token for it.

### 2.5 Transition Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `0.2s` | Micro-interactions (focus, active) |
| `--duration-normal` | `0.4s` | Most hover effects, color changes |
| `--duration-slow` | `0.5s` | Buttons, complex transitions |
| `--duration-reveal` | `1s` | Scroll reveal animations |
| `--ease-bounce` | `cubic-bezier(0.1, 0, 0.3, 1)` | Button background fill effect, image scale, destination cards |

Only one easing token is defined. For standard ease curves (`ease`, `ease-out`, `ease-in-out`), use the CSS keywords directly.. they do not need a custom property.

### 2.6 Z-Index Tokens

Only three z-index layers are defined as tokens. Use raw `z-index` numbers (e.g. `z-index: -1`, `z-index: 5`) for one-off decorative stacking within a section; reserve tokens for app-wide layers.

| Token | Value | Usage |
|-------|-------|-------|
| `--z-content` | `10` | Content wrappers stacked above decoratives |
| `--z-nav` | `50` | Fixed navbar and equivalent overlays |
| `--z-modal` | `100` | Modal dialogs, toasts, scroll-to-top, anything on top |

---

## 3. Typography

### 3.1 Font Stack

| Role | Font | Variable | Tailwind | Weights | Usage |
|------|------|----------|----------|---------|-------|
| **Body** | Roboto | `--font-sans` | `font-sans` | 300, 400, 500, 600, 700 | All body text, UI elements, meta info |
| **Headings** | Geologica | `--font-heading` | `font-heading` | 400, 500, 600, 700 | Section titles, card titles, hero text |
| **Decorative** | Caveat | `--font-decorative` | `font-decorative` | 400, 700 | Section taglines, handwritten accents |

Fonts loaded from Google Fonts in the HTML `<head>`:

```
Roboto: 300,400,500,600,700 (normal + italic)
Geologica: 400,500,600,700
Caveat: 400,700
```

### 3.2 Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `--text-hero` | `clamp(3rem, 2rem + 5vw, 5.75rem)` | `1.07` | `700` | Hero main heading |
| `--text-display` | `clamp(2rem, 1.5rem + 3vw, 3rem)` | `1.2` | `600` | Feature section headings |
| `--text-h2` | `clamp(1.75rem, 1.5rem + 1.75vw, 2.75rem)` | `1.17` | `500-600` | Section titles |
| `--text-h3` | `clamp(1.25rem, 1rem + 0.75vw, 1.625rem)` | `1.33` | `600` | Card titles, sub-section headers |
| `--text-h4` | `clamp(0.9375rem, 0.875rem + 0.25vw, 1.125rem)` | `1.4` | `600` | Smaller headings |
| `--text-body` | `1rem` | `1.5` | `400` | Body text, paragraphs |
| `--text-body-sm` | `0.875rem` | `1.5` | `400` | Smaller body text |
| `--text-meta` | `0.8125rem` | `1.5` | `400-500` | Meta info, dates, categories |
| `--text-caption` | `0.75rem` | `1.4` | `400` | Captions, fine print |
| `--text-tagline` | `clamp(1.125rem, 1rem + 0.625vw, 1.5rem)` | `1` | `700` | Section taglines (Caveat font) |
| `--text-nav` | `0.875rem` | `1` | `400` | Navigation links |
| `--text-button` | `1rem` | `1` | `600` | Button labels |

### 3.3 Type Patterns

Typography is applied directly in CSS (scoped `<style>` in Astro components, or `.module.css` for React islands) by combining `font-family`, `font-weight`, `font-size`, and `color` tokens. A few patterns are pre-packaged as BEM-lite classes in `components.css` (for example `.section-header__tagline`, `.section-header__title`, `.section-header__subtitle`). Reuse them when rendering section headers; otherwise apply tokens inline.

| Context | Font token | Size token | Weight | Color token | Shared class (if any) |
|---------|-----------|------------|--------|-------------|-----------------------|
| Hero H1 | `var(--font-heading)` | `var(--text-hero)` | 700 | `var(--core-foreground)` | - |
| Hero tagline | `var(--font-decorative)` | `var(--text-tagline)` | 700 | `var(--brand-accent)` | - |
| Section tagline | `var(--font-decorative)` | `var(--text-tagline)` | 700 | `var(--brand-accent)` | `.section-header__tagline` |
| Section H2 | `var(--font-heading)` | `var(--text-h2)` | 700 | `var(--core-foreground)` | `.section-header__title` |
| Section subtitle | `var(--font-sans)` | `var(--text-body)` | 400 | `var(--core-muted-foreground)` | `.section-header__subtitle` |
| Card title | `var(--font-heading)` | `var(--text-h3)` | 600 | `var(--core-foreground)` | - |
| Card meta | `var(--font-sans)` | `var(--text-meta)` | 400 | `var(--core-muted-foreground)` | - |
| Card price | `var(--font-sans)` | `var(--text-body)` | 500 | `var(--core-foreground)` | - |
| Button label | `var(--font-sans)` | `var(--text-button)` | 600 | (variant dependent) | `.btn-gradient` |
| Nav link | `var(--font-sans)` | `var(--text-nav)` | 400 | `var(--core-foreground)` | - |
| Footer heading | `var(--font-heading)` | `var(--text-h4)` | 600 | `var(--surface-dark-foreground)` | - |
| Footer link | `var(--font-sans)` | `var(--text-body-sm)` | 400 | `var(--footer-link)` | - |

Example (card title in an Astro component's scoped `<style>`):

```css
.accommodation-card__title {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: var(--text-h3);
  color: var(--core-foreground);
}
```

Example (reusing a shared class in markup, no inline overrides needed):

```astro
<div class="section-header">
  <p class="section-header__tagline">{tagline}</p>
  <h2 class="section-header__title">{title}</h2>
  <p class="section-header__subtitle">{subtitle}</p>
</div>
```

### 3.4 Text Rules

- Headings use `text-wrap: balance;` for even line breaks (see `.section-header__title` in `components.css`).
- Body text line-height is `1.5` to `1.6` (see `.about-us__body` with `line-height: 1.6` for a concrete example).
- Measure cap: limit long prose blocks with `max-width: 36rem;` (matches `.section-header__subtitle`) or `max-width: 65ch;` for article-length copy.
- Centered subtitles: set `margin-inline: auto;` together with `text-align: center;`. Left-aligned variants (`.section-header--left`) reset the inline margin to `0`.
- Price display: use `font-family: var(--font-sans);` with `font-weight: 500;` (medium) — never `700` (bold).

Example (section subtitle idiom copied from `components.css`):

```css
.section-header__subtitle {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  color: var(--core-muted-foreground);
  max-width: 36rem;
  margin-inline: auto;
  margin-top: 1rem;
}
```

---

## 4. Layout

### 4.1 Container

| Token | Value | Usage |
|-------|-------|-------|
| `--container-max` | `1350px` | Main content container |
| `--container-narrow` | `900px` | Narrow content (forms, text pages) |
| `--container-wide` | `1536px` | Full-width sections with side padding |
| `--container-px` | `15px` | Horizontal padding (all breakpoints) |

```html
<!-- Standard container -->
<div class="mx-auto max-w-container px-container">

<!-- Narrow container -->
<div class="mx-auto max-w-container-narrow px-container">
```

### 4.2 Section Spacing

| Context | Classes |
|---------|---------|
| Standard section | `py-section` (120px) |
| Compact section | `py-section-sm` (80px) |
| Hero section | `pt-section-lg pb-section` (top 160px for navbar clearance) |
| Section header bottom margin | `mb-section-header` (50px) |

### 4.3 Grid Patterns

Two reusable grid classes live in `components.css`. Reuse them before hand-rolling a new grid.

| Class | Mobile | ≥640px | ≥1024px | ≥1280px | Gap |
|-------|--------|--------|---------|---------|-----|
| `.grid-cards` | 1 col | 2 cols | 3 cols | 4 cols | `var(--space-card-gap)` (30px) |
| `.grid-cards--3col` | 1 col | 2 cols | 3 cols | 3 cols | `var(--space-card-gap)` |

Usage (real example from `FeaturedAccommodationsSection.astro`):

```astro
<div class="grid-cards--3col accommodations__grid">
  {items.map((item, i) => (
    <div data-reveal="up" style={`transition-delay: ${i * 100}ms`}>
      <AccommodationCard data={item} locale={locale} />
    </div>
  ))}
</div>
```

For any other layout (featured + secondary rows, 2-column split, stats block, footer columns), declare the grid directly in the component's scoped `<style>` using `display: grid;` + `grid-template-columns:` and project breakpoints. Copy the idiom from `LatestArticlesSection.astro`:

```css
.articles__secondary-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-card-gap);
}
@media (min-width: 640px) {
  .articles__secondary-row--3col {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .articles__secondary-row--3col {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

Project breakpoints (used consistently across sections): `640px` (small/tablet portrait), `768px` (tablet), `1024px` (desktop), `1280px` (wide desktop). Mobile-first: base rules apply below `640px`, media queries progressively add columns.

| Content | Recommended approach |
|---------|----------------------|
| Accommodation cards (3-col cap) | `.grid-cards--3col` |
| Destination / team cards (4-col cap) | `.grid-cards` |
| Blog cards | `.grid-cards--3col` or a custom `articles__secondary-row--Ncol` pattern for featured + secondary layouts |
| Gallery (masonry) | Custom `grid-template-columns` with `grid-row: span N` modifiers |
| Stats | Custom grid (see `StatsSection.astro`: 2 cols mobile, 3 cols `≥768px`) |
| Footer columns | Custom grid declared in `Footer.astro` scoped style |
| 2-column split (CTA + illustration) | Custom `grid-template-columns: minmax(0, 45%) minmax(0, 55%)` at `≥1024px` (see `CtaOwnersSection.astro`) |

### 4.4 Section Background Alternation

Sections alternate between the default (`var(--core-background)`) and peach warm (`var(--surface-warm)`) surfaces. Apply the shared classes from `components.css` directly on the `<section>` element — never write the background-color by hand.

| Class | Background | Defined at |
|-------|------------|-----------|
| `.section` (no modifier) | `var(--core-background)` — default white/light | `components.css:33` |
| `.section--warm` | `var(--surface-warm)` — peach tint | `components.css:38-40` |
| `.section--dark` | `var(--surface-dark)`, sets `color: var(--surface-dark-foreground)` | `components.css:41-44` |

Homepage alternation order (real components):

```
Hero:                 custom bg (var(--brand-secondary) sky blue, see HeroSection.astro)
Destinations:         linear-gradient from var(--core-background) through var(--surface-warm) (DestinationsSection.astro)
About/Features:       .section (default background)
Testimonials:         .section (var(--core-background), see TestimonialsSection.astro)
Blog:                 .section (default background)
CtaOwners banner:     custom panel with var(--brand-tertiary) rounded inset (CtaOwnersSection.astro)
Footer:               var(--footer-bg) = var(--surface-dark)
```

Usage in markup:

```astro
<!-- Default white background -->
<section class="section my-section">…</section>

<!-- Warm peach background -->
<section class="section section--warm my-section">…</section>

<!-- Dark background (footer, CTA) -->
<section class="section section--dark my-section">…</section>
```

Rule: never place two sections with the same background class back-to-back. `.section--dark` is reserved for terminal sections (footer wave CTA panels); do not use it mid-page without design approval.

---

## 5. Components

### 5.1 Section Header

Every content section uses the shared `SectionHeader` Astro component (`src/components/shared/SectionHeader.astro`). Do not reproduce its markup inline.

```astro
---
import SectionHeader from '@/components/shared/SectionHeader.astro';
---

<SectionHeader
  tagline={t('mySection.tagline')}
  title={t('mySection.title')}
  subtitle={t('mySection.subtitle')}
/>
```

#### Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `tagline` | `string` | required | Rendered in Caveat handwritten font |
| `title` | `string` | required | Main section title |
| `subtitle` | `string?` | `undefined` | Optional supporting text |
| `alignment` | `'center' \| 'left'` | `'center'` | Text alignment |
| `variant` | `'light' \| 'dark'` | `'light'` | Use `'dark'` on dark surfaces |
| `actionLabel` | `string?` | `undefined` | Pill action link (requires `alignment='left'`) |
| `actionHref` | `string?` | `undefined` | URL for the action link |

#### BEM classes applied

The component applies these shared classes from `components.css:65-103`:

| Class | Font | Size token | Color token | CSS line |
|-------|------|-----------|------------|---------|
| `.section-header` | — | — | — | `components.css:65` |
| `.section-header__tagline` | `var(--font-decorative)` | `var(--text-tagline)` | `var(--brand-accent)`, weight 700 | `components.css:72-77` |
| `.section-header__title` | `var(--font-heading)` | `var(--text-h2)` | `var(--core-foreground)`, weight 700 | `components.css:79-86` |
| `.section-header__subtitle` | `var(--font-sans)` | `var(--text-body)` | `var(--core-muted-foreground)`, max-width 36rem | `components.css:87-94` |

Modifier classes applied automatically by props:

- `.section-header--left` — resets `text-align` and `margin-inline` for subtitle
- `.section-header--dark` — overrides title to `white` and subtitle to `oklch(1 0 0 / 0.7)` for dark backgrounds
- `.section-header--with-action` — flex row with text block left and pill action link right

The wrapper `.section-header` sets `margin-bottom: var(--space-section-header-mb)` (50px) automatically. Do not add extra margin-bottom to the component's parent.

### 5.2 Cards

The shared base classes in `components.css:105-130` apply to all cards. Specialized card components extend these with their own scoped `<style>` blocks or CSS Modules.

#### Shared base classes (`components.css:105-130`)

| Class | Property | Value |
|-------|----------|-------|
| `.card` | `background-color` | `var(--core-card)` |
| `.card` | `border-radius` | `var(--radius-card)` (24px) |
| `.card` | `box-shadow` | `var(--shadow-card)` |
| `.card:hover` | `box-shadow` | `var(--shadow-card-hover)` |
| `.card__image` | `border-radius` | `var(--radius-organic)` (0px 100px) |
| `.card__image` | `overflow` | `hidden` |
| `.card__image img` | `transition` | `transform var(--duration-normal) ease-in-out` |
| `.card:hover .card__image img` | `transform` | `scale(1.1)` |
| `.card__content` | `padding` | `var(--space-card-content)` (27px 30px 26px) |

Not all card implementations use all three shared classes — each card component uses BEM-lite scoped classes suited to its design. The table above describes the canonical shared base; component-specific overrides take precedence.

#### Accommodation Card

Component: `src/components/shared/cards/AccommodationCard.astro`

This card does not use the generic `.card` class directly. It uses a self-contained BEM structure under `.acc-card`:

| Class | Property | Value |
|-------|----------|-------|
| `.acc-card` | `background-color` | `var(--core-card)` |
| `.acc-card` | `border` | `1px solid var(--border)` |
| `.acc-card` | `border-radius` | `var(--radius-md)` (12px, uniform) |
| `.acc-card` | `box-shadow` | `var(--shadow-card)` |
| `.acc-card:hover` | `box-shadow` | `var(--shadow-card-hover)` |
| `.acc-card__image-area` | `height` | `clamp(160px, 30vw, 220px)` |
| `.acc-card__image-area` | `border-radius` | `var(--radius-md) var(--radius-md) 0 0` (top rounded) |
| `.acc-card__img` | `transition` | `transform 200ms ease-out` |
| `.acc-card:hover .acc-card__img` | `transform` | `scale(1.08)` |
| `.acc-card__name` | `font-family` | `var(--font-heading)` |
| `.acc-card__name` | `font-weight` | `700` |
| `.acc-card__name` | `color` | `var(--core-foreground)` |
| `.acc-card__description` | `font-family` | `var(--font-sans)` |
| `.acc-card__description` | `color` | `var(--core-muted-foreground)` |
| `.acc-card__price-value` | `font-family` | `var(--font-heading)` |
| `.acc-card__price-value` | `color` | `var(--brand-accent)` |
| `.acc-card__price-label` | `color` | `var(--core-muted-foreground)` |
| `.acc-card__star--filled` | `color` | `var(--rating-star)` |
| `.acc-card__location-bar` | `background-color` | `var(--surface-warm)` |

The card includes a wave SVG separator between image and content area (`fill: var(--core-card)`), a diagonal status corner badge (`:before` triangle using CSS custom property `--corner-bg`), and a featured badge pill (`border-radius: 9999px`). The CTA pill uses a gradient built from `var(--brand-secondary)` and `var(--core-background)`.

#### Destination Card

Component: `src/components/sections/DestinationsSection.astro` delegates to `DestinationsIsland.client.tsx`.

The destination section uses a linear-gradient background from `var(--core-background)` through `var(--surface-warm)` and back. Inside the React island, each destination card is an image-only card with overlay content that slides up on hover. Tokens consumed:

- Outer container: `border-radius: var(--radius-organic)` (asymmetric 0px 100px)
- Image: `object-fit: cover`, `transition: transform var(--duration-normal) ease-in-out`, hover `scale(1.1)`
- Overlay title: `font-family: var(--font-heading)`, color on `var(--core-card)` surface
- Link pill: `border-radius: var(--radius-pill)`, `background-color: var(--brand-accent)`, `color: var(--accent-foreground)`

#### Article/Blog Card

Component: `src/components/shared/cards/ArticleCard.astro`

| Class | Property | Value |
|-------|----------|-------|
| `.article-card` | `border-radius` | `var(--radius-card)` (24px) |
| `.article-card` | `background-color` | `var(--core-card)` |
| `.article-card` | `box-shadow` | `var(--shadow-card)` |
| `.article-card:hover` | `box-shadow` | `var(--shadow-card-hover)` |
| `.article-card:hover` | `transform` | `translateY(-4px)` |
| `.article-card__image-wrapper` | `aspect-ratio` | `16 / 9` |
| `.article-card__img` | `transition` | `transform var(--duration-normal) ease` |
| `.article-card:hover .article-card__img` | `transform` | `scale(1.04)` |
| `.article-card__title` | `font-family` | `var(--font-heading)` |
| `.article-card__title` | `color` | `var(--core-foreground)` |
| `.article-card:hover .article-card__title` | `color` | `var(--brand-primary)` |
| `.article-card__excerpt` | `font-family` | `var(--font-sans)` |
| `.article-card__excerpt` | `color` | `var(--core-muted-foreground)` |
| `.article-card__cta` | `color` | `var(--brand-primary)` |
| `.article-card__accent-bar` | `height` | `4px`, color from `getPostCategoryColor()` |

Category color is resolved by `getPostCategoryColor({ category })` in `src/lib/colors.ts` and applied via inline `style` on the accent bar. Badge components use the same color scheme. The image container does NOT use `var(--radius-organic)` — article cards keep a rectangular image area (`border-radius: 0`) within the rounded outer card.

The featured variant is `src/components/shared/cards/FeaturedArticleCard.astro` and uses the same token set at larger scale.

#### Testimonial Card

Component: `src/components/sections/TestimonialsCarousel.client.tsx` + `TestimonialsCarousel.module.css`

The testimonial carousel is a React island (`client:visible`). Each slide card uses CSS Modules:

| Module class | Property | Value |
|-------------|----------|-------|
| `.slideCard` | `background-color` | `var(--core-card)` |
| `.slideCard` | `border-radius` | `var(--radius-card)` (24px) |
| `.slideCard` | `box-shadow` | `var(--shadow-card)` |
| `.slideCard:hover` | `box-shadow` | `var(--shadow-card-hover)` |
| `.slideCard` | `padding` | `1.5rem 1.25rem 1.25rem` (mobile), `1.75rem 1.5rem 1.5rem` (≥768px) |
| `.mainSlide` (inactive) | `opacity` | `0.35`, `transform: scale(0.95)`, `filter: blur(2px)` |
| `.mainSlideActive` | `opacity` | `1`, `transform: scale(1)`, `filter: blur(0)` |
| `.dot` | `background-color` | `var(--brand-secondary-foreground)`, `opacity: 0.35` |
| `.dotActive` | `background-color` | `var(--brand-accent)`, `opacity: 1`, stretched to `1.5rem` width |

The carousel uses a peek layout: mobile slides are `flex: 0 0 88%`, desktop (≥768px) `flex: 0 0 38%`. Navigation uses `IconButton` arrows and pill-shaped dot indicators. There is no full-page side-by-side layout with a blob — the section is a standard `.section` (white background, see `TestimonialsSection.astro`) wrapping the carousel island.

### 5.3 Buttons

Two canonical button components cover every interactive affordance in the app:

- **`GradientButton`** (`shared/GradientButton.astro`, `ui/GradientButton.tsx`).. visible-label CTAs and form submits. Gradient fill, pill shape by default, outline variants that fill on hover.
- **`IconButton`** (`shared/IconButton.astro`, `ui/IconButton.tsx`).. icon-only interactive elements (hamburger, carousel arrows, toggles, drawer close). `ariaLabel` is mandatory because there is no visible text.

Both components share CSS via `components.css` and have paired Astro + React implementations. **Do NOT hand-roll `<button>` elements for standard UI.** Inline `<button>` is only acceptable for compound widgets whose styling is tightly coupled to their structure (see 5.3.5).

#### 5.3.1 GradientButton — variants

| Variant | Background | Hover effect | Recommended usage |
|---------|------------|--------------|-------------------|
| `accent` (default) | Linear gradient built from `var(--brand-accent)` (sunset orange), box-shadow `0 4px 14px accent/0.32` | Shadow expands to `0 6px 20px accent/0.45`, gradient shifts, `translateY(-2px)` | Primary CTAs, form submits, main hero action |
| `primary` | Linear gradient built from `var(--brand-primary)` (river blue), box-shadow `0 4px 14px primary/0.32` | Shadow expands to `0 6px 20px primary/0.45`, gradient shifts, lift | Navigation CTAs and secondary primary actions when orange would clash |
| `outline-primary` | Transparent with 1.5px blue border, blue text | `::before` gradient fades in, text becomes white, shadow appears | Secondary actions paired with a solid primary button |
| `outline-accent` | Transparent with 1.5px orange border, orange text | `::before` orange gradient fades in, text becomes white, shadow appears | Secondary actions on light/peach backgrounds next to an accent CTA |

All gradients are built on the fly with `oklch(from var(--brand-*) calc(l * X) c h)`, so dark mode adjusts automatically.

#### 5.3.2 GradientButton — sizes

| Size | Padding | Font size | Usage |
|------|---------|-----------|-------|
| `sm` | `8px 20px` | `0.8125rem` | Compact toolbars, filter chips, inline actions |
| `md` (default) | `12px 28px` | `var(--text-button)` | Standard CTAs everywhere |
| `lg` | `16px 36px` | `1rem` | Hero CTAs, pricing plan buttons, empty-state primary actions |

#### 5.3.3 GradientButton — shapes

| Shape | Radius | Usage |
|-------|--------|-------|
| `pill` (default) | `var(--radius-pill)` (9999px) | Marketing surfaces, CTAs, navigation |
| `rounded` | `var(--radius-button)` (8px) | Form submits next to inputs, pricing cards, anything aligned with a rectangular field |

Shared base styles: `font-family: var(--font-sans)`, `font-weight: 600`, border `1.5px solid transparent`, focus ring via `outline: 2px solid var(--ring)` with `2px` offset. Disabled state: `opacity: 0.5; cursor: not-allowed; pointer-events: none` (also triggered by `aria-disabled="true"`).

#### 5.3.4 GradientButton — usage examples

##### Navigation CTA (Astro, anchor)

```astro
---
import GradientButton from '@/components/shared/GradientButton.astro';
---
<GradientButton
  as="a"
  href={buildUrl(locale, 'alojamientos')}
  label={t('home.hero.ctaExplore')}
  variant="accent"
/>
```

##### Form submit with loading state (React island, rounded shape)

```tsx
import { GradientButton } from '@/components/ui/GradientButtonReact';

<GradientButton
  as="button"
  type="submit"
  shape="rounded"
  label={isLoading ? t('common.loading') : t('search.submit')}
  disabled={isLoading}
  aria={{ busy: isLoading }}
/>
```

##### Secondary outline action (React island)

```tsx
import { GradientButton } from '@/components/ui/GradientButtonReact';

<GradientButton
  as="button"
  variant="outline-accent"
  size="sm"
  label={t('common.cancel')}
  onClick={handleCancel}
/>
```

##### With a leading icon (Astro, named slot)

```astro
---
import GradientButton from '@/components/shared/GradientButton.astro';
import { SearchIcon } from '@repo/icons';
---
<GradientButton label={t('search.button')} variant="accent">
  <SearchIcon slot="leading" size={18} weight="bold" aria-hidden="true" />
</GradientButton>
```

##### With a trailing icon (React island, `leadingIcon` / `trailingIcon` props)

```tsx
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { ArrowRightIcon } from '@repo/icons';

<GradientButton
  as="a"
  href={buildUrl(locale, 'alojamientos')}
  label={t('home.cta.seeAll')}
  trailingIcon={<ArrowRightIcon size={18} weight="bold" aria-hidden="true" />}
/>
```

> **ARIA tip**.. use the `aria` prop as a flat record (`aria={{ busy: true, expanded: false }}`). The component prefixes each key with `aria-` and stringifies booleans. The `label` key inside `aria` is silently dropped.. the visible text comes from the `label` prop.

#### 5.3.5 IconButton

Icon-only interactive element. Used across the header (hamburger, user nav, theme toggle), carousels (prev/next arrows), drawers (close), toggles, and scroll-to-top overlays.

**Hard rule**.. every `IconButton` MUST receive an `ariaLabel`. Without visible text, screen readers have nothing to announce.

##### Variants

| Variant | Visual treatment |
|---------|------------------|
| `ghost` (default) | Transparent background, subtle hover fill |
| `solid` | Filled with brand color, elevated shadow |
| `outline` | Visible border, fills with brand color on hover |

##### Sizes

| Size | Container | Recommended icon size |
|------|-----------|-----------------------|
| `xs` | `28px` | `16` |
| `sm` | `32px` | `18` |
| `md` (default) | `40px` | `20` |
| `lg` | `48px` | `24` |

##### Shapes

| Shape | Radius | Usage |
|-------|--------|-------|
| `circle` (default) | `var(--radius-pill)` | Toggles, navigation arrows, social buttons, anything round in the reference design |
| `square` | `var(--radius-button)` (8px) | Toolbar actions aligned with rectangular fields |

#### 5.3.6 IconButton — usage examples

##### Hamburger menu (Astro)

```astro
---
import IconButton from '@/components/shared/IconButton.astro';
import { HamburgerIcon } from '@repo/icons';
---
<IconButton
  ariaLabel={t('nav.openMenu')}
  aria={{ expanded: false, controls: 'mobile-menu' }}
  data={{ action: 'toggle-menu' }}
>
  <HamburgerIcon size={24} aria-hidden="true" />
</IconButton>
```

##### Carousel arrow (React island)

```tsx
import { IconButton } from '@/components/ui/IconButtonReact';
import { CaretRightIcon } from '@repo/icons';

<IconButton
  ariaLabel={t('carousel.next')}
  variant="outline"
  size="sm"
  onClick={scrollNext}
  disabled={!canScrollNext}
>
  <CaretRightIcon size={18} weight="bold" aria-hidden="true" />
</IconButton>
```

##### Toggle button with `aria-pressed` (React island)

```tsx
import { IconButton } from '@/components/ui/IconButtonReact';
import { SunIcon } from '@repo/icons';

<IconButton
  ariaLabel={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
  aria={{ pressed: isDark }}
  onClick={toggleTheme}
>
  <SunIcon size={20} weight="regular" aria-hidden="true" />
</IconButton>
```

##### Close button inside a drawer with focus management (React island)

```tsx
import { useRef } from 'react';
import { IconButton } from '@/components/ui/IconButtonReact';
import { CloseIcon } from '@repo/icons';

const closeButtonRef = useRef<HTMLButtonElement>(null);
// focus on open via useEffect…

<IconButton
  ref={closeButtonRef}
  ariaLabel={t('common.close')}
  variant="ghost"
  tabIndex={isOpen ? 0 : -1}
  onClick={handleClose}
>
  <CloseIcon size={20} aria-hidden="true" />
</IconButton>
```

> **CSS note**.. `.btn-icon` variants are consumed by the component but the styles are centralized in `components.css`. If a new variant/size/shape is introduced in the component, update the CSS alongside it in the same PR.. never let the component reference a class that does not exist.

#### 5.3.7 Decision tree — which component do I use?

1. **Does the control have visible text?** → Yes: `GradientButton`. No: `IconButton`.
2. **Is it a link (navigates to another route)?** → `as="a"` + `href`. If it triggers an action in-place: `as="button"`.
3. **Is it a form submit?** → `GradientButton as="button" type="submit"`. Pair with `shape="rounded"` when it sits inline with form fields.
4. **Is it a visual on/off toggle?** → Use `aria={{ pressed: boolean }}` so assistive tech reports state.
5. **Does it expand/collapse a region (drawer, menu, accordion)?** → Use `aria={{ expanded: boolean, controls: 'target-id' }}`.
6. **Do you need a ref, programmatic focus, or dynamic `tabIndex`?** → `IconButton` forwards `ref` and supports `tabIndex` directly; use the React version.

#### 5.3.8 Legitimate exceptions

Native `<button>` is acceptable only in compound UI where styling is tightly coupled to internal structure and the general components would not compose cleanly:

- `ScrollToTop` (progress ring wraps an SVG circle around the icon)
- `SearchBar` internals (field-bound submit button sized to match the field row)
- `FilterSidebar` chip toggles (multi-state pills with counters inside)
- OAuth provider buttons with third-party branding requirements

In every other case, prefer `GradientButton` / `IconButton`.

### 5.4 Badges

Badges are rendered by `src/components/shared/Badge.astro`. The component ships two pieces:

1. A shared base class `.badge` defined in `components.css` (pill shape via `var(--radius-pill)`, `font-size: var(--text-caption)`, `padding: 4px 12px`, `font-weight: 500`, min-height `44px` for touch targets).
2. An inline `style` attribute that paints the surface, text, and border using tokenized color values. The color palette for each entity type is resolved by helpers in `src/lib/colors.ts` and returned as a `ColorScheme` (`{ bg, text, border }`). Every value references a design token — nothing is hardcoded.

#### Props

| Prop | Type | Notes |
|------|------|-------|
| `label` | `string` | Text rendered inside the badge. |
| `href` | `string?` | When provided, the badge renders as `<a>`; otherwise `<span>`. |
| `colorScheme` | `BadgeColorScheme` | `{ bg, text, border }` — each value is a CSS expression (e.g. `oklch(from var(--brand-accent) l c h / 0.15)`, `var(--brand-accent)`). |
| `size` | `'sm' \| 'md'` | `sm` uses `2px 8px` padding, `md` (default) uses `4px 12px`. |
| `variant` | `'default' \| 'filled-dark'` | `default` applies `colorScheme` inline; `filled-dark` uses the `.badge--filled-dark` class (solid dark surface, uppercase label, `colorScheme` ignored). |

#### ColorScheme recipe

Every scheme follows the same formula (see `scheme()` in `src/lib/colors.ts`):

```ts
{
  bg:     `oklch(from var(--<token>) l c h / 0.15)`, // 15% tint of the token
  text:   `var(--<token>)`,                          // solid token color for text
  border: `oklch(from var(--<token>) l c h / 0.30)`  // 30% tint for the 1px border
}
```

Resolved tokens are always semantic: `--brand-accent`, `--brand-primary`, `--brand-secondary`, `--hospeda-forest`, `--hospeda-river`, `--hospeda-sand`, `--hospeda-sky`, `--core-muted-foreground`, etc. Helpers like `getAccommodationTypeColor`, `getPostCategoryColor`, `getEventCategoryColor`, and `getTagColor` live in `src/lib/colors.ts`.

#### Variants

##### `default`

Per-entity colors applied via inline `style`. Base class `.badge` provides layout and typography.

```astro
---
import Badge from '@/components/shared/Badge.astro';
import { getAccommodationTypeColor } from '@/lib/colors';

const colorScheme = getAccommodationTypeColor({ type: 'hotel' });
---
<Badge label="Hotel" colorScheme={colorScheme} />
```

##### `filled-dark`

Uniform dark pill. Background is `var(--core-foreground)`, text is `var(--core-background)`, label is uppercased, letter-spacing `0.03em`. Used on the homepage filter row when all badges must look identical regardless of type. The `colorScheme` prop is ignored; only padding is taken from `size`.

```astro
<Badge label="Cabañas" variant="filled-dark" />
```

#### Focus state

`.badge:focus-visible` draws a 2px outline using `var(--brand-primary)` with 2px offset (applies when rendered as `<a>`).

### 5.5 Form Inputs

There is no generic `Input` component in the app. Every form styles its own fields in either a scoped `<style>` block (Astro) or a co-located CSS Module (`.module.css`, React islands), always consuming the same set of tokens. The canonical recipe below is copied from `src/components/auth/SignIn.module.css` and should be the starting point for any new input.

#### Canonical input recipe

| Property | Value | Token |
|----------|-------|-------|
| `width` | `100%` | — |
| `padding` | `0.625rem 0.875rem` | — |
| `border` | `1px solid` | `var(--border)` |
| `border-radius` | `var(--radius-button)` (8px) | `--radius-button` |
| `font-family` | `var(--font-sans)` | `--font-sans` |
| `font-size` | `var(--text-body)` | `--text-body` |
| `color` | `var(--core-foreground)` | `--core-foreground` |
| `background-color` | `var(--core-card)` | `--core-card` |
| `transition` | `border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease` | `--duration-fast` |

Placeholder color: `var(--core-muted-foreground)`. Disabled state: `opacity: 0.6; cursor: not-allowed`.

#### Focus ring

Focus uses `--brand-primary` both as the border color and as a translucent outer ring (no `outline`):

```css
.input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px oklch(from var(--brand-primary) l c h / 0.15);
}
```

For labels above inputs use `font-size: var(--text-body-sm); font-weight: 500; color: var(--core-foreground); margin-bottom: 0.375rem;` (see `.label` in `src/components/auth/SignIn.module.css`).

Reference implementations:

- React islands: `src/components/auth/SignIn.client.tsx` + `src/components/auth/SignIn.module.css` (`.field`, `.label`, `.input`).
- Astro scoped styles: `src/layouts/Footer.astro` (`.footer__newsletter-input` — pill-shaped 12px radius variant for the newsletter panel, focus via `border-color: var(--footer-newsletter-fg)`).

#### Hero search bar

The homepage search bar is a compound widget, not a set of standalone inputs. See `src/components/sections/SearchBar.astro` (visual Astro shell) and `src/components/sections/SearchBar.client.tsx` + `SearchBar.module.css` (interactive island). It is structured as a horizontal row of icon + label + value columns separated by vertical dividers, wrapped in a single rounded container, with a trailing submit rendered as `GradientButton` (`variant="accent"`, `shape="rounded"`). Do NOT copy its styles for generic forms — the fields inside are buttons that open dropdowns, not text inputs.

### 5.6 Navbar

Implemented by `src/layouts/Header.astro`. Two class layers cooperate:

1. `.navbar` / `.navbar--scrolled` in `components.css` — shared sticky positioning, z-index, and scrolled-state surface.
2. `.header` / `.header--hero` and `.header__*` scoped BEM-lite classes inside `Header.astro` — layout, logo, nav links, hamburger, and user area.

A vanilla script inside `Header.astro` toggles the `.navbar--scrolled` class on the `<header>` element when `window.scrollY > 10`, and re-runs on every `astro:page-load` event (Astro View Transitions).

#### Shared base (`components.css`)

```css
.navbar {
  position: sticky;
  top: 0;
  z-index: var(--z-nav);
  max-height: 80px;
  transition: background-color 300ms ease, backdrop-filter 300ms ease, box-shadow 300ms ease;
}
.navbar--scrolled {
  background-color: oklch(from var(--core-card) l c h / 0.95);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 3px oklch(0 0 0 / 0.1);
}
```

#### States

| State | Background | Text color | Shadow |
|-------|------------|------------|--------|
| Default (non-hero pages) | `oklch(from var(--core-card) l c h / 0.85)` + `blur(8px)` | `var(--core-foreground)` | `0 1px 2px` |
| Hero page, at top (`.header--hero`) | `transparent` (no blur) | `var(--core-foreground)` | none |
| Scrolled (`.navbar--scrolled`) | `oklch(from var(--core-card) l c h / 0.95)` + `blur(8px)` | `var(--core-foreground)` | `0 1px 3px` |

#### Layout

`.header__inner` is a flex row (`display: flex; align-items: center; justify-content: space-between;`) capped at `max-width: 1440px` with responsive inline padding `clamp(1rem, 5vw, 3rem)`. It contains, in order: logo (`.header__logo`), desktop nav (`.header__nav`, visible at `min-width: 1025px`), mobile hamburger (`.header__hamburger`, visible at `max-width: 1024px`), and a right-hand user area (`.header__right`).

#### Nav links

`.header__nav-link` uses `font-family: var(--font-sans)`, `font-weight: 600`, `font-size: 13px`. Hover and active states switch color to `var(--brand-primary)`. The active link draws a 2px underline (`::after`) in `var(--brand-primary)`. Links are separated by thin vertical dividers (`.header__nav-divider`, `1px × 30px`, `background-color: var(--border)`).

#### Right area

The desktop user area composes three existing components instead of hand-rolled buttons:

- `IconButton` with `SearchIcon` for the search entry point.
- `GradientButton` (`variant="accent"`, `size="sm"`) for the owner CTA (`.header__cta`, visible at `min-width: 1200px`).
- `AuthSection` (a `server:defer` island) for login / user menu, with a skeleton fallback (`.header__auth-skeleton`) that mirrors the pill shape of the auth button via `var(--radius-pill)`.

On mobile the right area is hidden and a `MobileMenuIsland` (separate component) renders a full-screen overlay menu.

### 5.7 Footer

Implemented by `src/layouts/Footer.astro`. All colors come from the dedicated footer tokens introduced in section 2.1 (`--footer-bg`, `--footer-fg`, `--footer-fg-muted`, `--footer-link`, `--footer-link-hover`, `--footer-border`, `--footer-newsletter-bg`, `--footer-newsletter-fg`, `--footer-newsletter-border`). No shared `.footer` class exists in `components.css`; structure is scoped to the component.

#### Structure

1. `.footer__wave` — absolute-positioned SVG that overlaps the previous section. The wave path is filled with `var(--footer-bg)` so the seam is invisible.
2. `.footer__top` — a 96px top padding block with a shared `.footer__container` (`max-width: var(--container-max)`, `padding-inline: var(--space-container-x)`). Contains the left block and the right block.
3. `.footer__bottom` — a 1px `border-top: 1px solid var(--footer-border)` rule with contact info on the left and copyright on the right (column on mobile, row at `min-width: 768px`).

#### Left block (`.footer__left`)

- `.footer__logo` — horizontal icon + wordmark. Wordmark uses `font-family: var(--font-decorative)`, `font-size: 48px`, `color: var(--footer-fg)`.
- `.footer__description` — short tagline in `var(--font-sans)`, `color: var(--footer-fg-muted)`, max-width 205px.
- `SocialLinks` component (`variant="light"`) for social icons.

#### Right block (`.footer__right`)

##### Newsletter card (`.footer__newsletter`)

| Property | Value |
|----------|-------|
| `background-color` | `var(--footer-newsletter-bg)` |
| `border` | `1px solid var(--footer-newsletter-border)` |
| `border-radius` | `24px` |
| `padding` | `16px 12px` (mobile), `16px 24px` at `min-width: 1024px` |

The title uses `var(--font-heading)` at `24px/700` with `color: var(--footer-newsletter-fg)`. Description and input labels fall back to the same muted foreground. The email input (`.footer__newsletter-input`) follows the form-input recipe from 5.5 but uses a 12px radius and focuses to `border-color: var(--footer-newsletter-fg)`. The submit uses `GradientButton` (`variant="accent"`, `size="sm"`) with an extra `.footer__newsletter-btn` rule forcing `border-radius: var(--radius-pill)`.

##### Navigation grid (`.footer__nav`)

A CSS grid with responsive column counts (no shared grid class):

| Breakpoint | Columns |
|------------|---------|
| Mobile | `repeat(2, 1fr)` |
| `min-width: 768px` | `repeat(3, 1fr)` |
| `min-width: 1024px` | `repeat(4, 1fr)` |

- `.footer__nav-heading` — `var(--font-heading)`, `color: var(--footer-link)`, responsive size `clamp(1rem, 2vw, 1.25rem)`.
- `.footer__nav-link` — `var(--font-sans)`, `color: var(--footer-fg-muted)`, hover → `color: var(--footer-fg)`, transition `color var(--duration-normal) ease`.

#### Bottom bar

`.footer__bottom-contact` and `.footer__bottom-copy` use `var(--text-body-sm)` in `var(--footer-fg-muted)`. Separator is `border-top: 1px solid var(--footer-border)`.

### 5.8 Scroll-to-Top Button

Implemented by `src/components/shared/ScrollToTop.astro`. This is a compound widget: a native `<button>` wraps two SVGs (a progress ring and an up-chevron icon). It is one of the documented exceptions in 5.3.8 — `IconButton` is NOT used because the outer button must also host the SVG progress ring that reacts to scroll percentage.

#### Structure

```astro
<button id="scroll-to-top" class="scroll-to-top">
  <svg class="scroll-to-top__ring-svg"> <!-- track + progress circles, r=18, stroke 2 --> </svg>
  <svg class="scroll-to-top__arrow">    <!-- up-chevron polyline --> </svg>
</button>
```

The track circle (`.scroll-to-top__track`) uses `stroke: var(--core-muted-foreground)` at 20% opacity; the progress circle (`.scroll-to-top__progress`) uses `stroke: var(--brand-primary)` and animates `stroke-dashoffset` in sync with scroll percentage via an inline script + `requestAnimationFrame`.

#### Base style

| Property | Value |
|----------|-------|
| `position` | `fixed` |
| `bottom` / `right` | `1.5rem` (desktop), `4rem` / `1rem` (mobile) |
| `z-index` | `50` |
| `width` / `height` | `48px` (desktop), `40px` (mobile) |
| `border-radius` | `9999px` (full round) |
| `background-color` | `var(--core-card)` |
| `box-shadow` | `var(--shadow-card)` |
| Hover | `background-color: var(--brand-primary)`, arrow turns white |
| Focus | `outline: 2px solid var(--brand-primary)` with 2px offset |

#### Show / hide

Initial state is `opacity: 0; pointer-events: none`. The inline script adds the `.scroll-to-top--visible` modifier (flips opacity to 1 and re-enables pointer events) when `window.scrollY > 300`. Transition is `opacity var(--duration-normal) ease`.

#### Reduced motion

Under `prefers-reduced-motion: reduce` the ring animation is disabled (no `stroke-dashoffset` updates) and all transitions on the button, progress ring, and arrow are set to `none`; the show/hide threshold still works.

---

## 6. Decorative Elements

### 6.1 Background Shapes (Blobs)

Background blobs are absolutely-positioned decorative elements placed inside a `.section` (which already applies `overflow: clip`). They sit at `z-index: -1` below `.section__container` (which is at `var(--z-content)`). All values must use CSS custom properties.

#### Real example: HeroSection blob

`HeroSection.astro` uses two blob layers on the hero image area:

```astro
<!-- Accent blob element behind the hero image -->
<div class="hero__blob-bg" aria-hidden="true"></div>

<style>
  .hero__blob-bg {
    position: absolute;
    inset: -10% -5%;
    background-color: var(--surface-warm);
    opacity: 0.55;
    border-radius: var(--radius-organic);
    z-index: -1;
    pointer-events: none;
  }
</style>
```

The hero image itself is clipped to an irregular blob path using an inline SVG `<clipPath>` with `clipPathUnits="objectBoundingBox"` (see `.hero-blob-mask` in `components.css:641-651`). The mask is applied via the CSS `mask` property pointing to an inline SVG data URI.

#### CSS blob pattern (any section)

```css
.my-section__blob {
  position: absolute;
  top: -80px;
  right: -120px;
  width: clamp(300px, 40vw, 600px);
  aspect-ratio: 1;
  background-color: var(--surface-warm);
  opacity: 0.3;           /* range: 0.3–0.5 */
  border-radius: var(--radius-organic);
  z-index: -1;
  pointer-events: none;
}
```

#### Rules

- Always `aria-hidden="true"` on the blob element
- Always `pointer-events: none`
- `opacity` range: `0.3` to `0.5` (never higher — blobs are background noise, not foreground elements)
- `z-index: -1` so content in `.section__container` (at `var(--z-content)`) always renders on top
- Background color via `var(--surface-warm)` or `var(--brand-secondary)` — never hardcoded
- The `.section` wrapper applies `overflow: clip`, so blobs that extend beyond the section edge are naturally clipped without extra effort

### 6.2 Decorative SVGs

Small illustrative elements scattered across sections:

| Type | Examples | Placement |
|------|----------|-----------|
| Travel icons | Compass, airplane, location pin, kayak | Section corners, near headers |
| Nature | Waves, birds, leaves, stars | Section backgrounds |
| Path lines | Dashed route lines, curved arrows | Connecting elements |
| Skyline | City silhouette | Hero background, testimonial bg |

Rules:

- Hidden on mobile by default, shown at `min-width: 768px` via scoped media query (see example below)
- Always `pointer-events: none` and `aria-hidden="true"`
- `opacity` range: `0.3` to `0.5` (set directly in the scoped `<style>`, not inline)
- 2-4 per section maximum
- Never overlap interactive content
- Always use CSS custom properties for color (e.g. `fill="var(--brand-accent)"` on SVG path)

#### Pattern for hiding on mobile

Since decoratives use absolute positioning, they must be hidden on mobile with a scoped `display` toggle, not a Tailwind responsive class. The canonical idiom (from `Section Template` in section 8 and `CtaOwnersSection.astro`):

```astro
<div class="my-section__deco" aria-hidden="true">
  <img src="/images/decoratives/deco-compass.svg" alt="" loading="lazy" />
</div>

<style>
  .my-section__deco {
    position: absolute;
    top: 2rem;
    right: 3rem;
    opacity: 0.4;
    pointer-events: none;
    display: none;          /* hidden on mobile */
  }

  @media (min-width: 768px) {
    .my-section__deco {
      display: block;
    }
  }
</style>
```

#### Real examples in codebase

| Component | Decorative type |
|-----------|----------------|
| `HeroSection.astro` | Floating icon circles (beach, hotel) with deco SVG arrows; hidden on mobile via `display: none` / `@media (min-width: 768px)` |
| `AboutUsSection.astro` | Three chained airplane path SVGs (`misc-ap-1.png`), `aria-hidden="true"`, `loading="lazy"` |
| `CtaOwnersSection.astro` | Left media column with person image hidden below `768px` via `display: none` → `display: flex` |

SVG fill colors always reference tokens: `fill="var(--brand-accent)"`, `stroke="var(--brand-primary)"`. Never use hardcoded hex values inside decorative SVGs.

### 6.3 Background Patterns

Subtle repeating patterns sit behind section content. Declare them in the parent section's scoped `<style>` so they stay inside the `.section` clipping context and never accept pointer events. Expected layer: `z-index: -1` (below the `.section__container`, which lives on `var(--z-content)`).

```astro
<section class="section">
  <div class="my-section__pattern" aria-hidden="true"></div>
  <div class="section__container">…</div>
</section>

<style>
  .my-section__pattern {
    position: absolute;
    inset: 0;
    z-index: -1;
    opacity: 0.3;
    pointer-events: none;
    background-image: url('/images/patterns/pattern-dots.svg');
    background-size: 60px;
    background-repeat: repeat;
  }
</style>
```

---

## 7. Animations

### 7.1 Scroll Reveal

Elements animate into view when scrolling. Uses IntersectionObserver initialized in `BaseLayout.astro` via `initScrollReveal()` from `src/lib/scroll-reveal.ts`. CSS transitions live in `components.css` under the `[data-reveal]` attribute selectors.

| Attribute value | Initial transform | Effect on `.revealed` |
|-----------------|-------------------|-----------------------|
| `data-reveal="up"` | `translateY(40px)` | opacity 0→1 + translate to 0 |
| `data-reveal="left"` | `translateX(-60px)` | opacity 0→1 + translate to 0 |
| `data-reveal="right"` | `translateX(60px)` | opacity 0→1 + translate to 0 |
| `data-reveal="scale"` | `scale(0.9)` | opacity 0→1 + scale to 1 |

Duration and easing: `var(--duration-reveal)` with `var(--ease-bounce)`.

#### Stagger Delays

Repeated elements (cards, list items) use incremental `transition-delay` set via inline `style`:

```astro
{items.map((item, index) => (
  <div data-reveal="up" style={`transition-delay: ${index * 100}ms`}>
    <Card {...item} />
  </div>
))}
```

Standard stagger increment: `100ms` per item. Max stagger: `700ms` (7 visible items). All `[data-reveal]` rules are disabled under `prefers-reduced-motion: reduce` (already handled in `components.css`).

### 7.2 Hover Effects

| Element | Effect | Timing |
|---------|--------|--------|
| Card images | `transform: scale(1.1)` | `var(--duration-normal)` `ease-in-out` |
| Card container | shadow swap from `var(--shadow-card)` to `var(--shadow-card-hover)` | `var(--duration-normal)` ease |
| GradientButton | gradient shift (`background-position`) + `translateY(-2px)` + shadow grow | `var(--duration-normal)` ease |
| Links | `color: var(--brand-accent)` (underline grow via `background-size: 100% 1px` when used) | `var(--duration-normal)` |
| Destination cards | content slides up, description rotates in | `var(--duration-normal)` `ease-in-out` |
| Social icons | `background: var(--brand-accent); color: var(--accent-foreground);` | `var(--duration-normal)` |
| Nav links | `color: var(--brand-accent)` | `var(--duration-normal)` |

### 7.3 Page Transitions (Astro View Transitions)

Use Astro's View Transitions API via `ClientRouter` (Astro 5 renamed the component from `ViewTransitions` to `ClientRouter`, kept under `astro:transitions`). It is declared once in `BaseLayout.astro`:

```astro
---
import { ClientRouter } from 'astro:transitions';
---
<head>
  <ClientRouter />
</head>

<!-- Named transitions for morphing elements across page navigations -->
<img transition:name={`accommodation-${slug}`} src={image} alt={name} />
```

### 7.4 Reduced Motion

All animations are disabled when `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Section Template

Standard pattern for building any new section. Uses the shared classes `.section`, `.section--warm`, `.section__container` (from `components.css`), the `SectionHeader` shared component, `.grid-cards--3col` for the default 3-up grid, and the `[data-reveal]` attribute system for scroll animations. All colors, spacing, fonts, and radii come from tokens.

```astro
---
import SectionHeader from '@/components/shared/SectionHeader.astro';
import GradientButton from '@/components/shared/GradientButton.astro';
import Card from '@/components/shared/Card.astro';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

interface Props {
  readonly locale: SupportedLocale;
  readonly items: ReadonlyArray<{ readonly id: string }>;
}

const { locale, items } = Astro.props;
const { t } = createTranslations(locale);
---

<section class="section section--warm my-section" aria-label={t('mySection.title')}>
  <!-- 1. Decorative elements (2-4 max, hidden on mobile, non-interactive) -->
  <div class="my-section__decorative" aria-hidden="true">
    <img src="/images/decoratives/deco-compass.svg" alt="" loading="lazy" />
  </div>

  <!-- 2. Content. .section__container gives max-width + px-container + z-index -->
  <div class="section__container">
    <SectionHeader
      tagline={t('mySection.tagline')}
      title={t('mySection.title')}
      subtitle={t('mySection.subtitle')}
    />

    <!-- 3. Grid with staggered scroll-reveal on each item -->
    <div class="grid-cards--3col">
      {items.map((item, i) => (
        <div data-reveal="up" style={`transition-delay: ${i * 100}ms`}>
          <Card data={item} locale={locale} />
        </div>
      ))}
    </div>

    <!-- 4. Optional CTA -->
    <div class="my-section__cta" data-reveal="up">
      <GradientButton
        href={buildUrl({ locale, path: '/some-path/' })}
        label={t('mySection.seeAll')}
        variant="primary"
        icon="true"
      />
    </div>
  </div>
</section>

<style>
  .my-section__decorative {
    position: absolute;
    top: 2rem;
    left: 2rem;
    opacity: 0.4;
    pointer-events: none;
    /* Hide on mobile — decoratives rely on absolute positioning */
    display: none;
  }
  @media (min-width: 768px) {
    .my-section__decorative {
      display: block;
    }
  }

  .my-section__cta {
    display: flex;
    justify-content: center;
    margin-top: 3rem;
  }
</style>
```

---

## 9. New Section Checklist

- [ ] Choose background: `.section` (default, `var(--core-background)`) or `.section--warm` (peach, `var(--surface-warm)`), alternating with adjacent sections
- [ ] Section padding comes from `.section` itself (120px via `--space-section`). Use `.py-section-sm` or `.py-section-lg` only when a section needs a different rhythm
- [ ] `.section` already applies `overflow: clip` so decoratives are safely contained
- [ ] Include `SectionHeader` (tagline + title + subtitle) — it applies `.section-header` from `components.css`
- [ ] Wrap repeated items in `<div data-reveal="up" style={\`transition-delay: ${i * 100}ms\`}>` for staggered scroll reveal (max stagger 700ms)
- [ ] Add 2-4 decorative SVGs with `aria-hidden="true"`, `pointer-events: none`, and `opacity: 0.4`. Hide below 768px via scoped media query (`display: none;` base → `display: block;` at `min-width: 768px`)
- [ ] Place content inside `.section__container` — it already applies `position: relative`, `max-width: var(--container-max)`, `padding-inline: var(--space-container-x)`, and `z-index: var(--z-content)`
- [ ] Verify text contrast on the chosen background
- [ ] Add background shape/blob if the section design calls for it (z-index `-1`, inside the section's clipping context)
- [ ] Test dark mode: all tokens switch via `data-theme="dark"` on `<html>`
- [ ] Test reduced-motion: `[data-reveal]` rules are already neutralized under `prefers-reduced-motion: reduce` in `components.css`
- [ ] Test responsive: content reflows, decoratives hide on mobile

---

## 10. Color Migration Reference

When adapting code from the old web app or external templates, replace hardcoded colors:

| Old (hardcoded) | New (semantic token) |
|-----------------|---------------------|
| `#EB662B`, `rgb(235,102,43)` | `var(--brand-accent)` |
| `#292929`, `rgb(41,41,41)` | `var(--core-foreground)` |
| `#555555`, `rgb(85,85,85)` | `var(--core-muted-foreground)` |
| `#FFEDE5`, `rgb(255,237,229)` | `var(--surface-warm)` |
| `#F0F0F0` | `var(--muted)` |
| `#021713`, `rgb(2,23,19)` | `var(--surface-dark)` |
| `#F5B715`, gold/yellow | `var(--rating-star)` |
| `#e5e3e0` | `var(--border)` |
| `white`, `#fff` | `var(--core-card)` |
| Gray backgrounds (`#f9fafb`, `#f3f4f6`) | `var(--muted)` |
| Black/near-black text | `var(--core-foreground)` |
| Gray text (`#6b7280`, `#4b5563`) | `var(--core-muted-foreground)` |
| Blue brand colors (`#2563eb`) | `var(--brand-primary)` |
| Orange brand colors (`#f97316`) | `var(--brand-accent)` |
| Light gray borders (`#e5e7eb`) | `var(--border)` |

---

## 11. Adding a New Theme

To add a new theme (e.g., high-contrast, seasonal):

1. Add a new `[data-theme="your-theme"]` block in `global.css`
2. Override ALL semantic tokens (colors, shadows)
3. Spacing, radius, and typography tokens stay the same (only color changes)
4. Update the theme toggle component to include the new option
5. Test all components with the new theme

```css
[data-theme="high-contrast"] {
  --core-background: oklch(1 0 0);
  --core-foreground: oklch(0 0 0);
  --brand-primary: oklch(0.45 0.15 220);
  --brand-accent: oklch(0.55 0.22 45);
  /* ... override all semantic color tokens: --core-card, --core-muted-foreground,
     --surface-warm, --surface-dark, --border, --ring, footer tokens, etc. ... */
}
```

---

## 12. Asset Directory Structure

```
public/images/
  decoratives/     deco-*.svg           Travel-themed decorative graphics
  hero/            hero-*.jpg           Hero section images
  illustrations/   ilustracion-*.svg    Section illustrations
  parallax/        parallax-*.jpg       Parallax background photos
  patterns/        pattern-*.svg        Repeating background patterns
  gallery/         gallery-*.jpg        Photo gallery images
  placeholder-*.svg                     Placeholder/skeleton images
  logo.webp                             Brand logo
```
