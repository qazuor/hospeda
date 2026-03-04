# Creating Admin Pages

> Step-by-step guide for adding new pages to the Hospeda admin dashboard (`apps/admin`).

## Overview

The admin dashboard uses TanStack Start with file-based routing. Pages are located in `src/routes/` and follow a feature-based architecture with TanStack Query hooks for data fetching, Shadcn UI for components, and Better Auth for authentication.

## File-Based Routing

### Route Structure

```
src/routes/
├── __root.tsx                          # Root layout (QueryClient, QZPay, Toast)
├── _authed.tsx                         # Auth layout (beforeLoad guard + AppLayout)
├── _authed/
│   ├── dashboard.tsx                   # /dashboard
│   ├── dashboard.lazy.tsx              # Lazy-loaded dashboard component
│   ├── accommodations/
│   │   ├── index.tsx                   # /accommodations (list)
│   │   ├── $id.tsx                     # /accommodations/:id (view)
│   │   └── $id_.edit.tsx              # /accommodations/:id/edit (edit form)
│   ├── destinations/
│   │   ├── index.tsx
│   │   ├── $id.tsx
│   │   └── $id_.edit.tsx
│   ├── billing/
│   │   ├── plans.tsx
│   │   ├── subscriptions.tsx
│   │   ├── cron.tsx
│   │   └── metrics.tsx
│   ├── access/
│   │   └── users/
│   │       ├── $id_.edit.tsx
│   │       └── ...
│   └── content/
│       ├── accommodation-amenities/
│       ├── accommodation-features/
│       └── destination-attractions/
├── auth/
│   └── index.tsx                       # /auth/signin (public)
└── index.tsx                           # / (redirect to dashboard)
```

### Route Naming Conventions

- `index.tsx` .. Index route for the directory (list pages)
- `$id.tsx` .. Dynamic parameter route (view pages)
- `$id_.edit.tsx` .. Dynamic parameter with suffix (edit pages)
- `_authed.tsx` .. Layout route with auth guard (prefix `_`)
- `*.lazy.tsx` .. Lazy-loaded route component (code splitting)
- All routes under `_authed/` require authentication automatically

## Architecture: Two Approaches

The admin app uses two approaches for pages, depending on complexity.

### Approach 1: Entity List System (Recommended for CRUD Pages)

For standard entity listing pages, use the `createEntityListPage` factory. This handles table rendering, pagination, search, filters, and view toggling automatically.

### Approach 2: Custom Pages

For specialized pages (dashboards, metrics, settings), create custom page components directly in the route file or in `src/features/`.

## Step-by-Step: Adding an Entity List Page

### 1. Create Feature Directory

```
src/features/my-entities/
├── config/
│   ├── my-entities.config.ts       # Entity list configuration
│   ├── my-entities.columns.ts      # Table column definitions
│   └── index.ts                    # Re-exports
├── hooks/
│   ├── myEntityQueryKeys.ts        # Query key factory
│   ├── useMyEntityQuery.ts         # TanStack Query hooks
│   └── useMyEntityPage.ts          # Page-level hook (view/edit)
├── schemas/
│   └── my-entity.schema.ts         # Client-side schemas
├── types/
│   └── my-entity.types.ts          # TypeScript types
└── server/
    └── my-entity-server-functions.ts  # Server functions (if needed)
```

### 2. Define Entity Configuration

```typescript
// src/features/my-entities/config/my-entities.config.ts
import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import {
    type MyEntity,
    MyEntityListItemSchema
} from '../schemas/my-entity.schema';
import { createMyEntitiesColumns } from './my-entities.columns';

export const myEntitiesConfig: EntityConfig<MyEntity> = {
    // Metadata
    name: 'my-entities',
    entityKey: 'myEntity',
    entityType: EntityType.MY_ENTITY,

    // API -- always use /api/v1/admin/* endpoints
    apiEndpoint: '/api/v1/admin/my-entities',

    // Routes
    basePath: '/my-entities',
    detailPath: '/my-entities/[id]',

    // Schemas
    listItemSchema: MyEntityListItemSchema as unknown as z.ZodSchema<MyEntity>,

    // Search
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
        enabled: true
    },

    // View
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 12,
            columns: { mobile: 1, tablet: 2, desktop: 3 }
        }
    },

    // Pagination -- uses page + pageSize (NOT limit)
    paginationConfig: {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 30, 50]
    },

    // Layout
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/my-entities/new'
    },

    // Columns
    createColumns: createMyEntitiesColumns
};

// Generate the component and route
const { component, route } = createEntityListPage(myEntitiesConfig);

export {
    component as MyEntitiesPageComponent,
    route as MyEntitiesRoute
};
```

### 3. Define Table Columns

```typescript
// src/features/my-entities/config/my-entities.columns.ts
import type { ColumnDef } from '@tanstack/react-table';
import type { MyEntity } from '../schemas/my-entity.schema';

export function createMyEntitiesColumns(): ColumnDef<MyEntity>[] {
    return [
        {
            accessorKey: 'name',
            header: 'Name'
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
                    {row.original.status}
                </Badge>
            )
        },
        {
            accessorKey: 'createdAt',
            header: 'Created',
            cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString()
        }
    ];
}
```

### 4. Create Route File

```typescript
// src/routes/_authed/my-entities/index.tsx
import { MyEntitiesRoute } from '@/features/my-entities/config/my-entities.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = MyEntitiesRoute;
```

### 5. Create Query Hooks

```typescript
// src/features/my-entities/hooks/myEntityQueryKeys.ts
export const myEntityQueryKeys = {
    all: ['my-entities'] as const,
    lists: () => [...myEntityQueryKeys.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
        [...myEntityQueryKeys.lists(), filters] as const,
    details: () => [...myEntityQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...myEntityQueryKeys.details(), id] as const,
    search: (query: string, filters?: Record<string, unknown>) =>
        [...myEntityQueryKeys.all, 'search', query, filters] as const
};

export function invalidateMyEntityLists() {
    return myEntityQueryKeys.lists();
}
```

```typescript
// src/features/my-entities/hooks/useMyEntityQuery.ts
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    myEntityQueryKeys,
    invalidateMyEntityLists
} from './myEntityQueryKeys';

/**
 * Hook for fetching a single entity by ID
 */
export const useMyEntityQuery = (
    id: string,
    options?: { enabled?: boolean }
) => {
    return useQuery({
        queryKey: myEntityQueryKeys.detail(id),
        queryFn: async () => {
            const response = await fetchApi({
                path: `/api/v1/admin/my-entities/${id}`
            });
            // API returns: { success: true, data: MyEntity, metadata: {...} }
            const apiResponse = response.data as {
                success: boolean;
                data: MyEntityCore;
                metadata: unknown;
            };
            return apiResponse.data;
        },
        enabled: options?.enabled ?? Boolean(id),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: (failureCount, error) => {
            if (isApiError(error) && error.status === 404) return false;
            return failureCount < 3;
        }
    });
};

/**
 * Mutation hook for creating entities
 */
export const useCreateMyEntityMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateMyEntityInput) => {
            const response = await fetchApi({
                path: '/api/v1/admin/my-entities',
                method: 'POST',
                body: data
            });
            return response.data as MyEntityCore;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: invalidateMyEntityLists()
            });
        }
    });
};

/**
 * Mutation hook for updating entities (with optimistic updates)
 */
export const useUpdateMyEntityMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<MyEntityCore>) => {
            const response = await fetchApi({
                path: `/api/v1/admin/my-entities/${id}`,
                method: 'PATCH',
                body: data
            });
            const apiResponse = response.data as {
                success: boolean;
                data: MyEntityCore;
                metadata: unknown;
            };
            return apiResponse.data;
        },
        onMutate: async (newData) => {
            await queryClient.cancelQueries({
                queryKey: myEntityQueryKeys.detail(id)
            });
            const previous = queryClient.getQueryData(
                myEntityQueryKeys.detail(id)
            );
            queryClient.setQueryData(
                myEntityQueryKeys.detail(id),
                (old: MyEntityCore | undefined) =>
                    old ? { ...old, ...newData } : old
            );
            return { previous };
        },
        onError: (_err, _newData, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    myEntityQueryKeys.detail(id),
                    context.previous
                );
            }
        },
        onSuccess: (updated) => {
            queryClient.setQueryData(
                myEntityQueryKeys.detail(id),
                updated
            );
            queryClient.invalidateQueries({
                queryKey: invalidateMyEntityLists()
            });
        }
    });
};

/**
 * Mutation hook for deleting entities
 */
export const useDeleteMyEntityMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await fetchApi({
                path: `/api/v1/admin/my-entities/${id}`,
                method: 'DELETE'
            });
        },
        onSuccess: (_, deletedId) => {
            queryClient.removeQueries({
                queryKey: myEntityQueryKeys.detail(deletedId)
            });
            queryClient.invalidateQueries({
                queryKey: invalidateMyEntityLists()
            });
        }
    });
};
```

### 6. Create View and Edit Routes

```typescript
// src/routes/_authed/my-entities/$id.tsx
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useMyEntityPage } from '@/features/my-entities/hooks/useMyEntityPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/my-entities/$id')({
    component: MyEntityViewPage,
    loader: async ({ params }) => ({ myEntityId: params.id }),
    errorComponent: createErrorComponent('MyEntity'),
    pendingComponent: createPendingComponent()
});

function MyEntityViewPage() {
    const { id } = Route.useParams();
    const entityData = useMyEntityPage(id);

    return (
        <EntityPageBase
            entityType="myEntity"
            entityId={id}
            initialMode="view"
            entityData={entityData}
        >
            <EntityViewContent
                entityType="myEntity"
                entityId={id}
                sections={entityData.sections}
                entity={entityData.entity || {}}
                userPermissions={entityData.userPermissions}
            />
        </EntityPageBase>
    );
}
```

```typescript
// src/routes/_authed/my-entities/$id_.edit.tsx
import { createFileRoute } from '@tanstack/react-router';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
// ... edit page component

export const Route = createFileRoute('/_authed/my-entities/$id/edit')({
    component: MyEntityEditPage,
    loader: async ({ params }) => ({ myEntityId: params.id }),
    errorComponent: createErrorComponent('MyEntity'),
    pendingComponent: createPendingComponent()
});
```

### 7. Add Navigation

Register your section in the sidebar navigation.

**Option A: Add to an existing section** (e.g., Content):

```typescript
// src/config/sections/content.section.tsx
// Add a new sidebar group inside the existing section's sidebar.items array:

sidebar.group(
    'my-entities',
    'My Entities',
    [
        sidebar.link(
            'my-entities-list',
            'List',
            '/my-entities',
            <ListIcon className="h-4 w-4" />,
            [PermissionEnum.MY_ENTITY_VIEW_ALL]
        ),
        sidebar.link(
            'my-entities-new',
            'Create New',
            '/my-entities/new',
            <AddIcon className="h-4 w-4" />,
            [PermissionEnum.MY_ENTITY_CREATE]
        )
    ],
    <MyEntityIcon className="h-4 w-4" />
),
```

Also add the routes to the section's `routes` array:

```typescript
routes: [
    // ... existing routes
    '/my-entities',
    '/my-entities/**',
],
```

**Option B: Create a new section:**

```typescript
// src/config/sections/my-section.section.tsx
import { createSection, sidebar } from '@/lib/sections';
import { ListIcon, AddIcon, MyIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';

export const mySection = createSection({
    id: 'my-section',
    label: 'My Section',
    labelKey: 'admin-menu.mySection.title',
    icon: <MyIcon className="h-5 w-5" />,
    permissions: [PermissionEnum.MY_ENTITY_VIEW_ALL],
    routes: ['/my-entities', '/my-entities/**'],
    defaultRoute: '/my-entities',
    sidebar: {
        title: 'My Section',
        titleKey: 'admin-menu.mySection.title',
        items: [
            sidebar.group(
                'my-entities',
                'My Entities',
                [
                    sidebar.link(
                        'my-entities-list',
                        'List',
                        '/my-entities',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.MY_ENTITY_VIEW_ALL]
                    ),
                    sidebar.link(
                        'my-entities-new',
                        'Create New',
                        '/my-entities/new',
                        <AddIcon className="h-4 w-4" />,
                        [PermissionEnum.MY_ENTITY_CREATE]
                    )
                ],
                <MyIcon className="h-4 w-4" />,
                true // expanded by default
            )
        ]
    }
});
```

Then register it in `src/config/sections/index.tsx`:

```typescript
import { mySection } from './my-section.section';

export const sections: SectionConfig[] = [
    dashboardSection,
    contentSection,
    mySection,           // Add here
    billingSection,
    administrationSection,
    analyticsSection
];
```

## Auth Guards

### Layout-Level Auth (Automatic)

The `_authed.tsx` layout handles authentication for all child routes:

- Redirects unauthenticated users to `/auth/signin`
- Verifies the user has an admin-panel-eligible role (SUPER_ADMIN, ADMIN, CLIENT_MANAGER, EDITOR, HOST, SPONSOR)
- Forces password change if `passwordChangeRequired` is set
- Wraps all content in `AuthProvider` and `AppLayout`

### Route-Level Permission Checks

For routes that require specific permissions beyond basic admin access:

```typescript
export const Route = createFileRoute('/_authed/my-entities/')({
    beforeLoad: ({ context }) => {
        const authState = context as AuthState;
        if (!authState.permissions.includes(PermissionEnum.MY_ENTITY_VIEW_ALL)) {
            throw redirect({ to: '/dashboard' });
        }
    },
    component: MyEntitiesPage
});
```

## API Communication

### Key Rules

- Admin uses ONLY `/api/v1/admin/*` endpoints
- One exception: `/api/v1/public/auth/me` for checking the current session
- Always use `fetchApi` from `@/lib/api/client` (handles `credentials: 'include'` automatically)
- Use `page` + `pageSize` for pagination (NOT `limit`)
- API responses follow the format: `{ success: boolean, data: T, metadata: {...} }`
- List responses nest data as: `{ success: true, data: { items: T[], pagination: {...} } }`

### The fetchApi Client

```typescript
import { fetchApi } from '@/lib/api/client';

// GET request
const response = await fetchApi({ path: '/api/v1/admin/my-entities' });

// POST request
const response = await fetchApi({
    path: '/api/v1/admin/my-entities',
    method: 'POST',
    body: { name: 'New Entity' }
});

// PATCH request
const response = await fetchApi({
    path: `/api/v1/admin/my-entities/${id}`,
    method: 'PATCH',
    body: updates
});

// DELETE request
await fetchApi({
    path: `/api/v1/admin/my-entities/${id}`,
    method: 'DELETE'
});
```

The base URL is read from `VITE_API_URL` environment variable (defaults to `http://localhost:3001`).

## Step-by-Step: Adding a Custom Page

For non-CRUD pages (dashboards, metrics, settings), skip the entity list system and create a direct route.

### 1. Create Route File

```typescript
// src/routes/_authed/my-custom-page.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/my-custom-page')({
    component: MyCustomPage
});

function MyCustomPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-bold text-2xl tracking-tight">
                    My Custom Page
                </h1>
                <p className="text-muted-foreground">
                    Description of what this page does.
                </p>
            </div>

            {/* Page content */}
        </div>
    );
}
```

### 2. Add Data Fetching

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

function MyCustomPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['my-custom-data'],
        queryFn: async () => {
            const response = await fetchApi({
                path: '/api/v1/admin/my-custom-endpoint'
            });
            const apiResponse = response.data as {
                success: boolean;
                data: MyCustomData;
            };
            return apiResponse.data;
        }
    });

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error loading data</div>;

    return (
        <div className="space-y-6">
            {/* Render data */}
        </div>
    );
}
```

## Form Validation

Use Zod schemas for runtime validation in forms:

```typescript
import { z } from 'zod';

const entitySchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().min(1, 'Description is required'),
    price: z.number().positive('Price must be positive'),
    category: z.string().min(1, 'Category is required'),
    isActive: z.boolean(),
});
```

## UI Components

Use Shadcn UI components from `src/components/ui/`:

- `button`, `input`, `select`, `textarea`, `switch`, `label` .. Form elements
- `dialog`, `alert-dialog` .. Modals and confirmations
- `dropdown-menu`, `popover`, `command` .. Menus and popovers
- `badge`, `card`, `progress` .. Visual elements
- `DataTable` (from `src/components/table/`) .. Data tables with TanStack Table

Use wrapped components from `src/components/ui-wrapped/` when available (Badge, Button, Card, Checkbox, Select, Switch, Tabs, Textarea, Label, Accordion).

Use layout components from `src/components/layout/`:

- `MainPageLayout` .. Standard page wrapper
- `BasePageLayout` .. Base layout with less structure
- `SidebarPageLayout` .. Layout with sidebar
- `Breadcrumbs` .. Breadcrumb navigation
- `PageTabs` .. Tab navigation within entity detail pages

Use feedback components from `src/components/feedback/`:

- `EmptyState` .. Empty state with icon and action
- `ComingSoon` .. Placeholder for unfinished pages

**Never install another UI library. Use Shadcn UI exclusively.**

## Icons

All icons come from `@repo/icons` (Phosphor Icons wrappers). Never add inline `<svg>` elements.

```typescript
import { ListIcon, AddIcon, MyEntityIcon } from '@repo/icons';

<ListIcon className="h-4 w-4" />
<AddIcon className="h-4 w-4" />
```

## Environment Variables

Admin uses `VITE_` prefixed variables (Vite convention):

```bash
VITE_API_URL=http://localhost:3001    # API base URL
VITE_DEBUG_ACTOR_ID=...               # Debug: override auth user ID
```

## Best Practices

### Do

- **Keep route files thin** .. logic belongs in feature folders
- **Use loaders for SSR** .. prefetch data on the server when possible
- **Handle loading and error states** .. always provide user feedback
- **Always invalidate queries after mutations** .. keep UI in sync with server
- **Use `Route.useParams()` instead of `useParams()`** .. get type-safe params from the specific route

### Do Not

- **Do not put business logic in routes** .. extract to feature hooks
- **Do not skip error handling** .. always check for undefined data
- **Do not forget to invalidate queries** .. stale cache causes bugs
- **Do not use `useEffect` for data fetching** .. use TanStack Query

## Troubleshooting

### Issue: "Route not found"

Verify file path matches route definition:

```typescript
// File: src/routes/_authed/my-entities/index.tsx
export const Route = createFileRoute('/_authed/my-entities/')({
    // Must match file location
```

### Issue: "Type errors with params"

Use correct hooks from Route object:

```typescript
// Wrong
const { id } = useParams();

// Correct
const { id } = Route.useParams();
```

### Issue: "Form not submitting"

Check `form.handleSubmit()` is called:

```typescript
<form
    onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit(); // Do not forget this
    }}
>
```

### Issue: "Data not updating after mutation"

Invalidate queries after mutations:

```typescript
const mutation = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
    },
});
```

## Common Gotchas

- **Pagination uses `page` + `pageSize`**, not `limit`. The `PaginationQuerySchema` on the API side rejects unknown params.
- **API response nesting**: List endpoints return `{ data: { items: [], pagination: {} } }`. Single entity endpoints return `{ data: Entity }`. Always extract `.data` from the response.
- **Auth cookies**: `fetchApi` already sets `credentials: 'include'`. Do not add custom auth headers.
- **Route file naming**: The `$id_.edit.tsx` pattern (with underscore after `$id`) creates `/my-entities/:id/edit`. Without the underscore, `$id.edit.tsx` would look for a literal `.edit` in the URL.
- **createFileRoute hack**: In entity list routes, you must reference `createFileRoute` to prevent TypeScript errors from TanStack Router's code generation.
- **Section permissions**: Use `PermissionEnum` values from `@repo/schemas`. Never check roles directly in route guards.

## Checklist

- [ ] Feature directory created in `src/features/` (for entity pages)
- [ ] Route file created in `src/routes/_authed/`
- [ ] Entity config with `createEntityListPage` (for list pages)
- [ ] Query keys factory defined
- [ ] TanStack Query hooks for fetching and mutations
- [ ] Uses `/api/v1/admin/*` endpoints exclusively
- [ ] Auth guard via `_authed` layout (automatic)
- [ ] Permission checks in `beforeLoad` if entity-specific access needed
- [ ] Table columns defined with `ColumnDef`
- [ ] UI uses Shadcn components only
- [ ] Icons from `@repo/icons` only
- [ ] Loading, error, and empty states handled
- [ ] Navigation link added to sidebar section config
- [ ] Section routes array updated to include new paths
- [ ] Form validation with Zod schemas
- [ ] Tests added for new routes

## Related

- [Admin App CLAUDE.md](../../CLAUDE.md)
- [API Route Architecture](../../../api/docs/route-architecture.md)
- [Development Documentation](./README.md)
