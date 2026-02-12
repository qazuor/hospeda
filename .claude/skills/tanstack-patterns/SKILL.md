---
name: tanstack-patterns
description: TanStack ecosystem overview and shared patterns. Use when working with TanStack libraries or understanding headless UI architecture.
---

# TanStack Ecosystem Patterns

## Purpose

Provide an overview of the TanStack ecosystem and common patterns shared across TanStack libraries, including type-safe design principles, headless UI architecture, adapter patterns, and integration strategies for React, Vue, Solid, and other frameworks.

## Ecosystem Overview

The TanStack ecosystem provides headless, type-safe, framework-agnostic libraries for common frontend needs:

- **TanStack Query** - Async state management and data fetching
- **TanStack Router** - Type-safe routing with built-in data loading
- **TanStack Table** - Headless table/grid UI logic
- **TanStack Form** - Type-safe form state management
- **TanStack Virtual** - Virtualization for large lists and grids
- **TanStack Start** - Full-stack framework built on TanStack Router

## Core Design Principles

### Headless Architecture

All TanStack libraries provide logic without UI, allowing full control over rendering:

```typescript
// TanStack Table: headless logic, you provide the UI
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
});

// You render however you want
return (
  <table>
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <th key={header.id}>
              {flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          ))}
        </tr>
      ))}
    </thead>
  </table>
);
```

### Type Safety First

All libraries leverage TypeScript generics for end-to-end type safety:

```typescript
// Type-safe query keys and return types
const { data } = useQuery<User[], Error>({
  queryKey: ["users"],
  queryFn: fetchUsers,
});

// Type-safe route definitions
const routeTree = rootRoute.addChildren([
  indexRoute,
  usersRoute.addChildren([userRoute]),
]);

// Type-safe column definitions
const columns: ColumnDef<User>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
];
```

### Framework Adapters

Libraries ship core logic separately from framework bindings:

```typescript
// Core (framework-agnostic)
import { QueryClient } from "@tanstack/query-core";

// React adapter
import { useQuery } from "@tanstack/react-query";

// Vue adapter
import { useQuery } from "@tanstack/vue-query";

// Solid adapter
import { createQuery } from "@tanstack/solid-query";
```

## TanStack Virtual

Efficiently render large lists by only rendering visible items:

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: "400px", overflow: "auto" }}>
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
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## TanStack Form

Type-safe form management with framework adapters:

```typescript
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";

function ContactForm() {
  const form = useForm({
    defaultValues: { name: "", email: "" },
    onSubmit: async ({ value }) => {
      await submitContact(value);
    },
    validatorAdapter: zodValidator(),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="name"
        validators={{ onChange: z.string().min(1, "Required") }}
        children={(field) => (
          <div>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((err) => (
              <span key={err}>{err}</span>
            ))}
          </div>
        )}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Combining Libraries

### Query + Router (Data Loading)

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

const userQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["users", id],
    queryFn: () => fetchUser(id),
  });

export const Route = createFileRoute("/users/$userId")({
  loader: ({ context: { queryClient }, params: { userId } }) =>
    queryClient.ensureQueryData(userQueryOptions(userId)),
  component: UserPage,
});

function UserPage() {
  const { userId } = Route.useParams();
  const { data: user } = useSuspenseQuery(userQueryOptions(userId));
  return <h1>{user.name}</h1>;
}
```

### Query + Table (Server-Side Data)

```typescript
function UsersTable() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const { data } = useQuery({
    queryKey: ["users", pagination],
    queryFn: () => fetchUsers(pagination),
  });

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    rowCount: data?.totalCount,
    state: { pagination },
    onPaginationChange: setPagination,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataTable table={table} />;
}
```

## Best Practices

- Leverage headless architecture for full control over UI and styling
- Use TypeScript generics to get end-to-end type safety across all libraries
- Combine TanStack Query with Router for data loading at the route level
- Use TanStack Virtual for lists with more than 100 items
- Use `queryOptions()` factory for reusable, type-safe query configurations
- Prefer `useSuspenseQuery` with route-level loaders for seamless data flow
- Use `manualPagination`, `manualSorting`, and `manualFiltering` for server-driven tables
- Keep core logic framework-agnostic; use adapters for React, Vue, or Solid
- Use `overscan` in virtualizers to pre-render items for smoother scrolling
- Pin TanStack library versions together to avoid compatibility issues
