# Authentication & Authorization

Complete guide to authentication and authorization implementation in Hospeda using Clerk.

## Table of Contents

- Authentication & Authorization
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [Authentication vs Authorization](#authentication-vs-authorization)
    - [Clerk Integration Overview](#clerk-integration-overview)
    - [Architecture Diagram](#architecture-diagram)
  - [Clerk Setup](#clerk-setup)
    - [Account Configuration](#account-configuration)
    - [Application Setup](#application-setup)
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
    - [Magic Links](#magic-links)
      - [Implementation](#implementation)
  - [Session Management](#session-management)
    - [JWT Token Structure](#jwt-token-structure)
      - [Example JWT Payload](#example-jwt-payload)
    - [Token Validation](#token-validation)
      - [API Token Validation](#api-token-validation)
      - [Frontend Token Validation](#frontend-token-validation)
    - [Session Expiration](#session-expiration)
    - [Refresh Tokens](#refresh-tokens)
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
      - [Dashboard Configuration](#dashboard-configuration)
    - [TOTP Implementation](#totp-implementation)
    - [Backup Codes](#backup-codes)
    - [User Experience](#user-experience)
  - [Webhooks](#webhooks)
    - [Clerk Webhook Events](#clerk-webhook-events)
      - [User Events](#user-events)
      - [Session Events](#session-events)
      - [Organization Events](#organization-events)
    - [Webhook Verification](#webhook-verification)
      - [Security Implementation](#security-implementation)
    - [User Sync to Database](#user-sync-to-database)
      - [Webhook Handler Implementation](#webhook-handler-implementation)
    - [Event Handling Examples](#event-handling-examples)
      - [`user.created` Event](#usercreated-event)
      - [`user.updated` Event](#userupdated-event)
      - [`user.deleted` Event](#userdeleted-event)
  - [Testing](#testing)
    - [Unit Testing with Mock Auth](#unit-testing-with-mock-auth)
      - [Test Environment Setup](#test-environment-setup)
      - [Mock Auth Middleware](#mock-auth-middleware)
    - [Integration Testing](#integration-testing)
      - [Authenticated Request Test](#authenticated-request-test)
      - [Unauthorized Request Test](#unauthorized-request-test)
    - [Testing Different Roles](#testing-different-roles)
  - [Security Best Practices](#security-best-practices)
    - [Token Storage](#token-storage)
    - [HTTPS Only](#https-only)
    - [CSRF Protection](#csrf-protection)
    - [Rate Limiting](#rate-limiting)
    - [Session Timeout](#session-timeout)
    - [Audit Logging](#audit-logging)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
      - [1. "Invalid token" Error](#1-invalid-token-error)
      - [2. CORS Errors](#2-cors-errors)
      - [3. Webhook Not Received](#3-webhook-not-received)
      - [4. Session Not Persisting](#4-session-not-persisting)
    - [Debug Mode](#debug-mode)
  - [Migration Guide](#migration-guide)
    - [From Custom Auth to Clerk](#from-custom-auth-to-clerk)
  - [References](#references)

## Overview

### Authentication vs Authorization

**Authentication** is the process of verifying WHO a user is:

- Confirms user identity
- Validates credentials
- Issues session tokens
- Manages login/logout

**Authorization** is the process of verifying WHAT a user can do:

- Checks user permissions
- Enforces access control
- Validates resource ownership
- Implements role-based access

### Clerk Integration Overview

Hospeda uses **Clerk** as the managed authentication provider:

**Features:**

- 🔐 Secure authentication with JWT tokens
- 🌐 OAuth providers (Google, GitHub, etc.)
- 📱 Multi-factor authentication (MFA)
- 🔄 User lifecycle webhooks
- 🎨 Customizable UI components
- 🛡️ Built-in security best practices

**Integration Points:**

- **API**: `@hono/clerk-auth` for Hono middleware
- **Web**: `@clerk/astro` for Astro integration
- **Admin**: `@clerk/tanstack-react-start` for TanStack Start

### Architecture Diagram

```mermaid
graph TB
    User[User Browser]
    Clerk[Clerk Service]
    API[API Server]
    Web[Web App]
    Admin[Admin App]
    DB[(Database)]

    User -->|1. Sign In/Up| Clerk
    Clerk -->|2. JWT Token| User
    User -->|3. Request + Token| Web
    User -->|3. Request + Token| Admin
    Web -->|4. API Call + Token| API
    Admin -->|4. API Call + Token| API
    API -->|5. Validate Token| Clerk
    Clerk -->|6. User Data| API
    API -->|7. Query/Update| DB
    Clerk -->|8. Webhooks| API
    API -->|9. Sync User| DB
```

**Flow:**

1. User authenticates with Clerk
2. Clerk issues JWT token
3. Frontend apps receive token
4. API receives requests with token
5. API validates token with Clerk
6. Clerk returns user data
7. API performs operations
8. Clerk sends webhooks on user events
9. API syncs user data to database

## Clerk Setup

### Account Configuration

#### 1. Create Clerk Account

Visit [clerk.com](https://clerk.com) and sign up:

```bash
# Navigate to dashboard
https://dashboard.clerk.com
```

#### 2. Create Application

```text
Application Name: Hospeda
Application Type: Standard
```

#### 3. Enable Features

In Dashboard → Settings:

- ✅ Email & Password
- ✅ OAuth Providers (Google, GitHub)
- ✅ Multi-factor Authentication
- ✅ Webhooks

### Application Setup

#### 1. Configure Domains

```text
Development:
  - http://localhost:3001 (API)
  - http://localhost:4321 (Web)
  - http://localhost:3000 (Admin)

Production:
  - https://api.hospeda.com
  - https://hospeda.com
  - https://admin.hospeda.com
```

#### 2. Set Allowed Origins

Dashboard → Settings → CORS:

```text
http://localhost:3000
http://localhost:3001
http://localhost:4321
https://hospeda.com
https://admin.hospeda.com
https://api.hospeda.com
```

#### 3. Configure Session Settings

Dashboard → Sessions:

```text
Session Duration: 7 days
Inactivity Timeout: 30 minutes
Multi-session: Enabled
```

### Social Providers

#### 1. Enable Google OAuth

Dashboard → Authentication → Social Connections → Google:

```text
✅ Enable Google
Client ID: [from Google Cloud Console]
Client Secret: [from Google Cloud Console]
```

#### 2. Enable GitHub OAuth

Dashboard → Authentication → Social Connections → GitHub:

```text
✅ Enable GitHub
Client ID: [from GitHub OAuth Apps]
Client Secret: [from GitHub OAuth Apps]
```

### Environment Variables

#### API Application

```env
# .env.local (API)

# Clerk Authentication
HOSPEDA_CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_HERE
HOSPEDA_CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx

# API Configuration
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_DATABASE_URL=postgresql://user:password@localhost:5432/hospeda

# Node Environment
NODE_ENV=development
```

#### Web Application (Astro)

```env
# .env.local (Web)

# Clerk Authentication
PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_HERE
CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE

# API URL
PUBLIC_API_URL=http://localhost:3001
```

#### Admin Application (TanStack Start)

```env
# .env.local (Admin)

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_HERE
CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE

# API URL
VITE_API_URL=http://localhost:3001
```

### Development vs Production

#### Development Mode

**Features:**

- Test keys (`pk_test_*`, `sk_test_*`)
- Local webhooks via ngrok
- Relaxed CORS
- Debug logging enabled

**Setup:**

```bash
# Install ngrok for local webhook testing
brew install ngrok  # macOS
# or
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3001

# Use ngrok URL for webhook endpoint
https://your-ngrok-url.ngrok.io/api/v1/auth/sync
```

#### Production Mode

**Features:**

- Live keys (`pk_live_*`, `sk_live_*`)
- Production webhooks
- Strict CORS
- Error logging only

**Environment:**

```env
# .env (Production)

NODE_ENV=production

# Clerk Production Keys
HOSPEDA_CLERK_SECRET_KEY=YOUR_SECRET_KEY_HERE
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY_HERE
HOSPEDA_CLERK_WEBHOOK_SECRET=whsec_live_xxxxxxxxxxxxxxxxxxxxxxxx

# Production URLs
HOSPEDA_API_URL=https://api.hospeda.com
```

## Authentication Flows

### Sign Up Flow

#### Email/Password Sign Up

**Frontend (React Component):**

```tsx
// Web: src/components/auth/SignUpFormWrapper.tsx
// Admin: src/routes/auth/signup.tsx

import { SignUp } from '@clerk/astro';

export function SignUpFormWrapper() {
  return (
    <SignUp
      path="/signup"
      routing="path"
      signInUrl="/signin"
      afterSignUpUrl="/dashboard"
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'shadow-lg'
        }
      }}
    />
  );
}
```

**Flow Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Clerk
    participant API
    participant DB

    User->>Frontend: Enter email/password
    Frontend->>Clerk: Sign up request
    Clerk->>Clerk: Validate & hash password
    Clerk->>User: Send verification email
    User->>Clerk: Click verification link
    Clerk->>Clerk: Create user account
    Clerk->>Frontend: Return session token
    Clerk->>API: Webhook: user.created
    API->>DB: Create user record
    Frontend->>User: Redirect to dashboard
```

#### OAuth Sign Up (Google)

**Frontend:**

```tsx
// Clerk automatically handles OAuth buttons

import { SignUp } from '@clerk/astro';

export function SignUpFormWrapper() {
  return (
    <SignUp
      path="/signup"
      routing="path"
      // OAuth buttons automatically included
    />
  );
}
```

**Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Clerk
    participant Google
    participant API
    participant DB

    User->>Frontend: Click "Sign up with Google"
    Frontend->>Clerk: Initiate OAuth
    Clerk->>Google: Redirect to Google
    User->>Google: Authorize Hospeda
    Google->>Clerk: Authorization code
    Clerk->>Google: Exchange for tokens
    Google->>Clerk: User profile
    Clerk->>Frontend: Return session token
    Clerk->>API: Webhook: user.created
    API->>DB: Create user record
    Frontend->>User: Redirect to dashboard
```

### Sign In Flow

#### Email/Password Sign In

**Frontend:**

```tsx
// Web: src/components/auth/SignInFormWrapper.tsx

import { SignIn } from '@clerk/astro';

export function SignInFormWrapper() {
  return (
    <SignIn
      path="/signin"
      routing="path"
      signUpUrl="/signup"
      afterSignInUrl="/dashboard"
    />
  );
}
```

**Backend Validation (API):**

```typescript
// apps/api/src/middlewares/auth.ts

import { clerkMiddleware } from '@hono/clerk-auth';

export const clerkAuth = () => {
  const secretKey = process.env.HOSPEDA_CLERK_SECRET_KEY || '';
  const publishableKey = process.env.HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

  if (process.env.NODE_ENV === 'production' && (!secretKey || !publishableKey)) {
    throw new Error('Clerk keys are required in production');
  }

  return clerkMiddleware({
    secretKey,
    publishableKey
  });
};
```

**Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Clerk
    participant API

    User->>Frontend: Enter credentials
    Frontend->>Clerk: Sign in request
    Clerk->>Clerk: Validate credentials
    Clerk->>Frontend: Return JWT token
    Frontend->>Frontend: Store token
    Frontend->>API: Request with token
    API->>Clerk: Validate token
    Clerk->>API: User data
    API->>Frontend: Protected data
```

#### OAuth Sign In

Same as OAuth Sign Up flow, but for existing users.

### OAuth Providers

#### Supported Providers

| Provider | Status | Configuration |
|----------|--------|---------------|
| Google | ✅ Enabled | OAuth 2.0 |
| GitHub | ✅ Enabled | OAuth 2.0 |
| Facebook | ⚪ Available | Not configured |
| Twitter | ⚪ Available | Not configured |
| Microsoft | ⚪ Available | Not configured |

#### Configuration Example (Google)

**1. Google Cloud Console:**

```text
1. Create project: "Hospeda"
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Set authorized redirect URIs:
   - https://accounts.clerk.dev/oauth/callback
   - http://localhost:3000/oauth/callback (dev)
```

**2. Clerk Dashboard:**

```text
Authentication → Social Connections → Google
- Enable Google
- Client ID: [paste from Google]
- Client Secret: [paste from Google]
- Scopes: email, profile, openid
```

**3. Test:**

```bash
# Navigate to sign-up page
http://localhost:4321/signup

# Click "Continue with Google"
# Should redirect to Google OAuth consent
```

### Magic Links

Magic links allow passwordless authentication via email.

#### Implementation

**1. Enable in Clerk Dashboard:**

```text
Authentication → Email & SMS → Email
✅ Enable Email Codes
✅ Enable Email Links
```

**2. Frontend:**

```tsx
// Automatically enabled in Clerk components

import { SignIn } from '@clerk/astro';

export function SignInFormWrapper() {
  return (
    <SignIn
      path="/signin"
      routing="path"
      // Magic link option automatically shown
    />
  );
}
```

**3. Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Clerk
    participant Email

    User->>Frontend: Click "Email me a link"
    Frontend->>Clerk: Request magic link
    Clerk->>Email: Send magic link email
    Email->>User: Magic link email
    User->>Clerk: Click magic link
    Clerk->>Frontend: Redirect with token
    Frontend->>User: Authenticated session
```

## Session Management

### JWT Token Structure

Clerk uses JWT (JSON Web Tokens) for session management.

#### Example JWT Payload

```json
{
  "azp": "https://hospeda.com",
  "exp": 1735689600,
  "iat": 1735603200,
  "iss": "https://clerk.hospeda.com",
  "nbf": 1735603190,
  "sid": "sess_2a1b3c4d5e6f7g8h9i0j",
  "sub": "user_2a1b3c4d5e6f7g8h9i0j",
  "email": "user@example.com",
  "email_verified": true,
  "first_name": "John",
  "last_name": "Doe",
  "metadata": {
    "role": "user",
    "permissions": ["accommodation:read"]
  }
}
```

**Claims:**

- `sub`: User ID
- `sid`: Session ID
- `exp`: Expiration timestamp
- `iat`: Issued at timestamp
- `email`: User email
- `metadata`: Custom user metadata (role, permissions)

### Token Validation

#### API Token Validation

```typescript
// apps/api/src/middlewares/auth.ts

import { getAuth } from '@hono/clerk-auth';
import type { Context } from 'hono';

export async function validateToken(c: Context) {
  const auth = getAuth(c);

  // Check if authenticated
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Token is valid, user is authenticated
  return auth;
}
```

**Usage in Routes:**

```typescript
// apps/api/src/routes/accommodation/create.ts

import { createOpenApiRoute } from '../../utils/route-factory';
import { getAuth } from '@hono/clerk-auth';

export const createAccommodationRoute = createOpenApiRoute({
  method: 'post',
  path: '/accommodations',
  summary: 'Create accommodation',
  handler: async (c, params, body) => {
    // Auth is automatically validated by middleware
    const auth = getAuth(c);

    if (!auth?.userId) {
      throw new Error('Unauthorized');
    }

    // Create accommodation
    const service = new AccommodationService(c);
    const result = await service.create(body);

    return result.data;
  }
  // Auth required by default
});
```

#### Frontend Token Validation

**Web (Astro):**

```typescript
// apps/web/src/middleware.ts

import { clerkMiddleware } from '@clerk/astro/server';

export const onRequest = clerkMiddleware();
```

**Admin (TanStack Start):**

```typescript
// apps/admin/src/routes/_authed.tsx

import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from '@clerk/tanstack-react-start';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const { isSignedIn } = useAuth();

    if (!isSignedIn) {
      throw redirect({
        to: '/auth/signin',
        search: {
          redirect: location.href
        }
      });
    }
  }
});
```

### Session Expiration

**Default Settings:**

- **Session Duration**: 7 days
- **Inactivity Timeout**: 30 minutes
- **Refresh Window**: Last 10% of session duration

**Automatic Refresh:**

Clerk automatically refreshes tokens in the background:

```typescript
// Clerk handles this automatically
// No manual implementation needed

// Token refresh happens when:
// 1. Session is in the last 10% of duration
// 2. User makes a request
// 3. Frontend is active
```

**Manual Refresh (if needed):**

```typescript
// Frontend (React)
import { useAuth } from '@clerk/astro';

function Component() {
  const { getToken } = useAuth();

  const refreshToken = async () => {
    // Force token refresh
    const token = await getToken({ template: 'default' });
    return token;
  };
}
```

### Refresh Tokens

Clerk manages refresh tokens automatically. No manual implementation required.

**How it works:**

1. Initial sign-in: Clerk issues access token + refresh token
2. Access token expires: Clerk uses refresh token to get new access token
3. Refresh token expires: User must sign in again

**Configuration:**

```text
Dashboard → Sessions → Advanced

Session Token Lifetime: 7 days
Refresh Token Lifetime: 30 days
Refresh Token Rotation: Enabled
```

### Session Invalidation

#### Manual Session Invalidation

**Backend (API):**

```typescript
// apps/api/src/routes/auth/signout.ts

import { createSimpleRoute } from '../../utils/route-factory';
import { clerkClient } from '@clerk/backend';

export const signOutRoute = createSimpleRoute({
  method: 'post',
  path: '/auth/signout',
  summary: 'Sign out user',
  handler: async (c) => {
    const auth = getAuth(c);

    if (!auth?.sessionId) {
      return { success: false, error: 'No active session' };
    }

    // Revoke session in Clerk
    await clerkClient.sessions.revokeSession(auth.sessionId);

    return { success: true, message: 'Signed out successfully' };
  }
});
```

**Frontend (React):**

```typescript
// Web/Admin

import { useClerk } from '@clerk/astro';

function SignOutButton() {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut();
    // Redirects to sign-in page
  };

  return <button onClick={handleSignOut}>Sign Out</button>;
}
```

**Invalidate All User Sessions:**

```typescript
// Admin only - revoke all sessions for a user

import { clerkClient } from '@clerk/backend';

async function revokeAllUserSessions(userId: string) {
  const sessions = await clerkClient.sessions.getSessionList({ userId });

  await Promise.all(
    sessions.map(session =>
      clerkClient.sessions.revokeSession(session.id)
    )
  );

  return { revoked: sessions.length };
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

import { getAuth } from '@hono/clerk-auth';
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
 * Actor middleware - extracts user from Clerk auth
 */
export const actorMiddleware = async (c: Context, next: Next) => {
  const auth = getAuth(c);

  if (!auth?.userId) {
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

  // Get user from Clerk
  const user = await clerkClient.users.getUser(auth.userId);

  // Extract role from metadata
  const role = (user.publicMetadata?.role as UserRole) || 'user';
  const permissions = getPermissionsForRole(role);

  // Authenticated actor
  c.set('actor', {
    isAuthenticated: true,
    userId: auth.userId,
    email: user.emailAddresses[0]?.emailAddress || null,
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

import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/accommodations/new',
  '/profile(.*)'
]);

export const onRequest = clerkMiddleware((auth, context) => {
  if (isProtectedRoute(context.request) && !auth().userId) {
    return auth().redirectToSignIn();
  }
});
```

**Page-Level Protection:**

```astro
---
// apps/web/src/pages/dashboard.astro

import { getAuth } from '@clerk/astro/server';

const auth = await getAuth(Astro);

if (!auth.userId) {
  return Astro.redirect('/signin');
}

const user = await currentUser();
---

<h1>Welcome, {user?.firstName}!</h1>
```

#### Frontend Route Protection (Admin - TanStack)

```typescript
// apps/admin/src/routes/_authed.tsx

import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from '@clerk/tanstack-react-start';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const { isSignedIn, userId } = useAuth();

    if (!isSignedIn) {
      throw redirect({
        to: '/auth/signin',
        search: {
          redirect: location.href
        }
      });
    }

    return { userId };
  }
});
```

**Role-Based Protection:**

```typescript
// apps/admin/src/routes/_authed/admin.tsx

import { createFileRoute, redirect } from '@tanstack/react-router';
import { useUser } from '@clerk/tanstack-react-start';

export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: async () => {
    const { user } = useUser();
    const role = user?.publicMetadata?.role;

    if (role !== 'admin') {
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

    // Check ownership (unless admin)
    if (existing.ownerId !== actor.userId && actor.role !== 'admin') {
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

#### Dashboard Configuration

```text
1. Navigate to Clerk Dashboard
2. User & Authentication → Multi-factor
3. Enable MFA:
   ✅ SMS (via Twilio)
   ✅ TOTP (Authenticator apps)
   ✅ Backup codes

1. MFA Policy:
   ○ Optional (user choice)
   ● Required for admins
   ○ Required for all users

1. SMS Provider (Twilio):
   Account SID: [from Twilio]
   Auth Token: [from Twilio]
   Phone Number: [from Twilio]
```

### TOTP Implementation

TOTP (Time-based One-Time Password) uses authenticator apps like Google Authenticator or Authy.

**Frontend (React):**

```tsx
// apps/admin/src/components/MfaSetup.tsx

import { useUser } from '@clerk/tanstack-react-start';

export function MfaSetup() {
  const { user } = useUser();

  const enableMfa = async () => {
    // Clerk handles MFA setup UI
    await user?.createTOTP();
    // User scans QR code with authenticator app
  };

  const verifyMfa = async (code: string) => {
    await user?.verifyTOTP({ code });
  };

  return (
    <div>
      {!user?.twoFactorEnabled ? (
        <button onClick={enableMfa}>Enable MFA</button>
      ) : (
        <p>MFA is enabled ✓</p>
      )}
    </div>
  );
}
```

**MFA Login Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Clerk
    participant Authenticator

    User->>Frontend: Enter email/password
    Frontend->>Clerk: Sign in request
    Clerk->>Frontend: Prompt for MFA code
    Frontend->>User: Show MFA input
    User->>Authenticator: Open app
    Authenticator->>User: Generate code
    User->>Frontend: Enter code
    Frontend->>Clerk: Verify code
    Clerk->>Frontend: Return session token
    Frontend->>User: Authenticated
```

### Backup Codes

Backup codes are one-time use codes for when the user loses access to their authenticator device.

**Generate Backup Codes:**

```tsx
// apps/admin/src/components/BackupCodes.tsx

import { useUser } from '@clerk/tanstack-react-start';
import { useState } from 'react';

export function BackupCodes() {
  const { user } = useUser();
  const [codes, setCodes] = useState<string[]>([]);

  const generateCodes = async () => {
    const backupCodes = await user?.createBackupCode();
    setCodes(backupCodes?.codes || []);
  };

  return (
    <div>
      <button onClick={generateCodes}>Generate Backup Codes</button>

      {codes.length > 0 && (
        <div>
          <h3>Save these codes in a safe place</h3>
          <ul>
            {codes.map((code, index) => (
              <li key={index}><code>{code}</code></li>
            ))}
          </ul>
          <p>Each code can only be used once.</p>
        </div>
      )}
    </div>
  );
}
```

**Use Backup Code:**

```tsx
// During login, if MFA code doesn't work

import { useSignIn } from '@clerk/tanstack-react-start';

export function MfaLogin() {
  const { signIn } = useSignIn();

  const useBackupCode = async (code: string) => {
    await signIn?.attemptSecondFactor({
      strategy: 'backup_code',
      code
    });
  };

  return (
    <div>
      <input placeholder="Backup code" />
      <button onClick={() => useBackupCode(code)}>Use Backup Code</button>
    </div>
  );
}
```

### User Experience

**Best Practices:**

1. **Optional by default**: Don't force all users to enable MFA
2. **Required for admins**: Enforce MFA for high-privilege accounts
3. **Clear instructions**: Guide users through setup process
4. **Backup codes**: Always provide backup codes
5. **Recovery options**: Allow account recovery if device is lost

**MFA Status Display:**

```tsx
// apps/admin/src/components/SecuritySettings.tsx

import { useUser } from '@clerk/tanstack-react-start';

export function SecuritySettings() {
  const { user } = useUser();

  return (
    <div className="security-settings">
      <h2>Security</h2>

      <div className="mfa-status">
        <h3>Multi-Factor Authentication</h3>
        {user?.twoFactorEnabled ? (
          <>
            <p className="enabled">✓ Enabled</p>
            <button onClick={disableMfa}>Disable MFA</button>
            <button onClick={viewBackupCodes}>View Backup Codes</button>
          </>
        ) : (
          <>
            <p className="disabled">✗ Disabled</p>
            <button onClick={enableMfa}>Enable MFA</button>
            <p className="warning">
              We recommend enabling MFA for better security
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

## Webhooks

Clerk sends webhooks when user events occur (creation, updates, deletion).

### Clerk Webhook Events

#### User Events

```typescript
// Webhook event types

type WebhookEvent =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'session.created'
  | 'session.ended'
  | 'session.revoked'
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted';
```

#### Session Events

- `session.created`: User signs in
- `session.ended`: User signs out
- `session.revoked`: Session manually revoked

#### Organization Events

- `organization.created`: New organization created
- `organization.updated`: Organization details updated
- `organization.deleted`: Organization deleted

### Webhook Verification

#### Security Implementation

```typescript
// apps/api/src/routes/auth/sync.ts

import { Webhook } from 'svix';
import type { Context } from 'hono';

/**
 * Verify webhook signature from Clerk
 */
function verifyWebhook(c: Context): boolean {
  const webhookSecret = process.env.HOSPEDA_CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('Webhook secret not configured');
  }

  // Get Svix headers
  const svixId = c.req.header('svix-id');
  const svixTimestamp = c.req.header('svix-timestamp');
  const svixSignature = c.req.header('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Verify signature
  const wh = new Webhook(webhookSecret);

  try {
    const body = await c.req.text();
    wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    });

    return true;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return false;
  }
}
```

### User Sync to Database

#### Webhook Handler Implementation

```typescript
// apps/api/src/routes/auth/sync.ts

import { createSimpleRoute } from '../../utils/route-factory';
import { Webhook } from 'svix';
import { UserModel } from '@repo/db';
import { apiLogger } from '../../utils/logger';

export const syncWebhookRoute = createSimpleRoute({
  method: 'post',
  path: '/auth/sync',
  summary: 'Clerk webhook handler',
  handler: async (c) => {
    // Verify webhook signature
    const isValid = verifyWebhook(c);

    if (!isValid) {
      return c.json({ error: 'Invalid webhook signature' }, 401);
    }

    // Parse webhook payload
    const payload = await c.req.json();
    const eventType = payload.type;
    const userData = payload.data;

    apiLogger.info({
      message: 'Webhook received',
      eventType,
      userId: userData.id
    });

    // Handle different event types
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(userData);
        break;

      case 'user.updated':
        await handleUserUpdated(userData);
        break;

      case 'user.deleted':
        await handleUserDeleted(userData);
        break;

      default:
        apiLogger.warn({
          message: 'Unknown webhook event type',
          eventType
        });
    }

    return { success: true };
  },
  options: {
    skipAuth: true // Webhooks don't use auth tokens
  }
});
```

### Event Handling Examples

#### `user.created` Event

```typescript
// apps/api/src/routes/auth/sync.ts

async function handleUserCreated(userData: any) {
  const userModel = new UserModel();

  // Extract user data
  const email = userData.email_addresses?.[0]?.email_address;
  const role = (userData.public_metadata?.role as UserRole) || 'user';

  // Create user in database
  await userModel.create({
    id: userData.id,
    clerkId: userData.id,
    email,
    firstName: userData.first_name,
    lastName: userData.last_name,
    role,
    emailVerified: userData.email_addresses?.[0]?.verification?.status === 'verified',
    createdAt: new Date(userData.created_at)
  });

  apiLogger.info({
    message: 'User created in database',
    userId: userData.id,
    email
  });
}
```

#### `user.updated` Event

```typescript
// apps/api/src/routes/auth/sync.ts

async function handleUserUpdated(userData: any) {
  const userModel = new UserModel();

  const email = userData.email_addresses?.[0]?.email_address;
  const role = (userData.public_metadata?.role as UserRole) || 'user';

  // Update user in database
  await userModel.update({
    id: userData.id,
    email,
    firstName: userData.first_name,
    lastName: userData.last_name,
    role,
    emailVerified: userData.email_addresses?.[0]?.verification?.status === 'verified',
    updatedAt: new Date()
  });

  apiLogger.info({
    message: 'User updated in database',
    userId: userData.id
  });
}
```

#### `user.deleted` Event

```typescript
// apps/api/src/routes/auth/sync.ts

async function handleUserDeleted(userData: any) {
  const userModel = new UserModel();

  // Soft delete user in database
  await userModel.softDelete({
    id: userData.id
  });

  apiLogger.info({
    message: 'User soft deleted in database',
    userId: userData.id
  });
}
```

## Testing

### Unit Testing with Mock Auth

#### Test Environment Setup

```env
# .env.test

NODE_ENV=test

# Disable Clerk auth validation in tests
API_VALIDATION_CLERK_AUTH_ENABLED=false

# Other test config
HOSPEDA_DATABASE_URL=postgresql://test:test@localhost:5432/hospeda_test
```

#### Mock Auth Middleware

```typescript
// apps/api/src/middlewares/auth.ts

export const clerkAuth = () => {
  // In test environment, use mock auth
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.API_VALIDATION_CLERK_AUTH_ENABLED === 'false'
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

      const mockAuth = hasValidToken
        ? { userId: 'test-user-id' }
        : { userId: null };

      c.set('clerkAuth', () => mockAuth as any);
      c.set('auth', mockAuth);

      await next();
    };
  }

  // Production: use real Clerk auth
  return clerkMiddleware({
    secretKey: process.env.HOSPEDA_CLERK_SECRET_KEY || '',
    publishableKey: process.env.HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
  });
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

### Token Storage

**✅ DO:**

```typescript
// Frontend - Store in httpOnly cookie (Clerk handles this)
// Token is automatically stored securely

// Access token via Clerk hooks
import { useAuth } from '@clerk/astro';

const { getToken } = useAuth();
const token = await getToken();
```

**❌ DON'T:**

```typescript
// Never store tokens in localStorage
localStorage.setItem('token', token); // INSECURE!

// Never store tokens in sessionStorage
sessionStorage.setItem('token', token); // INSECURE!

// Never expose tokens in URL
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

Clerk provides built-in CSRF protection via:

1. **SameSite cookies**: Prevents cross-site requests
2. **Origin validation**: Checks request origin
3. **Token rotation**: Rotates session tokens

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

**Configure in Clerk Dashboard:**

```text
Dashboard → Sessions → Settings

Session Duration: 7 days
Inactivity Timeout: 30 minutes
Multi-session: Enabled
```

**Implement Frontend Timeout:**

```typescript
// apps/web/src/utils/session-timeout.ts

import { useAuth } from '@clerk/astro';

export function useSessionTimeout() {
  const { signOut } = useAuth();
  let timeoutId: NodeJS.Timeout;

  const resetTimeout = () => {
    clearTimeout(timeoutId);

    // Sign out after 30 minutes of inactivity
    timeoutId = setTimeout(() => {
      signOut();
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

async function handleUserCreated(userData: any) {
  // Create user in database
  await userModel.create({ ... });

  // Log authentication event
  apiLogger.security({
    event: 'user.created',
    userId: userData.id,
    email: userData.email_addresses?.[0]?.email_address,
    ipAddress: userData.last_sign_in_ip,
    userAgent: userData.last_sign_in_user_agent,
    timestamp: new Date()
  });
}
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

#### 1. "Invalid token" Error

**Symptoms:**

```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

**Solutions:**

```bash
# Check token is being sent
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/v1/accommodations

# Verify Clerk keys are correct
echo $HOSPEDA_CLERK_SECRET_KEY

# Check token expiration
# Decode JWT at https://jwt.io

# Force token refresh (frontend)
const token = await getToken({ template: 'default' });
```

#### 2. CORS Errors

**Symptoms:**

```text
Access to fetch at 'http://localhost:3001' from origin 'http://localhost:4321'
has been blocked by CORS policy
```

**Solutions:**

```env
# .env - Add origin to allowed list

API_CORS_ORIGINS=http://localhost:3000,http://localhost:4321,http://localhost:3001
```

```typescript
// Verify CORS middleware is applied
// apps/api/src/app.ts

import { corsMiddleware } from './middlewares/cors';

app.use('*', corsMiddleware());
```

#### 3. Webhook Not Received

**Symptoms:**

- User created in Clerk but not in database
- No webhook logs in API

**Solutions:**

```bash
# 1. Check webhook endpoint is publicly accessible
curl -X POST https://api.hospeda.com/api/v1/auth/sync

# 2. Verify webhook secret
echo $HOSPEDA_CLERK_WEBHOOK_SECRET

# 3. Check Clerk Dashboard → Webhooks → Logs
# Look for failed deliveries

# 4. Use ngrok for local testing
ngrok http 3001
# Update webhook URL in Clerk Dashboard
```

**Test Webhook Locally:**

```bash
# Send test webhook
curl -X POST http://localhost:3001/api/v1/auth/sync \
  -H "Content-Type: application/json" \
  -H "svix-id: test-id" \
  -H "svix-timestamp: $(date +%s)" \
  -H "svix-signature: test-signature" \
  -d '{
    "type": "user.created",
    "data": {
      "id": "test-user-123",
      "email_addresses": [
        { "email_address": "test@example.com" }
      ]
    }
  }'
```

#### 4. Session Not Persisting

**Symptoms:**

- User signs in but gets signed out on refresh
- Session doesn't persist across tabs

**Solutions:**

```typescript
// Check cookie settings (Clerk handles this)
// Ensure cookies are allowed in browser

// Verify SameSite cookie policy
// Dashboard → Sessions → Cookies

// Check HTTPS in production
if (process.env.NODE_ENV === 'production') {
  // Cookies require Secure flag
  // Only works over HTTPS
}
```

### Debug Mode

**Enable Clerk Debug Logging:**

```typescript
// Frontend (React)

import { ClerkProvider } from '@clerk/astro';

<ClerkProvider
  publishableKey={import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY}
  debug={import.meta.env.DEV} // Enable debug in development
>
  {children}
</ClerkProvider>
```

**API Debug Logging:**

```env
# .env.local

API_LOG_LEVEL=debug
API_ENABLE_REQUEST_LOGGING=true
```

```typescript
// apps/api/src/middlewares/auth.ts

import { apiLogger } from '../utils/logger';

export const clerkAuth = () => {
  return clerkMiddleware({
    secretKey: process.env.HOSPEDA_CLERK_SECRET_KEY || '',
    publishableKey: process.env.HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
    onError: (error) => {
      apiLogger.error({
        message: 'Clerk authentication error',
        error: error.message,
        stack: error.stack
      });
    }
  });
};
```

## Migration Guide

### From Custom Auth to Clerk

#### Step 1: Install Clerk SDKs

```bash
# API
cd apps/api
pnpm add @clerk/backend @hono/clerk-auth svix

# Web
cd apps/web
pnpm add @clerk/astro

# Admin
cd apps/admin
pnpm add @clerk/tanstack-react-start
```

#### Step 2: Configure Environment Variables

See [Environment Variables](#environment-variables) section.

#### Step 3: Add Clerk Middleware

```typescript
// apps/api/src/app.ts

import { clerkAuth } from './middlewares/auth';
import { actorMiddleware } from './middlewares/actor';

app.use('*', clerkAuth());
app.use('*', actorMiddleware);
```

#### Step 4: Migrate User Data

```typescript
// Migration script: scripts/migrate-users-to-clerk.ts

import { clerkClient } from '@clerk/backend';
import { UserModel } from '@repo/db';

async function migrateUsers() {
  const userModel = new UserModel();
  const users = await userModel.findAll();

  for (const user of users) {
    // Create user in Clerk
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [user.email],
      firstName: user.firstName,
      lastName: user.lastName,
      password: 'TEMPORARY_PASSWORD', // User must reset
      publicMetadata: {
        role: user.role
      }
    });

    // Update database with Clerk ID
    await userModel.update({
      id: user.id,
      clerkId: clerkUser.id
    });

    // Send password reset email
    await clerkClient.users.sendPasswordResetEmail(user.email);
  }
}
```

#### Step 5: Update Frontend Components

```tsx
// Before (custom auth)
import { useAuth } from './hooks/useAuth';

function Component() {
  const { user, signIn, signOut } = useAuth();
}

// After (Clerk)
import { useAuth } from '@clerk/astro';

function Component() {
  const { user, signIn, signOut } = useAuth();
}
```

#### Step 6: Test Thoroughly

1. Test sign up flow
2. Test sign in flow
3. Test protected routes
4. Test role-based access
5. Test webhooks
6. Test session management

#### Step 7: Deploy

1. Update environment variables in production
2. Deploy API changes
3. Deploy frontend changes
4. Monitor logs for issues

## References

**Official Documentation:**

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk API Reference](https://clerk.com/docs/reference/backend-api)
- [@hono/clerk-auth](https://github.com/honojs/middleware/tree/main/packages/clerk-auth)
- [@clerk/astro](https://clerk.com/docs/references/astro/overview)
- [@clerk/tanstack-react-start](https://clerk.com/docs/references/react/overview)

**Related Hospeda Documentation:**

- [Security Overview](./overview.md)
- [API Protection](./api-protection.md)
- [Input Sanitization](./input-sanitization.md)
- [OWASP Top 10](./owasp-top-10.md)

**External Resources:**

- [JWT.io](https://jwt.io) - JWT token decoder
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
