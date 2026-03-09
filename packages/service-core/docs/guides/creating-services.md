# Creating Services - Complete Guide

A comprehensive tutorial on creating services from scratch in the Hospeda service layer, covering the full stack from types and schemas through to API routes and testing.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [End-to-End Service Creation](#end-to-end-service-creation)
  - [Step 1: Define Zod Schemas](#step-1-define-zod-schemas)
  - [Step 2: Add Database Schema](#step-2-add-database-schema)
  - [Step 3: Create Database Model](#step-3-create-database-model)
  - [Step 4: Create Service Class](#step-4-create-service-class)
  - [Step 5: Implement Permission Hooks](#step-5-implement-permission-hooks)
  - [Step 6: Implement Core Logic Methods](#step-6-implement-core-logic-methods)
  - [Step 7: Add Custom Methods](#step-7-add-custom-methods-optional)
  - [Step 8: Create API Routes](#step-8-create-api-routes)
  - [Step 9: Create Test Factory](#step-9-create-test-factory)
  - [Step 10: Write Tests](#step-10-write-tests)
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

## End-to-End Service Creation

We will create a complete `Article` entity as our example, covering every layer from schemas to API routes.

### Step 1: Define Zod Schemas

Schemas define the shape and validation rules for your data. You need **three schemas**:

1. **CreateSchema** - For creating new entities
2. **UpdateSchema** - For updating existing entities (fields optional)
3. **SearchSchema** - For filtering and searching

**Location:** `packages/schemas/src/entities/article/`

```typescript
// packages/schemas/src/entities/article/article.schema.ts
import { z } from 'zod';

/**
 * Schema for creating a new article
 * All required fields must be present
 */
export const ArticleCreateInputSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255),
  content: z.string().min(100, 'Content must be at least 100 characters'),
  excerpt: z.string().max(500).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
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
  q: z.string().optional(),
  title: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string().uuid().optional(),
  publishedAfter: z.coerce.date().optional(),
  publishedBefore: z.coerce.date().optional(),
  sortBy: z.enum(['title', 'publishedAt', 'createdAt', 'updatedAt', 'views']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
});

// Export inferred types
export type ArticleCreateInput = z.infer<typeof ArticleCreateInputSchema>;
export type ArticleUpdateInput = z.infer<typeof ArticleUpdateInputSchema>;
export type ArticleSearchInput = z.infer<typeof ArticleSearchSchema>;
```

Update schema exports:

```typescript
// packages/schemas/src/entities/article/index.ts
export * from './article.schema.js';

// packages/schemas/src/entities/index.ts
export * from './article/index.js';
```

**Best Practices:**

- Use descriptive error messages in validations
- Provide sensible defaults (e.g., `status: 'draft'`)
- Keep search schemas flexible (all filters optional)
- Use `z.coerce.date()` for date inputs (accepts strings or Date objects)
- Add `.optional()` to nullable fields in update schemas
- Use enums for known values (`z.enum()`)

### Step 2: Add Database Schema

Define the database table using Drizzle ORM.

**Location:** `packages/db/src/schemas/article/`

```typescript
// packages/db/src/schemas/article/table.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const articleTable = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  slug: text('slug').notNull().unique(),
  categoryId: uuid('category_id').notNull(),
  status: text('status').notNull().default('draft'),
  publishedAt: timestamp('published_at'),
  featuredImageUrl: text('featured_image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  createdById: uuid('created_by_id').notNull(),
  updatedById: uuid('updated_by_id').notNull(),
});

export type ArticleRow = typeof articleTable.$inferSelect;
export type ArticleInsert = typeof articleTable.$inferInsert;
```

Update database exports:

```typescript
// packages/db/src/schemas/index.ts
export * from './article/table.js';
```

Generate and apply the migration:

```bash
cd packages/db
pnpm db:generate
pnpm db:migrate
```

### Step 3: Create Database Model

The model handles all database operations.

**Location:** `packages/db/src/models/article.model.ts`

```typescript
import { BaseModel } from './base.model';
import { articleTable } from '../schemas';
import type { Article } from '@repo/schemas/entities/article';

/**
 * Model for Article entity database operations
 */
export class ArticleModel extends BaseModel<Article> {
  constructor() {
    super(articleTable, 'article');
  }

  /**
   * Find articles by category
   */
  async findByCategory(categoryId: string, trx?: Transaction): Promise<Article[]> {
    const query = this.buildQuery(trx).where(eq(articleTable.categoryId, categoryId));
    return query;
  }

  /**
   * Find published articles only
   */
  async findPublished(trx?: Transaction): Promise<Article[]> {
    const query = this.buildQuery(trx)
      .where(eq(articleTable.status, 'published'))
      .orderBy(desc(articleTable.publishedAt));
    return query;
  }
}
```

Update model exports:

```typescript
// packages/db/src/models/index.ts
export * from './article.model.js';
```

### Step 4: Create Service Class

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
  static readonly ENTITY_NAME = 'article';
  protected readonly entityName = ArticleService.ENTITY_NAME;

  public readonly model: ArticleModel;

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
   */
  protected getDefaultListRelations(): ListRelationsConfig {
    return {
      category: true,
      createdBy: {
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

Update service exports:

```typescript
// packages/service-core/src/services/index.ts
export * from './article/article.service.js';
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

### Step 5: Implement Permission Hooks

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
 * Rule: Only authenticated users with ARTICLE_CREATE permission
 */
protected _canCreate(actor: Actor, data: unknown): void {
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required to create articles'
    );
  }

  if (!actor.permissions.includes(PermissionEnum.ARTICLE_CREATE)) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You do not have permission to create articles'
    );
  }
}

/**
 * Check if actor can update an article
 * Rule: Author can update own articles, admins can update any
 */
protected _canUpdate(actor: Actor, entity: Article): void {
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required'
    );
  }

  const isOwner = entity.createdById === actor.id;
  const hasPermission = actor.permissions.includes(PermissionEnum.ARTICLE_UPDATE_ANY);

  if (!isOwner && !hasPermission) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only update your own articles'
    );
  }
}

/**
 * Check if actor can soft delete an article
 */
protected _canSoftDelete(actor: Actor, entity: Article): void {
  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required'
    );
  }

  const isOwner = entity.createdById === actor.id;
  const hasDeleteAny = actor.permissions.includes(PermissionEnum.ARTICLE_DELETE_ANY);

  if (!isOwner && !hasDeleteAny) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only delete your own articles'
    );
  }
}

/**
 * Check if actor can hard delete an article
 * Rule: Requires ARTICLE_HARD_DELETE permission
 */
protected _canHardDelete(actor: Actor, entity: Article): void {
  if (!actor.permissions.includes(PermissionEnum.ARTICLE_HARD_DELETE)) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Permission ARTICLE_HARD_DELETE required to permanently delete articles'
    );
  }
}

/**
 * Check if actor can restore an article
 * Rule: Requires ARTICLE_RESTORE permission
 */
protected _canRestore(actor: Actor, entity: Article): void {
  if (!actor.permissions.includes(PermissionEnum.ARTICLE_RESTORE)) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Permission ARTICLE_RESTORE required to restore articles'
    );
  }
}

/**
 * Check if actor can view a specific article
 * Rule: Everyone sees published, only authors/admins see drafts
 */
protected _canView(actor: Actor, entity: Article): void {
  if (entity.status === 'published') {
    return;
  }

  if (!actor || !actor.id) {
    throw new ServiceError(
      ServiceErrorCode.UNAUTHORIZED,
      'Authentication required to view unpublished articles'
    );
  }

  const isOwner = entity.createdById === actor.id;
  const hasViewAny = actor.permissions.includes(PermissionEnum.ARTICLE_VIEW_ANY);

  if (!isOwner && !hasViewAny) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only view your own draft articles'
    );
  }
}

/**
 * Check if actor can list articles
 * Rule: Anyone can list (filtered in _beforeList hook)
 */
protected _canList(actor: Actor): void {
  // Public operation - no restrictions
}

/**
 * Check if actor can search articles
 */
protected _canSearch(actor: Actor): void {
  // Public operation - filtering happens in _executeSearch
}

/**
 * Check if actor can count articles
 */
protected _canCount(actor: Actor): void {
  // Public operation
}
```

**Permission Patterns:**

1. **Public Resources**: No checks (empty hook body)
2. **Authenticated Only**: Check `actor.id` exists
3. **Permission-Based**: Check `actor.permissions.includes(PermissionEnum.XXX)`
4. **Ownership**: Compare `entity.createdById === actor.id`
5. **Ownership + Permission**: Combine ownership + `_ANY` permission
6. **Hierarchical**: Combine ownership + multiple permissions

### Step 6: Implement Core Logic Methods

You must implement **3 required methods** for search and count operations.

```typescript
// ============================================================================
// SEARCH & COUNT IMPLEMENTATION
// ============================================================================

/**
 * Execute the database search query
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

  const filters: Record<string, unknown> = {};

  if (title) filters.title = title;
  if (categoryId) filters.categoryId = categoryId;
  if (authorId) filters.createdById = authorId;

  // Status filter (guests only see published)
  if (status) {
    filters.status = status;
  } else if (!actor || !actor.id) {
    filters.status = 'published';
  }

  if (tags && Array.isArray(tags) && tags.length > 0) {
    filters.tags = tags;
  }

  if (publishedAfter) filters.publishedAfter = publishedAfter;
  if (publishedBefore) filters.publishedBefore = publishedBefore;
  if (q) filters.q = q;

  return this.model.findAll(filters, {
    page,
    pageSize,
    orderBy: { field: sortBy as string, direction: sortOrder as 'asc' | 'desc' }
  });
}

/**
 * Execute the database count query
 */
protected async _executeCount(
  params: Record<string, unknown>,
  actor: Actor
): Promise<{ count: number }> {
  const { categoryId, status, authorId, tags } = params;

  const filters: Record<string, unknown> = {};

  if (categoryId) filters.categoryId = categoryId;
  if (authorId) filters.createdById = authorId;

  if (status) {
    filters.status = status;
  } else if (!actor || !actor.id) {
    filters.status = 'published';
  }

  if (tags && Array.isArray(tags) && tags.length > 0) {
    filters.tags = tags;
  }

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

### Step 7: Add Custom Methods (Optional)

Beyond standard CRUD, add business-specific methods.

#### Example: Publishing Workflow

```typescript
/**
 * Publish an article (change status from draft to published)
 * Business Rule: Only drafts can be published
 * Business Rule: Must have title, content, and category
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
      const articleResult = await this.getById(validatedActor, validatedData.articleId);

      if (!articleResult.data) {
        throw new ServiceError(
          ServiceErrorCode.NOT_FOUND,
          'Article not found'
        );
      }

      const article = articleResult.data;
      this._canUpdate(validatedActor, article);

      if (article.status !== 'draft') {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Only draft articles can be published'
        );
      }

      if (!article.title || !article.content || !article.categoryId) {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Article must have title, content, and category before publishing'
        );
      }

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

### Step 8: Create API Routes

Create the HTTP endpoints that expose the service.

**Location:** `apps/api/src/routes/article/`

```typescript
// apps/api/src/routes/article/index.ts
import { createCRUDRoute, createListRoute } from '../../lib/route-factory.js';
import { ArticleService } from '@repo/service-core';
import {
  ArticleCreateInputSchema,
  ArticleUpdateInputSchema,
  ArticleSearchSchema
} from '@repo/schemas';

// CRUD routes
export const articleCRUDRoute = createCRUDRoute({
  service: ArticleService,
  schemas: {
    create: ArticleCreateInputSchema,
    update: ArticleUpdateInputSchema
  },
  permissions: {
    create: ['ARTICLE_CREATE'],
    read: ['ARTICLE_READ'],
    update: ['ARTICLE_UPDATE'],
    delete: ['ARTICLE_DELETE']
  }
});

// List/search routes
export const articleListRoute = createListRoute({
  service: ArticleService,
  schema: ArticleSearchSchema,
  permissions: {
    list: ['ARTICLE_READ']
  }
});
```

Register routes in the main app:

```typescript
// apps/api/src/index.ts
import { articleCRUDRoute, articleListRoute } from './routes/article/index.js';

app.route('/articles', articleListRoute);
app.route('/articles', articleCRUDRoute);
```

### Step 9: Create Test Factory

Create mock data generators for tests.

**Location:** `packages/service-core/test/factories/`

```typescript
// packages/service-core/test/factories/articleFactory.ts
import type { Article, ArticleCreateInput, ArticleUpdateInput } from '@repo/schemas';
import { getMockId } from './utilsFactory';

const baseArticle: Article = {
  id: getMockId('article'),
  title: 'Mock Article',
  content: 'A mock article for testing with sufficient content length',
  excerpt: 'A mock article excerpt',
  slug: 'mock-article',
  categoryId: getMockId('category'),
  status: 'draft',
  tags: [],
  publishedAt: null,
  featuredImageUrl: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: getMockId('user'),
  updatedById: getMockId('user'),
};

export const createMockArticle = (overrides: Partial<Article> = {}): Article => ({
  ...baseArticle,
  id: getMockId('article'),
  ...overrides
});

export const createMockArticleCreateInput = (
  overrides: Partial<ArticleCreateInput> = {}
): ArticleCreateInput => ({
  title: 'New Article',
  content: 'A new article for testing with sufficient content length to pass validation',
  categoryId: getMockId('category'),
  ...overrides
});

export const createMockArticleUpdateInput = (
  overrides: Partial<ArticleUpdateInput> = {}
): ArticleUpdateInput => ({
  title: 'Updated Article',
  ...overrides
});
```

### Step 10: Write Tests

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
      const createResult = await service.create(userActor, {
        title: 'Draft Article',
        content: 'Content for draft article that is long enough to meet requirements',
        categoryId: 'cat-123',
        status: 'draft'
      });

      expect(createResult.data).toBeDefined();
      const articleId = createResult.data!.id;

      const publishResult = await service.publish(userActor, articleId);

      expect(publishResult.data).toBeDefined();
      expect(publishResult.data?.status).toBe('published');
      expect(publishResult.data?.publishedAt).toBeDefined();
    });
  });
});
```

## Testing Your Service

### Run Unit Tests

```bash
# Test specific service
pnpm test --filter=service-core -- article

# Test all services
pnpm test --filter=service-core
```

### Test API Endpoints

```bash
# Start the API
pnpm dev --filter=api

# Test with curl
curl -X POST http://localhost:3001/api/v1/admin/articles \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Article", "content": "Testing the API...", "categoryId": "uuid"}'
```

### Database Migration

```bash
# Generate migration for new table
pnpm db:generate

# Apply migration
pnpm db:migrate
```

## Complete Working Example

See [basic-service.ts](../examples/basic-service.ts) for a complete, runnable example.

## Common Mistakes

### 1. Using Wrong Schema Type

```typescript
// WRONG: Using inferred type
typeof ArticleCreateInputSchema  // Type, not the schema itself

// CORRECT: Using actual schema
ArticleCreateInputSchema          // The schema object
```

### 2. Not Implementing All Permission Hooks

```typescript
// WRONG: Missing implementation
protected _canCreate(actor: Actor, data: unknown): void {
  // Empty - will not enforce any permissions!
}

// CORRECT: Explicit implementation
protected _canCreate(actor: Actor, data: unknown): void {
  if (!actor.id) {
    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }
}
```

### 3. Forgetting to Call Parent Constructor

```typescript
// WRONG: No super() call
constructor(ctx: ServiceContext) {
  this.model = new ArticleModel();
}

// CORRECT: Call super()
constructor(ctx: ServiceContext, model?: ArticleModel) {
  super(ctx, 'article');
  this.model = model ?? new ArticleModel();
}
```

### 4. Not Handling Permission Checks in Custom Methods

```typescript
// WRONG: No permission check
public async publish(actor: Actor, id: string) {
  return this.runWithLoggingAndValidation({
    execute: async () => {
      await this.update(actor, id, { status: 'published' });
    }
  });
}

// CORRECT: Check permissions
public async publish(actor: Actor, id: string) {
  return this.runWithLoggingAndValidation({
    execute: async (validatedData, validatedActor) => {
      const article = await this.getById(validatedActor, id);
      this._canUpdate(validatedActor, article.data!);
      await this.update(validatedActor, id, { status: 'published' });
    }
  });
}
```

### 5. Incorrect Error Handling

```typescript
// WRONG: Throwing generic Error
throw new Error('Not found');

// CORRECT: Using ServiceError with proper code
throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
```

## Best Practices

### Type Safety

- Always use named exports
- Define explicit input/output types for all functions
- Leverage Zod for runtime validation

### Error Handling

- Use `ServiceError` with appropriate `ServiceErrorCode`
- Wrap business logic with `runWithLoggingAndValidation`
- Return standardized `{ success, data?, error? }` responses

### Testing

- Test both success and error cases
- Use factories for consistent mock data
- Mock external dependencies

### Performance

- Implement proper pagination in `findAll`
- Add database indexes for search fields
- Consider caching for read-heavy operations

### Common Search Patterns

```typescript
async findAll(options: ArticleSearchOptions = {}) {
  const { q, category, ...paginationOptions } = options;

  let query = this.db.select().from(this.table);

  if (q) {
    query = query.where(
      or(
        ilike(this.table.name, `%${q}%`),
        ilike(this.table.description, `%${q}%`)
      )
    );
  }

  if (category) {
    query = query.where(eq(this.table.category, category));
  }

  return this.applyPagination(query, paginationOptions);
}
```

### Custom Validation in Services

```typescript
async create(input: ArticleCreateInput): Promise<ServiceResponse<Article>> {
  return this.runWithLoggingAndValidation(
    'create',
    input,
    async () => {
      if (await this.nameExists(input.name)) {
        throw new ServiceError(
          ServiceErrorCode.DUPLICATE_RESOURCE,
          'Article name already exists'
        );
      }

      return super.create(input);
    }
  );
}
```

## Troubleshooting

### TypeScript Errors

**Problem:** "Type 'typeof ArticleCreateInputSchema' does not satisfy..."

**Solution:** Make sure you're using `typeof SchemaName`, not the inferred type:

```typescript
typeof ArticleCreateInputSchema  // Correct
ArticleCreateInput               // Wrong
```

**Problem:** "Property 'model' has no initializer"

**Solution:** Initialize in constructor and mark as readonly:

```typescript
public readonly model: ArticleModel;

constructor(ctx: ServiceContext, model?: ArticleModel) {
  super(ctx, 'article');
  this.model = model ?? new ArticleModel();
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

After implementing your service:

1. **Add to API Documentation**: Update API docs
2. **Update Architecture Docs**: Document any new patterns
3. **Add Integration Tests**: Test the full API flow
4. **Consider Caching**: Implement Redis caching if needed
5. **Monitor Performance**: Add logging and metrics

## Related Guides

- **[Permissions Guide](./permissions.md)** - Deep dive into permission system
- **[Lifecycle Hooks Guide](./lifecycle-hooks.md)** - Using before/after hooks
- **[Custom Logic Guide](./custom-logic.md)** - Advanced business methods
- **[Testing Guide](./testing.md)** - Comprehensive testing strategies
- **[Examples](../examples/)** - Working code examples
