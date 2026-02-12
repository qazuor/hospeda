---
name: react-performance
description: React performance optimization rules prioritized by impact. Use when optimizing re-renders, bundle size, lazy loading, or profiling React apps.
---

# React Performance

## Purpose

Comprehensive React performance optimization rules prioritized by real-world impact. Covers eliminating waterfalls, reducing bundle size, optimizing re-renders, lazy loading, code splitting, and profiling. Over 40 actionable rules organized from highest to lowest impact.

## Activation

Use this skill when the user asks about:

- React performance optimization
- Slow React application diagnosis
- Bundle size reduction
- Re-render optimization
- Lazy loading and code splitting
- React Server Components performance
- Data fetching waterfalls

## Tier 1: Critical Impact

These issues cause the most real-world performance problems. Fix these first.

### 1. Eliminate Request Waterfalls

The single biggest performance killer. Waterfalls happen when sequential requests depend on each other.

```tsx
// BAD: Waterfall - each request waits for the previous
function Dashboard() {
  const { data: user } = useQuery({ queryKey: ["user"], queryFn: fetchUser });
  // This doesn't start until user loads:
  const { data: orders } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => fetchOrders(user!.id),
    enabled: !!user,
  });
  // This doesn't start until orders load:
  const { data: recommendations } = useQuery({
    queryKey: ["recs", orders?.[0]?.id],
    queryFn: () => fetchRecs(orders![0].id),
    enabled: !!orders?.length,
  });
}

// GOOD: Parallel fetching - all requests start together
function Dashboard() {
  const results = useQueries({
    queries: [
      { queryKey: ["user"], queryFn: fetchUser },
      { queryKey: ["orders"], queryFn: fetchAllOrders },
      { queryKey: ["recs"], queryFn: fetchRecommendations },
    ],
  });
}

// BEST: Server Component - fetch on the server, no client waterfalls
async function Dashboard() {
  const [user, orders, recs] = await Promise.all([
    fetchUser(),
    fetchAllOrders(),
    fetchRecommendations(),
  ]);

  return <DashboardView user={user} orders={orders} recs={recs} />;
}
```

### 2. Use React Server Components for Data Fetching

Move data fetching to the server. Zero client-side JavaScript for server components.

```tsx
// Server Component (default in Next.js App Router)
// This component sends ZERO JavaScript to the client
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  const reviews = await db.review.findMany({ where: { productId: params.id } });

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      {/* Only this interactive part ships JS */}
      <AddToCartButton productId={product.id} price={product.price} />
      <ReviewList reviews={reviews} />
    </div>
  );
}
```

### 3. Code Split at the Route Level

Every route should be a separate chunk. Users only download code for the page they visit.

```tsx
// Next.js App Router: automatic per-route code splitting
// app/dashboard/page.tsx -> separate chunk
// app/settings/page.tsx -> separate chunk

// React Router: lazy routes
import { lazy } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Suspense>
  );
}
```

### 4. Lazy Load Heavy Components

Components with large dependencies should be code-split.

```tsx
import { lazy, Suspense } from "react";

// BAD: Imports entire library on page load
import { Editor } from "@monaco-editor/react";
import { Chart } from "chart.js/auto";
import { Map } from "react-map-gl";

// GOOD: Lazy load heavy components
const Editor = lazy(() => import("@monaco-editor/react"));
const Chart = lazy(() => import("./ChartWrapper"));
const Map = lazy(() => import("./MapWrapper"));

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      {showEditor && (
        <Suspense fallback={<EditorSkeleton />}>
          <Editor />
        </Suspense>
      )}
      <Suspense fallback={<ChartSkeleton />}>
        <Chart data={chartData} />
      </Suspense>
    </div>
  );
}
```

### 5. Optimize Images

Images are typically the largest assets. Always optimize them.

```tsx
// Next.js Image: automatic optimization, lazy loading, sizing
import Image from "next/image";

// GOOD: Responsive image with proper sizing
<Image
  src="/hero.jpg"
  alt="Hero banner"
  width={1200}
  height={600}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  priority          // Only for above-the-fold images
  placeholder="blur" // Show blur while loading
  blurDataURL={blurUrl}
/>

// For background/decorative images
<Image
  src="/bg-pattern.png"
  alt=""
  fill
  className="object-cover"
  sizes="100vw"
  quality={75}     // Default is 75, lower for backgrounds
/>
```

Rules:

- Use `next/image` or similar optimization library
- Set `priority` only for above-the-fold images (LCP candidates)
- Always provide `sizes` for responsive images
- Use `width` and `height` or `fill` to prevent CLS
- Use WebP/AVIF formats (Next.js does this automatically)
- Lazy load below-the-fold images (default behavior)

### 6. Reduce Bundle Size

Audit and shrink your JavaScript bundle.

```bash
# Analyze bundle
npx @next/bundle-analyzer
# or
npx source-map-explorer dist/**/*.js
```

Common bundle bloat sources and fixes:

| Library | Size | Alternative |
|---|---|---|
| `moment.js` | 300KB | `date-fns` (tree-shakable) or `dayjs` (2KB) |
| `lodash` (full) | 530KB | `lodash-es` + specific imports, or native methods |
| `chart.js/auto` | 200KB | Import only needed chart types |
| `@mui/material` | 300KB+ | Ensure tree-shaking, import from subpaths |
| `@fortawesome/fontawesome` | 1.5MB | Import only used icons |

```typescript
// BAD: Imports everything
import _ from "lodash";
import { format } from "date-fns";         // OK but...
import * as dateFns from "date-fns";        // BAD: imports all

// GOOD: Tree-shakable imports
import groupBy from "lodash-es/groupBy";
import { format } from "date-fns/format";   // Subpath import
```

## Tier 2: High Impact

### 7. Avoid Unnecessary Re-renders with Composition

The best optimization is not needing `memo` at all. Use component composition to isolate state.

```tsx
// BAD: Entire page re-renders when search changes
function ProductPage() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      <ExpensiveHeader />              {/* Re-renders on every keystroke */}
      <ExpensiveSidebar />             {/* Re-renders on every keystroke */}
      <ProductList products={products} />
    </div>
  );
}

// GOOD: Extract stateful component - siblings don't re-render
function ProductPage() {
  const [products, setProducts] = useState([]);

  return (
    <div>
      <SearchInput />                  {/* State is isolated here */}
      <ExpensiveHeader />              {/* Does NOT re-render */}
      <ExpensiveSidebar />             {/* Does NOT re-render */}
      <ProductList products={products} />
    </div>
  );
}

function SearchInput() {
  const [search, setSearch] = useState("");
  return <input value={search} onChange={(e) => setSearch(e.target.value)} />;
}
```

### 8. Use `children` Pattern to Prevent Re-renders

```tsx
// BAD: Children re-render when parent state changes
function Layout() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Sidebar isOpen={isOpen} />
      <ExpensiveContent />    {/* Re-renders when isOpen changes */}
    </div>
  );
}

// GOOD: Children passed as props don't re-render
function Layout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Sidebar isOpen={isOpen} />
      {children}              {/* Does NOT re-render when isOpen changes */}
    </div>
  );
}

// Usage:
<Layout>
  <ExpensiveContent />
</Layout>
```

### 9. Memoize Expensive Computations

```tsx
// BAD: Recalculates on every render
function ProductList({ products, filter }: Props) {
  const filtered = products
    .filter((p) => p.category === filter)
    .sort((a, b) => a.price - b.price)
    .map((p) => ({ ...p, discount: calculateDiscount(p) }));

  return <List items={filtered} />;
}

// GOOD: Only recalculates when dependencies change
function ProductList({ products, filter }: Props) {
  const filtered = useMemo(
    () =>
      products
        .filter((p) => p.category === filter)
        .sort((a, b) => a.price - b.price)
        .map((p) => ({ ...p, discount: calculateDiscount(p) })),
    [products, filter]
  );

  return <List items={filtered} />;
}
```

When to use `useMemo`:

- Filtering/sorting large arrays (100+ items)
- Complex calculations (aggregations, transformations)
- Creating objects/arrays passed to memoized children
- NOT for simple operations or primitives

### 10. Stabilize Callback References

```tsx
// BAD: New function reference every render, breaks child memo
function Parent() {
  const [items, setItems] = useState([]);

  return (
    <ExpensiveChild
      onDelete={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
    />
  );
}

// GOOD: Stable reference with useCallback
function Parent() {
  const [items, setItems] = useState([]);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []); // Empty deps because we use functional update

  return <ExpensiveChild onDelete={handleDelete} />;
}
```

### 11. Use `React.memo` Strategically

```tsx
// Memoize components that:
// - Receive the same props frequently
// - Are expensive to render
// - Render often due to parent updates

const ExpensiveList = React.memo(function ExpensiveList({
  items,
  onSelect,
}: Props) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} onClick={() => onSelect(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
});

// Custom comparison for complex props
const Chart = React.memo(
  function Chart({ data, config }: ChartProps) {
    // Expensive rendering
    return <canvas ref={canvasRef} />;
  },
  (prevProps, nextProps) => {
    // Only re-render if data length or config changes
    return (
      prevProps.data.length === nextProps.data.length &&
      prevProps.config.type === nextProps.config.type
    );
  }
);
```

### 12. Virtualize Long Lists

Render only visible items. Essential for lists over 50-100 items.

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,    // Estimated row height in px
    overscan: 5,               // Render 5 extra items above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: "600px", overflow: "auto" }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ItemRow item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 13. Debounce Expensive Operations

```tsx
import { useDeferredValue, useMemo, useState, useTransition } from "react";

// Option 1: useDeferredValue (React 18+)
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  const results = useMemo(
    () => filterItems(allItems, deferredQuery),
    [deferredQuery]
  );

  return (
    <div style={{ opacity: isStale ? 0.7 : 1 }}>
      {results.map((item) => <Item key={item.id} {...item} />)}
    </div>
  );
}

// Option 2: useTransition for user-initiated updates
function SearchPage() {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Urgent: update input immediately
    setQuery(e.target.value);

    // Non-urgent: update results with lower priority
    startTransition(() => {
      setSearchResults(filterItems(e.target.value));
    });
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <Results />
    </>
  );
}

// Option 3: Debounce for API calls
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function Search() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchAPI(debouncedQuery),
    enabled: debouncedQuery.length > 2,
  });
}
```

## Tier 3: Medium Impact

### 14. Avoid Creating Objects/Arrays in JSX

```tsx
// BAD: New object every render, breaks memo
<Chart config={{ type: "line", color: "blue" }} />
<List items={data.filter((d) => d.active)} />

// GOOD: Stable references
const chartConfig = useMemo(() => ({ type: "line", color: "blue" }), []);
const activeItems = useMemo(() => data.filter((d) => d.active), [data]);

<Chart config={chartConfig} />
<List items={activeItems} />
```

### 15. Use CSS Instead of JS for Animations

```tsx
// BAD: JS-driven animation causes re-renders
function AnimatedBox() {
  const [x, setX] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setX((prev) => prev + 1));
    return () => cancelAnimationFrame(id);
  });
  return <div style={{ transform: `translateX(${x}px)` }} />;
}

// GOOD: CSS transition, zero re-renders
function AnimatedBox({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className={`transform transition-transform duration-200 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    />
  );
}
```

### 16. Prefetch Data for Likely Navigation

```tsx
// Next.js: prefetch on link hover
import Link from "next/link";
<Link href="/dashboard" prefetch>Dashboard</Link>

// React Query: prefetch on hover
function ProductCard({ product }: { product: Product }) {
  const queryClient = useQueryClient();

  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: ["product", product.id],
      queryFn: () => fetchProduct(product.id),
      staleTime: 60_000,
    });
  };

  return (
    <Link href={`/products/${product.id}`} onMouseEnter={prefetch}>
      {product.name}
    </Link>
  );
}
```

### 17. Optimize Context Usage

```tsx
// BAD: Single context for everything, all consumers re-render
const AppContext = createContext({ user: null, theme: "light", notifications: [] });

// GOOD: Split contexts by update frequency
const UserContext = createContext<User | null>(null);
const ThemeContext = createContext<"light" | "dark">("light");
const NotificationContext = createContext<Notification[]>([]);

// GOOD: Separate state from dispatch
const TodoStateContext = createContext<Todo[]>([]);
const TodoDispatchContext = createContext<Dispatch<TodoAction>>(() => {});

function TodoProvider({ children }: { children: React.ReactNode }) {
  const [todos, dispatch] = useReducer(todoReducer, []);

  return (
    <TodoStateContext.Provider value={todos}>
      <TodoDispatchContext.Provider value={dispatch}>
        {children}
      </TodoDispatchContext.Provider>
    </TodoStateContext.Provider>
  );
}
```

### 18. Use `key` to Reset Components

```tsx
// Force remount when user changes (resets all internal state)
<UserProfile key={userId} userId={userId} />

// Reset form when editing different items
<EditForm key={item.id} item={item} />
```

### 19. Optimize Third-Party Scripts

```tsx
// Next.js Script component
import Script from "next/script";

// Load analytics after page is interactive
<Script
  src="https://analytics.example.com/script.js"
  strategy="afterInteractive"
/>

// Load non-critical scripts when idle
<Script
  src="https://chatwidget.example.com/widget.js"
  strategy="lazyOnload"
/>

// Inline critical scripts
<Script id="theme" strategy="beforeInteractive">
  {`document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light'`}
</Script>
```

### 20. Use Streaming and Suspense

```tsx
// Stream HTML from server, show content progressively
async function Page() {
  return (
    <div>
      {/* Renders immediately */}
      <Header />
      <h1>Dashboard</h1>

      {/* Streams in when data is ready */}
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}

// Each component can fetch independently
async function Stats() {
  const stats = await fetchStats();   // Blocks only this component
  return <StatsGrid data={stats} />;
}
```

## Profiling and Measurement

### React DevTools Profiler

1. Open React DevTools > Profiler tab
2. Click Record, interact with the app, click Stop
3. Look for:
   - Components rendering unnecessarily (highlight updates)
   - Long render times (> 16ms for 60fps)
   - Components rendering too frequently

### Web Vitals Monitoring

```typescript
// app/layout.tsx (Next.js)
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}

// Custom reporting
import { onCLS, onINP, onLCP } from "web-vitals";

onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

### Performance Budget

Set and enforce performance budgets:

| Metric | Budget |
|---|---|
| Total JS (compressed) | < 200KB |
| First Load JS per route | < 100KB |
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| Time to Interactive | < 3.5s |

## Quick Reference Checklist

### Before Every PR

- [ ] No new request waterfalls introduced
- [ ] Heavy components are lazy-loaded
- [ ] Images use `next/image` or equivalent optimization
- [ ] New dependencies justified and tree-shakable
- [ ] Lists over 50 items are virtualized
- [ ] No inline object/array creation in JSX for memoized children

### Performance Audit Checklist

- [ ] Run Lighthouse (target > 90 performance score)
- [ ] Check bundle with `@next/bundle-analyzer`
- [ ] Profile with React DevTools
- [ ] Test on slow 3G with CPU throttling
- [ ] Verify Core Web Vitals in production (CrUX data)
- [ ] Check for layout shifts on page load
- [ ] Confirm no unnecessary client-side JavaScript (server components used)
- [ ] Verify proper caching headers on static assets
