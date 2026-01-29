# Factory Functions Guide

Factory functions help reduce boilerplate and ensure consistency across entity management in the Admin Dashboard.

---

## Overview

The admin app provides several factory functions in `src/lib/factories/` that generate standardized components, hooks, and configurations for entity CRUD operations.

**Available Factories:**

| Factory | Purpose | Use Case |
|---------|---------|----------|
| `createEntityHooks` | Generate query/mutation hooks | Entity data fetching |
| `createEntityLayout` | Generate layout with tabs | Entity section layouts |
| `createEntityRoutes` | Generate route components | View/edit route boilerplate |
| `createEntityListPage` | Generate list page config | Entity list views |
| `createEntityColumnsFactory` | Generate table columns | Entity tables |
| `createEntityApi` | Generate API functions | Entity API calls |
| `createEntityQueryKeys` | Generate query keys | TanStack Query cache |

---

## Quick Start

### Basic Entity Setup

```tsx
// features/products/config.ts
import {
    createEntityHooks,
    createEntityListPage,
    createEntityColumnsFactory
} from '@/lib/factories';

// 1. Create API hooks
const hooks = createEntityHooks<Product>({
    entityName: 'product',
    pluralName: 'products',
    apiEndpoint: '/api/v1/products'
});

// 2. Create columns
const createColumns = createEntityColumnsFactory<ProductListItem>({
    nameField: 'name',
    slugField: 'slug',
    badgeField: 'status'
});

// 3. Create list page
export const ProductListPage = createEntityListPage({
    entityName: 'product',
    columns: createColumns(t),
    useEntityQuery: hooks.useList
});
```

---

## Factory Reference

### createEntityHooks

Generates TanStack Query hooks for CRUD operations.

**Import:**

```tsx
import { createEntityHooks } from '@/lib/factories';
```

**Configuration:**

```tsx
interface EntityHooksConfig {
    entityName: string;      // Singular name (e.g., 'product')
    pluralName: string;      // Plural name (e.g., 'products')
    apiEndpoint: string;     // API endpoint (e.g., '/api/v1/products')
    queryKeyPrefix?: string; // Optional custom query key prefix
}
```

**Returns:**

```tsx
{
    useList,             // useQuery for list with pagination/sorting/search
    useDetail,           // useQuery for single item by ID
    useCreate,           // useMutation for creating
    useUpdate,           // useMutation for full update (PUT)
    usePatch,            // useMutation for partial update (PATCH)
    useDelete,           // useMutation for hard delete
    useSoftDelete,       // useMutation for soft delete
    useRestore,          // useMutation for restoring soft-deleted items
    useEntityOperations, // Combined hook returning all operations + utilities
    queryKeys,           // Query key factory for manual cache management
    config               // Reference to the original config
}
```

**Example:**

```tsx
const { useList, useDetail, useUpdate } = createEntityHooks<Product>({
    entityName: 'product',
    pluralName: 'products',
    apiEndpoint: '/api/v1/products'
});

// Use in component
function ProductList() {
    const { data, isLoading } = useList({ page: 1, pageSize: 10 });
    // ...
}
```

---

### createEntityLayout

Creates entity-level layouts with optional tab navigation.

**Import:**

```tsx
import { createEntityLayout, COMMON_TAB_PRESETS } from '@/lib/factories';
```

**Configuration:**

```tsx
interface EntityLayoutConfig {
    entityName: string;           // Entity identifier
    displayName: string;          // Display name (singular)
    basePath: string;             // Base route path
    tabs?: EntityTabConfig[];     // Optional tab navigation
    showBreadcrumbs?: boolean;    // Show breadcrumbs
    headerComponent?: () => ReactNode; // Custom header
    className?: string;           // Additional CSS classes
}

interface EntityTabConfig {
    id: string;          // Tab identifier
    label: string;       // Display label
    path: string;        // Path relative to basePath
    icon?: string;       // Optional icon
    permission?: string; // Required permission
    badge?: number | string; // Badge indicator
}
```

**Example:**

```tsx
// With custom tabs
const { Layout, tabs } = createEntityLayout({
    entityName: 'accommodations',
    displayName: 'Accommodation',
    basePath: '/accommodations',
    tabs: [
        { id: 'all', label: 'All', path: '' },
        { id: 'pending', label: 'Pending Review', path: '/pending' },
        { id: 'archived', label: 'Archived', path: '/archived' }
    ]
});

// With preset tabs
import { createEntityLayoutWithPreset, COMMON_TAB_PRESETS } from '@/lib/factories';

const { Layout } = createEntityLayoutWithPreset({
    entityName: 'posts',
    displayName: 'Post',
    basePath: '/posts',
    tabPreset: 'moderation' // Uses COMMON_TAB_PRESETS.moderation
});
```

**Available Presets:**

- `lifecycle` - All, Active, Drafts, Archived
- `moderation` - All, Pending Review, Approved, Rejected
- `content` - Published, Drafts, Scheduled
- `users` - All Users, Admins, Moderators, Banned

---

### createEntityRoutes

Creates reusable error and pending components for entity routes.

**Import:**

```tsx
import {
    createErrorComponent,
    createPendingComponent,
    createRouteComponents,
    createEntityLoader,
    RouteComponents
} from '@/lib/factories';
```

**Functions:**

#### createErrorComponent

Creates a customized error component for routes.

```tsx
export const Route = createFileRoute('/_authed/products/$id')({
    component: ProductViewPage,
    errorComponent: createErrorComponent('Product'),
    // ...
});
```

#### createPendingComponent

Creates a standard loading spinner component.

```tsx
export const Route = createFileRoute('/_authed/products/$id')({
    component: ProductViewPage,
    pendingComponent: createPendingComponent(),
    // ...
});
```

#### createRouteComponents

Convenience function that returns both error and pending components.

```tsx
const { errorComponent, pendingComponent } = createRouteComponents('Product');

export const Route = createFileRoute('/_authed/products/$id')({
    component: ProductViewPage,
    errorComponent,
    pendingComponent
});
```

#### RouteComponents

Pre-built generic components for simple cases.

```tsx
export const Route = createFileRoute('/_authed/products/$id')({
    component: ProductViewPage,
    errorComponent: RouteComponents.Error,
    pendingComponent: RouteComponents.Pending
});
```

#### createEntityLoader

Creates a standard loader that extracts entity ID.

```tsx
export const Route = createFileRoute('/_authed/products/$id')({
    loader: createEntityLoader(),
    component: ProductViewPage
});

// Access in component
function ProductViewPage() {
    const { entityId } = Route.useLoaderData();
    // ...
}
```

---

### createEntityListPage

Creates a complete list page component with table, pagination, and filters.

**Import:**

```tsx
import { createEntityListPage } from '@/lib/factories';
// or
import { createEntityListPage } from '@/components/entity-list';
```

**Configuration:**

```tsx
interface EntityListPageConfig<T> {
    entityName: string;
    pluralName: string;
    columns: ColumnDef<T>[];
    useEntityQuery: (params: QueryParams) => UseQueryResult;
    filterSchema?: ZodSchema;
    defaultFilters?: Partial<Filters>;
    onRowClick?: (row: T) => void;
    bulkActions?: BulkAction[];
}
```

**Example:**

```tsx
export const ProductListPage = createEntityListPage({
    entityName: 'product',
    pluralName: 'products',
    columns: productColumns,
    useEntityQuery: useProductListQuery,
    filterSchema: productFilterSchema,
    defaultFilters: { status: 'active' },
    onRowClick: (product) => navigate({ to: '/products/$id', params: { id: product.id } })
});
```

---

### createEntityColumnsFactory

Creates table column definitions with common patterns.

**Import:**

```tsx
import { createEntityColumnsFactory } from '@/lib/factories';
// or
import { createEntityColumnsFactory } from '@/components/entity-list';
```

**Configuration:**

```tsx
interface ColumnFactoryConfig<T> {
    nameField: keyof T;           // Field for name column
    slugField?: keyof T;          // Optional slug field
    badgeField?: keyof T;         // Field for status badge
    timestampFields?: boolean;    // Include created/updated columns
    actionsColumn?: boolean;      // Include actions column
}
```

**Example:**

```tsx
const createColumns = createEntityColumnsFactory<ProductListItem>({
    nameField: 'name',
    slugField: 'slug',
    badgeField: 'lifecycleStatus',
    timestampFields: true,
    actionsColumn: true
});

// Use with translation function
const columns = createColumns(t);
```

---

### createEntityApi

Creates typed API functions for entity operations.

**Import:**

```tsx
import { createEntityApi } from '@/lib/factories';
// or
import { createEntityApi } from '@/components/entity-list/api/createEntityApi';
```

**Example:**

```tsx
const productApi = createEntityApi<Product, CreateProduct, UpdateProduct>({
    basePath: '/api/v1/products',
    responseSchema: ProductSchema
});

// Available methods
productApi.list({ page: 1 });
productApi.getById('uuid');
productApi.create(data);
productApi.update('uuid', data);
productApi.delete('uuid');
productApi.restore('uuid');
```

---

### createEntityQueryKeys

Creates standardized query keys for TanStack Query.

**Import:**

```tsx
import { createEntityQueryKeys } from '@/lib/factories';
// or
import { createEntityQueryKeys } from '@/lib/query-keys/factory';
```

**Example:**

```tsx
const productKeys = createEntityQueryKeys('products');

// Returns
productKeys.all          // ['products']
productKeys.lists()      // ['products', 'list']
productKeys.list(params) // ['products', 'list', params]
productKeys.details()    // ['products', 'detail']
productKeys.detail(id)   // ['products', 'detail', id]
```

---

## Base Columns Factory

For common table column patterns.

**Import:**

```tsx
import {
    createAllBaseColumns,
    createTimestampColumns,
    createAuditColumns,
    createLifecycleColumn,
    mergeWithBaseColumns
} from '@/lib/factories';
```

**Available Functions:**

- `createAllBaseColumns(t)` - All base columns (lifecycle, audit, timestamps)
- `createTimestampColumns(t)` - createdAt, updatedAt columns
- `createAuditColumns(t)` - createdBy, updatedBy columns
- `createLifecycleColumn(t)` - Status badge column
- `createModerationColumn(t)` - Moderation status column
- `createVisibilityColumn(t)` - Visibility badge column
- `createFeaturedColumn(t)` - Featured checkbox column
- `createEntityRefColumn(t, config)` - Link to related entity
- `createNameColumn(t, config)` - Name with optional link

**Example:**

```tsx
const columns = mergeWithBaseColumns(
    [
        createNameColumn(t, { linkTo: '/products/$id' }),
        // ... entity-specific columns
    ],
    createAllBaseColumns(t)
);
```

---

## Type Definitions

### EntityPageHookConfig

Standard interface for entity page hooks.

```tsx
import type { EntityPageHookConfig } from '@/lib/factories';

// Use when creating new entity page hooks
function useProductPage(id: string): EntityPageHookConfig<Product> {
    // Implementation
}
```

### CreateEntityPageHook

Type helper for entity page hook signatures.

```tsx
import type { CreateEntityPageHook } from '@/lib/factories';

const useProductPage: CreateEntityPageHook<Product> = (id) => {
    // Implementation
};
```

---

## Best Practices

### Do

- Use factories for all new entities
- Keep entity-specific logic in feature folders
- Use type parameters for full type safety
- Combine multiple factories for complete setup

### Do Not

- Duplicate factory logic in route files
- Skip type parameters (use generics)
- Modify factory return values directly
- Create one-off implementations for common patterns

### Example: Complete Entity Setup

```tsx
// features/products/index.ts
import {
    createEntityHooks,
    createEntityLayout,
    createRouteComponents,
    createEntityQueryKeys
} from '@/lib/factories';

// Query keys
export const productKeys = createEntityQueryKeys('products');

// API hooks
export const productHooks = createEntityHooks<Product>({
    entityName: 'product',
    pluralName: 'products',
    apiEndpoint: '/api/v1/products'
});

// Layout with tabs
export const { Layout: ProductLayout } = createEntityLayout({
    entityName: 'products',
    displayName: 'Product',
    basePath: '/products',
    tabs: [
        { id: 'all', label: 'All', path: '' },
        { id: 'active', label: 'Active', path: '/active' }
    ]
});

// Route components
export const productRouteComponents = createRouteComponents('Product');
```

---

## Migration Guide

### From Manual Implementation

**Before:**

```tsx
// Lots of boilerplate in each route file
export const Route = createFileRoute('/_authed/products/$id')({
    component: ProductViewPage,
    errorComponent: ({ error }) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center">
            <h2>Error Loading Product</h2>
            <p>{error.message}</p>
            <button onClick={() => window.history.back()}>Go Back</button>
        </div>
    ),
    pendingComponent: () => (
        <div className="flex min-h-[400px] items-center justify-center">
            <div className="animate-spin" />
        </div>
    )
});
```

**After:**

```tsx
import { createRouteComponents } from '@/lib/factories';

const { errorComponent, pendingComponent } = createRouteComponents('Product');

export const Route = createFileRoute('/_authed/products/$id')({
    component: ProductViewPage,
    errorComponent,
    pendingComponent
});
```

---

## Related Documentation

- [Creating Pages](./creating-pages.md) - Full page creation guide
- [Tables](./tables.md) - Table configuration details
- [Queries](./queries.md) - TanStack Query patterns
- [Routing](./routing.md) - File-based routing

---

Back to [Development Documentation](./README.md)
