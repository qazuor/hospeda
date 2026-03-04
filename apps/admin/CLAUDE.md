# CLAUDE.md - Admin Application

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Hospeda Admin application (`apps/admin`).

## Overview

TanStack Start-based admin dashboard for managing the Hospeda platform. Features file-based routing, React 19, Better Auth authentication, Radix UI components, TanStack Table for data grids, and TanStack Query for server state.

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
├── routes/                # File-based routing (TanStack Router)
│   ├── __root.tsx             # Root layout
│   ├── _authed/               # Authenticated routes wrapper
│   │   ├── accommodations/    # Accommodation CRUD pages
│   │   ├── destinations/      # Destination CRUD pages
│   │   ├── events/            # Events + locations + organizers
│   │   ├── content/           # Amenities, features, attractions
│   │   ├── sponsors/          # Sponsor pages (nested folder)
│   │   ├── settings/          # Tags, critical settings
│   │   ├── access/            # User management
│   │   ├── billing/           # Billing pages
│   │   └── posts/             # Blog post pages
├── features/              # Feature-specific modules
│   ├── accommodations/        # config/, hooks/, utils/
│   ├── destinations/
│   ├── amenities/
│   ├── attractions/
│   ├── features/
│   ├── events/
│   ├── event-locations/
│   ├── event-organizers/
│   ├── sponsors/
│   ├── tags/
│   ├── posts/
│   └── dashboard/
├── components/            # Reusable components
│   ├── entity-form/           # EntityFormSection, fields, navigation
│   ├── entity-pages/          # EntityPageBase, EntityViewContent, EntityCreateContent
│   ├── entity-list/           # DataTable, createEntityApi
│   ├── selects/               # DestinationSelect, OwnerSelect
│   ├── error-boundaries/      # EntityErrorBoundary
│   ├── auth/                  # RoutePermissionGuard
│   ├── table/                 # DataTable wrapper
│   ├── ui/                    # Shadcn UI components
│   └── ui-wrapped/            # Wrapped UI components (Button, Card, etc.)
├── lib/                   # Utility libraries
│   ├── api/                   # fetchApi client
│   ├── factories/             # createEntityHooks factory
│   └── utils/                 # async-validation, entity-search
├── hooks/                 # Custom React hooks
├── config/                # App configuration (sections, navigation)
└── utils/                 # General utilities (logger)
```

## File-Based Routing

TanStack Router uses file-based routing in `src/routes/_authed/`:

```
routes/_authed/
├── accommodations/
│   ├── index.tsx              → LIST page
│   ├── $id.tsx                → VIEW page
│   ├── $id_.edit.tsx          → EDIT page ($id_ = sibling, not child)
│   └── new.tsx                → CREATE page
├── events/
│   ├── locations/             → Nested folder (NOT flat locations.tsx)
│   │   ├── index.tsx          → LIST
│   │   ├── $id.tsx            → VIEW
│   │   ├── $id_.edit.tsx      → EDIT
│   │   └── new.tsx            → CREATE
│   └── organizers/            → Same pattern
├── sponsors/                  → Nested folder (NOT flat sponsors.tsx)
│   ├── index.tsx
│   ├── $id.tsx
│   ├── $id_.edit.tsx
│   └── new.tsx
└── settings/
    └── tags/                  → Nested folder
        ├── index.tsx
        ├── $id.tsx
        ├── $id_.edit.tsx
        └── new.tsx
```

**Route naming rules:**

- Use **nested folders** (NOT flat files like `tags.tsx`, `tags.$id.tsx`)
- `$id.tsx` = view page (child of folder)
- `$id_.edit.tsx` = edit page (underscore suffix makes it a sibling route, not nested under `$id`)
- `new.tsx` = create page
- `index.tsx` = list page

### Protected Routes

All routes under `_authed/` require authentication via `beforeLoad` guard in `_authed.tsx`.

## Entity Page Architecture

Every entity in the admin panel follows a consistent 4-page pattern:

### LIST Page (`index.tsx`)

Uses `DataTable` with entity-specific columns and config:

```tsx
// Features entity-specific config in features/<entity>/config/<entity>.columns.ts
// and features/<entity>/config/<entity>.config.ts
```

### VIEW Page (`$id.tsx`)

Uses `EntityPageBase` with tabs (General, Events, Contact, etc.):

```tsx
import { EntityPageBase } from '@/components/entity-pages';
// EntityPageBase renders tabs, breadcrumbs, and EntityViewContent per section
```

### EDIT Page (`$id_.edit.tsx`)

Uses `EntityPageBase` in edit mode with `EntityFormSection` for each section.

### CREATE Page (`new.tsx`)

Uses **`EntityCreateContent`** shared component (in `components/entity-pages/EntityCreateContent.tsx`). This is the standard pattern for ALL create pages:

```tsx
import { EntityCreateContent } from '@/components/entity-pages';
import { createConsolidatedConfig } from '../config/sections/basic-info.consolidated';

function NewEntityPage() {
    const createMutation = useCreateEntity();
    const navigate = useNavigate();

    return (
        <EntityCreateContent
            config={{
                entityType: 'entity-name',
                title: 'Create Entity',
                description: 'Create a new entity',
                entityName: 'Entity',
                entityNamePlural: 'Entities',
                basePath: '/entities',
                submitLabel: 'Create',
                savingLabel: 'Creating...',
                successToastTitle: 'Created',
                successToastMessage: 'Entity created successfully',
                errorToastTitle: 'Error',
                errorMessage: 'Failed to create entity',
            }}
            createConsolidatedConfig={createConsolidatedConfig}
            createMutation={createMutation}
            onNavigate={(path) => navigate({ to: path })}
        />
    );
}
```

**Never duplicate form/navigation/error-handling logic in individual create pages.** Always use EntityCreateContent.

### Consolidated Config Pattern

Each entity defines its sections in `features/<entity>/config/sections/basic-info.consolidated.ts`:

```ts
export function createConsolidatedConfig() {
    return {
        sections: [
            {
                id: 'basic-info',
                title: 'Basic Information',
                mode: ['create', 'edit', 'view'],
                fields: [/* field definitions */],
            },
            // More sections...
        ],
        metadata: {
            entityName: 'Entity',
            entityNamePlural: 'Entities',
        },
    };
}
```

### Entity Hooks Factory

Use `createEntityHooks` from `lib/factories/createEntityHooks.ts` to generate standardized CRUD hooks:

```ts
const { useList, useGetById, useCreate, useUpdate, useDelete } = createEntityHooks({
    entityName: 'accommodations',
    apiEndpoint: '/api/v1/admin/accommodations',
});
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

## Authentication (Better Auth)

### Setup in Root

```tsx
// routes/__root.tsx
import { AuthProvider } from 'better-auth/react';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthProvider baseURL={import.meta.env.VITE_BETTER_AUTH_URL}>
      <Outlet />
    </AuthProvider>
  );
}
```

### Using Auth Hooks

```tsx
import { useSession } from 'better-auth/react';

export function UserProfile() {
  const { data: session, isPending } = useSession();
  

  if (!session) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <p>User ID: {session.user.id}</p>
      <p>Name: {session.user.name}</p>
      <p>Email: {session.user.email}</p>
    </div>
  );
}
```

## API Endpoint Convention

**All admin panel API calls use `/api/v1/admin/*` endpoints.** This ensures admin users get full access to all resources (including drafts, deleted items, and audit fields).

| Pattern | Usage |
|---------|-------|
| `/api/v1/admin/<entity>` | ALL entity CRUD operations |
| `/api/v1/public/auth/me` | Auth status check (exception) |
| `/api/v1/billing/*` | Billing operations (separate tier) |

**Never use `/api/v1/public/*` or `/api/v1/protected/*` in admin panel code** (except auth).

### Entity Config Pattern

Each entity config defines the `apiEndpoint`:

```ts
// features/accommodations/config/accommodations.config.ts
export const accommodationsConfig = {
    apiEndpoint: '/api/v1/admin/accommodations',
    // ...
};
```

### Entity Hook Pattern

Hooks use the admin endpoint for all operations:

```ts
const fetchAccommodations = async () => {
    const response = await fetchApi('/api/v1/admin/accommodations');
    return response;
};
```

## API Client

Uses `fetchApi` from `@/lib/api/fetch-api` with automatic auth token injection.

```ts
import { fetchApi } from '@/lib/api/fetch-api';

// All CRUD operations go through /admin/ endpoints
const list = () => fetchApi('/api/v1/admin/accommodations');
const getById = (id: string) => fetchApi(`/api/v1/admin/accommodations/${id}`);
const create = (data: unknown) => fetchApi('/api/v1/admin/accommodations', { method: 'POST', body: JSON.stringify(data) });
const update = (id: string, data: unknown) => fetchApi(`/api/v1/admin/accommodations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
const remove = (id: string) => fetchApi(`/api/v1/admin/accommodations/${id}`, { method: 'DELETE' });
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
# Better Auth
VITE_BETTER_AUTH_URL=http://localhost:3001/api/auth

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
- `better-auth` - Authentication
- `@radix-ui/*` - Unstyled UI primitives
- `tailwindcss` - Utility-first CSS

## Best Practices

1. **Use nested folder routing** - `entity/index.tsx`, `entity/$id.tsx`, NOT flat `entity.tsx`, `entity.$id.tsx`
2. **Use EntityCreateContent** for ALL create pages - never duplicate form/navigation/error logic
3. **Use EntityPageBase** for view/edit pages with tabs
4. **Use createEntityHooks factory** for standardized CRUD hooks
5. **Use consolidated configs** for section definitions shared across create/edit/view
6. **All API calls go through `/api/v1/admin/*`** - use fetchApi from `@/lib/api/fetch-api`
7. **Use Shadcn components** via `@/components/ui-wrapped/` wrappers
8. **Keep route files thin** - extract logic to features/ and use shared components
9. **Use TypeScript strict mode** - no `any` types (biome enforces this)
10. **Use `useMemo` with whole objects as deps** - not individual properties (biome `useExhaustiveDependencies`)

## Related Documentation

- [Adding Admin Pages](docs/development/creating-pages.md)
- [Dependency Policy](../../docs/guides/dependency-policy.md)
- [Authentication Guide](../../docs/security/authentication.md)

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>
