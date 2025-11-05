# Component Organization

Guide to organizing and building components in Hospeda Web App.

---

## 📖 Overview

This guide covers how to organize, structure, and build components in the Astro + React web application.

**Key Concepts**:

- Two types: Astro components (.astro) and React components (.tsx)
- Clear directory structure
- Consistent naming conventions
- Reusable and composable

---

## 📁 Directory Structure

### Project Structure

```text
src/
├── components/           # All components
│   ├── accommodation/    # Accommodation-specific
│   │   ├── AccommodationCard.astro
│   │   ├── AccommodationGrid.astro
│   │   ├── AccommodationFilters.tsx
│   │   └── index.ts      # Barrel export
│   ├── destination/      # Destination-specific
│   ├── event/            # Event-specific
│   ├── ui/               # Generic UI components
│   │   ├── Button.tsx
│   │   ├── Card.astro
│   │   ├── Modal.tsx
│   │   └── index.ts
│   └── forms/            # Form components
│       ├── SearchForm.tsx
│       ├── ContactForm.tsx
│       └── index.ts
├── layouts/              # Page layouts
│   ├── MainLayout.astro
│   ├── Header.astro
│   └── Footer.astro
└── pages/                # Page components
```

### Categorization

**Feature-Based** (`accommodation/`, `event/`, etc.):

- Components specific to a feature domain
- Example: `AccommodationCard`, `AccommodationFilters`

**UI Components** (`ui/`):

- Generic, reusable UI elements
- Example: `Button`, `Card`, `Modal`

**Forms** (`forms/`):

- Form components and validation
- Example: `SearchForm`, `ContactForm`

**Layouts** (`layouts/`):

- Page structure components
- Example: `MainLayout`, `Header`, `Footer`

---

## 🎨 Component Types

### Astro Components (.astro)

**When to use**:

- Static content
- No client-side interactivity needed
- SEO-critical components
- Layouts and structure

**Example**:

```astro
---
// src/components/accommodation/AccommodationCard.astro
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
  <p class="description">{accommodation.description}</p>
  <span class="price">${accommodation.pricePerNight}/night</span>
</article>

<style>
  .accommodation-card {
    @apply rounded-lg shadow-md p-4 hover:shadow-lg transition;
  }

  [data-featured="true"] {
    @apply ring-2 ring-primary;
  }

  .description {
    @apply text-gray-600 my-2 line-clamp-3;
  }

  .price {
    @apply text-lg font-bold text-primary;
  }
</style>
```

### React Components (.tsx)

**When to use**:

- Interactive features (forms, filters, search)
- Client-side state management
- Event handlers
- Dynamic UI updates

**Example**:

```tsx
// src/components/accommodation/AccommodationFilters.tsx
import { useState } from 'react';
import type { AccommodationFilters as Filters } from '@repo/types';

interface AccommodationFiltersProps {
  onFilterChange: (filters: Filters) => void;
  initialFilters?: Filters;
}

export function AccommodationFilters({
  onFilterChange,
  initialFilters = {}
}: AccommodationFiltersProps) {
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const handlePriceChange = (min: number, max: number) => {
    const newFilters = { ...filters, priceRange: { min, max } };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="filters">
      <h3>Filters</h3>

      <div className="filter-group">
        <label>Price Range</label>
        <input
          type="range"
          min="0"
          max="10000"
          value={filters.priceRange?.min ?? 0}
          onChange={(e) => handlePriceChange(Number(e.target.value), filters.priceRange?.max ?? 10000)}
        />
      </div>

      {/* More filters... */}
    </div>
  );
}
```

---

## 🏷️ Naming Conventions

### File Names

**Astro Components**:

- PascalCase with `.astro` extension
- Example: `AccommodationCard.astro`, `EventList.astro`

**React Components**:

- PascalCase with `.tsx` extension
- Example: `SearchForm.tsx`, `BookingButton.tsx`

**Barrel Exports**:

- Use `index.ts` for exporting multiple components
- Example: `components/ui/index.ts`

### Component Names

Match file names:

```astro
<!-- AccommodationCard.astro -->
---
// Component automatically named AccommodationCard
---
```

```tsx
// SearchForm.tsx
export function SearchForm() {
  // ...
}
```

---

## 📦 Props and Interfaces

### Astro Props

```astro
---
import type { Accommodation } from '@repo/types';

interface Props {
  accommodation: Accommodation;
  showPrice?: boolean;
  onSelect?: (id: string) => void;
}

const {
  accommodation,
  showPrice = true,
  onSelect
} = Astro.props;
---
```

### React Props

```tsx
import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  description?: string;
  children?: ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  onClick?: () => void;
}

export function Card({
  title,
  description,
  children,
  variant = 'default',
  onClick
}: CardProps) {
  // ...
}
```

---

## 🔄 Composition Patterns

### Container/Presentational

**Container** (logic):

```tsx
// AccommodationListContainer.tsx
import { useEffect, useState } from 'react';
import { AccommodationList } from './AccommodationList';

export function AccommodationListContainer() {
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/accommodations')
      .then(r => r.json())
      .then(data => {
        setAccommodations(data);
        setLoading(false);
      });
  }, []);

  return (
    <AccommodationList
      accommodations={accommodations}
      loading={loading}
    />
  );
}
```

**Presentational** (display):

```tsx
// AccommodationList.tsx
import type { Accommodation } from '@repo/types';

interface AccommodationListProps {
  accommodations: Accommodation[];
  loading: boolean;
}

export function AccommodationList({
  accommodations,
  loading
}: AccommodationListProps) {
  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid">
      {accommodations.map(acc => (
        <AccommodationCard key={acc.id} accommodation={acc} />
      ))}
    </div>
  );
}
```

### Compound Components

```tsx
// Card compound component
export function Card({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="card-header">{children}</div>;
}

export function CardContent({ children }: { children: ReactNode }) {
  return <div className="card-content">{children}</div>;
}

// Usage
<Card>
  <CardHeader>
    <h3>Title</h3>
  </CardHeader>
  <CardContent>
    <p>Content</p>
  </CardContent>
</Card>
```

---

## 📤 Barrel Exports

### Creating Barrel Files

**File**: `src/components/ui/index.ts`

```typescript
export { Button } from './Button';
export { Card } from './Card';
export { Modal } from './Modal';
export { Input } from './Input';
```

### Using Barrel Exports

```astro
---
// Instead of multiple imports
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';

// Use barrel export
import { Button, Card, Modal } from '../components/ui';
---
```

---

## ⚙️ Component Best Practices

### 1. Single Responsibility

```astro
<!-- ❌ Bad: Component does too much -->
<MultiPurposeCard data={data} type="event" showDetails={true} enableBooking={true} />

<!-- ✅ Good: Focused components -->
<EventCard event={data} />
<EventDetails event={data} />
<BookingButton eventId={data.id} />
```

### 2. Prop Validation

```typescript
// Use Zod for runtime validation
import { z } from 'zod';

const CardPropsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  variant: z.enum(['default', 'outlined', 'elevated']).default('default')
});

type CardProps = z.infer<typeof CardPropsSchema>;
```

### 3. Default Props

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false
}: ButtonProps) {
  // ...
}
```

### 4. Avoid Prop Drilling

Use Nanostores for global state:

```ts
// store/search.ts
import { map } from 'nanostores';

export const searchFilters = map({
  query: '',
  location: null
});
```

```tsx
// Component deep in tree
import { useStore } from '@nanostores/react';
import { searchFilters } from '../store/search';

export function SearchResults() {
  const filters = useStore(searchFilters);
  // No prop drilling needed!
}
```

---

## 🎯 Component Patterns

### Loading States

```tsx
interface DataComponentProps {
  data?: Data;
  loading: boolean;
  error?: string;
}

export function DataComponent({ data, loading, error }: DataComponentProps) {
  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  if (!data) return <EmptyState />;

  return <div>{/* Render data */}</div>;
}
```

### Conditional Rendering

```astro
---
const { user } = Astro.locals;
---

{user ? (
  <UserMenu user={user} />
) : (
  <SignInButton />
)}
```

### Lists and Keys

```tsx
{items.map(item => (
  <ItemCard
    key={item.id}  // Always use stable, unique keys
    item={item}
  />
))}
```

---

## ✅ Checklist for New Components

Before creating a component, ask:

- [ ] Is this component reusable?
- [ ] Where should it live in the directory structure?
- [ ] Does it need interactivity (React) or is it static (Astro)?
- [ ] What props does it need?
- [ ] Are prop types properly defined?
- [ ] Does it need tests?
- [ ] Should it be exported in a barrel file?

---

## 📖 Additional Resources

- **[Islands Architecture](islands.md)** - When to use Astro vs React
- **[Styling Guide](styling.md)** - How to style components
- **[Creating Pages](creating-pages.md)** - Using components in pages

---

⬅️ Back to [Development Guide](README.md)
