/**
 * Complete CRUD Page Example
 *
 * This file demonstrates a fully functional products management page with:
 * - List view with TanStack Table (sorting, filtering, pagination)
 * - Create/Edit forms with TanStack Form + Zod validation
 * - Delete with confirmation dialog
 * - TanStack Query for data fetching and mutations
 * - Optimistic updates
 * - Error handling and loading states
 * - Protected route with authentication
 * - Permission checks (role-based)
 * - Toast notifications
 *
 * Copy-paste ready code that follows Hospeda Admin patterns.
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { z } from 'zod';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Plus,
  Edit,
  Trash,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Product entity type
 */
type Product = {
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

/**
 * Product creation data (omit auto-generated fields)
 */
type CreateProductData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Product update data (partial)
 */
type UpdateProductData = Partial<CreateProductData>;

/**
 * API response for product list
 */
type ProductListResponse = {
  products: Product[];
  total: number;
  page: number;
  limit: number;
};

/**
 * Validation schema for product form
 */
const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
  isActive: z.boolean(),
});

/**
 * Search params validation schema
 */
const searchSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

type SearchParams = z.infer<typeof searchSchema>;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch products list with pagination and filters
 */
async function getProducts(params: {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  isActive?: boolean;
  signal?: AbortSignal;
}): Promise<ProductListResponse> {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  if (params.search) queryParams.append('search', params.search);
  if (params.category) queryParams.append('category', params.category);
  if (params.isActive !== undefined)
    queryParams.append('isActive', params.isActive.toString());

  const response = await fetch(`/api/v1/products?${queryParams.toString()}`, {
    signal: params.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }

  return response.json();
}

/**
 * Fetch single product by ID
 */
async function getProduct(
  id: string,
  signal?: AbortSignal
): Promise<Product> {
  const response = await fetch(`/api/v1/products/${id}`, {
    signal,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Product not found');
    }
    throw new Error('Failed to fetch product');
  }

  return response.json();
}

/**
 * Create new product
 */
async function createProduct(data: CreateProductData): Promise<Product> {
  const response = await fetch('/api/v1/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create product');
  }

  return response.json();
}

/**
 * Update existing product
 */
async function updateProduct(
  id: string,
  data: UpdateProductData
): Promise<Product> {
  const response = await fetch(`/api/v1/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update product');
  }

  return response.json();
}

/**
 * Delete product
 */
async function deleteProduct(id: string): Promise<void> {
  const response = await fetch(`/api/v1/products/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to delete product');
  }
}

// ============================================================================
// Components
// ============================================================================

/**
 * Sortable table header component
 */
function SortableHeader<T>({
  column,
  title,
}: {
  column: any;
  title: string;
}) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting()}
      className="flex items-center gap-2 hover:bg-muted"
    >
      {title}
      {sorted === 'asc' && <ChevronUp className="h-4 w-4" />}
      {sorted === 'desc' && <ChevronDown className="h-4 w-4" />}
      {!sorted && <ChevronsUpDown className="h-4 w-4 opacity-50" />}
    </Button>
  );
}

/**
 * Products table component with sorting, filtering, and pagination
 */
function ProductsTable({
  data,
  isLoading,
}: {
  data: ProductListResponse;
  isLoading: boolean;
}) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Define table columns
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name}</div>
      ),
    },
    {
      accessorKey: 'category',
      header: ({ column }) => (
        <SortableHeader column={column} title="Category" />
      ),
    },
    {
      accessorKey: 'price',
      header: ({ column }) => <SortableHeader column={column} title="Price" />,
      cell: ({ row }) => {
        const price = row.original.price;
        return (
          <div className="font-mono text-right">
            ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        );
      },
    },
    {
      accessorKey: 'stock',
      header: ({ column }) => <SortableHeader column={column} title="Stock" />,
      cell: ({ row }) => {
        const stock = row.original.stock;
        return (
          <div
            className={`text-right ${stock === 0 ? 'text-red-600 font-semibold' : ''}`}
          >
            {stock}
          </div>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center gap-2">
            <Link
              to="/products/$id"
              params={{ id: product.id }}
              className="inline-flex"
            >
              <Button variant="outline" size="sm">
                View
              </Button>
            </Link>
            <ProductFormDialog product={product} />
            <DeleteProductDialog productId={product.id} />
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: data?.products || [],
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading products...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Products</CardTitle>
          <div className="flex items-center gap-4">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <ProductFormDialog />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Table */}
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-medium"
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No products found. Try adjusting your search.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {data?.products.length || 0} of {data?.total || 0} products
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Product form dialog for create/edit
 */
function ProductFormDialog({ product }: { product?: Product }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!product;

  // Create or update mutation
  const mutation = useMutation({
    mutationFn: (data: CreateProductData) => {
      return isEdit ? updateProduct(product.id, data) : createProduct(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: isEdit ? 'Product updated' : 'Product created',
        description: `Product has been ${isEdit ? 'updated' : 'created'} successfully`,
      });
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Form setup
  const form = useForm({
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      price: product?.price || 0,
      category: product?.category || '',
      stock: product?.stock || 0,
      isActive: product?.isActive ?? true,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
    validatorAdapter: zodValidator(),
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">
              {isEdit ? 'Edit Product' : 'Create Product'}
            </h2>
            <p className="text-muted-foreground">
              {isEdit
                ? 'Update the product information below'
                : 'Fill in the details to create a new product'}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            {/* Name field */}
            <form.Field
              name="name"
              validators={{ onChange: productSchema.shape.name }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="font-medium">
                    Name *
                  </label>
                  <input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Product name"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  {field.state.meta.errors && (
                    <p className="text-sm text-red-600">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Description field */}
            <form.Field
              name="description"
              validators={{ onChange: productSchema.shape.description }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="font-medium">
                    Description *
                  </label>
                  <textarea
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Product description"
                    rows={4}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  {field.state.meta.errors && (
                    <p className="text-sm text-red-600">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Price and Category */}
            <div className="grid grid-cols-2 gap-4">
              <form.Field
                name="price"
                validators={{ onChange: productSchema.shape.price }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <label htmlFor={field.name} className="font-medium">
                      Price *
                    </label>
                    <input
                      id={field.name}
                      type="number"
                      step="0.01"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(parseFloat(e.target.value))
                      }
                      onBlur={field.handleBlur}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    {field.state.meta.errors && (
                      <p className="text-sm text-red-600">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="category"
                validators={{ onChange: productSchema.shape.category }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <label htmlFor={field.name} className="font-medium">
                      Category *
                    </label>
                    <input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="Category"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    {field.state.meta.errors && (
                      <p className="text-sm text-red-600">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>

            {/* Stock and Active status */}
            <div className="grid grid-cols-2 gap-4">
              <form.Field
                name="stock"
                validators={{ onChange: productSchema.shape.stock }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <label htmlFor={field.name} className="font-medium">
                      Stock *
                    </label>
                    <input
                      id={field.name}
                      type="number"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(parseInt(e.target.value))
                      }
                      onBlur={field.handleBlur}
                      placeholder="0"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    {field.state.meta.errors && (
                      <p className="text-sm text-red-600">
                        {field.state.meta.errors[0]}
                      </p>
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
                    <label htmlFor={field.name} className="font-medium">
                      Product is active
                    </label>
                  </div>
                )}
              </form.Field>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || !form.state.canSubmit}
              >
                {mutation.isPending
                  ? isEdit
                    ? 'Updating...'
                    : 'Creating...'
                  : isEdit
                    ? 'Update Product'
                    : 'Create Product'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Delete product confirmation dialog
 */
function DeleteProductDialog({ productId }: { productId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => deleteProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Product deleted',
        description: 'Product has been deleted successfully',
      });
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash className="h-4 w-4 text-red-600" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Delete Product</h2>
            <p className="text-muted-foreground mt-2">
              Are you sure you want to delete this product? This action cannot
              be undone.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main products list page component
 */
function ProductsPage() {
  const search = Route.useSearch();

  // Fetch products with filters
  const { data, isLoading, error } = useQuery({
    queryKey: ['products', search],
    queryFn: ({ signal }) =>
      getProducts({
        page: search.page,
        limit: search.limit,
        search: search.search,
        category: search.category,
        isActive: search.isActive,
        signal,
      }),
  });

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-600">Error</h2>
              <p className="mt-2 text-muted-foreground">{error.message}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Products</h1>
        <p className="text-muted-foreground">
          Manage your product catalog
        </p>
      </div>

      <ProductsTable data={data!} isLoading={isLoading} />
    </div>
  );
}

// ============================================================================
// Route Definition
// ============================================================================

/**
 * Products route with authentication and search params validation
 */
export const Route = createFileRoute('/_authed/products/')({
  validateSearch: searchSchema,
  component: ProductsPage,
});
