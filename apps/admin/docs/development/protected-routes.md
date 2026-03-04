# Protected Routes Guide

Complete guide to route protection patterns in the Hospeda Admin Dashboard.

---

## 📖 Overview

Route protection ensures that only authenticated and authorized users can access specific pages in your application. This guide covers all patterns for implementing route protection with TanStack Router and Better Auth.

**What you'll learn:**

- Using `beforeLoad` hook for route protection
- Authentication checks in loaders
- Authorization checks (role/permission-based)
- Redirect patterns for unauthorized access
- Nested route protection
- Layout-level protection
- Loading states during auth check
- Best practices and common patterns

**Prerequisites:**

- Read [Authentication Guide](./authentication.md)
- Read [Permissions Guide](./permissions.md)
- Read [Routing Guide](./routing.md)
- Understanding of TanStack Router

---

## 🎯 Quick Start

### Basic Protected Route

```tsx
// src/routes/_authed/dashboard.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth } from '@repo/auth-ui/server';

export const Route = createFileRoute('/_authed/dashboard')({
  beforeLoad: async () => {
    const { userId } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/auth/signin' });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  return <div>Protected dashboard content</div>;
}
```

### Role-Based Protection

```tsx
// src/routes/_authed/_admin/users.tsx
export const Route = createFileRoute('/_authed/_admin/users')({
  beforeLoad: async () => {
    const { userId, sessionClaims } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/auth/signin' });
    }

    if (sessionClaims?.role !== 'admin') {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: UsersPage,
});
```

---

## 🔐 beforeLoad Hook

### How It Works

The `beforeLoad` hook runs **before** the route loads:

- Executes on server and client
- Runs before loader function
- Can throw redirects
- Can return data for use in loader/component
- Type-safe with context

```tsx
export const Route = createFileRoute('/protected')({
  beforeLoad: async ({ context, params, search }) => {
    // context: App context (auth, etc.)
    // params: Route parameters
    // search: Search params

    // Check authentication
    const { userId } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/signin' });
    }

    // Can return data
    return {
      userId,
      timestamp: Date.now(),
    };
  },

  loader: async ({ context }) => {
    // Access data from beforeLoad
    const { userId } = context;
    return await fetchUserData(userId);
  },

  component: ProtectedPage,
});
```

### Basic Authentication Check

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth } from '@repo/auth-ui/server';
import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';

const fetchAuthState = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getWebRequest();
  const { userId } = await getAuth(request);

  return {
    userId,
    isAuthenticated: !!userId,
  };
});

export const Route = createFileRoute('/protected')({
  beforeLoad: async () => {
    const authState = await fetchAuthState();

    if (!authState.isAuthenticated) {
      throw redirect({
        to: '/auth/signin',
        search: {
          redirect: window.location.pathname,
        },
      });
    }

    return authState;
  },
  component: ProtectedPage,
});
```

### With Role Check

```tsx
const checkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getWebRequest();
  const { userId, sessionClaims } = await getAuth(request);

  return {
    userId,
    role: sessionClaims?.role as string,
    isAuthenticated: !!userId,
  };
});

export const Route = createFileRoute('/admin/users')({
  beforeLoad: async () => {
    const authState = await checkAuth();

    // Check authentication
    if (!authState.isAuthenticated) {
      throw redirect({ to: '/auth/signin' });
    }

    // Check role
    if (authState.role !== 'admin') {
      throw redirect({
        to: '/dashboard',
        search: {
          error: 'Insufficient permissions',
        },
      });
    }

    return authState;
  },
  component: AdminUsersPage,
});
```

---

## 🏗️ Layout-Level Protection

### Protected Layout Route

Protect all child routes with a layout:

```tsx
// src/routes/_authed.tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { getAuth } from '@repo/auth-ui/server';
import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';

const fetchAuthState = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getWebRequest();

  if (!request) {
    throw new Error('No request found');
  }

  const { userId } = await getAuth(request);

  return {
    userId,
    isAuthenticated: !!userId,
  };
});

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const authState = await fetchAuthState();

    if (!authState.isAuthenticated) {
      throw redirect({
        to: '/auth/signin',
        search: {
          redirect: typeof window !== 'undefined' ? window.location.pathname : '/',
        },
      });
    }

    return authState;
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
```

**All routes under `_authed/` are now protected:**

```text
src/routes/_authed/
├── dashboard.tsx          → Protected
├── profile.tsx            → Protected
├── settings.tsx           → Protected
└── accommodations/
    ├── index.tsx         → Protected
    └── new.tsx           → Protected
```

### Nested Protected Layouts

Multiple levels of protection:

```tsx
// src/routes/_authed/_admin.tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';

const checkAdminAccess = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getWebRequest();
  const { userId, sessionClaims } = await getAuth(request);

  return {
    userId,
    role: sessionClaims?.role as string,
    isAdmin: sessionClaims?.role === 'admin',
  };
});

export const Route = createFileRoute('/_authed/_admin')({
  beforeLoad: async () => {
    const authState = await checkAdminAccess();

    // Already checked authentication in _authed
    // Now check admin role
    if (!authState.isAdmin) {
      throw redirect({
        to: '/dashboard',
        search: {
          error: 'Admin access required',
        },
      });
    }

    return authState;
  },
  component: () => <Outlet />,
});
```

**Structure:**

```text
_authed/                  → Authentication required
└── _admin/               → + Admin role required
    ├── users/
    │   ├── index.tsx
    │   └── new.tsx
    └── settings.tsx
```

---

## 🔄 Redirect Patterns

### Basic Redirect

```tsx
export const Route = createFileRoute('/protected')({
  beforeLoad: async () => {
    const { userId } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/auth/signin' });
    }
  },
  component: ProtectedPage,
});
```

### Redirect with Query Params

Preserve original destination:

```tsx
beforeLoad: async () => {
  const { userId } = await getAuth();

  if (!userId) {
    throw redirect({
      to: '/auth/signin',
      search: {
        redirect: window.location.pathname,
      },
    });
  }
}
```

**Handle redirect in sign-in:**

```tsx
// src/routes/auth/signin.tsx
import { createFileRoute } from '@tanstack/react-router';
import { SignIn } from '@repo/auth-ui';
import { z } from 'zod';

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/auth/signin')({
  validateSearch: searchSchema,
  component: SignInPage,
});

function SignInPage() {
  const search = Route.useSearch();
  const redirectUrl = search.redirect || '/dashboard';

  return (
    <SignIn
      routing="path"
      path="/auth/signin"
      fallbackRedirectUrl={redirectUrl}
      forceRedirectUrl={redirectUrl}
    />
  );
}
```

### Redirect with Error Message

```tsx
beforeLoad: async () => {
  const { userId, sessionClaims } = await getAuth();

  if (!userId) {
    throw redirect({ to: '/auth/signin' });
  }

  if (sessionClaims?.role !== 'admin') {
    throw redirect({
      to: '/dashboard',
      search: {
        error: 'You do not have permission to access this page',
        returnTo: window.location.pathname,
      },
    });
  }
}
```

**Display error in dashboard:**

```tsx
// src/routes/_authed/dashboard.tsx
import { z } from 'zod';

const searchSchema = z.object({
  error: z.string().optional(),
  returnTo: z.string().optional(),
});

export const Route = createFileRoute('/_authed/dashboard')({
  validateSearch: searchSchema,
  component: DashboardPage,
});

function DashboardPage() {
  const search = Route.useSearch();

  return (
    <div>
      {search.error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-red-800">{search.error}</p>
          {search.returnTo && (
            <p className="mt-2 text-red-600 text-sm">
              Attempted to access: {search.returnTo}
            </p>
          )}
        </div>
      )}

      <DashboardContent />
    </div>
  );
}
```

---

## 🔑 Permission-Based Protection

### Check Multiple Permissions

```tsx
const checkPermissions = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getWebRequest();
  const { userId, sessionClaims } = await getAuth(request);

  const role = sessionClaims?.role as string;

  const permissions = {
    canViewUsers: ['admin', 'manager'].includes(role),
    canEditUsers: ['admin'].includes(role),
    canDeleteUsers: ['admin'].includes(role),
  };

  return {
    userId,
    role,
    permissions,
  };
});

export const Route = createFileRoute('/_authed/users/$id/edit')({
  beforeLoad: async () => {
    const authState = await checkPermissions();

    if (!authState.userId) {
      throw redirect({ to: '/auth/signin' });
    }

    if (!authState.permissions.canEditUsers) {
      throw redirect({
        to: '/users/$id',
        search: {
          error: 'You do not have permission to edit users',
        },
      });
    }

    return authState;
  },
  component: EditUserPage,
});
```

### Resource Ownership Check

Check if user owns the resource:

```tsx
const checkOwnership = createServerFn({ method: 'GET' })
  .validator((accommodationId: string) => accommodationId)
  .handler(async ({ data: accommodationId }) => {
    const request = getWebRequest();
    const { userId, sessionClaims } = await getAuth(request);

    if (!userId) {
      return { canEdit: false, reason: 'not_authenticated' };
    }

    const role = sessionClaims?.role as string;

    // Admins can edit anything
    if (role === 'admin') {
      return { canEdit: true, reason: 'admin' };
    }

    // Check ownership
    const accommodation = await db.query.accommodations.findFirst({
      where: (acc, { eq }) => eq(acc.id, accommodationId),
    });

    if (!accommodation) {
      return { canEdit: false, reason: 'not_found' };
    }

    const isOwner = accommodation.ownerId === userId;

    return {
      canEdit: isOwner || role === 'manager',
      reason: isOwner ? 'owner' : role === 'manager' ? 'manager' : 'no_permission',
      accommodation,
    };
  });

export const Route = createFileRoute('/_authed/accommodations/$id/edit')({
  beforeLoad: async ({ params }) => {
    const ownershipCheck = await checkOwnership(params.id);

    if (!ownershipCheck.canEdit) {
      const errorMessages = {
        not_authenticated: 'Please sign in to continue',
        not_found: 'Accommodation not found',
        no_permission: 'You do not have permission to edit this accommodation',
      };

      throw redirect({
        to: '/accommodations/$id',
        params: { id: params.id },
        search: {
          error: errorMessages[ownershipCheck.reason] || 'Access denied',
        },
      });
    }

    return ownershipCheck;
  },
  component: EditAccommodationPage,
});
```

---

## ⏳ Loading States

### Pending Component

Show loading state during auth check:

```tsx
export const Route = createFileRoute('/_authed/dashboard')({
  beforeLoad: async () => {
    const authState = await fetchAuthState();

    if (!authState.isAuthenticated) {
      throw redirect({ to: '/auth/signin' });
    }

    return authState;
  },

  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
        <p className="mt-4 text-gray-600">Checking authentication...</p>
      </div>
    </div>
  ),

  component: DashboardPage,
});
```

### Custom Loading Component

```tsx
// src/components/AuthLoadingScreen.tsx
export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-100">
      <div className="text-center">
        <div className="mb-4">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
        </div>
        <h2 className="font-semibold text-gray-900 text-xl">
          Verifying access...
        </h2>
        <p className="mt-2 text-gray-600">Please wait</p>
      </div>
    </div>
  );
}
```

**Usage:**

```tsx
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const authState = await fetchAuthState();
    if (!authState.isAuthenticated) {
      throw redirect({ to: '/auth/signin' });
    }
    return authState;
  },
  pendingComponent: AuthLoadingScreen,
  component: AuthedLayout,
});
```

---

## 🚫 Error Handling

### Error Component

Handle errors during auth check:

```tsx
export const Route = createFileRoute('/_authed/dashboard')({
  beforeLoad: async () => {
    const authState = await fetchAuthState();

    if (!authState.isAuthenticated) {
      throw redirect({ to: '/auth/signin' });
    }

    return authState;
  },

  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="font-bold text-2xl text-red-600">
          Authentication Error
        </h2>
        <p className="mt-2 text-gray-600">{error.message}</p>
        <Link
          to="/auth/signin"
          className="mt-4 inline-block rounded-md bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
        >
          Sign In
        </Link>
      </div>
    </div>
  ),

  component: DashboardPage,
});
```

### Try-Catch in beforeLoad

```tsx
export const Route = createFileRoute('/protected')({
  beforeLoad: async () => {
    try {
      const authState = await fetchAuthState();

      if (!authState.isAuthenticated) {
        throw redirect({ to: '/auth/signin' });
      }

      return authState;
    } catch (error) {
      // Log error
      console.error('Auth check failed:', error);

      // Redirect to error page
      throw redirect({
        to: '/error',
        search: {
          message: 'Authentication failed',
        },
      });
    }
  },
  component: ProtectedPage,
});
```

---

## 💡 Best Practices

### Always Use Server-Side Protection

**✅ DO:**

```tsx
// Protect on server with beforeLoad
export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: async () => {
    const { userId } = await getAuth();
    if (!userId) throw redirect({ to: '/signin' });
  },
  component: AdminPage,
});
```

**❌ DON'T:**

```tsx
// Client-side only (insecure!)
function AdminPage() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return <Navigate to="/signin" />;
  }

  return <div>Admin content</div>;
}
```

### Use Layout Protection for Route Groups

**✅ DO:**

```tsx
// Protect entire group with layout
_authed/
├── dashboard.tsx         → Auto-protected
├── profile.tsx           → Auto-protected
└── settings.tsx          → Auto-protected
```

**❌ DON'T:**

```tsx
// Duplicate protection in every route
dashboard.tsx → beforeLoad: check auth
profile.tsx → beforeLoad: check auth
settings.tsx → beforeLoad: check auth
```

### Preserve Original Destination

**✅ DO:**

```tsx
beforeLoad: async () => {
  if (!userId) {
    throw redirect({
      to: '/signin',
      search: {
        redirect: window.location.pathname, // Save current path
      },
    });
  }
}
```

### Show Clear Loading States

**✅ DO:**

```tsx
export const Route = createFileRoute('/_authed')({
  beforeLoad: checkAuth,
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner />
      <p>Checking authentication...</p>
    </div>
  ),
  component: Layout,
});
```

### Handle Errors Gracefully

**✅ DO:**

```tsx
export const Route = createFileRoute('/protected')({
  beforeLoad: checkAuth,
  errorComponent: ({ error, reset }) => (
    <div>
      <h2>Error</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try Again</button>
      <Link to="/signin">Sign In</Link>
    </div>
  ),
  component: Page,
});
```

---

## 🎯 Common Patterns

### Public Route with Optional Auth

```tsx
export const Route = createFileRoute('/accommodations/')({
  beforeLoad: async () => {
    try {
      const authState = await fetchAuthState();
      return { isAuthenticated: authState.isAuthenticated };
    } catch {
      return { isAuthenticated: false };
    }
  },
  component: AccommodationsPage,
});

function AccommodationsPage() {
  const { isAuthenticated } = Route.useLoaderData();

  return (
    <div>
      <h1>Accommodations</h1>
      {isAuthenticated ? <PersonalizedView /> : <PublicView />}
    </div>
  );
}
```

### Redirect Authenticated Users

Redirect signed-in users away from auth pages:

```tsx
// src/routes/auth/signin.tsx
export const Route = createFileRoute('/auth/signin')({
  beforeLoad: async () => {
    const { userId } = await getAuth();

    if (userId) {
      // Already signed in, redirect to dashboard
      throw redirect({ to: '/dashboard' });
    }
  },
  component: SignInPage,
});
```

### Multiple Role Check

```tsx
const allowedRoles = ['admin', 'manager'];

export const Route = createFileRoute('/_authed/analytics')({
  beforeLoad: async () => {
    const { userId, sessionClaims } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/auth/signin' });
    }

    const role = sessionClaims?.role as string;

    if (!allowedRoles.includes(role)) {
      throw redirect({
        to: '/dashboard',
        search: {
          error: 'Analytics requires manager or admin role',
        },
      });
    }
  },
  component: AnalyticsPage,
});
```

---

## 🐛 Common Issues

### Issue: "beforeLoad runs twice"

**Symptom:** Auth check executes twice

**Cause:** Runs on server and client during hydration

**Solution:** This is expected behavior. Use server function to ensure consistency:

```tsx
const checkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getWebRequest();
  const { userId } = await getAuth(request);
  return { userId };
});

// This will run once on server, result cached for client
beforeLoad: async () => {
  const authState = await checkAuth();
  // ...
}
```

### Issue: "Redirect causes infinite loop"

**Symptom:** Page keeps redirecting

**Cause:** Circular redirect logic

**Solution:**

```tsx
// ❌ Bad - circular redirect
_authed → check auth → redirect to /signin
/signin → check if signed in → redirect to /dashboard
/dashboard → check auth → redirect to /signin

// ✅ Good - clear flow
_authed → check auth → redirect to /signin (stop)
/signin → if signed in → redirect to /dashboard (stop)
```

### Issue: "User sees protected content briefly"

**Symptom:** Flash of protected content before redirect

**Cause:** Client-side redirect, not server-side

**Solution:**

```tsx
// ✅ Use beforeLoad (server-side)
export const Route = createFileRoute('/protected')({
  beforeLoad: async () => {
    const { userId } = await getAuth();
    if (!userId) throw redirect({ to: '/signin' });
  },
  component: ProtectedPage,
});

// ❌ Don't use client-side redirect
function ProtectedPage() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) {
    return <Navigate to="/signin" />; // Too late!
  }
}
```

---

## 📖 Additional Resources

### Official Documentation

- **[TanStack Router - beforeLoad](https://tanstack.com/router/latest/docs/framework/react/guide/route-trees#beforeload)** - Official docs
- **[TanStack Router - Redirects](https://tanstack.com/router/latest/docs/framework/react/guide/navigation#redirects)** - Redirect patterns
- **[Better Auth Server-Side](https://better-auth.com/docs/backend-requests/handling/nodejs)** - Server-side auth

### Internal Resources

- **[Authentication Guide](./authentication.md)** - Auth basics
- **[Permissions Guide](./permissions.md)** - RBAC implementation
- **[Routing Guide](./routing.md)** - TanStack Router fundamentals

### Examples

See working examples in:

- `apps/admin/src/routes/_authed.tsx` - Protected layout
- `apps/admin/src/routes/_authed/_admin.tsx` - Admin-only layout
- `apps/admin/src/routes/auth/signin.tsx` - Sign-in redirect

---

⬅️ Back to [Development Documentation](./README.md)
