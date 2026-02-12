---
name: tanstack-query-patterns
description: TanStack Query patterns for data fetching and server state. Use when implementing queries, mutations, cache invalidation, or optimistic updates.
---

# TanStack Query Patterns

## Purpose

Provide patterns for data fetching and server state management with TanStack Query, including queries, mutations, cache invalidation, optimistic updates, prefetching, infinite queries, and integration with React and TanStack Router.

## Setup

```typescript
// lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

// app.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Query Options Factory

```typescript
import { queryOptions } from "@tanstack/react-query";

// Reusable query options
export const usersQueryOptions = queryOptions({
  queryKey: ["users"],
  queryFn: fetchAllUsers,
});

export const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
    enabled: !!userId,
  });

export const userPostsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["users", userId, "posts"],
    queryFn: () => fetchUserPosts(userId),
    enabled: !!userId,
  });
```

## Basic Queries

```typescript
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

// Standard query with loading and error states
function UserList() {
  const { data: users, isLoading, error } = useQuery(usersQueryOptions);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// Suspense query (use with Suspense boundary or route loader)
function UserProfile({ userId }: { userId: string }) {
  const { data: user } = useSuspenseQuery(userQueryOptions(userId));
  return <h1>{user.name}</h1>;
}
```

## Dependent Queries

```typescript
function UserPosts({ userId }: { userId: string }) {
  const { data: user } = useQuery(userQueryOptions(userId));

  const { data: posts } = useQuery({
    queryKey: ["users", userId, "posts"],
    queryFn: () => fetchUserPosts(userId),
    enabled: !!user, // Only fetch when user is available
  });

  return (
    <div>
      <h1>{user?.name}</h1>
      <ul>
        {posts?.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Mutations

### Basic Mutation

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";

function CreateUserForm() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateUserInput) =>
      fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => res.json()),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },

    onError: (error) => {
      console.error("Failed to create user:", error);
    },
  });

  const handleSubmit = (data: CreateUserInput) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleFormSubmit(handleSubmit)}>
      {/* ... form fields */}
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating..." : "Create User"}
      </button>
      {mutation.isError && <span>Error: {mutation.error.message}</span>}
    </form>
  );
}
```

## Cache Invalidation

```typescript
const queryClient = useQueryClient();

// Invalidate all user queries
queryClient.invalidateQueries({ queryKey: ["users"] });

// Invalidate specific user
queryClient.invalidateQueries({ queryKey: ["users", userId] });

// Invalidate exact match only
queryClient.invalidateQueries({ queryKey: ["users"], exact: true });

// Remove from cache entirely
queryClient.removeQueries({ queryKey: ["users", deletedUserId] });

// Set cache data directly
queryClient.setQueryData(["users", userId], updatedUser);
```

## Optimistic Updates

```typescript
const updateUserMutation = useMutation({
  mutationFn: (data: { userId: string; updates: Partial<User> }) =>
    updateUser(data.userId, data.updates),

  onMutate: async ({ userId, updates }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ["users", userId] });

    // Snapshot previous value
    const previousUser = queryClient.getQueryData<User>(["users", userId]);

    // Optimistically update
    queryClient.setQueryData<User>(["users", userId], (old) =>
      old ? { ...old, ...updates } : old
    );

    return { previousUser };
  },

  onError: (_err, { userId }, context) => {
    // Rollback on error
    if (context?.previousUser) {
      queryClient.setQueryData(["users", userId], context.previousUser);
    }
  },

  onSettled: (_data, _error, { userId }) => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ["users", userId] });
  },
});
```

## Prefetching

```typescript
// Prefetch on hover
function UserLink({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    queryClient.prefetchQuery(userQueryOptions(userId));
  };

  return (
    <Link
      to="/users/$userId"
      params={{ userId }}
      onMouseEnter={handleMouseEnter}
    >
      View User
    </Link>
  );
}

// Prefetch in route loader (TanStack Router)
export const Route = createFileRoute("/users/$userId")({
  loader: ({ context: { queryClient }, params: { userId } }) =>
    queryClient.ensureQueryData(userQueryOptions(userId)),
  component: UserPage,
});
```

## Infinite Queries

```typescript
import { useInfiniteQuery } from "@tanstack/react-query";

function InfinitePostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts"],
    queryFn: ({ pageParam }) =>
      fetchPosts({ cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const allPosts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading more..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

## Parallel Queries

```typescript
import { useQueries } from "@tanstack/react-query";

function Dashboard({ userIds }: { userIds: string[] }) {
  const results = useQueries({
    queries: userIds.map((id) => ({
      queryKey: ["users", id],
      queryFn: () => fetchUser(id),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const users = results.map((r) => r.data).filter(Boolean);

  if (isLoading) return <Spinner />;

  return (
    <div>
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
```

## Best Practices

- Use `queryOptions()` factory functions for reusable, type-safe query configurations
- Structure query keys hierarchically: `["entity", id, "relation"]` for granular invalidation
- Set appropriate `staleTime` to reduce unnecessary refetches (default is 0)
- Use `gcTime` (garbage collection time) to control how long inactive data stays in cache
- Always invalidate related queries after mutations for cache consistency
- Use optimistic updates for immediate UI feedback on mutations
- Prefetch data on hover or in route loaders for perceived performance
- Use `useSuspenseQuery` with route loaders or Suspense boundaries for cleaner code
- Use `useInfiniteQuery` for paginated lists with "load more" or infinite scroll
- Use `enabled` to prevent queries from running until dependencies are available
