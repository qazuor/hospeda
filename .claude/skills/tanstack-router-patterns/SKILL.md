---
name: tanstack-router-patterns
description: TanStack Router patterns for type-safe routing. Use when defining routes, data loaders, search parameters, or authenticated routes.
---

# TanStack Router Patterns

## Purpose

Provide patterns for type-safe routing with TanStack Router, including route tree definition, file-based routing, data loaders, search parameters, route context, authenticated routes, and integration with TanStack Query.

## Route Tree Definition

### Code-Based Routes

```typescript
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

// Root route
const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

// Index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

// Dynamic route
const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users/$userId",
  component: UserPage,
  loader: ({ params }) => fetchUser(params.userId),
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  userRoute,
]);

// Router instance
export const router = createRouter({ routeTree });

// Type registration
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

### File-Based Routes

```typescript
// routes/__root.tsx
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
  queryClient: QueryClient;
  auth: AuthState;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div>
      <Navigation />
      <main>
        <Outlet />
      </main>
    </div>
  ),
});

// routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// routes/users/$userId.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/users/$userId")({
  component: UserPage,
  loader: ({ params }) => fetchUser(params.userId),
});
```

## Data Loaders

### Basic Loader

```typescript
export const Route = createFileRoute("/posts")({
  loader: async () => {
    const posts = await fetchPosts();
    return { posts };
  },
  component: PostsPage,
});

function PostsPage() {
  const { posts } = Route.useLoaderData();
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### Loader with TanStack Query

```typescript
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

const postsQueryOptions = queryOptions({
  queryKey: ["posts"],
  queryFn: fetchPosts,
});

export const Route = createFileRoute("/posts")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(postsQueryOptions),
  component: PostsPage,
});

function PostsPage() {
  const { data: posts } = useSuspenseQuery(postsQueryOptions);
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### Loader with Parameters

```typescript
const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
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

## Search Parameters

### Validated Search Params

```typescript
import { z } from "zod";

const postsSearchSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(10).max(100).default(20),
  sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
  tag: z.string().optional(),
});

export const Route = createFileRoute("/posts")({
  validateSearch: postsSearchSchema,
  component: PostsPage,
});

function PostsPage() {
  const { page, pageSize, sort, tag } = Route.useSearch();
  const navigate = Route.useNavigate();

  const handlePageChange = (newPage: number) => {
    navigate({ search: (prev) => ({ ...prev, page: newPage }) });
  };

  const handleSortChange = (newSort: string) => {
    navigate({ search: (prev) => ({ ...prev, sort: newSort, page: 1 }) });
  };

  return (
    <div>
      <SortSelector value={sort} onChange={handleSortChange} />
      <PostList page={page} pageSize={pageSize} sort={sort} tag={tag} />
      <Pagination page={page} onChange={handlePageChange} />
    </div>
  );
}
```

### Type-Safe Links

```typescript
import { Link } from "@tanstack/react-router";

// All params and search are type-checked
<Link
  to="/users/$userId"
  params={{ userId: "123" }}
  search={{ tab: "posts" }}
>
  View User
</Link>

// Relative navigation
<Link to="." search={(prev) => ({ ...prev, page: 2 })}>
  Next Page
</Link>
```

## Route Context

```typescript
// Provide context at the root
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: undefined!,
  },
});

// Use in App
function App() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

// Access in any route
export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardPage,
});
```

## Authenticated Routes

```typescript
export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(dashboardQueryOptions),
  component: DashboardPage,
});
```

## Pending and Error States

```typescript
export const Route = createFileRoute("/posts")({
  loader: fetchPosts,
  pendingComponent: () => <div>Loading posts...</div>,
  errorComponent: ({ error }) => (
    <div>
      <h2>Error loading posts</h2>
      <pre>{error.message}</pre>
    </div>
  ),
  component: PostsPage,
});
```

## Best Practices

- Use file-based routing for automatic route tree generation and better organization
- Register the router type globally for end-to-end type safety on `Link` and `navigate`
- Use `createRootRouteWithContext` to share dependencies (queryClient, auth) across routes
- Integrate with TanStack Query using `ensureQueryData` in loaders for cache-aware fetching
- Validate search parameters with Zod schemas for type-safe URL state
- Use `beforeLoad` for authentication guards that redirect before data loading
- Use `pendingComponent` and `errorComponent` per-route for granular loading/error UI
- Navigate with the `search` function form `(prev) => ({ ...prev, key: value })` to preserve existing params
- Use `queryOptions()` factory functions for reusable, type-safe query configurations
- Prefer `useSuspenseQuery` in route components when loaders guarantee data availability
