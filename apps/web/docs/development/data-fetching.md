# Data Fetching Guide

Complete guide to fetching data in Hospeda Web App using Astro and React.

---

## 📖 Overview

Hospeda Web App uses **multiple data fetching strategies** depending on the use case:

- **Build-time (SSG)** - Static Site Generation for mostly static content
- **Server-side (SSR)** - Server-Side Rendering for dynamic/personalized content
- **Client-side (CSR)** - Client-Side Rendering for interactive features
- **Hybrid** - Combining strategies for optimal performance

**Key Concept**: Choose the right strategy based on data freshness requirements and user experience.

---

## 🏗️ Build-Time Fetching (SSG)

### What is SSG?

Static Site Generation renders pages at **build time**. Perfect for content that doesn't change frequently.

**Benefits**:

- ⚡ Fastest performance (pre-rendered HTML)
- 💰 Lower server costs (static files)
- 🔒 Better security (no server-side processing)
- 📈 Excellent SEO

**Use cases**:

- Marketing pages
- Blog posts
- Accommodation listings
- Destination pages

### Basic Pattern

```astro
---
// src/pages/accommodations.astro
import { AccommodationService } from '@repo/service-core';
import AccommodationCard from '../components/accommodation/AccommodationCard.astro';

// Runs at BUILD TIME (once)
const service = new AccommodationService();
const result = await service.findAll({ limit: 50 });

const accommodations = result.success ? result.data.items : [];
---

<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
  {accommodations.map(accommodation => (
    <AccommodationCard accommodation={accommodation} />
  ))}
</div>
```text

**Output**: Pure HTML, no JavaScript needed

### Dynamic Routes with getStaticPaths

Generate multiple pages from dynamic data:

```astro
---
// src/pages/accommodations/[slug].astro
import type { GetStaticPaths } from 'astro';
import { AccommodationService } from '@repo/service-core';
import MainLayout from '../../layouts/MainLayout.astro';

export const getStaticPaths = (async () => {
  const service = new AccommodationService();
  const result = await service.findAll();

  if (!result.success) {
    console.error('Failed to fetch accommodations:', result.error);
    return [];
  }

  // Generate one page per accommodation
  return result.data.items.map(accommodation => ({
    params: { slug: accommodation.slug },
    props: { accommodation }
  }));
}) satisfies GetStaticPaths;

const { accommodation } = Astro.props;
const { slug } = Astro.params;
---

<MainLayout title={accommodation.name}>
  <h1>{accommodation.name}</h1>
  <p>{accommodation.description}</p>
</MainLayout>
```text

**Result**: Static HTML page for each accommodation

### With Pagination

```astro
---
// src/pages/accommodations/page/[page].astro
import type { GetStaticPaths } from 'astro';
import { AccommodationService } from '@repo/service-core';

export const getStaticPaths = (async () => {
  const service = new AccommodationService();
  const pageSize = 12;

  // Get total count
  const firstPage = await service.findAll({ page: 1, pageSize });
  if (!firstPage.success) return [];

  const totalPages = firstPage.data.pagination.totalPages;

  // Generate paths for all pages
  const paths = [];
  for (let page = 1; page <= totalPages; page++) {
    const result = await service.findAll({ page, pageSize });
    if (result.success) {
      paths.push({
        params: { page: page.toString() },
        props: {
          accommodations: result.data.items,
          pagination: result.data.pagination
        }
      });
    }
  }

  return paths;
}) satisfies GetStaticPaths;

const { accommodations, pagination } = Astro.props;
---

<div class="accommodations-grid">
  {accommodations.map(acc => (
    <AccommodationCard accommodation={acc} />
  ))}
</div>

<Pagination
  currentPage={pagination.currentPage}
  totalPages={pagination.totalPages}
/>
```markdown

### Filtering at Build Time

```astro
---
// src/pages/destinations/[slug]/accommodations.astro
import type { GetStaticPaths } from 'astro';
import { DestinationService, AccommodationService } from '@repo/service-core';

export const getStaticPaths = (async () => {
  const destService = new DestinationService();
  const accService = new AccommodationService();

  const destResult = await destService.findAll();
  if (!destResult.success) return [];

  const paths = [];

  for (const destination of destResult.data.items) {
    // Fetch accommodations for this destination
    const accResult = await accService.findAll({
      filters: { destinationId: destination.id }
    });

    if (accResult.success) {
      paths.push({
        params: { slug: destination.slug },
        props: {
          destination,
          accommodations: accResult.data.items
        }
      });
    }
  }

  return paths;
}) satisfies GetStaticPaths;

const { destination, accommodations } = Astro.props;
---

<h1>Accommodations in {destination.name}</h1>

<div class="grid">
  {accommodations.map(acc => (
    <AccommodationCard accommodation={acc} />
  ))}
</div>
```text

---

## 🖥️ Server-Side Fetching (SSR)

### What is SSR?

Server-Side Rendering generates HTML on **every request**. Perfect for personalized or frequently changing content.

**Benefits**:

- 🔄 Always fresh data
- 🔐 Access to server-side auth
- 👤 User-specific content
- 🎯 Dynamic personalization

**Use cases**:

- User dashboards
- Search results
- Real-time data
- Personalized recommendations

### Enable SSR for a Page

```astro
---
// src/pages/profile.astro
export const prerender = false; // Disable static generation

import { getAuth } from '@clerk/astro/server';
import { UserService } from '@repo/service-core';

// Runs on EVERY REQUEST
const { userId } = getAuth(Astro);

if (!userId) {
  return Astro.redirect('/auth/signin');
}

const userService = new UserService({ userId });
const userResult = await userService.findById(userId);

const user = userResult.success ? userResult.data : null;
---

<h1>Welcome, {user?.name}</h1>
```text

**Result**: Fresh HTML on every request

### Search with SSR

```astro
---
// src/pages/search.astro
export const prerender = false;

import { AccommodationService } from '@repo/service-core';

// Get query params
const url = new URL(Astro.request.url);
const query = url.searchParams.get('q') || '';
const location = url.searchParams.get('location');
const minPrice = Number(url.searchParams.get('minPrice')) || undefined;
const maxPrice = Number(url.searchParams.get('maxPrice')) || undefined;

// Fetch results based on query
const service = new AccommodationService();
const result = await service.findAll({
  filters: {
    search: query,
    destinationId: location || undefined,
    priceRange: minPrice && maxPrice ? { min: minPrice, max: maxPrice } : undefined
  }
});

const accommodations = result.success ? result.data.items : [];
const error = !result.success ? result.error : null;
---

<div>
  <h1>Search Results for "{query}"</h1>

  {error && (
    <div class="error">Failed to load results: {error.message}</div>
  )}

  {accommodations.length === 0 && !error && (
    <p>No results found</p>
  )}

  <div class="grid">
    {accommodations.map(acc => (
      <AccommodationCard accommodation={acc} />
    ))}
  </div>
</div>
```markdown

### API Endpoints (SSR)

```ts
// src/pages/api/accommodations.ts
import type { APIRoute } from 'astro';
import { AccommodationService } from '@repo/service-core';
import { AccommodationQuerySchema } from '@repo/schemas';

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);

  // Parse and validate query params
  const queryParams = {
    page: Number(url.searchParams.get('page')) || 1,
    pageSize: Number(url.searchParams.get('pageSize')) || 10,
    search: url.searchParams.get('search') || undefined,
    destinationId: url.searchParams.get('destinationId') || undefined
  };

  const validation = AccommodationQuerySchema.safeParse(queryParams);

  if (!validation.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid query parameters', details: validation.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const service = new AccommodationService({ userId: locals.userId });
  const result = await service.findAll(validation.data);

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify(result.data),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json();

  const service = new AccommodationService({ userId: locals.userId });
  const result = await service.create(body);

  return new Response(
    JSON.stringify(result),
    {
      status: result.success ? 201 : 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
```text

---

## ⚛️ Client-Side Fetching (CSR)

### What is CSR?

Client-Side Rendering fetches data in the **browser after page load**. Perfect for interactive features.

**Benefits**:

- 💫 Dynamic updates without page reload
- 🎮 Interactive user experiences
- 📊 Real-time data
- 🔄 Optimistic UI updates

**Use cases**:

- Interactive filters
- Live search
- Comments/reviews
- Shopping cart

### Basic Pattern (React)

```tsx
// src/components/accommodation/AccommodationList.tsx
import { useState, useEffect } from 'react';
import type { Accommodation } from '@repo/types';

interface AccommodationListProps {
  initialData?: Accommodation[];
}

export function AccommodationList({ initialData = [] }: AccommodationListProps) {
  const [accommodations, setAccommodations] = useState<Accommodation[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccommodations = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/accommodations');

        if (!response.ok) {
          throw new Error('Failed to fetch accommodations');
        }

        const data = await response.json();
        setAccommodations(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAccommodations();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {accommodations.map(acc => (
        <AccommodationCard key={acc.id} accommodation={acc} />
      ))}
    </div>
  );
}
```markdown

### With Search/Filtering

```tsx
// src/components/accommodation/SearchableList.tsx
import { useState, useEffect } from 'react';
import type { Accommodation, SearchFilters } from '@repo/types';

export function SearchableList() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    location: null,
    priceRange: null
  });
  const [loading, setLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWithFilters();
    }, 500);

    return () => clearTimeout(timer);
  }, [filters]);

  const fetchWithFilters = async () => {
    setLoading(true);

    const params = new URLSearchParams();
    if (filters.query) params.set('search', filters.query);
    if (filters.location) params.set('destinationId', filters.location);
    if (filters.priceRange) {
      params.set('minPrice', filters.priceRange.min.toString());
      params.set('maxPrice', filters.priceRange.max.toString());
    }

    try {
      const response = await fetch(`/api/accommodations?${params}`);
      const data = await response.json();
      setAccommodations(data.items);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SearchFilters
        filters={filters}
        onChange={setFilters}
      />

      {loading && <div>Searching...</div>}

      <div className="grid">
        {accommodations.map(acc => (
          <AccommodationCard key={acc.id} accommodation={acc} />
        ))}
      </div>
    </div>
  );
}
```markdown

### Pagination (Client-Side)

```tsx
// src/components/accommodation/PaginatedList.tsx
import { useState, useEffect } from 'react';
import type { Accommodation, PaginatedResponse } from '@repo/types';

export function PaginatedList() {
  const [data, setData] = useState<PaginatedResponse<Accommodation> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/accommodations?page=${currentPage}&pageSize=12`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [currentPage]);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <div className="grid">
        {data.items.map(acc => (
          <AccommodationCard key={acc.id} accommodation={acc} />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={data.pagination.totalPages}
        onPageChange={setCurrentPage}
        disabled={loading}
      />
    </div>
  );
}
```markdown

### Optimistic Updates

```tsx
// src/components/booking/BookingButton.tsx
import { useState } from 'react';
import type { Booking } from '@repo/types';

interface BookingButtonProps {
  accommodationId: string;
  onBookingCreated?: (booking: Booking) => void;
}

export function BookingButton({ accommodationId, onBookingCreated }: BookingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [optimisticState, setOptimisticState] = useState<'idle' | 'booking' | 'success'>('idle');

  const handleBook = async () => {
    // Optimistic update
    setOptimisticState('booking');
    setLoading(true);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accommodationId })
      });

      if (!response.ok) throw new Error('Booking failed');

      const booking = await response.json();

      // Success!
      setOptimisticState('success');
      onBookingCreated?.(booking);
    } catch (error) {
      // Rollback optimistic update
      setOptimisticState('idle');
      alert('Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleBook}
      disabled={loading || optimisticState === 'success'}
      className={optimisticState === 'success' ? 'btn-success' : 'btn-primary'}
    >
      {optimisticState === 'idle' && 'Book Now'}
      {optimisticState === 'booking' && 'Booking...'}
      {optimisticState === 'success' && '✓ Booked!'}
    </button>
  );
}
```text

---

## 🎨 Hybrid Approaches

### Progressive Enhancement

Start with SSG, enhance with client-side:

```astro
---
// src/pages/accommodations.astro
import { AccommodationService } from '@repo/service-core';
import { SearchableList } from '../components/accommodation/SearchableList';

// Build-time: Get initial data
const service = new AccommodationService();
const result = await service.findAll({ limit: 12 });
const initialData = result.success ? result.data.items : [];
---

<div>
  <!-- Works without JavaScript -->
  <noscript>
    <div class="grid">
      {initialData.map(acc => (
        <AccommodationCard accommodation={acc} />
      ))}
    </div>
  </noscript>

  <!-- Enhanced with JavaScript -->
  <SearchableList client:load initialData={initialData} />
</div>
```text

**Benefit**: Page works without JS, enhanced when available

### SSR + Client Hydration

```astro
---
// src/pages/search.astro
export const prerender = false;

import { AccommodationService } from '@repo/service-core';
import { SearchResults } from '../components/SearchResults';

// SSR: Get initial results
const url = new URL(Astro.request.url);
const query = url.searchParams.get('q') || '';

const service = new AccommodationService();
const result = await service.findAll({
  filters: { search: query }
});

const initialResults = result.success ? result.data : null;
---

<!-- Server-rendered initial state -->
<SearchResults
  client:load
  initialQuery={query}
  initialResults={initialResults}
/>
```text

**Component**:

```tsx
// src/components/SearchResults.tsx
import { useState } from 'react';
import type { PaginatedResponse, Accommodation } from '@repo/types';

interface SearchResultsProps {
  initialQuery: string;
  initialResults: PaginatedResponse<Accommodation> | null;
}

export function SearchResults({ initialQuery, initialResults }: SearchResultsProps) {
  // Start with server-rendered data
  const [results, setResults] = useState(initialResults);
  const [query, setQuery] = useState(initialQuery);

  // Client-side search
  const handleSearch = async (newQuery: string) => {
    setQuery(newQuery);

    const response = await fetch(`/api/search?q=${newQuery}`);
    const data = await response.json();
    setResults(data);
  };

  return (
    <div>
      <SearchInput value={query} onChange={handleSearch} />

      {results && (
        <div className="grid">
          {results.items.map(acc => (
            <AccommodationCard key={acc.id} accommodation={acc} />
          ))}
        </div>
      )}
    </div>
  );
}
```text

---

## 🔧 Service Integration

### Using @repo/service-core

All data fetching should go through services:

```astro
---
import { AccommodationService, DestinationService } from '@repo/service-core';

// ✅ Good: Use services
const accService = new AccommodationService();
const accommodations = await accService.findAll();

// ❌ Bad: Direct database access
import { db } from '@repo/db';
const accommodations = await db.select().from(accommodationsTable);
---
```markdown

### With Authentication Context

```astro
---
import { getAuth } from '@clerk/astro/server';
import { BookingService } from '@repo/service-core';

const { userId } = getAuth(Astro);

// Pass userId to service for authorization
const service = new BookingService({ userId });
const bookings = await service.findAll();
---
```markdown

### Error Handling Pattern

```astro
---
import { AccommodationService } from '@repo/service-core';

const service = new AccommodationService();
const result = await service.findAll();

// Services return Result<T, Error>
if (!result.success) {
  console.error('Failed to fetch:', result.error);
  // Handle error gracefully
}

const accommodations = result.success ? result.data.items : [];
---

{result.success ? (
  <div class="grid">
    {accommodations.map(acc => (
      <AccommodationCard accommodation={acc} />
    ))}
  </div>
) : (
  <div class="error">
    <p>Failed to load accommodations</p>
    <p>{result.error.message}</p>
  </div>
)}
```text

---

## 📊 Loading States

### SSR Loading Pattern

```astro
---
// src/pages/profile.astro
export const prerender = false;

import { UserService } from '@repo/service-core';
import { getAuth } from '@clerk/astro/server';

const { userId } = getAuth(Astro);
if (!userId) return Astro.redirect('/auth/signin');

const service = new UserService({ userId });
const result = await service.findById(userId);
---

{result.success ? (
  <div>
    <h1>Welcome, {result.data.name}</h1>
  </div>
) : (
  <div class="error">
    Failed to load profile
  </div>
)}
```markdown

### Client-Side Loading Pattern

```tsx
// src/components/accommodation/AccommodationLoader.tsx
import { useState, useEffect } from 'react';
import type { Accommodation } from '@repo/types';

export function AccommodationLoader({ id }: { id: string }) {
  const [state, setState] = useState<{
    data: Accommodation | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchAccommodation = async () => {
      try {
        const response = await fetch(`/api/accommodations/${id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch');
        }

        const data = await response.json();
        setState({ data, loading: false, error: null });
      } catch (err) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    };

    fetchAccommodation();
  }, [id]);

  if (state.loading) {
    return (
      <div className="loading">
        <Spinner />
        <p>Loading accommodation...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="error">
        <p>Failed to load accommodation</p>
        <p>{state.error}</p>
      </div>
    );
  }

  if (!state.data) {
    return <div>No accommodation found</div>;
  }

  return <AccommodationDetail accommodation={state.data} />;
}
```text

---

## 💾 Caching Strategies

### Browser Cache Headers

```ts
// src/pages/api/accommodations.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const data = await fetchAccommodations();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Cache for 5 minutes
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'
    }
  });
};
```markdown

### In-Memory Cache (Simple)

```ts
// src/lib/cache.ts
const cache = new Map<string, { data: unknown; expires: number }>();

export function getCached<T>(key: string): T | null {
  const cached = cache.get(key);

  if (!cached) return null;

  if (Date.now() > cached.expires) {
    cache.delete(key);
    return null;
  }

  return cached.data as T;
}

export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  cache.set(key, {
    data,
    expires: Date.now() + (ttlSeconds * 1000)
  });
}
```text

**Usage**:

```ts
// src/pages/api/accommodations.ts
import { getCached, setCache } from '../../lib/cache';

export const GET: APIRoute = async () => {
  const cacheKey = 'accommodations:all';

  // Try cache first
  const cached = getCached(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fetch fresh data
  const service = new AccommodationService();
  const result = await service.findAll();

  if (result.success) {
    // Cache for 5 minutes
    setCache(cacheKey, result.data, 300);
  }

  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
```markdown

### Client-Side Cache (localStorage)

```tsx
// src/hooks/useCachedFetch.ts
import { useState, useEffect } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function useCachedFetch<T>(
  url: string,
  ttlSeconds: number = 300
): { data: T | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });

  useEffect(() => {
    const fetchData = async () => {
      const cacheKey = `cache:${url}`;

      // Check cache
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const entry: CacheEntry<T> = JSON.parse(cached);
          const age = Date.now() - entry.timestamp;

          // Return cached if fresh
          if (age < ttlSeconds * 1000) {
            setState({ data: entry.data, loading: false, error: null });
            return;
          }
        } catch {
          // Invalid cache, continue to fetch
        }
      }

      // Fetch fresh
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Fetch failed');

        const data = await response.json();

        // Update cache
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(entry));

        setState({ data, loading: false, error: null });
      } catch (err) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    };

    fetchData();
  }, [url, ttlSeconds]);

  return state;
}
```text

**Usage**:

```tsx
export function AccommodationList() {
  const { data, loading, error } = useCachedFetch<Accommodation[]>(
    '/api/accommodations',
    300 // Cache for 5 minutes
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid">
      {data?.map(acc => (
        <AccommodationCard key={acc.id} accommodation={acc} />
      ))}
    </div>
  );
}
```text

---

## ✅ Best Practices

### 1. Choose the Right Strategy

```text
Static content → SSG (getStaticPaths)
User-specific → SSR (prerender: false)
Interactive → Client-side (React + fetch)
Both → Hybrid (SSG + client hydration)
```markdown

### 2. Use Services, Not Direct DB Access

```astro
---
// ✅ Good: Use services
import { AccommodationService } from '@repo/service-core';
const service = new AccommodationService();
const result = await service.findAll();

// ❌ Bad: Direct database
import { db } from '@repo/db';
const accommodations = await db.query.accommodations.findMany();
---
```markdown

### 3. Handle Errors Gracefully

```astro
---
const result = await service.findAll();

if (!result.success) {
  console.error('Failed to fetch:', result.error);
}
---

{result.success ? (
  <SuccessView data={result.data} />
) : (
  <ErrorView error={result.error} />
)}
```markdown

### 4. Show Loading States

```tsx
// Always show loading state
if (loading) return <LoadingSpinner />;

// Always handle errors
if (error) return <ErrorMessage error={error} />;

// Then show data
return <DataView data={data} />;
```markdown

### 5. Optimize Network Requests

```tsx
// ❌ Bad: Multiple requests
const destinations = await fetch('/api/destinations');
const accommodations = await fetch('/api/accommodations');
const events = await fetch('/api/events');

// ✅ Better: Parallel requests
const [destinations, accommodations, events] = await Promise.all([
  fetch('/api/destinations'),
  fetch('/api/accommodations'),
  fetch('/api/events')
]);

// ✅ Best: Combined endpoint
const data = await fetch('/api/homepage-data');
```markdown

### 6. Cache Appropriately

```ts
// Frequently accessed, rarely changes → Long cache
'Cache-Control': 'public, max-age=3600' // 1 hour

// User-specific → No cache
'Cache-Control': 'private, no-cache'

// Real-time → No cache
'Cache-Control': 'no-store'
```text

---

## 🚫 Common Mistakes

### Mistake 1: Fetching in Component Body (Astro)

```astro
<!-- ❌ Wrong: Won't work, runs at build time only once -->
<script>
  const data = await fetch('/api/data');
</script>

<!-- ✅ Correct: Fetch in frontmatter for SSG/SSR -->
---
const response = await fetch('/api/data');
const data = await response.json();
---
```markdown

### Mistake 2: Not Handling Errors

```tsx
// ❌ Bad: No error handling
const data = await fetch('/api/data').then(r => r.json());

// ✅ Good: Proper error handling
try {
  const response = await fetch('/api/data');
  if (!response.ok) throw new Error('Failed to fetch');
  const data = await response.json();
} catch (error) {
  console.error('Fetch error:', error);
  // Show error to user
}
```markdown

### Mistake 3: Over-fetching

```tsx
// ❌ Bad: Fetch all data, filter client-side
const allAccommodations = await fetch('/api/accommodations?limit=1000');
const filtered = allAccommodations.filter(acc => acc.featured);

// ✅ Good: Filter server-side
const featured = await fetch('/api/accommodations?featured=true');
```markdown

### Mistake 4: No Loading State

```tsx
// ❌ Bad: No loading indicator
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);

// ✅ Good: Show loading state
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  setLoading(true);
  fetch('/api/data')
    .then(r => r.json())
    .then(data => {
      setData(data);
      setLoading(false);
    });
}, []);

if (loading) return <div>Loading...</div>;
```text

---

## 📖 Decision Tree

```text
Need to fetch data?
│
├─ Content changes frequently or user-specific?
│  │
│  ├─ YES → SSR (prerender: false)
│  │   └─ Example: User profile, search results
│  │
│  └─ NO  → SSG (getStaticPaths)
│      └─ Example: Blog posts, accommodation listings
│
├─ Need interactivity?
│  │
│  ├─ YES → Client-side (React + fetch)
│  │   └─ Example: Live search, filters, cart
│  │
│  └─ NO  → Keep static
│      └─ Example: Marketing pages
│
└─ Need both static + interactive?
    └─ Hybrid (SSG + client hydration)
        └─ Example: Product page with reviews
```

---

## 📖 Additional Resources

### Internal Documentation

- **[Islands Architecture](islands.md)** - When to hydrate
- **[State Management](state-management.md)** - Client state with Nanostores
- **[Creating Pages](creating-pages.md)** - Page structure

### External Resources

- **[Astro Data Fetching](https://docs.astro.build/en/guides/data-fetching/)** - Official guide
- **[SSG vs SSR](https://www.patterns.dev/posts/rendering-introduction/)** - Rendering patterns

---

⬅️ Back to [Development Guide](README.md)
