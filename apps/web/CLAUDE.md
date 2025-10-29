# CLAUDE.md - Web Application

This file provides guidance for working with the Hospeda Web application (`apps/web`).

## Overview

Astro-based frontend application with React components for the Hospeda tourism platform. Features SSR/SSG, i18n support, Clerk authentication, and Tailwind CSS styling.

## Key Commands

```bash
# Development
pnpm dev                # Start dev server (port 4321)

# Build & Preview
pnpm build              # Production build
pnpm build:preview      # Build for preview
pnpm preview            # Preview production build

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:ui           # Interactive UI

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code

# Utilities
pnpm gen:translations-keys  # Generate i18n keys
pnpm analyze               # Analyze bundle size
```

## Project Structure

```
src/
├── pages/              # Astro pages (file-based routing)
│   ├── index.astro         # Home page
│   ├── alojamientos/       # Accommodations pages
│   ├── destinos/           # Destinations pages
│   ├── eventos/            # Events pages
│   ├── publicaciones/      # Posts/news pages
│   ├── auth/               # Authentication pages
│   └── api/                # API endpoints (SSR)
├── components/         # React & Astro components
│   ├── accommodation/
│   ├── destination/
│   ├── event/
│   ├── ui/                 # Reusable UI components
│   └── forms/              # Form components
├── layout/             # Layout components
│   ├── MainLayout.astro
│   ├── Header.astro
│   └── Footer.astro
├── styles/             # Global styles
├── lib/                # Utility libraries
├── hooks/              # React hooks
├── store/              # Nanostores state management
├── i18n/               # Internationalization
├── contexts/           # React contexts
├── middlewares/        # Astro middleware
└── server/             # Server utilities
```

## Routing

Astro uses file-based routing:

```
pages/
├── index.astro                    → /
├── alojamientos/
│   ├── [slug].astro              → /alojamientos/:slug
│   └── page/
│       └── [page].astro          → /alojamientos/page/:page
├── destinos/
│   └── [slug].astro              → /destinos/:slug
└── api/
    └── accommodations.ts         → /api/accommodations (endpoint)
```

### Dynamic Routes

```astro
---
// pages/alojamientos/[slug].astro
import { getAccommodationBySlug } from '@repo/service-core';

export async function getStaticPaths() {
  const accommodations = await getAllAccommodations();

  return accommodations.map(acc => ({
    params: { slug: acc.slug },
    props: { accommodation: acc }
  }));
}

const { accommodation } = Astro.props;
const { slug } = Astro.params;
---

<MainLayout>
  <h1>{accommodation.name}</h1>
</MainLayout>
```

## Component Patterns

### Astro Components

```astro
---
// src/components/AccommodationCard.astro
import type { Accommodation } from '@repo/types';

interface Props {
  accommodation: Accommodation;
  featured?: boolean;
}

const { accommodation, featured = false } = Astro.props;
---

<article class="accommodation-card" data-featured={featured}>
  <img src={accommodation.imageUrl} alt={accommodation.name} />
  <h3>{accommodation.name}</h3>
  <p>{accommodation.description}</p>
</article>

<style>
  .accommodation-card {
    @apply rounded-lg shadow-md p-4;
  }

  [data-featured="true"] {
    @apply ring-2 ring-primary;
  }
</style>
```

### React Components (with Island Architecture)

```tsx
// src/components/SearchForm.tsx
import { useState } from 'react';
import type { SearchFilters } from '@repo/types';

interface SearchFormProps {
  initialFilters?: SearchFilters;
  onSearch: (filters: SearchFilters) => void;
}

export function SearchForm({ initialFilters, onSearch }: SearchFormProps) {
  const [filters, setFilters] = useState(initialFilters ?? {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

Use in Astro with `client:*` directive:

```astro
---
import { SearchForm } from '../components/SearchForm';
---

<SearchForm
  client:load
  onSearch={(filters) => console.log(filters)}
/>
```

### Client Directives

- `client:load` - Hydrate immediately on page load
- `client:idle` - Hydrate when browser is idle
- `client:visible` - Hydrate when component is visible
- `client:media="{query}"` - Hydrate on media query match
- `client:only="{framework}"` - No SSR, client-side only

## State Management (Nanostores)

```ts
// src/store/search.ts
import { atom, map } from 'nanostores';
import type { SearchFilters } from '@repo/types';

export const searchFilters = map<SearchFilters>({
  query: '',
  destination: null,
  priceRange: null
});

export const isSearching = atom(false);

// Actions
export function updateSearchFilters(filters: Partial<SearchFilters>) {
  searchFilters.set({ ...searchFilters.get(), ...filters });
}

export function clearSearchFilters() {
  searchFilters.set({ query: '', destination: null, priceRange: null });
}
```

Use in React:

```tsx
import { useStore } from '@nanostores/react';
import { searchFilters, updateSearchFilters } from '../store/search';

export function SearchComponent() {
  const filters = useStore(searchFilters);

  return (
    <button onClick={() => updateSearchFilters({ query: 'hotel' })}>
      Search Hotels
    </button>
  );
}
```

Use in Astro:

```astro
---
import { searchFilters } from '../store/search';
const filters = searchFilters.get();
---

<div>{filters.query}</div>

<script>
  import { searchFilters } from '../store/search';

  searchFilters.subscribe(filters => {
    console.log('Filters changed:', filters);
  });
</script>
```

## Internationalization (i18n)

```ts
// src/i18n/index.ts
import { createI18n } from '@repo/i18n';

export const { t, locale, setLocale } = createI18n({
  defaultLocale: 'es',
  locales: ['es', 'en'],
  translations: {
    es: () => import('./es.json'),
    en: () => import('./en.json')
  }
});
```

Use in Astro:

```astro
---
import { t } from '../i18n';
---

<h1>{t('home.welcome')}</h1>
<p>{t('home.description', { name: 'Hospeda' })}</p>
```

Use in React:

```tsx
import { useStore } from '@nanostores/react';
import { t, locale } from '../i18n';

export function Greeting() {
  const currentLocale = useStore(locale);

  return (
    <div>
      <h1>{t('greeting', { locale: currentLocale })}</h1>
    </div>
  );
}
```

## Authentication (Clerk)

### Server-side (in pages)

```astro
---
// pages/profile.astro
import { getAuth } from '@clerk/astro/server';

const { userId } = getAuth(Astro);

if (!userId) {
  return Astro.redirect('/auth/signin');
}

const user = await getUserById(userId);
---

<MainLayout>
  <h1>Welcome, {user.name}</h1>
</MainLayout>
```

### Client-side (React components)

```tsx
import { useUser, SignInButton, UserButton } from '@clerk/clerk-react';

export function AuthStatus() {
  const { isSignedIn, user } = useUser();

  if (!isSignedIn) {
    return <SignInButton />;
  }

  return (
    <div>
      <span>Hello, {user.firstName}</span>
      <UserButton />
    </div>
  );
}
```

## API Routes (Endpoints)

```ts
// pages/api/accommodations.ts
import type { APIRoute } from 'astro';
import { AccommodationService } from '@repo/service-core';

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;

  const service = new AccommodationService({ userId: locals.userId });
  const result = await service.findAll({ page, pageSize: 10 });

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json();

  const service = new AccommodationService({ userId: locals.userId });
  const result = await service.create(body);

  return new Response(JSON.stringify(result), {
    status: result.success ? 201 : 400,
    headers: { 'Content-Type': 'application/json' }
  });
};
```

## Middleware

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { clerkMiddleware } from '@clerk/astro/server';

export const onRequest = defineMiddleware(async (context, next) => {
  // Apply Clerk auth
  await clerkMiddleware()(context, next);

  // Custom logic
  console.log(`Request to: ${context.url.pathname}`);

  return next();
});
```

## Styling with Tailwind

### In Astro Components

```astro
<div class="container mx-auto px-4">
  <h1 class="text-4xl font-bold text-primary">Title</h1>
  <p class="mt-4 text-gray-600">Description</p>
</div>

<style>
  /* Scoped styles with @apply */
  .custom-class {
    @apply flex items-center gap-4;
  }
</style>
```

### Custom Tailwind Config

Extends from `@repo/tailwind-config`:

```js
// tailwind.config.mjs
import baseConfig from '@repo/tailwind-config';

export default {
  ...baseConfig,
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      ...baseConfig.theme.extend,
      // App-specific customizations
    }
  }
};
```

## Data Fetching

### Static (Build Time)

```astro
---
// Runs at build time
const accommodations = await getAllAccommodations();
---

<ul>
  {accommodations.map(acc => (
    <li>{acc.name}</li>
  ))}
</ul>
```

### Server-side (Request Time)

```astro
---
export const prerender = false; // Enable SSR for this page

const { slug } = Astro.params;
const accommodation = await getAccommodationBySlug(slug);
---

<div>{accommodation.name}</div>
```

### Client-side (Hydration)

```tsx
import { useEffect, useState } from 'react';

export function AccommodationList() {
  const [accommodations, setAccommodations] = useState([]);

  useEffect(() => {
    fetch('/api/accommodations')
      .then(res => res.json())
      .then(data => setAccommodations(data));
  }, []);

  return (
    <ul>
      {accommodations.map(acc => (
        <li key={acc.id}>{acc.name}</li>
      ))}
    </ul>
  );
}
```

## Environment Variables

```env
# Public variables (exposed to client)
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_API_URL=http://localhost:3001

# Server-only variables
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...

# Clerk (public keys are safe to expose)
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
```

Access in code:

```ts
// Server-side (all vars)
import.meta.env.DATABASE_URL

// Client-side (only PUBLIC_ vars)
import.meta.env.PUBLIC_SITE_URL
```

## Testing

### Component Testing

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  it('should render accommodation name', () => {
    const mockAccommodation = {
      id: '1',
      name: 'Hotel Test',
      slug: 'hotel-test'
    };

    render(<AccommodationCard accommodation={mockAccommodation} />);

    expect(screen.getByText('Hotel Test')).toBeInTheDocument();
  });
});
```

## SEO & Meta Tags

```astro
---
import { ViewTransitions } from 'astro:transitions';

const { title, description, image } = Astro.props;
---

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | Hospeda</title>
  <meta name="description" content={description} />

  <!-- Open Graph -->
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />

  <!-- View Transitions -->
  <ViewTransitions />
</head>
```

## Performance Optimization

1. **Use static generation** when possible (`export const prerender = true`)
2. **Lazy load images**: Use Astro's `<Image>` component
3. **Defer non-critical JS**: Use `client:idle` or `client:visible`
4. **Minimize client JS**: Keep React islands small
5. **Code split**: Dynamic imports for large components
6. **Optimize images**: Use modern formats (WebP, AVIF)

## Key Dependencies

- `astro` - Framework
- `@astrojs/react` - React integration
- `@clerk/astro` - Authentication
- `@repo/i18n` - Internationalization
- `@repo/service-core` - Business logic
- `@repo/icons` - Icon components
- `nanostores` - State management
- `tailwindcss` - Styling

## Best Practices

1. **Use Astro components by default** - only use React when needed (interactivity)
2. **Minimize client-side JavaScript** - leverage SSR/SSG
3. **Use `client:*` directives wisely** - defer hydration when possible
4. **Import types correctly**: `import type { ... }`
5. **Validate props with Zod** when accepting user input
6. **Use semantic HTML** and proper heading hierarchy
7. **Optimize images** - use Astro's `<Image>` component
8. **Test accessibility** - use semantic elements and ARIA
9. **Keep components small** - single responsibility
10. **Use i18n for all user-facing text** - no hardcoded strings
