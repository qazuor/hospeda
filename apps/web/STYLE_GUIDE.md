# Style Guide - Hospeda Web2

Tourist accommodation platform for the Litoral Entrerriano region. This guide is the **single source of truth** for all visual decisions in `apps/web2`. Every value here maps to a CSS custom property or Tailwind token.. nothing is hardcoded.

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

All tokens are CSS custom properties defined in `src/styles/global.css`. Tailwind maps them via `@theme inline`. Adding a new theme means adding a new `[data-theme="X"]` block with overridden values.

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

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--space-section` | `120px` | `py-section` | Standard section vertical padding |
| `--space-section-sm` | `80px` | `py-section-sm` | Compact section padding |
| `--space-section-lg` | `160px` | `py-section-lg` | Hero/extra-tall sections |
| `--space-container-x` | `15px` | _(via container)_ | Container horizontal padding |
| `--space-card-content` | `27px 30px 26px` | _(via component)_ | Card content area padding |
| `--space-card-gap` | `30px` | `gap-card` | Gap between cards in grid |
| `--space-section-header-mb` | `50px` | `mb-section-header` | Margin below section headers |

### 2.3 Border Radius Tokens

The design uses **asymmetric organic radius** as a signature visual element. Instead of uniform `rounded-xl`, shapes have one or two rounded corners.

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--radius` | `0.75rem` | `rounded-lg` | Default small radius (buttons, inputs) |
| `--radius-sm` | `calc(var(--radius) - 4px)` | `rounded-sm` | Tight radius |
| `--radius-md` | `calc(var(--radius) - 2px)` | `rounded-md` | Medium radius |
| `--radius-lg` | `var(--radius)` | `rounded-lg` | Standard radius |
| `--radius-xl` | `calc(var(--radius) + 4px)` | `rounded-xl` | Large radius |
| `--radius-organic` | `0px 100px` | `rounded-organic` | Signature asymmetric shape (cards, images) |
| `--radius-organic-sm` | `0px 75px` | `rounded-organic-sm` | Smaller organic radius (card content) |
| `--radius-organic-alt` | `100px 0px` | `rounded-organic-alt` | Reversed organic shape (blog thumbnails) |
| `--radius-card` | `24px` | `rounded-card` | Card outer container |
| `--radius-pill` | `9999px` | `rounded-pill` | Pills, tags, full-round |
| `--radius-button` | `8px` | `rounded-button` | Buttons |

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

| Context | Font | Classes |
|---------|------|---------|
| Hero H1 | Geologica | `font-heading font-bold text-hero text-foreground` |
| Hero tagline | Caveat | `font-decorative font-bold text-tagline text-accent` |
| Section tagline | Caveat | `font-decorative font-bold text-tagline text-accent` |
| Section H2 | Geologica | `font-heading font-medium text-h2 text-foreground` |
| Section subtitle | Roboto | `font-sans text-body text-muted-foreground` |
| Card title | Geologica | `font-heading font-semibold text-h3 text-foreground` |
| Card meta | Roboto | `font-sans text-meta text-muted-foreground` |
| Card price | Roboto | `font-sans text-body font-medium text-foreground` |
| Button label | Roboto | `font-sans font-semibold text-button capitalize` |
| Nav link | Roboto | `font-sans text-nav uppercase` |
| Footer heading | Geologica | `font-heading font-semibold text-h4 text-surface-dark-foreground` |
| Footer link | Roboto | `font-sans text-body-sm text-surface-dark-foreground/70` |

### 3.4 Text Rules

- Use `text-balance` or `text-pretty` on all headings
- Body text: `leading-relaxed` (1.625)
- Max `65ch`-`75ch` per line for readability
- Section subtitles: `max-w-xl mx-auto text-center`
- Price display: always use `font-sans font-medium`, never bold

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

| Content | Columns |
|---------|---------|
| Tour/accommodation cards | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card` |
| Destination cards | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-card` |
| Blog cards | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card` |
| Team/guide cards | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-card` |
| Gallery (masonry) | `grid-cols-2 lg:grid-cols-4 gap-4` with row-span variants |
| Feature list | `grid-cols-1 gap-6` (stacked) or `grid-cols-1 md:grid-cols-2` |
| Footer columns | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10` |
| Stats | `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6` |

### 4.4 Section Background Alternation

Sections alternate between white (`--background`) and warm peach (`--surface-warm`):

```
Hero:           bg-background (with hero image)
Destinations:   bg-background
About/Features: bg-background
Tours:          bg-surface-warm      <-- warm
Gallery:        bg-background
Best Features:  bg-surface-warm      <-- warm (with dark CTA panel)
Team:           bg-background
Testimonials:   bg-surface-warm      <-- warm
Blog:           bg-background
Footer:         bg-surface-dark
```

---

## 5. Components

### 5.1 Section Header

Every content section has a consistent header pattern:

```
tagline:    font-decorative font-bold text-tagline text-accent mb-2
title:      font-heading font-medium text-h2 text-foreground mb-4
subtitle:   font-sans text-body text-muted-foreground max-w-xl mx-auto
container:  text-center mb-section-header
```

### 5.2 Cards

#### Tour/Accommodation Card

The signature card style with organic border-radius:

```
outer:      bg-transparent (no outer background)
image:      rounded-organic overflow-hidden h-[552px] (responsive)
image img:  object-cover transition duration-normal ease-in-out
            hover: scale-110
content:    bg-card rounded-organic-sm p-card-content
            contains: title, meta (location, price), rating, duration
title:      font-heading font-semibold text-h3 text-foreground
meta:       font-sans text-meta text-muted-foreground
price:      font-sans text-body font-medium
            "From" prefix in text-muted-foreground, amount in text-accent
rating:     star icons in text-[--rating-star] (gold/yellow)
```

#### Destination Card

Tall image card with overlay content:

```
outer:      rounded-organic overflow-hidden h-[434px]
image:      object-cover w-full h-full
            hover: scale-110 transition duration-normal ease-in-out
overlay:    absolute bottom content with title + link
            hover: content slides up to center, description rotates in
title:      font-heading font-semibold text-card text-lg
link btn:   rounded-pill bg-accent text-accent-foreground
```

#### Blog Card

```
outer:      bg-surface-warm rounded-card overflow-visible p-4
thumbnail:  rounded-organic-alt overflow-hidden h-[277px]
            hover: scale-110 on image
content:    p-[34px_0_15px] (below image, no bg)
meta:       author avatar + name + date
title:      font-heading font-medium text-h3
read more:  text-accent with arrow, hover: text-foreground
badge:      rounded-pill bg-accent text-accent-foreground text-caption
```

#### Team/Guide Card

```
image:      rounded-organic overflow-hidden
            hover: scale-110 on image
content:    text-center mt-4
name:       font-heading font-semibold text-h4
role:       font-sans text-meta text-muted-foreground
social:     rounded-pill bg-accent/15 icons, hover: bg-accent text-accent-foreground
```

#### Testimonial Card

```
layout:     side-by-side (image left, content right) on surface-warm
image:      large, organic shape with blob decoration
quote:      quote icon in text-accent/20
text:       font-sans text-body text-muted-foreground italic
author:     font-heading font-semibold + role in text-meta
rating box: floating card with rating score + stars + review count
```

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
import { GradientButton } from '@/components/ui/GradientButton';

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
import { GradientButton } from '@/components/ui/GradientButton';

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
import { GradientButton } from '@/components/ui/GradientButton';
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
import { IconButton } from '@/components/ui/IconButton';
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
import { IconButton } from '@/components/ui/IconButton';
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
import { IconButton } from '@/components/ui/IconButton';
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

| Variant | Classes |
|---------|---------|
| Default | `rounded-pill px-3 py-1 text-caption font-medium bg-accent text-accent-foreground` |
| Outline | `rounded-pill px-3 py-1 text-caption font-medium border border-border text-muted-foreground` |
| Featured | `rounded-pill px-3 py-1 text-caption font-semibold bg-accent text-accent-foreground` |
| Category | `rounded-pill px-3 py-1 text-caption font-semibold uppercase tracking-wide` |
| Glass | `rounded-pill px-3 py-1 text-caption font-medium bg-card/90 text-foreground backdrop-blur-sm` |
| Rating | `rounded-pill px-2 py-1 bg-accent text-accent-foreground text-caption font-bold` |

### 5.5 Form Inputs

```
base:       w-full bg-background border border-border rounded-button
            px-4 py-2.5 text-body text-foreground
            placeholder: text-muted-foreground
            focus: ring-2 ring-ring border-ring outline-none
            transition duration-normal
```

#### Search Form (Hero)

```
container:  bg-card rounded-[15px] shadow-search p-4
            flex items-center gap-4
fields:     border-0 bg-transparent
submit btn: bg-accent text-accent-foreground rounded-button px-6
```

### 5.6 Navbar

| State | Background | Text | Shadow |
|-------|------------|------|--------|
| Initial (top) | `bg-transparent` | `text-foreground` | none |
| Scrolled | `bg-card/95 backdrop-blur-md` | `text-foreground` | `shadow-nav` |

```
position:   fixed top-0 left-0 right-0 z-nav
container:  max-w-container mx-auto px-container
height:     h-[100px] (fixed)
transition: duration-slow for background/shadow changes
logo:       font-heading font-bold text-2xl
nav links:  font-sans text-nav uppercase tracking-wide
            hover: text-accent
CTA button: rounded-button bg-accent text-accent-foreground px-6 h-10
mobile:     hamburger menu, full-screen overlay bg-card z-mobile-menu
```

### 5.7 Footer

```
background: bg-surface-dark
newsletter: bg-surface-warm rounded-card p-8 (overlaps footer top)
            input: rounded-pill bg-card
            submit: rounded-button bg-accent text-accent-foreground
body:       py-section
columns:    grid lg:grid-cols-5 gap-10
headings:   font-heading font-semibold text-h4 text-surface-dark-foreground mb-6
links:      text-surface-dark-foreground/70 hover:text-accent
            with >> chevron prefix
social:     rounded-pill bg-accent/15 size-[43px] icons
            hover: bg-accent text-accent-foreground
bottom bar: border-t border-surface-dark-foreground/10
            text-surface-dark-foreground/60 text-meta
```

### 5.8 Scroll-to-Top Button

```
position:   fixed bottom-6 right-6 z-scroll-top
size:       size-12
style:      rounded-pill border-2 border-accent text-accent
            hover: bg-accent text-accent-foreground
            transition duration-fast
show/hide:  opacity + translateY transition on scroll threshold
```

---

## 6. Decorative Elements

### 6.1 Background Shapes (Blobs)

Large SVG or CSS shapes positioned behind section content:

```
position:   absolute, z-shape
hero shape: large peach-tinted organic blob behind hero image
            bg-surface-warm, custom clip-path or SVG
section:    subtle SVG patterns (dashed lines, dots, compasses)
            opacity-30 to opacity-50, pointer-events-none, aria-hidden
```

### 6.2 Decorative SVGs

Small illustrative elements scattered across sections:

| Type | Examples | Placement |
|------|----------|-----------|
| Travel icons | Compass, airplane, location pin, kayak | Section corners, near headers |
| Nature | Waves, birds, leaves, stars | Section backgrounds |
| Path lines | Dashed route lines, curved arrows | Connecting elements |
| Skyline | City silhouette | Hero background, testimonial bg |

Rules:

- `hidden md:block` (hide on mobile)
- `pointer-events-none aria-hidden="true"`
- `opacity-30` to `opacity-50`
- 2-4 per section maximum
- Never overlap interactive content

### 6.3 Background Patterns

Subtle repeating patterns behind section content:

```html
<div class="absolute inset-0 pointer-events-none opacity-30"
     style="background-image: url('/images/patterns/...'); background-size: 60px; background-repeat: repeat;">
</div>
```

---

## 7. Animations

### 7.1 Scroll Reveal

Elements animate into view when scrolling. Uses IntersectionObserver with `threshold: 0.1`.

| Class | Effect | Duration |
|-------|--------|----------|
| `scroll-reveal` | Fade in + translate up (40px) | `var(--duration-reveal)` (1.5s) |
| `scroll-reveal-left` | Fade in + translate from left (-60px) | `var(--duration-reveal)` |
| `scroll-reveal-right` | Fade in + translate from right (60px) | `var(--duration-reveal)` |
| `scroll-reveal-scale` | Fade in + scale from 0.9 | `var(--duration-reveal)` |

#### Stagger Delays

Repeated elements (cards, list items) use incremental delays:

```astro
{items.map((item, index) => (
  <div class="scroll-reveal" style={`animation-delay: ${index * 100}ms`}>
    <Card {...item} />
  </div>
))}
```

Standard stagger increment: `100ms` per item. Max stagger: `700ms` (7 items visible).

### 7.2 Hover Effects

| Element | Effect | Timing |
|---------|--------|--------|
| Card images | `scale(1.1)` | `duration-normal ease-in-out` |
| Card container | subtle `translateY(-4px)` + shadow increase | `duration-normal` |
| Buttons | background fill via `::before` scale3d transform | `0.4s cubic-bezier(0.1, 0, 0.3, 1)` |
| Links | `color: var(--accent)` + underline grow (`background-size: 100% 1px`) | `duration-normal` |
| Destination cards | content slides up, description rotates in | `duration-normal ease-in-out` |
| Social icons | `bg-accent text-accent-foreground` | `duration-normal` |
| Nav links | `text-accent` | `duration-normal` |

### 7.3 Page Transitions (Astro View Transitions)

Use Astro's View Transitions API for smooth page navigation:

```astro
---
import { ViewTransitions } from 'astro:transitions';
---
<head>
  <ViewTransitions />
</head>

<!-- Named transitions for morphing elements -->
<img transition:name={`card-${slug}`} src={image} alt={name} />
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

Standard pattern for building any new section:

```astro
<section class="relative bg-[section-color] py-section overflow-hidden">
  <!-- 1. Background shape/blob (optional) -->
  <div class="absolute inset-0 z-shape pointer-events-none" aria-hidden="true">
    <!-- SVG shape or gradient -->
  </div>

  <!-- 2. Decorative elements (2-4, hidden on mobile) -->
  <div class="absolute top-8 left-8 hidden md:block opacity-40 pointer-events-none" aria-hidden="true">
    <!-- Small SVG decorative -->
  </div>

  <!-- 3. Content (always relative for z-index above decoratives) -->
  <div class="relative z-content mx-auto max-w-container px-container">
    <!-- Section header -->
    <div class="text-center mb-section-header">
      <span class="font-decorative font-bold text-tagline text-accent">Tagline</span>
      <h2 class="font-heading font-medium text-h2 text-foreground text-balance mt-2">Section Title</h2>
      <p class="font-sans text-body text-muted-foreground max-w-xl mx-auto mt-4">Description text</p>
    </div>

    <!-- Grid content with scroll-reveal -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-card">
      {items.map((item, i) => (
        <div class="scroll-reveal" style={`animation-delay: ${i * 100}ms`}>
          <Card {...item} />
        </div>
      ))}
    </div>

    <!-- Optional CTA -->
    <div class="mt-12 text-center scroll-reveal">
      <a href="/path/" class="travhub-btn">See All</a>
    </div>
  </div>
</section>
```

---

## 9. New Section Checklist

- [ ] Choose background: `bg-background` or `bg-surface-warm` (alternate with adjacent)
- [ ] Use standard section padding: `py-section`
- [ ] Add `overflow-hidden` to clip decoratives
- [ ] Include section header (tagline + title + subtitle)
- [ ] Apply `scroll-reveal` on content blocks with stagger delays
- [ ] Add 2-4 decorative SVGs (`hidden md:block`, `opacity-40`, `pointer-events-none`, `aria-hidden`)
- [ ] Content wrapper has `relative z-content` for stacking above decoratives
- [ ] Verify text contrast on chosen background
- [ ] Add background shape/blob if section design calls for it
- [ ] Test dark mode: all tokens should switch automatically
- [ ] Test reduced-motion: animations should be disabled
- [ ] Test responsive: content reflows, decoratives hidden on mobile

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
  --background: oklch(1 0 0);
  --foreground: oklch(0 0 0);
  --primary: oklch(0.45 0.15 220);
  --accent: oklch(0.55 0.22 45);
  /* ... override all color tokens ... */
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
