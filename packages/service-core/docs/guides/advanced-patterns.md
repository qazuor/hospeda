# Advanced Patterns - Service Layer Techniques

Advanced patterns and techniques for service development.

## Table of Contents

- [Service Composition](#service-composition)
- [Transaction Handling](#transaction-handling)
- [Optimistic Locking](#optimistic-locking)
- [Soft Delete Patterns](#soft-delete-patterns)
- [Audit Logging](#audit-logging)
- [Event Sourcing Basics](#event-sourcing-basics)
- [CQRS Patterns](#cqrs-patterns)
- [Caching Strategies](#caching-strategies)
- [Pagination Optimization](#pagination-optimization)
- [Bulk Operations](#bulk-operations)
- [Background Jobs](#background-jobs)
- [Rate Limiting](#rate-limiting)
- [Multi-Tenancy](#multi-tenancy)

## Service Composition

Coordinate multiple services for complex operations:

```typescript
export class OrderService extends BaseCrudService<...> {
  constructor(
    ctx: ServiceContext,
    private productService: ProductService,
    private paymentService: PaymentService,
    private inventoryService: InventoryService,
    private notificationService: NotificationService
  ) {
    super(ctx, 'order');
  }

  public async placeOrder(
    actor: Actor,
    orderData: PlaceOrderInput
  ): Promise<ServiceOutput<Order>> {
    return this.runWithLoggingAndValidation({
      methodName: 'placeOrder',
      input: { actor, ...orderData },
      schema: PlaceOrderSchema,
      execute: async (data, validatedActor) => {
        // 1. Validate product availability
        const product = await this.productService.getById(validatedActor, data.productId);
        if (!product.data) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Product not found');
        }

        // 2. Check inventory
        const hasStock = await this.inventoryService.checkAvailability(
          validatedActor,
          data.productId,
          data.quantity
        );

        if (!hasStock.data) {
          throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Insufficient stock'
          );
        }

        // 3. Calculate total
        const total = product.data.price * data.quantity;

        // 4. Process payment
        const payment = await this.paymentService.process(validatedActor, {
          amount: total,
          currency: 'USD',
          customerId: validatedActor.id
        });

        if (!payment.data) {
          throw new ServiceError(
            ServiceErrorCode.PAYMENT_FAILED,
            'Payment processing failed'
          );
        }

        // 5. Reserve inventory
        await this.inventoryService.reserve(
          validatedActor,
          data.productId,
          data.quantity
        );

        // 6. Create order
        const order = await this.create(validatedActor, {
          productId: data.productId,
          quantity: data.quantity,
          total,
          paymentId: payment.data.id,
          status: 'confirmed'
        });

        // 7. Send confirmation
        await this.notificationService.sendOrderConfirmation(
          validatedActor,
          order.data!
        );

        return order.data!;
      }
    });
  }
}
```

## Transaction Handling

Ensure atomic operations across multiple database changes:

```typescript
public async transferOwnership(
  actor: Actor,
  articleId: string,
  newOwnerId: string
): Promise<ServiceOutput<Article>> {
  return this.runWithLoggingAndValidation({
    methodName: 'transferOwnership',
    input: { actor, articleId, newOwnerId },
    schema: z.object({
      articleId: z.string().uuid(),
      newOwnerId: z.string().uuid()
    }),
    execute: async (data, validatedActor) => {
      // Start transaction
      return await this.model.transaction(async (trx) => {
        // 1. Get article (within transaction)
        const article = await this.model.findById(data.articleId, trx);
        if (!article) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
        }

        // 2. Check permission
        this._canUpdate(validatedActor, article);

        // 3. Verify new owner exists
        const newOwner = await this.userModel.findById(data.newOwnerId, trx);
        if (!newOwner) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'New owner not found');
        }

        // 4. Update article ownership
        const updated = await this.model.update(
          { id: data.articleId },
          { createdById: data.newOwnerId },
          trx
        );

        // 5. Create ownership transfer record (audit)
        await this.ownershipTransferModel.create({
          articleId: data.articleId,
          fromUserId: article.createdById,
          toUserId: data.newOwnerId,
          transferredBy: validatedActor.id,
          transferredAt: new Date()
        }, trx);

        // 6. Update user statistics
        await this.userStatsModel.incrementArticleCount(data.newOwnerId, trx);
        await this.userStatsModel.decrementArticleCount(article.createdById, trx);

        return updated;
      });
      // Transaction commits automatically if no errors thrown
    }
  });
}
```

## Optimistic Locking

Prevent concurrent modification conflicts:

```typescript
protected async _beforeUpdate(
  data: ArticleUpdateInput,
  actor: Actor
): Promise<Partial<Article>> {
  // Get current entity with version
  const current = await this.model.findById(id);

  // Check version matches (passed in update data)
  if (data.version && current.version !== data.version) {
    throw new ServiceError(
      ServiceErrorCode.CONFLICT,
      'Entity has been modified by another user. Please refresh and try again.'
    );
  }

  // Increment version
  return {
    ...data,
    version: current.version + 1
  };
}
```

## Soft Delete Patterns

Advanced soft delete with cascade and restore:

```typescript
public async softDeleteWithCascade(
  actor: Actor,
  articleId: string
): Promise<ServiceOutput<{ deleted: number }>> {
  return this.runWithLoggingAndValidation({
    methodName: 'softDeleteWithCascade',
    input: { actor, articleId },
    schema: z.object({ articleId: z.string().uuid() }),
    execute: async (data, validatedActor) => {
      return await this.model.transaction(async (trx) => {
        // Soft delete main entity
        const result = await this.softDelete(validatedActor, data.articleId);

        // Soft delete related entities
        await this.commentModel.softDelete({ articleId: data.articleId }, trx);
        await this.mediaModel.softDelete({ articleId: data.articleId }, trx);
        await this.tagRelationModel.softDelete({ articleId: data.articleId }, trx);

        return { deleted: result.data!.count };
      });
    }
  });
}
```

## Audit Logging

Track all changes with detailed audit trail:

```typescript
protected async _afterUpdate(
  entity: Article,
  actor: Actor
): Promise<Article> {
  // Get previous version for comparison
  const previous = await this.model.findById(entity.id);

  // Calculate changes
  const changes: Record<string, { old: any; new: any }> = {};
  Object.keys(entity).forEach(key => {
    if (entity[key] !== previous[key]) {
      changes[key] = {
        old: previous[key],
        new: entity[key]
      };
    }
  });

  // Create audit log
  await this.auditLogModel.create({
    entityType: 'article',
    entityId: entity.id,
    action: 'update',
    actorId: actor.id,
    changes,
    timestamp: new Date(),
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent
  });

  return entity;
}
```

## Event Sourcing Basics

Store events instead of state:

```typescript
public async publishArticle(
  actor: Actor,
  articleId: string
): Promise<ServiceOutput<Article>> {
  return this.runWithLoggingAndValidation({
    methodName: 'publishArticle',
    input: { actor, articleId },
    schema: z.object({ articleId: z.string().uuid() }),
    execute: async (data, validatedActor) => {
      // Store event
      await this.eventStore.append({
        streamId: `article-${data.articleId}`,
        eventType: 'ArticlePublished',
        eventData: {
          articleId: data.articleId,
          publishedBy: validatedActor.id,
          publishedAt: new Date()
        },
        metadata: {
          actor: validatedActor.id,
          timestamp: new Date()
        }
      });

      // Apply event to projection (current state)
      const article = await this.update(validatedActor, data.articleId, {
        status: 'published',
        publishedAt: new Date()
      });

      return article.data!;
    }
  });
}
```

## CQRS Patterns

Separate reads and writes:

```typescript
// Write model (command)
export class ArticleCommandService extends BaseCrudService<...> {
  public async createArticle(
    actor: Actor,
    data: CreateArticleInput
  ): Promise<ServiceOutput<Article>> {
    // Handle write operation
    const article = await this.create(actor, data);

    // Publish event for read model
    await this.eventBus.publish('article.created', article.data);

    return article;
  }
}

// Read model (query)
export class ArticleQueryService {
  public async getArticleView(
    articleId: string
  ): Promise<ArticleView> {
    // Read from denormalized view (optimized for reads)
    return this.articleViewModel.findById(articleId);
  }

  public async searchArticles(
    query: SearchQuery
  ): Promise<PaginatedList<ArticleView>> {
    // Read from search index
    return this.searchIndex.search(query);
  }
}
```

## Caching Strategies

Implement efficient caching:

```typescript
export class ArticleService extends BaseCrudService<...> {
  private cache: CacheService;

  public async getById(
    actor: Actor,
    id: string
  ): Promise<ServiceOutput<Article | null>> {
    // Try cache first
    const cacheKey = `article:${id}`;
    const cached = await this.cache.get<Article>(cacheKey);

    if (cached) {
      this._canView(actor, cached);
      return { data: cached };
    }

    // Call base implementation
    const result = await super.getById(actor, id);

    // Cache successful result
    if (result.data) {
      await this.cache.set(cacheKey, result.data, { ttl: 3600 }); // 1 hour
    }

    return result;
  }

  protected async _afterUpdate(
    entity: Article,
    actor: Actor
  ): Promise<Article> {
    // Invalidate cache
    await this.cache.delete(`article:${entity.id}`);
    await this.cache.deletePattern(`article:list:*`);

    return entity;
  }
}
```

## Pagination Optimization

Optimize large result sets:

```typescript
// Cursor-based pagination (more efficient for large datasets)
public async listWithCursor(
  actor: Actor,
  cursor?: string,
  pageSize = 20
): Promise<ServiceOutput<{
  items: Article[];
  nextCursor: string | null;
  hasMore: boolean;
}>> {
  return this.runWithLoggingAndValidation({
    methodName: 'listWithCursor',
    input: { actor, cursor, pageSize },
    schema: z.object({
      cursor: z.string().optional(),
      pageSize: z.number().min(1).max(100)
    }),
    execute: async (data, validatedActor) => {
      const items = await this.model.findWithCursor({
        cursor: data.cursor,
        limit: data.pageSize + 1 // Fetch one extra to check if there's more
      });

      const hasMore = items.length > data.pageSize;
      const results = hasMore ? items.slice(0, -1) : items;

      const nextCursor = hasMore
        ? Buffer.from(results[results.length - 1].id).toString('base64')
        : null;

      return {
        items: results,
        nextCursor,
        hasMore
      };
    }
  });
}
```

## Bulk Operations

Efficiently handle bulk operations:

```typescript
public async bulkCreate(
  actor: Actor,
  items: CreateArticleInput[]
): Promise<ServiceOutput<BulkResult<Article>>> {
  return this.runWithLoggingAndValidation({
    methodName: 'bulkCreate',
    input: { actor, items },
    schema: z.object({
      items: z.array(CreateArticleSchema).min(1).max(1000)
    }),
    execute: async (data, validatedActor) => {
      const result: BulkResult<Article> = {
        success: [],
        failed: [],
        total: data.items.length
      };

      // Process in batches to avoid overwhelming DB
      const batchSize = 100;
      for (let i = 0; i < data.items.length; i += batchSize) {
        const batch = data.items.slice(i, i + batchSize);

        const promises = batch.map(item =>
          this.create(validatedActor, item).catch(error => ({ error }))
        );

        const results = await Promise.all(promises);

        results.forEach((res, idx) => {
          if ('error' in res) {
            result.failed.push({
              item: batch[idx],
              error: res.error
            });
          } else if (res.data) {
            result.success.push(res.data);
          }
        });
      }

      return result;
    }
  });
}
```

## Background Jobs

Offload long-running tasks:

```typescript
public async generateReport(
  actor: Actor,
  reportType: ReportType,
  filters: ReportFilters
): Promise<ServiceOutput<{ jobId: string }>> {
  return this.runWithLoggingAndValidation({
    methodName: 'generateReport',
    input: { actor, reportType, filters },
    schema: ReportGenerationSchema,
    execute: async (data, validatedActor) => {
      // Queue background job
      const job = await this.jobQueue.add('generate-report', {
        reportType: data.reportType,
        filters: data.filters,
        requestedBy: validatedActor.id,
        requestedAt: new Date()
      });

      // Store job reference
      await this.jobModel.create({
        id: job.id,
        type: 'report-generation',
        status: 'pending',
        userId: validatedActor.id,
        data: { reportType: data.reportType, filters: data.filters }
      });

      return { jobId: job.id };
    }
  });
}

// Job processor (runs in background worker)
async function processReportGeneration(job: Job) {
  const { reportType, filters, requestedBy } = job.data;

  try {
    // Generate report
    const report = await generateReportData(reportType, filters);

    // Upload to storage
    const url = await storage.upload(`reports/${job.id}.pdf`, report);

    // Update job status
    await jobModel.update({ id: job.id }, {
      status: 'completed',
      resultUrl: url
    });

    // Notify user
    await notificationService.send({
      userId: requestedBy,
      type: 'report-ready',
      data: { url }
    });
  } catch (error) {
    await jobModel.update({ id: job.id }, {
      status: 'failed',
      error: error.message
    });
  }
}
```

## Rate Limiting

Protect services from abuse:

```typescript
export class ArticleService extends BaseCrudService<...> {
  private rateLimiter: RateLimiter;

  public async create(
    actor: Actor,
    data: CreateArticleInput
  ): Promise<ServiceOutput<Article>> {
    // Check rate limit (5 articles per hour per user)
    const allowed = await this.rateLimiter.check({
      key: `article:create:${actor.id}`,
      limit: 5,
      window: 3600 // 1 hour in seconds
    });

    if (!allowed) {
      throw new ServiceError(
        ServiceErrorCode.RATE_LIMIT_EXCEEDED,
        'You have exceeded the maximum number of articles per hour'
      );
    }

    return super.create(actor, data);
  }
}
```

## Multi-Tenancy

Support multiple tenants in same database:

```typescript
export class ArticleService extends BaseCrudService<...> {
  // Add tenant filter to all queries
  protected async _beforeList(
    options: ListOptions,
    actor: Actor
  ): Promise<ListOptions> {
    return {
      ...options,
      filters: {
        ...options.filters,
        tenantId: actor.tenantId // Filter by tenant
      }
    };
  }

  protected async _beforeSearch(
    params: ArticleSearchInput,
    actor: Actor
  ): Promise<ArticleSearchInput> {
    return {
      ...params,
      tenantId: actor.tenantId // Filter by tenant
    };
  }

  protected async _beforeCreate(
    data: CreateArticleInput,
    actor: Actor
  ): Promise<Partial<Article>> {
    return {
      ...data,
      tenantId: actor.tenantId // Set tenant on creation
    };
  }
}
```

---

**See Also:**
- [Performance Guide](./performance.md) - Optimization techniques
- [Examples](../examples/complex-logic.ts) - Complex patterns in action
