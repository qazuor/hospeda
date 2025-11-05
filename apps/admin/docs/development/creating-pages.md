# Creating Pages Tutorial

Step-by-step tutorial for building complete CRUD pages in the Hospeda Admin Dashboard.

---

## 📖 Overview

This tutorial will guide you through creating a complete set of admin pages with **full CRUD functionality** (Create, Read, Update, Delete). We'll build a "Products" management feature as an example that you can adapt to any entity.

**What you'll build:**

- List page with data table
- Detail/view page
- Create page with form
- Edit page with form
- Complete data fetching and mutations
- Loading and error states
- Route protection

**Time to complete:** ~30-45 minutes

**Prerequisites:**

- Read [Routing Guide](./routing.md)
- Read [Architecture Overview](../architecture.md)
- Basic understanding of React and TypeScript
- Admin dev server running (`pnpm dev`)

---

## 🎯 What We're Building

We'll create a "Products" management feature with these pages:

```text
/products              → List all products
/products/:id          → View product details
/products/new          → Create new product
/products/:id/edit     → Edit existing product
```

**Features:**

- Data table with sorting and pagination
- Search and filters
- Form validation with Zod
- Optimistic updates
- Loading states
- Error handling
- Type safety throughout

---

## 📁 Step 1: Project Structure

### Create Feature Folder

First, create the feature folder structure:

```bash
# From project root
mkdir -p apps/admin/src/features/products/{components,hooks}
touch apps/admin/src/features/products/queries.ts
touch apps/admin/src/features/products/types.ts
touch apps/admin/src/features/products/index.ts
```

**Resulting structure:**

```text
src/features/products/
├── components/          # Product-specific components
├── hooks/              # Product-specific hooks
├── queries.ts          # Data fetching functions
├── types.ts            # Product types
└── index.ts            # Barrel exports
```

### Create Route Files

```bash
mkdir -p apps/admin/src/routes/products
touch apps/admin/src/routes/products/index.tsx
touch apps/admin/src/routes/products/\$id.tsx
touch apps/admin/src/routes/products/new.tsx
touch apps/admin/src/routes/products/\$id.edit.tsx
```

**Resulting structure:**

```text
src/routes/products/
├── index.tsx           # List page
├── $id.tsx             # Detail page
├── $id.edit.tsx        # Edit page
└── new.tsx             # Create page
```

---

## 📊 Step 2: Define Types

Define types in `src/features/products/types.ts`:

```ts
// src/features/products/types.ts

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductData = Omit<
  Product,
  'id' | 'createdAt' | 'updatedAt'
>;

export type UpdateProductData = Partial<CreateProductData>;

export type ProductFilters = {
  category?: string;
  isActive?: boolean;
  search?: string;
};

export type ProductListResponse = {
  products: Product[];
  total: number;
  page: number;
  limit: number;
};
```

---

## 🔌 Step 3: Data Fetching Functions

Create data fetching functions in `src/features/products/queries.ts`:

```ts
// src/features/products/queries.ts
import { fetchAPI } from '@/lib/api';
import type {
  Product,
  CreateProductData,
  UpdateProductData,
  ProductListResponse,
  ProductFilters,
} from './types';

type GetProductsOptions = {
  page?: number;
  limit?: number;
  filters?: ProductFilters;
  signal?: AbortSignal;
};

export async function getProducts({
  page = 1,
  limit = 20,
  filters,
  signal,
}: GetProductsOptions = {}): Promise<ProductListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters?.category) {
    params.append('category', filters.category);
  }

  if (filters?.isActive !== undefined) {
    params.append('isActive', filters.isActive.toString());
  }

  if (filters?.search) {
    params.append('search', filters.search);
  }

  return fetchAPI(`/api/v1/products?${params.toString()}`, { signal });
}

export async function getProduct(
  id: string,
  options?: { signal?: AbortSignal }
): Promise<Product> {
  return fetchAPI(`/api/v1/products/${id}`, { signal: options?.signal });
}

export async function createProduct(data: CreateProductData): Promise<Product> {
  return fetchAPI('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  id: string,
  data: UpdateProductData
): Promise<Product> {
  return fetchAPI(`/api/v1/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  return fetchAPI(`/api/v1/products/${id}`, {
    method: 'DELETE',
  });
}
```

---

## 📋 Step 4: List Page

Create the list page in `src/routes/products/index.tsx`:

```tsx
// src/routes/products/index.tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { getProducts } from '@/features/products/queries';
import { Button } from '@/components/ui/button';
import { ProductsTable } from '@/features/products/components/ProductsTable';

// Validate search params
const searchSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(20),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

export const Route = createFileRoute('/products/')({
  validateSearch: searchSchema,
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();

  // Fetch products
  const { data, isLoading, error } = useQuery({
    queryKey: ['products', search],
    queryFn: ({ signal }) =>
      getProducts({
        page: search.page,
        limit: search.limit,
        filters: {
          category: search.category,
          isActive: search.isActive,
          search: search.search,
        },
        signal,
      }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-600">
          Error loading products: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog
          </p>
        </div>
        <Link to="/products/new">
          <Button>Create Product</Button>
        </Link>
      </div>

      {/* Table */}
      <ProductsTable data={data} />
    </div>
  );
}
```

### Create the Table Component

Create `src/features/products/components/ProductsTable.tsx`:

```tsx
// src/features/products/components/ProductsTable.tsx
import { Link } from '@tanstack/react-router';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Product, ProductListResponse } from '../types';
import { Button } from '@/components/ui/button';

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'category',
    header: 'Category',
  },
  {
    accessorKey: 'price',
    header: 'Price',
    cell: ({ row }) => {
      const price = row.original.price;
      return `$${price.toFixed(2)}`;
    },
  },
  {
    accessorKey: 'stock',
    header: 'Stock',
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      return row.original.isActive ? (
        <span className="text-green-600">Active</span>
      ) : (
        <span className="text-gray-400">Inactive</span>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex gap-2">
          <Link to="/products/$id" params={{ id: product.id }}>
            <Button variant="outline" size="sm">
              View
            </Button>
          </Link>
          <Link to="/products/$id/edit" params={{ id: product.id }}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
        </div>
      );
    },
  },
];

type ProductsTableProps = {
  data: ProductListResponse;
};

export function ProductsTable({ data }: ProductsTableProps) {
  const table = useReactTable({
    data: data.products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-muted/50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="p-4 text-left font-medium"
                >
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
            <tr key={row.id} className="border-b">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination info */}
      <div className="flex items-center justify-between p-4">
        <div className="text-sm text-muted-foreground">
          Showing {data.products.length} of {data.total} products
        </div>
      </div>
    </div>
  );
}
```

---

## 👁️ Step 5: Detail Page

Create the detail page in `src/routes/products/$id.tsx`:

```tsx
// src/routes/products/$id.tsx
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getProduct } from '@/features/products/queries';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/products/$id')({
  loader: async ({ params, context }) => {
    // Prefetch on server
    const product = await getProduct(params.id);

    if (!product) {
      throw notFound();
    }

    return { product };
  },

  component: ProductDetailPage,

  notFoundComponent: () => {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h2 className="text-2xl font-bold">Product Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          The product you're looking for doesn't exist.
        </p>
        <Link to="/products" className="mt-4">
          <Button>Back to Products</Button>
        </Link>
      </div>
    );
  },
});

function ProductDetailPage() {
  const { id } = Route.useParams();

  // Client-side query with initial data from loader
  const { data: product, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn: ({ signal }) => getProduct(id, { signal }),
    initialData: Route.useLoaderData().product,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading product...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">{product.category}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/products">
            <Button variant="outline">Back</Button>
          </Link>
          <Link to="/products/$id/edit" params={{ id }}>
            <Button>Edit</Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Details */}
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Details</h2>

          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Description
            </div>
            <div className="mt-1">{product.description}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Price
              </div>
              <div className="mt-1 text-lg font-semibold">
                ${product.price.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Stock
              </div>
              <div className="mt-1 text-lg font-semibold">
                {product.stock} units
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Status
            </div>
            <div className="mt-1">
              {product.isActive ? (
                <span className="text-green-600 font-medium">Active</span>
              ) : (
                <span className="text-gray-400">Inactive</span>
              )}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Metadata</h2>

          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Product ID
            </div>
            <div className="mt-1 font-mono text-sm">{product.id}</div>
          </div>

          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Created At
            </div>
            <div className="mt-1">
              {new Date(product.createdAt).toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Last Updated
            </div>
            <div className="mt-1">
              {new Date(product.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## ✏️ Step 6: Create/Edit Forms

### Create Form Component

Create `src/features/products/components/ProductForm.tsx`:

```tsx
// src/features/products/components/ProductForm.tsx
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';
import type { Product, CreateProductData } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Validation schema
const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  stock: z.number().int().nonnegative('Stock must be non-negative'),
  isActive: z.boolean(),
});

type ProductFormProps = {
  product?: Product;
  onSubmit: (data: CreateProductData) => Promise<void>;
  submitLabel?: string;
};

export function ProductForm({
  product,
  onSubmit,
  submitLabel = 'Save',
}: ProductFormProps) {
  const form = useForm({
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price ?? 0,
      category: product?.category ?? '',
      stock: product?.stock ?? 0,
      isActive: product?.isActive ?? true,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
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
      className="space-y-6"
    >
      {/* Name */}
      <form.Field
        name="name"
        validators={{
          onChange: productSchema.shape.name,
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Name *</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Product name"
            />
            {field.state.meta.errors && (
              <div className="text-sm text-red-600">
                {field.state.meta.errors.join(', ')}
              </div>
            )}
          </div>
        )}
      </form.Field>

      {/* Description */}
      <form.Field
        name="description"
        validators={{
          onChange: productSchema.shape.description,
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Description *</Label>
            <Textarea
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Product description"
              rows={4}
            />
            {field.state.meta.errors && (
              <div className="text-sm text-red-600">
                {field.state.meta.errors.join(', ')}
              </div>
            )}
          </div>
        )}
      </form.Field>

      {/* Price and Category */}
      <div className="grid gap-6 md:grid-cols-2">
        <form.Field
          name="price"
          validators={{
            onChange: productSchema.shape.price,
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Price *</Label>
              <Input
                id={field.name}
                type="number"
                step="0.01"
                value={field.state.value}
                onChange={(e) => field.handleChange(parseFloat(e.target.value))}
                placeholder="0.00"
              />
              {field.state.meta.errors && (
                <div className="text-sm text-red-600">
                  {field.state.meta.errors.join(', ')}
                </div>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="category"
          validators={{
            onChange: productSchema.shape.category,
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Category *</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Product category"
              />
              {field.state.meta.errors && (
                <div className="text-sm text-red-600">
                  {field.state.meta.errors.join(', ')}
                </div>
              )}
            </div>
          )}
        </form.Field>
      </div>

      {/* Stock and Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <form.Field
          name="stock"
          validators={{
            onChange: productSchema.shape.stock,
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Stock *</Label>
              <Input
                id={field.name}
                type="number"
                value={field.state.value}
                onChange={(e) => field.handleChange(parseInt(e.target.value))}
                placeholder="0"
              />
              {field.state.meta.errors && (
                <div className="text-sm text-red-600">
                  {field.state.meta.errors.join(', ')}
                </div>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="isActive">
          {(field) => (
            <div className="flex items-center space-x-2 pt-8">
              <input
                id={field.name}
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor={field.name} className="font-normal">
                Product is active
              </Label>
            </div>
          )}
        </form.Field>
      </div>

      {/* Submit */}
      <div className="flex gap-2">
        <Button type="submit" disabled={form.state.isSubmitting}>
          {form.state.isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
```

### Create Page

Create `src/routes/products/new.tsx`:

```tsx
// src/routes/products/new.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProduct } from '@/features/products/queries';
import { ProductForm } from '@/features/products/components/ProductForm';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/products/new')({
  component: CreateProductPage,
});

function CreateProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (product) => {
      // Invalidate list query
      queryClient.invalidateQueries({ queryKey: ['products'] });

      // Navigate to detail page
      navigate({
        to: '/products/$id',
        params: { id: product.id },
      });
    },
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create Product</h1>
          <p className="text-muted-foreground">
            Add a new product to your catalog
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate({ to: '/products' })}
        >
          Cancel
        </Button>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <div className="rounded-lg border p-6">
          {mutation.isError && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-red-600">
              Error creating product: {mutation.error.message}
            </div>
          )}

          <ProductForm
            onSubmit={(data) => mutation.mutateAsync(data)}
            submitLabel="Create Product"
          />
        </div>
      </div>
    </div>
  );
}
```

### Edit Page

Create `src/routes/products/$id.edit.tsx`:

```tsx
// src/routes/products/$id.edit.tsx
import { createFileRoute, useNavigate, notFound } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProduct, updateProduct } from '@/features/products/queries';
import { ProductForm } from '@/features/products/components/ProductForm';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/products/$id/edit')({
  loader: async ({ params }) => {
    const product = await getProduct(params.id);

    if (!product) {
      throw notFound();
    }

    return { product };
  },

  component: EditProductPage,
});

function EditProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get product data
  const { data: product, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn: ({ signal }) => getProduct(id, { signal }),
    initialData: Route.useLoaderData().product,
  });

  // Update mutation
  const mutation = useMutation({
    mutationFn: (data: typeof product) => updateProduct(id, data),
    onSuccess: (updatedProduct) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', id] });

      // Navigate to detail page
      navigate({
        to: '/products/$id',
        params: { id: updatedProduct.id },
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading product...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">{product.name}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate({ to: '/products/$id', params: { id } })}
        >
          Cancel
        </Button>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <div className="rounded-lg border p-6">
          {mutation.isError && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-red-600">
              Error updating product: {mutation.error.message}
            </div>
          )}

          <ProductForm
            product={product}
            onSubmit={(data) => mutation.mutateAsync(data)}
            submitLabel="Update Product"
          />
        </div>
      </div>
    </div>
  );
}
```

---

## ✅ Step 7: Add to Navigation

Add the Products link to your sidebar navigation:

```tsx
// src/components/layouts/Sidebar.tsx (or wherever your nav is)
import { Link } from '@tanstack/react-router';

export function Sidebar() {
  return (
    <nav>
      {/* Other nav items */}
      <Link
        to="/products"
        className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
      >
        <PackageIcon />
        <span>Products</span>
      </Link>
    </nav>
  );
}
```

---

## 🧪 Step 8: Test Your Pages

### Manual Testing Checklist

**List page (`/products`):**

- [ ] Page loads without errors
- [ ] Products display in table
- [ ] "Create Product" button visible
- [ ] Can click "View" to see product detail
- [ ] Can click "Edit" to edit product
- [ ] Pagination info shows correctly

**Detail page (`/products/:id`):**

- [ ] Product details display correctly
- [ ] All fields show proper values
- [ ] "Edit" button navigates to edit page
- [ ] "Back" button returns to list

**Create page (`/products/new`):**

- [ ] Form displays all fields
- [ ] Validation works (try submitting empty)
- [ ] Can successfully create product
- [ ] Redirects to detail page after creation
- [ ] New product appears in list

**Edit page (`/products/:id/edit`):**

- [ ] Form pre-fills with product data
- [ ] Can update fields
- [ ] Validation works
- [ ] Can successfully save changes
- [ ] Changes reflect in detail page

### Automated Testing

Add tests in `test/routes/products/`:

```tsx
// test/routes/products/index.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/features/products/queries', () => ({
  getProducts: vi.fn().mockResolvedValue({
    products: [
      {
        id: '1',
        name: 'Test Product',
        category: 'Test',
        price: 99.99,
        stock: 10,
        isActive: true,
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  }),
}));

describe('Products List Page', () => {
  it('should render products table', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ProductsPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Test Product')).toBeInTheDocument();
  });
});
```

---

## 🎨 Enhancements (Optional)

### Add Delete Functionality

Add delete button to detail page:

```tsx
// In ProductDetailPage component
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteProduct } from '@/features/products/queries';

function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate({ to: '/products' });
    },
  });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteMutation.mutate();
    }
  };

  return (
    <div>
      {/* ... existing code ... */}
      <Button variant="destructive" onClick={handleDelete}>
        Delete Product
      </Button>
    </div>
  );
}
```

### Add Search

Add search input to list page:

```tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';

function ProductsPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [searchValue, setSearchValue] = useState(search.search ?? '');

  const handleSearch = () => {
    navigate({
      search: (prev) => ({ ...prev, search: searchValue, page: 1 }),
    });
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          placeholder="Search products..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>
      {/* ... rest of component ... */}
    </div>
  );
}
```

---

## 💡 Best Practices

### Do's

**✅ Keep route files thin**

```tsx
// ✅ Good - logic in feature folder
import { ProductsTable } from '@/features/products/components/ProductsTable';
import { getProducts } from '@/features/products/queries';

export const Route = createFileRoute('/products/')({
  component: ProductsPage,
});

function ProductsPage() {
  // Just composition, no business logic
  return <ProductsTable />;
}
```

**✅ Use loaders for SSR**

```tsx
// ✅ Good - data fetched on server
export const Route = createFileRoute('/products/$id')({
  loader: async ({ params }) => {
    return { product: await getProduct(params.id) };
  },
  component: ProductDetail,
});
```

**✅ Handle loading and error states**

```tsx
// ✅ Good - user feedback
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
```

### Don'ts

**❌ Don't put business logic in routes**

```tsx
// ❌ Bad - business logic in route
function ProductsPage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then(setProducts);
  }, []);

  // Complex filtering, sorting, etc...
}
```

**❌ Don't skip error handling**

```tsx
// ❌ Bad - no error handling
function ProductDetail() {
  const { data } = useQuery({ queryKey: ['product'], queryFn: getProduct });

  // What if data is undefined?
  return <div>{data.name}</div>;
}
```

**❌ Don't forget to invalidate queries**

```tsx
// ❌ Bad - cache not updated
const mutation = useMutation({
  mutationFn: createProduct,
  // List won't show new product!
});
```

---

## 🐛 Troubleshooting

### Issue: "Route not found"

**Solution:** Verify file path matches route definition:

```tsx
// File: src/routes/products/index.tsx
export const Route = createFileRoute('/products/')({
  // Must match file location
```

### Issue: "Type errors with params"

**Solution:** Use correct hooks from Route object:

```tsx
// ❌ Wrong
const { id } = useParams();

// ✅ Correct
const { id } = Route.useParams();
```

### Issue: "Form not submitting"

**Solution:** Check form.handleSubmit() is called:

```tsx
<form
  onSubmit={(e) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit(); // ← Don't forget this!
  }}
>
```

### Issue: "Data not updating after mutation"

**Solution:** Invalidate queries after mutations:

```tsx
const mutation = useMutation({
  mutationFn: updateProduct,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  },
});
```

---

## 📖 Next Steps

Now that you've built a complete CRUD feature:

1. **Read more guides:**
   - [Forms](./forms.md) - Advanced form patterns
   - [Tables](./tables.md) - Table features (sorting, filtering)
   - [Queries](./queries.md) - Advanced data fetching

2. **Add more features:**
   - Filters and advanced search
   - Sorting and pagination
   - Image uploads
   - Bulk operations

3. **Improve UX:**
   - Loading skeletons
   - Optimistic updates
   - Toast notifications
   - Keyboard shortcuts

---

⬅️ Back to [Development Documentation](./README.md)
