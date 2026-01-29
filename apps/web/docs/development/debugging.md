# Debugging Guide

Complete guide to debugging Astro + React applications in Hospeda Web App.

---

## 📖 Overview

Debugging a hybrid Astro + React app requires understanding **where code runs**:

- **Build time** (Node.js) - Astro frontmatter, `getStaticPaths`
- **Server time** (Node.js) - SSR pages, API endpoints
- **Client time** (Browser) - React components, client scripts

**Tools**:

- 🔧 Astro Dev Toolbar
- 🌐 Browser DevTools
- ⚛️ React DevTools
- 📝 Console logging
- 🐛 VS Code debugger

---

## 🔧 Astro Dev Toolbar

### Enable Dev Toolbar

The Dev Toolbar appears automatically in development mode.

**Features**:

- 🏝️ **Islands Inspector** - See which components are hydrated
- 📊 **Performance Audit** - Check page performance
- 🎨 **UI Inspector** - Inspect component boundaries
- 🔍 **Console** - View server logs

### Using Islands Inspector

```astro
---
import { SearchForm } from '../components/SearchForm';
import { Newsletter } from '../components/Newsletter';
---

<!-- These islands will show in the toolbar -->
<SearchForm client:load />
<Newsletter client:idle />
```text

**Toolbar shows**:

- Which islands are loaded
- Hydration strategy (`client:load`, `client:idle`, etc.)
- Component size and performance

### Audit Page Performance

Click **Audit** tab in Dev Toolbar to see:

- Page load time
- JavaScript bundle sizes
- Hydration performance
- Recommendations

---

## 🌐 Browser DevTools

### Console Debugging

#### Basic Logging

```tsx
// src/components/SearchForm.tsx
import { useState } from 'react';

export function SearchForm() {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    console.log('Search query:', query);
    console.log('Query length:', query.length);

    // Fetch results...
  };

  return (
    <input
      value={query}
      onChange={(e) => {
        console.log('Input changed:', e.target.value);
        setQuery(e.target.value);
      }}
    />
  );
}
```markdown

#### Conditional Logging

```tsx
if (import.meta.env.DEV) {
  console.log('Development only log');
}

// Or use debug flag
const DEBUG = import.meta.env.PUBLIC_DEBUG === 'true';

if (DEBUG) {
  console.log('Debug mode active');
}
```markdown

#### Grouped Logs

```tsx
console.group('Search Operation');
console.log('Query:', query);
console.log('Filters:', filters);
console.log('Page:', currentPage);
console.groupEnd();
```markdown

#### Table Display

```tsx
const accommodations = [
  { id: 1, name: 'Hotel A', price: 100 },
  { id: 2, name: 'Hotel B', price: 150 }
];

console.table(accommodations);
```markdown

### Network Tab

**Debug API requests**:

1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Click request to see:
   - Request URL
   - Request headers
   - Request body
   - Response status
   - Response data

**Common Issues**:

```tsx
// Check if request is being made
const response = await fetch('/api/accommodations');
console.log('Response status:', response.status);
console.log('Response headers:', response.headers);

const data = await response.json();
console.log('Response data:', data);
```markdown

### Sources Tab (Breakpoints)

**Set breakpoints in React components**:

1. Open DevTools → Sources
2. Find your component file
3. Click line number to set breakpoint
4. Interact with app
5. Code pauses at breakpoint
6. Inspect variables in Scope panel

**Conditional Breakpoints**:

Right-click line number → Add conditional breakpoint

```javascript
// Only break if query is empty
query === ''

// Only break for specific user
userId === '123'
```text

---

## ⚛️ React DevTools

### Installation

**Browser Extension**:

- Chrome: [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- Firefox: [React DevTools](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

### Components Tab

**Inspect component tree**:

1. Open React DevTools
2. Click "Components" tab
3. Browse component tree
4. Click component to see:
   - Props
   - State
   - Hooks

**Example**:

```tsx
// src/components/SearchForm.tsx
export function SearchForm({ initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);

  // In React DevTools, you'll see:
  // Props: { initialQuery: '' }
  // State: { query: '', results: [] }
}
```markdown

### Profiler Tab

**Measure performance**:

1. Open Profiler tab
2. Click record (⏺️)
3. Interact with app
4. Stop recording
5. See render times

**Identifies**:

- Slow components
- Unnecessary re-renders
- Render frequency

---

## 🐛 Debugging Astro Pages

### Build-Time Errors

**Errors in frontmatter** (runs at build time):

```astro
---
// ❌ This error appears during BUILD
const accommodations = await fetchAccommodations();

if (!accommodations) {
  throw new Error('Failed to fetch accommodations');
}
---
```text

**How to debug**:

```astro
---
try {
  const result = await service.findAll();

  if (!result.success) {
    console.error('Build error:', result.error);
  }

  const accommodations = result.success ? result.data.items : [];
} catch (error) {
  console.error('Unexpected build error:', error);
}
---
```markdown

### Server-Side (SSR) Errors

**For SSR pages** (`prerender: false`):

```astro
---
export const prerender = false;

console.log('This runs on SERVER for each request');

const { userId } = Astro.locals;
console.log('User ID:', userId);

// Check server logs (terminal)
---
```text

**Debug in terminal** where `pnpm dev` is running.

### Client-Side Errors

**Errors in `<script>` tags**:

```astro
<script>
  // This runs in BROWSER
  console.log('Client-side log');

  try {
    document.getElementById('btn')?.addEventListener('click', () => {
      console.log('Button clicked');
    });
  } catch (error) {
    console.error('Client error:', error);
  }
</script>
```text

**Check browser console** for errors.

---

## 🏝️ Debugging Islands

### Common Island Issues

#### Issue 1: Component Not Hydrating

```astro
<!-- ❌ Missing client directive -->
<SearchForm />

<!-- ✅ Add client directive -->
<SearchForm client:load />
```markdown

#### Issue 2: Props Not Passing

```astro
---
const data = { name: 'Test' };
---

<!-- ❌ Passing complex objects -->
<MyComponent client:load data={data} />

<!-- ✅ Serialize data -->
<MyComponent client:load data={JSON.stringify(data)} />

<!-- Or pass as individual props -->
<MyComponent client:load name={data.name} />
```markdown

#### Issue 3: State Not Syncing

**Problem**: Multiple islands with shared state

**Solution**: Use Nanostores

```tsx
// src/store/search.ts
import { atom } from 'nanostores';

export const searchQuery = atom('');
```text

```tsx
// Island 1
import { useStore } from '@nanostores/react';
import { searchQuery } from '../store/search';

export function SearchInput() {
  const query = useStore(searchQuery);

  return (
    <input
      value={query}
      onChange={(e) => searchQuery.set(e.target.value)}
    />
  );
}
```text

```tsx
// Island 2
import { useStore } from '@nanostores/react';
import { searchQuery } from '../store/search';

export function SearchResults() {
  const query = useStore(searchQuery);
  // Query is synced across islands
}
```markdown

### Debug Hydration

```astro
<SearchForm client:load />

<script>
  // Check if component hydrated
  window.addEventListener('astro:page-load', () => {
    console.log('Page loaded and islands hydrated');
  });
</script>
```text

---

## 📊 Network Debugging

### Debug Fetch Requests

```tsx
// src/components/AccommodationList.tsx
import { useEffect, useState } from 'react';

export function AccommodationList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching accommodations...');

        const response = await fetch('/api/accommodations');

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        console.log('Response data:', json);

        setData(json);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err);
      }
    };

    fetchData();
  }, []);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  // ...
}
```markdown

### Debug API Endpoints

```ts
// src/pages/api/accommodations.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  console.log('API called:', request.url);

  try {
    // Your logic
    const data = await fetchData();

    console.log('Returning data:', data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```text

---

## 🗺️ Source Maps

### Enable Source Maps

Source maps help debug minified code in production.

**Already enabled** in Astro by default for development.

### Debug Production Build

```bash
# Build with source maps
pnpm build

# Preview production build
pnpm preview
```text

Open DevTools → Sources tab to see original source files.

---

## 📝 Logging Strategies

### Structured Logging

```ts
// src/lib/logger.ts
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export const logger = new Logger(
  import.meta.env.DEV ? 'debug' : 'warn'
);
```text

**Usage**:

```tsx
import { logger } from '../lib/logger';

export function SearchForm() {
  const handleSearch = async (query: string) => {
    logger.debug('Search initiated', { query });

    try {
      const results = await fetchResults(query);
      logger.info('Search successful', { count: results.length });
    } catch (error) {
      logger.error('Search failed', error);
    }
  };
}
```markdown

### Performance Logging

```tsx
export function AccommodationList() {
  useEffect(() => {
    const start = performance.now();

    const fetchData = async () => {
      const response = await fetch('/api/accommodations');
      const data = await response.json();

      const end = performance.now();
      console.log(`Fetch took ${end - start}ms`);

      setData(data);
    };

    fetchData();
  }, []);
}
```text

---

## 🚨 Common Errors & Solutions

### Error: "Cannot read property of undefined"

**Problem**:

```tsx
const accommodation = props.accommodation;
console.log(accommodation.name); // Error if accommodation is undefined
```text

**Solution**:

```tsx
const accommodation = props.accommodation;

if (!accommodation) {
  console.error('Accommodation is undefined');
  return <div>No accommodation data</div>;
}

console.log(accommodation.name); // Safe
```markdown

### Error: "fetch is not defined" (Build Time)

**Problem**:

```astro
---
// ❌ fetch doesn't exist at build time in older Node versions
const data = await fetch('/api/data');
---
```text

**Solution**:

```astro
---
// ✅ Use node-fetch or Astro.fetch
const response = await fetch(`${import.meta.env.PUBLIC_API_URL}/data`);

// Or use services that handle this
import { AccommodationService } from '@repo/service-core';
const service = new AccommodationService();
const result = await service.findAll();
---
```markdown

### Error: "window is not defined" (SSR)

**Problem**:

```tsx
// ❌ window doesn't exist on server
const width = window.innerWidth;
```text

**Solution**:

```tsx
// ✅ Check if window exists
const width = typeof window !== 'undefined' ? window.innerWidth : 0;

// Or use useEffect (client-side only)
useEffect(() => {
  const width = window.innerWidth;
  console.log('Width:', width);
}, []);
```markdown

### Error: "localStorage is not defined" (SSR)

**Problem**:

```tsx
// ❌ localStorage doesn't exist on server
const saved = localStorage.getItem('key');
```text

**Solution**:

```tsx
// ✅ Check environment
const saved = typeof window !== 'undefined'
  ? localStorage.getItem('key')
  : null;
```markdown

### Error: Module Not Found

**Problem**:

```tsx
// ❌ Wrong path
import { Button } from '../components/Button';
```text

**Solution**:

```tsx
// ✅ Check file extension and path
import { Button } from '../components/ui/Button';

// Or use path alias (if configured)
import { Button } from '@/components/ui/Button';
```text

---

## 💡 Best Practices

### 1. Use Descriptive Logs

```tsx
// ❌ Bad: Unclear log
console.log(data);

// ✅ Good: Descriptive log
console.log('Fetched accommodations:', data);
```markdown

### 2. Remove Debug Logs Before Commit

```tsx
// ❌ Bad: Console logs in production
console.log('Debug: user clicked button');

// ✅ Good: Conditional logging
if (import.meta.env.DEV) {
  console.log('Debug: user clicked button');
}
```markdown

### 3. Handle Errors Gracefully

```tsx
// ❌ Bad: Silent failure
try {
  await fetchData();
} catch {}

// ✅ Good: Log and handle
try {
  await fetchData();
} catch (error) {
  console.error('Failed to fetch data:', error);
  setError(error.message);
}
```markdown

### 4. Use Error Boundaries (React)

```tsx
// src/components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
```text

**Usage**:

```tsx
<ErrorBoundary>
  <SearchForm client:load />
</ErrorBoundary>
```sql

---

## 🔍 VS Code Debugging

### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Astro Dev Server",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

**Usage**:

1. Set breakpoints in `.astro` frontmatter
2. Press F5 or click "Run and Debug"
3. Server starts in debug mode
4. Code pauses at breakpoints

---

## 📖 Additional Resources

### Internal Documentation

- **[Performance Guide](performance.md)** - Performance debugging
- **[Islands Architecture](islands.md)** - Understanding hydration
- **[Data Fetching](data-fetching.md)** - Debug data issues

### External Resources

- **[Astro Debugging](https://docs.astro.build/en/guides/troubleshooting/)** - Official debugging guide
- **[React DevTools](https://react.dev/learn/react-developer-tools)** - React debugging
- **[Chrome DevTools](https://developer.chrome.com/docs/devtools/)** - Browser debugging

---

⬅️ Back to [Development Guide](README.md)
