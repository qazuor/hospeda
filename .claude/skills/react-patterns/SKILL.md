---
name: react-patterns
description: React component and hook patterns. Use when building functional components, custom hooks, compound components, or handling code splitting and error boundaries.
---

# React Patterns

## Purpose

Provide patterns for building React applications, including functional components with TypeScript, custom hooks, compound components, memoization, code splitting, error boundaries, and testing with React Testing Library.

## Component Patterns

### Functional Component with Props

```typescript
interface ItemCardProps {
  item: Item;
  onSelect?: (id: string) => void;
  priority?: boolean;
}

export function ItemCard({ item, onSelect, priority = false }: ItemCardProps) {
  const handleClick = () => onSelect?.(item.id);

  return (
    <article
      onClick={handleClick}
      className="cursor-pointer hover:shadow-lg"
      aria-label={`Item: ${item.title}`}
    >
      <img src={item.image} alt={item.title} loading={priority ? "eager" : "lazy"} />
      <h3>{item.title}</h3>
      <p>${item.price}</p>
    </article>
  );
}
```

### Memoized Component

```typescript
import { memo } from "react";

interface ExpensiveListProps {
  items: Item[];
  onItemSelect: (id: string) => void;
}

export const ExpensiveList = memo(function ExpensiveListComponent({
  items,
  onItemSelect,
}: ExpensiveListProps) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} onClick={() => onItemSelect(item.id)}>
          {item.title}
        </li>
      ))}
    </ul>
  );
});
```

### Compound Components

```typescript
import { createContext, useContext, useState, type ReactNode } from "react";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>");
  return ctx;
}

function Tabs({ children, defaultTab }: { children: ReactNode; defaultTab: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.Trigger = function Trigger({ id, children }: { id: string; children: ReactNode }) {
  const { activeTab, setActiveTab } = useTabs();
  return (
    <button onClick={() => setActiveTab(id)} data-active={activeTab === id}>
      {children}
    </button>
  );
};

Tabs.Content = function Content({ id, children }: { id: string; children: ReactNode }) {
  const { activeTab } = useTabs();
  if (activeTab !== id) return null;
  return <div className="tab-content">{children}</div>;
};

export { Tabs };
```

## Custom Hooks

### Debounce Hook

```typescript
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

### Local Storage Hook

```typescript
import { useState } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    }
  };

  return [storedValue, setValue];
}
```

## Performance Patterns

### useMemo and useCallback

```typescript
import { useMemo, useCallback, useState } from "react";

function ItemList({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState("");

  const filteredItems = useMemo(
    () => items.filter((item) => item.title.toLowerCase().includes(filter.toLowerCase())),
    [items, filter]
  );

  const handleSelect = useCallback((id: string) => {
    console.log("Selected:", id);
  }, []);

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      {filteredItems.map((item) => (
        <ItemCard key={item.id} item={item} onSelect={handleSelect} />
      ))}
    </div>
  );
}
```

### Code Splitting

```typescript
import { lazy, Suspense } from "react";

const HeavyChart = lazy(() => import("./HeavyChart"));
const AdminPanel = lazy(() => import("./AdminPanel"));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/analytics" element={<HeavyChart />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Suspense>
  );
}
```

## Error Boundary

```typescript
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## Testing

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mockItem = { id: "1", title: "Test Item", price: 100, image: "/test.jpg" };

describe("ItemCard", () => {
  it("should render item data", () => {
    render(<ItemCard item={mockItem} />);
    expect(screen.getByText("Test Item")).toBeInTheDocument();
  });

  it("should call onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<ItemCard item={mockItem} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("article"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("should have proper accessibility attributes", () => {
    render(<ItemCard item={mockItem} />);
    expect(screen.getByRole("article")).toHaveAttribute("aria-label", "Item: Test Item");
  });
});
```

## Best Practices

- Use functional components with hooks; avoid class components for new code
- Extract reusable logic into custom hooks with the `use` prefix
- Use `memo()` only for components that render frequently with the same props
- Use `useMemo` for expensive calculations and `useCallback` for stable references
- Implement error boundaries to catch render errors gracefully
- Use lazy loading and Suspense for large components and route-based splitting
- Always define explicit TypeScript interfaces for component props
- Use compound components with Context for flexible, composable APIs
- Clean up side effects in `useEffect` return functions
- Prefer controlled components; use refs only for imperative DOM access
