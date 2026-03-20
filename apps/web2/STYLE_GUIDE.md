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

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--background` | `oklch(0.985 0.002 210)` | `bg-background` | Page backgrounds |
| `--foreground` | `oklch(0.20 0.02 220)` | `text-foreground` | Primary text |
| `--card` | `oklch(1 0 0)` | `bg-card` | Card backgrounds |
| `--card-foreground` | `oklch(0.20 0.02 220)` | `text-card-foreground` | Text on cards |
| `--popover` | `oklch(1 0 0)` | `bg-popover` | Dropdown/popover surfaces |
| `--popover-foreground` | `oklch(0.20 0.02 220)` | `text-popover-foreground` | Text in popovers |
| `--primary` | `oklch(0.55 0.12 220)` | `bg-primary` | Primary brand (blue) |
| `--primary-foreground` | `oklch(0.99 0 0)` | `text-primary-foreground` | Text on primary |
| `--secondary` | `oklch(0.92 0.03 155)` | `bg-secondary` | Secondary surfaces (green tint) |
| `--secondary-foreground` | `oklch(0.25 0.06 155)` | `text-secondary-foreground` | Text on secondary |
| `--accent` | `oklch(0.65 0.17 45)` | `bg-accent` | CTA, highlights (sunset orange) |
| `--accent-foreground` | `oklch(0.99 0 0)` | `text-accent-foreground` | Text on accent |
| `--muted` | `oklch(0.95 0.01 210)` | `bg-muted` | Subtle backgrounds |
| `--muted-foreground` | `oklch(0.50 0.02 220)` | `text-muted-foreground` | Secondary text |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `bg-destructive` | Error states |
| `--destructive-foreground` | `oklch(0.98 0 0)` | `text-destructive-foreground` | Text on destructive |

#### Interactive/UI Colors

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--border` | `oklch(0.90 0.02 210)` | `border-border` | Dividers, input borders |
| `--input` | `oklch(0.90 0.02 210)` | `bg-input` | Form input borders |
| `--ring` | `oklch(0.55 0.12 220)` | `ring-ring` | Focus ring |
| `--overlay` | `oklch(0.20 0.02 220 / 0.5)` | `bg-overlay` | Modal/dialog overlays |

#### Feedback Colors

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--success` | `oklch(0.58 0.15 150)` | `bg-success` | Success states |
| `--success-foreground` | `oklch(0.99 0 0)` | `text-success-foreground` | Text on success |
| `--warning` | `oklch(0.75 0.18 85)` | `bg-warning` | Warning states |
| `--warning-foreground` | `oklch(0.2 0.02 85)` | `text-warning-foreground` | Text on warning |
| `--info` | `oklch(0.55 0.12 220)` | `bg-info` | Info states |
| `--info-foreground` | `oklch(0.99 0 0)` | `text-info-foreground` | Text on info |

#### Section/Surface Colors

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--surface-warm` | `oklch(0.95 0.03 50)` | `bg-surface-warm` | Peach-tinted sections (tours, features, testimonials) |
| `--surface-warm-foreground` | `oklch(0.35 0.03 50)` | `text-surface-warm-foreground` | Text on warm surfaces |
| `--surface-dark` | `oklch(0.15 0.02 160)` | `bg-surface-dark` | Dark sections (features CTA, footer) |
| `--surface-dark-foreground` | `oklch(0.92 0.01 210)` | `text-surface-dark-foreground` | Text on dark surfaces |

#### Brand Colors (Hospeda-specific)

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--hospeda-sky` | `oklch(0.80 0.08 220)` | `bg-hospeda-sky` | Sky, light water |
| `--hospeda-sky-light` | `oklch(0.88 0.06 220)` | `bg-hospeda-sky-light` | Very light sky |
| `--hospeda-river` | `oklch(0.55 0.12 220)` | `text-hospeda-river` | River, water |
| `--hospeda-forest` | `oklch(0.50 0.14 155)` | `text-hospeda-forest` | Vegetation, nature |
| `--hospeda-sand` | `oklch(0.93 0.03 85)` | `bg-hospeda-sand` | Beaches, sand |
| `--hospeda-sunset` | `oklch(0.70 0.18 55)` | `text-hospeda-sunset` | Sunsets, warm accents |

#### Chart Colors

| Token | Value |
|-------|-------|
| `--chart-1` | `oklch(0.55 0.12 220)` |
| `--chart-2` | `oklch(0.6 0.14 155)` |
| `--chart-3` | `oklch(0.7 0.18 55)` |
| `--chart-4` | `oklch(0.75 0.1 190)` |
| `--chart-5` | `oklch(0.5 0.08 240)` |

#### Dark Mode (`[data-theme="dark"]`)

All semantic tokens are overridden. Brand colors adjust for contrast on dark backgrounds. See `global.css` for the full dark mode block. Key differences:

| Token | Dark Value |
|-------|-----------|
| `--background` | `oklch(0.14 0.02 220)` |
| `--foreground` | `oklch(0.92 0.01 210)` |
| `--card` | `oklch(0.19 0.02 220)` |
| `--primary` | `oklch(0.65 0.14 220)` |
| `--accent` | `oklch(0.72 0.19 55)` |
| `--surface-warm` | `oklch(0.20 0.03 50)` |
| `--surface-dark` | `oklch(0.10 0.02 160)` |
| `--border` | `oklch(0.28 0.02 220)` |

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

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--shadow-none` | `none` | `shadow-none` | No shadow (most cards in reference design) |
| `--shadow-sm` | `0 1px 3px oklch(from var(--foreground) l c h / 0.06)` | `shadow-sm` | Subtle elevation |
| `--shadow-card` | `0 4px 12px -2px oklch(from var(--foreground) l c h / 0.08)` | `shadow-card` | Default card shadow |
| `--shadow-card-hover` | `0 12px 24px -4px oklch(from var(--foreground) l c h / 0.12)` | `shadow-card-hover` | Hovered card shadow |
| `--shadow-search` | `0 4px 60px oklch(from var(--foreground) l c h / 0.10)` | `shadow-search` | Search form shadow |
| `--shadow-nav` | `0 2px 4px oklch(from var(--foreground) l c h / 0.15)` | `shadow-nav` | Sticky navbar shadow |

All shadows use `oklch(from var(--foreground) ...)` so they automatically adapt to dark mode.

### 2.5 Transition Tokens

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--duration-fast` | `0.2s` | `duration-fast` | Micro-interactions (focus, active) |
| `--duration-normal` | `0.4s` | `duration-normal` | Most hover effects, color changes |
| `--duration-slow` | `0.5s` | `duration-slow` | Buttons, complex transitions |
| `--duration-reveal` | `1.5s` | `duration-reveal` | Scroll reveal animations |
| `--ease-default` | `ease` | _(default)_ | Standard easing |
| `--ease-out` | `ease-out` | `ease-out` | Enter animations |
| `--ease-in-out` | `ease-in-out` | `ease-in-out` | Image scale, destination cards |
| `--ease-bounce` | `cubic-bezier(0.1, 0, 0.3, 1)` | `ease-bounce` | Button background fill effect |

### 2.6 Z-Index Tokens

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--z-behind` | `-1` | `z-behind` | Decorative shapes behind content |
| `--z-base` | `0` | `z-base` | Default stacking |
| `--z-content` | `10` | `z-content` | Content above decoratives |
| `--z-shape` | `5` | `z-shape` | Decorative shapes/blobs |
| `--z-nav` | `50` | `z-nav` | Fixed navbar |
| `--z-mobile-menu` | `40` | `z-mobile-menu` | Mobile menu overlay |
| `--z-overlay` | `50` | `z-overlay` | Modal overlays |
| `--z-toast` | `100` | `z-toast` | Toast notifications |
| `--z-scroll-top` | `99` | `z-scroll-top` | Scroll-to-top button |

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
| `--text-h2` | `clamp(1.5rem, 1.25rem + 1.5vw, 2.5rem)` | `1.17` | `500-600` | Section titles |
| `--text-h3` | `1.5rem` | `1.33` | `600` | Card titles, sub-section headers |
| `--text-h4` | `1.25rem` | `1.4` | `600` | Smaller headings |
| `--text-body` | `1rem` | `1.5` | `400` | Body text, paragraphs |
| `--text-body-sm` | `0.875rem` | `1.5` | `400` | Smaller body text |
| `--text-meta` | `0.875rem` | `1.5` | `400-500` | Meta info, dates, categories |
| `--text-caption` | `0.75rem` | `1.4` | `400` | Captions, fine print |
| `--text-tagline` | `1.875rem` | `1` | `700` | Section taglines (Caveat font) |
| `--text-nav` | `1rem` | `1` | `400` | Navigation links |
| `--text-button` | `1.125rem` | `1` | `600` | Button labels |

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

#### Primary Button (`.travhub-btn` equivalent)

```
base:       font-sans font-semibold text-button capitalize
            bg-accent text-accent-foreground
            rounded-button px-6 py-2.5
            transition duration-slow
            position: relative overflow-hidden
hover:      animated background fill effect (::before scale transform)
            cubic-bezier(0.1, 0, 0.3, 1) 0.4s
```

#### Button Variants

| Variant | Classes |
|---------|---------|
| `default` | `bg-accent text-accent-foreground hover:bg-accent/90` |
| `primary` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `outline` | `border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground` |
| `ghost` | `text-foreground hover:bg-muted` |
| `dark` | `bg-surface-dark text-surface-dark-foreground hover:bg-surface-dark/90` |
| `link` | `text-accent underline-offset-4 hover:underline` |

#### Button Sizes

| Size | Classes |
|------|---------|
| `sm` | `h-8 px-4 text-sm` |
| `default` | `h-10 px-6 text-button` |
| `lg` | `h-12 px-8 text-button` |
| `icon` | `size-10` |

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
| `#EB662B`, `rgb(235,102,43)` | `var(--accent)` / `bg-accent` |
| `#292929`, `rgb(41,41,41)` | `var(--foreground)` / `text-foreground` |
| `#555555`, `rgb(85,85,85)` | `var(--muted-foreground)` / `text-muted-foreground` |
| `#FFEDE5`, `rgb(255,237,229)` | `var(--surface-warm)` / `bg-surface-warm` |
| `#F0F0F0` | `var(--muted)` / `bg-muted` |
| `#021713`, `rgb(2,23,19)` | `var(--surface-dark)` / `bg-surface-dark` |
| `#F5B715`, gold/yellow | `var(--rating-star)` |
| `#e5e3e0` | `var(--border)` / `border-border` |
| `white`, `#fff` | `var(--card)` / `bg-card` |
| `bg-white` | `bg-card` or `bg-background` |
| `bg-gray-50`, `bg-gray-100` | `bg-muted` |
| `text-gray-900`, `text-black` | `text-foreground` |
| `text-gray-500`, `text-gray-600` | `text-muted-foreground` |
| `bg-blue-600` | `bg-primary` |
| `bg-orange-500` | `bg-accent` |
| `border-gray-200` | `border-border` |

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
