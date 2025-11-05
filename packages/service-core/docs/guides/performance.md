# Performance Optimization Guide

Performance best practices and optimization techniques for services.

## Database Query Optimization

### N+1 Query Problem

**Problem:**
```typescript
// ❌ BAD: N+1 queries
const articles = await this.model.findAll({ status: 'published' });

for (const article of articles) {
  article.author = await this.userModel.findById(article.createdById); // N queries
  article.category = await this.categoryModel.findById(article.categoryId); // N queries
}
```

**Solution:**
```typescript
// ✅ GOOD: Use relations or batch loading
const articles = await this.model.findAllWithRelations(
  { createdBy: true, category: true },
  { status: 'published' }
);
```

### Eager Loading

Use relations to fetch related data in one query:

```typescript
protected getDefaultListRelations(): ListRelationsConfig {
  return {
    createdBy: {
      columns: { id: true, name: true, avatar: true }
    },
    category: true,
    tags: true
  };
}
```

### Pagination Strategies

**Offset-based (simple but slow for large datasets):**
```typescript
const result = await this.model.findAll({}, {
  page: 10,
  pageSize: 20
  // OFFSET 180 LIMIT 20 - scans all previous rows
});
```

**Cursor-based (efficient for large datasets):**
```typescript
const result = await this.model.findWithCursor({
  cursor: lastId,
  limit: 20
  // WHERE id > cursor LIMIT 20 - constant time
});
```

### Indexing Considerations

Ensure database has proper indexes:

```typescript
// Frequently searched fields should be indexed
protected async _executeSearch(params: SearchInput, actor: Actor) {
  // ✅ GOOD: Uses indexed fields
  const filters = {
    status: params.status,        // Indexed
    categoryId: params.categoryId // Indexed (FK)
  };

  // ⚠️ SLOW: LIKE queries don't use indexes well
  if (params.q) {
    filters.title = { like: `%${params.q}%` }; // Full table scan
  }

  return this.model.findAll(filters);
}
```

## Service Layer Optimization

### Caching Strategies

**1. Cache Single Entities:**
```typescript
public async getById(actor: Actor, id: string): Promise<ServiceOutput<Article | null>> {
  const cacheKey = `article:${id}`;

  // Try cache
  const cached = await this.cache.get<Article>(cacheKey);
  if (cached) {
    this._canView(actor, cached);
    return { data: cached };
  }

  // Fetch from DB
  const result = await super.getById(actor, id);

  // Cache success
  if (result.data) {
    await this.cache.set(cacheKey, result.data, { ttl: 3600 });
  }

  return result;
}
```

**2. Cache List Results:**
```typescript
public async list(actor: Actor, options: ListOptions): Promise<ServiceOutput<PaginatedList<Article>>> {
  const cacheKey = `article:list:${JSON.stringify(options)}`;

  const cached = await this.cache.get(cacheKey);
  if (cached) return { data: cached };

  const result = await super.list(actor, options);

  if (result.data) {
    await this.cache.set(cacheKey, result.data, { ttl: 300 }); // 5 min
  }

  return result;
}
```

**3. Cache Invalidation:**
```typescript
protected async _afterUpdate(entity: Article, actor: Actor): Promise<Article> {
  // Invalidate specific entity
  await this.cache.delete(`article:${entity.id}`);

  // Invalidate list caches
  await this.cache.deletePattern('article:list:*');

  // Invalidate author's cache
  await this.cache.delete(`user:${entity.createdById}:articles`);

  return entity;
}
```

### Batch Operations

Process multiple items efficiently:

```typescript
// ✅ GOOD: Batch database operations
public async bulkUpdate(
  actor: Actor,
  updates: Array<{ id: string; data: UpdateInput }>
): Promise<ServiceOutput<{ updated: number }>> {
  return this.runWithLoggingAndValidation({
    methodName: 'bulkUpdate',
    input: { actor, updates },
    schema: z.object({ updates: z.array(BulkUpdateSchema) }),
    execute: async (data, validatedActor) => {
      // Batch permission checks
      const ids = data.updates.map(u => u.id);
      const entities = await this.model.findByIds(ids);

      entities.forEach(entity => this._canUpdate(validatedActor, entity));

      // Batch update
      const result = await this.model.bulkUpdate(data.updates);

      return { updated: result.count };
    }
  });
}
```

### Parallel Processing

Use `Promise.all` for independent operations:

```typescript
// ✅ GOOD: Parallel fetching
public async getFullDetails(actor: Actor, id: string) {
  const article = await this.getById(actor, id);

  // Fetch related data in parallel
  const [author, category, comments, stats] = await Promise.all([
    this.userModel.findById(article.data!.createdById),
    this.categoryModel.findById(article.data!.categoryId),
    this.commentModel.findAll({ articleId: id }),
    this.statsModel.get({ articleId: id })
  ]);

  return { article: article.data, author, category, comments, stats };
}

// ❌ BAD: Sequential fetching
const author = await this.userModel.findById(article.data!.createdById);
const category = await this.categoryModel.findById(article.data!.categoryId);
const comments = await this.commentModel.findAll({ articleId: id });
// Each waits for previous to complete
```

## Memory Management

### Avoid Loading Too Much Data

```typescript
// ❌ BAD: Loading everything into memory
public async exportAll(actor: Actor) {
  const all = await this.model.findAll({}); // Could be millions of rows
  return this.exportService.toCSV(all);
}

// ✅ GOOD: Stream or batch process
public async exportAll(actor: Actor) {
  const stream = this.model.findAllStream({});

  return this.exportService.toCSVStream(stream);
}
```

### Release Resources

```typescript
// ✅ GOOD: Clean up after operations
protected async _afterCreate(entity: Article, actor: Actor): Promise<Article> {
  try {
    // Large operations
    await this.searchService.indexArticle(entity);
  } finally {
    // Clean up
    entity = null; // Allow GC
  }

  return entity;
}
```

## Profiling and Monitoring

### Log Performance Metrics

```typescript
public async complexOperation(actor: Actor, data: Input) {
  const startTime = Date.now();

  try {
    const result = await this.runWithLoggingAndValidation({
      methodName: 'complexOperation',
      input: { actor, ...data },
      schema: InputSchema,
      execute: async (validData, validActor) => {
        // Operation...
      }
    });

    // Log success metrics
    const duration = Date.now() - startTime;
    this.logger.info('complexOperation completed', {
      duration,
      actorId: actor.id
    });

    return result;
  } catch (error) {
    // Log error metrics
    const duration = Date.now() - startTime;
    this.logger.error('complexOperation failed', {
      duration,
      actorId: actor.id,
      error
    });
    throw error;
  }
}
```

### Use APM Tools

Integrate with Application Performance Monitoring:

```typescript
import * as Sentry from '@sentry/node';

public async criticalOperation(actor: Actor, data: Input) {
  const transaction = Sentry.startTransaction({
    op: 'service.operation',
    name: 'ArticleService.criticalOperation'
  });

  try {
    // Operation spans
    const span1 = transaction.startChild({ op: 'db', description: 'Fetch entity' });
    const entity = await this.model.findById(data.id);
    span1.finish();

    const span2 = transaction.startChild({ op: 'external', description: 'Process payment' });
    await this.paymentService.process(data.payment);
    span2.finish();

    transaction.setStatus('ok');
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
}
```

## Common Performance Pitfalls

### 1. Blocking on Non-Critical Operations

```typescript
// ❌ BAD: Waiting for non-critical operations
protected async _afterCreate(entity: Article, actor: Actor): Promise<Article> {
  await this.notificationService.send(...); // Blocks for 500ms
  await this.analyticsService.track(...);   // Blocks for 200ms
  return entity; // User waits unnecessarily
}

// ✅ GOOD: Fire and forget
protected async _afterCreate(entity: Article, actor: Actor): Promise<Article> {
  Promise.all([
    this.notificationService.send(...),
    this.analyticsService.track(...)
  ]).catch(err => this.logger.error('Side effects failed', err));

  return entity; // Return immediately
}
```

### 2. Unnecessary Database Queries

```typescript
// ❌ BAD: Fetching data you already have
public async update(actor: Actor, id: string, data: UpdateInput) {
  const existing = await this.model.findById(id); // Query 1

  // Permission check...

  const updated = await this.model.update({ id }, data); // Query 2
  return updated;
}

// ✅ GOOD: Reuse fetched data
public async update(actor: Actor, id: string, data: UpdateInput) {
  const existing = await this.model.findById(id);

  // Use existing for permission check

  const updated = await this.model.update({ id }, data);
  return updated;
}
```

### 3. Large Payloads

```typescript
// ❌ BAD: Returning massive objects
public async getArticle(actor: Actor, id: string) {
  const article = await this.model.findById(id);
  article.allComments = await this.commentModel.findAll({ articleId: id }); // Could be 10,000 comments

  return article;
}

// ✅ GOOD: Return only necessary data
public async getArticle(actor: Actor, id: string) {
  const article = await this.model.findById(id);
  const commentCount = await this.commentModel.count({ articleId: id });

  return { ...article, commentCount };
}
```

## Benchmarking Guide

Create performance benchmarks:

```typescript
// benchmarks/article-service.bench.ts
import { describe, bench } from 'vitest';

describe('ArticleService Performance', () => {
  bench('create article', async () => {
    await service.create(actor, articleData);
  });

  bench('list articles (100 items)', async () => {
    await service.list(actor, { page: 1, pageSize: 100 });
  });

  bench('search with filters', async () => {
    await service.search(actor, {
      status: 'published',
      categoryId: 'cat-1',
      page: 1,
      pageSize: 20
    });
  });
});
```

Run benchmarks:
```bash
pnpm vitest bench
```

---

**See Also:**
- [Advanced Patterns](./advanced-patterns.md) - Optimization patterns
- [Testing Guide](./testing.md) - Performance testing
