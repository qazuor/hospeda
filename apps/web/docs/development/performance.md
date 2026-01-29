# Performance Optimization Guide

Complete guide to optimizing performance and achieving high Lighthouse scores in Hospeda Web App.

---

## 📖 Overview

Hospeda Web App targets **95+ Lighthouse scores** for optimal user experience and SEO.

**Key Metrics** (Core Web Vitals):

- 🏃 **LCP (Largest Contentful Paint)**: < 2.5s
- ⚡ **FID (First Input Delay)**: < 100ms
- 📏 **CLS (Cumulative Layout Shift)**: < 0.1
- 🎯 **Lighthouse Performance**: 95+
- 📊 **Total Blocking Time**: < 300ms

**Performance Benefits**:

- Better SEO rankings
- Lower bounce rates
- Higher conversion rates
- Improved mobile experience

---

## 🎯 Core Web Vitals

### LCP - Largest Contentful Paint

**What it measures**: Time until largest content element is rendered.

**Target**: < 2.5 seconds

**Optimization**:

#### 1. Optimize Images

```astro
---
// ❌ Bad: Unoptimized large image
<img src="/hero-large.jpg" alt="Hero" />

// ✅ Good: Optimized with Astro Image
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';
---

<Image
  src={heroImage}
  alt="Litoral Argentino"
  width={1200}
  height={600}
  format="webp"
  quality={80}
  loading="eager"
  fetchpriority="high"
/>
```markdown

#### 2. Preload Critical Resources

```astro
<head>
  <!-- Preload hero image -->
  <link
    rel="preload"
    as="image"
    href="/hero.webp"
    fetchpriority="high"
  />

  <!-- Preload critical fonts -->
  <link
    rel="preload"
    href="/fonts/inter-var.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />
</head>
```markdown

#### 3. Minimize Render-Blocking Resources

```astro
---
// Generate critical CSS inline
const criticalCSS = `
  .hero { background: linear-gradient(to right, #0066cc, #0052a3); }
  .container { max-width: 1200px; margin: 0 auto; }
`;
---

<head>
  <!-- Inline critical CSS -->
  <style set:html={criticalCSS} />

  <!-- Defer non-critical CSS -->
  <link
    rel="stylesheet"
    href="/styles/non-critical.css"
    media="print"
    onload="this.media='all'"
  />
</head>
```markdown

### FID - First Input Delay

**What it measures**: Time from first user interaction to browser response.

**Target**: < 100ms

**Optimization**:

#### 1. Defer JavaScript

```astro
<!-- ❌ Bad: Loads immediately, blocks main thread -->
<SearchForm client:load />

<!-- ✅ Good: Defers hydration -->
<SearchForm client:idle />
<Newsletter client:visible />
```markdown

#### 2. Minimize JavaScript Execution

```tsx
// ❌ Bad: Heavy computation on mount
useEffect(() => {
  const results = expensiveCalculation(largeArray);
  setData(results);
}, []);

// ✅ Good: Debounce or defer
useEffect(() => {
  const timer = setTimeout(() => {
    const results = expensiveCalculation(largeArray);
    setData(results);
  }, 100);

  return () => clearTimeout(timer);
}, []);
```markdown

#### 3. Code Splitting

```tsx
// ❌ Bad: Import everything upfront
import { HeavyComponent } from './HeavyComponent';

export function App() {
  return <HeavyComponent />;
}

// ✅ Good: Lazy load
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```markdown

### CLS - Cumulative Layout Shift

**What it measures**: Visual stability (unexpected layout shifts).

**Target**: < 0.1

**Optimization**:

#### 1. Reserve Space for Images

```astro
<!-- ❌ Bad: No dimensions, causes layout shift -->
<img src="/hotel.jpg" alt="Hotel" />

<!-- ✅ Good: Explicit dimensions -->
<img
  src="/hotel.jpg"
  alt="Hotel"
  width="800"
  height="600"
/>

<!-- ✅ Better: Aspect ratio with CSS -->
<img
  src="/hotel.jpg"
  alt="Hotel"
  style="aspect-ratio: 4/3; width: 100%; height: auto;"
/>
```markdown

#### 2. Reserve Space for Dynamic Content

```astro
<style>
  /* Reserve minimum height for dynamic content */
  .accommodation-list {
    min-height: 400px;
  }

  .loading-skeleton {
    height: 200px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  }
</style>

<div class="accommodation-list">
  {loading ? (
    <div class="loading-skeleton"></div>
  ) : (
    <AccommodationGrid accommodations={data} />
  )}
</div>
```markdown

#### 3. Avoid Inserting Content Above Existing Content

```tsx
// ❌ Bad: Inserts at top, shifts content down
setItems([newItem, ...items]);

// ✅ Good: Append to bottom
setItems([...items, newItem]);
```text

---

## 🚀 JavaScript Optimization

### Minimize Bundle Size

#### 1. Analyze Bundle

```bash
# Build and analyze
pnpm build
pnpm run analyze

# Check bundle sizes
ls -lh dist/_astro/
```markdown

#### 2. Tree Shaking

```tsx
// ❌ Bad: Imports entire library
import _ from 'lodash';
const result = _.debounce(fn, 300);

// ✅ Good: Import only what you need
import { debounce } from 'lodash-es';
const result = debounce(fn, 300);

// ✅ Better: Use native alternatives
const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
```markdown

#### 3. Remove Unused Dependencies

```bash
# Audit dependencies
pnpm audit

# Remove unused packages
pnpm remove <package>
```markdown

### Lazy Load Components

```astro
---
import { SearchForm } from '../components/SearchForm';
---

<!-- Above fold: Load immediately -->
<SearchForm client:load />

<!-- Below fold: Load when visible -->
<ImageGallery client:visible />

<!-- Non-critical: Load when idle -->
<Newsletter client:idle />

<!-- Mobile only: Load on mobile -->
<MobileMenu client:media="(max-width: 768px)" />
```markdown

### Debounce User Input

```tsx
import { useState, useEffect } from 'react';

export function SearchInput() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch when debounced query changes
  useEffect(() => {
    if (debouncedQuery) {
      fetchResults(debouncedQuery);
    }
  }, [debouncedQuery]);

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}
```text

---

## 🖼️ Image Optimization

### Use Astro Image Component

```astro
---
import { Image } from 'astro:assets';
import hotelImage from '../assets/hotel.jpg';
---

<!-- Automatic optimization -->
<Image
  src={hotelImage}
  alt="Hotel Panorama"
  width={800}
  height={600}
  format="webp"
  quality={80}
  loading="lazy"
/>
```markdown

### Responsive Images

```astro
<Image
  src={heroImage}
  alt="Hero"
  widths={[400, 800, 1200]}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
  format="webp"
/>
```markdown

### Lazy Loading

```astro
<!-- Above fold: Load immediately -->
<Image src={hero} alt="Hero" loading="eager" fetchpriority="high" />

<!-- Below fold: Lazy load -->
<Image src={gallery1} alt="Gallery" loading="lazy" />
<Image src={gallery2} alt="Gallery" loading="lazy" />
```markdown

### Modern Formats

```astro
<!-- Serve WebP with JPEG fallback -->
<picture>
  <source srcset="/hotel.webp" type="image/webp" />
  <source srcset="/hotel.jpg" type="image/jpeg" />
  <img src="/hotel.jpg" alt="Hotel" />
</picture>
```text

---

## 🎨 CSS Optimization

### Critical CSS

**Inline critical CSS** for above-the-fold content:

```astro
---
const criticalCSS = `
  body { font-family: system-ui; margin: 0; }
  .hero { min-height: 400px; background: #0066cc; }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
`;
---

<head>
  <style set:html={criticalCSS} />
</head>
```markdown

### Purge Unused CSS

Tailwind automatically purges unused styles:

```js
// tailwind.config.mjs
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  // Only includes CSS classes actually used in these files
};
```markdown

### Minimize CSS

```bash
# Build optimizes and minifies CSS automatically
pnpm build
```text

---

## 🌐 Network Optimization

### Preconnect to External Domains

```astro
<head>
  <!-- Preconnect to image CDN -->
  <link rel="preconnect" href="https://images.hospeda.com.ar" />

  <!-- DNS prefetch for analytics -->
  <link rel="dns-prefetch" href="https://www.google-analytics.com" />
</head>
```markdown

### Cache Static Assets

```ts
// src/pages/api/accommodations.ts
export const GET: APIRoute = async () => {
  const data = await fetchData();

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      // Cache for 5 minutes
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'
    }
  });
};
```markdown

### Compress Responses

Vercel automatically compresses responses (gzip/brotli).

For custom servers:

```ts
// Enable compression middleware
import compression from 'compression';

app.use(compression());
```text

---

## 🏗️ Build Optimization

### Enable SSG Where Possible

```astro
<!-- ✅ Good: Static generation -->
---
// No prerender: false = Static by default
const accommodations = await fetchAccommodations();
---

<!-- ❌ Avoid SSR unless necessary -->
---
export const prerender = false; // Only for dynamic/user-specific content
---
```markdown

### Optimize getStaticPaths

```astro
---
export const getStaticPaths = async () => {
  // ❌ Bad: Fetch same data multiple times
  const paths = [];
  for (const acc of accommodations) {
    const details = await fetchAccommodationDetails(acc.id); // N+1 problem
    paths.push({ params: { slug: acc.slug }, props: { details } });
  }

  // ✅ Good: Batch fetch
  const accommodations = await fetchAllAccommodations();
  const details = await fetchAllDetails(accommodations.map(a => a.id));

  return accommodations.map((acc, i) => ({
    params: { slug: acc.slug },
    props: { accommodation: acc, details: details[i] }
  }));
};
---
```markdown

### Parallel Builds

```json
// package.json
{
  "scripts": {
    "build": "astro build"
  }
}
```text

Astro builds in parallel by default.

---

## 📊 Measuring Performance

### Lighthouse

```bash
# Run Lighthouse
npx lighthouse https://hospeda.com.ar --view

# CI/CD friendly
npx lighthouse https://hospeda.com.ar --output=json --output-path=./report.json
```markdown

### Chrome DevTools

1. Open DevTools
2. Go to Lighthouse tab
3. Click "Generate report"
4. Review scores and suggestions

### Web Vitals Library

```astro
<script>
  import { onCLS, onFID, onLCP } from 'web-vitals';

  onCLS(console.log);
  onFID(console.log);
  onLCP(console.log);
</script>
```markdown

### Performance API

```tsx
import { useEffect } from 'react';

export function PerformanceMonitor() {
  useEffect(() => {
    // Measure page load
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      console.log('Page load time:', perfData.loadEventEnd - perfData.fetchStart);
    });

    // Measure component render
    const start = performance.now();
    // ... render logic
    const end = performance.now();
    console.log('Render time:', end - start);
  }, []);
}
```text

---

## ✅ Best Practices

### 1. Always Use Astro Image Component

```astro
<!-- ✅ Always use Astro Image -->
<Image src={img} alt="..." width={800} height={600} format="webp" />

<!-- ✅ Lazy load below fold -->
<Image src={img} alt="..." loading="lazy" />

<!-- ✅ Set dimensions -->
<img src="..." width="800" height="600" alt="..." />
```markdown

### 2. Minimize JavaScript

```astro
<!-- ✅ Use Astro components when possible -->
<Card.astro />

<!-- ❌ Avoid React for static content -->
<Card.tsx client:load />
```markdown

### 3. Use Appropriate Hydration

```astro
<!-- Critical UI: Immediate -->
<SearchBar client:load />

<!-- Interactive, non-critical: Defer -->
<Comments client:idle />

<!-- Below fold: When visible -->
<Gallery client:visible />

<!-- Responsive: Media query -->
<MobileNav client:media="(max-width: 768px)" />
```markdown

### 4. Cache Aggressively

```ts
// Static assets: Long cache
'Cache-Control': 'public, max-age=31536000, immutable'

// API responses: Short cache with revalidation
'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'

// User-specific: No cache
'Cache-Control': 'private, no-cache'
```markdown

### 5. Prefetch Critical Resources

```astro
<head>
  <link rel="preload" href="/critical.css" as="style" />
  <link rel="preload" href="/hero.webp" as="image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
</head>
```text

---

## 🚫 Common Performance Mistakes

### Mistake 1: Loading Everything Immediately

```astro
<!-- ❌ Bad: All islands load immediately -->
<Header client:load />
<SearchForm client:load />
<Gallery client:load />
<Comments client:load />
<Footer client:load />

<!-- ✅ Good: Prioritize critical, defer rest -->
<Header /> <!-- Static Astro component -->
<SearchForm client:load /> <!-- Critical -->
<Gallery client:visible /> <!-- Below fold -->
<Comments client:idle /> <!-- Non-critical -->
<Footer /> <!-- Static Astro component -->
```markdown

### Mistake 2: Unoptimized Images

```astro
<!-- ❌ Bad: Large, unoptimized image -->
<img src="/hero-original.jpg" alt="Hero" /> <!-- 5MB JPEG -->

<!-- ✅ Good: Optimized with Astro -->
<Image
  src={heroImage}
  alt="Hero"
  format="webp"
  quality={80}
  width={1200}
  height={600}
/> <!-- ~200KB WebP -->
```markdown

### Mistake 3: No Code Splitting

```tsx
// ❌ Bad: Import heavy components upfront
import { ChartComponent } from './heavy-lib';
import { MapComponent } from './another-heavy-lib';

// ✅ Good: Lazy load
const ChartComponent = lazy(() => import('./heavy-lib'));
const MapComponent = lazy(() => import('./another-heavy-lib'));
```markdown

### Mistake 4: Blocking Render

```astro
<!-- ❌ Bad: Blocking script -->
<script src="/large-analytics.js"></script>

<!-- ✅ Good: Async or defer -->
<script src="/large-analytics.js" async></script>
<script src="/tracking.js" defer></script>
```markdown

### Mistake 5: Not Measuring

```text
❌ Bad: Deploy without testing
✅ Good: Measure before and after changes

# Before changes
npx lighthouse https://staging.hospeda.com.ar

# Make optimizations

# After changes
npx lighthouse https://staging.hospeda.com.ar

# Compare scores
```

---

## 🎯 Performance Checklist

Before deploying to production:

- [ ] Lighthouse Performance score > 95
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Total Blocking Time < 300ms
- [ ] All images optimized (WebP, lazy loaded)
- [ ] Critical CSS inlined
- [ ] Non-critical CSS deferred
- [ ] JavaScript code-split and lazy-loaded
- [ ] Proper hydration strategies (`client:*`)
- [ ] Static generation (SSG) where possible
- [ ] Cache headers configured
- [ ] External resources preconnected
- [ ] No console.log in production

---

## 📖 Additional Resources

### Internal Documentation

- **[SEO Guide](seo.md)** - SEO performance
- **[Islands Architecture](islands.md)** - Hydration strategies
- **[Debugging Guide](debugging.md)** - Performance debugging

### External Resources

- **[Web Vitals](https://web.dev/vitals/)** - Core Web Vitals guide
- **[Lighthouse](https://developer.chrome.com/docs/lighthouse/)** - Lighthouse documentation
- **[Astro Performance](https://docs.astro.build/en/guides/performance/)** - Astro-specific optimization

---

⬅️ Back to [Development Guide](README.md)
