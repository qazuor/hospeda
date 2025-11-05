# Creating Services - Complete Guide

A comprehensive tutorial on creating services from scratch in the Hospeda service layer.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step-by-Step Service Creation](#step-by-step-service-creation)
  - [Step 1: Define Zod Schemas](#step-1-define-zod-schemas)
  - [Step 2: Create Database Model](#step-2-create-database-model)
  - [Step 3: Create Service Class](#step-3-create-service-class)
  - [Step 4: Implement Permission Hooks](#step-4-implement-permission-hooks)
  - [Step 5: Implement Core Logic Methods](#step-5-implement-core-logic-methods)
  - [Step 6: Add Custom Methods](#step-6-add-custom-methods)
  - [Step 7: Write Tests](#step-7-write-tests)
- [Complete Working Example](#complete-working-example)
- [Common Mistakes](#common-mistakes)
- [Troubleshooting](#troubleshooting)

## Overview

Creating a service in the Hospeda platform involves several steps that establish a complete business logic layer for an entity. Services extend `BaseCrudService` and provide:

- **Automated CRUD operations** (create, read, update, delete)
- **Permission enforcement** via hooks
- **Input validation** using Zod schemas
- **Lifecycle hooks** for custom logic
- **Error handling** with `ServiceOutput<T>` pattern
- **Logging and monitoring** automatically

**Why This Matters:**

Services are the single source of truth for business logic. They sit between the API layer and the database, ensuring:

- Consistent validation across all entry points
- Centralized permission checks
- Audit trails and logging
- Testable business rules
- Type safety from database to frontend

## Prerequisites

Before creating a service, ensure you have:

1. **Zod Schemas** defined in `@repo/schemas`
2. **Database Model** created in `@repo/db/models`
3. **Database Schema** (Drizzle) defined in `@repo/db/schemas`
4. **TypeScript** knowledge (especially generics)
5. **Understanding of Actor/Permission system**

## Step-by-Step Service Creation

We'll create a complete `ArticleService` for a blog platform as our example.

### Step 1: Define Zod Schemas

Schemas define the shape and validation rules for your data. You need **three schemas**:

1. **CreateSchema** - For creating new entities
2. **UpdateSchema** - For updating existing entities (fields optional)
3. **SearchSchema** - For filtering and searching

**Location:** `packages/schemas/entities/article.ts`

```typescript
import { z } from 'zod';

/**
 * Schema for creating a new article
 * All required fields must be present
 */
export const ArticleCreateInputSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255),
  content: z.string().min(100, 'Content must be at least 100 characters'),
  excerpt: z.string().max(500).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), // Will be auto-generated if not provided
  categoryId: z.string().uuid(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  publishedAt: z.coerce.date().optional(),
  featuredImageUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Schema for updating an article
 * All fields are optional (partial update support)
 */
export const ArticleUpdateInputSchema = z.object({
  title: z.string().min(5).max(255).optional(),
  content: z.string().min(100).optional(),
  excerpt: z.string().max(500).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  featuredImageUrl: z.string().url().nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Schema for searching/filtering articles
 * Includes pagination and sorting
 */
export const ArticleSearchSchema = z.object({
  // Text search
  q: z.string().optional(), // Full-text search query

  // Filters
  title: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string().uuid().optional(),

  // Date filters
  publishedAfter: z.coerce.date().optional(),
  publishedBefore: z.coerce.date().optional(),

  // Sorting
  sortBy: z.enum(['title', 'publishedAt', 'createdAt', 'updatedAt', 'views']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Pagination
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
});

// Export inferred types
export type ArticleCreateInput = z.infer<typeof ArticleCreateInputSchema>;
export type ArticleUpdateInput = z.infer<typeof ArticleUpdateInputSchema>;
export type ArticleSearchInput = z.infer<typeof ArticleSearchSchema>;
```

**Best Practices:**

- Use descriptive error messages in validations
- Provide sensible defaults (e.g., `status: 'draft'`)
- Keep search schemas flexible (all filters optional)
- Use `z.coerce.date()` for date inputs (accepts strings or Date objects)
- Add `.optional()` to nullable fields in update schemas
- Use enums for known values (`z.enum()`)

### Step 2: Create Database Model

The model handles all database operations. If you already have a model, skip to Step 3.

**Location:** `packages/db/models/article.model.ts`

```typescript
import { BaseModel } from './base.model';
import { articles } from '../schemas';
import type { Article } from '@repo/schemas/entities/article';

/**
 * Model for Article entity database operations
 */
export class ArticleModel extends BaseModel<Article> {
  constructor() {
    super(articles, 'article');
  }

  // Add custom query methods here if needed

  /**
   * Find articles by category
   */
  async findByCategory(categoryId: string, trx?: Transaction): Promise<Article[]> {
    const query = this.buildQuery(trx).where(eq(articles.categoryId, categoryId));
    return query;
  }

  /**
   * Find published articles only
   */
  async findPublished(trx?: Transaction): Promise<Article[]> {
    const query = this.buildQuery(trx)
      .where(eq(articles.status, 'published'))
      .orderBy(desc(articles.publishedAt));
    return query;
  }
}
```

### Step 3: Create Service Class

Now create the service class that extends `BaseCrudService`.

**Location:** `packages/service-core/src/services/article/article.service.ts`

```typescript
import { ArticleModel } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { RoleEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Article } from '@repo/schemas/entities/article';
import {
  ArticleCreateInputSchema,
  ArticleUpdateInputSchema,
  ArticleSearchSchema
} from '@repo/schemas/entities/article';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, PaginatedListOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing articles.
 * Handles business logic, permissions, and validation for Article entities.
 *
 * @extends BaseCrudService
 */
export class ArticleService extends BaseCrudService<
  Article,                         // Entity type
  ArticleModel,                    // Model class
  typeof ArticleCreateInputSchema, // Create schema
  typeof ArticleUpdateInputSchema, // Update schema
  typeof ArticleSearchSchema       // Search schema
> {
  // Entity name for logging and error messages
  static readonly ENTITY_NAME = 'article';
  protected readonly entityName = ArticleService.ENTITY_NAME;

  // Database model instance
  public readonly model: ArticleModel;

  // Zod schemas for validation
  public readonly createSchema = ArticleCreateInputSchema;
  public readonly updateSchema = ArticleUpdateInputSchema;
  public readonly searchSchema = ArticleSearchSchema;

  /**
   * Initialize the service
   * @param ctx - Service context with optional logger
   * @param model - Optional model instance (useful for testing)
   */
  constructor(ctx: ServiceContext, model?: ArticleModel) {
    super(ctx, ArticleService.ENTITY_NAME);
    this.model = model ?? new ArticleModel();
  }

  /**
   * Define default relations to include when listing articles
   * Returns relations configuration for category and author
   */
  protected getDefaultListRelations(): ListRelationsConfig {
    return {
      category: true,    // Include category data
      createdBy: {       // Include author with specific fields
        columns: {
          id: true,
          name: true,
          email: true
        }
      }
    };
  }

  // Permission hooks and other methods follow...
}
```

**Understanding the Generic Types:**

```typescript
BaseCrudService<
  Article,                         // TEntity: Your entity type
  ArticleModel,                    // TModel: Database model class
  typeof ArticleCreateInputSchema, // TCreateSchema: Zod create schema
  typeof ArticleUpdateInputSchema, // TUpdateSchema: Zod update schema
  typeof ArticleSearchSchema       // TSearchSchema: Zod search schema
>
```

- **TEntity**: The TypeScript type for your entity (from database schema)
- **TModel**: Your model class that extends `BaseModel<TEntity>`
- **TCreateSchema**: Zod schema type (use `typeof`, not inferred type)
- **TUpdateSchema**: Zod schema type for updates
- **TSearchSchema**: Zod schema type for searches

### Step 4: Implement Permission Hooks

Permission hooks determine who can perform which operations. You must implement **9 required hooks**.

#### Permission Hook Reference

| Hook | Purpose | When Called | Must Throw |
|------|---------|-------------|------------|
| `_canCreate` | Check create permission | Before creating entity | FORBIDDEN if denied |
| `_canUpdate` | Check update permission | After fetching entity | FORBIDDEN if denied |
| `_canSoftDelete` | Check soft delete permission | After fetching entity | FORBIDDEN if denied |
| `_canHardDelete` | Check hard delete permission | After fetching entity | FORBIDDEN if denied |
| `_canRestore` | Check restore permission | After fetching entity | FORBIDDEN if denied |
| `_canView` | Check view permission | After fetching entity | FORBIDDEN if denied |
| `_canList` | Check list permission | Before querying | FORBIDDEN if denied |
| `_canSearch` | Check search permission | Before querying | FORBIDDEN if denied |
| `_canCount` | Check count permission | Before counting | FORBIDDEN if denied |

#### Implementation Example

```typescript
// ============================================================================
// PERMISSION HOOKS
// ============================================================================

/**
 * Check if actor can create an article
 * Rule: Only authenticated users with ARTICLE_CREATE permission can create articles
 */
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
}

/**
 * Check if actor can update an article
 * Rule: Author can update their own articles, admins can update any article
 */
protected _canUpdate(actor: Actor, entity: Article): void {
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required'
    );
  }

  const isOwner = entity.createdById === actor.id;
  const isAdmin = actor.role === RoleEnum.ADMIN;
  const hasPermission = actor.permissions.includes(PermissionEnum.ARTICLE_UPDATE_ANY);

  if (!isOwner && !isAdmin && !hasPermission) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only update your own articles'
    );
  }
}

/**
 * Check if actor can soft delete an article
 * Rule: Author can delete their own articles, admins can delete any
 */
protected _canSoftDelete(actor: Actor, entity: Article): void {
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required'
    );
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

/**
 * Check if actor can hard delete an article
 * Rule: Only super admins can permanently delete articles
 */
protected _canHardDelete(actor: Actor, entity: Article): void {
  if (actor.role !== RoleEnum.SUPER_ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Only super administrators can permanently delete articles'
    );
  }
}

/**
 * Check if actor can restore an article
 * Rule: Only admins can restore deleted articles
 */
protected _canRestore(actor: Actor, entity: Article): void {
  if (actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Only administrators can restore articles'
    );
  }
}

/**
 * Check if actor can view a specific article
 * Rule: Everyone can view published articles, only authors/admins can view drafts
 */
protected _canView(actor: Actor, entity: Article): void {
  // Published articles are public
  if (entity.status === 'published') {
    return;
  }

  // Drafts require authentication
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required to view unpublished articles'
    );
  }

  // Owner or admin can view drafts
  const isOwner = entity.createdById === actor.id;
  const isAdmin = actor.role === RoleEnum.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only view your own draft articles'
    );
  }
}

/**
 * Check if actor can list articles
 * Rule: Anyone can list (will be filtered in _beforeList hook)
 */
protected _canList(actor: Actor): void {
  // Public operation - no restrictions
}

/**
 * Check if actor can search articles
 * Rule: Anyone can search (published articles only for guests)
 */
protected _canSearch(actor: Actor): void {
  // Public operation - filtering happens in _executeSearch
}

/**
 * Check if actor can count articles
 * Rule: Anyone can count
 */
protected _canCount(actor: Actor): void {
  // Public operation
}
```

**Permission Patterns:**

1. **Public Resources**: No checks (empty hook body)
2. **Authenticated Only**: Check `actor.id` exists
3. **Role-Based**: Check `actor.role === RoleEnum.ADMIN`
4. **Permission-Based**: Check `actor.permissions.includes(PermissionEnum.XXX)`
5. **Ownership**: Compare `entity.createdById === actor.id`
6. **Hierarchical**: Combine role + ownership + permissions

### Step 5: Implement Core Logic Methods

You must implement **3 required methods** for search and count operations.

#### Required Methods

```typescript
// ============================================================================
// SEARCH & COUNT IMPLEMENTATION
// ============================================================================

/**
 * Execute the database search query
 * This is where you translate search parameters into actual database queries
 *
 * @param params - Validated search parameters from searchSchema
 * @param actor - The user performing the search
 * @returns Paginated list of articles
 */
protected async _executeSearch(
  params: Record<string, unknown>,
  actor: Actor
): Promise<PaginatedListOutput<Article>> {
  const {
    q,
    title,
    categoryId,
    status,
    tags,
    authorId,
    publishedAfter,
    publishedBefore,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    pageSize = 20,
    ...otherParams
  } = params;

  // Build filter object
  const filters: Record<string, unknown> = {};

  // Apply text filters
  if (title) filters.title = title;
  if (categoryId) filters.categoryId = categoryId;
  if (authorId) filters.createdById = authorId;

  // Status filter (guests only see published)
  if (status) {
    filters.status = status;
  } else if (!actor || !actor.id) {
    // Non-authenticated users only see published articles
    filters.status = 'published';
  }

  // Tags filter
  if (tags && Array.isArray(tags) && tags.length > 0) {
    filters.tags = tags;
  }

  // Date range filters
  if (publishedAfter) filters.publishedAfter = publishedAfter;
  if (publishedBefore) filters.publishedBefore = publishedBefore;

  // Full-text search (if supported by model)
  if (q) {
    filters.q = q;
  }

  // Execute query with pagination and sorting
  return this.model.findAll(filters, {
    page,
    pageSize,
    orderBy: { field: sortBy as string, direction: sortOrder as 'asc' | 'desc' }
  });
}

/**
 * Execute the database count query
 * Count entities matching the filter criteria
 *
 * @param params - Validated search parameters (only filters matter)
 * @param actor - The user performing the count
 * @returns Object with count property
 */
protected async _executeCount(
  params: Record<string, unknown>,
  actor: Actor
): Promise<{ count: number }> {
  const { categoryId, status, authorId, tags } = params;

  // Build filter object (same logic as _executeSearch but without pagination)
  const filters: Record<string, unknown> = {};

  if (categoryId) filters.categoryId = categoryId;
  if (authorId) filters.createdById = authorId;

  // Status filter
  if (status) {
    filters.status = status;
  } else if (!actor || !actor.id) {
    filters.status = 'published';
  }

  if (tags && Array.isArray(tags) && tags.length > 0) {
    filters.tags = tags;
  }

  // Execute count
  const count = await this.model.count(filters);
  return { count };
}
```

**_executeSearch Best Practices:**

- Extract and apply all filter parameters
- Apply security filters (e.g., non-authenticated users see published only)
- Support full-text search if applicable
- Use pagination parameters (`page`, `pageSize`)
- Apply sorting
- Delegate to model's `findAll` method

**_executeCount Best Practices:**

- Use same filters as `_executeSearch` but no pagination/sorting
- Apply security filters
- Return `{ count: number }` structure

### Step 6: Add Custom Methods (Optional)

Beyond standard CRUD, add business-specific methods.

#### Example: Publishing Workflow

```typescript
/**
 * Publish an article (change status from draft to published)
 * Business Rule: Only drafts can be published
 * Business Rule: Must have title, content, and category
 *
 * @param actor - User performing the operation
 * @param articleId - Article ID to publish
 * @returns Published article
 */
public async publish(
  actor: Actor,
  articleId: string
): Promise<ServiceOutput<Article>> {
  return this.runWithLoggingAndValidation({
    methodName: 'publish',
    input: { actor, articleId },
    schema: z.object({ articleId: z.string().uuid() }),
    execute: async (validatedData, validatedActor) => {
      // Get the article
      const articleResult = await this.getById(validatedActor, validatedData.articleId);

      if (!articleResult.data) {
        throw new ServiceError(
          ServiceErrorCode.NOT_FOUND,
          'Article not found'
        );
      }

      const article = articleResult.data;

      // Check permission
      this._canUpdate(validatedActor, article);

      // Business rule: Only drafts can be published
      if (article.status !== 'draft') {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Only draft articles can be published'
        );
      }

      // Business rule: Must have required fields
      if (!article.title || !article.content || !article.categoryId) {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Article must have title, content, and category before publishing'
        );
      }

      // Business rule: Content must meet minimum length
      if (article.content.length < 100) {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Article content must be at least 100 characters'
        );
      }

      // Update status and publish date
      const updateResult = await this.update(validatedActor, validatedData.articleId, {
        status: 'published',
        publishedAt: new Date()
      });

      if (!updateResult.data) {
        throw new ServiceError(
          ServiceErrorCode.INTERNAL_ERROR,
          'Failed to publish article'
        );
      }

      return updateResult.data;
    }
  });
}

/**
 * Unpublish an article (change status back to draft)
 *
 * @param actor - User performing the operation
 * @param articleId - Article ID to unpublish
 * @returns Unpublished article
 */
public async unpublish(
  actor: Actor,
  articleId: string
): Promise<ServiceOutput<Article>> {
  return this.runWithLoggingAndValidation({
    methodName: 'unpublish',
    input: { actor, articleId },
    schema: z.object({ articleId: z.string().uuid() }),
    execute: async (validatedData, validatedActor) => {
      const articleResult = await this.getById(validatedActor, validatedData.articleId);

      if (!articleResult.data) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
      }

      this._canUpdate(validatedActor, articleResult.data);

      const updateResult = await this.update(validatedActor, validatedData.articleId, {
        status: 'draft',
        publishedAt: null
      });

      if (!updateResult.data) {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to unpublish article');
      }

      return updateResult.data;
    }
  });
}
```

#### Example: View Counter

```typescript
/**
 * Increment the view count for an article
 * This is a lightweight operation that doesn't require full update permissions
 *
 * @param articleId - Article ID
 * @returns Updated view count
 */
public async incrementViews(articleId: string): Promise<ServiceOutput<{ views: number }>> {
  return this.runWithLoggingAndValidation({
    methodName: 'incrementViews',
    input: { articleId },
    schema: z.object({ articleId: z.string().uuid() }),
    execute: async (validatedData) => {
      // No actor needed - public operation

      // Directly update view count in database
      const result = await this.model.incrementViews(validatedData.articleId);

      if (!result) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
      }

      return { views: result.views };
    }
  });
}
```

#### Custom Method Pattern

```typescript
public async customMethod(
  actor: Actor,
  param1: string,
  param2: number
): Promise<ServiceOutput<ReturnType>> {
  return this.runWithLoggingAndValidation({
    methodName: 'customMethod',
    input: { actor, param1, param2 },
    schema: z.object({
      param1: z.string(),
      param2: z.number()
    }),
    execute: async (validatedData, validatedActor) => {
      // 1. Permission checks
      // 2. Business logic
      // 3. Database operations
      // 4. Return result
    }
  });
}
```

### Step 7: Write Tests

Every service needs comprehensive tests.

**Location:** `packages/service-core/test/services/article/article.service.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleService } from '../../../src/services/article';
import { ArticleModel } from '@repo/db';
import { RoleEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../../src/types';

describe('ArticleService', () => {
  let service: ArticleService;
  let mockModel: ArticleModel;

  // Test actors
  const adminActor: Actor = {
    id: 'admin-1',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ARTICLE_CREATE, PermissionEnum.ARTICLE_UPDATE_ANY]
  };

  const userActor: Actor = {
    id: 'user-1',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ARTICLE_CREATE]
  };

  const guestActor: Actor = {
    id: '',
    role: RoleEnum.GUEST,
    permissions: []
  };

  beforeEach(() => {
    mockModel = new ArticleModel();
    service = new ArticleService({ logger: console }, mockModel);
  });

  describe('create', () => {
    it('should create article successfully for authenticated user', async () => {
      const data = {
        title: 'Test Article',
        content: 'This is a test article with sufficient content length to pass validation rules',
        categoryId: 'cat-123',
        status: 'draft' as const
      };

      const result = await service.create(userActor, data);

      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Test Article');
    });

    it('should reject creation for guest users', async () => {
      const data = {
        title: 'Test Article',
        content: 'Test content',
        categoryId: 'cat-123'
      };

      const result = await service.create(guestActor, data);

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });
  });

  describe('publish', () => {
    it('should publish draft article', async () => {
      // Create draft first
      const createResult = await service.create(userActor, {
        title: 'Draft Article',
        content: 'Content for draft article that is long enough to meet requirements',
        categoryId: 'cat-123',
        status: 'draft'
      });

      expect(createResult.data).toBeDefined();
      const articleId = createResult.data!.id;

      // Publish it
      const publishResult = await service.publish(userActor, articleId);

      expect(publishResult.data).toBeDefined();
      expect(publishResult.data?.status).toBe('published');
      expect(publishResult.data?.publishedAt).toBeDefined();
    });

    it('should reject publishing already published article', async () => {
      // Implementation...
    });
  });

  // More tests...
});
```

## Complete Working Example

See [basic-service.ts](../examples/basic-service.ts) for a complete, runnable example.

## Common Mistakes

### 1. Using Wrong Schema Type

```typescript
// ❌ WRONG: Using inferred type
typeof ArticleCreateInputSchema  // Type, not the schema itself

// ✅ CORRECT: Using actual schema
ArticleCreateInputSchema          // The schema object
```

### 2. Not Implementing All Permission Hooks

```typescript
// ❌ WRONG: Missing implementation
protected _canCreate(actor: Actor, data: unknown): void {
  // Empty - will not enforce any permissions!
}

// ✅ CORRECT: Explicit implementation
protected _canCreate(actor: Actor, data: unknown): void {
  if (!actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }
}
```

### 3. Forgetting to Call Parent Constructor

```typescript
// ❌ WRONG: No super() call
constructor(ctx: ServiceContext) {
  this.model = new ArticleModel();
}

// ✅ CORRECT: Call super()
constructor(ctx: ServiceContext, model?: ArticleModel) {
  super(ctx, 'article');
  this.model = model ?? new ArticleModel();
}
```

### 4. Not Handling Permission Checks in Custom Methods

```typescript
// ❌ WRONG: No permission check
public async publish(actor: Actor, id: string) {
  return this.runWithLoggingAndValidation({
    execute: async () => {
      // Missing permission check!
      await this.update(actor, id, { status: 'published' });
    }
  });
}

// ✅ CORRECT: Check permissions
public async publish(actor: Actor, id: string) {
  return this.runWithLoggingAndValidation({
    execute: async (validatedData, validatedActor) => {
      const article = await this.getById(validatedActor, id);
      this._canUpdate(validatedActor, article.data!); // Check permission
      await this.update(validatedActor, id, { status: 'published' });
    }
  });
}
```

### 5. Incorrect Error Handling

```typescript
// ❌ WRONG: Throwing generic Error
throw new Error('Not found');

// ✅ CORRECT: Using ServiceError with proper code
throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
```

## Troubleshooting

### TypeScript Errors

**Problem:** "Type 'typeof ArticleCreateInputSchema' does not satisfy..."

**Solution:** Make sure you're using `typeof SchemaName`, not the inferred type:

```typescript
typeof ArticleCreateInputSchema  // ✅ Correct
ArticleCreateInput               // ❌ Wrong
```

**Problem:** "Property 'model' has no initializer"

**Solution:** Initialize in constructor and mark as readonly:

```typescript
public readonly model: ArticleModel;

constructor(ctx: ServiceContext, model?: ArticleModel) {
  super(ctx, 'article');
  this.model = model ?? new ArticleModel();  // Initialize here
}
```

### Permission Issues

**Problem:** All operations fail with FORBIDDEN

**Solution:** Check your permission hooks are correctly implemented:

```typescript
// Debug: Log actor
console.log('Actor:', actor);

// Verify actor has required properties
if (!actor || !actor.id) {
  // Actor is not properly authenticated
}
```

### Validation Errors

**Problem:** Create/update fails with VALIDATION_ERROR

**Solution:** Test your schema directly:

```typescript
const result = ArticleCreateInputSchema.safeParse(data);
if (!result.success) {
  console.log('Validation errors:', result.error.errors);
}
```

## Next Steps

- **[Permissions Guide](./permissions.md)** - Deep dive into permission system
- **[Lifecycle Hooks Guide](./lifecycle-hooks.md)** - Using before/after hooks
- **[Custom Logic Guide](./custom-logic.md)** - Advanced business methods
- **[Testing Guide](./testing.md)** - Comprehensive testing strategies
- **[Examples](../examples/)** - Working code examples
