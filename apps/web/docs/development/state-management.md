# State Management

Complete guide to state management with Nanostores in Hospeda Web App.

---

## 📖 Overview

Hospeda Web App uses **Nanostores** for lightweight state management across components and islands.

**Why Nanostores?**

- Tiny size (~300 bytes)
- Framework-agnostic
- Perfect for Islands Architecture
- Type-safe with TypeScript
- Simple API

---

## 🏪 Store Types

### Atom (Single Value)

Store a single value:

```typescript
// src/store/theme.ts
import { atom } from 'nanostores';

export const theme = atom<'light' | 'dark'>('light');

// Actions
export function toggleTheme() {
  theme.set(theme.get() === 'light' ? 'dark' : 'light');
}
```markdown

### Map (Object)

Store an object with multiple properties:

```typescript
// src/store/search.ts
import { map } from 'nanostores';

interface SearchFilters {
  query: string;
  location: string | null;
  priceMin: number;
  priceMax: number;
}

export const searchFilters = map<SearchFilters>({
  query: '',
  location: null,
  priceMin: 0,
  priceMax: 10000
});

// Actions
export function updateFilters(filters: Partial<SearchFilters>) {
  searchFilters.set({
    ...searchFilters.get(),
    ...filters
  });
}

export function clearFilters() {
  searchFilters.set({
    query: '',
    location: null,
    priceMin: 0,
    priceMax: 10000
  });
}
```text

---

## ⚛️ Using Stores in React

### Reading Store Value

```tsx
// src/components/SearchForm.tsx
import { useStore } from '@nanostores/react';
import { searchFilters } from '../store/search';

export function SearchForm() {
  const filters = useStore(searchFilters);

  return (
    <div>
      <p>Query: {filters.query}</p>
      <p>Location: {filters.location ?? 'All'}</p>
    </div>
  );
}
```markdown

### Updating Store Value

```tsx
import { useStore } from '@nanostores/react';
import { searchFilters, updateFilters, clearFilters } from '../store/search';

export function SearchFilters() {
  const filters = useStore(searchFilters);

  const handleQueryChange = (query: string) => {
    updateFilters({ query });
  };

  const handleLocationChange = (location: string) => {
    updateFilters({ location });
  };

  return (
    <div>
      <input
        value={filters.query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Search..."
      />

      <select
        value={filters.location ?? ''}
        onChange={(e) => handleLocationChange(e.target.value || null)}
      >
        <option value="">All Locations</option>
        <option value="centro">Centro</option>
        <option value="costanera">Costanera</option>
      </select>

      <button onClick={clearFilters}>Clear Filters</button>
    </div>
  );
}
```text

---

## 🌟 Using Stores in Astro

### Reading in Frontmatter

```astro
---
// src/pages/search.astro
import { searchFilters } from '../store/search';

// Get current value
const filters = searchFilters.get();
---

<div>
  <p>Current query: {filters.query}</p>
</div>
```markdown

### Subscribing to Changes

```astro
<div id="search-status"></div>

<script>
  import { searchFilters } from '../store/search';

  // Subscribe to changes
  const unsubscribe = searchFilters.subscribe((filters) => {
    const statusEl = document.getElementById('search-status');
    if (statusEl) {
      statusEl.textContent = `Searching for: ${filters.query}`;
    }
  });

  // Clean up on page navigation
  document.addEventListener('astro:before-swap', () => {
    unsubscribe();
  });
</script>
```sql

---

## 🔄 Computed Values

### Derived Stores

Create computed values from other stores:

```typescript
// src/store/cart.ts
import { atom, computed } from 'nanostores';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export const cart = atom<CartItem[]>([]);

// Computed: total items
export const totalItems = computed(cart, (items) =>
  items.reduce((sum, item) => sum + item.quantity, 0)
);

// Computed: total price
export const totalPrice = computed(cart, (items) =>
  items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
);

// Actions
export function addToCart(item: CartItem) {
  const current = cart.get();
  const existing = current.find(i => i.id === item.id);

  if (existing) {
    cart.set(
      current.map(i =>
        i.id === item.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
    );
  } else {
    cart.set([...current, { ...item, quantity: 1 }]);
  }
}

export function removeFromCart(id: string) {
  cart.set(cart.get().filter(item => item.id !== id));
}
```markdown

### Using Computed Stores

```tsx
import { useStore } from '@nanostores/react';
import { cart, totalItems, totalPrice } from '../store/cart';

export function CartSummary() {
  const items = useStore(cart);
  const itemCount = useStore(totalItems);
  const price = useStore(totalPrice);

  return (
    <div>
      <p>Items: {itemCount}</p>
      <p>Total: ${price.toFixed(2)}</p>

      <ul>
        {items.map(item => (
          <li key={item.id}>
            {item.name} x {item.quantity}
          </li>
        ))}
      </ul>
    </div>
  );
}
```text

---

## 🔐 Persistent Stores

### Local Storage Sync

```typescript
// src/store/preferences.ts
import { atom } from 'nanostores';

const STORAGE_KEY = 'user-preferences';

interface Preferences {
  theme: 'light' | 'dark';
  language: 'es' | 'en';
}

// Load from localStorage
const loadPreferences = (): Preferences => {
  if (typeof window === 'undefined') {
    return { theme: 'light', language: 'es' };
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { theme: 'light', language: 'es' };
    }
  }

  return { theme: 'light', language: 'es' };
};

export const preferences = atom<Preferences>(loadPreferences());

// Subscribe to save changes
if (typeof window !== 'undefined') {
  preferences.subscribe((value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  });
}

// Actions
export function setTheme(theme: 'light' | 'dark') {
  preferences.set({ ...preferences.get(), theme });
}

export function setLanguage(language: 'es' | 'en') {
  preferences.set({ ...preferences.get(), language });
}
```text

---

## 🎯 Common Patterns

### Loading States

```typescript
// src/store/accommodations.ts
import { atom, map } from 'nanostores';
import type { Accommodation } from '@repo/types';

export const accommodations = atom<Accommodation[]>([]);
export const loading = atom(false);
export const error = atom<string | null>(null);

export async function fetchAccommodations() {
  loading.set(true);
  error.set(null);

  try {
    const response = await fetch('/api/accommodations');
    if (!response.ok) throw new Error('Failed to fetch');

    const data = await response.json();
    accommodations.set(data);
  } catch (err) {
    error.set(err instanceof Error ? err.message : 'Unknown error');
  } finally {
    loading.set(false);
  }
}
```text

```tsx
import { useStore } from '@nanostores/react';
import { accommodations, loading, error, fetchAccommodations } from '../store/accommodations';
import { useEffect } from 'react';

export function AccommodationList() {
  const items = useStore(accommodations);
  const isLoading = useStore(loading);
  const errorMsg = useStore(error);

  useEffect(() => {
    fetchAccommodations();
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (errorMsg) return <div>Error: {errorMsg}</div>;

  return (
    <div>
      {items.map(acc => (
        <div key={acc.id}>{acc.name}</div>
      ))}
    </div>
  );
}
```markdown

### Pagination

```typescript
// src/store/pagination.ts
import { map } from 'nanostores';

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export const pagination = map<PaginationState>({
  currentPage: 1,
  pageSize: 12,
  totalPages: 1,
  totalItems: 0
});

export function setPage(page: number) {
  pagination.setKey('currentPage', page);
}

export function setTotalItems(total: number) {
  const { pageSize } = pagination.get();
  pagination.set({
    ...pagination.get(),
    totalItems: total,
    totalPages: Math.ceil(total / pageSize)
  });
}

export function nextPage() {
  const { currentPage, totalPages } = pagination.get();
  if (currentPage < totalPages) {
    setPage(currentPage + 1);
  }
}

export function prevPage() {
  const { currentPage } = pagination.get();
  if (currentPage > 1) {
    setPage(currentPage - 1);
  }
}
```text

---

## ✅ Best Practices

### 1. Organize Stores by Domain

```text
src/store/
├── search.ts          # Search-related state
├── cart.ts            # Shopping cart
├── user.ts            # User authentication
├── preferences.ts     # User preferences
└── index.ts           # Barrel export
```markdown

### 2. Colocate Actions with Stores

```typescript
// ✅ Good: Actions with store
export const cart = atom<CartItem[]>([]);

export function addToCart(item: CartItem) { ... }
export function removeFromCart(id: string) { ... }
```text

```typescript
// ❌ Avoid: Separate action files
// store/cart.ts
export const cart = atom<CartItem[]>([]);

// actions/cart.ts (separate file)
export function addToCart(item: CartItem) { ... }
```markdown

### 3. Type Everything

```typescript
// ✅ Good: Fully typed
interface User {
  id: string;
  name: string;
  email: string;
}

export const currentUser = atom<User | null>(null);
```text

```typescript
// ❌ Avoid: Untyped
export const currentUser = atom(null);
```markdown

### 4. Don't Overuse Global State

```typescript
// ❌ Avoid: Everything in global state
export const formData = map({ ... });
export const validationErrors = map({ ... });
export const isDirty = atom(false);

// ✅ Better: Local component state for forms
function MyForm() {
  const [formData, setFormData] = useState({ ... });
  // Form state stays local
}
```markdown

### 5. Clean Up Subscriptions

```typescript
// In React (automatic with useStore)
const value = useStore(myStore); // Cleaned up on unmount

// In vanilla JS (manual cleanup)
const unsubscribe = myStore.subscribe(() => { ... });

// Clean up when done
document.addEventListener('astro:before-swap', () => {
  unsubscribe();
});
```text

---

## 🚫 Common Mistakes

### Mistake 1: Mutating Store Directly

```typescript
// ❌ Wrong: Direct mutation
const filters = searchFilters.get();
filters.query = 'new value'; // Doesn't trigger updates!

// ✅ Correct: Set new value
searchFilters.set({
  ...searchFilters.get(),
  query: 'new value'
});
```markdown

### Mistake 2: Forgetting SSR

```typescript
// ❌ Wrong: Assumes browser
export const theme = atom(localStorage.getItem('theme') || 'light');

// ✅ Correct: Check for browser
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem('theme') || 'light';
};

export const theme = atom(getInitialTheme());
```markdown

### Mistake 3: Too Many Renders

```tsx
// ❌ Avoid: Multiple useStore calls
function MyComponent() {
  const query = useStore(searchFilters).query;
  const location = useStore(searchFilters).location;
  // Re-renders twice when searchFilters changes!
}

// ✅ Better: Single useStore
function MyComponent() {
  const filters = useStore(searchFilters);
  const { query, location } = filters;
  // Re-renders once
}
```

---

## 📖 Additional Resources

### Internal Documentation

- **[Islands Architecture](islands.md)** - Sharing state between islands
- **[Component Organization](components.md)** - Component structure

### External Resources

- **[Nanostores Docs](https://github.com/nanostores/nanostores)** - Official documentation
- **[Nanostores React](https://github.com/nanostores/react)** - React integration

---

⬅️ Back to [Development Guide](README.md)
