# Actor System

Authentication and authorization system using Better Auth and the Actor pattern.

---

## Overview

The Actor System provides a unified way to handle authentication and authorization in the API.

**Key Concepts:**

- **Actor** - Represents the current user/requester
- **Authentication** - Who is the user? (via Better Auth JWT)
- **Authorization** - What can the user do? (always via `permissions`, never via `roles` — see [Authorization](#authorization))

> **Multi-role actors (HOS-296).** An actor holds a SET of roles (backed by the
> `user_role` table), not a single scalar. One account can be `HOST` and
> `COMMERCE_OWNER` at the same time. `actor.permissions` is already the union
> of every held role's permissions plus per-user overrides, so authorization
> code should almost never need to inspect `actor.roles` directly — check
> `actor.permissions` instead.

---

## Actor Object

The actor object contains information about the current requester.

### Authenticated Actor

```typescript
{
  isAuthenticated: true,
  id: string,                    // Better Auth user ID
  email: string,                 // User's email
  roles: readonly RoleEnum[],    // Every role the actor holds (HOS-296) — e.g. [RoleEnum.HOST]
  permissions: readonly PermissionEnum[] // Union of permissions across all held roles + overrides
}
```

### Unauthenticated Actor

```typescript
{
  isAuthenticated: false
}
```

---

## Getting the Actor

### In Route Handlers

```typescript
import { getActorFromContext } from '../middlewares/actor';

export const myRoute = createSimpleRoute({
  handler: async (c) => {
    const actor = getActorFromContext(c);
    
    if (!actor.isAuthenticated) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log(`User: ${actor.email}`);
    console.log(`Roles: ${actor.roles.join(', ')}`);
    console.log(`Permissions:`, actor.permissions);
    
    // Use actor data...
  }
});
```

### Type-Safe Access

```typescript
import type { Actor } from '../middlewares/actor';

const actor: Actor = getActorFromContext(c);

if (actor.isAuthenticated) {
  // TypeScript knows these properties exist
  const id: string = actor.id;
  const email: string = actor.email;
  const roles: readonly RoleEnum[] = actor.roles;
}
```

---

## Authentication

Authentication is handled by Better Auth middleware.

### How it Works

1. Client includes JWT token in `Authorization` header
2. Better Auth middleware validates token
3. Actor middleware extracts user info
4. Actor is available in route handler

### Public Routes

Skip authentication for public routes:

```typescript
export const publicRoute = createSimpleRoute({
  // ...
  options: { skipAuth: true }
});
```

### Protected Routes

Authentication required by default:

```typescript
export const protectedRoute = createOpenApiRoute({
  // ...
  // Auth required automatically
});
```

### Checking Authentication

```typescript
const actor = getActorFromContext(c);

if (!actor.isAuthenticated) {
  return c.json({
    error: 'Authentication required'
  }, 401);
}

// User is authenticated
```

---

## Authorization

Authorization checks what authenticated users can do.

### Permission-Based Authorization

Hospeda authorizes exclusively on `actor.permissions`. **Never compare
`actor.roles` to decide what an actor may do** — a role can grant a
permission through several paths (direct role grant, per-user override), and
gating on the role name directly bypasses that resolution and breaks for any
actor who holds the permission through a different role than the one you
hardcoded.

```typescript
const actor = getActorFromContext(c);

if (!actor.isAuthenticated) {
  return c.json({ error: 'Unauthorized' }, 401);
}

if (!actor.permissions.includes('accommodation:write')) {
  return c.json({ error: 'Forbidden' }, 403);
}

// User has write permission
```

### Multiple Permissions

```typescript
const requiredPermissions = ['user:read', 'user:write'];

const hasAllPermissions = requiredPermissions.every(
  perm => actor.permissions.includes(perm)
);

if (!hasAllPermissions) {
  return c.json({ error: 'Forbidden' }, 403);
}
```

---

## Helper Functions

### Creating Authorization Helpers

```typescript
// src/utils/auth-helpers.ts

export const requireAuth = (actor: Actor) => {
  if (!actor.isAuthenticated) {
    throw new Error('Authentication required');
  }
};

export const requirePermission = (actor: Actor, permission: string) => {
  requireAuth(actor);
  
  if (!actor.permissions.includes(permission)) {
    throw new Error('Forbidden');
  }
};

export const requireAnyPermission = (actor: Actor, permissions: string[]) => {
  requireAuth(actor);
  
  const hasAny = permissions.some(p => actor.permissions.includes(p));
  
  if (!hasAny) {
    throw new Error('Forbidden');
  }
};

export const requireAllPermissions = (actor: Actor, permissions: string[]) => {
  requireAuth(actor);
  
  const hasAll = permissions.every(p => actor.permissions.includes(p));
  
  if (!hasAll) {
    throw new Error('Forbidden');
  }
};
```

### Using Helpers

```typescript
import { requirePermission } from '../utils/auth-helpers';

export const adminRoute = createSimpleRoute({
  handler: async (c) => {
    const actor = getActorFromContext(c);
    
    try {
      requirePermission(actor, 'accommodation:write');
    } catch (error) {
      return c.json({ error: error.message }, 403);
    }
    
    // Actor has the required permission
  }
});
```

---

## Roles & Permissions

### Standard Roles

Defined in `RoleEnum` (`@repo/schemas`) — an actor can hold several of these
at once (HOS-296), e.g. `HOST` + `COMMERCE_OWNER`:

- **`SUPER_ADMIN`** - Every permission, including system-level actions
- **`ADMIN`** - Almost everything except editing accommodation info directly
- **`CLIENT_MANAGER`** - Client accounts, billing, subscriptions, analytics
- **`EDITOR`** - Create/edit/publish events and posts only
- **`HOST`** - Owner of an accommodation, can only edit their own
- **`COMMERCE_OWNER`** - Owner of a commerce listing (gastronomy, experience, etc.)
- **`SPONSOR`** - External sponsor of events/posts, limited dashboard access
- **`USER`** - Default role for all logged-in users of the public portal
- **`GUEST`** - Public, not logged in
- **`SYSTEM`** - Reserved non-loginable account for automated writes

### Permission Format

Permissions follow the format: `resource:action`

**Examples:**

- `accommodation:read` - Read accommodations
- `accommodation:write` - Create/update accommodations
- `accommodation:delete` - Delete accommodations
- `user:read` - Read users
- `user:write` - Create/update users
- `user:delete` - Delete users

### Granting and Revoking Roles

Roles are NOT edited via Better Auth metadata — they live in the `user_role`
table (HOS-296), one row per `(userId, role)` pair, and are mutated
exclusively through `grantRole` / `revokeRole`
(`packages/service-core/src/services/user-role/user-role.service.ts`):

- **`grantRole`** — additive and idempotent; granting a role the user already
  holds is a no-op. Writes an audit row (`user_role_audit`) on every actual
  change.
- **`revokeRole`** — refuses to remove a user's last remaining role, so an
  account can never end up with an empty role set.

Both are gated by permission checks (`canAssignRole` / equivalent), never by
comparing the caller's own role. Read a user's current roles with
`getUserRoles({ userId })`.

---

## Common Patterns

### Admin-Only Route

```typescript
export const adminRoute = createSimpleRoute({
  handler: async (c) => {
    const actor = getActorFromContext(c);
    
    if (!actor.isAuthenticated) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    if (!actor.permissions.includes(PermissionEnum.ACCESS_PANEL_ADMIN)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    // Admin logic...
  }
});
```

### Owner-Only Access

```typescript
export const updateProfileRoute = createOpenApiRoute({
  handler: async (c, params, body) => {
    const actor = getActorFromContext(c);
    const { userId } = params;
    
    if (!actor.isAuthenticated) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Check if user is updating their own profile
    if (actor.id !== userId && !actor.permissions.includes(PermissionEnum.USER_UPDATE_ANY)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    // Update profile...
  }
});
```

### Permission-Based CRUD

```typescript
// Read (public)
export const listRoute = createListRoute({
  options: { skipAuth: true }
});

// Create (requires write permission)
export const createRoute = createOpenApiRoute({
  handler: async (c, params, body) => {
    const actor = getActorFromContext(c);
    
    if (!actor.permissions.includes('accommodation:write')) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    // Create...
  }
});

// Delete (requires delete permission)
export const deleteRoute = createOpenApiRoute({
  handler: async (c, params) => {
    const actor = getActorFromContext(c);
    
    if (!actor.permissions.includes('accommodation:delete')) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    // Delete...
  }
});
```

### Audit Logging

```typescript
export const sensitiveRoute = createSimpleRoute({
  handler: async (c) => {
    const actor = getActorFromContext(c);
    
    // Log who performed the action
    logger.info('Sensitive action performed', {
      userId: actor.id,
      email: actor.email,
      roles: actor.roles,
      timestamp: new Date().toISOString()
    });
    
    // Perform action...
  }
});
```

---

## Integration with Services

Services can access actor information via context:

```typescript
// In service
export class AccommodationService extends BaseCrudService {
  async create(data: CreateAccommodation) {
    const actor = getActorFromContext(this.context);
    
    // Add created_by info
    const result = await this.model.create({
      ...data,
      createdBy: actor.id
    });
    
    return result;
  }
}
```

---

## Testing with Actor

### Mock Actor

```typescript
import { describe, it, expect } from 'vitest';

// Mock authenticated admin
const mockAdminActor = {
  isAuthenticated: true,
  id: 'test-user-123',
  email: 'admin@test.com',
  roles: [RoleEnum.ADMIN],
  permissions: ['accommodation:read', 'accommodation:write']
};

// Mock unauthenticated actor
const mockUnauthenticatedActor = {
  isAuthenticated: false
};

describe('Protected Route', () => {
  it('should allow admin access', async () => {
    // Set up test with mock admin actor
    // ...
  });
  
  it('should deny unauthenticated access', async () => {
    // Set up test with unauthenticated actor
    // ...
  });
});
```

---

## Best Practices

### Always Check Authentication

```typescript
// ✅ Good - Always check first
const actor = getActorFromContext(c);
if (!actor.isAuthenticated) {
  return c.json({ error: 'Unauthorized' }, 401);
}

// ❌ Bad - Assuming authentication
const id = actor.id; // Might not exist!
```

### Use Helpers

```typescript
// ✅ Good - Use helpers
try {
  requirePermission(actor, 'accommodation:write');
} catch (error) {
  return c.json({ error: error.message }, 403);
}

// ❌ Bad - Repeated checks
if (!actor.isAuthenticated) {
  return c.json({ error: 'Unauthorized' }, 401);
}
if (!actor.permissions.includes('accommodation:write')) {
  return c.json({ error: 'Forbidden' }, 403);
}
```

### Fail Securely

```typescript
// ✅ Good - Deny by default
if (!actor.permissions.includes('sensitive:action')) {
  return c.json({ error: 'Forbidden' }, 403);
}

// ❌ Bad - Allow by default
if (actor.permissions.includes('sensitive:action')) {
  // Allow...
}
// What if permissions check fails? Allows access!
```

### Audit Important Actions

```typescript
// ✅ Good - Log sensitive actions
logger.info('User deleted', {
  deletedUserId: params.id,
  deletedBy: actor.id,
  timestamp: new Date()
});
```

---

## Troubleshooting

### Actor is undefined

**Cause**: Actor middleware not registered

**Solution**: Ensure actor middleware is registered in app setup

### Actor not authenticated

**Cause**: Missing or invalid JWT token

**Solution**: Check `Authorization` header format: `Bearer <token>`

### Permissions not working

**Cause**: The actor's role set (`user_role` table) doesn't grant the permission required

**Solution**: Check the actor's roles with `getUserRoles({ userId })` and grant the missing one via `grantRole` (see [Granting and Revoking Roles](#granting-and-revoking-roles))

---

## Next Steps

- [Middleware System](middleware.md) - Understanding middleware
- [Creating Endpoints](creating-endpoints.md) - Using actor in routes
- [Authentication Guide](../usage/authentication.md) - Client-side authentication

---

⬅️ Back to [Development Guide](README.md)
