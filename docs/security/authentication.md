# Authentication & Authorization

Complete guide to authentication and authorization implementation in Hospeda using Better Auth.

## Table of Contents

- Authentication & Authorization
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [Authentication vs Authorization](#authentication-vs-authorization)
    - [Better Auth Integration Overview](#better-auth-integration-overview)
    - [Architecture Diagram](#architecture-diagram)
  - [Better Auth Setup](#better-auth-setup)
    - [Installation](#installation)
    - [Configuration](#configuration)
    - [Social Providers](#social-providers)
    - [Environment Variables](#environment-variables)
      - [API Application](#api-application)
      - [Web Application (Astro)](#web-application-astro)
      - [Admin Application (TanStack Start)](#admin-application-tanstack-start)
    - [Development vs Production](#development-vs-production)
      - [Development Mode](#development-mode)
      - [Production Mode](#production-mode)
  - [Authentication Flows](#authentication-flows)
    - [Sign Up Flow](#sign-up-flow)
      - [Email/Password Sign Up](#emailpassword-sign-up)
      - [OAuth Sign Up (Google)](#oauth-sign-up-google)
    - [Sign In Flow](#sign-in-flow)
      - [Email/Password Sign In](#emailpassword-sign-in)
      - [OAuth Sign In](#oauth-sign-in)
    - [OAuth Providers](#oauth-providers)
      - [Supported Providers](#supported-providers)
      - [Configuration Example (Google)](#configuration-example-google)
  - [Session Management](#session-management)
    - [Session Structure](#session-structure)
    - [Session Validation](#session-validation)
      - [API Session Validation](#api-session-validation)
      - [Frontend Session Validation](#frontend-session-validation)
    - [Session Expiration](#session-expiration)
    - [Session Invalidation](#session-invalidation)
      - [Manual Session Invalidation](#manual-session-invalidation)
  - [Authorization (RBAC)](#authorization-rbac)
    - [Role Definitions](#role-definitions)
      - [User Roles](#user-roles)
    - [Permission System](#permission-system)
      - [Available Permissions](#available-permissions)
      - [Permission Schema](#permission-schema)
    - [Middleware Implementation](#middleware-implementation)
      - [Actor Middleware](#actor-middleware)
      - [Using Actor in Routes](#using-actor-in-routes)
    - [Protected Routes](#protected-routes)
      - [API Route Protection](#api-route-protection)
      - [Frontend Route Protection (Web - Astro)](#frontend-route-protection-web---astro)
      - [Frontend Route Protection (Admin - TanStack)](#frontend-route-protection-admin---tanstack)
    - [Resource Ownership Validation](#resource-ownership-validation)
      - [Service-Level Ownership Check](#service-level-ownership-check)
      - [Route-Level Ownership Check](#route-level-ownership-check)
  - [Multi-Factor Authentication (MFA)](#multi-factor-authentication-mfa)
    - [MFA Setup](#mfa-setup)
    - [TOTP Implementation](#totp-implementation)
    - [Backup Codes](#backup-codes)
    - [User Experience](#user-experience)
  - [Testing](#testing)
    - [Unit Testing with Mock Auth](#unit-testing-with-mock-auth)
      - [Test Environment Setup](#test-environment-setup)
      - [Mock Auth Middleware](#mock-auth-middleware)
    - [Integration Testing](#integration-testing)
      - [Authenticated Request Test](#authenticated-request-test)
      - [Unauthorized Request Test](#unauthorized-request-test)
    - [Testing Different Roles](#testing-different-roles)
  - [Security Best Practices](#security-best-practices)
    - [Session Storage](#session-storage)
    - [HTTPS Only](#https-only)
    - [CSRF Protection](#csrf-protection)
    - [Rate Limiting](#rate-limiting)
    - [Session Timeout](#session-timeout)
    - [Audit Logging](#audit-logging)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
      - [1. "Unauthorized" Error](#1-unauthorized-error)
      - [2. CORS Errors](#2-cors-errors)
      - [3. Session Not Persisting](#3-session-not-persisting)
    - [Debug Mode](#debug-mode)
  - [References](#references)

## Overview

### Authentication vs Authorization

**Authentication** is the process of verifying WHO a user is:

- Confirms user identity
- Validates credentials
- Creates sessions
- Manages login/logout

**Authorization** is the process of verifying WHAT a user can do:

- Checks user permissions
- Enforces access control
- Validates resource ownership
- Implements role-based access

### Better Auth Integration Overview

Hospeda uses **Better Auth** as the self-hosted authentication provider:

**Features:**

- Secure session-based authentication
- OAuth providers (Google, GitHub, etc.)
- Email/password authentication
- Multi-factor authentication (MFA/TOTP)
- Self-hosted (no external API dependency)
- Database-backed sessions (Drizzle adapter)

**Integration Points:**

- **API**: Better Auth instance in `apps/api/src/lib/auth.ts`
- **Web**: Session validation via API calls
- **Admin**: Session validation via API calls with `beforeLoad` guards

### Architecture Diagram

```mermaid
graph TB
    User[User Browser]
    API[API Server + Better Auth]
    Web[Web App]
    Admin[Admin App]
    DB[(Database)]

    User -->|1. Sign In/Up| API
    API -->|2. Create session| DB
    API -->|3. Session cookie| User
    User -->|4. Request + Cookie| Web
    User -->|4. Request + Cookie| Admin
    Web -->|5. API Call + Cookie| API
    Admin -->|5. API Call + Cookie| API
    API -->|6. Validate session| DB
    DB -->|7. Session data| API
    API -->|8. Protected resource| Web
    API -->|8. Protected resource| Admin
```

**Flow:**

1. User authenticates via Better Auth (email/password or OAuth)
2. Better Auth creates a session in the database
3. Session cookie is returned to the browser
4. Frontend apps include cookie in requests
5. API receives requests with session cookie
6. Better Auth validates session against database
7. Session and user data are retrieved
8. API returns protected resources

## Better Auth Setup

### Installation

```bash
# API
cd apps/api
pnpm add better-auth

# Note: Better Auth is self-hosted, so it only needs to be
# installed in the API where the auth instance is created.
# Frontend apps communicate with auth via API endpoints.
```

### Configuration

```typescript
// apps/api/src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@repo/db';

export const auth = betterAuth({
  database: drizzleAdapter(db),
  secret: process.env.HOSPEDA_BETTER_AUTH_SECRET!,
  baseURL: process.env.HOSPEDA_BETTER_AUTH_URL!,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Refresh session every 24 hours
  },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:4321',
    'https://hospeda.com',
    'https://admin.hospeda.com',
  ],
});
```

### Social Providers

#### 1. Enable Google OAuth

```text
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Set authorized redirect URIs:
   - https://api.hospeda.com/api/auth/callback/google
   - http://localhost:3001/api/auth/callback/google (dev)
4. Add credentials to environment variables
```

#### 2. Enable GitHub OAuth

```text
1. Go to GitHub Settings > Developer Settings > OAuth Apps
2. Create new OAuth App
3. Set callback URL:
   - https://api.hospeda.com/api/auth/callback/github
   - http://localhost:3001/api/auth/callback/github (dev)
4. Add credentials to environment variables
```

### Environment Variables

#### API Application

```env
# .env.local (API)

# Better Auth
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key-at-least-32-chars
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# API Configuration
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_DATABASE_URL=postgresql://user:password@localhost:5432/hospeda

# Node Environment
NODE_ENV=development
```

#### Web Application (Astro)

```env
# .env.local (Web)

# API URL (Better Auth runs on the API)
PUBLIC_API_URL=http://localhost:3001
```

#### Admin Application (TanStack Start)

```env
# .env.local (Admin)

# API URL (Better Auth runs on the API)
VITE_API_URL=http://localhost:3001
```

### Development vs Production

#### Development Mode

**Features:**

- Local database for sessions
- Debug logging enabled
- Relaxed CORS (localhost origins)
- HTTP allowed

**Setup:**

```bash
# Start database
pnpm db:start

# Run migrations (Better Auth tables are created automatically)
pnpm db:migrate

# Start API (Better Auth runs on the API server)
pnpm dev:api
```

#### Production Mode

**Features:**

- Production database
- Strict CORS (only production origins)
- HTTPS required
- Error logging only

**Environment:**

```env
# .env (Production)

NODE_ENV=production

# Better Auth Production Config
HOSPEDA_BETTER_AUTH_SECRET=production-secret-at-least-32-chars
HOSPEDA_BETTER_AUTH_URL=https://api.hospeda.com

# Production URLs
HOSPEDA_API_URL=https://api.hospeda.com
```

## Authentication Flows

### Sign Up Flow

#### Email/Password Sign Up

**Frontend (React Component):**

```tsx
// Web: src/components/auth/SignUpForm.tsx
// Admin: src/routes/auth/signup.tsx

import { useState } from 'react';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include', // Include session cookie
    });

    if (response.ok) {
      window.location.href = '/dashboard';
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

**Flow Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant BetterAuth as Better Auth
    participant DB

    User->>Frontend: Enter email/password
    Frontend->>API: POST /api/auth/sign-up/email
    API->>BetterAuth: Create user
    BetterAuth->>DB: Insert user + session
    BetterAuth->>API: Return session
    API->>Frontend: Set session cookie
    Frontend->>User: Redirect to dashboard
```

#### OAuth Sign Up (Google)

**Frontend:**

```tsx
// OAuth is handled via redirect to Better Auth endpoint

export function OAuthSignUpButton() {
  const handleGoogleSignUp = () => {
    // Redirect to Better Auth OAuth endpoint
    window.location.href = '/api/auth/sign-in/social?provider=google';
  };

  return (
    <button onClick={handleGoogleSignUp}>Sign up with Google</button>
  );
}
```

**Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant BetterAuth as Better Auth
    participant Google
    participant DB

    User->>Frontend: Click "Sign up with Google"
    Frontend->>API: Redirect to /api/auth/sign-in/social?provider=google
    API->>BetterAuth: Initiate OAuth
    BetterAuth->>Google: Redirect to Google
    User->>Google: Authorize Hospeda
    Google->>BetterAuth: Authorization code
    BetterAuth->>Google: Exchange for tokens
    Google->>BetterAuth: User profile
    BetterAuth->>DB: Create user + session
    BetterAuth->>Frontend: Redirect with session cookie
    Frontend->>User: Redirect to dashboard
```

### Sign In Flow

#### Email/Password Sign In

**Frontend:**

```tsx
// Web: src/components/auth/SignInForm.tsx

export function SignInForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (response.ok) {
      window.location.href = '/dashboard';
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Sign In</button>
    </form>
  );
}
```

**Backend Validation (API):**

```typescript
// apps/api/src/lib/auth.ts
// Better Auth handles sign-in validation automatically
// The auth instance is mounted as a route handler

import { auth } from './lib/auth';
import { Hono } from 'hono';

const app = new Hono();

// Mount Better Auth routes
app.on(['GET', 'POST'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw);
});
```

**Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant BetterAuth as Better Auth
    participant DB

    User->>Frontend: Enter credentials
    Frontend->>API: POST /api/auth/sign-in/email
    API->>BetterAuth: Validate credentials
    BetterAuth->>DB: Verify user + hash
    DB->>BetterAuth: User data
    BetterAuth->>DB: Create session
    BetterAuth->>API: Return session
    API->>Frontend: Set session cookie
    Frontend->>User: Redirect to dashboard
```

#### OAuth Sign In

Same as OAuth Sign Up flow, but for existing users.

### OAuth Providers

#### Supported Providers

| Provider | Status | Configuration |
|----------|--------|---------------|
| Google | Enabled | OAuth 2.0 |
| GitHub | Enabled | OAuth 2.0 |
| Facebook | Available | Not configured |
| Twitter | Available | Not configured |
| Microsoft | Available | Not configured |

#### Configuration Example (Google)

**1. Google Cloud Console:**

```text
1. Create project: "Hospeda"
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Set authorized redirect URIs:
   - https://api.hospeda.com/api/auth/callback/google
   - http://localhost:3001/api/auth/callback/google (dev)
```

**2. Better Auth Config:**

```typescript
// apps/api/src/lib/auth.ts
export const auth = betterAuth({
  // ...
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
```

**3. Test:**

```bash
# Navigate to sign-up page
http://localhost:4321/signup

# Click "Continue with Google"
# Should redirect to Google OAuth consent
```

## Session Management

### Session Structure

Better Auth uses database-backed sessions instead of JWTs:

```json
{
  "session": {
    "id": "sess_abc123def456",
    "userId": "user_abc123",
    "expiresAt": "2026-03-09T12:00:00.000Z",
    "createdAt": "2026-03-02T12:00:00.000Z",
    "updatedAt": "2026-03-02T12:00:00.000Z",
    "ipAddress": "203.0.113.1",
    "userAgent": "Mozilla/5.0..."
  },
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "role": "user"
  }
}
```

**Key Properties:**

- `session.id`: Unique session identifier
- `session.userId`: Associated user
- `session.expiresAt`: Session expiration time
- `user.role`: User role for authorization

### Session Validation

#### API Session Validation

```typescript
// apps/api/src/middlewares/auth.ts

import { auth } from '../lib/auth';
import type { Context } from 'hono';

export async function validateSession(c: Context) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Session is valid, user is authenticated
  return session;
}
```

**Usage in Routes:**

```typescript
// apps/api/src/routes/accommodation/create.ts

import { createOpenApiRoute } from '../../utils/route-factory';
import { auth } from '../../lib/auth';

export const createAccommodationRoute = createOpenApiRoute({
  method: 'post',
  path: '/accommodations',
  summary: 'Create accommodation',
  handler: async (c, params, body) => {
    // Auth is automatically validated by middleware
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      throw new Error('Unauthorized');
    }

    // Create accommodation
    const service = new AccommodationService(c);
    const result = await service.create(body);

    return result.data;
  }
});
```

#### Frontend Session Validation

**Web (Astro):**

```typescript
// apps/web/src/middleware.ts

import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Check session via API
  const response = await fetch(`${API_URL}/api/auth/get-session`, {
    headers: context.request.headers,
    credentials: 'include',
  });

  if (response.ok) {
    const session = await response.json();
    context.locals.user = session.user;
  }

  return next();
});
```

**Admin (TanStack Start):**

```typescript
// apps/admin/src/routes/_authed.tsx

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw redirect({
        to: '/auth/signin',
        search: {
          redirect: location.href
        }
      });
    }

    const session = await response.json();
    return { user: session.user };
  }
});
```

### Session Expiration

**Default Settings:**

- **Session Duration**: 7 days
- **Update Age**: 24 hours (session refreshed on activity)

**Configuration:**

```typescript
// apps/api/src/lib/auth.ts
export const auth = betterAuth({
  // ...
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Refresh every 24 hours on activity
  },
});
```

**Automatic Refresh:**

Better Auth automatically refreshes sessions when the user is active:

```typescript
// Better Auth handles this automatically
// When a request is made and the session age exceeds updateAge,
// the session expiration is extended
```

### Session Invalidation

#### Manual Session Invalidation

**Backend (API):**

```typescript
// apps/api/src/routes/auth/signout.ts

import { createSimpleRoute } from '../../utils/route-factory';
import { auth } from '../../lib/auth';

export const signOutRoute = createSimpleRoute({
  method: 'post',
  path: '/auth/signout',
  summary: 'Sign out user',
  handler: async (c) => {
    await auth.api.signOut({
      headers: c.req.raw.headers,
    });

    return { success: true, message: 'Signed out successfully' };
  }
});
```

**Frontend (React):**

```typescript
// Web/Admin

function SignOutButton() {
  const handleSignOut = async () => {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/auth/signin';
  };

  return <button onClick={handleSignOut}>Sign Out</button>;
}
```

**Invalidate All User Sessions:**

```typescript
// Admin only - revoke all sessions for a user

import { db } from '@repo/db';
import { sessions } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

async function revokeAllUserSessions(userId: string) {
  const result = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId));

  return { revoked: result.rowCount };
}
```

## Authorization (RBAC)

Role-Based Access Control (RBAC) implementation.

### Role Definitions

#### User Roles

```typescript
// packages/schemas/src/auth/permissions.schema.ts

export const userRoleSchema = z.enum([
  'user',      // Regular user
  'moderator', // Content moderator
  'admin'      // Administrator
]);

export type UserRole = z.infer<typeof userRoleSchema>;
```

**Role Hierarchy:**

```text
admin
  └─ All permissions
     ├─ User management
     ├─ Content moderation
     ├─ System configuration
     └─ All moderator + user permissions

moderator
  └─ Content permissions
     ├─ Review accommodations
     ├─ Moderate reviews
     ├─ Manage posts
     └─ All user permissions

user
  └─ Basic permissions
     ├─ Create accommodation
     ├─ Book accommodations
     ├─ Write reviews
     └─ Manage own content
```

### Permission System

#### Available Permissions

```typescript
// packages/schemas/src/auth/permissions.schema.ts

export const permissionSchema = z.enum([
  // Accommodation permissions
  'accommodation:read',
  'accommodation:write',
  'accommodation:delete',
  'accommodation:moderate',

  // Review permissions
  'review:read',
  'review:write',
  'review:delete',
  'review:moderate',

  // User permissions
  'user:read',
  'user:write',
  'user:delete',

  // Admin permissions
  'admin:all'
]);

export type Permission = z.infer<typeof permissionSchema>;
```

#### Permission Schema

```typescript
// packages/schemas/src/auth/permissions.schema.ts

import { z } from 'zod';

/**
 * Role-based permissions mapping
 */
export const rolePermissionsMap: Record<UserRole, Permission[]> = {
  user: [
    'accommodation:read',
    'accommodation:write', // Own accommodations only
    'review:read',
    'review:write', // Own reviews only
    'user:read' // Own profile only
  ],
  moderator: [
    'accommodation:read',
    'accommodation:write',
    'accommodation:moderate',
    'review:read',
    'review:write',
    'review:moderate',
    'user:read'
  ],
  admin: [
    'admin:all', // Grants all permissions
    'accommodation:read',
    'accommodation:write',
    'accommodation:delete',
    'accommodation:moderate',
    'review:read',
    'review:write',
    'review:delete',
    'review:moderate',
    'user:read',
    'user:write',
    'user:delete'
  ]
};

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return rolePermissionsMap[role] || rolePermissionsMap.user;
}

/**
 * Check if role has permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission) || permissions.includes('admin:all');
}
```

### Middleware Implementation

#### Actor Middleware

```typescript
// apps/api/src/middlewares/actor.ts

import { auth } from '../lib/auth';
import type { Context, Next } from 'hono';
import { getPermissionsForRole } from '@repo/schemas';

/**
 * Actor context type
 */
export interface Actor {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  role: UserRole;
  permissions: Permission[];
}

/**
 * Actor middleware - extracts user from Better Auth session
 */
export const actorMiddleware = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    // Unauthenticated actor
    c.set('actor', {
      isAuthenticated: false,
      userId: null,
      email: null,
      role: 'user',
      permissions: []
    } as Actor);

    await next();
    return;
  }

  // Extract role from user data
  const role = (session.user.role as UserRole) || 'user';
  const permissions = getPermissionsForRole(role);

  // Authenticated actor
  c.set('actor', {
    isAuthenticated: true,
    userId: session.user.id,
    email: session.user.email || null,
    role,
    permissions
  } as Actor);

  await next();
};

/**
 * Get actor from context
 */
export function getActorFromContext(c: Context): Actor {
  return c.get('actor') as Actor;
}
```

#### Using Actor in Routes

```typescript
// apps/api/src/routes/accommodation/create.ts

import { createOpenApiRoute } from '../../utils/route-factory';
import { getActorFromContext } from '../../middlewares/actor';
import { hasPermission } from '@repo/schemas';

export const createAccommodationRoute = createOpenApiRoute({
  method: 'post',
  path: '/accommodations',
  summary: 'Create accommodation',
  handler: async (c, params, body) => {
    const actor = getActorFromContext(c);

    // Check authentication
    if (!actor.isAuthenticated) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check permission
    if (!hasPermission(actor.role, 'accommodation:write')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Create accommodation
    const service = new AccommodationService(c);
    const result = await service.create({
      ...body,
      ownerId: actor.userId // Set owner
    });

    return result.data;
  }
});
```

### Protected Routes

#### API Route Protection

#### Option 1: Factory Options (Recommended)

```typescript
// apps/api/src/routes/accommodation/list.ts

import { createListRoute } from '../../utils/route-factory';

export const listAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/accommodations',
  summary: 'List accommodations',
  handler: async (c, params, body, query) => {
    const service = new AccommodationService(c);
    return await service.findAll(query);
  },
  options: {
    skipAuth: true // Public endpoint
  }
});

// Protected endpoint (auth required by default)
export const myAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/accommodations/my',
  summary: 'List my accommodations',
  handler: async (c, params, body, query) => {
    const actor = getActorFromContext(c);
    const service = new AccommodationService(c);

    return await service.findAll({
      ...query,
      ownerId: actor.userId
    });
  }
  // Auth required by default
});
```

#### Option 2: Manual Check

```typescript
// apps/api/src/routes/accommodation/delete.ts

import { createOpenApiRoute } from '../../utils/route-factory';
import { getActorFromContext } from '../../middlewares/actor';

export const deleteAccommodationRoute = createOpenApiRoute({
  method: 'delete',
  path: '/accommodations/:id',
  summary: 'Delete accommodation',
  handler: async (c, params) => {
    const actor = getActorFromContext(c);

    // Manual authentication check
    if (!actor.isAuthenticated) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Manual permission check
    if (!hasPermission(actor.role, 'accommodation:delete')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const service = new AccommodationService(c);
    const result = await service.delete({ id: params.id });

    return result.data;
  }
});
```

#### Frontend Route Protection (Web - Astro)

```typescript
// apps/web/src/middleware.ts

import { defineMiddleware } from 'astro:middleware';

const protectedRoutes = ['/dashboard', '/accommodations/new', '/profile'];

export const onRequest = defineMiddleware(async (context, next) => {
  const isProtected = protectedRoutes.some(route =>
    context.url.pathname.startsWith(route)
  );

  if (isProtected) {
    const session = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: context.request.headers,
      credentials: 'include',
    });

    if (!session.ok) {
      return context.redirect('/auth/signin');
    }

    const data = await session.json();
    context.locals.user = data.user;
  }

  return next();
});
```

**Page-Level Protection:**

```astro
---
// apps/web/src/pages/[lang]/mi-cuenta/index.astro

const user = Astro.locals.user;

if (!user) {
  return Astro.redirect(`/${locale}/auth/signin`);
}
---

<h1>Welcome, {user.name}!</h1>
```

#### Frontend Route Protection (Admin - TanStack)

```typescript
// apps/admin/src/routes/_authed.tsx

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw redirect({
        to: '/auth/signin',
        search: {
          redirect: location.href
        }
      });
    }

    const session = await response.json();
    return { user: session.user, userId: session.user.id };
  }
});
```

**Role-Based Protection:**

```typescript
// apps/admin/src/routes/_authed/admin.tsx

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: async ({ context }) => {
    const { user } = context;

    if (!user.permissions?.includes(PermissionEnum.ADMIN_PANEL_ACCESS)) {
      throw redirect({
        to: '/',
        search: {
          error: 'Forbidden'
        }
      });
    }
  }
});
```

### Resource Ownership Validation

#### Service-Level Ownership Check

```typescript
// packages/service-core/src/services/accommodation/accommodation.service.ts

import { BaseService } from '../base.service';
import { ServiceError, ServiceErrorCode } from '@repo/schemas';

export class AccommodationService extends BaseService {
  /**
   * Update accommodation (with ownership check)
   */
  async update(input: UpdateAccommodationInput): Promise<ServiceResult<Accommodation>> {
    const actor = this.getActor();

    // Get existing accommodation
    const existing = await this.model.findById({ id: input.id });

    if (!existing) {
      return ServiceResult.failure(
        'Accommodation not found',
        ServiceErrorCode.NOT_FOUND
      );
    }

    // Check ownership (unless user has update-any permission)
    if (existing.ownerId !== actor.userId && !actor.permissions?.includes(PermissionEnum.ACCOMMODATION_LISTING_UPDATE)) {
      return ServiceResult.failure(
        'You do not have permission to update this accommodation',
        ServiceErrorCode.FORBIDDEN
      );
    }

    // Update accommodation
    const result = await this.model.update(input);

    return ServiceResult.success(result);
  }

  /**
   * Delete accommodation (with ownership check)
   */
  async delete(input: DeleteAccommodationInput): Promise<ServiceResult<void>> {
    const actor = this.getActor();

    // Get existing accommodation
    const existing = await this.model.findById({ id: input.id });

    if (!existing) {
      return ServiceResult.failure(
        'Accommodation not found',
        ServiceErrorCode.NOT_FOUND
      );
    }

    // Check ownership or admin permission
    const canDelete =
      existing.ownerId === actor.userId ||
      hasPermission(actor.role, 'accommodation:delete');

    if (!canDelete) {
      return ServiceResult.failure(
        'You do not have permission to delete this accommodation',
        ServiceErrorCode.FORBIDDEN
      );
    }

    // Delete accommodation
    await this.model.delete({ id: input.id });

    return ServiceResult.success();
  }
}
```

#### Route-Level Ownership Check

```typescript
// apps/api/src/routes/accommodation/update.ts

import { createOpenApiRoute } from '../../utils/route-factory';
import { getActorFromContext } from '../../middlewares/actor';

export const updateAccommodationRoute = createOpenApiRoute({
  method: 'put',
  path: '/accommodations/:id',
  summary: 'Update accommodation',
  handler: async (c, params, body) => {
    const actor = getActorFromContext(c);

    // Service handles ownership check
    const service = new AccommodationService(c);
    const result = await service.update({
      id: params.id,
      ...body
    });

    if (!result.success) {
      // Service returns appropriate error code
      const statusCode = result.error.code === 'FORBIDDEN' ? 403 : 400;
      return c.json({ error: result.error.message }, statusCode);
    }

    return result.data;
  }
});
```

## Multi-Factor Authentication (MFA)

### MFA Setup

Better Auth supports TOTP-based MFA:

```typescript
// apps/api/src/lib/auth.ts
import { twoFactor } from 'better-auth/plugins';

export const auth = betterAuth({
  // ...
  plugins: [
    twoFactor({
      issuer: 'Hospeda',
    }),
  ],
});
```

### TOTP Implementation

TOTP (Time-based One-Time Password) uses authenticator apps like Google Authenticator or Authy.

**Frontend (React):**

```tsx
// apps/admin/src/components/MfaSetup.tsx

export function MfaSetup() {
  const enableMfa = async () => {
    const response = await fetch('/api/auth/two-factor/enable', {
      method: 'POST',
      credentials: 'include',
    });

    const { totpURI, backupCodes } = await response.json();
    // Display QR code from totpURI
    // Display backup codes
  };

  return (
    <div>
      <button onClick={enableMfa}>Enable MFA</button>
    </div>
  );
}
```

**MFA Login Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant BetterAuth as Better Auth
    participant Authenticator

    User->>Frontend: Enter email/password
    Frontend->>API: POST /api/auth/sign-in/email
    API->>BetterAuth: Validate credentials
    BetterAuth->>Frontend: Prompt for MFA code
    Frontend->>User: Show MFA input
    User->>Authenticator: Open app
    Authenticator->>User: Generate code
    User->>Frontend: Enter code
    Frontend->>API: POST /api/auth/two-factor/verify
    API->>BetterAuth: Verify TOTP code
    BetterAuth->>Frontend: Return session cookie
    Frontend->>User: Authenticated
```

### Backup Codes

Backup codes are one-time use codes for when the user loses access to their authenticator device.

```tsx
// Generated during MFA setup
// Store securely and display to user once
```

### User Experience

**Best Practices:**

1. **Optional by default**: Don't force all users to enable MFA
2. **Required for admins**: Enforce MFA for high-privilege accounts
3. **Clear instructions**: Guide users through setup process
4. **Backup codes**: Always provide backup codes
5. **Recovery options**: Allow account recovery if device is lost

## Testing

### Unit Testing with Mock Auth

#### Test Environment Setup

```env
# .env.test

NODE_ENV=test

# Disable real auth validation in tests
API_VALIDATION_AUTH_ENABLED=false

# Other test config
HOSPEDA_DATABASE_URL=postgresql://test:test@localhost:5432/hospeda_test
HOSPEDA_BETTER_AUTH_SECRET=test-secret-for-testing-only-32chars
```

#### Mock Auth Middleware

```typescript
// apps/api/src/middlewares/auth.ts

export const getAuthMiddleware = () => {
  // In test environment, use mock auth
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.API_VALIDATION_AUTH_ENABLED === 'false'
  ) {
    return async (c: Context, next: Next) => {
      const authHeader = c.req.header('authorization');

      // Invalid tokens
      const invalidTokens = [
        'Bearer invalid_token_here',
        'Bearer expired_token_here'
      ];

      const hasValidToken =
        authHeader?.startsWith('Bearer ') &&
        !invalidTokens.includes(authHeader);

      const mockSession = hasValidToken
        ? { user: { id: 'test-user-id' }, session: { id: 'test-session-id' } }
        : null;

      c.set('session', mockSession);

      await next();
    };
  }

  // Production: use real Better Auth
  return actorMiddleware;
};
```

### Integration Testing

#### Authenticated Request Test

```typescript
// apps/api/test/integration/accommodation/create.test.ts

import { describe, it, expect } from 'vitest';
import { app } from '../../../src/app';

describe('POST /accommodations - Create Accommodation', () => {
  it('should create accommodation when authenticated', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_test_token'
      },
      body: JSON.stringify({
        title: 'Beach House',
        description: 'Beautiful beach house',
        pricePerNight: 150,
        maxGuests: 6
      })
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.title).toBe('Beach House');
  });
});
```

#### Unauthorized Request Test

```typescript
// apps/api/test/integration/accommodation/create.test.ts

describe('POST /accommodations - Unauthorized', () => {
  it('should reject request without auth token', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header
      },
      body: JSON.stringify({
        title: 'Beach House'
      })
    });

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Unauthorized');
  });

  it('should reject request with invalid token', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid_token_here'
      },
      body: JSON.stringify({
        title: 'Beach House'
      })
    });

    expect(response.status).toBe(401);
  });
});
```

### Testing Different Roles

```typescript
// apps/api/test/helpers/mock-actors.ts

import type { Actor } from '../../src/middlewares/actor';

export function createMockUserActor(): Actor {
  return {
    isAuthenticated: true,
    userId: 'user-123',
    email: 'user@example.com',
    role: 'user',
    permissions: ['accommodation:read', 'accommodation:write']
  };
}

export function createMockModeratorActor(): Actor {
  return {
    isAuthenticated: true,
    userId: 'mod-123',
    email: 'moderator@example.com',
    role: 'moderator',
    permissions: [
      'accommodation:read',
      'accommodation:write',
      'accommodation:moderate'
    ]
  };
}

export function createMockAdminActor(): Actor {
  return {
    isAuthenticated: true,
    userId: 'admin-123',
    email: 'admin@example.com',
    role: 'admin',
    permissions: ['admin:all']
  };
}
```

**Usage in Tests:**

```typescript
// apps/api/test/integration/accommodation/delete.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockUserActor, createMockAdminActor } from '../../helpers/mock-actors';

describe('DELETE /accommodations/:id - Authorization', () => {
  let accommodationId: string;

  beforeEach(async () => {
    // Create test accommodation
    accommodationId = 'acc-123';
  });

  it('should allow owner to delete own accommodation', async () => {
    const actor = createMockUserActor();

    const response = await app.request(`/api/v1/accommodations/${accommodationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer valid_test_token',
        'x-test-actor': JSON.stringify(actor) // Mock actor
      }
    });

    expect(response.status).toBe(200);
  });

  it('should forbid user from deleting others accommodation', async () => {
    const actor = createMockUserActor();
    actor.userId = 'other-user-123'; // Different user

    const response = await app.request(`/api/v1/accommodations/${accommodationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer valid_test_token',
        'x-test-actor': JSON.stringify(actor)
      }
    });

    expect(response.status).toBe(403);
  });

  it('should allow admin to delete any accommodation', async () => {
    const actor = createMockAdminActor();

    const response = await app.request(`/api/v1/accommodations/${accommodationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer valid_test_token',
        'x-test-actor': JSON.stringify(actor)
      }
    });

    expect(response.status).toBe(200);
  });
});
```

## Security Best Practices

### Session Storage

**Better Auth handles session storage securely:**

```typescript
// Sessions are stored in the database, not in the browser
// Only a session token cookie is sent to the browser

// Cookie settings (configured by Better Auth):
// - httpOnly: true (prevents XSS access)
// - secure: true in production (HTTPS only)
// - sameSite: 'lax' (CSRF protection)
// - path: '/'
```

**DO NOT:**

```typescript
// Never store session data in localStorage
localStorage.setItem('session', sessionData); // INSECURE!

// Never expose session tokens in URL
window.location.href = `/dashboard?token=${token}`; // INSECURE!
```

### HTTPS Only

**Production Configuration:**

```typescript
// apps/api/src/utils/env.ts

if (process.env.NODE_ENV === 'production') {
  if (!process.env.HOSPEDA_API_URL?.startsWith('https://')) {
    throw new Error('API URL must use HTTPS in production');
  }
}
```

**Enforce HTTPS:**

```typescript
// apps/api/src/middlewares/security.ts

export const enforceHttps = async (c: Context, next: Next) => {
  if (process.env.NODE_ENV === 'production') {
    const protocol = c.req.header('x-forwarded-proto') || 'http';

    if (protocol !== 'https') {
      return c.json({ error: 'HTTPS required' }, 403);
    }
  }

  await next();
};
```

### CSRF Protection

Better Auth provides built-in CSRF protection via:

1. **SameSite cookies**: Prevents cross-site requests
2. **Origin validation**: Checks request origin via trustedOrigins config
3. **Session-based auth**: No bearer tokens to steal via XSS

**Additional Protection:**

```typescript
// apps/api/src/middlewares/csrf.ts

import type { Context, Next } from 'hono';

export const csrfProtection = async (c: Context, next: Next) => {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    await next();
    return;
  }

  // Validate origin
  const origin = c.req.header('origin');
  const allowedOrigins = process.env.API_CORS_ORIGINS?.split(',') || [];

  if (!origin || !allowedOrigins.includes(origin)) {
    return c.json({ error: 'Invalid origin' }, 403);
  }

  await next();
};
```

### Rate Limiting

See [API Protection Guide](./api-protection.md) for complete rate limiting implementation.

**Auth Endpoint Rate Limits:**

```env
# .env

# Auth endpoints (stricter)
RATE_LIMIT_AUTH_MAX_REQUESTS=5
RATE_LIMIT_AUTH_WINDOW_MS=60000  # 5 req/min

# General endpoints
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000  # 100 req/min
```

### Session Timeout

**Configure in Better Auth:**

```typescript
// apps/api/src/lib/auth.ts
export const auth = betterAuth({
  // ...
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Refresh every 24 hours
  },
});
```

**Implement Frontend Timeout:**

```typescript
// apps/web/src/utils/session-timeout.ts

export function useSessionTimeout() {
  let timeoutId: NodeJS.Timeout;

  const resetTimeout = () => {
    clearTimeout(timeoutId);

    // Sign out after 30 minutes of inactivity
    timeoutId = setTimeout(async () => {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/auth/signin';
    }, 30 * 60 * 1000);
  };

  // Reset on user activity
  window.addEventListener('mousemove', resetTimeout);
  window.addEventListener('keypress', resetTimeout);

  return { resetTimeout };
}
```

### Audit Logging

**Log Authentication Events:**

```typescript
// apps/api/src/routes/auth/sync.ts

import { apiLogger } from '../../utils/logger';

// Better Auth hooks for logging
export const auth = betterAuth({
  // ...
  hooks: {
    after: [
      {
        matcher: (context) => context.path.startsWith('/sign-in'),
        handler: async (ctx) => {
          apiLogger.security({
            event: 'user.sign_in',
            userId: ctx.session?.userId,
            ipAddress: ctx.headers?.get('x-forwarded-for'),
            userAgent: ctx.headers?.get('user-agent'),
            timestamp: new Date(),
          });
        },
      },
    ],
  },
});
```

**Log Authorization Events:**

```typescript
// packages/service-core/src/services/base.service.ts

export class BaseService {
  protected logAuthorizationCheck(
    resource: string,
    action: string,
    allowed: boolean
  ) {
    this.logger.security({
      event: 'authorization.check',
      userId: this.actor.userId,
      resource,
      action,
      allowed,
      timestamp: new Date()
    });
  }
}
```

## Troubleshooting

### Common Issues

#### 1. "Unauthorized" Error

**Symptoms:**

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Solutions:**

```bash
# Check session cookie is being sent
curl -b cookies.txt \
  http://localhost:3001/api/v1/accommodations

# Verify Better Auth secret is set
echo $HOSPEDA_BETTER_AUTH_SECRET

# Check session exists in database
# Use Drizzle Studio: pnpm db:studio
```

#### 2. CORS Errors

**Symptoms:**

```text
Access to fetch at 'http://localhost:3001' from origin 'http://localhost:4321'
has been blocked by CORS policy
```

**Solutions:**

```typescript
// Verify trustedOrigins in Better Auth config
export const auth = betterAuth({
  // ...
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:4321',
  ],
});
```

```typescript
// Verify CORS middleware is applied
// apps/api/src/app.ts

import { corsMiddleware } from './middlewares/cors';

app.use('*', corsMiddleware());
```

#### 3. Session Not Persisting

**Symptoms:**

- User signs in but gets signed out on refresh
- Session doesn't persist across tabs

**Solutions:**

```typescript
// Ensure credentials: 'include' is set on all fetch calls
const response = await fetch('/api/auth/get-session', {
  credentials: 'include', // Required for cookies
});

// Check HTTPS in production
// Secure cookies only work over HTTPS
if (process.env.NODE_ENV === 'production') {
  // Ensure HOSPEDA_BETTER_AUTH_URL uses https://
}

// Verify cookie domain matches
// Better Auth sets cookies on the API domain
```

### Debug Mode

**Enable Debug Logging:**

```env
# .env.local

API_LOG_LEVEL=debug
API_ENABLE_REQUEST_LOGGING=true
```

```typescript
// apps/api/src/lib/auth.ts

export const auth = betterAuth({
  // ...
  logger: {
    disabled: false,
    level: 'debug',
  },
});
```

## Quick Reference

### Package Architecture

```
@repo/auth-ui          # Shared auth UI components (sign-in, sign-up forms)
packages/db            # User, session, account tables (Drizzle schema)
apps/api               # Better Auth server instance, session middleware
apps/web               # Auth pages, session checks in Astro frontmatter
apps/admin             # Auth guards in TanStack Router beforeLoad
```

### Application Roles

| Role | Description | Access |
|------|-------------|--------|
| `GUEST` | Default role for new users | Browse, search, leave reviews |
| `HOST` | Accommodation owner | Manage properties, view bookings, billing |
| `SPONSOR` | Business sponsor | Manage sponsored content, view analytics |
| `EDITOR` | Content editor | Manage blog posts, events, destinations |
| `ADMIN` | Platform administrator | Full access to admin panel |

### Permission System Quick Rules

**Critical Rule: NEVER check roles directly. Always use PermissionEnum.**

```typescript
// CORRECT
import { PermissionEnum } from '@repo/schemas';
requirePermission(PermissionEnum.ACCOMMODATION_CREATE);

// WRONG - never do this
if (user.role === 'ADMIN') { ... }
if (user.role === 'HOST') { ... }
```

### Common Permissions

| Permission | Roles |
|-----------|-------|
| `ACCOMMODATION_READ` | ADMIN, EDITOR, HOST |
| `ACCOMMODATION_CREATE` | ADMIN, HOST |
| `ACCOMMODATION_UPDATE` | ADMIN, HOST (own) |
| `ACCOMMODATION_DELETE` | ADMIN |
| `USER_MANAGE` | ADMIN |
| `BILLING_MANAGE` | ADMIN |
| `CONTENT_MANAGE` | ADMIN, EDITOR |

### Three-Tier Route Architecture

```typescript
// Public routes - no auth
app.route('/api/v1/public', publicRoutes);

// Protected routes - require valid session
app.use('/api/v1/protected/*', requireAuth);
app.route('/api/v1/protected', protectedRoutes);

// Admin routes - require admin session + permissions
app.use('/api/v1/admin/*', requireAuth, requireAdmin);
app.route('/api/v1/admin', adminRoutes);
```

### Shared Auth UI Components (@repo/auth-ui)

- `SignInForm` .. Email/password sign-in form
- `SignUpForm` .. Registration form with role selection
- `ForgotPasswordForm` .. Password reset request
- `UserAvatar` .. User avatar display
- `AuthProvider` .. Auth context provider

Usage in web app:

```astro
---
import { SignInForm } from '@repo/auth-ui';
---
<SignInForm client:load locale={locale} />
```

### Environment Variables

```bash
# Required for Better Auth
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key-min-32-chars
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# API URL (where Better Auth server runs)
HOSPEDA_API_URL=http://localhost:3001
```

## References

**Official Documentation:**

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth API Reference](https://www.better-auth.com/docs/api-reference)
- [Better Auth Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [Better Auth Social Providers](https://www.better-auth.com/docs/authentication/social)

**Related Hospeda Documentation:**

- [Security Overview](./overview.md)
- [API Protection](./api-protection.md)
- [Input Sanitization](./input-sanitization.md)
- [OWASP Top 10](./owasp-top-10.md)

**External Resources:**

- [OAuth 2.0 Specification](https://oauth.net/2/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
