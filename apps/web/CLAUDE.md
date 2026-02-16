# CLAUDE.md - Web Application

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Hospeda Web application (`apps/web`).

## Overview

Astro 5-based public-facing website for the Hospeda platform. Features include SSR with Vercel adapter, React islands for selective interactivity, Tailwind CSS v4 for styling, and comprehensive i18n support for multilingual content delivery.

## Key Commands

```bash
# Development
pnpm dev               # Start dev server (port 4321)

# Build & Deploy
pnpm build             # Production build (SSR)
pnpm preview           # Preview production build

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code

# Utilities
pnpm clean             # Remove node_modules, dist, and .astro cache
```

## Project Structure

```
src/
├── components/        # Astro and React components
│   ├── accommodation/ # Accommodation-specific components
│   ├── auth/          # Authentication components (UserNav)
│   ├── blog/          # Blog post components
│   ├── content/       # Content sections (hero, featured, testimonials)
│   ├── destination/   # Destination-specific components
│   ├── error/         # Error state components (per entity type)
│   ├── event/         # Event components
│   ├── map/           # Map components
│   ├── newsletter/    # Newsletter CTA (auth-gated)
│   ├── review/        # Review components
│   ├── search/        # Search bar
│   ├── seo/           # SEOHead, JsonLd components
│   └── ui/            # Reusable UI primitives (Button, Input, Badge, etc.)
├── layouts/           # Page layouts
│   ├── BaseLayout.astro   # HTML document shell (FOUC prevention, view transitions)
│   ├── Header.astro       # Site header (dark mode toggle)
│   └── Footer.astro       # Site footer
├── pages/             # File-based routing (SSR)
│   ├── [lang]/            # Locale-prefixed routes
│   │   ├── alojamientos/  # Accommodation listing + detail + pagination
│   │   ├── destinos/      # Destination listing + detail + pagination
│   │   ├── eventos/       # Event listing + detail + pagination
│   │   ├── publicaciones/ # Blog listing + detail + pagination
│   │   ├── mi-cuenta/     # Auth-protected account pages (6 pages)
│   │   └── auth/          # Sign in/up pages
│   ├── 404.astro          # Not found page
│   └── 500.astro          # Server error page
├── store/             # Client-side stores
│   └── toast-store.ts     # Toast notification store
├── styles/            # Global styles
│   ├── global.css         # Global CSS (includes dark mode variables)
│   ├── tailwind.css       # Tailwind imports
│   └── animations.css     # Animation utilities
├── lib/               # Utility libraries
│   ├── api/               # API client and endpoint wrappers
│   ├── i18n.ts            # Locale helpers (isValidLocale, SupportedLocale)
│   └── env.ts             # Environment variable schemas
└── env.ts             # Env validation and types
```

## Architecture

### Rendering Strategy

**SSR (Server-Side Rendering)** with Vercel adapter. All pages are server-rendered on-demand for:

- Dynamic content per request
- SEO optimization
- Personalized content delivery
- Real-time data from API

### Islands Architecture

Use Astro components by default. Use React islands only when interactivity is required:

```astro
---
// pages/accommodations.astro
import AccommodationCard from '@/components/accommodation/AccommodationCard.astro';
import SearchFilters from '@/components/search/SearchFilters'; // React component

const accommodations = await fetch(`${API_URL}/accommodations`).then(r => r.json());
---

<!-- Static component (no JavaScript) -->
<AccommodationCard {...accommodation} />

<!-- Interactive component (hydrated only when visible) -->
<SearchFilters client:visible filters={initialFilters} />
```

### Client Directives

| Directive | Use When | Example |
|-----------|----------|---------|
| `client:load` | Immediately interactive (above fold) | Search bar, navigation menu |
| `client:visible` | Below the fold, lazy hydrate | Filter panels, testimonials |
| `client:idle` | Low priority, hydrate when idle | Newsletter signup, analytics |
| `client:media` | Responsive components | `client:media="(max-width: 768px)"` for mobile menu |
| `client:only` | Cannot be server-rendered | Map components, chart libraries |

## Styling

### Tailwind CSS v4

Uses Tailwind CSS v4 with CSS variables for theming:

```css
/* styles/tailwind.css */
@import 'tailwindcss';

@theme {
  --color-primary: #1e40af;
  --color-secondary: #64748b;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-display: 'Playfair Display', serif;
}
```

### Component Styling

```astro
---
// components/ui/Button.astro
interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

const { variant = 'primary', size = 'md', disabled, loading } = Astro.props;

const baseClasses = 'inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

const variantClasses = {
  primary: 'bg-primary text-white hover:bg-primary-dark disabled:bg-gray-300',
  secondary: 'bg-secondary text-white hover:bg-secondary-dark',
  outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
  ghost: 'text-text hover:bg-bg',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm rounded',
  md: 'px-4 py-2 text-base rounded-md',
  lg: 'px-6 py-3 text-lg rounded-lg',
};

const classes = [baseClasses, variantClasses[variant], sizeClasses[size]].join(' ');
---

<button class={classes} disabled={disabled || loading} aria-busy={loading}>
  {loading && <span class="animate-spin mr-2">...</span>}
  <slot />
</button>
```

## Internationalization (i18n)

### Using @repo/i18n

```astro
---
import { useI18n } from '@repo/i18n';

const { locale } = Astro.params;
const i18n = useI18n(locale || 'es');
---

<h1>{i18n.t('pages.home.title')}</h1>
<p>{i18n.t('pages.home.description')}</p>
```

### Locale Detection

Locales are detected from URL path:

- `/es/` - Spanish (default)
- `/en/` - English
- `/pt/` - Portuguese

## SEO Optimization

### Meta Tags Pattern

```astro
---
// layouts/BaseLayout.astro
interface Props {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
  locale?: string;
}

const { title, description, image, noindex = false, locale = 'es' } = Astro.props;
const canonicalUrl = new URL(Astro.url.pathname, Astro.site);
const pageTitle = `${title} | Hospeda`;
const ogLocale = locale === 'es' ? 'es_AR' : locale === 'pt' ? 'pt_BR' : 'en_US';
---

<html lang={locale}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalUrl.href} />

    {noindex && <meta name="robots" content="noindex, nofollow" />}

    <!-- Open Graph -->
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonicalUrl.href} />
    <meta property="og:locale" content={ogLocale} />
    <meta property="og:type" content="website" />
    {image && <meta property="og:image" content={image} />}
  </head>
  <body>
    <slot />
  </body>
</html>
```

### Sitemap

Automatically generated via `@astrojs/sitemap` integration. Configure in `astro.config.mjs`:

```javascript
integrations: [
  sitemap(),
],
```

## Data Fetching

### Fetching from API

```astro
---
// pages/accommodations/[id].astro
const { id } = Astro.params;
const API_URL = import.meta.env.PUBLIC_API_URL;

const response = await fetch(`${API_URL}/api/v1/accommodations/${id}`);
if (!response.ok) {
  return Astro.redirect('/404');
}

const { data: accommodation } = await response.json();
---

<h1>{accommodation.name}</h1>
<p>{accommodation.description}</p>
```

### Error Handling

```astro
---
try {
  const data = await fetchAccommodations();
} catch (error) {
  console.error('Failed to fetch accommodations:', error);
  return Astro.redirect('/error');
}
---
```

## Testing

### Component Testing Pattern

Astro components are tested by reading the source file and verifying structure, props, and styling:

```ts
// test/components/ui/button.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Button.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Button.astro', () => {
  describe('Props', () => {
    it('should accept variant prop', () => {
      expect(content).toContain("variant?: 'primary' | 'secondary' | 'outline' | 'ghost'");
    });

    it('should default variant to primary', () => {
      expect(content).toContain("variant = 'primary'");
    });
  });

  describe('Variants', () => {
    it('should have primary variant styles', () => {
      expect(content).toContain('bg-primary');
      expect(content).toContain('text-white');
      expect(content).toContain('hover:bg-primary-dark');
    });
  });

  describe('Accessibility', () => {
    it('should have focus-visible styles', () => {
      expect(content).toContain('focus-visible:outline');
    });

    it('should support aria-busy for loading state', () => {
      expect(content).toContain('aria-busy');
    });
  });
});
```

### Test Organization

```
test/
├── setup.tsx               # Vitest setup and configuration
├── components/
│   ├── ui/                 # UI component tests (Pagination, ThemeToggle, etc.)
│   ├── accommodation/      # Accommodation component tests
│   ├── auth/               # Auth component tests (UserNav)
│   ├── blog/               # Blog component tests
│   ├── content/            # Content component tests (PricingCard)
│   ├── destination/        # Destination component tests
│   ├── error/              # Error state component tests
│   ├── event/              # Event component tests
│   └── review/             # Review component tests
├── integration/            # Integration tests (auth guards, hreflang)
├── layouts/                # Layout tests
├── pages/                  # Page structure tests
├── styles/                 # Style and design token tests
├── config/                 # Sitemap and config tests
└── env/                    # Environment variable tests
```

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Environment Variables

### Required Variables

```env
# API Configuration
PUBLIC_API_URL=http://localhost:3001
HOSPEDA_API_URL=http://localhost:3001  # Monorepo alternative

# Site Configuration
PUBLIC_SITE_URL=http://localhost:4321
HOSPEDA_SITE_URL=http://localhost:4321  # Monorepo alternative

# Environment
NODE_ENV=development
```

### Environment Variable Validation

```ts
// src/env.ts
import { z } from 'zod';

const serverEnvSchema = z
  .object({
    HOSPEDA_API_URL: z.string().url().optional(),
    PUBLIC_API_URL: z.string().url().optional(),
    HOSPEDA_SITE_URL: z.string().url().optional(),
    PUBLIC_SITE_URL: z.string().url().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  })
  .refine((data) => data.HOSPEDA_API_URL || data.PUBLIC_API_URL, {
    message: 'Either HOSPEDA_API_URL or PUBLIC_API_URL must be set',
  });

const clientEnvSchema = z.object({
  PUBLIC_API_URL: z.string().url(),
  PUBLIC_SITE_URL: z.string().url(),
});
```

### Accessing Environment Variables

```astro
---
// Server-side (Astro frontmatter)
const apiUrl = import.meta.env.PUBLIC_API_URL;

// Client-side (React components with client:* directive)
const apiUrl = import.meta.env.PUBLIC_API_URL; // Only PUBLIC_* available
---
```

## Performance Optimization

### Image Optimization

Use Astro's built-in image optimization:

```astro
---
import { Image } from 'astro:assets';
import heroImage from '@/assets/hero.jpg';
---

<Image
  src={heroImage}
  alt="Hero image"
  width={1200}
  height={630}
  loading="lazy"
  format="webp"
/>
```

### Lazy Loading

```astro
<!-- Lazy load images below the fold -->
<img src={imageUrl} alt="..." loading="lazy" />

<!-- Lazy hydrate components below the fold -->
<InteractiveComponent client:visible {...props} />
```

### Code Splitting

Astro automatically code-splits JavaScript. Use React islands sparingly to minimize bundle size:

```astro
---
// GOOD: Static component (no JavaScript)
import AccommodationCard from '@/components/AccommodationCard.astro';

// BAD: Everything as React (too much JavaScript)
import AccommodationCard from '@/components/AccommodationCard.tsx';
---
```

## Accessibility

### Semantic HTML

```astro
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
</header>

<main id="main-content">
  <h1>Page Title</h1>
</main>

<footer>
  <p>&copy; 2026 Hospeda</p>
</footer>
```

### Skip to Content Link

```astro
<!-- layouts/BaseLayout.astro -->
<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
>
  Skip to content
</a>

<main id="main-content">
  <slot />
</main>
```

### ARIA Attributes

```astro
<!-- Button with loading state -->
<button aria-busy={loading} aria-label="Submit form">
  Submit
</button>

<!-- Hidden decorative elements -->
<span aria-hidden="true">...</span>
```

## Icons

All icons come from `@repo/icons` (Phosphor Icons wrappers). **No inline `<svg>` elements** in source code (except decorative illustrations in 404/500 pages).

```astro
---
import { SearchIcon, FavoriteIcon, CalendarIcon } from '@repo/icons';
---

<!-- Icons work in .astro files without client directives (server-rendered) -->
<SearchIcon size={20} weight="regular" aria-hidden="true" />
<FavoriteIcon size={48} weight="fill" className="text-red-500" />
<CalendarIcon size="sm" weight="duotone" />
```

Icon props: `size` (number or 'xs'|'sm'|'md'|'lg'|'xl'), `weight` ('thin'|'light'|'regular'|'bold'|'fill'|'duotone'), `className`, `aria-hidden`.

## Dark Mode

Dark mode is fully implemented with FOUC prevention:

- **CSS variables**: `global.css` defines `[data-theme="dark"]` variables
- **FOUC prevention**: Inline `<script is:inline>` in `BaseLayout.astro` `<head>` reads localStorage before paint
- **Toggle**: `ThemeToggle.client.tsx` React island in Header (`client:idle`)
- **Persistence**: localStorage key `theme`, falls back to `prefers-color-scheme`
- **Default**: Light mode

## hreflang Tags

`SEOHead.astro` automatically generates hreflang alternate links for all three locales (es, en, pt) plus `x-default`. Every page with a `[lang]` parameter gets proper SEO alternate links.

## Auth Guards (mi-cuenta)

All 6 pages under `/[lang]/mi-cuenta/` are auth-protected:

- `index.astro`, `editar.astro`, `favoritos.astro`, `resenas.astro`, `preferencias.astro`, `suscripcion.astro`

Pattern: Check `Astro.locals.user`, redirect to `/${locale}/auth/signin` if not authenticated.

## View Transitions

Card-to-detail morphing transitions using `transition:name`:

```astro
<!-- Card component -->
<img transition:name={`entity-${slug}`} src={image} />

<!-- Detail page hero -->
<img transition:name={`entity-${slug}`} src={heroImage} />
```

Applies to: AccommodationCard, DestinationCard, EventCard, BlogPostCard and their detail pages.

## Error States

Entity-specific error components in `src/components/error/`:

- `GenericErrorState.astro` - Base component (AlertTriangleIcon)
- `AccommodationErrorState.astro` - AccommodationIcon
- `DestinationErrorState.astro` - DestinationIcon
- `EventErrorState.astro` - EventIcon
- `PostErrorState.astro` - PostIcon

Props: `title`, `message`, `retryHref`, `homeHref`, `locale`.

## Pagination

`Pagination.astro` component with URL-segment routing pattern:

- Page 1: `/[lang]/alojamientos/` (no page segment)
- Page 2+: `/[lang]/alojamientos/page/[page]/`
- Props: `currentPage`, `totalPages`, `baseUrl`, `locale`
- Features: Previous/Next buttons, max 5 page numbers + ellipsis, ARIA attributes
- Responsive: 3 pages on mobile, 5 on desktop

Listing pages with pagination: alojamientos, eventos, publicaciones, destinos.

## Key Dependencies

- `astro` - Astro framework
- `@astrojs/react` - React integration for islands
- `@astrojs/sitemap` - Sitemap generation
- `@astrojs/vercel` - Vercel adapter for SSR
- `tailwindcss` - Tailwind CSS v4
- `@repo/i18n` - Internationalization utilities
- `@repo/schemas` - Zod validation schemas
- `@repo/service-core` - Business logic services
- `@repo/icons` - Icon components (Phosphor Icons wrappers)
- `@repo/utils` - Shared utilities

## Best Practices

1. **Use Astro components by default** - only use React when interactivity is needed
2. **Minimize JavaScript** - leverage islands architecture for selective hydration
3. **Use `client:visible`** as default hydration strategy for below-fold components
4. **Validate environment variables** with Zod schemas at build time
5. **Optimize images** with Astro's Image component
6. **Use semantic HTML** for accessibility
7. **Implement proper SEO** with meta tags, canonical URLs, hreflang, and structured data
8. **Test components** by verifying structure and props
9. **Follow i18n patterns** from `@repo/i18n`
10. **Keep bundle sizes small** - measure with Lighthouse
11. **Use `@repo/icons` for all icons** - never add inline `<svg>` elements
12. **Use entity-specific error states** - not generic error pages for API failures
13. **Add `transition:name`** on card images that link to detail pages
14. **Auth-guard all mi-cuenta pages** - check `Astro.locals.user` in frontmatter

## Common Patterns

### Dynamic Routes

```astro
---
// pages/blog/[slug].astro
export async function getStaticPaths() {
  const posts = await fetchBlogPosts();
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
---

<h1>{post.title}</h1>
<div set:html={post.content} />
```

### Pagination

URL-segment pattern with `Pagination.astro` component:

```astro
---
// pages/[lang]/alojamientos/page/[page].astro
import Pagination from '../../../../components/ui/Pagination.astro';

const page = Number(Astro.params.page);
const { items, pagination } = await accommodationsApi.list({ page, pageSize: 12 });
---

<Pagination
  currentPage={pagination.page}
  totalPages={pagination.totalPages}
  baseUrl={`/${locale}/alojamientos`}
  locale={locale}
/>
```

### Conditional Rendering

```astro
---
const { items } = Astro.props;
---

{items.length > 0 ? (
  <ul>
    {items.map((item) => <li>{item.name}</li>)}
  </ul>
) : (
  <p>No items found</p>
)}
```

### Using Services

```astro
---
import { AccommodationService } from '@repo/service-core';

const service = new AccommodationService();
const result = await service.findAll({ isActive: true });

if (!result.success) {
  return Astro.redirect('/error');
}

const accommodations = result.data;
---

{accommodations.map((acc) => <AccommodationCard {...acc} />)}
```

## Deployment

### Vercel Configuration

Deployed via `@astrojs/vercel` adapter with SSR:

```javascript
// astro.config.mjs
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
});
```

### Build Command

```bash
pnpm build
```

### Environment Variables (Vercel)

Set these in Vercel project settings:

- `PUBLIC_API_URL` - Production API URL
- `PUBLIC_SITE_URL` - Production site URL
- `NODE_ENV=production`

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>
