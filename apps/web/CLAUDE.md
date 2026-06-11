# CLAUDE.md - Web Application

> **Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.
>
> **Visual Reference**: For all design decisions, tokens, colors, typography, and component patterns, see [STYLE_GUIDE.md](STYLE_GUIDE.md).

This file provides **prescriptive guidelines** for building the Hospeda Web application (`apps/web`). This app is under active development.. follow these rules for all new code.

## Overview

Astro 5 public-facing website for the Hospeda platform. SSR with the Astro Node adapter (running long-lived in a Docker container managed by Coolify), React islands for selective interactivity, semantic CSS with Astro scoped styles and CSS Modules (fully tokenized design system via CSS custom properties), and i18n support for Spanish (primary), English, and Portuguese.

It uses a warm palette and Geologica/Roboto/Caveat typography. Cards and images use uniform border-radius (`--radius-card`); do NOT use asymmetric/organic radius.

## Key Commands

```bash
pnpm dev              # Start dev server at http://localhost:4321
pnpm build            # Production build (SSR)
pnpm preview          # Preview production build locally
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
pnpm typecheck        # astro sync && astro check && tsc --noEmit (typechecks .astro too)
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
    cn.ts              # Conditional class joining (clsx)
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
    global.css         # ALL design tokens + dark mode + CSS reset + base styles
```

## Architecture

### Rendering Strategy

| Strategy | When to use | Example pages |
|----------|------------|---------------|
| **SSR** (default) | Dynamic content, auth-aware, search, fresh data | `/busqueda/`, `/mi-cuenta/*`, `/auth/*` |
| **SSG** (`prerender = true`) | Static content that rarely changes | `/nosotros/`, `/faq/`, `/legal/*`, `/contacto/` |
| **SSR + Cloudflare cache** | Content-heavy pages that change via CMS — pages re-render on demand and Cloudflare caches the response; the API triggers `/api/revalidate` to purge the cache when data changes | `/alojamientos/`, `/destinos/`, `/eventos/`, `/publicaciones/` |
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
import AccommodationCard from '@/components/shared/cards/AccommodationCard.astro';

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

### Approach

This app uses **semantic CSS** with three layers:

1. **`global.css`** .. CSS custom properties (design tokens) in `:root`, CSS reset, base styles
2. **`components.css`** .. Shared component classes (BEM-lite naming: `.section`, `.card`, `.btn-gradient`, `.search-bar*`, etc.)
3. **Scoped styles** .. Astro `<style>` blocks for component-specific rules; CSS Modules (`.module.css`) for React islands

**NO Tailwind CSS.** All styling uses plain CSS with CSS custom properties.

### Golden Rules

1. **NEVER hardcode colors, spacing, shadows, or radii.** Use CSS custom properties from `global.css` (e.g., `var(--accent)`, `var(--space-6)`)
2. **ALWAYS use uniform border-radius on cards/images.** Use `var(--radius-card)` (or `var(--radius-md)` for compact surfaces). Do NOT use `--radius-organic*` — it's deprecated.
3. **ALWAYS use semantic token names** (`var(--brand-primary)`, `var(--core-muted-foreground)`), never raw color values
4. **ALWAYS alternate section backgrounds** between `var(--core-background)` and `var(--surface-warm)`
5. **Dark mode must work automatically.** If you use tokens, it does. If you hardcode, it breaks
6. **Astro components**: Use scoped `<style>` with BEM-lite class names
7. **React islands**: Use CSS Modules (`.module.css`) co-located with the component

### Quick Token Reference

```css
/* Colors (use as var(--token-name)) */
/* IMPORTANT: prefixes are deliberate. Aliases like `--primary`, `--accent`,
 * `--background` etc. DO NOT exist — using them resolves to the CSS initial
 * value (transparent / inherited) and silently breaks dark mode. The full
 * list lives in `src/styles/global.css`. */
--core-background          /* Page background */
--core-foreground          /* Primary text */
--core-card                /* Card surfaces */
--core-muted-foreground    /* Secondary text */
--surface-warm             /* Peach-tinted sections */
--surface-dark             /* Dark sections, footer */
--brand-primary            /* Primary brand (blue) */
--brand-accent             /* CTA buttons, highlights (orange) */
--brand-secondary          /* Secondary brand surfaces */
--brand-tertiary           /* Tertiary brand surfaces (green tint) */
--primary-foreground       /* Text on brand-primary */
--accent-foreground        /* Text on brand-accent */

/* Shapes (uniform corners only — `--radius-organic*` is DEPRECATED, do not use) */
--radius-card          /* 24px - card outer container */
--radius-md            /* ~10px - smaller surfaces, inputs, sidebar items */
--radius-button        /* 8px - buttons */
--radius-pill          /* 9999px - badges, tags */

/* Spacing */
--space-section        /* 120px - standard section padding */
--space-card-gap       /* 30px - gap between cards */
--container-max        /* 1350px - main container */

/* Shadows */
--shadow-card          /* Default card elevation */
--shadow-card-hover    /* Hovered card elevation */
--shadow-search        /* Search form shadow */

/* Transitions */
--duration-normal      /* 0.4s - most hover effects */
--duration-slow        /* 0.5s - buttons */
--duration-reveal      /* 1.5s - scroll reveal */
```

### Fonts

| CSS custom property | Font | Usage |
|---------------------|------|-------|
| `var(--font-heading)` | Geologica | Section titles, card titles, hero |
| `var(--font-sans)` | Roboto | Body text, meta, UI elements |
| `var(--font-decorative)` | Caveat | Section taglines (handwritten accent) |

### CSS Modules for React Islands

React islands use CSS Modules for scoped styling:

```tsx
import styles from './MyComponent.module.css';
import { cn } from '@/lib/cn';

export function MyComponent({ className }: Props) {
  return <div className={cn(styles.root, className)}>...</div>;
}
```

- File naming: `ComponentName.module.css` co-located with the `.tsx` file
- Use camelCase class names in modules (e.g., `.cardTitle`, `.navButton`)
- Use CSS custom properties for ALL values
- Use `cn()` (from `@/lib/cn`) for conditional class joining

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

### Typed locals (`App.Locals`) — SPEC-218

`Astro.locals.locale` / `.user` / `.cspNonce` are typed by the `App.Locals`
augmentation in `src/env.d.ts`. That file MUST stay listed under `"files"` in
`apps/web/tsconfig.json` — TypeScript's `include` globs do NOT pull an
unreferenced ambient `.d.ts` into the program, so without the `files` entry the
augmentation silently stops loading and ~117 `Property '…' does not exist on
type 'Locals'` errors reappear. `src/types/app-locals.guard.ts` is a compile-time
guard that fails the typecheck if this regresses.

### `.astro` is typechecked in CI

`pnpm typecheck` runs `astro check`, which (unlike `tsc`) typechecks `.astro`
frontmatter. Wrong response shapes read in page logic (e.g. `result.data.total`
when the count lives at `result.data.pagination.total`) now fail the build
instead of shipping. Keep frontmatter type-clean; do not silence `astro check`
errors with `any` or `@ts-ignore`.

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
 * @description Card displaying accommodation summary with image and details.
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

<article class="card accommodation-card">
  <div class="accommodation-card__image-wrapper">
    <img
      src={image}
      alt={title}
      class="accommodation-card__img"
      loading="lazy"
    />
  </div>
  <div class="accommodation-card__content">
    <h3 class="accommodation-card__title">{title}</h3>
    <span class="accommodation-card__price">{price}</span>
  </div>
</article>

<style>
  .accommodation-card__image-wrapper {
    border-radius: var(--radius-card);
    overflow: hidden;
  }
  .accommodation-card__img {
    width: 100%;
    object-fit: cover;
    transition: transform var(--duration-normal) ease-in-out;
  }
  .accommodation-card:hover .accommodation-card__img {
    transform: scale(1.1);
  }
  .accommodation-card__content {
    background-color: var(--card);
    border-radius: var(--radius-card);
    padding: var(--space-5);
  }
  .accommodation-card__title {
    font-family: var(--font-heading);
    font-weight: 600;
    color: var(--foreground);
  }
  .accommodation-card__price {
    color: var(--accent);
    font-weight: 500;
  }
</style>
```

**Rules:**

- Props interface named `Props`, all props `readonly`
- BEM-lite class names (`.block__element--modifier`)
- Scoped `<style>` blocks for component-specific CSS
- CSS custom properties for ALL values (colors, spacing, fonts, etc.)
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

Use `src/lib/colors.ts` for mapping categories, types, and tags to CSS values (applied via inline `style`):

```ts
import { getEventCategoryColor, getAccommodationTypeColor } from '@/lib/colors';

const categoryColors = getEventCategoryColor('cultural');
// { bg: 'oklch(from var(--brand-accent) l c h / 0.15)', text: 'var(--brand-accent)', border: 'oklch(from var(--brand-accent) l c h / 0.30)' }

const typeColors = getAccommodationTypeColor('hotel');
// { bg: 'oklch(from var(--brand-primary) l c h / 0.15)', text: 'var(--brand-primary)', border: 'oklch(from var(--brand-primary) l c h / 0.30)' }
```

Apply via inline style: `style={\`background-color: ${colors.bg}; color: ${colors.text};\`}`

All color values MUST reference semantic CSS custom properties, never hardcoded values.

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
    canonical={new URL(Astro.url.pathname, Astro.site).href}
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

Elements animate into view using IntersectionObserver with the `data-reveal` attribute system:

```astro
<div data-reveal="up">This fades in from below</div>
<div data-reveal="left">This slides in from the left</div>
<div data-reveal="right">This slides in from the right</div>
<div data-reveal="scale">This fades in with scale</div>
```

The `data-reveal` system is initialized in `BaseLayout.astro` via `initScrollReveal()` from `src/lib/scroll-reveal.ts`. It uses IntersectionObserver to add a `.revealed` class when elements enter the viewport. CSS transitions in `components.css` handle the animation.

### Stagger Pattern

Repeated elements (cards in a grid) use incremental `transition-delay`:

```astro
{items.map((item, i) => (
  <div data-reveal="up" style={`transition-delay: ${i * 100}ms`}>
    <Card {...item} />
  </div>
))}
```

Max stagger: 700ms (7 visible items). All animations respect `prefers-reduced-motion`.

### View Transitions

Use Astro View Transitions for smooth page navigation:

```astro
---
import { ClientRouter } from 'astro:transitions';
---
<head>
  <ClientRouter />
</head>

<!-- Named transition for morphing between list and detail -->
<img transition:name={`accommodation-${slug}`} src={image} alt={name} />
```

## Sections

### Section Template

All content sections follow this structure:

```astro
<section class="section section--warm">
  <!-- Decoratives (hidden on mobile) -->
  <div class="section__decorative" aria-hidden="true">
    <img src="/images/decoratives/deco-compass.svg" alt="" />
  </div>

  <!-- Content -->
  <div class="section__container">
    <SectionHeader
      tagline={t('section.tagline')}
      title={t('section.title')}
      subtitle={t('section.subtitle')}
    />

    <div class="my-section__grid">
      {items.map((item, i) => (
        <div data-reveal="up" style={`transition-delay: ${i * 100}ms`}>
          <Card {...item} />
        </div>
      ))}
    </div>
  </div>
</section>

<style>
  .my-section__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-card-gap);
  }
  @media (min-width: 768px) {
    .my-section__grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
```

### Section Background Alternation

Adjacent sections MUST alternate backgrounds using the shared classes from `components.css`:

```
.section (default bg) → .section--warm → .section (default) → .section--warm
```

Never place two same-background sections back-to-back.

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
  resolve(__dirname, '../../../src/components/shared/layout/SectionHeader.astro'),
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

## Deployment (Coolify)

This app runs as two Coolify resources on the self-hosted VPS:

- `hospeda-web-prod` — production. Currently serves `apps/landing/` (coming-soon Astro static) at `https://hospeda.com.ar` + `www.hospeda.com.ar`. At public launch the resource will be reconfigured to build this `apps/web/` Astro Node app (tracked as SPEC-103 T-087).
- `hospeda-web-staging` — staging, served at `https://staging.hospeda.com.ar`. Serves this `apps/web/` Astro Node app today with `noindex` via Traefik labels + dynamic `robots.txt`.

The operational toolkit (`scripts/server-tools/`, command `hops`) is target-aware via `--target=prod|staging` (defaults to prod). See [docs/migration/staging-prod-db-separation.md](../../docs/migration/staging-prod-db-separation.md) for the full split rationale.

## Environment Variables

Validated at startup by `src/lib/env.ts` (Zod schema). If a required variable is missing, the app fails fast with a clear error message.

```bash
# Server-side (HOSPEDA_ prefix.. not exposed to browser)
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:1
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# Client-side (PUBLIC_ prefix.. exposed to browser by Astro)
PUBLIC_API_URL=http://localhost:3001
PUBLIC_SITE_URL=http://localhost:4321
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

## Reusable Patterns

### FavoriteButton

Shared React island at `src/components/shared/favorite/FavoriteButton.client.tsx`. Used in: AccommodationCard, EventCard, ArticleCard, DestinationCard, LocationMap popup, and detail headers. Exposes `entityType` + `entityId` props for polymorphic use. Includes guest popover and optimistic toggle UX.

### MoveToCollectionModal

React island at `src/components/account/MoveToCollectionModal.client.tsx`. Wired into `UserFavoritesList.client.tsx` (favorites page) via a per-card "Mover" button. Controlled modal: parent owns `bookmarkToMove` state, pre-selects the bookmark's current collection, and exposes a radio list of the user's collections plus a "Sin colección" option. On confirm it calls `userBookmarkCollectionsApi.addBookmark` / `removeBookmark` and emits `onSaved({ newCollectionId, newCollectionName })` so the parent can update local state + show a success toast. Test selectors: `data-testid="move-bookmark-button-{bookmarkId}"`, `move-bookmark-modal`, `move-bookmark-collection-option-{id|uncollected}`, `move-bookmark-confirm`.

### CollectionDetailActions

React island at `src/components/account/CollectionDetailActions.client.tsx`. Mounted with `client:load` from `pages/[lang]/mi-cuenta/favoritos/colecciones/[id].astro` to power the Edit + Delete buttons in the collection detail header. Edit reuses `CreateEditCollectionModal` in EDIT mode and reloads the page on save so the header reflects the new name/color/icon. Delete uses `window.confirm()` (MVP) and calls `userBookmarkCollectionsApi.delete`; on success it shows a success toast and redirects to `/{lang}/mi-cuenta/favoritos/`. Test selectors: `data-testid="collection-actions-edit"`, `collection-actions-delete`.

## Common Gotchas

- **Locale param**: Access via `Astro.locals.locale` (validated by middleware), not `Astro.params.lang`
- **Trailing slashes**: Enforced by Astro config. Use `buildUrl()` from `src/lib/urls.ts` for all internal links
- **No hardcoded colors**: Use tokens. `bg-primary`, not `bg-blue-600`
- **No hardcoded strings**: Use `t()`. Even if only `es` is ready, all strings must go through i18n
- **No console.log**: Use `src/lib/logger.ts` which wraps `@repo/logger`
- **No default exports**: All `.ts` and `.tsx` files use named exports only
- **No raw API data in components**: Always go through `transforms.ts`
- **Uniform radius**: Cards and images use `var(--radius-card)`. Do NOT use `--radius-organic*` (deprecated)
- **Auth in islands**: Pass `Astro.locals.user` as props. Islands cannot read server locals
- **Image optimization**: `<Image>` from `astro:assets` for local images; `<img loading="lazy">` for remote

## Accepted production-build warnings (`pnpm build`)

`pnpm build` (Astro + Vite/Rolldown) completes successfully (exit 0). It emits a
set of warnings that were reviewed under BETA-78 and accepted — they are **not
defects**. All of them are upstream artifacts of the Vite→Rolldown / Astro
transition (none come from our own `astro.config.mjs`), so there is nothing to
fix on our side:

- `esbuild option deprecated, use oxc instead` (`vite:react-babel`) and the
  `@vitejs/plugin-react` → `@vitejs/plugin-react-oxc` recommendation. Upstream;
  out of scope (same call as the admin app — see `apps/admin/CLAUDE.md`).
- `optimizeDeps.rollupOptions` / `optimizeDeps.esbuildOptions` deprecation hints
  (the latter set by the `astro:dev-toolbar` plugin) → suggest `rolldownOptions`.
  Upstream / set by Astro's own plugins.
- ``resolve.alias` contains an alias with `customResolver` (deprecated, removed in
  Vite 9)``. **Not ours** — `customResolver` does not appear anywhere in the repo;
  it is injected by an Astro integration. Out of scope until Astro updates it.
- `transformWithEsbuild is deprecated, migrate to transformWithOxc`. Upstream.
- `(!) Some chunks are larger than 500 kB` — currently two client chunks exceed
  the limit (~1 MB and ~770 kB; Astro does not list which in the log). This is a
  **runtime load-performance** concern only — it does NOT affect test time
  (Vitest never bundles) and only marginally affects build time. Far less severe
  than the admin's 4 MB chunk (BETA-86); the web already code-splits by island
  (SPEC-176). Accepted for now; revisit if a perf pass is prioritized.

## lib/ File Origins

Files in `src/lib/` come from the previous web app iteration with varying levels of adaptation:

### Copied as-is (no changes needed)

`api/client.ts`, `api/types.ts`, `api/index.ts`, `cn.ts`, `format-utils.ts`, `media.ts`, `page-helpers.ts`, `urls.ts`, `validation/`, `store/toast-store.ts`, `sanitize-html.ts`, `tiptap-renderer.ts`

### Copied + adapted

- `env.ts` - Same schema, app-specific error messages
- `logger.ts` - Same prefix `[HOSPEDA-WEB]`
- `i18n.ts` - Verify namespace imports match `@repo/i18n`
- `colors.ts` - Expanded from `category-colors.ts` to include accommodation types, post categories, event categories, tags
- `pricing-fallbacks.ts` - Updated plan data
- `pricing-plans.ts` - Adjusted field mapping if billing API structure changes
- `auth-client.ts` - Unified error types to use `ApiResult<T>` instead of custom `AuthApiResult`

### Rewritten for this app

- `api/endpoints.ts` - New endpoints matching page structure
- `api/endpoints-protected.ts` - New protected endpoints
- `api/transforms.ts` - New transforms matching component props
- `middleware.ts` - Updated routes, CSP, using route constants
- `middleware-helpers.ts` - Uses `routes.ts` constants, no duplicated `getApiUrl()`
- `routes.ts` - NEW file: centralized route segment constants

### Key improvements over previous iteration

1. **No duplicated `getApiUrl()`** - Lives only in `env.ts`, imported everywhere
2. **Unified error types** - `ApiResult<T>` everywhere, no `AuthApiResult`
3. **Route constants** - Protected/auth paths in `routes.ts`, not hardcoded in middleware
4. **`colors.ts` instead of `category-colors.ts`** - Single file for ALL entity color mappings

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `astro` | Core framework |
| `@astrojs/react` | React island integration |
| `@astrojs/node` | SSR adapter (standalone, long-running Node server) |
| `clsx` | Conditional CSS class joining |
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
