import { PostModel } from '@repo/db';
import type { PostStatsSchema, PostSummarySchema } from '@repo/schemas';
import type {
    GetPostStatsInput,
    GetPostSummaryInput
} from '@repo/schemas/entities/post/post.service.schema';
import type { PostType, VisibilityEnum } from '@repo/types';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
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
    GetPostByCategoryInputSchema,
    GetPostByRelatedAccommodationInputSchema,
    GetPostByRelatedDestinationInputSchema,
    GetPostByRelatedEventInputSchema,
    GetPostFeaturedInputSchema,
    GetPostNewsInputSchema,
    GetPostStatsInputSchema,
    GetPostSummaryInputSchema,
    LikePostInputSchema,
    PostCreateInputSchema,
    PostFilterInputSchema,
    PostUpdateSchema
} from './post.schemas';
type PostSummaryType = z.infer<typeof PostSummarySchema>;
type PostStatsType = z.infer<typeof PostStatsSchema>;

/**
 * Service for managing posts. Implements business logic, permissions, and hooks for Post entities.
 * @extends BaseCrudService
 */
export class PostService extends BaseCrudService<
    PostType,
    PostModel,
    typeof PostCreateInputSchema,
    typeof PostUpdateSchema,
    typeof PostFilterInputSchema
> {
    static readonly ENTITY_NAME = 'post';
    protected readonly entityName = PostService.ENTITY_NAME;
    public readonly model: PostModel;

    public readonly createSchema = PostCreateInputSchema;
    public readonly updateSchema = PostUpdateSchema;
    public readonly filterSchema = PostFilterInputSchema;
    public readonly searchSchema = PostFilterInputSchema;

    /**
     * Private property to temporarily store the id for update operations.
     */
    private _updateId: string | undefined;

    /**
     * Initializes a new instance of the PostService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PostModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: PostModel) {
        super(ctx, PostService.ENTITY_NAME);
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
    protected async _beforeCreate(
        data: z.infer<typeof PostCreateInputSchema>
    ): Promise<Partial<PostType>> {
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
     * @param data - The input data (fields to update)
     * @param _actor - The actor performing the update (not used)
     * @returns Normalized and enriched data
     */
    protected async _beforeUpdate(
        data: z.infer<typeof PostUpdateSchema>,
        _actor: Actor
    ): Promise<Partial<PostType>> {
        // The id to use for business logic is stored in this._updateId (set in update method)
        const id = this._updateId;
        if (!id) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'id is required for post update.'
            );
        }
        const updateFields = data;
        const { id: _omitId, ...restUpdateFields } = updateFields as {
            id?: unknown;
        } & Record<string, unknown>;
        const normalized = normalizeUpdateInput({ id, ...restUpdateFields });
        // Revert: if the normalized object is empty, just return an empty object
        if (Object.keys(normalized).length === 0) {
            return {} as Partial<PostType>;
        }
        // If title or category changes, validate uniqueness
        if (normalized.category && normalized.title) {
            const existing = await this.model.findOne({
                category: normalized.category,
                title: normalized.title
            });
            if (existing && existing.id !== id) {
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
        // Always return all normalized fields except id and audit fields
        const {
            id: _id,
            createdById,
            updatedById,
            deletedById,
            ...rest
        } = normalized as Record<string, unknown>;
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
        if (!actor) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
        }
        // Listing is allowed for any actor; results are filtered by visibility elsewhere.
        return;
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
        const { filters = {}, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        return this.model.findAll(filters, { page, pageSize });
    }

    /**
     * Executes the database count for posts.
     * @param params - The validated and processed search parameters.
     * @param actor - The actor performing the count.
     * @returns An object containing the total count of posts matching the criteria.
     */
    protected async _executeCount(params: z.infer<typeof PostFilterInputSchema>, _actor: Actor) {
        const { filters = {} } = params;
        const count = await this.model.count(filters);
        return { count };
    }

    /**
     * Gets news posts, optionally filtered by date and visibility.
     * @param actor - The user or system performing the action.
     * @param params - Optional filters for news posts.
     * @returns List of news posts
     */
    public async getNews(
        actor: Actor,
        params: z.infer<typeof GetPostNewsInputSchema>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getNews',
            input: { ...params, actor },
            schema: GetPostNewsInputSchema.strict(),
            execute: async (validated: z.infer<typeof GetPostNewsInputSchema>, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = { isNews: true };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id || actor.role === RoleEnum.GUEST) {
                    where.visibility = 'PUBLIC';
                }
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
     * @param actor - The user or system performing the action.
     * @param params - Optional filters for featured posts.
     * @returns List of featured posts
     */
    public async getFeatured(
        actor: Actor,
        params: z.infer<typeof GetPostFeaturedInputSchema>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFeatured',
            input: { ...params, actor },
            schema: GetPostFeaturedInputSchema.strict(),
            execute: async (validated: z.infer<typeof GetPostFeaturedInputSchema>, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = { isFeatured: true };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id || actor.role === RoleEnum.GUEST) {
                    where.visibility = 'PUBLIC';
                }
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
     * @param actor - The user or system performing the action.
     * @param params - The category and optional filters.
     * @returns List of posts in the given category
     */
    public async getByCategory(
        actor: Actor,
        params: z.infer<typeof GetPostByCategoryInputSchema>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByCategory',
            input: { ...params, actor },
            schema: GetPostByCategoryInputSchema.strict(),
            execute: async (validated: z.infer<typeof GetPostByCategoryInputSchema>, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = { category: validated.category };

                // If no visibility is specified, default to PUBLIC for guest users
                if ('visibility' in validated && validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id || actor.role === RoleEnum.GUEST) {
                    where.visibility = 'PUBLIC';
                }
                if (
                    ('fromDate' in validated && validated.fromDate) ||
                    ('toDate' in validated && validated.toDate)
                ) {
                    const createdAtFilter: Record<string, unknown> = {};
                    if ('fromDate' in validated && validated.fromDate)
                        createdAtFilter.gte = validated.fromDate;
                    if ('toDate' in validated && validated.toDate)
                        createdAtFilter.lte = validated.toDate;
                    where.createdAt = createdAtFilter;
                }
                const { items } = await this.model.findAll(where);
                return items;
            }
        });
    }

    /**
     * Gets posts related to an accommodation.
     * @param actor - The user or system performing the action.
     * @param params - The accommodationId and optional filters.
     * @returns List of posts related to the accommodation
     */
    public async getByRelatedAccommodation(
        actor: Actor,
        params: z.infer<typeof GetPostByRelatedAccommodationInputSchema>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedAccommodation',
            input: { ...params, actor },
            schema: GetPostByRelatedAccommodationInputSchema.strict(),
            execute: async (
                validated: z.infer<typeof GetPostByRelatedAccommodationInputSchema>,
                actor
            ) => {
                this._canList(actor);
                const where: Record<string, unknown> = {
                    relatedAccommodationId: validated.accommodationId
                };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id || actor.role === RoleEnum.GUEST) {
                    where.visibility = 'PUBLIC';
                }
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
     * @param actor - The user or system performing the action.
     * @param params - The destinationId and optional filters.
     * @returns List of posts related to the destination
     */
    public async getByRelatedDestination(
        actor: Actor,
        params: z.infer<typeof GetPostByRelatedDestinationInputSchema>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedDestination',
            input: { ...params, actor },
            schema: GetPostByRelatedDestinationInputSchema.strict(),
            execute: async (
                validated: z.infer<typeof GetPostByRelatedDestinationInputSchema>,
                actor
            ) => {
                this._canList(actor);
                const where: Record<string, unknown> = {
                    relatedDestinationId: validated.destinationId
                };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id || actor.role === RoleEnum.GUEST) {
                    where.visibility = 'PUBLIC';
                }
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
     * @param actor - The user or system performing the action.
     * @param params - The eventId and optional filters.
     * @returns List of posts related to the event
     */
    public async getByRelatedEvent(
        actor: Actor,
        params: z.infer<typeof GetPostByRelatedEventInputSchema>
    ): Promise<ServiceOutput<PostType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedEvent',
            input: { ...params, actor },
            schema: GetPostByRelatedEventInputSchema.strict(),
            execute: async (validated: z.infer<typeof GetPostByRelatedEventInputSchema>, actor) => {
                this._canList(actor);
                const where: Record<string, unknown> = { relatedEventId: validated.eventId };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id || actor.role === RoleEnum.GUEST) {
                    where.visibility = 'PUBLIC';
                }
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
     * @param actor - The user or system performing the action
     * @param params - The input params with postId
     * @returns Result of the operation
     */
    public async like(
        actor: Actor,
        params: { postId: string }
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'like',
            input: { ...params, actor },
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
     * @param actor - The user or system performing the action
     * @param params - The input params with postId
     * @returns Result of the operation
     */
    public async unlike(
        actor: Actor,
        params: { postId: string }
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'unlike',
            input: { ...params, actor },
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
     * @param actor - The user or system performing the action
     * @param params - The post ID and comment
     * @returns NOT_IMPLEMENTED error
     */
    public async addComment(
        actor: Actor,
        params: { postId: string; comment: string }
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addComment',
            input: { ...params, actor },
            schema: z.object({ postId: z.string(), comment: z.string(), actor: z.any() }).strict(),
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
     * Removes a comment from a post. (Stub)
     * @param actor - The user or system performing the action
     * @param params - The post ID and comment ID
     * @returns Result of the operation
     */
    public async removeComment(
        actor: Actor,
        params: { postId: string; commentId: string }
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeComment',
            input: { ...params, actor },
            schema: z
                .object({ postId: z.string(), commentId: z.string(), actor: z.any() })
                .strict(),
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

    /**
     * Updates a post by id, using the new homogeneous pattern.
     * @param actor - The actor performing the update
     * @param id - The id of the post to update
     * @param data - The fields to update (no id)
     * @returns The updated post or a service error
     */
    public async update(
        actor: Actor,
        id: string,
        data: z.infer<typeof PostUpdateSchema>
    ): Promise<ServiceOutput<PostType>> {
        this._updateId = id;
        try {
            return await super.update(actor, id, data);
        } finally {
            this._updateId = undefined;
        }
    }
}
