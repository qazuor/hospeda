---
name: design-to-components
description: >
  Converts design-cloner HTML/CSS output into framework-specific components.
  Use after running the design-cloner agent to generate React, Vue, Svelte,
  Solid, or Astro components from the HTML/CSS clone.
---

# Design to Components

## Purpose

Convert the design-cloner agent's HTML/CSS output and component map into
production-ready, typed framework components. This skill bridges the gap between
a visual HTML/CSS clone and a real component library.

## When to Use

- After the `design-cloner` agent has produced its output (`index.html`,
  `styles.css`, `ANALYSIS.md`, `COMPONENTS.md`)
- When converting an existing HTML/CSS prototype to framework components
- When you need typed, accessible UI components from a design reference

## Input Requirements

Before starting conversion, gather these three inputs:

1. **Clone directory path** - Path to the `design-clone/` directory containing
   the cloner's output files
2. **Target framework** - One of: React, Vue, Svelte, Solid, Astro
3. **Styling approach** - One of: Tailwind CSS, CSS Modules, styled-components,
   vanilla CSS

---

## Conversion Workflow

### Step 1: Read the Component Map

Read `COMPONENTS.md` to understand:

- Component names and hierarchy (parent-child relationships)
- Suggested props for each component
- Detected variants and interaction notes
- Categories (layout vs ui) for directory organization

### Step 2: Extract Design Tokens

Read `styles.css` and extract all CSS custom properties from `:root`:

- Colors (primary, secondary, neutral, accent)
- Typography (font families, sizes, weights)
- Spacing scale
- Border radii
- Shadows

Map these to the target styling system's token format.

### Step 3: Parse HTML Structure

Read `index.html` and for each `[data-component]` element:

- Extract the DOM structure
- Identify dynamic content (text, images, lists) that becomes props
- Note slots/children where nested content appears
- Identify conditional rendering (variants, states)

### Step 4: Generate Components

For each component identified in the map, generate a framework-specific file
following the patterns below. Components should be organized by category:

- `components/layout/` for layout components (Header, Footer, Sidebar)
- `components/ui/` for reusable UI components (Button, Card, Badge)

### Step 5: Generate Types

Create shared TypeScript interfaces for component props based on the
`COMPONENTS.md` suggestions.

### Step 6: Generate Design Tokens

Convert CSS custom properties into the appropriate format for the target
styling approach.

---

## Framework Patterns

### React (TypeScript)

```tsx
// components/ui/Card.tsx
interface CardProps {
  image: string;
  title: string;
  description: string;
  price?: number;
  href?: string;
  variant?: 'default' | 'featured' | 'horizontal';
  children?: React.ReactNode;
}

export function Card({
  image,
  title,
  description,
  price,
  href,
  variant = 'default',
  children,
}: CardProps) {
  return (
    <article
      className={`card card--${variant}`}
      data-component="card"
    >
      <div className="card__image">
        <img src={image} alt={title} loading="lazy" />
      </div>
      <div className="card__body">
        <h3 className="card__title">{title}</h3>
        <p className="card__description">{description}</p>
        {price != null && (
          <span className="card__price">${price}</span>
        )}
        {children}
      </div>
    </article>
  );
}
```

### Vue 3 (Composition API)

```vue
<!-- components/ui/Card.vue -->
<script setup lang="ts">
interface CardProps {
  image: string;
  title: string;
  description: string;
  price?: number;
  href?: string;
  variant?: 'default' | 'featured' | 'horizontal';
}

const props = withDefaults(defineProps<CardProps>(), {
  variant: 'default',
});
</script>

<template>
  <article
    :class="['card', `card--${props.variant}`]"
    data-component="card"
  >
    <div class="card__image">
      <img :src="props.image" :alt="props.title" loading="lazy" />
    </div>
    <div class="card__body">
      <h3 class="card__title">{{ props.title }}</h3>
      <p class="card__description">{{ props.description }}</p>
      <span v-if="props.price != null" class="card__price">
        ${{ props.price }}
      </span>
      <slot />
    </div>
  </article>
</template>

<style scoped>
/* Component styles from design tokens */
</style>
```

### Svelte

```svelte
<!-- components/ui/Card.svelte -->
<script lang="ts">
  export let image: string;
  export let title: string;
  export let description: string;
  export let price: number | undefined = undefined;
  export let href: string | undefined = undefined;
  export let variant: 'default' | 'featured' | 'horizontal' = 'default';
</script>

<article
  class="card card--{variant}"
  data-component="card"
>
  <div class="card__image">
    <img src={image} alt={title} loading="lazy" />
  </div>
  <div class="card__body">
    <h3 class="card__title">{title}</h3>
    <p class="card__description">{description}</p>
    {#if price != null}
      <span class="card__price">${price}</span>
    {/if}
    <slot />
  </div>
</article>

<style>
  /* Component styles from design tokens */
</style>
```

### Solid

```tsx
// components/ui/Card.tsx
import type { JSX, ParentProps } from 'solid-js';
import { Show } from 'solid-js';

interface CardProps extends ParentProps {
  image: string;
  title: string;
  description: string;
  price?: number;
  href?: string;
  variant?: 'default' | 'featured' | 'horizontal';
}

export function Card(props: CardProps) {
  const variant = () => props.variant ?? 'default';

  return (
    <article
      class={`card card--${variant()}`}
      data-component="card"
    >
      <div class="card__image">
        <img src={props.image} alt={props.title} loading="lazy" />
      </div>
      <div class="card__body">
        <h3 class="card__title">{props.title}</h3>
        <p class="card__description">{props.description}</p>
        <Show when={props.price != null}>
          <span class="card__price">${props.price}</span>
        </Show>
        {props.children}
      </div>
    </article>
  );
}
```

### Astro

```astro
---
// components/ui/Card.astro
interface Props {
  image: string;
  title: string;
  description: string;
  price?: number;
  href?: string;
  variant?: 'default' | 'featured' | 'horizontal';
}

const { image, title, description, price, href, variant = 'default' } = Astro.props;
---

<article
  class:list={['card', `card--${variant}`]}
  data-component="card"
>
  <div class="card__image">
    <img src={image} alt={title} loading="lazy" />
  </div>
  <div class="card__body">
    <h3 class="card__title">{title}</h3>
    <p class="card__description">{description}</p>
    {price != null && (
      <span class="card__price">${price}</span>
    )}
    <slot />
  </div>
</article>

<style>
  /* Scoped component styles from design tokens */
</style>
```

---

## Design Token Mapping

Convert CSS custom properties from the clone's `styles.css` into the
appropriate format for the target styling approach.

### Tailwind CSS Theme Config

```typescript
// tailwind.config.ts (extend section)
export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',    // or hardcoded hex
        secondary: 'var(--color-secondary)',
        surface: 'var(--color-surface)',
      },
      fontFamily: {
        heading: ['Font Name', 'sans-serif'],
        body: ['Font Name', 'sans-serif'],
      },
      spacing: {
        // Map --space-* tokens
      },
      borderRadius: {
        // Map --radius-* tokens
      },
      boxShadow: {
        // Map --shadow-* tokens
      },
    },
  },
};
```

### CSS Modules Variables

```css
/* tokens/variables.module.css */
:root {
  /* Directly reuse the CSS custom properties from the clone */
  --color-primary: #XXXXXX;
  --color-secondary: #XXXXXX;
  /* ... */
}
```

### styled-components Theme

```typescript
// tokens/theme.ts
export const theme = {
  colors: {
    primary: '#XXXXXX',
    secondary: '#XXXXXX',
    background: '#XXXXXX',
    surface: '#XXXXXX',
    textPrimary: '#XXXXXX',
    textSecondary: '#XXXXXX',
  },
  fonts: {
    heading: "'Font Name', sans-serif",
    body: "'Font Name', sans-serif",
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '3rem',
  },
  spacing: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    6: '1.5rem',
    8: '2rem',
    12: '3rem',
    16: '4rem',
  },
  radii: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  },
} as const;

export type Theme = typeof theme;
```

### TypeScript Constants

```typescript
// tokens/colors.ts
export const colors = {
  primary: '#XXXXXX',
  secondary: '#XXXXXX',
  background: '#XXXXXX',
  surface: '#XXXXXX',
  textPrimary: '#XXXXXX',
  textSecondary: '#XXXXXX',
} as const;

// tokens/typography.ts
export const typography = {
  fontFamily: {
    heading: "'Font Name', sans-serif",
    body: "'Font Name', sans-serif",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '3rem',
  },
} as const;

// tokens/spacing.ts
export const spacing = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
  12: '3rem',
  16: '4rem',
} as const;
```

---

## Output Structure

```
components/
├── ui/
│   ├── Button.tsx          # (or .vue, .svelte, .astro)
│   ├── Card.tsx
│   ├── Badge.tsx
│   └── ...
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Sidebar.tsx
│   └── ...
├── tokens/
│   ├── colors.ts
│   ├── typography.ts
│   └── spacing.ts
└── index.ts                # Barrel exports
```

---

## Best Practices

- **One component per file** following the target framework's conventions
- **Props typed from COMPONENTS.md** suggestions with TypeScript interfaces
- **Slots or children** for nested content areas identified in the HTML clone
- **Design tokens extracted** to shared constants or theme configuration
- **Accessibility preserved** from the HTML clone (ARIA attributes, semantic
  elements, keyboard navigation)
- **Variants as props** rather than separate components when the structure is
  similar
- **Barrel exports** (`index.ts`) for clean import paths
- **Consistent naming** matching the component names from COMPONENTS.md

---

## Checklist

- [ ] All components from COMPONENTS.md have been converted
- [ ] Props match the suggested props from the component map
- [ ] Design tokens are extracted to the appropriate format
- [ ] Component hierarchy matches the documented parent-child relationships
- [ ] Accessibility attributes preserved from HTML clone
- [ ] Variants implemented as component props
- [ ] Types/interfaces defined for all component props
- [ ] Barrel exports created for clean imports
- [ ] Styling approach matches the user's chosen method
