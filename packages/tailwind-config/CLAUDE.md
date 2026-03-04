# CLAUDE.md - Tailwind Config Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Shared Tailwind CSS v4 configuration and design tokens for the Hospeda platform. Defines the visual identity including colors, typography, spacing, and dark mode variables used by all frontend apps.

## Key Files

```
├── shared-styles.css    # Shared CSS with @theme tokens and dark mode variables
├── postcss.config.js    # PostCSS configuration
└── package.json         # Package metadata
```

## Usage

Import shared styles in an app's Tailwind CSS entry file:

```css
@import '@repo/tailwind-config/shared-styles.css';
@import 'tailwindcss';
```

## Design Tokens

### Colors

- `--color-primary` / `--color-primary-dark` / `--color-primary-light` - Brand blue
- `--color-secondary` - Secondary brand color
- `--color-accent` - Accent highlights
- `--color-bg` / `--color-text` - Background and text (theme-aware)

### Typography (Three-Font System)

| Token | Font | Usage |
|-------|------|-------|
| `--font-display` | Playfair Display | Headings, hero text |
| `--font-accent` | Caveat | Decorative accents, handwritten feel |
| `--font-sans` | Inter | Body text, UI elements |

### Layout

- `max-w-site` - Maximum site width container

### Dark Mode

Dark mode is implemented via `[data-theme="dark"]` CSS variables, NOT Tailwind's `dark:` class strategy. Theme-aware variables (e.g., `--color-bg`, `--color-text`) automatically swap values.

## Patterns

- All design tokens are defined in `shared-styles.css`.. never hardcode colors or fonts in components
- Use CSS custom properties (`var(--color-primary)`) or Tailwind classes (`text-primary`)
- Dark mode variables are defined under `[data-theme="dark"]` selector
- When adding new tokens, add both light and dark mode values
- Font imports (Google Fonts) are handled by the consuming app, not this package
- Keep this package CSS-only.. no JavaScript

## Related Documentation

- `packages/tailwind-config/README.md` - Detailed token reference and usage guide
