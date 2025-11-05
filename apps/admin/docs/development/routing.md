# Routing Guide

Complete guide to file-based routing with TanStack Router in the Hospeda Admin Dashboard.

---

## 📖 Overview

TanStack Router provides **type-safe, file-based routing** with powerful features for building admin applications. This guide covers everything you need to know about routing in the admin dashboard.

**What you'll learn:**

- File-based routing fundamentals
- Dynamic routes with parameters
- Nested routes and layouts
- Route loaders for SSR
- Search params validation
- Navigation and redirects
- Protected routes
- Type safety throughout

**Prerequisites:**

- Understanding of React components
- Basic TypeScript knowledge
- Read [Architecture Overview](../architecture.md) first

---

## 🗂️ File-Based Routing

### How It Works

TanStack Router uses **file structure to define routes**. Files in `apps/admin/src/routes/` automatically become routes in your application.

**Basic pattern:**

```text
src/routes/
├── index.tsx              → /
├── about.tsx              → /about
├── users/
│   ├── index.tsx          → /users
│   ├── $id.tsx            → /users/:id
│   └── new.tsx            → /users/new
└── settings/
    ├── index.tsx          → /settings
    └── profile.tsx        → /settings/profile
```

### Route File Structure

Every route file exports a **Route** object created with `createFileRoute`:

```tsx
// src/routes/users/index.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/users/')({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div>
      <h1>Users</h1>
      {/* Component content */}
    </div>
  );
}
```

**Key parts:**

- `createFileRoute()` - Creates the route definition
- First argument - Route path (must match file location)
- `component` - React component to render
- Component can be inline or imported

### Naming Conventions

**Special file names:**

- `index.tsx` - Base route for that path
- `$param.tsx` - Dynamic parameter route
- `_layout.tsx` - Layout wrapper (doesn't add to URL)
- `__root.tsx` - Root layout for entire app

**Examples:**

```text
users/index.tsx         → /users
users/$id.tsx           → /users/123
users/$id/edit.tsx      → /users/123/edit
users/_layout.tsx       → Wraps all /users routes
__root.tsx              → Wraps entire app
```

---

## 🎯 Dynamic Routes

### Basic Dynamic Routes

Use `$` prefix for dynamic segments:

```tsx
// src/routes/users/$userId.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/users/$userId')({
  component: UserDetail,
});

function UserDetail() {
  const { userId } = Route.useParams();

  return (
    <div>
      <h1>User: {userId}</h1>
    </div>
  );
}
```

**Type safety:**

The `useParams()` hook returns **typed** parameters based on your route definition.

### Multiple Parameters

Routes can have multiple dynamic segments:

```tsx
// src/routes/accommodations/$accommodationId/reviews/$reviewId.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/accommodations/$accommodationId/reviews/$reviewId'
)({
  component: ReviewDetail,
});

function ReviewDetail() {
  const { accommodationId, reviewId } = Route.useParams();

  return (
    <div>
      <h2>Accommodation: {accommodationId}</h2>
      <h3>Review: {reviewId}</h3>
    </div>
  );
}
```

### Catch-All Routes

Use `$` alone for catch-all segments:

```tsx
// src/routes/docs/$.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/docs/$')({
  component: DocsPage,
});

function DocsPage() {
  const { _splat } = Route.useParams();

  // _splat contains everything after /docs/
  // e.g., /docs/guide/routing → _splat = "guide/routing"

  return <div>Docs: {_splat}</div>;
}
```

---

## 📦 Route Loaders

### What Are Loaders?

**Loaders** fetch data on the server before rendering. This enables:

- Server-side rendering (SSR)
- Fast initial page loads
- SEO-friendly content
- Type-safe data access

### Basic Loader

```tsx
// src/routes/users/$userId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { getUser } from '@/features/users/queries';

export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params }) => {
    const user = await getUser(params.userId);
    return { user };
  },
  component: UserDetail,
});

function UserDetail() {
  const { user } = Route.useLoaderData();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

**Type safety:**

`Route.useLoaderData()` returns **typed** data based on your loader return value.

### Loader Context

Loaders receive a context object with useful properties:

```tsx
export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params, context, signal }) => {
    // params - Route parameters
    // context - App context (auth, queryClient, etc.)
    // signal - AbortSignal for cancellation

    const user = await getUser(params.userId, { signal });
    return { user };
  },
  component: UserDetail,
});
```

**Abort signal:**

Use the `signal` to cancel requests when navigating away:

```tsx
loader: async ({ params, signal }) => {
  const response = await fetch(`/api/users/${params.userId}`, {
    signal, // Pass to fetch
  });

  return await response.json();
}
```

### Loader Dependencies

Loaders can depend on search params or other dynamic values:

```tsx
import { z } from 'zod';

const searchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
});

export const Route = createFileRoute('/users/')({
  validateSearch: searchSchema,

  loader: async ({ search }) => {
    // search is typed based on searchSchema
    const users = await getUsers({
      page: search.page,
      limit: search.limit,
    });

    return { users };
  },

  component: UsersList,
});
```

---

## 🔍 Search Params

### Validating Search Params

Use Zod schemas to validate query strings:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  role: z.enum(['admin', 'manager', 'editor', 'viewer']).optional(),
  page: z.number().int().positive().optional().default(1),
});

export const Route = createFileRoute('/users/')({
  validateSearch: searchSchema,
  component: UsersList,
});

function UsersList() {
  const search = Route.useSearch();

  // search is typed as: { status?, role?, page }

  return (
    <div>
      <h1>Users</h1>
      <p>Status: {search.status || 'all'}</p>
      <p>Page: {search.page}</p>
    </div>
  );
}
```

**URL examples:**

```text
/users                          → { page: 1 } (defaults applied)
/users?status=active            → { status: 'active', page: 1 }
/users?status=active&page=2     → { status: 'active', page: 2 }
/users?status=invalid           → Validation error!
```

### Updating Search Params

Use the `navigate` function to update query strings:

```tsx
import { useNavigate } from '@tanstack/react-router';

function UserFilters() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const updateStatus = (status: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        status,
      }),
    });
  };

  return (
    <div>
      <button onClick={() => updateStatus('active')}>
        Active Users
      </button>
      <button onClick={() => updateStatus('suspended')}>
        Suspended Users
      </button>
    </div>
  );
}
```

### Search Param Defaults

Provide defaults in the Zod schema:

```tsx
const searchSchema = z.object({
  page: z.number().default(1),
  limit: z.number().default(20),
  sort: z.enum(['name', 'email', 'createdAt']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

// Now /users will have these defaults even without query string
```

---

## 🗂️ Nested Routes & Layouts

### Layout Routes

Create layouts that wrap multiple child routes:

```tsx
// src/routes/_authenticated.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="authenticated-layout">
      <Header />
      <Sidebar />
      <main>
        <Outlet /> {/* Child routes render here */}
      </main>
      <Footer />
    </div>
  );
}
```

**Child routes:**

```text
src/routes/
├── _authenticated.tsx              # Layout
├── _authenticated/
│   ├── dashboard.tsx               # /dashboard
│   ├── users.tsx                   # /users
│   └── settings.tsx                # /settings
```

All routes under `_authenticated/` will use the `AuthenticatedLayout`.

### Nested Layouts

Layouts can be nested:

```tsx
// src/routes/_authenticated/_admin.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/_admin')({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="admin-section">
      <AdminSidebar />
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
```

**Structure:**

```text
src/routes/
├── _authenticated.tsx                    # Outer layout
├── _authenticated/
│   ├── _admin.tsx                        # Inner layout
│   └── _admin/
│       ├── users.tsx                     # /users (both layouts)
│       └── settings.tsx                  # /settings (both layouts)
```

### Pathless Layouts

Layouts with `_` prefix don't add to the URL:

```text
_authenticated/dashboard.tsx    → /dashboard (not /_authenticated/dashboard)
_admin/users.tsx                → /users (not /_admin/users)
```

---

## 🧭 Navigation

### Link Component

Use the `Link` component for type-safe navigation:

```tsx
import { Link } from '@tanstack/react-router';

function UsersList({ users }) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          <Link
            to="/users/$userId"
            params={{ userId: user.id }}
          >
            {user.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

**Type safety:**

If you provide invalid params or paths, TypeScript will error.

### Link with Search Params

Include query strings in links:

```tsx
<Link
  to="/users"
  search={{
    status: 'active',
    page: 1,
  }}
>
  View Active Users
</Link>
```

### Programmatic Navigation

Use the `useNavigate` hook:

```tsx
import { useNavigate } from '@tanstack/react-router';

function CreateUserForm() {
  const navigate = useNavigate();

  const handleSubmit = async (data) => {
    const user = await createUser(data);

    // Navigate to user detail page
    navigate({
      to: '/users/$userId',
      params: { userId: user.id },
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Navigation Options

```tsx
// Replace history (back button won't return)
navigate({ to: '/users', replace: true });

// Update only search params
navigate({ search: { page: 2 } });

// Navigate with state
navigate({
  to: '/users/$userId',
  params: { userId: '123' },
  state: { from: 'dashboard' },
});
```

---

## 🔒 Protected Routes

### beforeLoad Hook

Use `beforeLoad` to protect routes:

```tsx
// src/routes/_authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    const { auth } = context;

    if (!auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: window.location.pathname,
        },
      });
    }
  },
  component: AuthenticatedLayout,
});
```

**How it works:**

- `beforeLoad` runs before loader and component
- Can access context (auth, etc.)
- Can throw redirect to another route
- Runs on server and client

### Role-Based Protection

Check user roles in `beforeLoad`:

```tsx
export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: async ({ context }) => {
    const { auth } = context;

    if (!auth.isAuthenticated) {
      throw redirect({ to: '/login' });
    }

    if (auth.user.role !== 'admin') {
      throw redirect({
        to: '/dashboard',
        search: {
          error: 'Insufficient permissions',
        },
      });
    }
  },
  component: AdminLayout,
});
```

### Passing Data from beforeLoad

Return data from `beforeLoad` to use in loaders:

```tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    const { auth } = context;

    if (!auth.isAuthenticated) {
      throw redirect({ to: '/login' });
    }

    // Return user to be used in loaders
    return {
      user: auth.user,
    };
  },

  loader: async ({ context }) => {
    // Access user from beforeLoad
    const { user } = context;

    const dashboard = await getDashboard(user.id);
    return { dashboard };
  },

  component: Dashboard,
});
```

---

## 🎨 Advanced Patterns

### Pending Component

Show loading state during navigation:

```tsx
export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params }) => {
    const user = await getUser(params.userId);
    return { user };
  },

  pendingComponent: () => (
    <div className="loading">
      <Spinner />
      <p>Loading user...</p>
    </div>
  ),

  component: UserDetail,
});
```

### Error Component

Handle loader errors:

```tsx
export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params }) => {
    const user = await getUser(params.userId);

    if (!user) {
      throw new Error('User not found');
    }

    return { user };
  },

  errorComponent: ({ error }) => (
    <div className="error">
      <h2>Error</h2>
      <p>{error.message}</p>
      <Link to="/users">Back to Users</Link>
    </div>
  ),

  component: UserDetail,
});
```

### Not Found Component

Handle 404s for dynamic routes:

```tsx
export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params }) => {
    const user = await getUser(params.userId);

    if (!user) {
      throw notFound();
    }

    return { user };
  },

  notFoundComponent: () => (
    <div>
      <h2>User Not Found</h2>
      <p>The user you're looking for doesn't exist.</p>
      <Link to="/users">View All Users</Link>
    </div>
  ),

  component: UserDetail,
});
```

### Preloading

Preload routes on hover for instant navigation:

```tsx
import { Link } from '@tanstack/react-router';

function UsersList({ users }) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          <Link
            to="/users/$userId"
            params={{ userId: user.id }}
            preload="intent" // Preload on hover
          >
            {user.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

**Preload options:**

- `false` - No preloading (default)
- `"intent"` - Preload on hover/focus
- `"render"` - Preload immediately when link renders
- `"viewport"` - Preload when link enters viewport

---

## 💡 Best Practices

### Route Organization

**✅ DO:**

- Keep route files focused on routing concerns only
- Move business logic to `features/` folder
- Use loaders for data fetching
- Colocate related routes in folders

**❌ DON'T:**

- Put business logic directly in route files
- Fetch data in components (use loaders)
- Create deeply nested route structures
- Duplicate code across route files

**Good structure:**

```text
src/
├── routes/
│   ├── users/
│   │   ├── index.tsx          # Just routing + layout
│   │   ├── $userId.tsx        # Just routing + layout
│   │   └── new.tsx            # Just routing + layout
│   └── ...
├── features/
│   └── users/
│       ├── components/        # User UI components
│       ├── hooks/             # User-related hooks
│       ├── queries.ts         # Data fetching functions
│       └── types.ts           # User types
```

### Loader Best Practices

**✅ DO:**

```tsx
// Use abort signal
loader: async ({ params, signal }) => {
  const user = await getUser(params.userId, { signal });
  return { user };
}

// Handle errors
loader: async ({ params }) => {
  const user = await getUser(params.userId);

  if (!user) {
    throw notFound();
  }

  return { user };
}

// Keep loaders focused
loader: async ({ params }) => {
  // Just fetch and return
  return {
    user: await getUser(params.userId),
  };
}
```

**❌ DON'T:**

```tsx
// Don't ignore abort signal
loader: async ({ params }) => {
  const user = await getUser(params.userId);
  return { user };
}

// Don't ignore errors
loader: async ({ params }) => {
  const user = await getUser(params.userId);
  // What if user is null?
  return { user };
}

// Don't put business logic in loader
loader: async ({ params }) => {
  const user = await getUser(params.userId);

  // ❌ Business logic here
  user.fullName = `${user.firstName} ${user.lastName}`;
  user.isActive = user.status === 'active';

  return { user };
}
```

### Navigation Best Practices

**✅ DO:**

```tsx
// Use Link for navigation
<Link to="/users/$userId" params={{ userId: user.id }}>
  {user.name}
</Link>

// Use type-safe params
navigate({
  to: '/users/$userId',
  params: { userId: user.id },
});

// Preserve search params when needed
<Link
  to="/users/$userId"
  params={{ userId: user.id }}
  search={(prev) => prev} // Preserve current search
>
  View User
</Link>
```

**❌ DON'T:**

```tsx
// Don't use string URLs
<a href={`/users/${user.id}`}>  // ❌ Not type-safe

// Don't concatenate URLs
navigate({ to: `/users/${userId}` });  // ❌ Not type-safe

// Don't lose search params
<Link to="/users/$userId" params={{ userId: user.id }}>
  // Search params will be lost!
</Link>
```

### Type Safety Tips

**✅ Leverage TypeScript:**

```tsx
// Params are typed automatically
function UserDetail() {
  const { userId } = Route.useParams();
  // userId is string (typed from route definition)
}

// Search params are typed from Zod schema
function UsersList() {
  const search = Route.useSearch();
  // search: { status?: 'active' | 'suspended', page: number }
}

// Loader data is typed automatically
function UserDetail() {
  const { user } = Route.useLoaderData();
  // user is typed from loader return value
}
```

---

## 🐛 Common Issues

### Issue: "Route not found"

**Symptom:** Route exists but shows 404

**Common causes:**

1. File path doesn't match route definition
2. Missing `index.tsx` for base routes
3. Typo in route path string

**Solution:**

```tsx
// ❌ File: src/routes/users/$userId.tsx
export const Route = createFileRoute('/users/$id')({
  // Path doesn't match filename!

// ✅ File: src/routes/users/$userId.tsx
export const Route = createFileRoute('/users/$userId')({
  // Path matches filename
```

### Issue: "useParams returns undefined"

**Symptom:** Params are undefined in component

**Cause:** Using React Router hooks instead of TanStack Router hooks

**Solution:**

```tsx
// ❌ Wrong import
import { useParams } from 'react-router-dom';

// ✅ Correct import
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/users/$userId')({
  component: UserDetail,
});

function UserDetail() {
  const { userId } = Route.useParams(); // ✅ Use Route.useParams()
}
```

### Issue: "Loader not running"

**Symptom:** Loader function never executes

**Common causes:**

1. Not exported from route file
2. Syntax error in loader
3. Missing async/await

**Solution:**

```tsx
// ❌ Not exported
const Route = createFileRoute('/users/$userId')({
  loader: async ({ params }) => { ... }
});

// ✅ Exported
export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params }) => { ... }
});

// ❌ Missing async
loader: ({ params }) => {
  return getUser(params.userId); // Promise not awaited!
}

// ✅ Async/await
loader: async ({ params }) => {
  return await getUser(params.userId);
}
```

### Issue: "Type errors with search params"

**Symptom:** TypeScript errors when accessing search params

**Cause:** No validation schema defined

**Solution:**

```tsx
import { z } from 'zod';

// ✅ Define schema
const searchSchema = z.object({
  page: z.number().default(1),
  status: z.string().optional(),
});

export const Route = createFileRoute('/users/')({
  validateSearch: searchSchema, // Add this!
  component: UsersList,
});
```

---

## 📖 Additional Resources

### Official Documentation

- **[TanStack Router Docs](https://tanstack.com/router)** - Complete framework documentation
- **[TanStack Router Guide](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing)** - File-based routing guide
- **[Route Loaders](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading)** - Data loading guide

### Internal Resources

- **[Architecture Overview](../architecture.md)** - Admin app architecture
- **[Creating Pages Tutorial](./creating-pages.md)** - Step-by-step page creation
- **[Authentication Guide](./authentication.md)** - Route protection patterns
- **[Data Fetching Guide](./queries.md)** - TanStack Query integration

### Examples

See working examples in:

- `apps/admin/src/routes/accommodations/` - Full CRUD routes
- `apps/admin/src/routes/users/` - User management routes
- `apps/admin/src/routes/_authenticated/` - Protected route layout

---

⬅️ Back to [Development Documentation](./README.md)
