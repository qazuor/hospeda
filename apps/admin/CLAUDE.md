# CLAUDE.md - Admin Application

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Hospeda Admin application (`apps/admin`).

## Overview

TanStack Start-based admin dashboard for managing the Hospeda platform. Features file-based routing, React 19, Clerk authentication, Radix UI components, TanStack Table for data grids, and TanStack Query for server state.

## Key Commands

```bash
# Development
pnpm dev               # Start dev server (port 3000)
pnpm dev:clean         # Clear Vite cache and start dev
pnpm dev:watch         # Watch packages for changes and restart

# Build & Deploy
pnpm build             # Production build
pnpm serve             # Preview production build
pnpm start             # Start production server

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:ui           # Interactive UI

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
pnpm check             # Run all checks

# Utilities
pnpm clean             # Remove node_modules and dist
pnpm clean:cache       # Remove Vite cache only
```

## Project Structure

```
src/
├── routes/            # File-based routing
│   ├── __root.tsx         # Root layout
│   ├── index.tsx          # Dashboard home
│   ├── accommodations/    # Accommodation management
│   ├── destinations/      # Destination management
│   ├── events/            # Event management
│   └── users/             # User management
├── features/          # Feature-specific modules
│   ├── accommodations/
│   ├── destinations/
│   ├── events/
│   └── users/
├── components/        # Reusable components
│   ├── ui/                # Shadcn UI components
│   ├── forms/             # Form components
│   ├── tables/            # Table components
│   └── layouts/           # Layout components
├── lib/               # Utility libraries
│   ├── api.ts             # API client
│   ├── query.ts           # TanStack Query config
│   └── utils.ts           # Helper utilities
├── hooks/             # Custom React hooks
├── contexts/          # React contexts
├── shared/            # Shared utilities
└── utils/             # General utilities
```

## File-Based Routing

TanStack Router uses file-based routing in `src/routes/`:

```
routes/
├── __root.tsx                     → Root layout
├── index.tsx                      → /
├── accommodations/
│   ├── index.tsx                  → /accommodations
│   ├── $id.tsx                    → /accommodations/:id
│   ├── new.tsx                    → /accommodations/new
│   └── $id.edit.tsx              → /accommodations/:id/edit
└── _authenticated/
    └── dashboard.tsx              → /dashboard (requires auth)
```

### Creating a Route

```tsx
// routes/accommodations/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AccommodationsList } from '@/features/accommodations';

export const Route = createFileRoute('/accommodations/')({
  component: AccommodationsPage,
});

function AccommodationsPage() {
  return (
    <div>
      <h1>Accommodations</h1>
      <AccommodationsList />
    </div>
  );
}
```

### Route with Loader (Data Fetching)

```tsx
// routes/accommodations/$id.tsx
import { createFileRoute } from '@tanstack/react-router';
import { getAccommodation } from '@/lib/api';

export const Route = createFileRoute('/accommodations/$id')({
  loader: async ({ params }) => {
    const accommodation = await getAccommodation(params.id);
    return { accommodation };
  },
  component: AccommodationDetail,
});

function AccommodationDetail() {
  const { accommodation } = Route.useLoaderData();

  return (
    <div>
      <h1>{accommodation.name}</h1>
      {/* Rest of the component */}
    </div>
  );
}
```

### Protected Routes

```tsx
// routes/_authenticated/dashboard.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from '@clerk/tanstack-react-start';

export const Route = createFileRoute('/_authenticated/dashboard')({
  beforeLoad: async ({ context }) => {
    const { userId } = context.auth;

    if (!userId) {
      throw redirect({ to: '/signin' });
    }
  },
  component: DashboardPage,
});
```

### Search Params (Query Strings)

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  page: z.number().default(1),
  status: z.enum(['active', 'inactive']).optional(),
});

export const Route = createFileRoute('/accommodations/')({
  validateSearch: searchSchema,
  component: AccommodationsPage,
});

function AccommodationsPage() {
  const { page, status } = Route.useSearch();
  const navigate = Route.useNavigate();

  const changePage = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
    });
  };

  return <div>Page: {page}</div>;
}
```

## Navigation

### Using Link Component

```tsx
import { Link } from '@tanstack/react-router';

export function Navigation() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/accommodations">Accommodations</Link>
      <Link to="/accommodations/$id" params={{ id: '123' }}>
        Accommodation Detail
      </Link>
    </nav>
  );
}
```

### Programmatic Navigation

```tsx
import { useNavigate } from '@tanstack/react-router';

export function MyComponent() {
  const navigate = useNavigate();

  const goToAccommodation = (id: string) => {
    navigate({
      to: '/accommodations/$id',
      params: { id },
    });
  };

  return <button onClick={() => goToAccommodation('123')}>View</button>;
}
```

## Data Fetching (TanStack Query)

### Query Setup

```ts
// lib/query.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});
```

### Using Queries

```tsx
import { useQuery } from '@tanstack/react-query';
import { getAccommodations } from '@/lib/api';

export function AccommodationsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['accommodations'],
    queryFn: getAccommodations,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.map((acc) => (
        <li key={acc.id}>{acc.name}</li>
      ))}
    </ul>
  );
}
```

### Mutations

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAccommodation } from '@/lib/api';

export function CreateAccommodationForm() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createAccommodation,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['accommodations'] });
    },
  });

  const handleSubmit = (data: CreateAccommodationData) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(formData);
    }}>
      {/* Form fields */}
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

## Forms (TanStack Form)

```tsx
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { createAccommodationSchema } from '@repo/schemas';

export function AccommodationForm() {
  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
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
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors && (
              <span>{field.state.meta.errors.join(', ')}</span>
            )}
          </div>
        )}
      </form.Field>

      <button type="submit">Submit</button>
    </form>
  );
}
```

## Tables (TanStack Table)

```tsx
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
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
    id: 'actions',
    cell: ({ row }) => (
      <button onClick={() => editAccommodation(row.original.id)}>
        Edit
      </button>
    ),
  },
];

export function AccommodationsTable({ data }: { data: Accommodation[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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
        <button onClick={() => table.previousPage()}>Previous</button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </span>
        <button onClick={() => table.nextPage()}>Next</button>
      </div>
    </div>
  );
}
```

## UI Components (Shadcn)

Add components with:

```bash
pnpx shadcn@latest add button
pnpx shadcn@latest add dialog
pnpx shadcn@latest add form
```

Use components:

```tsx
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

export function MyComponent() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <h2>Dialog Content</h2>
      </DialogContent>
    </Dialog>
  );
}
```

## Authentication (Clerk)

### Setup in Root

```tsx
// routes/__root.tsx
import { ClerkProvider } from '@clerk/tanstack-react-start';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <Outlet />
    </ClerkProvider>
  );
}
```

### Using Auth Hooks

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

## API Client

```ts
// lib/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export const getAccommodations = () =>
  fetchAPI<Accommodation[]>('/api/v1/accommodations');

export const createAccommodation = (data: CreateAccommodationData) =>
  fetchAPI<Accommodation>('/api/v1/accommodations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
```

## State Management

Use TanStack Query for server state and React Context/useState for UI state:

```tsx
// contexts/ThemeContext.tsx
import { createContext, useContext, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

## Environment Variables

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_...

# API Configuration
VITE_API_URL=http://localhost:3001

# App Configuration
VITE_APP_NAME=Hospeda Admin
```

Access variables:

```ts
const apiUrl = import.meta.env.VITE_API_URL;
```

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  it('should render accommodation name', () => {
    const accommodation = {
      id: '1',
      name: 'Hotel Test',
      city: 'Buenos Aires',
    };

    render(<AccommodationCard accommodation={accommodation} />);

    expect(screen.getByText('Hotel Test')).toBeInTheDocument();
  });
});
```

## Styling

Use Tailwind CSS with class variance authority:

```tsx
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        outline: 'border border-input hover:bg-accent',
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
    <button className={buttonVariants({ variant, size, className })} {...props} />
  );
}
```

## Key Dependencies

- `@tanstack/react-start` - Full-stack React framework
- `@tanstack/react-router` - File-based routing
- `@tanstack/react-query` - Server state management
- `@tanstack/react-table` - Data tables
- `@tanstack/react-form` - Form handling
- `@clerk/tanstack-react-start` - Authentication
- `@radix-ui/*` - Unstyled UI primitives
- `tailwindcss` - Utility-first CSS

## Best Practices

1. **Use file-based routing** - create files in `src/routes/`
2. **Leverage TanStack Query** for server state
3. **Use loaders for data fetching** in routes
4. **Validate search params** with Zod
5. **Protect routes with beforeLoad** for auth checks
6. **Use Shadcn components** for consistent UI
7. **Keep route files simple** - extract logic to features/
8. **Use TypeScript strict mode** - no `any` types
9. **Test components** with React Testing Library
10. **Follow TanStack patterns** - consult official docs
