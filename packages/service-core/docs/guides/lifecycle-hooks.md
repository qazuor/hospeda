# Lifecycle Hooks - Complete Guide

Comprehensive guide to lifecycle hooks in Hospeda services.

## Table of Contents

- [Overview](#overview)
- [Hook Execution Order](#hook-execution-order)
- [The 28 Lifecycle Hooks](#the-28-lifecycle-hooks)
- [Common Patterns](#common-patterns)
- [Hook Best Practices](#hook-best-practices)
- [Testing Hooks](#testing-hooks)

## Overview

Lifecycle hooks allow you to inject custom logic at specific points in the operation lifecycle. They enable you to:

- **Transform data** before it reaches the database
- **Validate business rules** beyond schema validation
- **Trigger side effects** (notifications, logging, cache invalidation)
- **Enrich responses** with additional data
- **Implement audit trails**
- **Handle cascading operations**

**When to Use Hooks vs Custom Methods:**

- **Use Hooks**: For logic that should run **every time** an operation occurs
- **Use Custom Methods**: For specialized operations not part of standard CRUD

## Hook Execution Order

Every CRUD operation follows a predictable lifecycle:

```
1. Input Validation (Zod schema)
2. Permission Check (_canXxx)
3. Normalization (if normalizer defined)
4. Before Hook (_beforeXxx)
5. Database Operation
6. After Hook (_afterXxx)
7. Return Result
```

### Example: Create Operation Flow

```
create(actor, data)
  → Validate data against createSchema
  → _canCreate(actor, data)
  → normalizers.create(data, actor) [if defined]
  → _beforeCreate(data, actor)
  → model.create(processedData)
  → _afterCreate(createdEntity, actor)
  → Return ServiceOutput<TEntity>
```

### Example: Update Operation Flow

```
update(actor, id, data)
  → Validate data against updateSchema
  → Fetch entity by ID
  → _canUpdate(actor, entity)
  → normalizers.update(data, actor) [if defined]
  → _beforeUpdate(data, actor)
  → model.update(id, processedData)
  → _afterUpdate(updatedEntity, actor)
  → Return ServiceOutput<TEntity>
```

## The 28 Lifecycle Hooks

### Create Hooks

#### _beforeCreate

**Purpose:** Transform or validate data before database insertion

**Signature:**
```typescript
protected async _beforeCreate(
  data: z.infer<TCreateSchema>,
  _actor: Actor
): Promise<Partial<TEntity>>
```

**When to Use:**
- Generate slugs from titles
- Hash passwords
- Set default values
- Calculate derived fields
- Add timestamps

**Example:**
```typescript
protected async _beforeCreate(
  data: ArticleCreateInput,
  actor: Actor
): Promise<Partial<Article>> {
  return {
    ...data,
    slug: data.slug || slugify(data.title), // Auto-generate slug if not provided
    status: data.status || 'draft',          // Default to draft
    viewCount: 0,                            // Initialize counter
    createdAt: new Date(),
    createdById: actor.id
  };
}
```

#### _afterCreate

**Purpose:** Perform side effects after entity is created

**Signature:**
```typescript
protected async _afterCreate(
  entity: TEntity,
  _actor: Actor
): Promise<TEntity>
```

**When to Use:**
- Send notifications
- Create audit logs
- Trigger webhooks
- Update search index
- Cache invalidation
- Create related entities

**Example:**
```typescript
protected async _afterCreate(
  entity: Article,
  actor: Actor
): Promise<Article> {
  // Send notification to admin
  await this.notificationService.send({
    type: 'article.created',
    recipientId: 'admin-1',
    data: {
      articleId: entity.id,
      title: entity.title,
      authorId: actor.id
    }
  });

  // Index for search
  await this.searchService.indexArticle(entity);

  // Log activity
  await this.activityLogger.log({
    action: 'article.created',
    actorId: actor.id,
    resourceId: entity.id,
    resourceType: 'article'
  });

  return entity;
}
```

### Update Hooks

#### _beforeUpdate

**Purpose:** Transform or validate update data

**Signature:**
```typescript
protected async _beforeUpdate(
  data: z.infer<TUpdateSchema>,
  _actor: Actor
): Promise<Partial<TEntity>>
```

**When to Use:**
- Update related fields when one field changes
- Validate business rules
- Transform data
- Set audit fields

**Example:**
```typescript
protected async _beforeUpdate(
  data: ArticleUpdateInput,
  actor: Actor
): Promise<Partial<Article>> {
  const updates: Partial<Article> = { ...data };

  // If title changes, regenerate slug
  if (data.title) {
    updates.slug = slugify(data.title);
  }

  // If publishing, set publish date
  if (data.status === 'published' && !data.publishedAt) {
    updates.publishedAt = new Date();
  }

  // Track who updated
  updates.updatedById = actor.id;
  updates.updatedAt = new Date();

  return updates;
}
```

#### _afterUpdate

**Purpose:** Perform side effects after update

**Signature:**
```typescript
protected async _afterUpdate(
  entity: TEntity,
  _actor: Actor
): Promise<TEntity>
```

**When to Use:**
- Clear caches
- Send notifications
- Update search index
- Trigger webhooks
- Sync with external systems

**Example:**
```typescript
protected async _afterUpdate(
  entity: Article,
  actor: Actor
): Promise<Article> {
  // Invalidate cached article
  await this.cacheService.delete(`article:${entity.id}`);

  // Update search index
  await this.searchService.updateArticle(entity);

  // If status changed to published, notify subscribers
  if (entity.status === 'published') {
    await this.notificationService.notifySubscribers({
      type: 'article.published',
      articleId: entity.id,
      title: entity.title
    });
  }

  return entity;
}
```

### Delete Hooks

#### _beforeSoftDelete

**Purpose:** Perform pre-delete checks or cleanup

**Signature:**
```typescript
protected async _beforeSoftDelete(
  id: string,
  _actor: Actor
): Promise<string>
```

**When to Use:**
- Check for dependent resources
- Create backup
- Validate deletion is allowed

**Example:**
```typescript
protected async _beforeSoftDelete(
  id: string,
  actor: Actor
): Promise<string> {
  // Check if article has published comments
  const commentCount = await this.commentModel.count({
    articleId: id,
    status: 'published'
  });

  if (commentCount > 0) {
    throw new ServiceError(
      ServiceErrorCode.VALIDATION_ERROR,
      `Cannot delete article with ${commentCount} published comments. Archive instead.`
    );
  }

  return id;
}
```

#### _afterSoftDelete

**Purpose:** Cleanup after soft delete

**Signature:**
```typescript
protected async _afterSoftDelete(
  result: { count: number },
  _actor: Actor
): Promise<{ count: number }>
```

**When to Use:**
- Remove from caches
- Update counters
- Notify stakeholders

**Example:**
```typescript
protected async _afterSoftDelete(
  result: { count: number },
  actor: Actor
): Promise<{ count: number }> {
  if (result.count > 0) {
    // Remove from cache
    await this.cacheService.delete(`article:*`);

    // Notify author
    await this.notificationService.send({
      type: 'article.deleted',
      recipientId: actor.id,
      message: 'Your article has been deleted'
    });
  }

  return result;
}
```

#### _beforeHardDelete / _afterHardDelete

Similar to soft delete hooks but for permanent deletion:

```typescript
protected async _beforeHardDelete(
  id: string,
  actor: Actor
): Promise<string> {
  // Check for critical dependencies
  const hasOrders = await this.orderModel.exists({ articleId: id });

  if (hasOrders) {
    throw new ServiceError(
      ServiceErrorCode.VALIDATION_ERROR,
      'Cannot permanently delete article with existing orders'
    );
  }

  return id;
}

protected async _afterHardDelete(
  result: { count: number },
  actor: Actor
): Promise<{ count: number }> {
  // Remove all related data
  await this.commentModel.hardDelete({ articleId: id });
  await this.searchService.removeArticle(id);

  return result;
}
```

### Restore Hooks

#### _beforeRestore / _afterRestore

Handle restoration of soft-deleted entities:

```typescript
protected async _beforeRestore(
  id: string,
  actor: Actor
): Promise<string> {
  // Validate restoration is allowed
  const entity = await this.model.findById(id);

  if (!entity || !entity.deletedAt) {
    throw new ServiceError(
      ServiceErrorCode.NOT_FOUND,
      'Article not found or not deleted'
    );
  }

  return id;
}

protected async _afterRestore(
  result: { count: number },
  actor: Actor
): Promise<{ count: number }> {
  if (result.count > 0) {
    // Re-index for search
    const entity = await this.model.findById(id);
    await this.searchService.indexArticle(entity);

    // Notify
    await this.notificationService.send({
      type: 'article.restored',
      recipientId: actor.id
    });
  }

  return result;
}
```

### View Hooks

#### _beforeGetByField

**Purpose:** Modify query parameters before fetching

**Signature:**
```typescript
protected async _beforeGetByField(
  field: string,
  value: unknown,
  _actor: Actor
): Promise<{ field: string; value: unknown }>
```

**When to Use:**
- Transform query values
- Add query conditions
- Validate field access

**Example:**
```typescript
protected async _beforeGetByField(
  field: string,
  value: unknown,
  actor: Actor
): Promise<{ field: string; value: unknown }> {
  // Allow case-insensitive slug lookup
  if (field === 'slug' && typeof value === 'string') {
    return { field, value: value.toLowerCase() };
  }

  return { field, value };
}
```

#### _afterGetByField

**Purpose:** Transform or enrich entity after fetching

**Signature:**
```typescript
protected async _afterGetByField(
  entity: TEntity | null,
  _actor: Actor
): Promise<TEntity | null>
```

**When to Use:**
- Enrich with related data
- Transform fields
- Track views

**Example:**
```typescript
protected async _afterGetByField(
  entity: Article | null,
  actor: Actor
): Promise<Article | null> {
  if (!entity) return null;

  // Increment view count (async, don't await)
  this.model.incrementViews(entity.id).catch(console.error);

  // Enrich with related data
  const enriched = {
    ...entity,
    author: await this.userModel.findById(entity.createdById),
    category: await this.categoryModel.findById(entity.categoryId)
  };

  return enriched as Article;
}
```

### List Hooks

#### _beforeList

**Purpose:** Modify list parameters before querying

**Signature:**
```typescript
protected async _beforeList(
  options: { page?: number; pageSize?: number; relations?: ListRelationsConfig },
  _actor: Actor
): Promise<{ page?: number; pageSize?: number; relations?: ListRelationsConfig }>
```

**When to Use:**
- Add filters based on actor
- Limit page size
- Modify relations

**Example:**
```typescript
protected async _beforeList(
  options: ListOptions,
  actor: Actor
): Promise<ListOptions> {
  // Non-admin users only see published articles
  if (actor.role !== RoleEnum.ADMIN) {
    return {
      ...options,
      filters: {
        ...options.filters,
        status: 'published'
      }
    };
  }

  return options;
}
```

#### _afterList

**Purpose:** Transform or filter results after listing

**Signature:**
```typescript
protected async _afterList(
  result: PaginatedListOutput<TEntity>,
  _actor: Actor
): Promise<PaginatedListOutput<TEntity>>
```

**When to Use:**
- Filter results by permission
- Enrich entities
- Add computed fields

**Example:**
```typescript
protected async _afterList(
  result: PaginatedListOutput<Article>,
  actor: Actor
): Promise<PaginatedListOutput<Article>> {
  // Filter out articles user can't see
  const filtered = result.items.filter(article => {
    if (article.status === 'published') return true;
    if (article.createdById === actor.id) return true;
    if (actor.role === RoleEnum.ADMIN) return true;
    return false;
  });

  return {
    items: filtered,
    total: filtered.length
  };
}
```

### Search Hooks

#### _beforeSearch / _afterSearch

Similar to list hooks but for search operations:

```typescript
protected async _beforeSearch(
  params: ArticleSearchInput,
  actor: Actor
): Promise<ArticleSearchInput> {
  // Force status filter for non-admins
  if (actor.role !== RoleEnum.ADMIN && !params.status) {
    return {
      ...params,
      status: 'published'
    };
  }

  return params;
}

protected async _afterSearch(
  result: PaginatedListOutput<Article>,
  actor: Actor
): Promise<PaginatedListOutput<Article>> {
  // Add read status for each article
  const enriched = await Promise.all(
    result.items.map(async (article) => ({
      ...article,
      isRead: await this.readStatusModel.isRead(actor.id, article.id)
    }))
  );

  return {
    items: enriched as Article[],
    total: result.total
  };
}
```

### Count Hooks

#### _beforeCount / _afterCount

```typescript
protected async _beforeCount(
  params: ArticleSearchInput,
  actor: Actor
): Promise<ArticleSearchInput> {
  // Same filters as search
  if (actor.role !== RoleEnum.ADMIN && !params.status) {
    return {
      ...params,
      status: 'published'
    };
  }

  return params;
}

protected async _afterCount(
  result: { count: number },
  actor: Actor
): Promise<{ count: number }> {
  // Could add metadata
  return result;
}
```

### Visibility Hooks

#### _beforeUpdateVisibility / _afterUpdateVisibility

```typescript
protected async _beforeUpdateVisibility(
  entity: Article,
  newVisibility: VisibilityEnum,
  actor: Actor
): Promise<VisibilityEnum> {
  // Validate visibility transition
  if (entity.visibility === VisibilityEnum.PRIVATE &&
      newVisibility === VisibilityEnum.PUBLIC &&
      !entity.isApproved) {
    throw new ServiceError(
      ServiceErrorCode.VALIDATION_ERROR,
      'Cannot make unapproved article public'
    );
  }

  return newVisibility;
}

protected async _afterUpdateVisibility(
  entity: Article,
  actor: Actor
): Promise<Article> {
  // Clear cache
  await this.cacheService.delete(`article:${entity.id}`);

  // Notify if made public
  if (entity.visibility === VisibilityEnum.PUBLIC) {
    await this.notificationService.notifyFollowers(entity.createdById, {
      type: 'article.published',
      articleId: entity.id
    });
  }

  return entity;
}
```

## Common Patterns

### Pattern 1: Slug Generation

```typescript
protected async _beforeCreate(
  data: ArticleCreateInput,
  actor: Actor
): Promise<Partial<Article>> {
  // Generate slug if not provided
  const slug = data.slug || slugify(data.title);

  // Ensure uniqueness
  let finalSlug = slug;
  let counter = 1;

  while (await this.model.exists({ slug: finalSlug })) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return {
    ...data,
    slug: finalSlug
  };
}
```

### Pattern 2: Change Tracking

```typescript
protected async _beforeUpdate(
  data: ArticleUpdateInput,
  actor: Actor
): Promise<Partial<Article>> {
  // Get current entity
  const current = await this.model.findById(id);

  // Track what changed
  const changes: Record<string, any> = {};

  Object.keys(data).forEach(key => {
    if (data[key] !== current[key]) {
      changes[key] = {
        old: current[key],
        new: data[key]
      };
    }
  });

  // Store change log
  await this.changeLogModel.create({
    entityType: 'article',
    entityId: current.id,
    actorId: actor.id,
    changes
  });

  return data;
}
```

### Pattern 3: Cascade Deletion

```typescript
protected async _afterSoftDelete(
  result: { count: number },
  actor: Actor
): Promise<{ count: number }> {
  if (result.count > 0) {
    // Soft delete related comments
    await this.commentModel.softDelete({ articleId: id });

    // Archive related media
    await this.mediaModel.archive({ articleId: id });
  }

  return result;
}
```

### Pattern 4: Notification Triggering

```typescript
protected async _afterCreate(
  entity: Article,
  actor: Actor
): Promise<Article> {
  // Notify different groups based on status
  if (entity.status === 'published') {
    // Notify followers
    await this.notificationService.notifyFollowers(actor.id, {
      type: 'article.published',
      articleId: entity.id,
      title: entity.title
    });
  } else if (entity.status === 'pending_review') {
    // Notify moderators
    await this.notificationService.notifyModerators({
      type: 'article.needs_review',
      articleId: entity.id,
      authorId: actor.id
    });
  }

  return entity;
}
```

### Pattern 5: Cache Invalidation

```typescript
protected async _afterUpdate(
  entity: Article,
  actor: Actor
): Promise<Article> {
  // Invalidate specific caches
  await this.cacheService.delete(`article:${entity.id}`);
  await this.cacheService.delete(`article:slug:${entity.slug}`);

  // Invalidate list caches
  await this.cacheService.deletePattern('article:list:*');

  // Invalidate author's article cache
  await this.cacheService.delete(`author:${entity.createdById}:articles`);

  return entity;
}
```

### Pattern 6: Data Enrichment

```typescript
protected async _afterGetByField(
  entity: Article | null,
  actor: Actor
): Promise<Article | null> {
  if (!entity) return null;

  // Fetch related data in parallel
  const [author, category, tags, commentCount] = await Promise.all([
    this.userModel.findById(entity.createdById),
    this.categoryModel.findById(entity.categoryId),
    this.tagModel.findByArticle(entity.id),
    this.commentModel.count({ articleId: entity.id })
  ]);

  return {
    ...entity,
    author,
    category,
    tags,
    commentCount
  } as Article;
}
```

## Hook Best Practices

### 1. Keep Hooks Focused

```typescript
// ❌ BAD: Doing too much
protected async _afterCreate(entity: Article, actor: Actor): Promise<Article> {
  await this.notificationService.send(...);
  await this.searchService.index(...);
  await this.analyticsService.track(...);
  await this.webhookService.trigger(...);
  await this.cacheService.warm(...);
  // ... 20 more operations
  return entity;
}

// ✅ GOOD: Delegate to separate methods
protected async _afterCreate(entity: Article, actor: Actor): Promise<Article> {
  await this.handleNotifications(entity, actor);
  await this.handleIndexing(entity);
  await this.handleAnalytics(entity, actor);
  return entity;
}

private async handleNotifications(entity: Article, actor: Actor): Promise<void> {
  // All notification logic here
}
```

### 2. Handle Errors Gracefully

```typescript
// ✅ GOOD: Don't let side effects break main operation
protected async _afterCreate(entity: Article, actor: Actor): Promise<Article> {
  // Critical: Must succeed
  await this.searchService.index(entity);

  // Non-critical: Log error but don't throw
  try {
    await this.notificationService.send({ ... });
  } catch (error) {
    this.logger.error('Failed to send notification', error);
    // Don't throw - notification failure shouldn't break creation
  }

  return entity;
}
```

### 3. Use Async Operations Wisely

```typescript
// ❌ BAD: Blocking on non-critical async operations
protected async _afterCreate(entity: Article, actor: Actor): Promise<Article> {
  await this.notificationService.send(...);  // Blocks for 500ms
  await this.analyticsService.track(...);    // Blocks for 200ms
  await this.webhookService.trigger(...);    // Blocks for 1s
  return entity;  // User waits 1.7s unnecessarily
}

// ✅ GOOD: Fire and forget non-critical operations
protected async _afterCreate(entity: Article, actor: Actor): Promise<Article> {
  // Critical: await
  await this.searchService.index(entity);

  // Non-critical: fire and forget
  Promise.all([
    this.notificationService.send(...),
    this.analyticsService.track(...),
    this.webhookService.trigger(...)
  ]).catch(error => this.logger.error('Side effects failed', error));

  return entity;
}
```

### 4. Avoid Infinite Loops

```typescript
// ❌ BAD: Can cause infinite recursion
protected async _afterUpdate(entity: Article, actor: Actor): Promise<Article> {
  // This calls update again, which triggers _afterUpdate again!
  await this.update(actor, entity.id, { viewCount: entity.viewCount + 1 });
  return entity;
}

// ✅ GOOD: Use direct model method
protected async _afterUpdate(entity: Article, actor: Actor): Promise<Article> {
  // Bypass service layer to avoid triggering hooks
  await this.model.update({ id: entity.id }, { viewCount: entity.viewCount + 1 });
  return entity;
}
```

### 5. Document Hook Behavior

```typescript
/**
 * Before create hook: Generates unique slug and sets defaults
 *
 * Behavior:
 * - Generates slug from title if not provided
 * - Ensures slug uniqueness by appending counter
 * - Sets default status to 'draft'
 * - Initializes viewCount to 0
 */
protected async _beforeCreate(
  data: ArticleCreateInput,
  actor: Actor
): Promise<Partial<Article>> {
  // Implementation
}
```

## Testing Hooks

Test hooks thoroughly:

```typescript
describe('Article Lifecycle Hooks', () => {
  describe('_beforeCreate', () => {
    it('should generate slug from title if not provided', async () => {
      const data = {
        title: 'Hello World',
        content: 'Content',
        categoryId: 'cat-1'
      };

      const result = await service.create(actor, data);

      expect(result.data?.slug).toBe('hello-world');
    });

    it('should ensure slug uniqueness', async () => {
      // Create first article
      await service.create(actor, {
        title: 'Duplicate',
        content: 'Content',
        categoryId: 'cat-1'
      });

      // Create second with same title
      const result = await service.create(actor, {
        title: 'Duplicate',
        content: 'Content 2',
        categoryId: 'cat-1'
      });

      expect(result.data?.slug).toBe('duplicate-1');
    });
  });

  describe('_afterCreate', () => {
    it('should send notification after creation', async () => {
      const notifySpy = vi.spyOn(notificationService, 'send');

      await service.create(actor, {
        title: 'Test',
        content: 'Content',
        categoryId: 'cat-1'
      });

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'article.created'
        })
      );
    });
  });
});
```

---

**Next Steps:**
- **[Custom Logic Guide](./custom-logic.md)** - Advanced business methods
- **[Testing Guide](./testing.md)** - Comprehensive testing
- **[Examples](../examples/)** - Working code examples
