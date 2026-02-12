---
name: frontend-design
description: Pre-coding design process and aesthetic principles. Use when designing UIs, working with typography, color theory, motion design, or design tokens.
---

# Frontend Design

## Purpose

Pre-coding design process with aesthetic principles for building beautiful, cohesive user interfaces. Covers typography, color theory, motion design, spatial composition, design tokens, and design system thinking. Includes anti-patterns to avoid.

## Activation

Use this skill when the user asks about:

- UI/UX design decisions before coding
- Typography choices and scale
- Color palettes and color theory
- Animation and motion design
- Layout composition and spacing
- Design tokens and systems
- Visual aesthetics and polish

## Pre-Coding Design Process

Before writing any UI code, go through this process:

### 1. Define the Design Intent

Ask these questions:

- What emotion should the interface evoke? (calm, energetic, professional, playful)
- Who is the target audience? (developers, consumers, enterprise, creative)
- What existing brand assets or guidelines exist?
- What is the primary action on each screen?

### 2. Establish Visual Hierarchy

Every screen needs a clear hierarchy:

1. **Primary element** - The single most important thing (headline, CTA, hero image)
2. **Secondary elements** - Supporting content (descriptions, secondary actions)
3. **Tertiary elements** - Navigation, metadata, supplementary information
4. **Background** - Negative space, subtle patterns, container boundaries

### 3. Choose a Design Direction

| Direction | Characteristics | Best For |
|---|---|---|
| Minimal | Lots of whitespace, monochrome, thin fonts | Developer tools, SaaS dashboards |
| Editorial | Large type, asymmetric layouts, serif fonts | Blogs, magazines, portfolios |
| Corporate | Clean grid, blue tones, system fonts | Enterprise, fintech, healthcare |
| Playful | Bold colors, rounded shapes, illustration | Consumer apps, education, games |
| Brutalist | Raw, high contrast, intentionally rough | Creative agencies, art, experimental |

## Typography

### Type Scale

Use a mathematically consistent scale. The most common ratio is 1.250 (Major Third):

```css
:root {
  /* Base: 16px */
  --text-xs:    0.75rem;   /* 12px */
  --text-sm:    0.875rem;  /* 14px */
  --text-base:  1rem;      /* 16px */
  --text-lg:    1.125rem;  /* 18px */
  --text-xl:    1.25rem;   /* 20px */
  --text-2xl:   1.5rem;    /* 24px */
  --text-3xl:   1.875rem;  /* 30px */
  --text-4xl:   2.25rem;   /* 36px */
  --text-5xl:   3rem;      /* 48px */
  --text-6xl:   3.75rem;   /* 60px */
  --text-7xl:   4.5rem;    /* 72px */
}
```

### Font Pairing Rules

1. **One font family is usually enough** - Use weight and size for hierarchy
2. **Maximum two families** - One for headings, one for body
3. **Pair serif with sans-serif** - Not two serifs or two sans-serifs
4. **Match x-height** - Paired fonts should have similar x-heights

### Recommended Font Stacks

```css
/* Modern sans-serif system stack */
--font-sans: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, "Helvetica Neue", sans-serif;

/* Monospace for code */
--font-mono: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code",
  "Consolas", monospace;

/* Editorial serif */
--font-serif: "Newsreader", "Lora", "Merriweather", Georgia, "Times New Roman", serif;

/* Display / headings */
--font-display: "Cal Sans", "Cabinet Grotesk", "Satoshi", sans-serif;
```

### Typography Anti-Patterns

| Anti-Pattern | Why It Fails | Alternative |
|---|---|---|
| Arial / Helvetica as primary | Generic, overused, no personality | Inter, Geist, or system stack |
| More than 2 font families | Visual noise, inconsistent | One family with weight variation |
| Body text below 16px on mobile | Unreadable, fails accessibility | 16px minimum for body text |
| Line height below 1.4 for body | Cramped, hard to read | 1.5 - 1.7 for body text |
| All caps for long text | Harder to read | Use for short labels only |
| Centered text for paragraphs | Hard to scan left edge | Left-align body text |
| Line length over 75 characters | Eye tracking fatigue | 45-75 characters per line |

## Color Theory

### Building a Color Palette

Start with a single brand/primary color and derive everything else:

```css
:root {
  /* Primary: The brand color - used for CTAs, links, focus rings */
  --color-primary-50:  #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;   /* Base */
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;
  --color-primary-950: #172554;

  /* Neutral: For text, backgrounds, borders */
  --color-neutral-50:  #fafafa;
  --color-neutral-100: #f5f5f5;
  --color-neutral-200: #e5e5e5;
  --color-neutral-300: #d4d4d4;
  --color-neutral-400: #a3a3a3;
  --color-neutral-500: #737373;
  --color-neutral-600: #525252;
  --color-neutral-700: #404040;
  --color-neutral-800: #262626;
  --color-neutral-900: #171717;
  --color-neutral-950: #0a0a0a;

  /* Semantic colors */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error:   #ef4444;
  --color-info:    #3b82f6;
}
```

### Color Usage Rules

1. **60-30-10 rule** - 60% neutral, 30% secondary, 10% accent
2. **Primary for actions** - Buttons, links, focus states
3. **Neutral for content** - Text, backgrounds, borders
4. **Semantic for feedback** - Success/error/warning/info states
5. **Test contrast ratios** - WCAG AA requires 4.5:1 for normal text, 3:1 for large text

### Color Anti-Patterns

| Anti-Pattern | Why It Fails | Alternative |
|---|---|---|
| Purple-to-pink gradients | Overused in 2020s, loses impact | Solid colors or subtle gradients |
| Pure black (#000) on white (#fff) | Too harsh, causes eye strain | Near-black (#171717) on off-white (#fafafa) |
| Too many accent colors | Visual chaos | One primary, one accent max |
| Color as only indicator | Fails for colorblind users | Add icons or text labels |
| Saturated colors for large areas | Overwhelming, tiring | Reserve saturation for small accents |
| Neon/fluorescent colors | Poor readability | Muted, accessible alternatives |

### Dark Mode

```css
/* Light mode tokens */
:root {
  --bg-primary:    #ffffff;
  --bg-secondary:  #f5f5f5;
  --bg-tertiary:   #e5e5e5;
  --text-primary:  #171717;
  --text-secondary:#525252;
  --text-tertiary: #a3a3a3;
  --border:        #e5e5e5;
}

/* Dark mode tokens */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary:    #0a0a0a;
    --bg-secondary:  #171717;
    --bg-tertiary:   #262626;
    --text-primary:  #fafafa;
    --text-secondary:#a3a3a3;
    --text-tertiary: #525252;
    --border:        #262626;
  }
}
```

Dark mode rules:

- Never just invert colors - redesign the elevation system
- Reduce saturation of colors in dark mode
- Use elevation (lighter = closer) instead of shadows
- Test all UI states in both modes

## Motion Design

### Animation Principles

```css
:root {
  /* Duration scale */
  --duration-instant:  50ms;    /* Micro-interactions (checkmarks) */
  --duration-fast:    100ms;    /* Button state changes */
  --duration-normal:  200ms;    /* Most transitions */
  --duration-slow:    300ms;    /* Page transitions, modals */
  --duration-slower:  500ms;    /* Complex animations */

  /* Easing curves */
  --ease-in:      cubic-bezier(0.4, 0, 1, 0.2);     /* Exits */
  --ease-out:     cubic-bezier(0, 0, 0.2, 1);        /* Entrances */
  --ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);      /* Move within view */
  --ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);  /* Bouncy, playful */
}
```

### When to Animate

| Interaction | Animation | Duration | Easing |
|---|---|---|---|
| Button hover/press | Scale + color | 100ms | ease-out |
| Modal open | Fade + scale up | 200ms | ease-out |
| Modal close | Fade + scale down | 150ms | ease-in |
| Dropdown open | Slide down + fade | 200ms | ease-out |
| Page transition | Fade | 200ms | ease-in-out |
| Toast notification | Slide in | 300ms | ease-spring |
| Skeleton loading | Pulse/shimmer | 1.5s loop | ease-in-out |
| Checkbox toggle | Scale pop | 150ms | ease-spring |

### Animation Anti-Patterns

| Anti-Pattern | Why It Fails |
|---|---|
| Animation longer than 500ms | Feels sluggish, blocks interaction |
| Linear easing | Feels robotic, unnatural |
| Animating layout properties (width, height, top, left) | Causes reflow, janky performance |
| Animation without reduced-motion support | Accessibility violation |
| Entrance animation on page load for all elements | Distracting, slow perceived load |
| Bouncing/spinning loaders | Anxiety-inducing, feels slow |

### Respecting User Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Spatial Composition

### Spacing Scale

Use a consistent 4px base grid:

```css
:root {
  --space-0:    0;
  --space-0.5:  0.125rem;  /* 2px */
  --space-1:    0.25rem;   /* 4px */
  --space-1.5:  0.375rem;  /* 6px */
  --space-2:    0.5rem;    /* 8px */
  --space-3:    0.75rem;   /* 12px */
  --space-4:    1rem;      /* 16px */
  --space-5:    1.25rem;   /* 20px */
  --space-6:    1.5rem;    /* 24px */
  --space-8:    2rem;      /* 32px */
  --space-10:   2.5rem;    /* 40px */
  --space-12:   3rem;      /* 48px */
  --space-16:   4rem;      /* 64px */
  --space-20:   5rem;      /* 80px */
  --space-24:   6rem;      /* 96px */
}
```

### Spacing Rules

1. **Proximity = relationship** - Related items closer, unrelated items farther
2. **Consistent internal padding** - Cards, sections use the same internal spacing
3. **Increase spacing as viewport grows** - More whitespace on larger screens
4. **Section spacing > component spacing > element spacing** - Clear hierarchy
5. **Never eyeball it** - Always use the spacing scale

### Border Radius Scale

```css
:root {
  --radius-none: 0;
  --radius-sm:   0.25rem;  /* 4px - subtle rounding */
  --radius-md:   0.5rem;   /* 8px - cards, inputs */
  --radius-lg:   0.75rem;  /* 12px - larger cards */
  --radius-xl:   1rem;     /* 16px - modals */
  --radius-2xl:  1.5rem;   /* 24px - pills */
  --radius-full: 9999px;   /* Circles, chips */
}
```

Pick one or two values and use them consistently. Mixing many different radii looks unpolished.

## Design Tokens

### Token Architecture

```css
/* Level 1: Primitive tokens (raw values) */
:root {
  --blue-500: #3b82f6;
  --gray-900: #171717;
  --radius-8: 0.5rem;
  --font-size-16: 1rem;
}

/* Level 2: Semantic tokens (meaning) */
:root {
  --color-action-primary: var(--blue-500);
  --color-text-primary: var(--gray-900);
  --border-radius-card: var(--radius-8);
  --font-size-body: var(--font-size-16);
}

/* Level 3: Component tokens (specific usage) */
:root {
  --button-bg: var(--color-action-primary);
  --button-radius: var(--border-radius-card);
  --card-radius: var(--border-radius-card);
  --input-radius: var(--border-radius-card);
}
```

### Tailwind CSS Design Tokens

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          // ... full scale
          950: "#172554",
        },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        card: "0.75rem",
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "slide-up": "slide-up 300ms ease-out",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
} satisfies Config;
```

## Design System Thinking

### Component API Design

When designing component props, think about:

```tsx
// GOOD: Clear, constrained API
<Button variant="primary" size="md" disabled>
  Save Changes
</Button>

// BAD: Too many open-ended props
<Button
  color="#3b82f6"
  hoverColor="#2563eb"
  fontSize="14px"
  padding="8px 16px"
  borderRadius="8px"
>
  Save Changes
</Button>
```

### Design Checklist Before Coding

- [ ] Color palette defined with accessible contrast ratios
- [ ] Typography scale chosen (font family, sizes, weights, line heights)
- [ ] Spacing scale defined (4px or 8px base)
- [ ] Border radius consistency decided
- [ ] Shadow/elevation scale defined
- [ ] Dark mode token mapping complete
- [ ] Motion/animation timing and easing defined
- [ ] Breakpoints defined for responsive design
- [ ] Component states covered (default, hover, focus, active, disabled, loading, error)
- [ ] Empty states designed (no data, first-time user, error states)
