/**
 * Custom Methods Example - BlogService
 *
 * Demonstrates various custom method patterns:
 * - Status transitions (publish/unpublish)
 * - Atomic counters (incrementViews)
 * - Custom queries (getFeaturedPosts)
 * - Complex search (searchByTags)
 * - Background jobs (schedulePublish)
 */

import { BlogPostModel } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { BlogPost } from '@repo/schemas/entities/blogPost';
import {
  BlogPostCreateInputSchema,
  BlogPostUpdateInputSchema,
  BlogPostSearchSchema
} from '@repo/schemas/entities/blogPost';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput, PaginatedListOutput } from '../../types';
import { ServiceError } from '../../types';
import { z } from 'zod';

export class BlogService extends BaseCrudService<
  BlogPost,
  BlogPostModel,
  typeof BlogPostCreateInputSchema,
  typeof BlogPostUpdateInputSchema,
  typeof BlogPostSearchSchema
> {
  static readonly ENTITY_NAME = 'blogPost';
  protected readonly entityName = BlogService.ENTITY_NAME;

  public readonly model: BlogPostModel;
  public readonly createSchema = BlogPostCreateInputSchema;
  public readonly updateSchema = BlogPostUpdateInputSchema;
  public readonly searchSchema = BlogPostSearchSchema;

  constructor(ctx: ServiceContext, model?: BlogPostModel) {
    super(ctx, BlogService.ENTITY_NAME);
    this.model = model ?? new BlogPostModel();
  }

  protected getDefaultListRelations(): ListRelationsConfig {
    return { author: true, category: true };
  }

  // Simplified permission hooks
  protected _canCreate(actor: Actor, _data: unknown): void {
    if (!actor?.id) throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
  }
  protected _canUpdate(actor: Actor, entity: BlogPost): void {
    if (entity.createdById !== actor.id && actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not your post');
    }
  }
  protected _canSoftDelete(actor: Actor, entity: BlogPost): void { this._canUpdate(actor, entity); }
  protected _canHardDelete(actor: Actor, _entity: BlogPost): void {
    if (actor.role !== RoleEnum.SUPER_ADMIN) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Super admin only');
  }
  protected _canRestore(actor: Actor, _entity: BlogPost): void {
    if (actor.role !== RoleEnum.ADMIN) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Admin only');
  }
  protected _canView(actor: Actor, entity: BlogPost): void {
    if (entity.status === 'published') return;
    if (!actor?.id || (entity.createdById !== actor.id && actor.role !== RoleEnum.ADMIN)) {
      throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not published');
    }
  }
  protected _canList(_actor: Actor): void {}
  protected _canSearch(_actor: Actor): void {}
  protected _canCount(_actor: Actor): void {}

  protected async _executeSearch(params: Record<string, unknown>, _actor: Actor): Promise<PaginatedListOutput<BlogPost>> {
    const { page = 1, pageSize = 20, ...filters } = params;
    return this.model.findAll(filters, { page, pageSize });
  }

  protected async _executeCount(params: Record<string, unknown>, _actor: Actor): Promise<{ count: number }> {
    const count = await this.model.count(params);
    return { count };
  }

  // ============================================================================
  // PATTERN 1: Status Transitions
  // ============================================================================

  /**
   * Publish a draft post
   *
   * Pattern: State transition with validation
   */
  public async publish(
    actor: Actor,
    postId: string
  ): Promise<ServiceOutput<BlogPost>> {
    return this.runWithLoggingAndValidation({
      methodName: 'publish',
      input: { actor, postId },
      schema: z.object({ postId: z.string() }),
      execute: async (data, validatedActor) => {
        const postResult = await this.getById(validatedActor, data.postId);
        if (!postResult.data) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
        }

        const post = postResult.data;
        this._canUpdate(validatedActor, post);

        if (post.status !== 'draft') {
          throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Only draft posts can be published'
          );
        }

        const updateResult = await this.update(validatedActor, data.postId, {
          status: 'published',
          publishedAt: new Date()
        });

        return updateResult.data!;
      }
    });
  }

  /**
   * Unpublish a post (revert to draft)
   */
  public async unpublish(
    actor: Actor,
    postId: string
  ): Promise<ServiceOutput<BlogPost>> {
    return this.runWithLoggingAndValidation({
      methodName: 'unpublish',
      input: { actor, postId },
      schema: z.object({ postId: z.string() }),
      execute: async (data, validatedActor) => {
        const postResult = await this.getById(validatedActor, data.postId);
        if (!postResult.data) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
        }

        this._canUpdate(validatedActor, postResult.data);

        const updateResult = await this.update(validatedActor, data.postId, {
          status: 'draft',
          publishedAt: null
        });

        return updateResult.data!;
      }
    });
  }

  // ============================================================================
  // PATTERN 2: Atomic Counter Updates
  // ============================================================================

  /**
   * Increment view count
   *
   * Pattern: Lightweight atomic operation without full update permissions
   */
  public async incrementViews(
    postId: string
  ): Promise<ServiceOutput<{ views: number }>> {
    return this.runWithLoggingAndValidation({
      methodName: 'incrementViews',
      input: { postId },
      schema: z.object({ postId: z.string() }),
      execute: async (data) => {
        const result = await this.model.incrementField(data.postId, 'views', 1);

        if (!result) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
        }

        return { views: result.views };
      }
    });
  }

  // ============================================================================
  // PATTERN 3: Custom Queries
  // ============================================================================

  /**
   * Get featured posts
   *
   * Pattern: Curated list with specific criteria
   */
  public async getFeaturedPosts(
    actor: Actor,
    limit = 10
  ): Promise<ServiceOutput<BlogPost[]>> {
    return this.runWithLoggingAndValidation({
      methodName: 'getFeaturedPosts',
      input: { actor, limit },
      schema: z.object({ limit: z.number().min(1).max(50) }),
      execute: async (data, validatedActor) => {
        this._canList(validatedActor);

        const posts = await this.model.findAll(
          { isFeatured: true, status: 'published' },
          { page: 1, pageSize: data.limit, orderBy: { field: 'publishedAt', direction: 'desc' } }
        );

        return posts.items;
      }
    });
  }

  /**
   * Get popular posts (most views)
   */
  public async getPopularPosts(
    actor: Actor,
    limit = 10
  ): Promise<ServiceOutput<BlogPost[]>> {
    return this.runWithLoggingAndValidation({
      methodName: 'getPopularPosts',
      input: { actor, limit },
      schema: z.object({ limit: z.number().min(1).max(50) }),
      execute: async (data, validatedActor) => {
        this._canList(validatedActor);

        const posts = await this.model.findAll(
          { status: 'published' },
          { page: 1, pageSize: data.limit, orderBy: { field: 'views', direction: 'desc' } }
        );

        return posts.items;
      }
    });
  }

  // ============================================================================
  // PATTERN 4: Complex Search
  // ============================================================================

  /**
   * Search posts by tags
   *
   * Pattern: Array field search with multiple tags
   */
  public async searchByTags(
    actor: Actor,
    tags: string[],
    options?: { page?: number; pageSize?: number }
  ): Promise<ServiceOutput<PaginatedListOutput<BlogPost>>> {
    return this.runWithLoggingAndValidation({
      methodName: 'searchByTags',
      input: { actor, tags, ...options },
      schema: z.object({
        tags: z.array(z.string()).min(1),
        page: z.number().optional(),
        pageSize: z.number().optional()
      }),
      execute: async (data, validatedActor) => {
        this._canSearch(validatedActor);

        const result = await this.model.findAll(
          { tags: data.tags, status: 'published' },
          { page: data.page || 1, pageSize: data.pageSize || 20 }
        );

        return result;
      }
    });
  }

  // ============================================================================
  // PATTERN 5: Background Jobs
  // ============================================================================

  /**
   * Schedule a post for future publication
   *
   * Pattern: Deferred operation using background jobs
   */
  public async schedulePublish(
    actor: Actor,
    postId: string,
    publishAt: Date
  ): Promise<ServiceOutput<{ scheduled: boolean; publishAt: Date }>> {
    return this.runWithLoggingAndValidation({
      methodName: 'schedulePublish',
      input: { actor, postId, publishAt },
      schema: z.object({
        postId: z.string(),
        publishAt: z.coerce.date()
      }),
      execute: async (data, validatedActor) => {
        const postResult = await this.getById(validatedActor, data.postId);
        if (!postResult.data) {
          throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
        }

        this._canUpdate(validatedActor, postResult.data);

        if (data.publishAt <= new Date()) {
          throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Publish date must be in the future'
          );
        }

        // Queue background job
        await this.queuePublishJob(data.postId, data.publishAt);

        // Update post with scheduled status
        await this.update(validatedActor, data.postId, {
          status: 'scheduled',
          scheduledPublishAt: data.publishAt
        });

        return {
          scheduled: true,
          publishAt: data.publishAt
        };
      }
    });
  }

  private async queuePublishJob(postId: string, publishAt: Date): Promise<void> {
    console.log(`Queued publish job for post ${postId} at ${publishAt}`);
    // In real implementation: await jobQueue.add('publish-post', { postId }, { delay: publishAt.getTime() - Date.now() })
  }
}
