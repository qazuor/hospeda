# Actor System

Authentication and authorization system using Clerk and the Actor pattern.

---

## Overview

The Actor System provides a unified way to handle authentication and authorization in the API.

**Key Concepts:**

- **Actor** - Represents the current user/requester
- **Authentication** - Who is the user? (via Clerk JWT)
- **Authorization** - What can the user do? (via roles & permissions)

---

## Actor Object

The actor object contains information about the current requester.

### Authenticated Actor

```typescript
{
  isAuthenticated: true,
  userId: string,           // Clerk user ID
  email: string,            // User's email
  role: string,             // User's role (e.g., 'admin', 'user')
  permissions: string[]     // User's permissions
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
    console.log(`Role: ${actor.role}`);
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
  const userId: string = actor.userId;
  const email: string = actor.email;
  const role: string = actor.role;
}
```

---

## Authentication

Authentication is handled by Clerk middleware.

### How it Works

1. Client includes JWT token in `Authorization` header
2. Clerk middleware validates token
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

### Role-Based Authorization

```typescript
const actor = getActorFromContext(c);

if (!actor.isAuthenticated) {
  return c.json({ error: 'Unauthorized' }, 401);
}

if (actor.role !== 'admin') {
  return c.json({ error: 'Forbidden' }, 403);
}

// User is admin
```

### Permission-Based Authorization

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

### Multiple Roles

```typescript
const allowedRoles = ['admin', 'manager'];

if (!allowedRoles.includes(actor.role)) {
  return c.json({ error: 'Forbidden' }, 403);
}
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

export const requireRole = (actor: Actor, role: string) => {
  requireAuth(actor);
  
  if (actor.role !== role) {
    throw new Error('Forbidden');
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
import { requireRole, requirePermission } from '../utils/auth-helpers';

export const adminRoute = createSimpleRoute({
  handler: async (c) => {
    const actor = getActorFromContext(c);
    
    try {
      requireRole(actor, 'admin');
    } catch (error) {
      return c.json({ error: error.message }, 403);
    }
    
    // User is admin
  }
});
```

---

## Roles & Permissions

### Standard Roles

- **`user`** - Default role for all authenticated users
- **`admin`** - Administrator with full access
- **`manager`** - Manager with extended permissions

### Permission Format

Permissions follow the format: `resource:action`

**Examples:**

- `accommodation:read` - Read accommodations
- `accommodation:write` - Create/update accommodations
- `accommodation:delete` - Delete accommodations
- `user:read` - Read users
- `user:write` - Create/update users
- `user:delete` - Delete users

### Setting Roles in Clerk

1. Go to Clerk Dashboard
2. Select user
3. Edit "Public metadata"
4. Add role and permissions:

```json
{
  "role": "admin",
  "permissions": [
    "accommodation:read",
    "accommodation:write",
    "accommodation:delete",
    "user:read",
    "user:write"
  ]
}
```

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
    
    if (actor.role !== 'admin') {
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
    if (actor.userId !== userId && actor.role !== 'admin') {
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
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
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
      createdBy: actor.userId
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
  userId: 'test-user-123',
  email: 'admin@test.com',
  role: 'admin',
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
const userId = actor.userId; // Might not exist!
```

### Use Helpers

```typescript
// ✅ Good - Use helpers
try {
  requireRole(actor, 'admin');
} catch (error) {
  return c.json({ error: error.message }, 403);
}

// ❌ Bad - Repeated checks
if (!actor.isAuthenticated) {
  return c.json({ error: 'Unauthorized' }, 401);
}
if (actor.role !== 'admin') {
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
  deletedBy: actor.userId,
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

**Cause**: Permissions not set in Clerk

**Solution**: Update user's public metadata in Clerk Dashboard

---

## Next Steps

- [Middleware System](middleware.md) - Understanding middleware
- [Creating Endpoints](creating-endpoints.md) - Using actor in routes
- [Authentication Guide](../usage/authentication.md) - Client-side authentication

---

⬅️ Back to [Development Guide](README.md)
