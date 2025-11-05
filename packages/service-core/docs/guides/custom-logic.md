# Custom Business Logic - Patterns and Best Practices

Guide for implementing custom business methods in services.

## Table of Contents

- [When to Add Custom Methods](#when-to-add-custom-methods)
- [Method Naming Conventions](#method-naming-conventions)
- [RO-RO Pattern](#ro-ro-pattern)
- [Common Business Logic Patterns](#common-business-logic-patterns)
- [Service Composition](#service-composition)
- [Error Handling](#error-handling)
- [Complete Examples](#complete-examples)

## When to Add Custom Methods

Add custom methods when you need operations beyond standard CRUD:

**✅ Add Custom Method For:**
- Status transitions (draft → published)
- Complex calculations (pricing, ratings)
- Aggregations (stats, summaries)
- Batch operations (bulk updates)
- Business workflows (approval, refund)
- External API integrations (payment, email)

**❌ Use Lifecycle Hooks Instead:**
- Logic that runs on every create/update
- Automatic field generation
- Standard validation
- Side effects (notifications, logging)

## Method Naming Conventions

Use clear, descriptive names that indicate the action:

```typescript
// Status transitions
publish()
unpublish()
archive()
approve()
reject()

// Calculations
calculateTotal()
calculateDiscount()
calculateRating()

// Aggregations
getStatistics()
getSummary()
getTopRated()

// Batch operations
bulkUpdate()
bulkDelete()
bulkImport()

// Workflows
processPayment()
processRefund()
sendReminder()
```

## RO-RO Pattern

**Receive Object, Return Object**: All methods accept objects and return `ServiceOutput<T>`.

```typescript
// ✅ GOOD: RO-RO pattern
public async publish(
  actor: Actor,
  articleId: string,
  options?: { notifySubscribers?: boolean }
): Promise<ServiceOutput<Article>> {
  // Implementation
}

// ❌ BAD: Too many positional arguments
public async publish(
  actor: Actor,
  articleId: string,
  notifySubscribers: boolean,
  scheduleDate: Date | null,
  priorit: number
): Promise<ServiceOutput<Article>> {
  // Hard to read and maintain
}
```

### Method Structure Template

```typescript
/**
 * Method description
 *
 * Business Rules:
 * - Rule 1
 * - Rule 2
 *
 * @param actor - User performing the action
 * @param param1 - Parameter description
 * @returns ServiceOutput with result
 */
public async methodName(
  actor: Actor,
  param1: string,
  options?: {
    optional1?: boolean;
    optional2?: number;
  }
): Promise<ServiceOutput<ReturnType>> {
  return this.runWithLoggingAndValidation({
    methodName: 'methodName',
    input: { actor, param1, ...options },
    schema: z.object({
      param1: z.string(),
      optional1: z.boolean().optional(),
      optional2: z.number().optional()
    }),
    execute: async (validatedData, validatedActor) => {
      // 1. Permission checks
      // 2. Fetch necessary data
      // 3. Business logic
      // 4. Database operations
      // 5. Return result
    }
  });
}
```

## Common Business Logic Patterns

### Pattern 1: Status Transitions

Manage entity state changes with validation:

```typescript
/**
 * Publish an article (draft → published)
 *
 * Business Rules:
 * - Only drafts can be published
 * - Must have title, content, and category
 * - Content must be at least 100 characters
 * - Author or admin can publish
 */
public async publish(
  actor: Actor,
  articleId: string
): Promise<ServiceOutput<Article>> {
  return this.runWithLoggingAndValidation({
    methodName: 'publish',
    input: { actor, articleId },
    schema: z.object({ articleId: z.string().uuid() }),
    execute: async (data, validatedActor) => {
      // 1. Fetch article
      const articleResult = await this.getById(validatedActor, data.articleId);
      if (!articleResult.data) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
      }

      const article = articleResult.data;

      // 2. Check permission
      this._canUpdate(validatedActor, article);

      // 3. Validate current state
      if (article.status !== 'draft') {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Only draft articles can be published'
        );
      }

      // 4. Validate business rules
      if (!article.title || !article.content || !article.categoryId) {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Article must have title, content, and category'
        );
      }

      if (article.content.length < 100) {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Content must be at least 100 characters'
        );
      }

      // 5. Perform transition
      const updateResult = await this.update(validatedActor, data.articleId, {
        status: 'published',
        publishedAt: new Date()
      });

      if (!updateResult.data) {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to publish');
      }

      return updateResult.data;
    }
  });
}
```

### Pattern 2: Calculations

Complex calculations encapsulated in services:

```typescript
/**
 * Calculate article statistics
 *
 * Returns:
 * - Total views
 * - Average rating
 * - Comment count
 * - Share count
 */
public async calculateStats(
  actor: Actor,
  articleId: string
): Promise<ServiceOutput<ArticleStats>> {
  return this.runWithLoggingAndValidation({
    methodName: 'calculateStats',
    input: { actor, articleId },
    schema: z.object({ articleId: z.string().uuid() }),
    execute: async (data, validatedActor) => {
      // Fetch article
      const articleResult = await this.getById(validatedActor, data.articleId);
      if (!articleResult.data) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
      }

      // Run calculations in parallel
      const [viewCount, ratings, commentCount, shareCount] = await Promise.all([
        this.model.getViewCount(data.articleId),
        this.ratingModel.findAll({ articleId: data.articleId }),
        this.commentModel.count({ articleId: data.articleId }),
        this.shareModel.count({ articleId: data.articleId })
      ]);

      // Calculate average rating
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length
        : 0;

      return {
        articleId: data.articleId,
        viewCount,
        averageRating,
        ratingCount: ratings.length,
        commentCount,
        shareCount,
        engagementScore: this.calculateEngagementScore({
          viewCount,
          averageRating,
          commentCount,
          shareCount
        })
      };
    }
  });
}

/**
 * Calculate engagement score (internal helper)
 */
private calculateEngagementScore(stats: {
  viewCount: number;
  averageRating: number;
  commentCount: number;
  shareCount: number;
}): number {
  // Weighted formula
  const viewScore = stats.viewCount * 0.1;
  const ratingScore = stats.averageRating * 10;
  const commentScore = stats.commentCount * 5;
  const shareScore = stats.shareCount * 15;

  return Math.round(viewScore + ratingScore + commentScore + shareScore);
}
```

### Pattern 3: Aggregations

Fetch and combine data from multiple sources:

```typescript
/**
 * Get featured articles with enriched data
 *
 * Returns top 10 featured articles with:
 * - Author information
 * - Category data
 * - Comment count
 * - Rating average
 */
public async getFeaturedArticles(
  actor: Actor,
  options?: { limit?: number }
): Promise<ServiceOutput<EnrichedArticle[]>> {
  return this.runWithLoggingAndValidation({
    methodName: 'getFeaturedArticles',
    input: { actor, ...options },
    schema: z.object({
      limit: z.number().min(1).max(50).default(10)
    }),
    execute: async (data, validatedActor) => {
      // Permission check
      this._canList(validatedActor);

      // Get featured articles
      const articles = await this.model.findAll(
        { isFeatured: true, status: 'published' },
        { page: 1, pageSize: data.limit, orderBy: { field: 'publishedAt', direction: 'desc' } }
      );

      // Enrich with related data
      const enriched = await Promise.all(
        articles.items.map(async (article) => {
          const [author, category, commentCount, avgRating] = await Promise.all([
            this.userModel.findById(article.createdById),
            this.categoryModel.findById(article.categoryId),
            this.commentModel.count({ articleId: article.id }),
            this.ratingModel.getAverage({ articleId: article.id })
          ]);

          return {
            ...article,
            author: {
              id: author.id,
              name: author.name,
              avatar: author.avatar
            },
            category: {
              id: category.id,
              name: category.name,
              slug: category.slug
            },
            stats: {
              commentCount,
              averageRating: avgRating
            }
          };
        })
      );

      return enriched;
    }
  });
}
```

### Pattern 4: Batch Operations

Handle multiple items efficiently:

```typescript
/**
 * Bulk publish articles
 *
 * Business Rules:
 * - All articles must be drafts
 * - Actor must have permission for each article
 * - Validation errors don't stop the batch
 *
 * Returns:
 * - Success count
 * - Error count
 * - Detailed results per article
 */
public async bulkPublish(
  actor: Actor,
  articleIds: string[]
): Promise<ServiceOutput<BulkOperationResult>> {
  return this.runWithLoggingAndValidation({
    methodName: 'bulkPublish',
    input: { actor, articleIds },
    schema: z.object({
      articleIds: z.array(z.string().uuid()).min(1).max(100)
    }),
    execute: async (data, validatedActor) => {
      const results: BulkOperationResult = {
        total: data.articleIds.length,
        success: 0,
        failed: 0,
        details: []
      };

      // Process each article
      for (const articleId of data.articleIds) {
        try {
          const result = await this.publish(validatedActor, articleId);

          if (result.data) {
            results.success++;
            results.details.push({
              articleId,
              status: 'success',
              data: result.data
            });
          } else {
            results.failed++;
            results.details.push({
              articleId,
              status: 'error',
              error: result.error
            });
          }
        } catch (error) {
          results.failed++;
          results.details.push({
            articleId,
            status: 'error',
            error: {
              code: ServiceErrorCode.INTERNAL_ERROR,
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      }

      return results;
    }
  });
}
```

### Pattern 5: External API Integration

Integrate with external services:

```typescript
/**
 * Send article via email
 *
 * Integrates with SendGrid to email article to recipient
 *
 * Business Rules:
 * - Article must be published
 * - Actor must have permission to view article
 * - Email must be valid
 */
public async sendViaEmail(
  actor: Actor,
  articleId: string,
  recipientEmail: string
): Promise<ServiceOutput<{ sent: boolean; messageId: string }>> {
  return this.runWithLoggingAndValidation({
    methodName: 'sendViaEmail',
    input: { actor, articleId, recipientEmail },
    schema: z.object({
      articleId: z.string().uuid(),
      recipientEmail: z.string().email()
    }),
    execute: async (data, validatedActor) => {
      // Get article
      const articleResult = await this.getById(validatedActor, data.articleId);
      if (!articleResult.data) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
      }

      const article = articleResult.data;

      // Check article is published
      if (article.status !== 'published') {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Only published articles can be shared via email'
        );
      }

      // Send email via external service
      try {
        const result = await this.emailService.send({
          to: data.recipientEmail,
          subject: article.title,
          template: 'article-share',
          data: {
            articleTitle: article.title,
            articleExcerpt: article.excerpt,
            articleUrl: `https://example.com/articles/${article.slug}`,
            senderName: validatedActor.name
          }
        });

        // Log the share
        await this.shareModel.create({
          articleId: data.articleId,
          sharedById: validatedActor.id,
          sharedVia: 'email',
          recipientEmail: data.recipientEmail
        });

        return {
          sent: true,
          messageId: result.messageId
        };
      } catch (error) {
        throw new ServiceError(
          ServiceErrorCode.INTERNAL_ERROR,
          'Failed to send email',
          error
        );
      }
    }
  });
}
```

## Service Composition

Use other services within your service:

```typescript
export class ArticleService extends BaseCrudService<...> {
  // Inject other services
  private commentService: CommentService;
  private categoryService: CategoryService;
  private notificationService: NotificationService;

  constructor(ctx: ServiceContext, model?: ArticleModel) {
    super(ctx, 'article');
    this.model = model ?? new ArticleModel();

    // Initialize dependent services
    this.commentService = new CommentService(ctx);
    this.categoryService = new CategoryService(ctx);
    this.notificationService = new NotificationService(ctx);
  }

  /**
   * Get article with full details
   *
   * Combines data from multiple services:
   * - Article data
   * - Category information
   * - Comment statistics
   * - Related articles
   */
  public async getFullDetails(
    actor: Actor,
    articleId: string
  ): Promise<ServiceOutput<ArticleFullDetails>> {
    return this.runWithLoggingAndValidation({
      methodName: 'getFullDetails',
      input: { actor, articleId },
      schema: z.object({ articleId: z.string().uuid() }),
      execute: async (data, validatedActor) => {
        // Get base article
        const articleResult = await this.getById(validatedActor, data.articleId);
        if (!articleResult.data) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
        }

        const article = articleResult.data;

        // Fetch related data using other services
        const [categoryResult, comments, relatedArticles] = await Promise.all([
          this.categoryService.getById(validatedActor, article.categoryId),
          this.commentService.search(validatedActor, {
            articleId: data.articleId,
            status: 'approved',
            page: 1,
            pageSize: 10
          }),
          this.findRelated(validatedActor, data.articleId)
        ]);

        return {
          article,
          category: categoryResult.data!,
          comments: comments.data!,
          relatedArticles: relatedArticles.data!
        };
      }
    });
  }

  /**
   * Delete article with cascade
   *
   * Deletes article and all related data using other services
   */
  public async deleteWithCascade(
    actor: Actor,
    articleId: string
  ): Promise<ServiceOutput<{ deleted: boolean }>> {
    return this.runWithLoggingAndValidation({
      methodName: 'deleteWithCascade',
      input: { actor, articleId },
      schema: z.object({ articleId: z.string().uuid() }),
      execute: async (data, validatedActor) => {
        // Check permission
        const articleResult = await this.getById(validatedActor, data.articleId);
        if (!articleResult.data) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Article not found');
        }

        this._canSoftDelete(validatedActor, articleResult.data);

        // Delete related data using other services
        await Promise.all([
          this.commentService.bulkDelete(validatedActor, { articleId: data.articleId }),
          this.shareModel.delete({ articleId: data.articleId }),
          this.bookmarkModel.delete({ articleId: data.articleId })
        ]);

        // Finally delete the article
        const deleteResult = await this.softDelete(validatedActor, data.articleId);

        return {
          deleted: deleteResult.data?.count === 1
        };
      }
    });
  }
}
```

## Error Handling

Always use `ServiceError` with appropriate error codes:

```typescript
public async customMethod(actor: Actor, id: string): Promise<ServiceOutput<Result>> {
  return this.runWithLoggingAndValidation({
    methodName: 'customMethod',
    input: { actor, id },
    schema: z.object({ id: z.string().uuid() }),
    execute: async (data, validatedActor) => {
      // Validation errors
      if (someCondition) {
        throw new ServiceError(
          ServiceErrorCode.VALIDATION_ERROR,
          'Detailed message explaining what went wrong'
        );
      }

      // Not found errors
      const entity = await this.model.findById(data.id);
      if (!entity) {
        throw new ServiceError(
          ServiceErrorCode.NOT_FOUND,
          'Resource not found'
        );
      }

      // Permission errors
      if (!canPerformAction) {
        throw new ServiceError(
          ServiceErrorCode.FORBIDDEN,
          'You do not have permission to perform this action'
        );
      }

      // External service errors
      try {
        await externalService.call();
      } catch (error) {
        throw new ServiceError(
          ServiceErrorCode.INTERNAL_ERROR,
          'External service failed',
          error  // Include original error for debugging
        );
      }

      return result;
    }
  });
}
```

## Complete Examples

See:
- [custom-methods.ts](../examples/custom-methods.ts) - Various custom method patterns
- [complex-logic.ts](../examples/complex-logic.ts) - Complex business logic

---

**Next Steps:**
- **[Testing Guide](./testing.md)** - Test custom methods
- **[Advanced Patterns](./advanced-patterns.md)** - Advanced techniques
- **[Examples](../examples/)** - Working code
