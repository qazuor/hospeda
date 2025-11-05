/**
 * Service with Lifecycle Hooks Example - ArticleService
 *
 * This file demonstrates comprehensive use of lifecycle hooks:
 * - Before/after create hooks
 * - Before/after update hooks
 * - Before/after delete hooks
 * - Data transformation
 * - Side effects (notifications, indexing)
 * - Cache invalidation
 */

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

// Mock services for demonstration
class NotificationService {
  async send(notification: { type: string; data: unknown }) {
    console.log('Notification sent:', notification.type);
  }
}

class SearchIndexService {
  async index(article: Article) {
    console.log('Indexed article:', article.id);
  }
  async update(article: Article) {
    console.log('Updated index:', article.id);
  }
  async remove(articleId: string) {
    console.log('Removed from index:', articleId);
  }
}

class CacheService {
  async delete(key: string) {
    console.log('Cache deleted:', key);
  }
  async deletePattern(pattern: string) {
    console.log('Cache pattern deleted:', pattern);
  }
}

/**
 * Service demonstrating lifecycle hook patterns
 */
export class ArticleService extends BaseCrudService<
  Article,
  ArticleModel,
  typeof ArticleCreateInputSchema,
  typeof ArticleUpdateInputSchema,
  typeof ArticleSearchSchema
> {
  static readonly ENTITY_NAME = 'article';
  protected readonly entityName = ArticleService.ENTITY_NAME;

  public readonly model: ArticleModel;
  public readonly createSchema = ArticleCreateInputSchema;
  public readonly updateSchema = ArticleUpdateInputSchema;
  public readonly searchSchema = ArticleSearchSchema;

  // Injected services for side effects
  private notificationService: NotificationService;
  private searchIndexService: SearchIndexService;
  private cacheService: CacheService;

  constructor(ctx: ServiceContext, model?: ArticleModel) {
    super(ctx, ArticleService.ENTITY_NAME);
    this.model = model ?? new ArticleModel();

    // Initialize services
    this.notificationService = new NotificationService();
    this.searchIndexService = new SearchIndexService();
    this.cacheService = new CacheService();
  }

  protected getDefaultListRelations(): ListRelationsConfig {
    return {
      createdBy: { columns: { id: true, name: true, email: true } },
      category: true
    };
  }

  // ============================================================================
  // PERMISSION HOOKS (simplified for example)
  // ============================================================================

  protected _canCreate(actor: Actor, _data: unknown): void {
    if (!actor?.id) throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }

  protected _canUpdate(actor: Actor, entity: Article): void {
    if (!actor?.id) throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
    if (entity.createdById !== actor.id && actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not your article');
    }
  }

  protected _canSoftDelete(actor: Actor, entity: Article): void {
    this._canUpdate(actor, entity);
  }

  protected _canHardDelete(actor: Actor, _entity: Article): void {
    if (actor.role !== RoleEnum.SUPER_ADMIN) {
      throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Super admin only');
    }
  }

  protected _canRestore(actor: Actor, _entity: Article): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Admin only');
    }
  }

  protected _canView(actor: Actor, entity: Article): void {
    if (entity.status === 'published') return; // Public
    if (!actor?.id) throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
    if (entity.createdById !== actor.id && actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not published');
    }
  }

  protected _canList(actor: Actor): void {}
  protected _canSearch(actor: Actor): void {}
  protected _canCount(actor: Actor): void {}

  // ============================================================================
  // LIFECYCLE HOOKS - CREATE
  // ============================================================================

  /**
   * Before create hook: Generate slug and set defaults
   *
   * Demonstrates:
   * - Slug generation from title
   * - Ensuring slug uniqueness
   * - Setting default values
   * - Initializing counters
   */
  protected async _beforeCreate(
    data: typeof ArticleCreateInputSchema._type,
    actor: Actor
  ): Promise<Partial<Article>> {
    // Generate slug from title if not provided
    const baseSlug = data.slug || this.slugify(data.title);

    // Ensure slug uniqueness by appending counter if needed
    let slug = baseSlug;
    let counter = 1;

    while (await this.model.exists({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return {
      ...data,
      slug,
      status: data.status || 'draft',
      viewCount: 0,
      createdAt: new Date(),
      createdById: actor.id
    };
  }

  /**
   * After create hook: Trigger side effects
   *
   * Demonstrates:
   * - Sending notifications
   * - Indexing for search
   * - Logging activity
   * - Non-blocking operations
   */
  protected async _afterCreate(
    entity: Article,
    actor: Actor
  ): Promise<Article> {
    // Send notification to admin about new article
    await this.notificationService.send({
      type: 'article.created',
      data: {
        articleId: entity.id,
        title: entity.title,
        authorId: actor.id,
        status: entity.status
      }
    });

    // Index for search (fire and forget to not block response)
    this.searchIndexService.index(entity).catch(err =>
      this.logger.error('Failed to index article', err)
    );

    // Log activity (also non-blocking)
    this.logActivity({
      action: 'article.created',
      actorId: actor.id,
      resourceId: entity.id
    }).catch(console.error);

    return entity;
  }

  // ============================================================================
  // LIFECYCLE HOOKS - UPDATE
  // ============================================================================

  /**
   * Before update hook: Handle slug changes and timestamps
   *
   * Demonstrates:
   * - Regenerating slug when title changes
   * - Setting publish date when status changes
   * - Updating timestamps
   */
  protected async _beforeUpdate(
    data: typeof ArticleUpdateInputSchema._type,
    actor: Actor
  ): Promise<Partial<Article>> {
    const updates: Partial<Article> = { ...data };

    // If title changed, regenerate slug
    if (data.title) {
      updates.slug = this.slugify(data.title);
    }

    // If status changed to published, set publish date
    if (data.status === 'published' && !data.publishedAt) {
      updates.publishedAt = new Date();
    }

    // If status changed from published, clear publish date
    if (data.status !== 'published' && data.status) {
      updates.publishedAt = null;
    }

    // Update audit fields
    updates.updatedById = actor.id;
    updates.updatedAt = new Date();

    return updates;
  }

  /**
   * After update hook: Cache invalidation and notifications
   *
   * Demonstrates:
   * - Invalidating caches
   * - Updating search index
   * - Conditional notifications based on changes
   */
  protected async _afterUpdate(
    entity: Article,
    actor: Actor
  ): Promise<Article> {
    // Invalidate all article caches
    await this.cacheService.delete(`article:${entity.id}`);
    await this.cacheService.delete(`article:slug:${entity.slug}`);
    await this.cacheService.deletePattern('article:list:*');

    // Update search index
    this.searchIndexService.update(entity).catch(err =>
      this.logger.error('Failed to update search index', err)
    );

    // If article was published, notify subscribers
    if (entity.status === 'published') {
      this.notificationService.send({
        type: 'article.published',
        data: {
          articleId: entity.id,
          title: entity.title,
          authorId: entity.createdById
        }
      }).catch(console.error);
    }

    return entity;
  }

  // ============================================================================
  // LIFECYCLE HOOKS - DELETE
  // ============================================================================

  /**
   * Before soft delete hook: Validation checks
   *
   * Demonstrates:
   * - Checking for dependent resources
   * - Preventing deletion based on business rules
   */
  protected async _beforeSoftDelete(
    id: string,
    actor: Actor
  ): Promise<string> {
    // Check if article has published comments
    const hasComments = await this.model.hasPublishedComments(id);

    if (hasComments) {
      throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Cannot delete article with published comments. Please archive instead.'
      );
    }

    return id;
  }

  /**
   * After soft delete hook: Cleanup
   *
   * Demonstrates:
   * - Cache invalidation
   * - Removing from search index
   * - Notifying stakeholders
   */
  protected async _afterSoftDelete(
    result: { count: number },
    actor: Actor
  ): Promise<{ count: number }> {
    if (result.count > 0) {
      // Remove from caches
      await this.cacheService.deletePattern('article:*');

      // Remove from search index (don't await - fire and forget)
      this.searchIndexService.remove(actor.id).catch(console.error);

      // Notify author
      this.notificationService.send({
        type: 'article.deleted',
        data: { authorId: actor.id }
      }).catch(console.error);
    }

    return result;
  }

  /**
   * After restore hook: Re-index and notify
   *
   * Demonstrates:
   * - Re-adding to search index
   * - Notifying about restoration
   */
  protected async _afterRestore(
    result: { count: number },
    actor: Actor
  ): Promise<{ count: number }> {
    if (result.count > 0) {
      // Get restored entity
      const entity = await this.model.findById(actor.id);

      if (entity) {
        // Re-index
        this.searchIndexService.index(entity).catch(console.error);

        // Notify
        this.notificationService.send({
          type: 'article.restored',
          data: { articleId: entity.id }
        }).catch(console.error);
      }
    }

    return result;
  }

  // ============================================================================
  // SEARCH & COUNT
  // ============================================================================

  protected async _executeSearch(
    params: Record<string, unknown>,
    actor: Actor
  ): Promise<PaginatedListOutput<Article>> {
    const { page = 1, pageSize = 20, status, categoryId, ...rest } = params;

    const filters: Record<string, unknown> = { ...rest };

    // Non-authenticated users only see published
    if (!actor?.id) {
      filters.status = 'published';
    } else if (status) {
      filters.status = status;
    }

    if (categoryId) filters.categoryId = categoryId;

    return this.model.findAll(filters, { page, pageSize });
  }

  protected async _executeCount(
    params: Record<string, unknown>,
    actor: Actor
  ): Promise<{ count: number }> {
    const { status, categoryId } = params;

    const filters: Record<string, unknown> = {};

    if (!actor?.id) {
      filters.status = 'published';
    } else if (status) {
      filters.status = status;
    }

    if (categoryId) filters.categoryId = categoryId;

    const count = await this.model.count(filters);
    return { count };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async logActivity(activity: {
    action: string;
    actorId: string;
    resourceId: string;
  }): Promise<void> {
    this.logger.info('Activity logged', activity);
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
const service = new ArticleService({ logger: console });

const userActor: Actor = {
  id: 'user-1',
  role: RoleEnum.USER,
  permissions: []
};

// Create article - triggers beforeCreate and afterCreate hooks
const result = await service.create(userActor, {
  title: 'My First Article',
  content: 'This is the content of my article...',
  categoryId: 'cat-123'
});
// Hooks executed:
// 1. _beforeCreate: Generated slug "my-first-article"
// 2. _afterCreate: Sent notification, indexed for search

// Update article - triggers beforeUpdate and afterUpdate hooks
const updated = await service.update(userActor, result.data!.id, {
  title: 'My Updated Article'
});
// Hooks executed:
// 1. _beforeUpdate: Regenerated slug to "my-updated-article"
// 2. _afterUpdate: Invalidated caches, updated search index

// Delete article - triggers beforeSoftDelete and afterSoftDelete hooks
const deleted = await service.softDelete(userActor, result.data!.id);
// Hooks executed:
// 1. _beforeSoftDelete: Checked for published comments
// 2. _afterSoftDelete: Removed from cache and search index
*/
