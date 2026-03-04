# @repo/tailwind-config

Shared Tailwind CSS configuration scaffold for the Hospeda monorepo. This package documents the design token strategy across apps and provides a PostCSS config export, though each app maintains its own independent Tailwind setup.

## Design System Strategy: Intentionally Separate

The `apps/web` and `apps/admin` applications use **independent Tailwind configurations** by design:

| App | Token System | Theme Approach |
|-----|-------------|----------------|
| `apps/web` | CSS custom properties in `global.css` mapped via `@theme inline` | Regional palette (teal, amber, terracotta). Dark mode via `[data-theme="dark"]` |
| `apps/admin` | shadcn/ui semantic tokens (`bg-background`, `text-foreground`, etc.) | shadcn CSS variable theming |

These systems serve different audiences (public visitors vs. admin operators) and have intentionally different visual identities. Unifying them would create unnecessary coupling.

## What This Package Provides

- `shared-styles.css`: Minimal Tailwind v4 import with placeholder theme tokens. **Not consumed by any app.**
- `postcss.config.js`: PostCSS config export. Both apps use `@tailwindcss/vite` plugin instead.

This package is kept as a monorepo scaffold. Neither app imports from it.

## Custom Design Tokens (Web App)

The public web app (`apps/web`) defines its design tokens in `apps/web/src/styles/global.css` and maps them to Tailwind via `@theme inline` in `tailwind.css`. Key tokens include:

### Colors - Regional Palette

| Token | Value | Description |
|-------|-------|-------------|
| `--color-primary` | `#0d7377` | Rio Uruguay teal |
| `--color-primary-dark` | `#0a5c5f` | Darker teal for hover states |
| `--color-primary-light` | `#3d9b9e` | Lighter teal for backgrounds |
| `--color-secondary` | `#d4870e` | Amber gold |
| `--color-accent` | `#f0e6d6` | Warm sand |
| `--color-accent-dark` | `#c25b3a` | Terracotta |
| `--color-green` | `#2d6a4f` | Nature/vegetation green |
| `--color-terracotta` | `#c25b3a` | Colonial brick terracotta |

A full primary scale (`--color-primary-50` through `--color-primary-950`) is available for gradients.

### Typography

| Token | Value | Description |
|-------|-------|-------------|
| `--font-serif` | `Fraunces, Georgia, serif` | Headings (h1-h6) |
| `--font-sans` | `Inter, -apple-system, sans-serif` | Body text |
| `--font-accent` | `Caveat, cursive` | Handwritten accent text |

Font fallback `@font-face` declarations with metric overrides are included to minimize CLS.

### Layout

| Token | Value | Description |
|-------|-------|-------------|
| `--max-w-site` | `1200px` | Maximum content width |

### Other Token Categories

- **Spacing**: 8px grid (`--space-xs` through `--space-4xl`)
- **Border radius**: `--radius-sm` (4px) through `--radius-full` (9999px)
- **Shadows**: Warm-tinted shadows (`--shadow-sm` through `--shadow-xl`)
- **Typography scale**: Fluid sizes with `clamp()` for responsive display text
- **Transitions**: `--transition-fast` (150ms), `--transition-base` (250ms), `--transition-slow` (350ms)

## Dark Mode

The web app implements dark mode via the `[data-theme="dark"]` CSS selector. The dark theme is called "Noche Estrellada" (starry night) and uses a deep night-blue palette instead of conventional grays.

Key dark mode overrides:

| Token | Light | Dark |
|-------|-------|------|
| `--color-bg` | `#fdfaf5` (river sand) | `#0f1a2e` (night blue) |
| `--color-surface` | `#ffffff` | `#1a2740` (deep night) |
| `--color-text` | `#2c1810` (warm brown) | `#f0ede8` (warm white) |
| `--color-primary` | `#0d7377` (teal) | `#3dbdc0` (luminous teal) |

Dark mode is toggled via a `ThemeToggle` React island in the header. Theme preference is persisted in `localStorage` under the key `theme`, with fallback to `prefers-color-scheme`. A FOUC-prevention inline script in `BaseLayout.astro` reads localStorage before first paint.

## Related Documentation

- [Branding and Theming Guide](../../docs/guides/branding-and-theming.md)
