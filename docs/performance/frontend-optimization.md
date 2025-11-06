# Frontend Optimization

## Overview

Hospeda's frontend optimization strategy focuses on delivering excellent user experience through:

1. **Bundle Size Reduction** - Code splitting, tree-shaking, lazy loading
2. **Loading Performance** - Critical path optimization, prefetching
3. **Rendering Performance** - Virtual scrolling, memoization, efficient re-renders
4. **Image Optimization** - Modern formats, responsive images, lazy loading
5. **Lighthouse Score** - Target 95+ across all metrics

**Performance Targets**:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Lighthouse Performance | 95+ | 96 | ✅ |
| First Contentful Paint (FCP) | < 1.8s | 1.2s | ✅ |
| Largest Contentful Paint (LCP) | < 2.5s | 1.8s | ✅ |
| First Input Delay (FID) | < 100ms | 45ms | ✅ |
| Cumulative Layout Shift (CLS) | < 0.1 | 0.05 | ✅ |
| Time to Interactive (TTI) | < 3.8s | 2.9s | ✅ |
| Total Blocking Time (TBT) | < 200ms | 150ms | ✅ |

## Bundle Size Optimization

### Performance Budgets

**Web App (Astro)**:

- Initial JS: < 100KB (gzipped)
- Initial CSS: < 50KB (gzipped)
- Total initial load: < 200KB
- Images: < 200KB per page

**Admin App (TanStack Start)**:

- Initial JS: < 200KB (gzipped)
- Initial CSS: < 75KB (gzipped)
- Vendor bundle: < 150KB
- Route chunks: < 100KB each

### Web App Configuration

**Astro Configuration** (`apps/web/astro.config.mjs`):

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';
import compress from 'astro-compress';

export default defineConfig({
  output: 'hybrid',
  adapter: vercel({
    webAnalytics: { enabled: true },
    speedInsights: { enabled: true }
  }),
  integrations: [
    react({
      // Only hydrate interactive components
      include: ['**/components/interactive/**']
    }),
    compress({
      CSS: true,
      HTML: true,
      Image: false, // Use Astro Image instead
      JavaScript: true,
      SVG: true
    })
  ],
  vite: {
    build: {
      rollupOptions: {
        output: {
          // Content-hashed filenames for long-term caching
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',

          // Manual chunks for better caching
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // Separate vendor chunks
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('@tanstack')) return 'vendor-tanstack';
              if (id.includes('zod')) return 'vendor-zod';
              return 'vendor';
            }
          }
        }
      },
      // Minification
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug']
        },
        format: {
          comments: false
        }
      },
      // Source maps only in development
      sourcemap: process.env.NODE_ENV === 'development'
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', '@tanstack/react-query']
    }
  }
});
```

**Island Architecture** (Astro):

```astro
---
// src/pages/accommodations/[id].astro
import { getAccommodation } from '@/services/accommodations';
import Layout from '@/layouts/Layout.astro';
import StaticHeader from '@/components/StaticHeader.astro';
import StaticFooter from '@/components/StaticFooter.astro';

// Interactive components (ship JS)
import ImageGallery from '@/components/interactive/ImageGallery';
import BookingForm from '@/components/interactive/BookingForm';
import ReviewsSection from '@/components/interactive/ReviewsSection';

export const prerender = true;

const { id } = Astro.params;
const accommodation = await getAccommodation(id);
---

<Layout title={accommodation.name}>
  <!-- Static components (0 KB JS) -->
  <StaticHeader />

  <main>
    <!-- Static content -->
    <h1>{accommodation.name}</h1>
    <p>{accommodation.description}</p>

    <!-- Interactive islands (ships minimal JS) -->
    <ImageGallery
      images={accommodation.images}
      client:visible
    />

    <BookingForm
      accommodationId={id}
      pricePerNight={accommodation.pricePerNight}
      client:idle
    />

    <ReviewsSection
      accommodationId={id}
      client:visible
    />
  </main>

  <!-- Static footer (0 KB JS) -->
  <StaticFooter />
</Layout>
```

**Client Directives**:

- `client:load` - Load immediately (critical interactive features)
- `client:idle` - Load when browser idle (non-critical features)
- `client:visible` - Load when component visible (below the fold)
- `client:media` - Load on media query match (responsive features)
- `client:only` - Only render on client (skip SSR)

### Admin App Configuration

**TanStack Start Configuration** (`apps/admin/app.config.ts`):

```typescript
import { defineConfig } from '@tanstack/start/config';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  vite: {
    plugins: [
      viteTsConfigPaths({
        projects: ['./tsconfig.json']
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-tanstack': [
              '@tanstack/react-router',
              '@tanstack/react-query',
              '@tanstack/react-table',
              '@tanstack/react-form'
            ],
            'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
            'vendor-utils': ['date-fns', 'zod', 'clsx']
          }
        }
      },
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    }
  }
});
```

**Code Splitting** (Route-based):

```tsx
// apps/admin/src/routes/accommodations/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Heavy component loaded lazily
const AccommodationsTable = lazy(() =>
  import('@/features/accommodations/components/AccommodationsTable')
);

export const Route = createFileRoute('/accommodations/')({
  component: AccommodationsPage
});

function AccommodationsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Accommodations</h1>

      <Suspense fallback={<LoadingSpinner />}>
        <AccommodationsTable />
      </Suspense>
    </div>
  );
}
```

**Dynamic Imports** (Feature-based):

```tsx
// apps/admin/src/features/accommodations/components/AccommodationsTable.tsx
import { useState } from 'react';

export function AccommodationsTable({ data }: Props) {
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleExport = async () => {
    // Load heavy export library on demand
    const { exportToExcel } = await import('@/utils/export');
    await exportToExcel(data);
  };

  const handleGeneratePDF = async () => {
    // Load PDF library on demand
    const { generatePDF } = await import('@/utils/pdf');
    await generatePDF(data);
  };

  return (
    <div>
      <button onClick={handleExport}>Export to Excel</button>
      <button onClick={handleGeneratePDF}>Generate PDF</button>
      {/* Table content */}
    </div>
  );
}
```

### Tree-Shaking

**Optimized Imports**:

```typescript
// ❌ Bad: Imports entire library (no tree-shaking)
import _ from 'lodash';
import * as icons from 'lucide-react';
import moment from 'moment';

_.debounce(fn, 300);
<icons.Star />

// ✅ Good: Tree-shakeable imports
import { debounce } from 'lodash-es';
import { Star, Heart, MapPin } from 'lucide-react';
import { format } from 'date-fns';

debounce(fn, 300);
<Star />
```

**Package Replacements** (smaller alternatives):

| Heavy Package | Lighter Alternative | Size Savings |
|---------------|---------------------|--------------|
| `moment` | `date-fns` | ~66 KB → ~13 KB |
| `lodash` | `lodash-es` + specific imports | ~72 KB → ~5 KB |
| `axios` | `fetch` API | ~13 KB → 0 KB |
| `chart.js` | `recharts` (for React) | ~200 KB → ~50 KB |

**Barrel Files** (use cautiously):

```typescript
// ❌ Bad: Barrel file imports everything
// src/components/index.ts
export * from './Button';
export * from './Card';
export * from './Dialog';
// ... 50+ components

// Usage
import { Button } from '@/components'; // Imports all 50+ components

// ✅ Good: Direct imports
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
```

### Bundle Analysis

**Analyze Web App**:

```bash
cd apps/web

# Build and analyze
pnpm build
pnpm dlx vite-bundle-visualizer

# Open visualization
open stats.html
```

**Analyze Admin App**:

```bash
cd apps/admin

# Build with analysis
pnpm build --mode analyze

# Or use vite-bundle-visualizer
pnpm dlx vite-bundle-visualizer
```

**Monitor Bundle Size** (GitHub Action):

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  check-size:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Build apps
        run: pnpm build

      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Loading Performance

### Critical Path Optimization

**Preload Critical Resources**:

```html
<!-- apps/web/src/layouts/Layout.astro -->
<head>
  <!-- Preload critical fonts -->
  <link
    rel="preload"
    href="/fonts/inter-var.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />

  <!-- Preload critical CSS -->
  <link
    rel="preload"
    href="/styles/critical.css"
    as="style"
  />

  <!-- Preconnect to external domains -->
  <link rel="preconnect" href="https://api.hospeda.com" />
  <link rel="preconnect" href="https://images.hospeda.com" />

  <!-- DNS prefetch for third-party -->
  <link rel="dns-prefetch" href="https://analytics.google.com" />
</head>
```

**Resource Hints**:

```html
<!-- Prefetch next likely page -->
<link rel="prefetch" href="/accommodations" />

<!-- Prerender next page (aggressive) -->
<link rel="prerender" href="/checkout" />

<!-- Modulepreload for ES modules -->
<link rel="modulepreload" href="/assets/app.js" />
```

### Lazy Loading

**Images** (Native):

```tsx
// Standard lazy loading
<img
  src="/accommodation-main.jpg"
  loading="lazy"
  decoding="async"
  alt="Accommodation"
  width="800"
  height="600"
/>
```

**Images** (Astro Image):

```astro
---
import { Image } from 'astro:assets';
import accommodationImage from '@/assets/accommodation.jpg';
---

<Image
  src={accommodationImage}
  alt="Accommodation"
  width={800}
  height={600}
  format="webp"
  quality={80}
  loading="lazy"
  decoding="async"
/>
```

**Components** (React):

```tsx
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load heavy component
const MapComponent = lazy(() => import('@/components/Map'));

export function AccommodationDetails() {
  return (
    <div>
      <h1>Accommodation Details</h1>

      {/* Lazy loaded map */}
      <Suspense fallback={<LoadingSpinner />}>
        <MapComponent />
      </Suspense>
    </div>
  );
}
```

**Routes** (TanStack Router):

```tsx
// apps/admin/src/routes/accommodations/$id.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/accommodations/$id')({
  // Preload on hover/intent
  preload: 'intent',

  // Load data before navigation
  loader: async ({ params }) => {
    const accommodation = await fetchAccommodation(params.id);
    return { accommodation };
  },

  component: AccommodationDetail
});

function AccommodationDetail() {
  const { accommodation } = Route.useLoaderData();

  return (
    <div>
      <h1>{accommodation.name}</h1>
      <p>{accommodation.description}</p>
    </div>
  );
}
```

### Prefetching

**TanStack Query Prefetch**:

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

export function AccommodationCard({ id, name }: Props) {
  const queryClient = useQueryClient();

  // Prefetch on hover
  const prefetchDetails = () => {
    queryClient.prefetchQuery({
      queryKey: ['accommodation', id],
      queryFn: () => fetchAccommodation(id),
      staleTime: 5 * 60 * 1000
    });
  };

  return (
    <Link
      to="/accommodations/$id"
      params={{ id }}
      onMouseEnter={prefetchDetails}
      className="card"
    >
      <h3>{name}</h3>
      <span>View Details →</span>
    </Link>
  );
}
```

**Intersection Observer** (prefetch when near viewport):

```tsx
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function AccommodationCard({ id }: Props) {
  const queryClient = useQueryClient();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Prefetch when card is 200px from viewport
          queryClient.prefetchQuery({
            queryKey: ['accommodation', id],
            queryFn: () => fetchAccommodation(id)
          });
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [id, queryClient]);

  return <div ref={cardRef}>{/* Card content */}</div>;
}
```

## Rendering Performance

### Virtual Scrolling

**TanStack Table with Virtualization**:

```tsx
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function AccommodationsTable({ data }: Props) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const { rows } = table.getRowModel();
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scroller
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Row height in pixels
    overscan: 10 // Render 10 extra rows above/below viewport
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
    >
      <div
        className="relative"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];

          return (
            <div
              key={row.id}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {/* Row content */}
              {row.getVisibleCells().map(cell => (
                <div key={cell.id}>
                  {cell.renderValue()}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### React Optimization

**useMemo** (expensive calculations):

```tsx
import { useMemo } from 'react';

export function AccommodationList({ accommodations, filters }: Props) {
  // Memoize expensive filtering/sorting
  const filteredAccommodations = useMemo(() => {
    return accommodations
      .filter(acc =>
        acc.city === filters.city &&
        acc.pricePerNight >= filters.minPrice &&
        acc.pricePerNight <= filters.maxPrice
      )
      .sort((a, b) => {
        switch (filters.sortBy) {
          case 'price':
            return a.pricePerNight - b.pricePerNight;
          case 'rating':
            return b.rating - a.rating;
          default:
            return 0;
        }
      });
  }, [accommodations, filters]);

  return (
    <div>
      {filteredAccommodations.map(acc => (
        <AccommodationCard key={acc.id} accommodation={acc} />
      ))}
    </div>
  );
}
```

**React.memo** (component memoization):

```tsx
import { memo } from 'react';

// Memoize component to prevent re-renders
export const AccommodationCard = memo(({ accommodation }: Props) => {
  return (
    <div className="card">
      <h3>{accommodation.name}</h3>
      <p>{accommodation.description}</p>
      <span>${accommodation.pricePerNight}/night</span>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison (only re-render if id changes)
  return prevProps.accommodation.id === nextProps.accommodation.id;
});

AccommodationCard.displayName = 'AccommodationCard';
```

**useCallback** (stable callbacks):

```tsx
import { useCallback } from 'react';

export function SearchBar({ onSearch }: Props) {
  // Stable callback reference
  const handleSearch = useCallback((query: string) => {
    onSearch(query);
  }, [onSearch]);

  return (
    <input
      type="search"
      onChange={(e) => handleSearch(e.target.value)}
      placeholder="Search accommodations..."
    />
  );
}
```

### Debouncing & Throttling

**useDeferredValue** (React 18+):

```tsx
import { useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';

export function SearchResults({ query }: Props) {
  // Defer non-urgent updates
  const deferredQuery = useDeferredValue(query);

  const { data: results } = useQuery({
    queryKey: ['search', deferredQuery],
    queryFn: () => searchAccommodations(deferredQuery),
    enabled: deferredQuery.length > 0
  });

  return <ResultsList results={results} />;
}
```

**Manual Debounce** (lodash-es):

```typescript
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage
export function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => search(debouncedQuery),
    enabled: debouncedQuery.length > 0
  });

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
}
```

## Image Optimization

### Format & Compression

**Astro Image** (automatic optimization):

```astro
---
import { Image } from 'astro:assets';
import accommodationImage from '@/assets/accommodation.jpg';
---

<!-- Automatic WebP conversion and optimization -->
<Image
  src={accommodationImage}
  alt="Accommodation"
  width={800}
  height={600}
  format="webp"
  quality={80}
  loading="lazy"
  decoding="async"
/>
```

**Manual Optimization** (Sharp):

```bash
# Install Sharp
pnpm add -D sharp

# Convert to WebP
npx sharp -i image.jpg -o image.webp --webp-quality 80

# Generate responsive variants
npx sharp -i image.jpg -o image-400.webp --resize 400 --webp-quality 80
npx sharp -i image.jpg -o image-800.webp --resize 800 --webp-quality 80
npx sharp -i image.jpg -o image-1200.webp --resize 1200 --webp-quality 80
```

### Responsive Images

**Picture Element**:

```html
<picture>
  <!-- Mobile: WebP -->
  <source
    media="(max-width: 640px)"
    srcset="/images/accommodation-small.webp"
    type="image/webp"
  />

  <!-- Tablet: WebP -->
  <source
    media="(max-width: 1024px)"
    srcset="/images/accommodation-medium.webp"
    type="image/webp"
  />

  <!-- Desktop: WebP -->
  <source
    srcset="/images/accommodation-large.webp"
    type="image/webp"
  />

  <!-- Fallback: JPEG -->
  <img
    src="/images/accommodation.jpg"
    alt="Accommodation"
    loading="lazy"
    width="1200"
    height="800"
  />
</picture>
```

**srcset and sizes**:

```html
<img
  src="/image-800.webp"
  srcset="
    /image-400.webp 400w,
    /image-800.webp 800w,
    /image-1200.webp 1200w
  "
  sizes="
    (max-width: 640px) 400px,
    (max-width: 1024px) 800px,
    1200px
  "
  alt="Accommodation"
  loading="lazy"
  width="1200"
  height="800"
/>
```

### CDN Image Optimization

**Vercel Image** (Next.js-style):

```tsx
import Image from 'next/image';

export function AccommodationImage({ src, alt }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      quality={80}
      priority={false} // Lazy load
      placeholder="blur"
    />
  );
}
```

**Cloudinary** (external CDN):

```typescript
// packages/utils/src/cloudinary.ts
export function getOptimizedImageUrl(
  publicId: string,
  options: ImageOptions = {}
): string {
  const {
    width = 800,
    height = 600,
    quality = 'auto',
    format = 'auto',
    crop = 'fill'
  } = options;

  return `https://res.cloudinary.com/hospeda/image/upload/` +
    `w_${width},h_${height},c_${crop},q_${quality},f_${format}/` +
    `${publicId}`;
}

// Usage
const imageUrl = getOptimizedImageUrl('accommodation/acc-123/main', {
  width: 800,
  height: 600,
  quality: 80,
  format: 'webp'
});
```

## Lighthouse Optimization

### Core Web Vitals Tracking

**Web Vitals Library**:

```typescript
// apps/web/src/utils/web-vitals.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

function sendToAnalytics(metric: WebVitalMetric) {
  // Send to analytics endpoint
  const body = JSON.stringify({
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    page: window.location.pathname,
    timestamp: Date.now()
  });

  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/web-vitals', body);
  } else {
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(console.error);
  }
}

// Track all Core Web Vitals
export function initWebVitals() {
  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
```

**Inject in Layout**:

```astro
---
// src/layouts/Layout.astro
---
<html>
  <body>
    <slot />

    <script>
      import { initWebVitals } from '@/utils/web-vitals';

      // Track Web Vitals
      if (import.meta.env.PROD) {
        initWebVitals();
      }
    </script>
  </body>
</html>
```

### Lighthouse CI

**Configuration** (`.lighthouserc.json`):

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:4321/",
        "http://localhost:4321/accommodations",
        "http://localhost:4321/accommodations/acc-123"
      ],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop",
        "throttlingMethod": "simulate"
      }
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.95}],
        "categories:accessibility": ["error", {"minScore": 1}],
        "categories:best-practices": ["error", {"minScore": 1}],
        "categories:seo": ["error", {"minScore": 1}],

        "first-contentful-paint": ["error", {"maxNumericValue": 1800}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 200}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**GitHub Action** (`.github/workflows/lighthouse.yml`):

```yaml
name: Lighthouse CI

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  lighthouse:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Build Web app
        run: pnpm --filter web build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: lighthouse-results
          path: .lighthouseci
```

### Performance Budget

**Budget Configuration** (`budget.json`):

```json
[
  {
    "path": "/*",
    "resourceSizes": [
      {
        "resourceType": "script",
        "budget": 100
      },
      {
        "resourceType": "stylesheet",
        "budget": 50
      },
      {
        "resourceType": "image",
        "budget": 200
      },
      {
        "resourceType": "font",
        "budget": 50
      },
      {
        "resourceType": "total",
        "budget": 400
      }
    ],
    "timings": [
      {
        "metric": "first-contentful-paint",
        "budget": 1800
      },
      {
        "metric": "largest-contentful-paint",
        "budget": 2500
      },
      {
        "metric": "interactive",
        "budget": 3800
      },
      {
        "metric": "total-blocking-time",
        "budget": 200
      },
      {
        "metric": "cumulative-layout-shift",
        "budget": 0.1
      }
    ]
  }
]
```

## Font Optimization

### Self-Hosted Fonts

**Font Face Declaration**:

```css
/* apps/web/src/styles/fonts.css */

/* Variable font (supports multiple weights) */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

/* Fallback for older browsers */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

**Preload Fonts**:

```html
<!-- apps/web/src/layouts/Layout.astro -->
<head>
  <link
    rel="preload"
    href="/fonts/inter-var.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />
</head>
```

### Font Subsetting

**Generate Subset** (glyphhanger):

```bash
# Install glyphhanger
npm install -g glyphhanger

# Generate subset for Latin characters
glyphhanger \
  --subset=inter-var.woff2 \
  --formats=woff2 \
  --whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 "

# Generate subset from website
glyphhanger https://hospeda.com \
  --subset=inter-var.woff2 \
  --formats=woff2
```

## CSS Optimization

### Critical CSS

**Extract and Inline**:

```bash
# Install critical
npm install -g critical

# Extract critical CSS
critical \
  src/pages/index.html \
  --base dist \
  --inline \
  --minify \
  --width 1300 \
  --height 900
```

**Manual Inline** (Astro):

```astro
---
// src/layouts/Layout.astro
---
<html>
  <head>
    <style is:inline>
      /* Critical CSS inlined */
      body {
        margin: 0;
        font-family: 'Inter', sans-serif;
      }

      .header {
        height: 60px;
        background: white;
      }

      /* Above-the-fold styles */
    </style>

    <!-- Defer non-critical CSS -->
    <link
      rel="preload"
      href="/styles/main.css"
      as="style"
      onload="this.onload=null;this.rel='stylesheet'"
    />
    <noscript>
      <link rel="stylesheet" href="/styles/main.css" />
    </noscript>
  </head>
</html>
```

### Tailwind CSS Optimization

**Purge Configuration** (`tailwind.config.js`):

```javascript
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}',
    './src/**/*.vue'
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
```

**JIT Mode** (default in Tailwind v3+):

- Only generates CSS for classes used
- Reduces build time
- Smaller production bundles

## Performance Checklist

### Pre-Deployment ✅

- [ ] Bundle size within budget (< 200KB initial)
- [ ] Images optimized (WebP format, lazy loading)
- [ ] Fonts preloaded and subsetted
- [ ] Critical CSS inlined
- [ ] Code splitting implemented
- [ ] Lighthouse score > 95
- [ ] No `console.log` in production
- [ ] Source maps disabled in production
- [ ] Compression enabled (Brotli/Gzip)

### Post-Deployment ✅

- [ ] Monitor Core Web Vitals
- [ ] Track bundle sizes over time
- [ ] Review performance budgets weekly
- [ ] Run Lighthouse audits monthly
- [ ] Monitor error rates
- [ ] Check cache hit rates
- [ ] Analyze user metrics (Real User Monitoring)

## Best Practices

### DO ✅

- **Use island architecture** (Astro) for minimal JS
- **Implement code splitting** at route and component level
- **Lazy load** images, components, and heavy dependencies
- **Prefetch critical data** on user intent (hover, scroll)
- **Use memoization** (`useMemo`, `React.memo`) appropriately
- **Optimize images** (WebP, responsive, lazy loading)
- **Monitor bundle sizes** in CI/CD
- **Set performance budgets** and enforce them
- **Track Core Web Vitals** in production
- **Use variable fonts** to reduce requests

### DON'T ❌

- **Ship unused dependencies** or code
- **Load all JS upfront** (avoid eager loading)
- **Forget lazy loading** for below-the-fold content
- **Use large unoptimized images**
- **Skip optimization checks** in CI/CD
- **Ignore Lighthouse warnings**
- **Use barrel exports** excessively (breaks tree-shaking)
- **Over-memoize** (can hurt performance)
- **Forget accessibility** while optimizing
- **Ignore Real User Monitoring** data

## Troubleshooting

### Large Bundle Size

**Diagnosis**:

```bash
# Analyze bundle
pnpm dlx vite-bundle-visualizer

# Check what's in node_modules
npx cost-of-modules
```

**Solutions**:

1. Replace heavy dependencies with lighter alternatives
2. Use dynamic imports for heavy features
3. Enable tree-shaking (use ES modules)
4. Remove unused dependencies

### Poor LCP

**Diagnosis**:

- Check Lighthouse report
- Inspect network waterfall
- Analyze render-blocking resources

**Solutions**:

1. Preload critical resources (fonts, images)
2. Optimize images (compress, resize, WebP)
3. Inline critical CSS
4. Use CDN for static assets
5. Implement server-side rendering

### High CLS

**Diagnosis**:

- Enable Layout Shift regions in DevTools
- Record page load with Performance panel

**Solutions**:

1. Always specify `width` and `height` on images
2. Reserve space for dynamic content
3. Avoid inserting content above existing content
4. Use `font-display: swap` cautiously

### Slow TTI

**Diagnosis**:

- Check main thread activity in DevTools
- Analyze JavaScript execution time

**Solutions**:

1. Reduce JavaScript bundle size
2. Code split heavy routes/features
3. Defer non-critical JavaScript
4. Use web workers for heavy computations

## Next Steps

- [Caching Strategies](./caching.md) - Multi-layer caching
- [Performance Monitoring](./monitoring.md) - Metrics and alerts
- [Database Optimization](./database-optimization.md) - Query optimization
