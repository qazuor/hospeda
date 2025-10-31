# Design Standards

## Overview

This document defines the design system for the Hospeda platform, ensuring visual consistency, accessibility, and maintainability across all applications (web, admin, and future mobile apps).

**Design System Stack:**

- **Framework**: Tailwind CSS 4.x
- **Component Library**: Shadcn UI
- **Icons**: Lucide React
- **Fonts**: Inter (system default)
- **Reference**: [Brand Guidelines Skill](../../skills/brand-guidelines.md)

---

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Spacing System](#spacing-system)
4. [Component Patterns](#component-patterns)
5. [Accessibility Guidelines](#accessibility-guidelines)
6. [Responsive Design](#responsive-design)
7. [Dark Mode](#dark-mode)

---

## Color System

### Primary Palette (Blue)

Represents trust, reliability, and water (rivers of the Litoral region).

| Shade | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| 50 | `#eff6ff` | `--primary-50` | Light backgrounds, hover states |
| 100 | `#dbeafe` | `--primary-100` | Subtle highlights, selection |
| 200 | `#bfdbfe` | `--primary-200` | Borders, dividers |
| 300 | `#93c5fd` | `--primary-300` | Disabled states |
| 400 | `#60a5fa` | `--primary-400` | Icons, secondary elements |
| **500** | **`#3b82f6`** | **`--primary-500`** | **Main brand color - CTAs, links** |
| 600 | `#2563eb` | `--primary-600` | Hover states, emphasis |
| 700 | `#1d4ed8` | `--primary-700` | Active states |
| 800 | `#1e40af` | `--primary-800` | Strong emphasis |
| 900 | `#1e3a8a` | `--primary-900` | Headings, strong text |

**Tailwind Classes:**

```css
bg-primary-500     /* Background */
text-primary-600   /* Text */
border-primary-200 /* Border */
```

### Secondary Palette (Orange)

Represents warmth, sunsets, and hospitality.

| Shade | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| 50 | `#fff7ed` | `--secondary-50` | Light backgrounds |
| 100 | `#ffedd5` | `--secondary-100` | Featured backgrounds |
| 200 | `#fed7aa` | `--secondary-200` | Borders |
| 300 | `#fdba74` | `--secondary-300` | Subtle highlights |
| 400 | `#fb923c` | `--secondary-400` | Icons |
| **500** | **`#f97316`** | **`--secondary-500`** | **Accent color - secondary CTAs** |
| 600 | `#ea580c` | `--secondary-600` | Hover states |
| 700 | `#c2410c` | `--secondary-700` | Active states |
| 800 | `#9a3412` | `--secondary-800` | Strong emphasis |
| 900 | `#7c2d12` | `--secondary-900` | Dark text on secondary |

### Neutral Palette (Gray)

For text, borders, and backgrounds.

| Shade | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| 50 | `#f9fafb` | `--gray-50` | Page backgrounds |
| 100 | `#f3f4f6` | `--gray-100` | Light backgrounds, cards |
| 200 | `#e5e7eb` | `--gray-200` | Borders, dividers |
| 300 | `#d1d5db` | `--gray-300` | Disabled borders |
| 400 | `#9ca3af` | `--gray-400` | Placeholders, subtle text |
| 500 | `#6b7280` | `--gray-500` | Secondary text |
| **600** | **`#4b5563`** | **`--gray-600`** | **Body text** |
| 700 | `#374151` | `--gray-700` | Strong text |
| 800 | `#1f2937` | `--gray-800` | Headings (alternative) |
| **900** | **`#111827`** | **`--gray-900`** | **Main headings** |

### Semantic Colors

| Color | Shade | Hex | Usage |
|-------|-------|-----|-------|
| **Success** | 50 | `#f0fdf4` | Backgrounds |
| | 500 | `#10b981` | Confirmations, available |
| | 700 | `#047857` | Strong success |
| **Warning** | 50 | `#fffbeb` | Backgrounds |
| | 500 | `#f59e0b` | Alerts, caution |
| | 700 | `#b45309` | Strong warning |
| **Error** | 50 | `#fef2f2` | Backgrounds |
| | 500 | `#ef4444` | Errors, validation |
| | 700 | `#b91c1c` | Strong error |
| **Info** | 500 | `#3b82f6` | Information, tips |

### Color Usage Rules

**DO ✅**

- Use primary-500 for main CTAs and links
- Use secondary-500 for secondary actions
- Use gray-600 for body text
- Use semantic colors for appropriate states
- Maintain 4.5:1 contrast ratio for text

**DON'T ❌**

- Mix primary and secondary as primary colors
- Use colors outside the defined palette
- Ignore accessibility contrast ratios
- Use semantic colors for decorative purposes

---

## Typography

### Font Families

```css
/* Primary (Body & UI) */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Code */
font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

### Type Scale

| Element | Size (mobile) | Size (desktop) | Weight | Line Height | Tailwind |
|---------|---------------|----------------|--------|-------------|----------|
| **Display** | 2.25rem (36px) | 3.75rem (60px) | 700 (Bold) | 1.1 | `text-4xl md:text-6xl font-bold` |
| **H1** | 1.875rem (30px) | 2.25rem (36px) | 700 (Bold) | 1.2 | `text-3xl md:text-4xl font-bold` |
| **H2** | 1.5rem (24px) | 1.875rem (30px) | 600 (Semibold) | 1.3 | `text-2xl md:text-3xl font-semibold` |
| **H3** | 1.25rem (20px) | 1.5rem (24px) | 600 (Semibold) | 1.4 | `text-xl md:text-2xl font-semibold` |
| **H4** | 1.125rem (18px) | 1.25rem (20px) | 500 (Medium) | 1.4 | `text-lg md:text-xl font-medium` |
| **Body Large** | 1.125rem (18px) | 1.125rem (18px) | 400 (Regular) | 1.6 | `text-lg` |
| **Body** | 1rem (16px) | 1rem (16px) | 400 (Regular) | 1.6 | `text-base` |
| **Body Small** | 0.875rem (14px) | 0.875rem (14px) | 400 (Regular) | 1.5 | `text-sm` |
| **Caption** | 0.75rem (12px) | 0.75rem (12px) | 400 (Regular) | 1.4 | `text-xs` |

### Font Weights

| Weight | Value | Tailwind | Usage |
|--------|-------|----------|-------|
| Regular | 400 | `font-normal` | Body text, descriptions |
| Medium | 500 | `font-medium` | Emphasized text, H4 |
| Semibold | 600 | `font-semibold` | H2, H3, strong emphasis |
| Bold | 700 | `font-bold` | H1, Display, very strong |

### Typography Examples

```tsx
// Page Title
<h1 className="text-3xl md:text-4xl font-bold text-gray-900">
  Descubre Alojamientos en Concepción del Uruguay
</h1>

// Section Heading
<h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
  Destinos Populares
</h2>

// Card Title
<h3 className="text-xl font-semibold text-gray-800">
  Hotel Colonial
</h3>

// Body Text
<p className="text-base text-gray-600 leading-relaxed">
  Experimenta la auténtica hospitalidad del Litoral argentino...
</p>

// Small Text / Meta
<span className="text-sm text-gray-500">
  Actualizado hace 2 días
</span>

// Code Block
<code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
  pnpm install
</code>
```

---

## Spacing System

Based on Tailwind's 4px spacing scale.

### Base Unit: 0.25rem (4px)

| Value | rem | px | Tailwind | Usage |
|-------|-----|----|----------|-------|
| 0 | 0 | 0 | `0` | Reset |
| 1 | 0.25rem | 4px | `1` | Tight spacing |
| 2 | 0.5rem | 8px | `2` | Very small gaps |
| 3 | 0.75rem | 12px | `3` | Small gaps |
| 4 | 1rem | 16px | `4` | Default gap |
| 5 | 1.25rem | 20px | `5` | Medium gap |
| 6 | 1.5rem | 24px | `6` | Large gap |
| 8 | 2rem | 32px | `8` | Section padding |
| 10 | 2.5rem | 40px | `10` | Large section gap |
| 12 | 3rem | 48px | `12` | Extra large gap |
| 16 | 4rem | 64px | `16` | Hero sections |
| 20 | 5rem | 80px | `20` | Major sections |

### Spacing Usage

```tsx
// Card padding
<div className="p-6">  {/* 24px padding */}

// Section margin
<section className="mb-12">  {/* 48px bottom margin */}

// Element gap
<div className="space-y-4">  {/* 16px vertical gap */}

// Grid gap
<div className="grid gap-6">  {/* 24px gap */}
```

### Common Spacing Patterns

| Pattern | Tailwind | Use Case |
|---------|----------|----------|
| Tight | `space-y-2 p-3` | Compact lists, dense UI |
| Default | `space-y-4 p-6` | Cards, forms, general content |
| Relaxed | `space-y-6 p-8` | Marketing pages, featured content |
| Spacious | `space-y-8 p-12` | Hero sections, major divisions |

---

## Component Patterns

### Buttons

#### Primary Button

```tsx
<button className="
  bg-primary-500 hover:bg-primary-600 active:bg-primary-700
  text-white font-medium
  px-6 py-3 rounded-lg
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
">
  Reservar Ahora
</button>
```

#### Secondary Button

```tsx
<button className="
  bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700
  text-white font-medium
  px-6 py-3 rounded-lg
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2
">
  Ver Más
</button>
```

#### Outline Button

```tsx
<button className="
  border-2 border-primary-500
  text-primary-600 hover:bg-primary-50 active:bg-primary-100
  font-medium px-6 py-3 rounded-lg
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
">
  Filtrar
</button>
```

#### Ghost Button

```tsx
<button className="
  text-gray-600 hover:text-gray-900 hover:bg-gray-100
  font-medium px-4 py-2 rounded-lg
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-gray-300
">
  Cancelar
</button>
```

### Cards

#### Basic Card

```tsx
<div className="
  bg-white rounded-lg shadow-sm
  border border-gray-200
  p-6
  hover:shadow-md transition-shadow duration-200
">
  <h3 className="text-xl font-semibold text-gray-900 mb-2">
    Card Title
  </h3>
  <p className="text-gray-600">
    Card content goes here...
  </p>
</div>
```

#### Feature Card

```tsx
<div className="
  bg-gradient-to-br from-primary-50 to-primary-100
  rounded-xl shadow-md
  p-8
  border border-primary-200
">
  <div className="w-12 h-12 bg-primary-500 rounded-lg mb-4 flex items-center justify-center">
    <Icon className="w-6 h-6 text-white" />
  </div>
  <h3 className="text-xl font-semibold text-gray-900 mb-2">
    Feature Title
  </h3>
  <p className="text-gray-600">
    Feature description...
  </p>
</div>
```

### Forms

#### Input Field

```tsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">
    Email
  </label>
  <input
    type="email"
    className="
      w-full px-4 py-3 rounded-lg
      border border-gray-300
      focus:border-primary-500 focus:ring-2 focus:ring-primary-200
      outline-none transition-colors
      placeholder:text-gray-400
    "
    placeholder="tu@email.com"
  />
</div>
```

#### Select Dropdown

```tsx
<select className="
  w-full px-4 py-3 rounded-lg
  border border-gray-300
  bg-white
  focus:border-primary-500 focus:ring-2 focus:ring-primary-200
  outline-none transition-colors
">
  <option>Selecciona una opción</option>
  <option>Opción 1</option>
  <option>Opción 2</option>
</select>
```

### Badges

```tsx
// Success badge
<span className="
  inline-flex items-center
  bg-success-50 text-success-700
  px-3 py-1 rounded-full
  text-sm font-medium
">
  Disponible
</span>

// Warning badge
<span className="
  inline-flex items-center
  bg-warning-50 text-warning-700
  px-3 py-1 rounded-full
  text-sm font-medium
">
  Limitado
</span>

// Error badge
<span className="
  inline-flex items-center
  bg-error-50 text-error-700
  px-3 py-1 rounded-full
  text-sm font-medium
">
  No Disponible
</span>
```

### Alerts

```tsx
// Info alert
<div className="
  bg-primary-50 border border-primary-200
  text-primary-700
  p-4 rounded-lg
  flex items-start gap-3
">
  <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
  <div>
    <p className="font-medium">Información</p>
    <p className="text-sm mt-1">Mensaje informativo aquí...</p>
  </div>
</div>

// Success alert
<div className="
  bg-success-50 border border-success-200
  text-success-700
  p-4 rounded-lg
  flex items-start gap-3
">
  <CheckCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
  <div>
    <p className="font-medium">Éxito</p>
    <p className="text-sm mt-1">Operación completada correctamente.</p>
  </div>
</div>
```

---

## Accessibility Guidelines

### Color Contrast

**WCAG 2.1 Level AA Requirements:**

- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text** (18px+ regular or 14px+ bold): Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

**Approved Combinations:**

| Background | Text Color | Contrast | Pass |
|------------|------------|----------|------|
| White (`#ffffff`) | Gray-900 (`#111827`) | 16.5:1 | ✅ AAA |
| White (`#ffffff`) | Gray-600 (`#4b5563`) | 8.6:1 | ✅ AAA |
| Primary-500 (`#3b82f6`) | White (`#ffffff`) | 4.7:1 | ✅ AA |
| Secondary-500 (`#f97316`) | White (`#ffffff`) | 3.4:1 | ✅ Large text only |
| Gray-100 (`#f3f4f6`) | Gray-900 (`#111827`) | 15.8:1 | ✅ AAA |

### Focus States

**All interactive elements MUST have visible focus states:**

```tsx
// Button focus
focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2

// Input focus
focus:border-primary-500 focus:ring-2 focus:ring-primary-200

// Link focus
focus:outline-2 focus:outline-offset-2 focus:outline-primary-500
```

### Keyboard Navigation

**Requirements:**

- All interactive elements accessible via Tab key
- Logical tab order (top to bottom, left to right)
- Skip links for main content
- ARIA labels for icon-only buttons

```tsx
// Skip link
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
>
  Skip to main content
</a>

// Icon button with ARIA label
<button aria-label="Close dialog">
  <XIcon className="w-5 h-5" />
</button>
```

### Screen Reader Support

```tsx
// Loading state
<div aria-live="polite" aria-busy="true">
  Loading...
</div>

// Error message
<div role="alert" aria-live="assertive">
  Error: Invalid email format
</div>

// Hidden text for screen readers
<span className="sr-only">
  Navigate to homepage
</span>
```

---

## Responsive Design

### Breakpoints

| Breakpoint | Min Width | Tailwind | Usage |
|------------|-----------|----------|-------|
| **Mobile** | 0px | (default) | Mobile-first |
| **Tablet** | 640px | `sm:` | Small tablets |
| **Laptop** | 768px | `md:` | Tablets, small laptops |
| **Desktop** | 1024px | `lg:` | Laptops, desktops |
| **Large Desktop** | 1280px | `xl:` | Large screens |
| **Extra Large** | 1536px | `2xl:` | Very large screens |

### Responsive Typography

```tsx
<h1 className="
  text-2xl  {/* Mobile: 24px */}
  sm:text-3xl  {/* Tablet: 30px */}
  md:text-4xl  {/* Desktop: 36px */}
  lg:text-5xl  {/* Large: 48px */}
  font-bold
">
  Responsive Heading
</h1>
```

### Responsive Spacing

```tsx
<div className="
  p-4  {/* Mobile: 16px */}
  md:p-8  {/* Desktop: 32px */}
  lg:p-12  {/* Large: 48px */}
">
  Content
</div>
```

### Mobile-First Grid

```tsx
<div className="
  grid
  grid-cols-1  {/* Mobile: 1 column */}
  sm:grid-cols-2  {/* Tablet: 2 columns */}
  lg:grid-cols-3  {/* Desktop: 3 columns */}
  gap-6
">
  {/* Cards */}
</div>
```

---

## Dark Mode

Currently **not implemented**, but design tokens are structured to support future dark mode:

```css
/* Future dark mode variables */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1f2937;
    --text-primary: #f9fafb;
    --border-primary: #374151;
  }
}
```

**Dark mode will use:**

- Inverted neutrals (gray-900 → gray-50)
- Adjusted primary/secondary colors for WCAG compliance
- Reduced contrast (60% → 80% instead of 90%)

---

## Best Practices

### DO ✅

- **Use design tokens**: Always use Tailwind classes or CSS variables
- **Maintain consistency**: Follow established patterns
- **Test accessibility**: Check contrast, keyboard nav, screen readers
- **Mobile-first**: Design for mobile, enhance for desktop
- **Semantic HTML**: Use correct HTML elements
- **Meaningful spacing**: Use spacing scale, avoid arbitrary values
- **Test with real content**: Don't design with placeholder text only

### DON'T ❌

- **Use arbitrary values**: Stick to design system (avoid `p-[13px]`)
- **Ignore accessibility**: All users matter
- **Skip responsive design**: Test on multiple devices
- **Override system styles**: Use composition, not override
- **Use colors outside palette**: Maintain brand consistency
- **Forget focus states**: Always visible and clear
- **Use color alone**: Combine with icons/text for meaning

---

## Related Documentation

- **Brand Guidelines**: `.claude/skills/brand-guidelines.md`
- **Shadcn UI Components**: <https://ui.shadcn.com/>
- **Tailwind Documentation**: <https://tailwindcss.com/>
- **WCAG Guidelines**: <https://www.w3.org/WAI/WCAG21/quickref/>

---

## Changelog

- **2025-10-31**: Initial design standards documentation
  - Defined color system (primary, secondary, neutral, semantic)
  - Established typography scale and weights
  - Documented spacing system
  - Created component patterns (buttons, cards, forms, badges, alerts)
  - Defined accessibility guidelines (contrast, focus, keyboard, screen reader)
  - Established responsive design breakpoints
  - Prepared for future dark mode support

---

**Last updated**: 2025-10-31
**Version**: 1.0.0
**Maintained by**: Design & Frontend team
