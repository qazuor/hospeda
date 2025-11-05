# Permission System - Deep Dive

Complete guide to the permission system in Hospeda services.

## Table of Contents

- [Overview](#overview)
- [Permission System Architecture](#permission-system-architecture)
- [Actor Type](#actor-type)
- [Permission String Format](#permission-string-format)
- [The 9 Permission Hooks](#the-9-permission-hooks)
- [Implementation Patterns](#implementation-patterns)
- [Permission Scenarios](#permission-scenarios)
- [Permission Helpers](#permission-helpers)
- [Testing Permissions](#testing-permissions)
- [Best Practices](#best-practices)

## Overview

The permission system in Hospeda services provides fine-grained access control at the service layer. Every operation checks permissions before execution, ensuring data security and proper access control.

**Key Concepts:**

- **Actor**: Represents the user or system performing an action
- **Permission Hooks**: Abstract methods that enforce access control
- **Permission Strings**: Standardized format for permission identifiers
- **Role-Based + Resource-Based**: Supports both role and resource-level permissions

**Why It Matters:**

- **Security**: Centralized permission checks prevent unauthorized access
- **Audit Trail**: Every operation knows who performed it
- **Flexibility**: Supports complex permission scenarios (ownership, hierarchies, etc.)
- **Type Safety**: TypeScript ensures proper permission handling

## Permission System Architecture

```
Request
   ↓
Actor (userId, role, permissions)
   ↓
Service Method
   ↓
Permission Hook (_canXxx)
   ↓
Business Logic (if authorized)
   ↓
Response
```

**Flow:**

1. Client sends request with authentication token
2. Middleware extracts user information → creates `Actor`
3. Service method receives `Actor` as first parameter
4. Permission hook validates `Actor` against business rules
5. If authorized → proceed; if not → throw `FORBIDDEN` error

## Actor Type

The `Actor` type represents who is performing an action.

```typescript
/**
 * Represents a user or system performing an action
 */
type Actor = {
  /** Unique user identifier (empty string for guests) */
  id: string;

  /** User's role */
  role: RoleEnum;

  /** Array of granted permissions */
  permissions: PermissionEnum[];
};
```

### Role Enum

```typescript
enum RoleEnum {
  GUEST = 'GUEST',           // Non-authenticated users
  USER = 'USER',             // Authenticated regular users
  ADMIN = 'ADMIN',           // Administrators
  SUPER_ADMIN = 'SUPER_ADMIN' // Super administrators
}
```

**Role Hierarchy:**

```
SUPER_ADMIN > ADMIN > USER > GUEST
```

### Permission Enum

```typescript
enum PermissionEnum {
  // Article permissions
  ARTICLE_CREATE = 'ARTICLE_CREATE',
  ARTICLE_UPDATE = 'ARTICLE_UPDATE',
  ARTICLE_UPDATE_ANY = 'ARTICLE_UPDATE_ANY',
  ARTICLE_DELETE = 'ARTICLE_DELETE',
  ARTICLE_DELETE_ANY = 'ARTICLE_DELETE_ANY',

  // Product permissions
  PRODUCT_CREATE = 'PRODUCT_CREATE',
  PRODUCT_UPDATE = 'PRODUCT_UPDATE',
  // ... etc
}
```

### Creating Actors

**From Authentication Middleware:**

```typescript
// Hono middleware example
app.use('*', async (c, next) => {
  const userId = c.get('clerk').userId;
  const user = await getUserFromDatabase(userId);

  // Create actor
  const actor: Actor = {
    id: userId || '',
    role: user?.role || RoleEnum.GUEST,
    permissions: user?.permissions || []
  };

  c.set('actor', actor);
  await next();
});
```

**Test Actors:**

```typescript
// Admin actor for tests
const adminActor: Actor = {
  id: 'admin-123',
  role: RoleEnum.ADMIN,
  permissions: [
    PermissionEnum.ARTICLE_CREATE,
    PermissionEnum.ARTICLE_UPDATE_ANY,
    PermissionEnum.ARTICLE_DELETE_ANY
  ]
};

// Regular user actor
const userActor: Actor = {
  id: 'user-456',
  role: RoleEnum.USER,
  permissions: [PermissionEnum.ARTICLE_CREATE]
};

// Guest actor (non-authenticated)
const guestActor: Actor = {
  id: '',
  role: RoleEnum.GUEST,
  permissions: []
};
```

## Permission String Format

Permissions follow the `ACTION:RESOURCE` or `RESOURCE_ACTION` format:

**Pattern 1: Colon Notation**
```
action:resource
create:article
update:article
delete:article
```

**Pattern 2: Underscore Notation (Preferred)**
```
RESOURCE_ACTION
ARTICLE_CREATE
ARTICLE_UPDATE
ARTICLE_DELETE
```

**Modifiers:**
- `_ANY`: Permission applies to all resources (not just owned)
- `_OWN`: Explicit ownership restriction

**Examples:**
```typescript
ARTICLE_UPDATE      // Update own articles
ARTICLE_UPDATE_ANY  // Update any article (including others')
ARTICLE_DELETE      // Delete own articles
ARTICLE_DELETE_ANY  // Delete any article
```

## The 9 Permission Hooks

Every service must implement 9 abstract permission hooks.

### 1. _canCreate

**Purpose:** Check if actor can create a new entity

**When Called:** Before entity creation, after input validation

**Parameters:**
- `actor: Actor` - User performing the action
- `data: z.infer<TCreateSchema>` - Validated creation data

**Signature:**
```typescript
protected abstract _canCreate(
  actor: Actor,
  data: z.infer<TCreateSchema>
): Promise<void> | void
```

**Example:**
```typescript
protected _canCreate(actor: Actor, data: unknown): void {
  // Check authentication
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required to create articles'
    );
  }

  // Check permission
  if (!actor.permissions.includes(PermissionEnum.ARTICLE_CREATE)) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You do not have permission to create articles'
    );
  }

  // Optional: Check data-based rules
  // e.g., only admins can create featured articles
  if ((data as any).isFeatured && actor.role !== RoleEnum.ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Only admins can create featured articles'
    );
  }
}
```

### 2. _canUpdate

**Purpose:** Check if actor can update an existing entity

**When Called:** After entity is fetched, before update is applied

**Parameters:**
- `actor: Actor` - User performing the action
- `entity: TEntity` - The entity being updated

**Signature:**
```typescript
protected abstract _canUpdate(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

**Example:**
```typescript
protected _canUpdate(actor: Actor, entity: Article): void {
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
  }

  const isOwner = entity.createdById === actor.id;
  const isAdmin = actor.role === RoleEnum.ADMIN;
  const hasUpdateAny = actor.permissions.includes(PermissionEnum.ARTICLE_UPDATE_ANY);

  // Owner can update their own, admins can update any, or explicit permission
  if (!isOwner && !isAdmin && !hasUpdateAny) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only update your own articles'
    );
  }
}
```

### 3. _canSoftDelete

**Purpose:** Check if actor can soft delete (mark as deleted)

**When Called:** After entity is fetched, before soft delete

**Parameters:**
- `actor: Actor` - User performing the action
- `entity: TEntity` - The entity being deleted

**Signature:**
```typescript
protected abstract _canSoftDelete(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

**Example:**
```typescript
protected _canSoftDelete(actor: Actor, entity: Article): void {
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
  }

  const isOwner = entity.createdById === actor.id;
  const isAdmin = actor.role === RoleEnum.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only delete your own articles'
    );
  }
}
```

### 4. _canHardDelete

**Purpose:** Check if actor can permanently delete

**When Called:** After entity is fetched, before permanent deletion

**Parameters:**
- `actor: Actor` - User performing the action
- `entity: TEntity` - The entity being permanently deleted

**Signature:**
```typescript
protected abstract _canHardDelete(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

**Example:**
```typescript
protected _canHardDelete(actor: Actor, entity: Article): void {
  // Only super admins can permanently delete
  if (actor.role !== RoleEnum.SUPER_ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Only super administrators can permanently delete articles'
    );
  }
}
```

### 5. _canRestore

**Purpose:** Check if actor can restore a soft-deleted entity

**When Called:** After entity is fetched, before restoration

**Parameters:**
- `actor: Actor` - User performing the action
- `entity: TEntity` - The entity being restored

**Signature:**
```typescript
protected abstract _canRestore(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

**Example:**
```typescript
protected _canRestore(actor: Actor, entity: Article): void {
  // Only admins can restore deleted content
  if (actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Only administrators can restore articles'
    );
  }
}
```

### 6. _canView

**Purpose:** Check if actor can view a specific entity

**When Called:** After entity is fetched, before returning to caller

**Parameters:**
- `actor: Actor` - User performing the action
- `entity: TEntity` - The entity being viewed

**Signature:**
```typescript
protected abstract _canView(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

**Example:**
```typescript
protected _canView(actor: Actor, entity: Article): void {
  // Published articles are public
  if (entity.status === 'published') {
    return;
  }

  // Draft/archived articles require authentication
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required to view unpublished articles'
    );
  }

  // Check ownership or admin role
  const isOwner = entity.createdById === actor.id;
  const isAdmin = actor.role === RoleEnum.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only view your own draft articles'
    );
  }
}
```

### 7. _canList

**Purpose:** Check if actor can list entities (general permission)

**When Called:** Before querying database for list

**Parameters:**
- `actor: Actor` - User performing the action

**Signature:**
```typescript
protected abstract _canList(actor: Actor): Promise<void> | void
```

**Example:**
```typescript
protected _canList(actor: Actor): void {
  // Public operation - anyone can list (filtering happens elsewhere)
  // Or require authentication:
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required to list articles'
    );
  }
}
```

### 8. _canSearch

**Purpose:** Check if actor can search entities

**When Called:** Before executing search query

**Parameters:**
- `actor: Actor` - User performing the action

**Signature:**
```typescript
protected abstract _canSearch(actor: Actor): Promise<void> | void
```

**Example:**
```typescript
protected _canSearch(actor: Actor): void {
  // Public search allowed
  // Filtering by visibility happens in _executeSearch
}
```

### 9. _canCount

**Purpose:** Check if actor can count entities

**When Called:** Before executing count query

**Parameters:**
- `actor: Actor` - User performing the action

**Signature:**
```typescript
protected abstract _canCount(actor: Actor): Promise<void> | void
```

**Example:**
```typescript
protected _canCount(actor: Actor): void {
  // Public operation
}
```

## Implementation Patterns

### Pattern 1: Role-Based Permissions

Simple role checking:

```typescript
protected _canCreate(actor: Actor, data: unknown): void {
  if (actor.role !== RoleEnum.ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Only administrators can create products'
    );
  }
}
```

### Pattern 2: Permission-Based

Check for specific permission:

```typescript
protected _canCreate(actor: Actor, data: unknown): void {
  if (!actor.permissions.includes(PermissionEnum.PRODUCT_CREATE)) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Permission denied: PRODUCT_CREATE required'
    );
  }
}
```

### Pattern 3: Ownership-Based

Check if user owns the resource:

```typescript
protected _canUpdate(actor: Actor, entity: Article): void {
  const isOwner = entity.createdById === actor.id;

  if (!isOwner) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only update your own articles'
    );
  }
}
```

### Pattern 4: Hybrid (Role + Permission)

Combine multiple checks:

```typescript
protected _canUpdate(actor: Actor, entity: Article): void {
  const isAdmin = actor.role === RoleEnum.ADMIN;
  const hasPermission = actor.permissions.includes(PermissionEnum.ARTICLE_UPDATE_ANY);

  if (!isAdmin && !hasPermission) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Administrator role or ARTICLE_UPDATE_ANY permission required'
    );
  }
}
```

### Pattern 5: Ownership OR Admin

Most common pattern:

```typescript
protected _canDelete(actor: Actor, entity: Article): void {
  const isOwner = entity.createdById === actor.id;
  const isAdmin = actor.role === RoleEnum.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only delete your own articles or be an administrator'
    );
  }
}
```

### Pattern 6: Resource-Based (Visibility)

Check entity properties:

```typescript
protected _canView(actor: Actor, entity: Article): void {
  // Public articles: everyone can view
  if (entity.visibility === VisibilityEnum.PUBLIC) {
    return;
  }

  // Private articles: authentication required
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
  }

  // Private: only owner and admins
  if (entity.visibility === VisibilityEnum.PRIVATE) {
    const isOwner = entity.createdById === actor.id;
    const isAdmin = actor.role === RoleEnum.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Access denied');
    }
  }
}
```

## Permission Scenarios

### Scenario 1: Public Resources

Articles that everyone can read, but only authenticated users can create:

```typescript
// Anyone can view published articles
protected _canView(actor: Actor, entity: Article): void {
  if (entity.status === 'published') {
    return; // No restrictions
  }

  // Drafts require authentication + ownership
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }

  if (entity.createdById !== actor.id) {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not your article');
  }
}

// Authenticated users can create
protected _canCreate(actor: Actor, data: unknown): void {
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required to create');
  }
}

// Anyone can list (published only via filtering)
protected _canList(actor: Actor): void {
  // No restrictions - filtering happens in _executeSearch
}
```

### Scenario 2: User-Owned Resources

Resources that belong to specific users:

```typescript
// Owner can update
protected _canUpdate(actor: Actor, entity: UserProfile): void {
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }

  if (entity.userId !== actor.id) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only update your own profile'
    );
  }
}

// Owner can view
protected _canView(actor: Actor, entity: UserProfile): void {
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }

  if (entity.userId !== actor.id && actor.role !== RoleEnum.ADMIN) {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not your profile');
  }
}
```

### Scenario 3: Admin-Only Resources

Resources only admins can manage:

```typescript
protected _canCreate(actor: Actor, data: unknown): void {
  if (actor.role !== RoleEnum.ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Only administrators can create system configurations'
    );
  }
}

protected _canUpdate(actor: Actor, entity: Config): void {
  if (actor.role !== RoleEnum.ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Only administrators can update system configurations'
    );
  }
}
```

### Scenario 4: Hierarchical Organizations

Organization members with different permission levels:

```typescript
protected async _canUpdate(actor: Actor, entity: Document): Promise<void> {
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }

  // Get user's organization membership
  const membership = await this.orgModel.getMembership(actor.id, entity.organizationId);

  if (!membership) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You are not a member of this organization'
    );
  }

  // Check role within organization
  const canEdit = ['owner', 'admin', 'editor'].includes(membership.role);

  if (!canEdit) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Insufficient permissions within organization'
    );
  }
}
```

## Permission Helpers

Create reusable permission checking functions:

```typescript
/**
 * Check if actor is authenticated
 */
function assertAuthenticated(actor: Actor): void {
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required'
    );
  }
}

/**
 * Check if actor has a specific permission
 */
function assertHasPermission(actor: Actor, permission: PermissionEnum): void {
  if (!actor.permissions.includes(permission)) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      `Permission required: ${permission}`
    );
  }
}

/**
 * Check if actor is admin
 */
function assertIsAdmin(actor: Actor): void {
  if (actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Administrator access required'
    );
  }
}

/**
 * Check if actor owns the resource
 */
function assertIsOwner<T extends { createdById: string }>(
  actor: Actor,
  entity: T
): void {
  if (entity.createdById !== actor.id) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You do not own this resource'
    );
  }
}

/**
 * Check if actor is owner OR admin
 */
function assertIsOwnerOrAdmin<T extends { createdById: string }>(
  actor: Actor,
  entity: T
): void {
  const isOwner = entity.createdById === actor.id;
  const isAdmin = actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Access denied: must be owner or administrator'
    );
  }
}

// Usage in hooks
protected _canUpdate(actor: Actor, entity: Article): void {
  assertAuthenticated(actor);
  assertIsOwnerOrAdmin(actor, entity);
}
```

## Testing Permissions

Test every permission hook thoroughly:

```typescript
describe('ArticleService Permissions', () => {
  let service: ArticleService;

  const adminActor: Actor = {
    id: 'admin-1',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ARTICLE_UPDATE_ANY]
  };

  const ownerActor: Actor = {
    id: 'user-1',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ARTICLE_CREATE]
  };

  const otherActor: Actor = {
    id: 'user-2',
    role: RoleEnum.USER,
    permissions: []
  };

  const guestActor: Actor = {
    id: '',
    role: RoleEnum.GUEST,
    permissions: []
  };

  describe('_canCreate', () => {
    it('should allow authenticated users with permission', async () => {
      const data = { title: 'Test', content: 'Content', categoryId: 'cat-1' };

      const result = await service.create(ownerActor, data);

      expect(result.data).toBeDefined();
    });

    it('should deny guest users', async () => {
      const data = { title: 'Test', content: 'Content', categoryId: 'cat-1' };

      const result = await service.create(guestActor, data);

      expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });
  });

  describe('_canUpdate', () => {
    it('should allow owner to update own article', async () => {
      const article = await createTestArticle(ownerActor);

      const result = await service.update(ownerActor, article.id, {
        title: 'Updated'
      });

      expect(result.data).toBeDefined();
    });

    it('should deny other users from updating', async () => {
      const article = await createTestArticle(ownerActor);

      const result = await service.update(otherActor, article.id, {
        title: 'Updated'
      });

      expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should allow admins to update any article', async () => {
      const article = await createTestArticle(ownerActor);

      const result = await service.update(adminActor, article.id, {
        title: 'Admin Update'
      });

      expect(result.data).toBeDefined();
    });
  });

  describe('_canView', () => {
    it('should allow anyone to view published articles', async () => {
      const article = await createPublishedArticle();

      const result = await service.getById(guestActor, article.id);

      expect(result.data).toBeDefined();
    });

    it('should deny guests from viewing drafts', async () => {
      const article = await createDraftArticle(ownerActor);

      const result = await service.getById(guestActor, article.id);

      expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });

    it('should allow owner to view own drafts', async () => {
      const article = await createDraftArticle(ownerActor);

      const result = await service.getById(ownerActor, article.id);

      expect(result.data).toBeDefined();
    });
  });
});
```

## Best Practices

### 1. Always Check Authentication First

```typescript
protected _canUpdate(actor: Actor, entity: Article): void {
  // ✅ Check auth first
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }

  // Then check specific permissions
  if (entity.createdById !== actor.id) {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not your article');
  }
}
```

### 2. Use Specific Error Messages

```typescript
// ❌ Generic message
throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Access denied');

// ✅ Specific, helpful message
throw new ServiceError(
  ServiceErrorCode.FORBIDDEN,
  'You do not have permission to update articles. Required permission: ARTICLE_UPDATE'
);
```

### 3. Separate Authentication from Authorization

```typescript
// ✅ Clear separation
protected _canUpdate(actor: Actor, entity: Article): void {
  // Authentication: Who are you?
  if (!actor || !actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
  }

  // Authorization: What can you do?
  const isOwner = entity.createdById === actor.id;
  const isAdmin = actor.role === RoleEnum.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Access denied');
  }
}
```

### 4. Don't Leak Information

```typescript
// ❌ Reveals entity exists
if (entity.createdById !== actor.id) {
  throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not your article');
}

// ✅ Generic not found (if entity should be hidden)
if (!entity || entity.createdById !== actor.id) {
  throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
}
```

### 5. Test All Permission Paths

Test matrix for each hook:
- ✅ Authorized user succeeds
- ✅ Unauthorized user fails
- ✅ Guest fails (if applicable)
- ✅ Admin bypasses (if applicable)
- ✅ Owner succeeds (if applicable)

### 6. Document Permission Requirements

```typescript
/**
 * Update an article
 *
 * **Permissions:**
 * - Owner can update their own articles
 * - Admins can update any article
 * - Users with ARTICLE_UPDATE_ANY can update any article
 *
 * @param actor - User performing the update
 * @param id - Article ID
 * @param data - Update data
 */
public async update(
  actor: Actor,
  id: string,
  data: ArticleUpdateInput
): Promise<ServiceOutput<Article>> {
  // Implementation
}
```

### 7. Use Permission Enums, Not Strings

```typescript
// ❌ Magic strings
if (actor.permissions.includes('article:update')) { }

// ✅ Type-safe enums
if (actor.permissions.includes(PermissionEnum.ARTICLE_UPDATE)) { }
```

---

**Next Steps:**
- **[Lifecycle Hooks Guide](./lifecycle-hooks.md)** - Before/after operation hooks
- **[Custom Logic Guide](./custom-logic.md)** - Advanced business methods
- **[Testing Guide](./testing.md)** - Comprehensive testing
