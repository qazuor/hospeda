# CLAUDE.md - Web2 Application

> **Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.
>
> **Visual Reference**: For all design decisions, tokens, colors, typography, and component patterns, see [STYLE_GUIDE.md](STYLE_GUIDE.md).

This file provides **prescriptive guidelines** for building the Hospeda Web2 application (`apps/web2`). This is a new app under active development.. follow these rules for all new code.

## Overview

Astro 5 public-facing website for the Hospeda platform. SSR with Vercel adapter, React islands for selective interactivity, Tailwind CSS v4 with fully tokenized design system (CSS custom properties), and i18n support for Spanish (primary), English, and Portuguese.

**This app will replace `apps/web`**. It uses a new design based on the TravHub reference template with organic shapes, warm palette, and Geologica/Roboto/Caveat typography.

## Key Commands

```bash
pnpm dev              # Start dev server at http://localhost:4322
pnpm build            # Production build (SSR)
pnpm preview          # Preview production build locally
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
pnpm typecheck        # TypeScript validation
pnpm lint             # Biome linting
pnpm format           # Biome formatting
```

## Project Structure

```
src/
  components/
    accommodation/     # Accommodation cards, filters, galleries (islands)
    account/           # Auth-protected account pages (islands)
    auth/              # SignIn, SignUp, UserNav (islands via @repo/auth-ui)
    destination/       # Destination cards, filters, map
    event/             # Event cards, calendar, category filters
    feedback/          # Feedback FAB wrapper
    post/              # Blog/post cards, tag filters
    search/            # Search bar (island)
    sections/          # Homepage sections (Hero, Accommodations, etc.)
    seo/               # SEOHead, JSON-LD components
    shared/            # Reusable: SectionHeader, Pagination, cards, badges
    skeletons/         # Loading skeleton components
    subscriber/        # Pricing cards, owner landing components
    ui/                # Low-level primitives: Button, Toast, Modal, ThemeToggle
  layouts/
    BaseLayout.astro   # HTML shell: fonts, FOUC prevention, global styles
    Header.astro       # Site header with locale-aware navigation
    Footer.astro       # Site footer with newsletter
  lib/
    api/               # API client, endpoint wrappers, response transforms
    auth-client.ts     # Better Auth browser client
    cn.ts              # Tailwind class merging (clsx + tailwind-merge)
    colors.ts          # Color mappings for categories, types, tags (tokenized)
    env.ts             # Zod-validated environment variables
    format-utils.ts    # Price, date, number formatting (wraps @repo/i18n)
    i18n.ts            # Translation helpers (wraps @repo/i18n)
    logger.ts          # Client-side logging wrapper
    media.ts           # Image/media URL extraction helpers
    middleware-helpers.ts  # Locale, auth, route detection helpers
    page-helpers.ts    # Shared page-level data fetching helpers
    pricing-fallbacks.ts   # Hardcoded pricing fallback data
    pricing-plans.ts       # Pricing plan fetching + mapping logic
    routes.ts          # Route constants (protected paths, auth paths, static paths)
    sanitize-html.ts   # HTML sanitization for user content
    tiptap-renderer.ts # Tiptap JSON to HTML renderer
    urls.ts            # URL builder with locale prefix + trailing slash
    validation/        # Client-side field validation helpers
  middleware.ts        # Request middleware (locale, auth, CSP)
  pages/
    [lang]/            # Locale-prefixed routes (es, en, pt)
    api/               # Server endpoints (if needed)
    404.astro
    500.astro
    index.astro        # Redirects to /es/
  store/
    toast-store.ts     # Global toast notification store (pub/sub)
  styles/
    global.css         # ALL design tokens + dark mode + Tailwind theme
```

## Architecture

### Rendering Strategy

| Strategy | When to use | Example pages |
|----------|------------|---------------|
| **SSR** (default) | Dynamic content, auth-aware, search, fresh data | `/busqueda/`, `/mi-cuenta/*`, `/auth/*` |
| **SSG** (`prerender = true`) | Static content that rarely changes | `/nosotros/`, `/faq/`, `/legal/*`, `/contacto/` |
| **ISR** (via Vercel adapter) | Content-heavy pages that change via CMS | `/alojamientos/`, `/destinos/`, `/eventos/`, `/publicaciones/` |
| **Server Islands** (`server:defer`) | Auth-dependent fragments on otherwise static pages | FavoriteButton, UserNav, ReviewList |

```astro
---
// SSG page
export const prerender = true;
---

<!-- Server Island on an SSG page -->
<AuthSection server:defer>
  <Skeleton slot="fallback" />
</AuthSection>
```

### Islands Architecture

**Astro components are the default.** Use React islands ONLY when client-side interactivity is required (forms, state, event handlers).

```astro
---
// GOOD: static Astro component.. zero JavaScript shipped
import AccommodationCard from '@/components/shared/AccommodationCard.astro';

// GOOD: interactive island.. hydrates only when visible
import FilterSidebar from '@/components/accommodation/FilterSidebar.client';
---

<AccommodationCard {...accommodation} />
<FilterSidebar client:visible filters={initialFilters} />
```

#### Client Directive Guide

| Directive | When to use |
|-----------|------------|
| `client:load` | Must be interactive immediately (search bar, auth nav, toast) |
| `client:visible` | Below the fold.. lazy hydrate on scroll (cards, filters) |
| `client:idle` | Low priority, defer until browser is idle (FeedbackFAB, ThemeToggle) |
| `client:media` | Responsive-only components (mobile menu) |
| `client:only="react"` | Cannot be server-rendered (map libraries) |

### API Integration

All API calls go through `src/lib/api/`. Three files, three tiers:

| File | API Tier | Auth | Used by |
|------|----------|------|---------|
| `endpoints.ts` | `/api/v1/public/*` | None | All public pages |
| `endpoints-protected.ts` | `/api/v1/protected/*` | User session | `/mi-cuenta/*`, pricing |
| `transforms.ts` | _(local)_ | N/A | Converts API responses to component props |

```astro
---
import { accommodationApi } from '@/lib/api/endpoints';
import { transformAccommodation } from '@/lib/api/transforms';

const result = await accommodationApi.getList({ page: 1, pageSize: 12, locale });
if (!result.success) return Astro.redirect('/404');

const cards = result.data.map(transformAccommodation);
---
```

**Rules:**

- NEVER call `fetch()` directly in pages or components.. always use `lib/api/`
- EVERY entity MUST have a transform function in `transforms.ts`
- API responses go through transforms BEFORE reaching components.. no raw API data in props
- Use `ApiResult<T>` type consistently (never `AuthApiResult` or custom result types)

### Response Transforms

`src/lib/api/transforms.ts` is the bridge between API responses and component props. It ensures components never depend on API structure directly.

```
API Response (raw)  →  transforms.ts  →  Component Props (clean)
```

**Rules:**

- ONE transform function per entity type (accommodation, destination, event, post)
- Transform functions handle missing fields, defaults, and fallbacks
- Components NEVER import from `@repo/schemas` directly.. they receive pre-transformed props
- When adding a new entity, ALWAYS add its transform function

### Pricing Exception

The pricing page (`/suscriptores/precios/*`) is the **only page with hardcoded fallback data**. If the billing API fails, it renders `pricing-fallbacks.ts` instead of showing an error. This is intentional.. a pricing page must never be empty as it's critical for conversion.

All other pages depend entirely on the API. If the API fails, they show an error or redirect to 404.

## Styling Rules

> **Full token reference**: See [STYLE_GUIDE.md](STYLE_GUIDE.md)

### Golden Rules

1. **NEVER hardcode colors, spacing, shadows, or radii.** Use tokens from `global.css`
2. **NEVER use uniform border-radius on cards/images.** Use organic asymmetric shapes (`rounded-organic`)
3. **ALWAYS use semantic token names** (`bg-primary`, `text-muted-foreground`), never palette values (`bg-blue-600`)
4. **ALWAYS alternate section backgrounds** between `bg-background` and `bg-surface-warm`
5. **Dark mode must work automatically.** If you use tokens, it does. If you hardcode, it breaks

### Quick Token Reference

```css
/* Colors */
bg-background          /* Page background */
bg-card                /* Card surfaces */
bg-surface-warm        /* Peach-tinted sections */
bg-surface-dark        /* Dark sections, footer */
bg-accent              /* CTA buttons, highlights (orange) */
bg-primary             /* Primary brand (blue) */
text-foreground        /* Primary text */
text-muted-foreground  /* Secondary text */
text-accent            /* Accent text, tagline color */

/* Shapes */
rounded-organic        /* 0px 100px - signature asymmetric radius */
rounded-organic-sm     /* 0px 75px - card content areas */
rounded-organic-alt    /* 100px 0px - reversed (blog thumbnails) */
rounded-card           /* 24px - card outer container */
rounded-button         /* 8px - buttons */
rounded-pill           /* 9999px - badges, tags */

/* Spacing */
py-section             /* 120px - standard section padding */
gap-card               /* 30px - gap between cards */
mb-section-header      /* 50px - below section headers */
max-w-container        /* 1350px - main container */

/* Shadows */
shadow-card            /* Default card elevation */
shadow-card-hover      /* Hovered card elevation */
shadow-search          /* Search form shadow */

/* Transitions */
duration-normal        /* 0.4s - most hover effects */
duration-slow          /* 0.5s - buttons */
duration-reveal        /* 1.5s - scroll reveal */
```

### Fonts

| Tailwind class | Font | Usage |
|---------------|------|-------|
| `font-heading` | Geologica | Section titles, card titles, hero |
| `font-sans` | Roboto | Body text, meta, UI elements |
| `font-decorative` | Caveat | Section taglines (handwritten accent) |

### Adding a New Theme

Adding a theme is just a new CSS block. No code changes needed:

```css
[data-theme="high-contrast"] {
  --background: oklch(1 0 0);
  --foreground: oklch(0 0 0);
  --accent: oklch(0.55 0.22 45);
  /* ... override all color tokens ... */
}
```

## i18n

### Rules

- **ALL user-facing text MUST go through `t()`**. No hardcoded strings in components, ever
- **ALWAYS call `createTranslations(locale)` or `createT(locale)`**. Never access translation keys directly
- Primary locale is `es`. Other locales (`en`, `pt`) will be translated later
- Until translated, `en` and `pt` fall back to `es` strings
- URL structure: `/{locale}/rest/of/path/` with trailing slash enforced

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

For React islands, receive `locale` as a prop:

```tsx
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

interface Props {
  readonly locale: SupportedLocale;
}

export function MyIsland({ locale }: Props) {
  const { t } = createTranslations(locale);
  return <p>{t('some.key')}</p>;
}
```

### Locale Validation

Locale is extracted and validated in middleware. Access via `Astro.locals.locale` in pages:

```astro
---
const locale = Astro.locals.locale; // guaranteed valid: 'es' | 'en' | 'pt'
---
```

## Auth

### Protected Routes

Only `/mi-cuenta/*` routes require authentication. Middleware checks the session and redirects unauthenticated users to the login page.

All other routes (including `/suscriptores/*`) are public.

### Auth UI

Auth components come from `@repo/auth-ui`. Do NOT build custom auth forms.

```astro
---
import { SignInForm } from '@repo/auth-ui';
---
<SignInForm locale={locale} client:load />
```

### Auth in Islands

Islands cannot access `Astro.locals` directly. Pass user data as props:

```astro
---
const user = Astro.locals.user;
---
<FavoriteButton entityId={id} user={user} locale={locale} client:visible />
```

## Middleware

Request processing order:

1. **Skip** static assets (`/_astro/`, images, fonts)
2. **Handle** Server Island requests (parse session, skip locale)
3. **Enforce** trailing slash (redirect `path` -> `path/`)
4. **Validate** locale from URL path (redirect invalid -> `/es/...`)
5. **Parse session** only for routes that need it (protected + auth)
6. **Protect** `/mi-cuenta/*` routes (redirect to login if no session)
7. **Rewrite** 404 responses to custom 404 page
8. **Set** Content-Security-Policy header on HTML responses

### Route Constants

Protected and auth route segments are defined in `src/lib/routes.ts`, NOT hardcoded in middleware:

```ts
// src/lib/routes.ts
export const PROTECTED_SEGMENTS = ['mi-cuenta'] as const;
export const AUTH_SEGMENTS = ['auth'] as const;
export const STATIC_PREFIXES = ['/_astro/', '/_server-islands/', '/favicon'] as const;
```

## Component Conventions

### File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Astro component | `PascalCase.astro` | `AccommodationCard.astro` |
| React island | `PascalCase.client.tsx` | `FilterSidebar.client.tsx` |
| React UI primitive | `PascalCase.tsx` | `Button.tsx` |
| Utility | `kebab-case.ts` | `format-utils.ts` |
| Test | `*.test.ts` / `*.test.tsx` | `format-utils.test.ts` |

### Astro Components

```astro
---
/**
 * @file AccommodationCard.astro
 * @description Card displaying accommodation summary with organic shape image.
 */

interface Props {
  readonly title: string;
  readonly slug: string;
  readonly image: string;
  readonly price: string;
  readonly locale: import('@/lib/i18n').SupportedLocale;
}

const { title, slug, image, price, locale } = Astro.props;
---

<article class="group">
  <div class="rounded-organic overflow-hidden">
    <img
      src={image}
      alt={title}
      class="object-cover w-full transition duration-normal ease-in-out group-hover:scale-110"
      loading="lazy"
    />
  </div>
  <div class="bg-card rounded-organic-sm p-card-content">
    <h3 class="font-heading font-semibold text-h3 text-foreground">{title}</h3>
    <span class="text-accent font-medium">{price}</span>
  </div>
</article>
```

**Rules:**

- Props interface named `Props`, all props `readonly`
- `class:list` for conditional classes
- Semantic tokens only (never hardcoded colors)
- JSDoc on the file
- `aria-hidden="true"` on decorative elements
- `loading="lazy"` on images below the fold

### React Island Components

```tsx
/**
 * @file FilterSidebar.client.tsx
 * @description Interactive filter sidebar for accommodation listing.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

interface FilterSidebarProps {
  readonly locale: SupportedLocale;
  readonly initialFilters: ReadonlyArray<string>;
  readonly onFilterChange?: (filters: ReadonlyArray<string>) => void;
}

export function FilterSidebar({ locale, initialFilters, onFilterChange }: FilterSidebarProps) {
  const { t } = createTranslations(locale);
  // ...
}
```

**Rules:**

- File suffix `.client.tsx` for islands, `.tsx` for pure UI primitives
- Named exports only (no default exports)
- RO-RO pattern for functions and hooks
- Always accept `locale: SupportedLocale` when rendering text
- `import type` for type-only imports

### Color Mappings

Use `src/lib/colors.ts` for mapping categories, types, and tags to CSS classes:

```ts
import { getEventCategoryColor, getAccommodationTypeColor } from '@/lib/colors';

const categoryClasses = getEventCategoryColor('cultural');
// { bg: 'bg-accent/15', text: 'text-accent', border: 'border-accent/30' }

const typeClasses = getAccommodationTypeColor('hotel');
// { bg: 'bg-primary/15', text: 'text-primary', border: 'border-primary/30' }
```

All color values in this file MUST reference semantic tokens, never hardcoded values.

## SEO

### SEOHead Component

Every page MUST include SEOHead in the layout:

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
</BaseLayout>
```

### JSON-LD

Use entity-specific JSON-LD components for rich search results:

| Entity | Component | Schema |
|--------|-----------|--------|
| Accommodation | `LodgingBusinessJsonLd` | `LodgingBusiness` |
| Event | `EventJsonLd` | `Event` |
| Destination | `PlaceJsonLd` | `Place` |
| Post | `ArticleJsonLd` | `Article` |

## Animations

### Scroll Reveal

Elements animate into view using IntersectionObserver:

```astro
<div class="scroll-reveal">This fades in from below</div>
<div class="scroll-reveal-left">This slides in from the left</div>
<div class="scroll-reveal-right">This slides in from the right</div>
```

### Stagger Pattern

Repeated elements (cards in a grid) use incremental delays:

```astro
{items.map((item, i) => (
  <div class="scroll-reveal" style={`animation-delay: ${i * 100}ms`}>
    <Card {...item} />
  </div>
))}
```

Max stagger: 700ms (7 visible items). All animations respect `prefers-reduced-motion`.

### View Transitions

Use Astro View Transitions for smooth page navigation:

```astro
---
import { ViewTransitions } from 'astro:transitions';
---
<head>
  <ViewTransitions />
</head>

<!-- Named transition for morphing between list and detail -->
<img transition:name={`accommodation-${slug}`} src={image} alt={name} />
```

## Sections

### Section Template

All content sections follow this structure:

```astro
<section class="relative bg-surface-warm py-section overflow-hidden">
  <!-- Decoratives (hidden on mobile) -->
  <div class="absolute top-8 left-8 hidden md:block opacity-40 pointer-events-none" aria-hidden="true">
    <img src="/images/decoratives/deco-compass.svg" alt="" />
  </div>

  <!-- Content -->
  <div class="relative z-content mx-auto max-w-container px-container">
    <div class="text-center mb-section-header">
      <span class="font-decorative font-bold text-tagline text-accent">{t('section.tagline')}</span>
      <h2 class="font-heading font-medium text-h2 text-foreground text-balance mt-2">{t('section.title')}</h2>
      <p class="font-sans text-body text-muted-foreground max-w-xl mx-auto mt-4">{t('section.subtitle')}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-card">
      {items.map((item, i) => (
        <div class="scroll-reveal" style={`animation-delay: ${i * 100}ms`}>
          <Card {...item} />
        </div>
      ))}
    </div>
  </div>
</section>
```

### Section Background Alternation

Adjacent sections MUST alternate backgrounds:

```
bg-background    → bg-surface-warm    → bg-background    → bg-surface-warm
```

Never place two `bg-background` or two `bg-surface-warm` sections back-to-back.

## Testing

### Strategy

| Code type | Testing approach |
|-----------|-----------------|
| Astro components | Read source file, assert on content (no DOM renderer in Vitest) |
| React islands | `@testing-library/react` with render + assert |
| Utilities (`lib/`) | Standard unit tests with direct imports |
| API endpoints | Mock fetch, test transform pipeline |
| Middleware | Test helper functions directly |

### Patterns

```ts
// Astro component test
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
  resolve(__dirname, '../../../src/components/shared/SectionHeader.astro'),
  'utf8'
);

describe('SectionHeader.astro', () => {
  it('should use font-decorative for tagline', () => {
    expect(src).toContain('font-decorative');
  });

  it('should use font-heading for title', () => {
    expect(src).toContain('font-heading');
  });
});
```

```tsx
// React island test
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilterChip } from '../FilterChip';

describe('FilterChip', () => {
  it('should render label', () => {
    render(<FilterChip label="Hotels" active={false} />);
    expect(screen.getByText('Hotels')).toBeInTheDocument();
  });
});
```

### Rules

- Test files live in `test/` at project root, mirroring `src/` structure
- AAA pattern: Arrange, Act, Assert
- Minimum 80% coverage (Astro limitation.. cannot render `.astro` in Vitest)
- `.only()` and hard-coded `.skip()` are forbidden in committed code
- Use `it.skipIf(condition)` for legitimate conditional test skipping
- Run `pnpm test` before committing

## Environment Variables

Validated at startup by `src/lib/env.ts` (Zod schema). If a required variable is missing, the app fails fast with a clear error message.

```bash
# Server-side (HOSPEDA_ prefix.. not exposed to browser)
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4322
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# Client-side (PUBLIC_ prefix.. exposed to browser by Astro)
PUBLIC_API_URL=http://localhost:3001
PUBLIC_SITE_URL=http://localhost:4322
PUBLIC_SENTRY_DSN=                    # omit to disable Sentry
PUBLIC_ENABLE_LOGGING=false           # set to true for console logging
```

NEVER use a `HOSPEDA_*` variable in client-side code. NEVER use `import.meta.env` directly.. access env values through `src/lib/env.ts`.

## Icons

All icons come from `@repo/icons`. NEVER add inline `<svg>` elements (exception: decorative illustrations on 404/500 pages).

```astro
---
import { SearchIcon, HeartIcon } from '@repo/icons';
---
<SearchIcon size={20} weight="regular" aria-hidden="true" />
```

## Dark Mode

Controlled by `data-theme="dark"` on `<html>`. FOUC prevention inline script in `BaseLayout.astro` reads `localStorage` before first paint. The `ThemeToggle` island (`client:idle`) persists the preference.

If you use semantic tokens everywhere, dark mode works automatically. If you hardcode a color, it breaks in dark mode.

## Pagination

URL-segment pattern.. page 1 has no segment, page 2+ adds `/page/[page]/`:

```
/es/alojamientos/        ← page 1
/es/alojamientos/page/2/ ← page 2
```

## Common Gotchas

- **Locale param**: Access via `Astro.locals.locale` (validated by middleware), not `Astro.params.lang`
- **Trailing slashes**: Enforced by Astro config. Use `buildUrl()` from `src/lib/urls.ts` for all internal links
- **No hardcoded colors**: Use tokens. `bg-primary`, not `bg-blue-600`
- **No hardcoded strings**: Use `t()`. Even if only `es` is ready, all strings must go through i18n
- **No console.log**: Use `src/lib/logger.ts` which wraps `@repo/logger`
- **No default exports**: All `.ts` and `.tsx` files use named exports only
- **No raw API data in components**: Always go through `transforms.ts`
- **Organic shapes**: Cards and images use asymmetric radius, not uniform `rounded-xl`
- **Auth in islands**: Pass `Astro.locals.user` as props. Islands cannot read server locals
- **Image optimization**: `<Image>` from `astro:assets` for local images; `<img loading="lazy">` for remote

## lib/ File Origins

Files in `src/lib/` come from `apps/web` with varying levels of adaptation:

### Copied as-is (no changes needed)

`api/client.ts`, `api/types.ts`, `api/index.ts`, `cn.ts`, `format-utils.ts`, `media.ts`, `page-helpers.ts`, `urls.ts`, `validation/`, `store/toast-store.ts`, `sanitize-html.ts`, `tiptap-renderer.ts`

### Copied + adapted

- `env.ts` - Same schema, web2-specific error messages
- `logger.ts` - Same prefix `[HOSPEDA-WEB]`
- `i18n.ts` - Verify namespace imports match `@repo/i18n`
- `colors.ts` - Expanded from `category-colors.ts` to include accommodation types, post categories, event categories, tags
- `pricing-fallbacks.ts` - Updated plan data
- `pricing-plans.ts` - Adjusted field mapping if billing API structure changes
- `auth-client.ts` - Unified error types to use `ApiResult<T>` instead of custom `AuthApiResult`

### Rewritten for web2

- `api/endpoints.ts` - New endpoints matching web2 page structure
- `api/endpoints-protected.ts` - New protected endpoints
- `api/transforms.ts` - New transforms matching web2 component props
- `middleware.ts` - Updated routes, CSP, using route constants
- `middleware-helpers.ts` - Uses `routes.ts` constants, no duplicated `getApiUrl()`
- `routes.ts` - NEW file: centralized route segment constants

### Key improvements over apps/web

1. **No duplicated `getApiUrl()`** - Lives only in `env.ts`, imported everywhere
2. **Unified error types** - `ApiResult<T>` everywhere, no `AuthApiResult`
3. **Route constants** - Protected/auth paths in `routes.ts`, not hardcoded in middleware
4. **`colors.ts` instead of `category-colors.ts`** - Single file for ALL entity color mappings

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `astro` | Core framework |
| `@astrojs/react` | React island integration |
| `@astrojs/vercel` | SSR adapter with ISR |
| `tailwindcss` | Utility-first CSS (v4) |
| `@repo/i18n` | Translations + date/number/currency formatting |
| `@repo/schemas` | Zod validation schemas (source of truth for types) |
| `@repo/icons` | Phosphor icon wrappers |
| `@repo/logger` | Structured logging |
| `@repo/auth-ui` | Authentication UI components |
| `@repo/feedback` | Feedback FAB widget |
| `better-auth` | Authentication (via @repo/auth-ui) |

## Related Documentation

- [Style Guide](STYLE_GUIDE.md) - Complete design token and component reference
- [README](README.md) - Quick start and page list
- [Root CLAUDE.md](../../CLAUDE.md) - Monorepo-wide conventions
- [API Route Architecture](../api/docs/route-architecture.md) - API tier reference
- [i18n Guide](../../packages/i18n/docs/guides/usage.md) - Translation system
- [Dependency Policy](../../docs/guides/dependency-policy.md) - What to use for what
