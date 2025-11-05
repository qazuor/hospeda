# Pages & Routing

Complete guide to Astro's file-based routing system.

---

## 📖 Overview

Astro uses **file-based routing** where the file structure in `src/pages/` directly maps to URLs.

**Key Concept**: File location = URL path

---

## 🗂️ File-Based Routing Basics

### Simple Mapping

```text
src/pages/index.astro          →  /
src/pages/about.astro          →  /about
src/pages/events.astro         →  /events
src/pages/events/past.astro    →  /events/past
```

### Folder Structure

```text
src/pages/
├── index.astro                # /
├── about.astro                # /about
├── alojamientos/
│   ├── index.astro            # /alojamientos
│   ├── [slug].astro           # /alojamientos/:slug (dynamic)
│   └── page/
│       └── [page].astro       # /alojamientos/page/:page
├── destinos/
│   ├── index.astro            # /destinos
│   └── [slug].astro           # /destinos/:slug
├── eventos/
│   ├── index.astro            # /eventos
│   └── [slug].astro           # /eventos/:slug
├── publicaciones/
│   ├── index.astro            # /publicaciones
│   └── [slug].astro           # /publicaciones/:slug
└── 404.astro                  # Not found page
```

---

## 📄 Static Pages

### Creating a Static Page

**File**: `src/pages/about.astro`

```astro
---
import MainLayout from '../layouts/MainLayout.astro';
---

<MainLayout title="About Hospeda">
  <h1>About Us</h1>
  <p>Welcome to Hospeda platform...</p>
</MainLayout>
```

**Result**: Available at `/about`

### With Data Fetching

```astro
---
import MainLayout from '../layouts/MainLayout.astro';

// Runs at BUILD TIME
const team = await fetch('https://api.example.com/team').then(r => r.json());
---

<MainLayout title="Our Team">
  <h1>Meet the Team</h1>
  {team.map(member => (
    <div>
      <h2>{member.name}</h2>
      <p>{member.role}</p>
    </div>
  ))}
</MainLayout>
```

---

## 🔀 Dynamic Routes

### Single Parameter

**File**: `src/pages/alojamientos/[slug].astro`

```astro
---
import type { GetStaticPaths } from 'astro';
import { getAccommodationBySlug, getAllAccommodations } from '@repo/service-core';
import MainLayout from '../../layouts/MainLayout.astro';

// Generate static paths at build time
export const getStaticPaths = (async () => {
  const accommodations = await getAllAccommodations();

  return accommodations.map(acc => ({
    params: { slug: acc.slug },
    props: { accommodation: acc }
  }));
}) satisfies GetStaticPaths;

// Access the param and props
const { slug } = Astro.params;
const { accommodation } = Astro.props;
---

<MainLayout title={accommodation.name}>
  <h1>{accommodation.name}</h1>
  <p>{accommodation.description}</p>
  <p>Price: ${accommodation.pricePerNight}/night</p>
</MainLayout>
```

**URLs Generated**:

- `/alojamientos/hotel-colonial`
- `/alojamientos/cabana-rio`
- `/alojamientos/hostel-centro`

### Multiple Parameters

**File**: `src/pages/blog/[category]/[slug].astro`

```astro
---
import type { GetStaticPaths } from 'astro';

export const getStaticPaths = (async () => {
  const posts = await getAllPosts();

  return posts.map(post => ({
    params: {
      category: post.category,
      slug: post.slug
    },
    props: { post }
  }));
}) satisfies GetStaticPaths;

const { category, slug } = Astro.params;
const { post } = Astro.props;
---

<h1>{post.title}</h1>
<p>Category: {category}</p>
```

**URLs Generated**:

- `/blog/travel-tips/packing-guide`
- `/blog/local-news/new-hotel-opening`

### Rest Parameters

**File**: `src/pages/docs/[...path].astro`

Matches **any depth** of nested paths:

```astro
---
export const getStaticPaths = (async () => {
  return [
    { params: { path: 'getting-started' } },
    { params: { path: 'guides/authentication' } },
    { params: { path: 'api/reference/users' } }
  ];
}) satisfies GetStaticPaths;

const { path } = Astro.params;
// path could be: "getting-started", "guides/authentication", etc.
---
```

**URLs Generated**:

- `/docs/getting-started`
- `/docs/guides/authentication`
- `/docs/api/reference/users`

---

## ⚙️ Rendering Modes

### Static Site Generation (SSG) - Default

Pages pre-rendered at **build time**:

```astro
---
// No config needed - this is default
const data = await fetchDataAtBuildTime();
---

<div>{data.content}</div>
```

**Best for**:

- Content that doesn't change often
- Public pages
- SEO-critical pages
- High-traffic pages

**Pros**: Fast, cacheable, great SEO
**Cons**: Requires rebuild for updates

### Server-Side Rendering (SSR)

Pages rendered on **each request**:

```astro
---
// Enable SSR for this page
export const prerender = false;

const { slug } = Astro.params;
const data = await fetchDataOnRequest(slug);
---

<div>{data.content}</div>
```

**Best for**:

- User-specific content
- Real-time data
- Content that changes frequently
- Authentication-required pages

**Pros**: Always fresh data
**Cons**: Slower, requires server

### Hybrid Mode

Mix SSG and SSR in same project:

```typescript
// astro.config.mjs
export default defineConfig({
  output: 'hybrid', // Default to static, opt-in to SSR
});
```

Then opt pages into SSR:

```astro
---
export const prerender = false; // This page uses SSR
---
```

---

## 🔗 Accessing Route Data

### Route Parameters

```astro
---
// src/pages/events/[id].astro
const { id } = Astro.params;
console.log(id); // "123" from /events/123
---
```

### Query Parameters

```astro
---
// URL: /search?q=hotel&location=centro
const url = new URL(Astro.request.url);
const query = url.searchParams.get('q'); // "hotel"
const location = url.searchParams.get('location'); // "centro"
---

<h1>Searching for: {query}</h1>
<p>In location: {location}</p>
```

### Request Headers

```astro
---
const userAgent = Astro.request.headers.get('user-agent');
const acceptLanguage = Astro.request.headers.get('accept-language');
---
```

### Cookies

```astro
---
// Read cookie
const sessionId = Astro.cookies.get('sessionId');

// Set cookie
Astro.cookies.set('theme', 'dark', {
  path: '/',
  maxAge: 60 * 60 * 24 * 365 // 1 year
});
---
```

---

## 🌐 API Routes (Endpoints)

### Creating an Endpoint

**File**: `src/pages/api/accommodations.ts`

```typescript
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
```

**URL**: `/api/accommodations?page=1`

### HTTP Methods

```typescript
// src/pages/api/events.ts
import type { APIRoute } from 'astro';

// GET /api/events
export const GET: APIRoute = async ({ request }) => {
  const events = await getAllEvents();
  return new Response(JSON.stringify(events));
};

// POST /api/events
export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  const event = await createEvent(data);
  return new Response(JSON.stringify(event), { status: 201 });
};

// PUT /api/events
export const PUT: APIRoute = async ({ request }) => {
  const data = await request.json();
  const event = await updateEvent(data);
  return new Response(JSON.stringify(event));
};

// DELETE /api/events
export const DELETE: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  await deleteEvent(id);
  return new Response(null, { status: 204 });
};
```

### Dynamic API Routes

**File**: `src/pages/api/accommodations/[id].ts`

```typescript
import type { APIRoute } from 'astro';
import { AccommodationService } from '@repo/service-core';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  const service = new AccommodationService({ userId: locals.userId });
  const result = await service.findById(id);

  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(result.data), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

**URLs**:

- `GET /api/accommodations/123`
- `GET /api/accommodations/456`

---

## 🔒 Authentication & Redirects

### Protected Pages

```astro
---
import { getAuth } from '@clerk/astro/server';

const { userId } = getAuth(Astro);

if (!userId) {
  return Astro.redirect('/auth/signin');
}

const user = await getUserById(userId);
---

<h1>Welcome, {user.name}</h1>
```

### Conditional Redirects

```astro
---
const { slug } = Astro.params;
const accommodation = await getAccommodationBySlug(slug);

if (!accommodation) {
  return Astro.redirect('/404');
}

if (accommodation.status === 'draft') {
  return Astro.redirect('/');
}
---

<h1>{accommodation.name}</h1>
```

### Redirect with Status Code

```astro
---
// Permanent redirect (301)
return Astro.redirect('/new-url', 301);

// Temporary redirect (302) - default
return Astro.redirect('/new-url');

// See Other (303)
return Astro.redirect('/success', 303);
---
```

---

## 🎣 Middleware

### Global Middleware

**File**: `src/middleware.ts`

```typescript
import { defineMiddleware } from 'astro:middleware';
import { clerkMiddleware } from '@clerk/astro/server';

export const onRequest = defineMiddleware(async (context, next) => {
  // Apply Clerk auth
  await clerkMiddleware()(context, next);

  // Log requests
  console.log(`${context.request.method} ${context.url.pathname}`);

  // Add custom data to locals
  context.locals.requestTime = Date.now();

  // Continue to page
  const response = await next();

  // Log response time
  const elapsed = Date.now() - context.locals.requestTime;
  console.log(`Request took ${elapsed}ms`);

  return response;
});
```

### Middleware Sequence

```typescript
export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Before page renders
  console.log('Before');

  // 2. Render page
  const response = await next();

  // 3. After page renders
  console.log('After');

  return response;
});
```

### Conditional Middleware

```typescript
export const onRequest = defineMiddleware(async (context, next) => {
  // Only for API routes
  if (context.url.pathname.startsWith('/api/')) {
    // Add CORS headers
    const response = await next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }

  return next();
});
```

---

## 📐 Layouts

### Basic Layout

**File**: `src/layouts/MainLayout.astro`

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
---

<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title} | Hospeda</title>
    {description && <meta name="description" content={description} />}
  </head>
  <body>
    <header>
      <nav><!-- Navigation --></nav>
    </header>

    <main>
      <slot /> <!-- Page content goes here -->
    </main>

    <footer>
      <!-- Footer content -->
    </footer>
  </body>
</html>
```

### Using Layout

```astro
---
import MainLayout from '../layouts/MainLayout.astro';
---

<MainLayout title="About" description="About Hospeda platform">
  <h1>About Us</h1>
  <p>Content here...</p>
</MainLayout>
```

### Named Slots

```astro
---
// Layout with named slots
---

<div class="page">
  <aside>
    <slot name="sidebar" /> <!-- Named slot -->
  </aside>

  <main>
    <slot /> <!-- Default slot -->
  </main>
</div>
```

```astro
---
// Using named slots
---

<MyLayout>
  <div slot="sidebar">
    <h3>Sidebar content</h3>
  </div>

  <div>
    Main content
  </div>
</MyLayout>
```

---

## ⚡ Performance Patterns

### Pagination

```astro
---
// src/pages/alojamientos/page/[page].astro
import type { GetStaticPaths } from 'astro';

export const getStaticPaths = (async ({ paginate }) => {
  const accommodations = await getAllAccommodations();

  return paginate(accommodations, {
    pageSize: 12 // Items per page
  });
}) satisfies GetStaticPaths;

const { page } = Astro.props;
---

<div class="grid">
  {page.data.map(acc => (
    <AccommodationCard accommodation={acc} />
  ))}
</div>

<!-- Pagination controls -->
<nav>
  {page.url.prev && <a href={page.url.prev}>Previous</a>}
  <span>Page {page.currentPage} of {page.lastPage}</span>
  {page.url.next && <a href={page.url.next}>Next</a>}
</nav>
```

### Incremental Static Regeneration (ISR)

For pages that need periodic updates:

```astro
---
export const prerender = true;

// Revalidate every 60 seconds (Vercel only)
export const config = {
  revalidate: 60
};

const events = await getUpcomingEvents();
---
```

---

## 🐛 Troubleshooting

### 404 Errors

**Problem**: Page not found

**Check**:

1. File is in `src/pages/`
2. File extension is `.astro`, `.md`, or `.ts` (for API)
3. Filename matches URL (case-sensitive)
4. No typos in folder/file names

### Build Errors

**Problem**: `getStaticPaths` not defined

```astro
---
// ❌ Wrong: Missing getStaticPaths
const { slug } = Astro.params;
---
```

```astro
---
// ✅ Correct: Add getStaticPaths
export const getStaticPaths = async () => {
  return [
    { params: { slug: 'example' } }
  ];
};

const { slug } = Astro.params;
---
```

### SSR Issues

**Problem**: Data not updating

```astro
---
// ❌ Wrong: Static generation
const data = await fetchData(); // Cached at build time
---
```

```astro
---
// ✅ Correct: Enable SSR
export const prerender = false;
const data = await fetchData(); // Fresh on each request
---
```

---

## 📖 Additional Resources

### Internal Documentation

- **[Creating Pages Tutorial](creating-pages.md)** - Step-by-step page creation
- **[Islands Architecture](islands.md)** - Component hydration
- **[Component Organization](components.md)** - Component structure

### External Resources

- **[Astro Routing](https://docs.astro.build/en/core-concepts/routing/)** - Official routing docs
- **[API Routes](https://docs.astro.build/en/core-concepts/endpoints/)** - API endpoint docs
- **[Middleware](https://docs.astro.build/en/guides/middleware/)** - Middleware guide

---

⬅️ Back to [Development Guide](README.md)
