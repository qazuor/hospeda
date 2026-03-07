# CLAUDE.md - Web Application

> **Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Hospeda Web application (`apps/web`).

## Overview

Astro 5-based public-facing website for the Hospeda platform. Features SSR with the Vercel adapter, React islands for selective interactivity, Tailwind CSS v4 with semantic CSS custom properties for theming, and i18n support for Spanish, English, and Portuguese.

## Key Commands

```bash
# Development (from monorepo root or this directory)
pnpm dev               # Start dev server at http://localhost:4321

# Build and preview
pnpm build             # Production build (SSR)
pnpm preview           # Preview production build locally

# Testing
pnpm test              # Run all tests (Vitest)
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report

# Code quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Biome formatting
```

## Project Structure

```
src/
  components/
    accommodation/     # AccommodationCard, FilterSidebar, PriceRangeFilter (islands)
    account/           # Auth-protected account islands (ProfileEditForm, etc.)
    auth/              # SignIn, SignUp, UserNav, AuthRequiredPopover (islands)
    content/           # ContactForm island
    destination/       # DestinationFilters island, LitoralMap (Astro)
    event/             # CalendarView island
    feedback/          # FeedbackIslandWrapper
    review/            # ReviewForm, ReviewList (islands), ReviewListIsland (Astro)
    search/            # SearchBar island
    sections/          # Static homepage sections (HeroSection, EventsSection, etc.)
    seo/               # SEOHead, JsonLd, LodgingBusinessJsonLd, EventJsonLd, etc.
    shared/            # Reusable UI: cards, badges, pagination, navigation, dividers
    skeletons/         # Loading skeleton components
    ui/                # Low-level primitives (Toast, Modal, ThemeToggle, Shadcn wrappers)
  layouts/
    BaseLayout.astro   # HTML shell: FOUC prevention, fonts, scroll-reveal, FeedbackFAB
    Header.astro       # Site header with locale-aware navigation
    Footer.astro       # Site footer
  lib/
    api/               # API client (client.ts), endpoint wrappers (endpoints.ts, endpoints-protected.ts)
    auth-client.ts     # Better Auth browser client
    category-colors.ts # Accommodation category color mappings
    cn.ts              # Tailwind class merging utility
    env.ts             # Zod-validated environment variable access
    format-utils.ts    # formatPrice, formatDate, formatRelativeTime, formatNumber
    i18n.ts            # createTranslations, createT, isValidLocale, SupportedLocale
    logger.ts          # Client-side logging wrapper
    media.ts           # Image / media URL helpers
    middleware-helpers.ts # Auth extraction helpers for middleware
    owners-page-data.ts   # Static data for the propietarios page
    page-helpers.ts    # Shared page-level data fetching helpers
    pricing-fallbacks.ts  # Hardcoded pricing fallback data
    pricing-plans.ts      # Pricing plan display data
    sanitize-html.ts   # DOMPurify wrapper for rendering user HTML
    tiptap-renderer.ts # Tiptap JSON to HTML renderer
    urls.ts            # buildUrl, buildUrlWithParams
  middleware.ts        # Auth injection (Astro.locals.user)
  pages/
    [lang]/            # Locale-prefixed routes (es, en, pt)
      alojamientos/    # Listing + detail + pagination + type filter
      destinos/        # Listing + detail + accommodation sub-listing
      eventos/         # Listing + detail + category filter
      publicaciones/   # Listing + detail + tag filter
      mi-cuenta/       # Auth-protected account pages (6 pages)
      auth/            # signin, signup, forgot-password, reset-password, verify-email
      precios/         # turistas, propietarios
      propietarios/    # Owner landing page
      busqueda.astro   # Global search results
      contacto.astro
      destinos/        # Destination index and pagination
      feedback.astro
      privacidad.astro
      quienes-somos.astro
      terminos-condiciones.astro
      mapa-del-sitio.astro
      beneficios.astro
    api/               # Server endpoints (API routes)
    404.astro
    500.astro
    index.astro        # Redirects to /es/
  store/
    toast-store.ts     # Global toast notification store
  styles/
    global.css         # CSS custom properties (semantic tokens) + dark mode + animations
```

## Architecture

### Rendering Strategy

The app uses a hybrid rendering approach via `@astrojs/vercel`:

- **SSR (default)**: Dynamic pages (search, account, auth) render on every request for fresh data, personalization, and auth-aware content.
- **SSG (prerender)**: Static content pages (privacidad, terminos, beneficios, contacto, quienes-somos, propietarios) and detail pages with `getStaticPaths` (publicaciones/[slug]) use `prerender = true` for better performance.
- **Server Islands**: Auth-dependent components (AuthSection, FavoriteButton, ReviewList) use `server:defer` (stable in Astro 5.7+, no experimental flag needed), allowing static shells with deferred interactive islands.

### Islands Architecture

Astro components are the default. Use React islands only when client-side interactivity is required.

```astro
---
// GOOD: static Astro component - zero JavaScript shipped
import AccommodationCard from '@/components/shared/AccommodationCard.astro';

// GOOD: interactive island - hydrates only when visible
import FilterSidebar from '@/components/accommodation/FilterSidebar.client';
---

<AccommodationCard {...accommodation} />
<FilterSidebar client:visible filters={initialFilters} />
```

### Client Directive Guide

| Directive | When to use |
|-----------|------------|
| `client:load` | Must be interactive immediately (search bar, auth nav, toast container) |
| `client:visible` | Below the fold - lazy hydrate on scroll |
| `client:idle` | Low priority, defer until browser is idle (FeedbackFAB, ThemeToggle) |
| `client:media` | Responsive-only components |
| `client:only` | Cannot be server-rendered (map libraries) |

## Semantic Color Tokens

All components use CSS custom properties defined in `src/styles/global.css`. Never hardcode colors.

| Token | Purpose |
|-------|---------|
| `--background` / `--foreground` | Page background and primary text |
| `--card` / `--card-foreground` | Card surfaces |
| `--primary` / `--primary-foreground` | Brand color (blue) |
| `--secondary` / `--secondary-foreground` | Secondary action color (green) |
| `--accent` / `--accent-foreground` | Highlight / CTA color (orange) |
| `--muted` / `--muted-foreground` | Subdued backgrounds and labels |
| `--destructive` / `--destructive-foreground` | Error and danger states |
| `--border` | Dividers and input borders |
| `--ring` | Focus rings |

Dark mode activates via `data-theme="dark"` on `<html>`. FOUC prevention is handled by an inline script in `BaseLayout.astro`.

### Tailwind Usage

Use semantic token names as Tailwind utilities. Do not use hardcoded palette values like `bg-blue-600`.

```astro
<!-- GOOD -->
<div class="bg-card text-card-foreground border border-border rounded-lg">

<!-- BAD -->
<div class="bg-white text-gray-900 border border-gray-200 rounded-lg">
```

## i18n Pattern

All user-facing text must go through translations from `@repo/i18n`.

```astro
---
import { createTranslations } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';

const locale = (Astro.params.lang ?? 'es') as SupportedLocale;
const { t, tPlural } = createTranslations(locale);
---

<h1>{t('home.hero.title')}</h1>
<p>{tPlural('review.totalReviews', count)}</p>
```

For React islands, receive `locale` as a prop and call `createTranslations` inside the component or use the `useTranslations` hook from `@repo/i18n`.

Supported locales: `es` (default), `en`, `pt`. URL pattern: `/{locale}/rest/of/path/`.

## API Calls

All API calls go through `src/lib/api/` helpers. Use the appropriate tier:

- `endpoints.ts` - Public endpoints (no auth required)
- `endpoints-protected.ts` - Protected endpoints (user session required)

```astro
---
import { getAccommodations } from '@/lib/api/endpoints';

const result = await getAccommodations({ page: 1, pageSize: 12, locale });
if (!result.success) return Astro.redirect('/404');
const { data: accommodations, pagination } = result;
---
```

Auth cookies are forwarded from `Astro.request` by the API client automatically.

## Component Conventions

### Astro Components

- Props interface named `Props` (Astro convention), all props `readonly`.
- Use `class:list` for conditional classes.
- Semantic tokens only (no hardcoded colors).
- JSDoc on the file and on complex props.
- `aria-hidden="true"` on purely decorative elements.

```astro
---
/**
 * @file BadgeExample.astro
 * @description Short component description.
 */

interface Props {
  readonly label: string;
  readonly variant?: 'primary' | 'secondary';
}

const { label, variant = 'primary' } = Astro.props;
---

<span class:list={[
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  variant === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
]}>
  {label}
</span>
```

### React Island Components

- File suffix `.client.tsx` for islands, `.tsx` for pure UI primitives.
- Named exports only.
- RO-RO pattern for all functions and hooks.
- Always accept `locale: SupportedLocale` as a prop when text is rendered.
- Use `import type` for type-only imports.

```tsx
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

interface FavoriteButtonProps {
  readonly entityId: string;
  readonly locale: SupportedLocale;
  readonly initialFavorited?: boolean;
}

export function FavoriteButton({ entityId, locale, initialFavorited = false }: FavoriteButtonProps) {
  const { t } = createTranslations(locale);
  // ...
}
```

### Formatting Utilities

Use `src/lib/format-utils.ts` for all formatting in components that do not have direct access to `@repo/i18n`:

```ts
import { formatPrice, formatDate, formatRelativeTime } from '@/lib/format-utils';

formatPrice({ amount: 12500, locale: 'es' })              // "$ 12.500,00"
formatDate({ date: new Date(), locale: 'es' })             // "6 de marzo de 2026"
formatRelativeTime({ date: new Date('2026-03-05'), locale: 'es' }) // "ayer"
```

## Auth Guards

All pages under `/[lang]/mi-cuenta/` require authentication. Check in frontmatter:

```astro
---
import { buildUrl } from '@/lib/urls';

const locale = (Astro.params.lang ?? 'es') as SupportedLocale;
if (!Astro.locals.user) {
  return Astro.redirect(buildUrl({ locale, path: 'auth/signin' }));
}
---
```

## SEO Pattern

```astro
---
import SEOHead from '@/components/seo/SEOHead.astro';
---
<BaseLayout>
  <SEOHead
    slot="head"
    title="Page Title | Hospeda"
    description="Description for search engines"
    locale={locale}
    canonicalPath={Astro.url.pathname}
  />
  <!-- page content -->
</BaseLayout>
```

Use entity-specific JSON-LD components from `src/components/seo/` for accommodations, events, destinations, and articles.

## View Transitions

Card images that link to detail pages get `transition:name` for morphing transitions:

```astro
<!-- On the card -->
<img transition:name={`accommodation-${slug}`} src={image} alt={name} />

<!-- On the detail page hero -->
<img transition:name={`accommodation-${slug}`} src={heroImage} alt={name} />
```

## Icons

All icons come from `@repo/icons`. Never add inline `<svg>` elements (except for decorative illustrations on 404/500 pages).

```astro
---
import { SearchIcon, HeartIcon } from '@repo/icons';
---

<SearchIcon size={20} weight="regular" aria-hidden="true" />
```

## Dark Mode

Dark mode is controlled by `data-theme="dark"` on `<html>`. The FOUC prevention inline script in `BaseLayout.astro` reads `localStorage` before first paint. The `ThemeToggle` React island (`client:idle`) persists the user preference.

## Pagination

URL-segment pattern - page 1 has no segment, page 2+ adds `/page/[page]/`:

```
/es/alojamientos/        <- page 1
/es/alojamientos/page/2/ <- page 2
```

Use `Pagination.astro` from `src/components/shared/` with props `currentPage`, `totalPages`, `baseUrl`, `locale`.

## NavigationProgress

A thin progress bar at the top of the viewport during navigation. Include it once in `Header.astro` or `BaseLayout.astro`:

```astro
import NavigationProgress from '@/components/shared/NavigationProgress.astro';

<NavigationProgress />
```

Listens to `astro:before-preparation` (start) and `astro:after-swap` (complete).

## Testing Approach

Astro components are tested by reading the source file and asserting on its content (since Astro has no DOM renderer in Vitest). React islands are tested with `@testing-library/react`.

```ts
// test/components/shared/navigation-progress.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
  resolve(__dirname, '../../../src/components/shared/NavigationProgress.astro'),
  'utf8'
);

describe('NavigationProgress.astro', () => {
  it('should have aria-hidden on the bar element', () => {
    expect(src).toContain('aria-hidden="true"');
  });

  it('should listen to astro:before-preparation', () => {
    expect(src).toContain('astro:before-preparation');
  });
});
```

Test files live in `test/` at the same level as `src/`. Minimum 90% coverage required.

## Environment Variables

See `apps/web/.env.example` for a full list. Variables are validated at startup by `src/lib/env.ts` (Zod-validated). Access env values exclusively through that module rather than `import.meta.env` directly.

```bash
# Server-side (HOSPEDA_ prefix - not exposed to browser)
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4321
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key-min-32-chars
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# Client-side (PUBLIC_ prefix - exposed to browser by Astro)
PUBLIC_API_URL=http://localhost:3001
PUBLIC_SITE_URL=http://localhost:4321
```

Server-side variables use the `HOSPEDA_` prefix. Client-side variables (safe to expose) use the `PUBLIC_` prefix. Never use a `HOSPEDA_` variable in a client component.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `astro` | Core framework |
| `@astrojs/react` | React island integration |
| `@astrojs/vercel` | SSR adapter |
| `tailwindcss` | Utility-first CSS (v4) |
| `@repo/i18n` | Translations + date/number/currency formatting |
| `@repo/schemas` | Zod validation schemas (source of truth for types) |
| `@repo/icons` | Phosphor icon wrappers |
| `@repo/logger` | Structured logging |
| `@repo/feedback` | Feedback FAB widget |
| `better-auth` | Authentication (via `@repo/auth-ui`) |

## Common Gotchas

- **Locale param**: Always cast `Astro.params.lang` with `as SupportedLocale` after validating with `isValidLocale`.
- **Trailing slashes**: `astro.config.mjs` enforces `trailingSlash: 'always'`. Use `buildUrl` from `src/lib/urls.ts` to build all internal links.
- **No hardcoded colors**: Use semantic tokens (`bg-primary`, `text-muted-foreground`) not palette values (`bg-blue-600`).
- **No console.log**: Use `src/lib/logger.ts` which wraps `@repo/logger`.
- **No default exports**: All `.ts` and `.tsx` files use named exports only.
- **Image optimization**: Use `<Image>` from `astro:assets` for local images; use `<img loading="lazy">` for remote URLs.
- **Auth in islands**: Pass `Astro.locals.user` data as props. Islands cannot read server locals directly.

## Related Documentation

- [Adding Web Pages](docs/guides/adding-pages.md)
- [Branding and Theming](docs/guides/branding-and-theming.md)
- [Web Deployment](docs/deployment.md)
- [Route Audit](docs/route-audit.md)
- [Dependency Policy](../../docs/guides/dependency-policy.md)
- [Internationalization](../../packages/i18n/docs/guides/usage.md)
