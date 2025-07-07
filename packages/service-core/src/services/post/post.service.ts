import { PostModel } from '@repo/db';
import type { PostType, VisibilityEnum } from '@repo/types';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type {
    Actor,
    ServiceContext,
    ServiceInput,
    ServiceLogger,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { generatePostSlug } from './post.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './post.normalizers';
import {
    checkCanCommentPost,
    checkCanCreatePost,
    checkCanDeletePost,
    checkCanHardDeletePost,
    checkCanLikePost,
    checkCanRestorePost,
    checkCanUpdatePost,
    checkCanViewPost
} from './post.permissions';
import {
    type GetByCategoryInput,
    GetByCategoryInputSchema,
    type GetByRelatedAccommodationInput,
    GetByRelatedAccommodationInputSchema,
    type GetByRelatedDestinationInput,
    GetByRelatedDestinationInputSchema,
    type GetByRelatedEventInput,
    GetByRelatedEventInputSchema,
    type GetFeaturedInput,
    GetFeaturedInputSchema,
    type GetNewsInput,
    GetNewsInputSchema,
    type GetPostStatsInput,
    GetPostStatsInputSchema,
    type GetPostSummaryInput,
    GetPostSummaryInputSchema,
    type LikePostInput,
    LikePostInputSchema,
    type PostCreateInput,
    PostCreateInputSchema,
    PostFilterInputSchema,
    type PostStatsType,
    type PostSummaryType,
    PostUpdateSchema
} from './post.schemas';

/**
 * Service for managing posts. Implements business logic, permissions, and hooks for Post entities.
 * @extends BaseService
 */
export class PostService extends BaseService<
    PostType,
    PostModel,
    typeof PostCreateInputSchema,
    typeof PostUpdateSchema,
    typeof PostFilterInputSchema
> {
    public readonly entityName = 'post';
    public readonly model: PostModel;
    public readonly logger: ServiceLogger;
    public readonly createSchema = PostCreateInputSchema;
    public readonly updateSchema = PostUpdateSchema;
    public readonly filterSchema = PostFilterInputSchema;
    public readonly searchSchema = PostFilterInputSchema;

    /**
     * Initializes a new instance of the PostService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PostModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: PostModel) {
        super(ctx);
        this.logger = ctx.logger;
        this.model = model ?? new PostModel();
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before creating a post.
     * Adds extra business validations:
     * - Title must be unique per category
     * - If isNews, expiresAt is required and must be a future date
     * @param data - The input data
     * @returns Normalized and enriched data
     */
    protected async _beforeCreate(data: PostCreateInput): Promise<Partial<PostType>> {
        const normalized = normalizeCreateInput(data);
        if (!normalized.category || !normalized.title) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Missing required fields for slug generation: category or title'
            );
        }
        // Validation: unique title per category
        const existing = await this.model.findOne({
            category: normalized.category,
            title: normalized.title
        });
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'A post with this title already exists in this category'
            );
        }
        // Validation: if isNews, expiresAt is required and must be a future date
        const isNews = normalized.isNews ?? false;
        const date = isNews ? (normalized.expiresAt ?? undefined) : undefined;
        if (isNews) {
            if (!date) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'expiresAt is required for news posts'
                );
            }
            const expiresAtDate = typeof date === 'string' ? new Date(date) : date;
            if (Number.isNaN(expiresAtDate.getTime()) || expiresAtDate <= new Date()) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'expiresAt must be a future date'
                );
            }
        }
        const slug = await generatePostSlug(
            String(normalized.category),
            normalized.title,
            isNews,
            date
        );
        return {
            ...normalized,
            slug
        } as Partial<PostType>;
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before updating a post.
     * Adds extra business validations:
     * - Title must be unique per category (if changed)
     * - If isNews, expiresAt is required and must be a future date
     * @param data - The input data
     * @returns Normalized and enriched data
     */
    protected async _beforeUpdate(
        data: z.infer<typeof PostUpdateSchema>
    ): Promise<Partial<PostType>> {
        const normalized = normalizeUpdateInput(data);
        // If title or category changes, validate uniqueness
        if (normalized.category && normalized.title) {
            const existing = await this.model.findOne({
                category: normalized.category,
                title: normalized.title
            });
            if (existing && (!data.id || existing.id !== data.id)) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'A post with this title already exists in this category'
                );
            }
        }
        // Validation: if isNews, expiresAt is required and must be a future date
        const isNews = normalized.isNews ?? false;
        const date = isNews ? (normalized.expiresAt ?? undefined) : undefined;
        if (isNews) {
            if (!date) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'expiresAt is required for news posts'
                );
            }
            const expiresAtDate = typeof date === 'string' ? new Date(date) : date;
            if (Number.isNaN(expiresAtDate.getTime()) || expiresAtDate <= new Date()) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'expiresAt must be a future date'
                );
            }
        }
        if (normalized.category && normalized.title) {
            const slug = await generatePostSlug(
                String(normalized.category),
                normalized.title,
                isNews,
                date
            );
            const { id, createdById, updatedById, deletedById, ...rest } = normalized as Record<
                string,
                unknown
            >;
            return {
                ...rest,
                slug
            } as Partial<PostType>;
        }
        const { id, createdById, updatedById, deletedById, ...rest } = normalized as Record<
            string,
            unknown
        >;
        return {
            ...rest
        } as Partial<PostType>;
    }

    /**
     * Checks if the actor can create a post.
     * @param actor - The user or system performing the action.
     * @param data - The validated input data for the new post.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: z.infer<typeof PostCreateInputSchema>): void {
        checkCanCreatePost(actor);
    }

    /**
     * Checks if the actor can update a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, entity: PostType): void {
        checkCanUpdatePost(actor, entity);
    }

    /**
     * Checks if the actor can soft-delete a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be soft-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, entity: PostType): void {
        checkCanDeletePost(actor, entity);
    }

    /**
     * Checks if the actor can hard-delete a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be hard-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: PostType): void {
        checkCanHardDeletePost(actor);
    }

    /**
     * Checks if the actor can restore a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: PostType): void {
        checkCanRestorePost(actor);
    }

    /**
     * Checks if the actor can view a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, entity: PostType): void {
        checkCanViewPost(actor, entity);
    }

    /**
     * Checks if the actor can like a post.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canLike(actor: Actor): void {
        checkCanLikePost(actor);
    }

    /**
     * Checks if the actor can comment on a post.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canComment(actor: Actor): void {
        checkCanCommentPost(actor);
    }

    /**
     * Checks if the actor can list posts.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: not authenticated');
        }
    }

    /**
     * Checks if the actor can search posts.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: not authenticated');
        }
    }

    /**
     * Checks if the actor can count posts.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: not authenticated');
        }
    }

    /**
     * Checks if the actor can update the visibility of a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be updated.
     * @param newVisibility - The new visibility state.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: PostType,
        _newVisibility: VisibilityEnum
    ): void {
        if (
            !actor ||
            !actor.id ||
            actor.role === RoleEnum.GUEST ||
            !actor.permissions.includes(PermissionEnum.POST_UPDATE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Forbidden: not allowed to update visibility'
            );
        }
    }

    /**
     * Executes the database search for posts.
     * @param params - The validated and processed search parameters.
     * @param actor - The actor performing the search.
     * @returns A paginated list of posts matching the criteria.
     */
    protected async _executeSearch(params: z.infer<typeof PostFilterInputSchema>, _actor: Actor) {
        return this.model.findAll(params);
    }

    /**
     * Executes the database count for posts.
     * @param params - The validated search parameters (filters).
     * @param actor - The actor performing the count.
     * @returns The total count of posts matching the criteria.
     */
    protected async _executeCount(params: z.infer<typeof PostFilterInputSchema>, _actor: Actor) {
        const count = await this.model.count(params);
        return { count };
    }

    /**
     * Gets news posts, optionally filtered by date and visibility.
     * @param input - ServiceInput with actor and optional filters
     * @returns List of news posts
     */
    public async getNews(input: ServiceInput<GetNewsInput>): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getNews',
            input,
            schema: GetNewsInputSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = { isNews: true };
                if (validated.visibility) where.visibility = validated.visibility;
                if (validated.fromDate || validated.toDate) {
                    const expiresAtFilter: Record<string, unknown> = {};
                    if (validated.fromDate) expiresAtFilter.gte = validated.fromDate;
                    if (validated.toDate) expiresAtFilter.lte = validated.toDate;
                    where.expiresAt = expiresAtFilter;
                }
                const { items } = await this.model.findAll(where);
                return items;
            }
        });
    }

    /**
     * Gets featured posts.
     * @param input - ServiceInput with optional filters
     * @returns List of featured posts
     */
    public async getFeatured(
        input: ServiceInput<GetFeaturedInput>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFeatured',
            input,
            schema: GetFeaturedInputSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = { isFeatured: true };
                if (validated.visibility) where.visibility = validated.visibility;
                if (validated.fromDate || validated.toDate) {
                    const createdAtFilter: Record<string, unknown> = {};
                    if (validated.fromDate) createdAtFilter.gte = validated.fromDate;
                    if (validated.toDate) createdAtFilter.lte = validated.toDate;
                    where.createdAt = createdAtFilter;
                }
                const { items } = await this.model.findAll(where);
                return items;
            }
        });
    }

    /**
     * Gets posts by category.
     * @param input - ServiceInput with the category to filter
     * @returns List of posts in the given category
     */
    public async getByCategory(
        input: ServiceInput<GetByCategoryInput>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByCategory',
            input,
            schema: GetByCategoryInputSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = { category: validated.category };
                if (validated.visibility) where.visibility = validated.visibility;
                if (validated.fromDate || validated.toDate) {
                    const createdAtFilter: Record<string, unknown> = {};
                    if (validated.fromDate) createdAtFilter.gte = validated.fromDate;
                    if (validated.toDate) createdAtFilter.lte = validated.toDate;
                    where.createdAt = createdAtFilter;
                }
                const { items } = await this.model.findAll(where);
                return items;
            }
        });
    }

    /**
     * Gets posts related to a destination.
     * @param input - ServiceInput with the destination ID
     * @returns List of posts related to the destination
     */
    public async getByRelatedDestination(
        input: ServiceInput<GetByRelatedDestinationInput>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedDestination',
            input,
            schema: GetByRelatedDestinationInputSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = {
                    relatedDestinationId: validated.destinationId
                };
                if (validated.visibility) where.visibility = validated.visibility;
                if (validated.fromDate || validated.toDate) {
                    const createdAtFilter: Record<string, unknown> = {};
                    if (validated.fromDate) createdAtFilter.gte = validated.fromDate;
                    if (validated.toDate) createdAtFilter.lte = validated.toDate;
                    where.createdAt = createdAtFilter;
                }
                const { items } = await this.model.findAll(where);
                return items;
            }
        });
    }

    /**
     * Gets posts related to an accommodation.
     * @param input - ServiceInput with the accommodation ID
     * @returns List of posts related to the accommodation
     */
    public async getByRelatedAccommodation(
        input: ServiceInput<GetByRelatedAccommodationInput>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedAccommodation',
            input,
            schema: GetByRelatedAccommodationInputSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = {
                    relatedAccommodationId: validated.accommodationId
                };
                if (validated.visibility) where.visibility = validated.visibility;
                if (validated.fromDate || validated.toDate) {
                    const createdAtFilter: Record<string, unknown> = {};
                    if (validated.fromDate) createdAtFilter.gte = validated.fromDate;
                    if (validated.toDate) createdAtFilter.lte = validated.toDate;
                    where.createdAt = createdAtFilter;
                }
                const { items } = await this.model.findAll(where);
                return items;
            }
        });
    }

    /**
     * Gets posts related to an event.
     * @param input - ServiceInput with the event ID
     * @returns List of posts related to the event
     */
    public async getByRelatedEvent(
        input: ServiceInput<GetByRelatedEventInput>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedEvent',
            input,
            schema: GetByRelatedEventInputSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = { relatedEventId: validated.eventId };
                if (validated.visibility) where.visibility = validated.visibility;
                if (validated.fromDate || validated.toDate) {
                    const createdAtFilter: Record<string, unknown> = {};
                    if (validated.fromDate) createdAtFilter.gte = validated.fromDate;
                    if (validated.toDate) createdAtFilter.lte = validated.toDate;
                    where.createdAt = createdAtFilter;
                }
                const { items } = await this.model.findAll(where);
                return items;
            }
        });
    }

    /**
     * Likes a post for a user.
     * @param input - ServiceInput with the post ID and the actor performing the action
     * @returns Result of the operation
     */
    public async like(
        input: ServiceInput<LikePostInput>
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'like',
            input,
            schema: LikePostInputSchema,
            execute: async (validated, actor) => {
                this._canLike(actor);
                const post = await this.model.findOne({ id: validated.postId });
                if (!post) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
                }
                await this.model.update({ id: validated.postId }, { likes: (post.likes ?? 0) + 1 });
                return { success: true };
            }
        });
    }

    /**
     * Unlikes a post for a user.
     * @param input - ServiceInput with the post ID and the actor performing the action
     * @returns Result of the operation
     */
    public async unlike(
        input: ServiceInput<LikePostInput>
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'unlike',
            input,
            schema: LikePostInputSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const post = await this.model.findOne({ id: validated.postId });
                if (!post) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
                }
                const newLikes = Math.max((post.likes ?? 0) - 1, 0);
                await this.model.update({ id: validated.postId }, { likes: newLikes });
                return { success: true };
            }
        });
    }

    /**
     * Adds a comment to a post. (Stub)
     * @param input - ServiceInput with the post ID, the comment, and the actor
     * @returns NOT_IMPLEMENTED error
     */
    public async addComment(
        input: ServiceInput<{ postId: string; comment: string }>
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addComment',
            input,
            schema: z.object({ postId: z.string(), comment: z.string(), actor: z.any() }),
            execute: async (_validated: unknown, actor: Actor): Promise<{ success: boolean }> => {
                this._canComment(actor);
                throw new ServiceError(
                    ServiceErrorCode.NOT_IMPLEMENTED,
                    'addComment is not implemented yet'
                );
            }
        });
    }

    /**
     * Removes a comment from a post.
     * @param input - ServiceInput with the post ID and the comment ID to remove
     * @returns Result of the operation
     */
    public async removeComment(
        input: ServiceInput<Record<string, unknown>>
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeComment',
            input,
            schema: z.any(),
            execute: async (_validated: unknown, actor: Actor): Promise<{ success: boolean }> => {
                this._canComment(actor);
                // TODO: Implement comment removal logic
                return { success: false };
            }
        });
    }

    /**
     * Increments the share count of a post.
     * @param actor - The user or system performing the action.
     * @param postId - The post ID.
     * @returns Success or error.
     */
    public async incrementShare(
        _actor: Actor,
        _postId: string
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return { data: { success: false } };
    }

    /**
     * Returns a summarized, public-facing version of a post (for cards/lists).
     * @param actor - The user or system performing the action.
     * @param data - Object with id or slug.
     * @returns ServiceOutput<PostSummaryType | null>
     */
    public async getSummary(
        actor: Actor,
        data: GetPostSummaryInput
    ): Promise<ServiceOutput<PostSummaryType | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { actor, ...data },
            schema: GetPostSummaryInputSchema,
            execute: async (validatedData, validatedActor) => {
                const { id, slug } = validatedData;
                const field = id ? 'id' : 'slug';
                const value = id ?? slug;
                const entityResult = await this.getByField(validatedActor, field, value as string);
                if (entityResult.error) {
                    throw new ServiceError(
                        entityResult.error.code,
                        entityResult.error.message,
                        entityResult.error.details
                    );
                }
                if (!entityResult.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
                }
                const post = entityResult.data;
                const summary: PostSummaryType = {
                    id: post.id,
                    slug: post.slug,
                    title: post.title,
                    category: post.category,
                    media: post.media,
                    isFeatured: post.isFeatured,
                    isNews: post.isNews,
                    createdAt: post.createdAt,
                    authorId: post.authorId,
                    summary: post.summary
                };
                return summary;
            }
        });
    }

    /**
     * Returns stats for a post (likes, comments, shares).
     * @param actor - The user or system performing the action.
     * @param data - Object with id or slug.
     * @returns ServiceOutput<PostStatsType | null>
     */
    public async getStats(
        actor: Actor,
        data: GetPostStatsInput
    ): Promise<ServiceOutput<PostStatsType | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { actor, ...data },
            schema: GetPostStatsInputSchema,
            execute: async (validatedData, validatedActor) => {
                const { id, slug } = validatedData;
                const field = id ? 'id' : 'slug';
                const value = id ?? slug;
                const entityResult = await this.getByField(validatedActor, field, value as string);
                if (entityResult.error) {
                    throw new ServiceError(
                        entityResult.error.code,
                        entityResult.error.message,
                        entityResult.error.details
                    );
                }
                if (!entityResult.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
                }
                const post = entityResult.data;
                const stats: PostStatsType = {
                    likes: post.likes ?? 0,
                    comments: post.comments ?? 0,
                    shares: post.shares ?? 0
                };
                return stats;
            }
        });
    }
}
