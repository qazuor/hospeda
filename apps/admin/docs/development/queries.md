# Data Fetching Guide

Complete guide to data fetching with TanStack Query (React Query) in the Hospeda Admin Dashboard.

---

## 📖 Overview

TanStack Query provides **powerful data synchronization** for server state. It handles caching, background updates, stale data, and much more with zero configuration.

**What you'll learn:**

- Query basics with useQuery
- Mutations with useMutation
- Query invalidation patterns
- Optimistic updates
- Error handling
- Loading states
- Caching strategies
- Query keys best practices
- Advanced patterns

**Prerequisites:**

- Understanding of async/await
- Basic TypeScript knowledge
- Familiarity with REST APIs
- Read [Creating Pages Tutorial](./creating-pages.md)

---

## 🚀 Quick Start

### Basic Query Example

```tsx
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/lib/api';

function ProductsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  if (isLoading) {
    return <div>Loading products...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <ul>
      {data.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

### Basic Mutation Example

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProduct } from '@/lib/api';

function CreateProductForm() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const handleSubmit = (data: ProductData) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create'}
      </button>
      {mutation.isError && (
        <div>Error: {mutation.error.message}</div>
      )}
    </form>
  );
}
```

---

## 🔍 Queries (useQuery)

### Basic Query

```tsx
import { useQuery } from '@tanstack/react-query';

function ProductDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products', id],
    queryFn: () => getProduct(id),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{data.name}</div>;
}
```

### Query Options

```tsx
const { data, isLoading, error, isFetching, isStale } = useQuery({
  // Required
  queryKey: ['products', id],
  queryFn: () => getProduct(id),

  // Optional
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  enabled: !!id, // Only run if id exists
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  refetchOnReconnect: true,
});
```

### Query Keys

Query keys uniquely identify queries:

```tsx
// Simple key
useQuery({
  queryKey: ['products'],
  queryFn: getProducts,
});

// Key with params
useQuery({
  queryKey: ['products', id],
  queryFn: () => getProduct(id),
});

// Key with filters
useQuery({
  queryKey: ['products', { status: 'active', category: 'electronics' }],
  queryFn: () => getProducts({ status: 'active', category: 'electronics' }),
});

// Hierarchical keys
useQuery({
  queryKey: ['products', id, 'reviews'],
  queryFn: () => getProductReviews(id),
});
```

**Best practices:**

```tsx
// ✅ Good - specific and consistent
['products'] // All products
['products', id] // Single product
['products', id, 'reviews'] // Product reviews
['products', { page: 1, limit: 20 }] // Paginated products

// ❌ Bad - inconsistent structure
['products', 'list']
['product', id] // Wrong - not consistent with 'products'
['reviews', id] // Wrong - should be ['products', id, 'reviews']
```

### Dependent Queries

Wait for one query before running another:

```tsx
function ProductReviews({ productId }: { productId: string }) {
  // First query
  const {
    data: product,
    isLoading: isLoadingProduct,
  } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => getProduct(productId),
  });

  // Second query - depends on first
  const {
    data: reviews,
    isLoading: isLoadingReviews,
  } = useQuery({
    queryKey: ['products', productId, 'reviews'],
    queryFn: () => getProductReviews(productId),
    enabled: !!product, // Only run if product exists
  });

  if (isLoadingProduct) return <div>Loading product...</div>;
  if (isLoadingReviews) return <div>Loading reviews...</div>;

  return (
    <div>
      <h2>{product.name}</h2>
      <ul>
        {reviews.map((review) => (
          <li key={review.id}>{review.text}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Parallel Queries

Run multiple queries simultaneously:

```tsx
function Dashboard() {
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
  });

  if (
    productsQuery.isLoading ||
    usersQuery.isLoading ||
    ordersQuery.isLoading
  ) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div>
      <ProductsWidget data={productsQuery.data} />
      <UsersWidget data={usersQuery.data} />
      <OrdersWidget data={ordersQuery.data} />
    </div>
  );
}
```

Or use `useQueries` for dynamic parallel queries:

```tsx
import { useQueries } from '@tanstack/react-query';

function MultipleProducts({ ids }: { ids: string[] }) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['products', id],
      queryFn: () => getProduct(id),
    })),
  });

  const isLoading = results.some((result) => result.isLoading);
  const products = results.map((result) => result.data);

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

---

## 🔄 Mutations (useMutation)

### Basic Mutation

```tsx
import { useMutation } from '@tanstack/react-query';

function CreateProduct() {
  const mutation = useMutation({
    mutationFn: createProduct,
  });

  const handleSubmit = (data: ProductData) => {
    mutation.mutate(data);
  };

  return (
    <div>
      <button onClick={() => handleSubmit(formData)}>Create</button>
      {mutation.isPending && <div>Creating...</div>}
      {mutation.isError && <div>Error: {mutation.error.message}</div>}
      {mutation.isSuccess && <div>Product created!</div>}
    </div>
  );
}
```

### Mutation with Callbacks

```tsx
const mutation = useMutation({
  mutationFn: createProduct,

  onMutate: async (newProduct) => {
    // Before mutation starts
    console.log('Creating product:', newProduct);
  },

  onSuccess: (data, variables, context) => {
    // After successful mutation
    console.log('Product created:', data);
  },

  onError: (error, variables, context) => {
    // After failed mutation
    console.error('Error creating product:', error);
  },

  onSettled: (data, error, variables, context) => {
    // After mutation completes (success or error)
    console.log('Mutation completed');
  },
});
```

### Mutation with Async/Await

```tsx
const mutation = useMutation({
  mutationFn: createProduct,
});

const handleSubmit = async (data: ProductData) => {
  try {
    const product = await mutation.mutateAsync(data);
    console.log('Product created:', product);
    navigate({ to: '/products/$id', params: { id: product.id } });
  } catch (error) {
    console.error('Failed to create product:', error);
  }
};
```

---

## ♻️ Query Invalidation

### Basic Invalidation

```tsx
import { useQueryClient } from '@tanstack/react-query';

function DeleteProductButton({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      // Invalidate products list
      queryClient.invalidateQueries({
        queryKey: ['products'],
      });
    },
  });

  return (
    <button onClick={() => mutation.mutate()}>
      Delete
    </button>
  );
}
```

### Invalidation Patterns

```tsx
// Invalidate all products queries
queryClient.invalidateQueries({
  queryKey: ['products'],
});

// Invalidate specific product
queryClient.invalidateQueries({
  queryKey: ['products', id],
});

// Invalidate all product reviews
queryClient.invalidateQueries({
  queryKey: ['products', id, 'reviews'],
});

// Invalidate with predicate
queryClient.invalidateQueries({
  predicate: (query) =>
    query.queryKey[0] === 'products' &&
    query.queryKey[1] === id,
});
```

### Refetch After Invalidation

```tsx
// Invalidate and refetch immediately
await queryClient.invalidateQueries({
  queryKey: ['products'],
  refetchType: 'active', // Only refetch active queries
});

// Invalidate without refetching
queryClient.invalidateQueries({
  queryKey: ['products'],
  refetchType: 'none', // Don't refetch
});
```

---

## ⚡ Optimistic Updates

### Simple Optimistic Update

```tsx
const mutation = useMutation({
  mutationFn: updateProduct,

  onMutate: async (updatedProduct) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({
      queryKey: ['products', updatedProduct.id],
    });

    // Snapshot previous value
    const previousProduct = queryClient.getQueryData([
      'products',
      updatedProduct.id,
    ]);

    // Optimistically update
    queryClient.setQueryData(
      ['products', updatedProduct.id],
      updatedProduct
    );

    // Return context with previous value
    return { previousProduct };
  },

  onError: (err, updatedProduct, context) => {
    // Rollback on error
    if (context?.previousProduct) {
      queryClient.setQueryData(
        ['products', updatedProduct.id],
        context.previousProduct
      );
    }
  },

  onSettled: (data, error, variables) => {
    // Always refetch after error or success
    queryClient.invalidateQueries({
      queryKey: ['products', variables.id],
    });
  },
});
```

### Optimistic List Update

```tsx
const mutation = useMutation({
  mutationFn: createProduct,

  onMutate: async (newProduct) => {
    // Cancel queries
    await queryClient.cancelQueries({
      queryKey: ['products'],
    });

    // Snapshot
    const previousProducts = queryClient.getQueryData(['products']);

    // Optimistically add to list
    queryClient.setQueryData(['products'], (old: Product[]) => {
      return [
        ...old,
        { ...newProduct, id: 'temp-id' }, // Temporary ID
      ];
    });

    return { previousProducts };
  },

  onError: (err, newProduct, context) => {
    // Rollback
    if (context?.previousProducts) {
      queryClient.setQueryData(['products'], context.previousProducts);
    }
  },

  onSettled: () => {
    // Refetch
    queryClient.invalidateQueries({ queryKey: ['products'] });
  },
});
```

---

## 🎯 Advanced Patterns

### Pagination

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

function PaginatedProducts() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page }],
    queryFn: () => getProducts({ page, limit: 20 }),
    placeholderData: (previousData) => previousData, // Keep old data while fetching
  });

  return (
    <div>
      {isLoading && <div>Loading...</div>}

      {data && (
        <>
          <ProductsList products={data.products} />

          <div>
            <button
              onClick={() => setPage((old) => Math.max(old - 1, 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              onClick={() => setPage((old) => old + 1)}
              disabled={!data.hasMore}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

### Infinite Queries

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

function InfiniteProductsList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['products', 'infinite'],
    queryFn: ({ pageParam = 1 }) =>
      getProducts({ page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.hasMore) {
        return pages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading more...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### Prefetching

```tsx
import { useQueryClient } from '@tanstack/react-query';

function ProductsList() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  // Prefetch on hover
  const handleHover = (id: string) => {
    queryClient.prefetchQuery({
      queryKey: ['products', id],
      queryFn: () => getProduct(id),
      staleTime: 60000, // 1 minute
    });
  };

  return (
    <ul>
      {data.map((product) => (
        <li
          key={product.id}
          onMouseEnter={() => handleHover(product.id)}
        >
          <Link to={`/products/${product.id}`}>
            {product.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

### Initial Data

```tsx
// Use loader data as initial data
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/products/$id')({
  loader: async ({ params }) => {
    return { product: await getProduct(params.id) };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const loaderData = Route.useLoaderData();

  const { data: product } = useQuery({
    queryKey: ['products', id],
    queryFn: () => getProduct(id),
    initialData: loaderData.product, // Use loader data
    staleTime: 0, // Immediately check for updates
  });

  return <div>{product.name}</div>;
}
```

---

## 🛡️ Error Handling

### Query Error Boundaries

```tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div>
              <h2>Something went wrong</h2>
              <p>{error.message}</p>
              <button onClick={resetErrorBoundary}>Try again</button>
            </div>
          )}
        >
          <ProductsList />
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

### Retry Logic

```tsx
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: getProducts,

  // Retry 3 times
  retry: 3,

  // Exponential backoff
  retryDelay: (attemptIndex) =>
    Math.min(1000 * 2 ** attemptIndex, 30000),

  // Conditional retry
  retry: (failureCount, error) => {
    // Don't retry on 404
    if (error.status === 404) return false;
    // Retry other errors up to 3 times
    return failureCount < 3;
  },
});
```

### Error Display

```tsx
function ProductsList() {
  const { data, error, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  if (isError) {
    return (
      <div className="error-container">
        <h3>Failed to load products</h3>
        <p>{error.message}</p>
        <button onClick={() => refetch()}>
          Try Again
        </button>
      </div>
    );
  }

  return <ProductsTable data={data} />;
}
```

---

## ⚙️ Configuration

### Global Defaults

```tsx
// lib/query.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### Query Client Provider

```tsx
// routes/__root.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## 💡 Best Practices

### Do's

**✅ Use consistent query keys**

```tsx
// ✅ Good - hierarchical and consistent
['products'] // All products
['products', id] // Single product
['products', id, 'reviews'] // Product reviews
```

**✅ Invalidate after mutations**

```tsx
// ✅ Good - keep data in sync
const mutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  },
});
```

**✅ Handle loading and error states**

```tsx
// ✅ Good - user feedback
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
```

**✅ Use appropriate staleTime**

```tsx
// ✅ Good - reduce unnecessary refetches
useQuery({
  queryKey: ['products'],
  queryFn: getProducts,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Don'ts

**❌ Don't use inconsistent query keys**

```tsx
// ❌ Bad - inconsistent structure
['products', 'list']
['product', id] // Should be 'products'
```

**❌ Don't forget to handle errors**

```tsx
// ❌ Bad - no error handling
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: getProducts,
});

// What if it fails?
return <div>{data.map(...)}</div>;
```

**❌ Don't mutate query data directly**

```tsx
// ❌ Bad - doesn't trigger re-render
const data = queryClient.getQueryData(['products']);
data.push(newProduct);

// ✅ Good - use setQueryData
queryClient.setQueryData(['products'], (old) => [...old, newProduct]);
```

---

## 🐛 Troubleshooting

### Issue: "Query not refetching"

**Solution:** Check staleTime setting:

```tsx
// ❌ Data is never stale
useQuery({
  queryKey: ['products'],
  queryFn: getProducts,
  staleTime: Infinity,
});

// ✅ Data becomes stale after 5 minutes
useQuery({
  queryKey: ['products'],
  queryFn: getProducts,
  staleTime: 5 * 60 * 1000,
});
```

### Issue: "Query refetching too often"

**Solution:** Increase staleTime:

```tsx
// ✅ Only refetch after data is stale
useQuery({
  queryKey: ['products'],
  queryFn: getProducts,
  staleTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: false, // Don't refetch on focus
});
```

### Issue: "Mutation not updating UI"

**Solution:** Invalidate queries after mutation:

```tsx
const mutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] }); // ← Don't forget
  },
});
```

### Issue: "Type errors with query data"

**Solution:** Add proper type annotations:

```tsx
// ✅ Correct - typed query
const { data } = useQuery<Product[]>({
  queryKey: ['products'],
  queryFn: getProducts,
});

// data is now Product[] | undefined
```

---

## 📖 Additional Resources

### Official Documentation

- **[TanStack Query Docs](https://tanstack.com/query)** - Complete documentation
- **[Query Guide](https://tanstack.com/query/latest/docs/framework/react/guides/queries)** - Query patterns
- **[Mutation Guide](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)** - Mutation patterns
- **[Caching Guide](https://tanstack.com/query/latest/docs/framework/react/guides/caching)** - Caching strategies

### Internal Resources

- **[Creating Pages Tutorial](./creating-pages.md)** - Full page creation guide
- **[Forms Guide](./forms.md)** - Form integration with mutations
- **[Tables Guide](./tables.md)** - Table integration with queries
- **[Architecture Overview](../architecture.md)** - Admin architecture

### Examples

See working examples in:

- `apps/admin/src/features/*/queries.ts` - Query/mutation functions
- `apps/admin/src/routes/*/index.tsx` - List pages with queries
- `apps/admin/src/routes/*/new.tsx` - Create pages with mutations
- `apps/admin/src/routes/*/$id.edit.tsx` - Edit pages with mutations

---

⬅️ Back to [Development Documentation](./README.md)
