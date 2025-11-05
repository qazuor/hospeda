# Architecture Guide

Technical architecture of the Hospeda Web App.

---

## Overview

The Hospeda Web App is built with **Astro** and **React 19**, using the **Islands Architecture** pattern for optimal performance.

### Key Technologies

- **Framework**: Astro 4.x
- **UI Library**: React 19
- **Rendering**: SSR + SSG (Hybrid)
- **Styling**: Tailwind CSS
- **State**: Nanostores
- **i18n**: Custom i18n package
- **Auth**: Clerk
- **Deployment**: Vercel

---

## Architecture Patterns

### Islands Architecture

The app uses Astro's Islands Architecture, where:

1. **Static by Default**: Pages are pre-rendered as static HTML
2. **Interactive Islands**: React components add interactivity where needed
3. **Selective Hydration**: Only interactive components load JavaScript
4. **Zero JavaScript**: Non-interactive content sends zero JS to client

**Benefits**:

- Faster initial page load
- Better SEO
- Lower bandwidth usage
- Improved Core Web Vitals

### Rendering Modes

The app supports three rendering modes:

#### 1. Static Generation (SSG)

Pages are pre-rendered at build time:

```astro
---
// Default behavior - no config needed
const data = await fetchDataAtBuildTime();
---

<div>{data.content}</div>
```

**Use for**:

- Landing pages
- About pages
- Documentation
- Marketing content

#### 2. Server-Side Rendering (SSR)

Pages are rendered on each request:

```astro
---
export const prerender = false; // Enable SSR

const { slug } = Astro.params;
const data = await fetchDataOnRequest(slug);
---

<div>{data.content}</div>
```

**Use for**:

- Dynamic content
- User-specific pages
- Authentication-required pages
- Real-time data

#### 3. Hybrid Mode

Mix SSG and SSR in the same app:

```ts
// astro.config.mjs
export default defineConfig({
  output: 'hybrid', // Default to static, opt-in to SSR
});
```

---

## Component Architecture

### Astro Components

Server-rendered components with zero JavaScript by default:

```astro
---
// src/components/AccommodationCard.astro
import type { Accommodation } from '@repo/types';

interface Props {
  accommodation: Accommodation;
}

const { accommodation } = Astro.props;
---

<article class="card">
  <h3>{accommodation.name}</h3>
  <p>{accommodation.description}</p>
</article>

<style>
  .card {
    @apply rounded-lg shadow-md p-4;
  }
</style>
```

**Characteristics**:

- No client-side JavaScript
- Fast rendering
- SEO-friendly
- Scoped styles

### React Islands

Interactive components that hydrate on the client:

```tsx
// src/components/SearchForm.tsx
import { useState } from 'react';

export function SearchForm({ onSearch }) {
  const [query, setQuery] = useState('');

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSearch(query);
    }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit">Search</button>
    </form>
  );
}
```

Use with hydration directive:

```astro
---
import { SearchForm } from '../components/SearchForm';
---

<!-- Hydrate when page loads -->
<SearchForm client:load onSearch={handleSearch} />

<!-- Hydrate when visible -->
<SearchForm client:visible onSearch={handleSearch} />

<!-- Hydrate when idle -->
<SearchForm client:idle onSearch={handleSearch} />
```

---

## Hydration Strategies

### Client Directives

Control when and how React components load JavaScript:

#### `client:load`

Hydrate immediately on page load:

```astro
<SearchForm client:load />
```

**Use for**:

- Above-the-fold interactive content
- Critical user interactions
- Navigation components

#### `client:idle`

Hydrate when browser is idle:

```astro
<NewsletterForm client:idle />
```

**Use for**:

- Below-the-fold content
- Non-critical interactions
- Analytics components

#### `client:visible`

Hydrate when component enters viewport:

```astro
<ImageGallery client:visible />
```

**Use for**:

- Lazy-loaded content
- Image galleries
- Infinite scroll
- Charts and visualizations

#### `client:media`

Hydrate on media query match:

```astro
<MobileMenu client:media="(max-width: 768px)" />
```

**Use for**:

- Mobile-specific components
- Responsive features
- Device-specific UI

#### `client:only`

Skip server rendering, client-only:

```astro
<ClientOnlyWidget client:only="react" />
```

**Use for**:

- Components that depend on browser APIs
- Third-party widgets
- Canvas/WebGL components

---

## Routing

### File-Based Routing

Pages are created from files in `src/pages/`:

```text
src/pages/
├── index.astro                 → /
├── alojamientos/
│   ├── index.astro            → /alojamientos
│   ├── [slug].astro           → /alojamientos/:slug
│   └── page/
│       └── [page].astro       → /alojamientos/page/:page
├── destinos/
│   └── [slug].astro           → /destinos/:slug
└── 404.astro                  → Not found page
```

### Dynamic Routes

Use square brackets `[param]` for dynamic segments:

```astro
---
// src/pages/alojamientos/[slug].astro
import { getAccommodationBySlug, getAllAccommodations } from '@repo/service-core';

export async function getStaticPaths() {
  const accommodations = await getAllAccommodations();

  return accommodations.map(acc => ({
    params: { slug: acc.slug },
    props: { accommodation: acc }
  }));
}

const { slug } = Astro.params;
const { accommodation } = Astro.props;
---

<h1>{accommodation.name}</h1>
```

### API Routes

Create API endpoints in `src/pages/api/`:

```ts
// src/pages/api/accommodations.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const data = await fetchAccommodations();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
```

---

## State Management

### Nanostores

Lightweight state management library:

```ts
// src/store/search.ts
import { map, atom } from 'nanostores';

export const searchFilters = map({
  query: '',
  destination: null,
  priceRange: null
});

export const isLoading = atom(false);

// Actions
export function updateFilters(filters) {
  searchFilters.set({ ...searchFilters.get(), ...filters });
}
```

#### Use in React

```tsx
import { useStore } from '@nanostores/react';
import { searchFilters, updateFilters } from '../store/search';

export function SearchComponent() {
  const filters = useStore(searchFilters);

  return (
    <button onClick={() => updateFilters({ query: 'hotel' })}>
      Search Hotels
    </button>
  );
}
```

#### Use in Astro

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

---

## Data Flow

### Build-Time Data Fetching

Data fetched during build:

```astro
---
// Runs at build time
const accommodations = await getAllAccommodations();
---

<ul>
  {accommodations.map(acc => <li>{acc.name}</li>)}
</ul>
```

### Server-Side Data Fetching

Data fetched on each request:

```astro
---
export const prerender = false;

const { id } = Astro.params;
const accommodation = await getAccommodationById(id);
---

<div>{accommodation.name}</div>
```

### Client-Side Data Fetching

Data fetched in browser:

```tsx
import { useEffect, useState } from 'react';

export function AccommodationList() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/accommodations')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <ul>{data.map(acc => <li key={acc.id}>{acc.name}</li>)}</ul>;
}
```

---

## Styling System

### Tailwind CSS

Utility-first CSS framework:

```astro
<div class="container mx-auto px-4">
  <h1 class="text-4xl font-bold text-primary">Title</h1>
  <p class="mt-4 text-gray-600">Description</p>
</div>
```

### Scoped Styles

Component-scoped CSS with `<style>`:

```astro
<div class="custom-card">
  <h3>Title</h3>
</div>

<style>
  .custom-card {
    @apply rounded-lg shadow-md p-4;
    border: 2px solid var(--primary);
  }
</style>
```

### Global Styles

Global CSS in `src/styles/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary text-white rounded-lg;
  }
}
```

---

## Authentication Flow

### Server-Side Auth

```astro
---
import { getAuth } from '@clerk/astro/server';

const { userId } = getAuth(Astro);

if (!userId) {
  return Astro.redirect('/auth/signin');
}

const user = await getUserById(userId);
---

<div>Welcome, {user.name}</div>
```

### Client-Side Auth

```tsx
import { useUser, SignInButton, UserButton } from '@clerk/clerk-react';

export function AuthStatus() {
  const { isSignedIn, user } = useUser();

  if (!isSignedIn) return <SignInButton />;

  return <UserButton />;
}
```

---

## Internationalization

### Translation Files

```json
// src/i18n/es.json
{
  "home": {
    "welcome": "Bienvenido a Hospeda",
    "description": "Descubre alojamientos únicos"
  }
}
```

### i18n in Astro Components

```astro
---
import { t } from '../i18n';
---

<h1>{t('home.welcome')}</h1>
<p>{t('home.description')}</p>
```

### i18n in React Components

```tsx
import { useStore } from '@nanostores/react';
import { t, locale } from '../i18n';

export function Greeting() {
  const currentLocale = useStore(locale);

  return <h1>{t('home.welcome', { locale: currentLocale })}</h1>;
}
```

---

## Performance Optimization

### Image Optimization

Use Astro's Image component:

```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';
---

<Image
  src={heroImage}
  alt="Hero image"
  width={1200}
  height={600}
  format="webp"
  quality={80}
/>
```

### Code Splitting

Dynamic imports for large components:

```tsx
import { lazy } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### View Transitions

Smooth page transitions:

```astro
---
import { ViewTransitions } from 'astro:transitions';
---

<head>
  <ViewTransitions />
</head>
```

---

## Build Process

### Development

```bash
pnpm dev
# Starts dev server with HMR at port 4321
```

### Production Build

```bash
pnpm build
# 1. Runs TypeScript check
# 2. Builds all pages (SSG/SSR)
# 3. Optimizes assets
# 4. Generates static files in dist/
```

### Preview

```bash
pnpm preview
# Serves production build locally
```

---

## Deployment

The app is deployed to **Vercel** with:

- **Automatic builds** on git push
- **SSR support** for dynamic pages
- **Edge functions** for API routes
- **CDN distribution** for static assets

---

## Directory Structure

```text
src/
├── pages/              # Routes & pages
│   ├── index.astro         # Home page
│   ├── alojamientos/       # Accommodations
│   ├── destinos/           # Destinations
│   ├── eventos/            # Events
│   └── api/                # API endpoints
├── components/         # Components
│   ├── accommodation/      # Accommodation components
│   ├── ui/                 # Reusable UI
│   └── forms/              # Form components
├── layouts/            # Layout components
│   ├── MainLayout.astro    # Main layout
│   ├── Header.astro        # Header
│   └── Footer.astro        # Footer
├── styles/             # Global styles
│   └── global.css          # Global CSS
├── lib/                # Utilities
├── hooks/              # React hooks
├── store/              # Nanostores
├── i18n/               # Translations
│   ├── es.json             # Spanish
│   └── en.json             # English
└── middleware.ts       # Middleware
```

---

## Key Concepts

### SSR vs SSG vs Client

| Rendering | When | Use Case |
|-----------|------|----------|
| **SSG** | Build time | Static content, marketing pages |
| **SSR** | Request time | Dynamic content, user pages |
| **Client** | Browser | Interactive features, real-time |

### Component Types

| Type | JavaScript | Hydration | Use Case |
|------|------------|-----------|----------|
| **Astro** | None | None | Static content, layouts |
| **React Island** | Selective | On demand | Interactive features |

### Performance Priorities

1. **Minimize JavaScript** - Use Astro components by default
2. **Defer Hydration** - Use `client:idle` or `client:visible`
3. **Optimize Images** - Use Astro Image component
4. **Code Split** - Dynamic imports for large components
5. **Cache Strategically** - Static assets, API responses

---

## Best Practices

1. **Use Astro components by default** - React only when needed
2. **Choose right client directive** - Load JavaScript wisely
3. **Optimize images** - Use Astro Image component
4. **Minimize client state** - Use Nanostores sparingly
5. **Type everything** - Full TypeScript coverage
6. **Test accessibility** - Semantic HTML + ARIA
7. **Use i18n** - No hardcoded strings
8. **Monitor performance** - Track Core Web Vitals
9. **Optimize SEO** - Meta tags, structured data
10. **Follow conventions** - See project guidelines

---

⬅️ Back to [Documentation Portal](README.md)
