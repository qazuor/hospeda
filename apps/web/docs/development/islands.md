# Islands Architecture

Complete guide to Astro's Islands Architecture pattern.

---

## 📖 Overview

**Islands Architecture** is a modern web architecture pattern where static HTML pages contain isolated pockets of interactivity ("islands"). This approach delivers optimal performance by sending minimal JavaScript to the client.

**Key Concept**: Most of the page is static HTML. Interactive pieces are "islands" that hydrate independently.

---

## 🏝️ What is Islands Architecture?

### Traditional SPA (Single Page App)

```text
┌─────────────────────────────────────┐
│                                     │
│   Entire Page = JavaScript Bundle   │
│   (Heavy, slow to load)             │
│                                     │
└─────────────────────────────────────┘
```

**Problem**: Sends unnecessary JavaScript for static content

### Islands Pattern

```text
┌─────────────────────────────────────┐
│  Static HTML                        │
│                                     │
│  ┌──────────┐    ┌──────────┐      │
│  │ Island 1 │    │ Island 2 │      │
│  │ (React)  │    │ (React)  │      │
│  └──────────┘    └──────────┘      │
│                                     │
│  Static HTML                        │
└─────────────────────────────────────┘
```

**Benefit**: JavaScript only where needed

---

## ⚡ How Astro Islands Work

### 1. Build Time: Static HTML Generation

Astro renders your entire page to static HTML at build time:

```astro
---
// This runs at BUILD TIME (Node.js)
const accommodation = await getAccommodation(slug);
---

<!-- This becomes STATIC HTML -->
<div>
  <h1>{accommodation.name}</h1>
  <p>{accommodation.description}</p>
</div>
```

**Output**: Pure HTML, no JavaScript

### 2. Selective Hydration: Interactive Islands

Add React components for interactivity:

```astro
---
import { SearchForm } from '../components/SearchForm.tsx';
---

<!-- Static HTML -->
<h1>Find Accommodations</h1>

<!-- Interactive Island -->
<SearchForm client:load />
```

**Output**: HTML + minimal JavaScript bundle for SearchForm only

### 3. Independent Islands

Each island hydrates independently:

```astro
<!-- Island 1: Loads immediately -->
<SearchForm client:load />

<!-- Island 2: Loads when visible -->
<Newsletter client:visible />

<!-- Island 3: Loads when idle -->
<Analytics client:idle />
```

---

## 🎯 When to Use Astro vs React

### Decision Flow

```text
Does this component need interactivity?
│
├─ NO  → Use Astro Component (.astro)
│   └─ Examples:
│       • Card layouts
│       • Headers/Footers
│       • Static content
│       • SEO components
│
└─ YES → Use React Component (.tsx)
    ├─ Examples:
    │   • Forms with validation
    │   • Search with filters
    │   • Interactive maps
    │   • Real-time data
    └─ Choose hydration strategy:
        ├─ Critical? → client:load
        ├─ Below fold? → client:visible
        └─ Not urgent? → client:idle
```

### Astro Components (Zero JavaScript)

**Use for**:

- Static content
- Layouts and structure
- SEO elements
- Navigation (unless interactive)
- Card/list displays
- Markdown content

**Example**:

```astro
---
// src/components/AccommodationCard.astro
interface Props {
  name: string;
  description: string;
  price: number;
}

const { name, description, price } = Astro.props;
---

<article class="card">
  <h3>{name}</h3>
  <p>{description}</p>
  <span class="price">${price}</span>
</article>

<style>
  .card {
    @apply rounded-lg shadow-md p-4;
  }
</style>
```

**Result**: Pure HTML, zero JavaScript sent to client

### React Islands (Selective JavaScript)

**Use for**:

- Forms with state
- Interactive filters
- Client-side search
- Real-time updates
- User interactions
- Dynamic UI

**Example**:

```tsx
// src/components/SearchForm.tsx
import { useState } from 'react';

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const data = await fetch(`/api/search?q=${query}`);
    setResults(await data.json());
  };

  return (
    <form onSubmit={handleSearch}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search accommodations..."
      />
      <button type="submit">Search</button>
      <div>{/* Results */}</div>
    </form>
  );
}
```

**Result**: HTML + React bundle (~40KB) + component code

---

## 🔧 Client Directives

Client directives control **when** and **how** React components hydrate.

### `client:load` - Immediate Hydration

Hydrates component immediately on page load (priority).

```astro
<SearchForm client:load />
```

**When to use**:

- Above-the-fold interactive content
- Critical user interactions
- Navigation components
- Forms that user sees immediately

**Performance Impact**: 🔴 High (loads immediately)

**Example Use Cases**:

- Main search form on homepage
- Primary navigation menu
- Login/signup forms

### `client:idle` - When Browser is Idle

Hydrates when browser has finished high-priority work (uses `requestIdleCallback`).

```astro
<NewsletterForm client:idle />
```

**When to use**:

- Non-critical interactions
- Below-the-fold content
- Secondary features
- Analytics/tracking

**Performance Impact**: 🟡 Medium (deferred)

**Example Use Cases**:

- Newsletter signup forms
- Social media embeds
- Comment sections
- Analytics widgets

### `client:visible` - When Component Enters Viewport

Hydrates when component becomes visible (uses `IntersectionObserver`).

```astro
<ImageGallery client:visible />
```

**When to use**:

- Content far below the fold
- Lazy-loaded sections
- Heavy components
- Infinite scroll

**Performance Impact**: 🟢 Low (only when needed)

**Example Use Cases**:

- Image galleries
- Charts and visualizations
- Infinite scroll lists
- Heavy data tables

### `client:media="{query}"` - Media Query Match

Hydrates when media query matches (responsive components).

```astro
<MobileMenu client:media="(max-width: 768px)" />
<DesktopSidebar client:media="(min-width: 769px)" />
```

**When to use**:

- Mobile-specific components
- Desktop-only features
- Responsive behavior
- Device-specific UI

**Performance Impact**: 🟢 Low (device-specific)

**Example Use Cases**:

- Mobile hamburger menu
- Desktop-only advanced filters
- Touch vs mouse interactions

### `client:only="{framework}"` - Client-Side Only

Skips server-side rendering, renders only in browser.

```astro
<ClientOnlyMap client:only="react" />
```

**When to use**:

- Components requiring browser APIs
- Third-party widgets
- Canvas/WebGL components
- Components with SSR issues

**Performance Impact**: 🔴 High (no SSR benefits)

**Example Use Cases**:

- Interactive maps (Leaflet, Mapbox)
- Browser storage components
- Window/document dependent code
- Third-party embed widgets

---

## 📊 Performance Comparison

### Example Page: Accommodation Detail

**Full React SPA**:

```text
JavaScript Bundle: ~250KB
Time to Interactive: ~3s
Lighthouse Score: 60
```

**Astro Islands**:

```text
Static HTML: 20KB
Island 1 (SearchForm): 15KB → client:load
Island 2 (Gallery): 25KB → client:visible
Island 3 (Reviews): 12KB → client:idle
Total Initial JS: 15KB (Island 1 only)
Time to Interactive: <1s
Lighthouse Score: 95+
```

**Improvement**: 94% less initial JavaScript

---

## 🎨 Composition Patterns

### Pattern 1: Static Container + Interactive Children

```astro
---
// Static Astro component as container
import { FilterBar } from '../components/FilterBar';
import { AccommodationCard } from '../components/AccommodationCard.astro';
---

<section class="accommodation-list">
  <!-- Interactive filter -->
  <FilterBar client:load />

  <!-- Static cards -->
  <div class="grid">
    {accommodations.map(acc => (
      <AccommodationCard accommodation={acc} />
    ))}
  </div>
</section>
```

### Pattern 2: Progressive Enhancement

```astro
---
import { SearchForm } from '../components/SearchForm';
---

<!-- Works without JavaScript (form submission) -->
<form action="/search" method="GET">
  <input name="q" placeholder="Search..." />
  <button>Search</button>
</form>

<!-- Enhanced with JavaScript (client-side search) -->
<SearchForm client:idle />
```

### Pattern 3: Lazy-Load Heavy Features

```astro
---
import { DataVisualization } from '../components/DataVisualization';
---

<!-- Static placeholder -->
<div id="chart-container">
  <p>Chart loading...</p>
</div>

<!-- Hydrate when user scrolls to it -->
<DataVisualization client:visible />
```

---

## ✅ Best Practices

### 1. Default to Astro Components

```astro
<!-- ✅ Good: Astro for static content -->
<AccommodationCard.astro accommodation={data} />

<!-- ❌ Avoid: React for static content -->
<AccommodationCard.tsx client:load accommodation={data} />
```

### 2. Choose Right Directive

```astro
<!-- ✅ Good: Defer non-critical -->
<Newsletter client:idle />

<!-- ❌ Avoid: Immediate load for non-critical -->
<Newsletter client:load />
```

### 3. Minimize Island Size

```tsx
// ❌ Bad: One large island
export function AccommodationPage() {
  return (
    <div>
      <Header /> {/* Static content in React */}
      <SearchForm /> {/* Interactive */}
      <Footer /> {/* Static content in React */}
    </div>
  );
}
```

```astro
<!-- ✅ Good: Small focused islands -->
<Header /> <!-- Astro component -->
<SearchForm client:load /> <!-- React island -->
<Footer /> <!-- Astro component -->
```

### 4. Share State Between Islands

Use Nanostores for cross-island state:

```ts
// store/search.ts
import { atom } from 'nanostores';

export const searchQuery = atom('');
```

```tsx
// Island 1: SearchForm
import { useStore } from '@nanostores/react';
import { searchQuery } from '../store/search';

export function SearchForm() {
  const query = useStore(searchQuery);
  return <input value={query} onChange={(e) => searchQuery.set(e.target.value)} />;
}
```

```tsx
// Island 2: SearchResults
import { useStore } from '@nanostores/react';
import { searchQuery } from '../store/search';

export function SearchResults() {
  const query = useStore(searchQuery);
  // Use query to fetch results
}
```

---

## 🚫 Common Mistakes

### Mistake 1: Using React for Everything

```astro
<!-- ❌ Bad: Unnecessary React -->
<Header.tsx client:load />
<Content.tsx client:load />
<Footer.tsx client:load />
```

```astro
<!-- ✅ Good: Astro for static -->
<Header.astro />
<Content.astro />
<Footer.astro />
```

### Mistake 2: Wrong Directive

```astro
<!-- ❌ Bad: Heavy component loads immediately -->
<HeavyChart client:load data={chartData} />
```

```astro
<!-- ✅ Good: Defer until visible -->
<HeavyChart client:visible data={chartData} />
```

### Mistake 3: Large Islands

```tsx
// ❌ Bad: Entire page as one island
export function PageIsland() {
  return (
    <div>
      <StaticHeader />
      <InteractiveForm />
      <StaticFooter />
    </div>
  );
}
```

```astro
<!-- ✅ Good: Separate concerns -->
<StaticHeader />
<InteractiveForm client:idle />
<StaticFooter />
```

---

## 🔍 Debugging Islands

### Check What's Loading

**Browser DevTools**:

1. Open Network tab
2. Filter by JavaScript
3. See which bundles load and when

**Expected**:

- Minimal JavaScript on initial load
- Islands load based on directives

### Verify Hydration

**Console check**:

```typescript
// In React component
useEffect(() => {
  console.log('Component hydrated!');
}, []);
```

### Performance Monitoring

```astro
<script>
  // Track when islands hydrate
  window.addEventListener('astro:page-load', () => {
    console.log('Page loaded');
  });
</script>
```

---

## 📚 Real-World Examples

### Example 1: Homepage

```astro
---
// Static content from CMS
import { Hero } from '../components/Hero.astro';
import { SearchForm } from '../components/SearchForm';
import { FeaturedAccommodations } from '../components/FeaturedAccommodations.astro';
import { Newsletter } from '../components/Newsletter';

const featured = await getFeaturedAccommodations();
---

<!-- Static hero -->
<Hero />

<!-- Interactive search (above fold) -->
<SearchForm client:load />

<!-- Static featured list -->
<FeaturedAccommodations accommodations={featured} />

<!-- Newsletter (below fold, non-critical) -->
<Newsletter client:visible />
```

**JavaScript Breakdown**:

- `client:load`: SearchForm (~15KB)
- `client:visible`: Newsletter (~8KB)
- Total initial: 15KB

### Example 2: Accommodation Detail Page

```astro
---
import { ImageGallery } from '../components/ImageGallery';
import { BookingForm } from '../components/BookingForm';
import { ReviewsList } from '../components/ReviewsList';
import { Map } from '../components/Map';

const accommodation = await getAccommodation(slug);
---

<!-- Static header -->
<h1>{accommodation.name}</h1>
<p>{accommodation.description}</p>

<!-- Gallery (loads when visible) -->
<ImageGallery client:visible images={accommodation.images} />

<!-- Booking form (critical, loads immediately) -->
<BookingForm client:load accommodation={accommodation} />

<!-- Map (loads when user scrolls to it) -->
<Map client:visible location={accommodation.location} />

<!-- Reviews (loads when browser idle) -->
<ReviewsList client:idle reviews={accommodation.reviews} />
```

**JavaScript Breakdown**:

- `client:load`: BookingForm (~20KB)
- `client:visible`: Gallery (~25KB), Map (~30KB)
- `client:idle`: ReviewsList (~12KB)
- Total initial: 20KB

---

## 📖 Additional Resources

### Internal Documentation

- **[Architecture Guide](../architecture.md)** - Overall architecture
- **[Component Organization](components.md)** - Component structure
- **[Pages & Routing](pages.md)** - Page structure

### External Resources

- **[Astro Islands Docs](https://docs.astro.build/en/concepts/islands/)** - Official documentation
- **[Islands Architecture](https://www.patterns.dev/posts/islands-architecture)** - Pattern explanation
- **[Partial Hydration](https://www.patterns.dev/posts/progressive-hydration)** - Hydration concepts

---

⬅️ Back to [Development Guide](README.md)
