# Authentication Guide

Complete guide to Clerk authentication and authorization in the Hospeda Admin Dashboard.

---

## 📖 Overview

The admin dashboard uses **Clerk** for authentication and authorization. Clerk provides a complete authentication solution with session management, user profiles, and multi-factor authentication out of the box.

**What you'll learn:**

- Clerk setup and configuration
- Authentication flow (sign-in, sign-up, sign-out)
- User session management
- Accessing user data in components
- Clerk components and hooks
- Protected API routes
- Custom authentication patterns
- Best practices and troubleshooting

**Prerequisites:**

- Understanding of React components
- Basic knowledge of TypeScript
- Read [Architecture Overview](../architecture.md)
- Read [Routing Guide](./routing.md)

---

## 🎯 Quick Start

### Basic Authentication Check

```tsx
import { useAuth, useUser } from '@clerk/tanstack-react-start';

export function MyComponent() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  if (!isSignedIn) {
    return <div>Please sign in to continue</div>;
  }

  return (
    <div>
      <p>Welcome, {user?.firstName}!</p>
      <p>User ID: {userId}</p>
    </div>
  );
}
```

### Protected Route

```tsx
// src/routes/_authed.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth } from '@clerk/tanstack-react-start/server';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const { userId } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/auth/signin' });
    }
  },
  component: AuthedLayout,
});
```

---

## 🔧 Clerk Setup

### Environment Variables

Configure Clerk in your environment variables:

```env
# .env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**Important:**

- `VITE_CLERK_PUBLISHABLE_KEY` - Used in client-side code (public)
- `CLERK_SECRET_KEY` - Used in server-side code (secret, never expose)

### Root Provider Setup

Clerk is configured in the root layout:

```tsx
// src/routes/__root.tsx
import { ClerkProvider } from '@clerk/tanstack-react-start';
import { Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <Outlet />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Why this matters:**

- `ClerkProvider` wraps the entire app
- Makes Clerk hooks available everywhere
- Handles session synchronization
- Manages authentication state

---

## 🔐 Authentication Flow

### Sign In Page

The sign-in page uses Clerk's `SignIn` component:

```tsx
// src/routes/auth/signin.tsx
import { SignIn } from '@clerk/tanstack-react-start';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/signin')({
  component: SignInPage,
});

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <SignIn
          routing="path"
          path="/auth/signin"
          signUpUrl="/auth/signup"
          fallbackRedirectUrl="/dashboard"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**SignIn props:**

- `routing="path"` - Use TanStack Router for navigation
- `path` - The current route path
- `signUpUrl` - Where to redirect for sign up
- `fallbackRedirectUrl` - Default redirect after sign in
- `forceRedirectUrl` - Always redirect here (overrides callback URL)

### Sign Up Page

Similar to sign-in, using `SignUp` component:

```tsx
// src/routes/auth/signup.tsx
import { SignUp } from '@clerk/tanstack-react-start';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/signup')({
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <SignUp
          routing="path"
          path="/auth/signup"
          signInUrl="/auth/signin"
          fallbackRedirectUrl="/dashboard"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

### Sign Out

Clerk provides multiple ways to sign out:

```tsx
import { useClerk } from '@clerk/tanstack-react-start';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut();
    // User is redirected to sign-in page automatically
  };

  return <Button onClick={handleSignOut}>Sign Out</Button>;
}
```

**Alternative with navigation:**

```tsx
import { useClerk } from '@clerk/tanstack-react-start';
import { useNavigate } from '@tanstack/react-router';

export function SignOutButton() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: '/auth/signin' });
  };

  return <button onClick={handleSignOut}>Sign Out</button>;
}
```

---

## 👤 User Session Management

### useAuth Hook

Get authentication state:

```tsx
import { useAuth } from '@clerk/tanstack-react-start';

export function MyComponent() {
  const {
    isLoaded,     // Is Clerk loaded?
    isSignedIn,   // Is user signed in?
    userId,       // User ID (if signed in)
    sessionId,    // Session ID (if signed in)
    signOut,      // Sign out function
  } = useAuth();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return <div>Please sign in</div>;
  }

  return <div>User ID: {userId}</div>;
}
```

**Common patterns:**

```tsx
// Wait for Clerk to load
if (!isLoaded) {
  return <LoadingSpinner />;
}

// Check if signed in
if (!isSignedIn) {
  return <SignInPrompt />;
}

// Now safe to use userId
const data = await fetchUserData(userId);
```

### useUser Hook

Access full user profile:

```tsx
import { useUser } from '@clerk/tanstack-react-start';

export function UserProfile() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <div>
      <h1>{user.fullName}</h1>
      <p>{user.primaryEmailAddress?.emailAddress}</p>
      <p>Username: {user.username}</p>
      <img src={user.imageUrl} alt={user.fullName ?? 'User'} />
    </div>
  );
}
```

**User object properties:**

```tsx
user.id                           // User ID
user.firstName                    // First name
user.lastName                     // Last name
user.fullName                     // Full name
user.username                     // Username
user.primaryEmailAddress          // Email object
user.primaryPhoneNumber           // Phone object
user.imageUrl                     // Profile image URL
user.hasImage                     // Has profile image?
user.createdAt                    // Account creation date
user.updatedAt                    // Last update date
```

### useSession Hook

Access session data:

```tsx
import { useSession } from '@clerk/tanstack-react-start';

export function SessionInfo() {
  const { isLoaded, session } = useSession();

  if (!isLoaded || !session) {
    return null;
  }

  return (
    <div>
      <p>Session ID: {session.id}</p>
      <p>Last Active: {session.lastActiveAt.toLocaleString()}</p>
      <p>Expires: {session.expireAt.toLocaleString()}</p>
    </div>
  );
}
```

---

## 🎨 Clerk Components

### UserButton Component

Pre-built user menu with profile, settings, and sign out:

```tsx
import { UserButton } from '@clerk/tanstack-react-start';

export function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <h1>Hospeda Admin</h1>
      <UserButton
        afterSignOutUrl="/auth/signin"
        appearance={{
          elements: {
            avatarBox: 'h-10 w-10',
          },
        }}
      />
    </header>
  );
}
```

**Customization:**

```tsx
<UserButton
  afterSignOutUrl="/auth/signin"
  appearance={{
    elements: {
      avatarBox: 'h-10 w-10 rounded-full',
      userButtonPopoverCard: 'shadow-lg',
    },
  }}
  userProfileMode="modal"
  userProfileProps={{
    appearance: {
      elements: {
        card: 'shadow-xl',
      },
    },
  }}
/>
```

### SignedIn / SignedOut Components

Conditional rendering based on auth state:

```tsx
import { SignedIn, SignedOut } from '@clerk/tanstack-react-start';
import { Link } from '@tanstack/react-router';

export function Navigation() {
  return (
    <nav>
      <SignedIn>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/profile">Profile</Link>
      </SignedIn>

      <SignedOut>
        <Link to="/auth/signin">Sign In</Link>
        <Link to="/auth/signup">Sign Up</Link>
      </SignedOut>
    </nav>
  );
}
```

### UserProfile Component

Full user profile management:

```tsx
import { UserProfile } from '@clerk/tanstack-react-start';

export function ProfilePage() {
  return (
    <div className="container mx-auto p-6">
      <UserProfile
        routing="path"
        path="/profile"
        appearance={{
          elements: {
            card: 'shadow-lg',
          },
        }}
      />
    </div>
  );
}
```

---

## 🔒 Protected Routes

### Layout-Based Protection

Protect entire route groups:

```tsx
// src/routes/_authed.tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getAuth } from '@clerk/tanstack-react-start/server';
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

export const Route = createFileRoute('/_authed')({
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
  component: () => <Outlet />,
});
```

**All routes under `_authed/`:**

```text
src/routes/_authed/
├── dashboard.tsx          → Protected
├── users/
│   ├── index.tsx         → Protected
│   └── $id.tsx           → Protected
└── settings.tsx          → Protected
```

### Individual Route Protection

Protect specific routes:

```tsx
// src/routes/admin/users.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth } from '@clerk/tanstack-react-start/server';

export const Route = createFileRoute('/admin/users')({
  beforeLoad: async () => {
    const { userId } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/auth/signin' });
    }

    // Additional checks (role, permissions, etc.)
  },
  component: UsersPage,
});
```

### Redirect After Sign In

Preserve original destination:

```tsx
// src/routes/_authed.tsx
beforeLoad: async () => {
  const authState = await fetchAuthState();

  if (!authState.isAuthenticated) {
    throw redirect({
      to: '/auth/signin',
      search: {
        // Save current path for redirect after sign in
        redirect: typeof window !== 'undefined'
          ? window.location.pathname
          : '/dashboard',
      },
    });
  }

  return authState;
}
```

**Handle redirect in sign-in page:**

```tsx
// src/routes/auth/signin.tsx
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { SignIn } from '@clerk/tanstack-react-start';
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
    />
  );
}
```

---

## 🔑 Protected API Routes

### Server-Side Authentication

Check auth in server functions:

```tsx
import { createServerFn } from '@tanstack/react-start';
import { getAuth } from '@clerk/tanstack-react-start/server';
import { getWebRequest } from '@tanstack/react-start/server';

export const fetchUserData = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getWebRequest();
    const { userId } = await getAuth(request);

    if (!userId) {
      throw new Error('Unauthorized');
    }

    // Fetch data for this user
    const userData = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });

    return userData;
  });
```

### API Route Protection

Protect API endpoints:

```tsx
// apps/api/src/routes/users.ts
import { createRoute } from '@hono/zod-openapi';
import { verifyToken } from '@clerk/backend';

export const usersRoute = createRoute({
  method: 'get',
  path: '/users',
  handler: async (c) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const verified = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      // Token is valid, proceed
      const users = await db.query.users.findMany();
      return c.json({ users });
    } catch (error) {
      return c.json({ error: 'Invalid token' }, 401);
    }
  },
});
```

### Include Auth Token in Requests

Add token to API calls:

```tsx
import { useAuth } from '@clerk/tanstack-react-start';

export function useAuthenticatedFetch() {
  const { getToken } = useAuth();

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  return { fetchWithAuth };
}
```

**Usage:**

```tsx
export function MyComponent() {
  const { fetchWithAuth } = useAuthenticatedFetch();

  const loadData = async () => {
    const response = await fetchWithAuth('/api/users');
    const data = await response.json();
    return data;
  };

  // ...
}
```

---

## 🎛️ Custom Authentication Patterns

### Custom Sign In Flow

Build custom sign-in UI:

```tsx
import { useSignIn } from '@clerk/tanstack-react-start';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

export function CustomSignIn() {
  const { signIn, setActive } = useSignIn();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signIn) return;

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate({ to: '/dashboard' });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="text-red-600">{error}</div>}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />

      <button type="submit">Sign In</button>
    </form>
  );
}
```

### Email/Password Sign Up

```tsx
import { useSignUp } from '@clerk/tanstack-react-start';
import { useState } from 'react';

export function CustomSignUp() {
  const { signUp, setActive } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signUp) return;

    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      // Send verification email
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      setPendingVerification(true);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signUp) return;

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // Navigate to dashboard
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  if (pendingVerification) {
    return (
      <form onSubmit={handleVerify}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Verification code"
        />
        <button type="submit">Verify</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### OAuth Sign In

Enable social sign-in:

```tsx
import { useSignIn } from '@clerk/tanstack-react-start';

export function SocialSignIn() {
  const { signIn } = useSignIn();

  const signInWithGoogle = async () => {
    if (!signIn) return;

    await signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/auth/callback',
      redirectUrlComplete: '/dashboard',
    });
  };

  const signInWithGithub = async () => {
    if (!signIn) return;

    await signIn.authenticateWithRedirect({
      strategy: 'oauth_github',
      redirectUrl: '/auth/callback',
      redirectUrlComplete: '/dashboard',
    });
  };

  return (
    <div>
      <button onClick={signInWithGoogle}>
        Sign in with Google
      </button>
      <button onClick={signInWithGithub}>
        Sign in with GitHub
      </button>
    </div>
  );
}
```

---

## 💡 Best Practices

### Always Check isLoaded

**✅ DO:**

```tsx
export function MyComponent() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  if (!isSignedIn) {
    return <SignInPrompt />;
  }

  return <div>Welcome, {user.firstName}!</div>;
}
```

**❌ DON'T:**

```tsx
// Bad - user might be undefined
export function MyComponent() {
  const { user } = useUser();

  return <div>Welcome, {user.firstName}!</div>; // Error if not loaded!
}
```

### Use Server-Side Protection

**✅ DO:**

```tsx
// Protect on server before rendering
export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const { userId } = await getAuth();
    if (!userId) throw redirect({ to: '/signin' });
  },
  component: AdminPage,
});
```

**❌ DON'T:**

```tsx
// Don't rely only on client-side checks
export function AdminPage() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return <Navigate to="/signin" />; // Page already loaded!
  }

  return <div>Admin content</div>;
}
```

### Handle Loading States

**✅ DO:**

```tsx
export function UserProfile() {
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="animate-pulse">
        <div className="h-10 w-48 bg-gray-200 rounded" />
        <div className="h-6 w-32 bg-gray-200 rounded mt-2" />
      </div>
    );
  }

  return (
    <div>
      <h1>{user?.fullName}</h1>
      <p>{user?.primaryEmailAddress?.emailAddress}</p>
    </div>
  );
}
```

### Secure Sensitive Routes

**✅ DO:**

```tsx
// Multiple layers of protection
export const Route = createFileRoute('/_authed/_admin/users')({
  beforeLoad: async () => {
    const { userId, sessionClaims } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/signin' });
    }

    if (sessionClaims?.role !== 'admin') {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: AdminUsersPage,
});
```

### Use Type-Safe Session Claims

```tsx
// Define custom session claims type
type SessionClaims = {
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  organizationId: string;
};

export function useUserRole() {
  const { session } = useSession();

  const role = (session?.publicUserData as SessionClaims)?.role;

  return { role };
}
```

---

## 🐛 Common Issues

### Issue: "useAuth returns null"

**Symptom:** Hooks return null or undefined

**Cause:** Component not wrapped in `ClerkProvider`

**Solution:**

```tsx
// Make sure ClerkProvider is in root layout
// src/routes/__root.tsx
import { ClerkProvider } from '@clerk/tanstack-react-start';

export const Route = createRootRoute({
  component: () => (
    <ClerkProvider>
      <Outlet />
    </ClerkProvider>
  ),
});
```

### Issue: "Infinite redirect loop"

**Symptom:** Page keeps redirecting between sign-in and dashboard

**Cause:** Redirect logic in both client and server

**Solution:**

```tsx
// Only use server-side redirect in beforeLoad
export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const { userId } = await getAuth();

    if (!userId) {
      throw redirect({ to: '/auth/signin' });
    }
  },
  component: AuthedLayout,
});

// Don't add client-side redirect in component
function AuthedLayout() {
  // ❌ Don't do this:
  // const { isSignedIn } = useAuth();
  // if (!isSignedIn) return <Navigate to="/signin" />;

  return <Outlet />;
}
```

### Issue: "Session not persisting"

**Symptom:** User signed out after refresh

**Cause:** Missing session token or incorrect domain

**Solution:**

Check Clerk dashboard settings:

1. Go to Clerk Dashboard → Sessions
2. Ensure session lifetime is set correctly
3. Check domain settings match your app

```env
# .env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Make sure domain is correct
VITE_APP_URL=http://localhost:3000
```

### Issue: "User data not updating"

**Symptom:** Profile changes don't appear

**Cause:** Client-side cache not invalidated

**Solution:**

```tsx
import { useUser } from '@clerk/tanstack-react-start';

export function UpdateProfile() {
  const { user } = useUser();

  const updateProfile = async (data: UpdateData) => {
    await user?.update(data);

    // Force reload user data
    await user?.reload();
  };

  return <form onSubmit={updateProfile}>...</form>;
}
```

---

## 🔒 Security Best Practices

### Never Expose Secret Key

**✅ DO:**

```tsx
// Server-side only
import { getAuth } from '@clerk/tanstack-react-start/server';

export const serverFunction = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { userId } = await getAuth(); // Uses CLERK_SECRET_KEY
    // ...
  });
```

**❌ DON'T:**

```tsx
// Never import server functions in client code
// Never use CLERK_SECRET_KEY in browser
```

### Validate on Server

**✅ DO:**

```tsx
// Validate auth on server
export const updateUser = createServerFn({ method: 'POST' })
  .validator((data: UpdateUserData) => data)
  .handler(async ({ data }) => {
    const { userId } = await getAuth();

    if (!userId) {
      throw new Error('Unauthorized');
    }

    // Update user
    return await db.users.update(userId, data);
  });
```

### Use HTTPS in Production

```tsx
// Clerk automatically enforces HTTPS in production
// Make sure your app uses HTTPS too

// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

---

## 📖 Additional Resources

### Official Documentation

- **[Clerk Docs](https://clerk.com/docs)** - Complete Clerk documentation
- **[TanStack Start + Clerk](https://clerk.com/docs/quickstarts/tanstack-start)** - Official integration guide
- **[Clerk React Hooks](https://clerk.com/docs/references/react/use-auth)** - Hook reference
- **[Clerk Components](https://clerk.com/docs/components/overview)** - Component API

### Internal Resources

- **[Architecture Overview](../architecture.md)** - Admin app architecture
- **[Routing Guide](./routing.md)** - Protected routes
- **[Permissions Guide](./permissions.md)** - RBAC implementation
- **[Protected Routes Guide](./protected-routes.md)** - Route protection patterns

### Examples

See working examples in:

- `apps/admin/src/routes/__root.tsx` - ClerkProvider setup
- `apps/admin/src/routes/_authed.tsx` - Protected layout
- `apps/admin/src/routes/auth/signin.tsx` - Sign-in page
- `apps/admin/src/routes/auth/signup.tsx` - Sign-up page

---

⬅️ Back to [Development Documentation](./README.md)
