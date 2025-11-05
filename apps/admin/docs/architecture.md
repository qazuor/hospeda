# Architecture

Complete guide to the TanStack Start architecture powering the Hospeda Admin Dashboard.

---

## 📖 Overview

The **Hospeda Admin Dashboard** is built on **TanStack Start**, a modern full-stack React framework that combines the power of:

- **React 19** - Latest React features (Suspense, Server Components)
- **TanStack Router** - Type-safe file-based routing
- **TanStack Query** - Server state management and caching
- **Vinxi** - Next-generation Vite-based build system
- **Nitro** - Universal server framework

**Architecture Philosophy**:

- **Full-stack TypeScript** - End-to-end type safety
- **File-based routing** - Intuitive URL structure
- **Server-first** - SSR by default, client hydration where needed
- **Type-safe everything** - Routes, forms, tables, queries
- **Progressive enhancement** - Works without JavaScript

---

## 🏗️ High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   React    │  │  TanStack  │  │   Clerk    │           │
│  │ Components │  │   Query    │  │  (Auth)    │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
│                   [HTTP Requests]                          │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  TanStack Start Server                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Nitro     │  │  TanStack  │  │   Route    │           │
│  │  Server    │  │   Router   │  │  Loaders   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
│                   [API Calls]                              │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Hono)                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   Routes   │  │  Services  │  │  Database  │           │
│  │    API     │  │  Business  │  │  Drizzle   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

### Root Structure

```text
apps/admin/
├── src/
│   ├── routes/              # File-based routing (pages)
│   ├── features/            # Feature modules (domain logic)
│   ├── components/          # Reusable UI components
│   ├── lib/                 # Utilities and libraries
│   ├── hooks/               # Custom React hooks
│   ├── contexts/            # React contexts
│   └── styles/              # Global styles
├── public/                  # Static assets
├── app.config.ts            # TanStack Start config
├── tailwind.config.ts       # Tailwind CSS config
├── tsconfig.json            # TypeScript config
└── vite.config.ts           # Vite config
```

### Routes Directory (File-Based Routing)

```text
src/routes/
├── __root.tsx                    # Root layout (wraps all pages)
├── index.tsx                     # Dashboard home (/)
├── accommodations/
│   ├── index.tsx                 # List page (/accommodations)
│   ├── $id.tsx                   # Detail page (/accommodations/:id)
│   ├── $id.edit.tsx              # Edit page (/accommodations/:id/edit)
│   └── new.tsx                   # Create page (/accommodations/new)
├── destinations/
│   ├── index.tsx                 # /destinations
│   ├── $id.tsx                   # /destinations/:id
│   └── new.tsx                   # /destinations/new
├── events/
│   └── ...                       # Similar structure
├── users/
│   └── ...                       # User management
└── _authenticated/
    └── dashboard.tsx             # Protected route (requires auth)
```

**Key Points**:

- File name = Route path
- `$id` = Dynamic parameter (e.g., `/accommodations/123`)
- `_authenticated/` = Layout route (no URL segment)
- `index.tsx` = Default route for directory

### Features Directory (Domain Logic)

```text
src/features/
├── accommodations/
│   ├── api.ts                    # API calls
│   ├── hooks.ts                  # React Query hooks
│   ├── types.ts                  # TypeScript types
│   ├── schemas.ts                # Zod validation schemas
│   ├── components/               # Feature-specific components
│   │   ├── AccommodationList.tsx
│   │   ├── AccommodationForm.tsx
│   │   └── AccommodationCard.tsx
│   └── __tests__/                # Tests
├── destinations/
│   └── ...                       # Similar structure
├── events/
│   └── ...
└── shared/
    └── ...                       # Shared utilities
```

**Benefits**:

- Colocates related code
- Easy to find feature logic
- Promotes modularity
- Clear boundaries

### Components Directory

```text
src/components/
├── ui/                          # Shadcn UI components
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── table.tsx
│   └── ...
├── forms/                       # Form components
│   ├── FormField.tsx
│   ├── FormError.tsx
│   └── FormSubmit.tsx
├── tables/                      # Table components
│   ├── DataTable.tsx
│   ├── DataTablePagination.tsx
│   └── DataTableColumnHeader.tsx
└── layouts/                     # Layout components
    ├── AppShell.tsx
    ├── Sidebar.tsx
    ├── Header.tsx
    └── Footer.tsx
```

---

## 🚏 Routing System

### File-Based Routing

TanStack Router uses **file-based routing** - file paths map to URLs.

**Example**:

```text
File: src/routes/accommodations/$id.tsx
URL:  /accommodations/123
Param: { id: '123' }
```

### Route File Structure

```tsx
// src/routes/accommodations/$id.tsx
import { createFileRoute } from '@tanstack/react-router';
import { getAccommodation } from '@/features/accommodations/api';

/**
 * Route configuration
 */
export const Route = createFileRoute('/accommodations/$id')({
  // Data loader (runs on server)
  loader: async ({ params }) => {
    const accommodation = await getAccommodation(params.id);
    return { accommodation };
  },

  // Component (renders on server and client)
  component: AccommodationDetail,

  // Error boundary
  errorComponent: AccommodationError,

  // Pending component (loading state)
  pendingComponent: () => <div>Loading...</div>,
});

/**
 * Page component
 */
function AccommodationDetail() {
  const { accommodation } = Route.useLoaderData();

  return (
    <div>
      <h1>{accommodation.name}</h1>
      <p>{accommodation.description}</p>
    </div>
  );
}

/**
 * Error component
 */
function AccommodationError({ error }: { error: Error }) {
  return <div>Error: {error.message}</div>;
}
```

### Route Loaders (Data Fetching)

**Loaders run on the server** before rendering the page:

```tsx
export const Route = createFileRoute('/accommodations/$id')({
  loader: async ({ params, context }) => {
    // Runs on server
    const accommodation = await getAccommodation(params.id);

    // Data is serialized and sent to client
    return { accommodation };
  },
});
```

**Benefits**:

- Server-side rendering (SEO)
- No loading spinners (data ready on load)
- Type-safe params
- Automatic error handling

### Protected Routes

```tsx
// src/routes/_authenticated/dashboard.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from '@clerk/tanstack-react-start';

export const Route = createFileRoute('/_authenticated/dashboard')({
  beforeLoad: async ({ context }) => {
    const { userId } = context.auth;

    if (!userId) {
      // Redirect to sign-in
      throw redirect({ to: '/signin' });
    }
  },
  component: DashboardPage,
});
```

### Search Params (Query Strings)

```tsx
import { z } from 'zod';

// Define search params schema
const searchSchema = z.object({
  page: z.number().default(1),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const Route = createFileRoute('/accommodations/')({
  validateSearch: searchSchema,
  component: AccommodationsPage,
});

function AccommodationsPage() {
  const { page, search, status } = Route.useSearch();
  const navigate = Route.useNavigate();

  // Update search params
  const changePage = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
    });
  };

  return <div>Page: {page}</div>;
}
```

---

## 🔄 Data Fetching (TanStack Query)

### React Query Integration

**Setup** (`lib/query.ts`):

```tsx
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Queries (Read Data)

```tsx
import { useQuery } from '@tanstack/react-query';
import { getAccommodations } from '@/features/accommodations/api';

export function AccommodationsList() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['accommodations'],
    queryFn: getAccommodations,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      <ul>
        {data.map((acc) => (
          <li key={acc.id}>{acc.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Mutations (Create/Update/Delete)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAccommodation } from '@/features/accommodations/api';

export function CreateAccommodationButton() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createAccommodation,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['accommodations'] });
    },
  });

  const handleCreate = () => {
    mutation.mutate({
      name: 'New Hotel',
      city: 'Buenos Aires',
    });
  };

  return (
    <button
      onClick={handleCreate}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Creating...' : 'Create'}
    </button>
  );
}
```

### Query Keys (Caching)

```tsx
// Query keys pattern
const queryKeys = {
  accommodations: {
    all: ['accommodations'] as const,
    lists: () => [...queryKeys.accommodations.all, 'list'] as const,
    list: (filters: string) =>
      [...queryKeys.accommodations.lists(), { filters }] as const,
    details: () => [...queryKeys.accommodations.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.accommodations.details(), id] as const,
  },
};

// Usage
useQuery({
  queryKey: queryKeys.accommodations.detail('123'),
  queryFn: () => getAccommodation('123'),
});
```

---

## 📝 Forms (TanStack Form)

### Form Setup

```tsx
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { createAccommodationSchema } from '@/features/accommodations/schemas';

export function AccommodationForm() {
  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      city: '',
      pricePerNight: 0,
    },
    onSubmit: async ({ value }) => {
      await createAccommodation(value);
    },
    validatorAdapter: zodValidator(),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="name"
        validators={{
          onChange: createAccommodationSchema.shape.name,
        }}
      >
        {(field) => (
          <div>
            <label htmlFor={field.name}>Name:</label>
            <input
              id={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors && (
              <span>{field.state.meta.errors.join(', ')}</span>
            )}
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

### Form Validation

```tsx
// schemas.ts
import { z } from 'zod';

export const createAccommodationSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  city: z.string().min(1, 'City is required'),
  pricePerNight: z.number().min(0, 'Price must be positive'),
});

export type CreateAccommodationData = z.infer<typeof createAccommodationSchema>;
```

---

## 📊 Tables (TanStack Table)

### Basic Table

```tsx
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Accommodation } from '@repo/types';

const columns: ColumnDef<Accommodation>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'city',
    header: 'City',
  },
  {
    accessorKey: 'pricePerNight',
    header: 'Price',
    cell: ({ row }) => `$${row.original.pricePerNight}`,
  },
];

export function AccommodationsTable({ data }: { data: Accommodation[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## 🔐 Authentication (Clerk)

### Setup

```tsx
// src/routes/__root.tsx
import { ClerkProvider } from '@clerk/tanstack-react-start';
import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
    >
      <Outlet />
    </ClerkProvider>
  );
}
```

### Using Auth

```tsx
import { useAuth, useUser } from '@clerk/tanstack-react-start';

export function UserProfile() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  if (!isSignedIn) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <p>User ID: {userId}</p>
      <p>Name: {user?.fullName}</p>
      <p>Email: {user?.primaryEmailAddress?.emailAddress}</p>
    </div>
  );
}
```

---

## 🎨 Styling (Tailwind + Shadcn)

### Tailwind CSS

```tsx
export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
      {children}
    </button>
  );
}
```

### Class Variance Authority (CVA)

```tsx
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        outline: 'border border-input hover:bg-accent',
        ghost: 'hover:bg-accent',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export function Button({ variant, size, className, ...props }) {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
```

---

## 🧪 Testing

See [Testing Documentation](./development/testing.md) for complete guide.

---

## 📖 Additional Resources

### TanStack Documentation

- **[TanStack Start](https://tanstack.com/start)** - Framework
- **[TanStack Router](https://tanstack.com/router)** - Routing
- **[TanStack Query](https://tanstack.com/query)** - Data fetching
- **[TanStack Table](https://tanstack.com/table)** - Tables
- **[TanStack Form](https://tanstack.com/form)** - Forms

### Related Technologies

- **[React 19](https://react.dev)** - UI library
- **[Vite](https://vitejs.dev/)** - Build tool
- **[Vinxi](https://vinxi.vercel.app/)** - Universal bundler
- **[Nitro](https://nitro.unjs.io/)** - Server framework

---

⬅️ Back to [Admin Documentation](./README.md)
