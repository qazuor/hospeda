import { PostModel, buildSearchCondition } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { ImageProvider } from '@repo/media/server';
import { resolveEnvironment } from '@repo/media/server';
import { getTranslationService } from '../../translation/translation-init';
import type {
    GetPostByCategoryInput,
    GetPostByRelatedAccommodationInput,
    GetPostByRelatedDestinationInput,
    GetPostByRelatedEventInput,
    GetPostFeaturedInput,
    GetPostNewsInput,
    GetPostStatsInput,
    GetPostSummaryInput,
    ListRelationsConfig,
    PaginatedListOutput,
    Post,
    PostCreateInput,
    PostEngagementStats,
    PostListInput,
    PostMonthlyTrendItem,
    PostSummary,
    PostTag,
    PostUpdateInput,
    VisibilityEnum
} from '@repo/schemas';
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
    PermissionEnum,
    PostAdminSearchSchema,
    PostCreateInputSchema,
    PostListInputSchema as PostFilterInputSchema,
    PostUpdateInputSchema as PostUpdateSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type {
    Actor,
    AdminSearchExecuteParams,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';
import { generatePostSlug, mapPostFilterKeysToColumns } from './post.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './post.normalizers';
import {
    checkCanAdminList,
    checkCanCommentPost,
    checkCanCreatePost,
    checkCanDeletePost,
    checkCanHardDeletePost,
    checkCanLikePost,
    checkCanRestorePost,
    checkCanUpdatePost,
    checkCanViewPost
} from './post.permissions';
import type { PostHookState } from './post.types';

/**
 * Service for managing posts. Implements business logic, permissions, and hooks for Post entities.
 * @extends BaseCrudService
 */
export class PostService extends BaseCrudService<
    Post,
    PostModel,
    typeof PostCreateInputSchema,
    typeof PostUpdateSchema,
    typeof PostFilterInputSchema
> {
    static readonly ENTITY_NAME = 'post';
    protected readonly entityName = PostService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('post-revalidation');
    public readonly model: PostModel;

    public readonly createSchema = PostCreateInputSchema;
    public readonly updateSchema = PostUpdateSchema;
    public readonly filterSchema = PostFilterInputSchema;
    public readonly searchSchema = PostFilterInputSchema;

    protected getDefaultListRelations(): ListRelationsConfig {
        return {
            author: true,
            relatedAccommodation: true,
            relatedDestination: true,
            relatedEvent: true,
            sponsorship: { sponsor: true }, // Nested relation: sponsorship -> sponsor
            // SPEC-086: load PostTags via the `r_post_post_tag` join with the
            // nested `postTag` populated. Flattened to a `PostTag[]` array
            // by `_afterGetByField`/`_afterList` so consumers receive the
            // canonical shape declared in `PostSchema.postTags`.
            postTags: { postTag: true }
        };
    }

    /**
     * Flattens the nested `r_post_post_tag` rows produced by the relational
     * loader into the canonical `PostTag[]` shape exposed by `PostSchema`.
     *
     * Drizzle's `findFirst({ with: { postTags: { with: { postTag: true } } } })`
     * returns join rows shaped as `{ postId, postTagId, postTag: PostTag }`.
     * Public consumers expect a flat `PostTag[]`, so we lift the nested
     * `postTag` field to the top level and discard the join metadata.
     *
     * @param entity - Post entity returned by the model layer (with raw join rows).
     * @returns The same entity reference, with `postTags` flattened in-place.
     */
    private flattenPostTagsRelation<T extends Post | null | undefined>(entity: T): T {
        if (!entity) return entity;
        // TYPE-WORKAROUND: Post type does not surface the raw `postTags` join shape, but Drizzle's `with` clause attaches it at runtime; cast to read the runtime-only field.
        const raw = (entity as unknown as { postTags?: unknown }).postTags;
        if (!Array.isArray(raw)) return entity;
        const flat: PostTag[] = raw
            .map((row) => {
                if (row && typeof row === 'object' && 'postTag' in row) {
                    return (row as { postTag: PostTag | null | undefined }).postTag ?? null;
                }
                // Already flat (e.g. mocked data) — keep as-is.
                return (row as PostTag | null | undefined) ?? null;
            })
            .filter((tag): tag is PostTag => tag !== null && tag !== undefined);
        // TYPE-WORKAROUND: Mutate the runtime `postTags` field with the flattened shape Post consumers expect; canonical Post type already declares it as `PostTag[]` so this aligns runtime with type.
        (entity as unknown as { postTags: PostTag[] }).postTags = flat;
        return entity;
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Posts are searched by title and content.
     */
    protected override getSearchableColumns(): string[] {
        return ['title', 'content'];
    }

    /**
     * Optional Cloudinary media provider for asset cleanup on hard delete.
     * When null, media cleanup is skipped (Cloudinary not configured).
     */
    private readonly mediaProvider: ImageProvider | null;

    /**
     * Initializes a new instance of the PostService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PostModel instance (for testing/mocking).
     * @param mediaProvider - Optional ImageProvider for Cloudinary cleanup on hard delete.
     */
    constructor(ctx: ServiceConfig, model?: PostModel, mediaProvider?: ImageProvider | null) {
        super(ctx, PostService.ENTITY_NAME);
        this.model = model ?? new PostModel();
        /** Uses default _executeAdminSearch() - all filter fields map directly to table columns. */
        this.adminSearchSchema = PostAdminSearchSchema;
        this.mediaProvider = mediaProvider ?? null;
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
        data: PostCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Post>> {
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

        // Generate slug only if not provided
        const slug =
            normalized.slug ||
            (await generatePostSlug(String(normalized.category), normalized.title, isNews, date));

        // Ensure media has a default value (DB column is NOT NULL)
        const media = normalized.media ?? { featuredImage: undefined, gallery: [], videos: [] };

        return {
            ...normalized,
            slug,
            media
        } as Partial<Post>;
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
        data: PostUpdateInput,
        _actor: Actor,
        ctx: ServiceContext<PostHookState>
    ): Promise<Partial<Post>> {
        // The id to use for business logic is stored in ctx.hookState (set in update method)
        const id = ctx.hookState?.updateId;
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
            return {} as Partial<Post>;
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
        } as Partial<Post>;
    }

    /**
     * Lifecycle hook: flattens the nested `r_post_post_tag` join rows into
     * a top-level `PostTag[]` on the returned entity (SPEC-086).
     */
    protected override async _afterGetByField(
        entity: Post | null,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Post | null> {
        return this.flattenPostTagsRelation(entity);
    }

    /**
     * Lifecycle hook: flattens nested `r_post_post_tag` join rows into a
     * top-level `PostTag[]` on every item of a paginated list result
     * (SPEC-086).
     */
    protected override async _afterList(
        result: PaginatedListOutput<Post>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<Post>> {
        if (!result?.items) return result;
        return {
            ...result,
            items: result.items.map((item) => this.flattenPostTagsRelation(item))
        };
    }

    /**
     * Lifecycle hook: flattens nested `r_post_post_tag` join rows into a
     * top-level `PostTag[]` on every item of a paginated search result
     * (SPEC-086).
     */
    protected override async _afterSearch(
        result: PaginatedListOutput<Post>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<Post>> {
        if (!result?.items) return result;
        return {
            ...result,
            items: result.items.map((item) => this.flattenPostTagsRelation(item))
        };
    }

    /**
     * Override admin search execution to flatten the `r_post_post_tag` join rows
     * into a top-level `PostTag[]` for every item, matching the behavior of
     * `_afterList` and `_afterSearch`. The base `adminList` flow does NOT invoke
     * `_afterList`, so this override is required to keep the response shape
     * consistent with `PostAdminSchema.postTags` (SPEC-086 / SPEC-117 A-2 fix).
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams
    ): Promise<PaginatedListOutput<Post>> {
        const result = await super._executeAdminSearch(params);
        if (!result?.items) return result;
        return {
            ...result,
            items: result.items.map((item) => this.flattenPostTagsRelation(item))
        };
    }

    /**
     * Checks if the actor can create a post.
     * @param actor - The user or system performing the action.
     * @param data - The validated input data for the new post.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: PostCreateInput): void {
        checkCanCreatePost(actor);
    }

    /**
     * Checks if the actor can update a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, entity: Post): void {
        checkCanUpdatePost(actor, entity);
    }

    /**
     * Checks if the actor can soft-delete a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be soft-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, entity: Post): void {
        checkCanDeletePost(actor, entity);
    }

    /**
     * Checks if the actor can hard-delete a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be hard-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: Post): void {
        checkCanHardDeletePost(actor);
    }

    /**
     * Checks if the actor can restore a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: Post): void {
        checkCanRestorePost(actor);
    }

    /**
     * Checks if the actor can view a post.
     * @param actor - The user or system performing the action.
     * @param entity - The post entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, entity: Post): void {
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
        if (!actor || !actor.id) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: not authenticated');
        }
    }

    /**
     * Checks if the actor can count posts.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id) {
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
        _entity: Post,
        _newVisibility: VisibilityEnum
    ): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.POST_UPDATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Forbidden: not allowed to update visibility'
            );
        }
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    protected async _afterCreate(entity: Post, _actor: Actor, _ctx: ServiceContext): Promise<Post> {
        // User-tags (r_entity_tag) do not have slugs per SPEC-086 D-002.
        // PostTag slugs live in the separate post_tags system and are not on entity.tags.
        const tagSlugs: string[] | undefined = undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'post',
                slug: entity.slug,
                tagSlugs
            });
        } catch (error) {
            PostService.revalidationLogger.warn(
                { error, entityType: 'post' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }

        // SPEC-212: fire-and-forget auto-translation
        const translationService = getTranslationService();
        if (translationService) {
            const fields: Record<string, string> = {};
            if (entity.title) fields.title = entity.title;
            if (entity.summary) fields.summary = entity.summary;
            if (entity.content) fields.content = entity.content;
            if (Object.keys(fields).length > 0) {
                void translationService.translate({
                    entityType: 'post',
                    entityId: entity.id,
                    fields
                }).catch(() => {});
            }
        }

        return entity;
    }

    protected async _afterUpdate(entity: Post, _actor: Actor, _ctx: ServiceContext): Promise<Post> {
        // User-tags do not have slugs per SPEC-086 D-002
        const tagSlugs: string[] | undefined = undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'post',
                slug: entity.slug,
                tagSlugs
            });
        } catch (error) {
            PostService.revalidationLogger.warn(
                { error, entityType: 'post' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }

        // SPEC-212: fire-and-forget auto-translation on field changes
        const translationService = getTranslationService();
        if (translationService) {
            const fields: Record<string, string> = {};
            if (entity.title) fields.title = entity.title;
            if (entity.summary) fields.summary = entity.summary;
            if (entity.content) fields.content = entity.content;
            if (Object.keys(fields).length > 0) {
                void translationService.translate({
                    entityType: 'post',
                    entityId: entity.id,
                    fields
                }).catch(() => {});
            }
        }

        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: Post,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Post> {
        // User-tags do not have slugs per SPEC-086 D-002
        const tagSlugs: string[] | undefined = undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'post',
                slug: entity.slug,
                tagSlugs
            });
        } catch (error) {
            PostService.revalidationLogger.warn(
                { error, entityType: 'post' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<PostHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.restoredPost = {
                slug: entity.slug,
                // User-tags do not have slugs per SPEC-086 D-002
                tagSlugs: undefined
            };
        }
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<PostHookState>
    ): Promise<{ count: number }> {
        const restored = ctx.hookState?.restoredPost;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'post',
                slug: restored?.slug,
                tagSlugs: restored?.tagSlugs
            });
        } catch (error) {
            PostService.revalidationLogger.warn(
                { error, entityType: 'post' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<PostHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedPost = {
                slug: entity.slug,
                // User-tags do not have slugs per SPEC-086 D-002
                tagSlugs: undefined
            };
        }
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<PostHookState>
    ): Promise<{ count: number }> {
        const deleted = ctx.hookState?.deletedPost;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'post',
                slug: deleted?.slug,
                tagSlugs: deleted?.tagSlugs
            });
        } catch (error) {
            PostService.revalidationLogger.warn(
                { error, entityType: 'post' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<PostHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedPost = {
                slug: entity.slug,
                // User-tags do not have slugs per SPEC-086 D-002
                tagSlugs: undefined
            };
            ctx.hookState.deletedEntityId = id;
        }
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<PostHookState>
    ): Promise<{ count: number }> {
        const deleted = ctx.hookState?.deletedPost;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'post',
                slug: deleted?.slug,
                tagSlugs: deleted?.tagSlugs
            });
        } catch (error) {
            PostService.revalidationLogger.warn(
                { error, entityType: 'post' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        // Best-effort Cloudinary cleanup after confirmed hard delete
        if (result.count > 0 && ctx.hookState?.deletedEntityId && this.mediaProvider) {
            const env = resolveEnvironment();
            const prefix = `hospeda/${env}/posts/${ctx.hookState.deletedEntityId}/`;
            try {
                await this.mediaProvider.deleteByPrefix({ prefix });
            } catch (mediaError) {
                PostService.revalidationLogger.warn(
                    { error: mediaError, prefix },
                    '[media] Failed to clean up Cloudinary assets for post'
                );
            }
        }
        return result;
    }

    /**
     * Executes the database search for posts.
     * @param params - The validated and processed search parameters.
     * @param actor - The actor performing the search.
     * @returns A paginated list of posts matching the criteria.
     */
    protected async _executeSearch(params: PostListInput, _actor: Actor, ctx: ServiceContext) {
        const {
            page: _page,
            pageSize: _pageSize,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            q,
            ...filterParams
        } = params;

        // BaseCrudRead.search strips page/pageSize/sortBy/sortOrder from params
        // before reaching this hook (SPEC-088) and re-publishes them via
        // ctx.pagination. Forward them explicitly so model.findAll receives the
        // caller-provided pagination + sort, including the synthetic
        // `mostSaved` sort field handled by PostModel.findAll override
        // (SPEC-098 T-052b).
        //
        // `q` is the free-text search term. Unlike `list` and `adminList`, the
        // base `search` flow does NOT build a search SQL condition for us — it
        // expects the concrete service to wire it. We translate `q` into an
        // ILIKE OR clause across `getSearchableColumns()` (title + content for
        // posts) and pass it as `additionalConditions`.
        const searchCondition =
            q && q.trim().length > 0
                ? buildSearchCondition(q, this.getSearchableColumns(), this.model.getTable())
                : undefined;
        const additionalConditions = searchCondition ? [searchCondition] : undefined;

        // Eager-load the relations declared in getDefaultListRelations() (author,
        // related entities, sponsorship, postTags) so the public search response
        // includes the author byline and avatar instead of just `authorId`.
        // Mirrors the base BaseCrudRead._executeAdminSearch pattern.
        const relations = this.getDefaultListRelations() as Record<
            string,
            boolean | Record<string, unknown>
        >;

        return this.model.findAllWithRelations(
            relations,
            mapPostFilterKeysToColumns(filterParams),
            {
                page: ctx.pagination?.page ?? 1,
                pageSize: ctx.pagination?.pageSize ?? 10,
                sortBy: ctx.pagination?.sortBy,
                sortOrder: ctx.pagination?.sortOrder
            },
            additionalConditions
        );
    }

    /**
     * Executes the database count for posts.
     * @param params - The validated and processed search parameters.
     * @param actor - The actor performing the count.
     * @returns An object containing the total count of posts matching the criteria.
     */
    protected async _executeCount(params: PostListInput, _actor: Actor, _ctx: ServiceContext) {
        const {
            page: _page,
            pageSize: _pageSize,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            q,
            ...filterParams
        } = params;
        // Mirror the `_executeSearch` flow so the count reflects the same
        // filters AND the same `q` ILIKE clause. Without this, `total` would
        // not match `items.length` when `q` is in play.
        const searchCondition =
            q && q.trim().length > 0
                ? buildSearchCondition(q, this.getSearchableColumns(), this.model.getTable())
                : undefined;
        const additionalConditions = searchCondition ? [searchCondition] : undefined;
        const count = await this.model.count(mapPostFilterKeysToColumns(filterParams), {
            additionalConditions
        });
        return { count };
    }

    /**
     * Gets news posts, optionally filtered by date and visibility.
     * @param actor - The user or system performing the action.
     * @param params - Optional filters for news posts.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns List of news posts
     */
    public async getNews(
        actor: Actor,
        params: GetPostNewsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Post[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getNews',
            input: { ...params, actor },
            schema: GetPostNewsInputSchema.strict(),
            ctx,
            execute: async (validated: GetPostNewsInput, actor) => {
                await this._canList(actor);
                const where: Record<string, unknown> = { isNews: true };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id) {
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns List of featured posts
     */
    public async getFeatured(
        actor: Actor,
        params: GetPostFeaturedInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Post[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFeatured',
            input: { ...params, actor },
            schema: GetPostFeaturedInputSchema.strict(),
            ctx,
            execute: async (validated: GetPostFeaturedInput, actor) => {
                await this._canList(actor);
                const where: Record<string, unknown> = { isFeatured: true };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id) {
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns List of posts in the given category
     */
    public async getByCategory(
        actor: Actor,
        params: GetPostByCategoryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Post[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByCategory',
            input: { ...params, actor },
            schema: GetPostByCategoryInputSchema.strict(),
            ctx,
            execute: async (validated: GetPostByCategoryInput, actor) => {
                await this._canList(actor);
                const where: Record<string, unknown> = { category: validated.category };

                // If no visibility is specified, default to PUBLIC for guest users
                if ('visibility' in validated && validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id) {
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns List of posts related to the accommodation
     */
    public async getByRelatedAccommodation(
        actor: Actor,
        params: GetPostByRelatedAccommodationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Post[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedAccommodation',
            input: { ...params, actor },
            schema: GetPostByRelatedAccommodationInputSchema.strict(),
            ctx,
            execute: async (validated: GetPostByRelatedAccommodationInput, actor) => {
                await this._canList(actor);
                const where: Record<string, unknown> = {
                    relatedAccommodationId: validated.accommodationId
                };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id) {
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns List of posts related to the destination
     */
    public async getByRelatedDestination(
        actor: Actor,
        params: GetPostByRelatedDestinationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Post[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedDestination',
            input: { ...params, actor },
            schema: GetPostByRelatedDestinationInputSchema.strict(),
            ctx,
            execute: async (validated: GetPostByRelatedDestinationInput, actor) => {
                await this._canList(actor);
                const where: Record<string, unknown> = {
                    relatedDestinationId: validated.destinationId
                };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id) {
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns List of posts related to the event
     */
    public async getByRelatedEvent(
        actor: Actor,
        params: GetPostByRelatedEventInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Post[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByRelatedEvent',
            input: { ...params, actor },
            schema: GetPostByRelatedEventInputSchema.strict(),
            ctx,
            execute: async (validated: GetPostByRelatedEventInput, actor) => {
                await this._canList(actor);
                const where: Record<string, unknown> = { relatedEventId: validated.eventId };

                // If no visibility is specified, default to PUBLIC for guest users
                if (validated.visibility) {
                    where.visibility = validated.visibility;
                } else if (!actor.id) {
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns Result of the operation
     */
    public async like(
        actor: Actor,
        params: { postId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'like',
            input: { ...params, actor },
            schema: LikePostInputSchema,
            ctx,
            execute: async (validated, actor) => {
                await this._canLike(actor);
                const post = await this.model.findOne({ id: validated.postId });
                if (!post) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
                }
                await this.model.incrementLikes({ id: validated.postId });
                return { success: true };
            }
        });
    }

    /**
     * Unlikes a post for a user.
     * @param actor - The user or system performing the action
     * @param params - The input params with postId
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns Result of the operation
     */
    public async unlike(
        actor: Actor,
        params: { postId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'unlike',
            input: { ...params, actor },
            schema: LikePostInputSchema,
            ctx,
            execute: async (validated, actor) => {
                await this._canLike(actor);
                const post = await this.model.findOne({ id: validated.postId });
                if (!post) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
                }
                await this.model.decrementLikes({ id: validated.postId });
                return { success: true };
            }
        });
    }

    /**
     * Adds a comment to a post. (Stub)
     * @param actor - The user or system performing the action
     * @param params - The post ID and comment
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns NOT_IMPLEMENTED error
     */
    public async addComment(
        actor: Actor,
        params: { postId: string; comment: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addComment',
            input: { ...params, actor },
            schema: z.object({ postId: z.string(), comment: z.string() }).strict(),
            ctx,
            execute: async (_validated: unknown, actor: Actor): Promise<{ success: boolean }> => {
                await this._canComment(actor);
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns NOT_IMPLEMENTED error
     */
    public async removeComment(
        actor: Actor,
        params: { postId: string; commentId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeComment',
            input: { ...params, actor },
            schema: z.object({ postId: z.string(), commentId: z.string() }).strict(),
            ctx,
            execute: async (_validated: unknown, actor: Actor): Promise<{ success: boolean }> => {
                await this._canComment(actor);
                throw new ServiceError(
                    ServiceErrorCode.NOT_IMPLEMENTED,
                    'removeComment is not implemented yet'
                );
            }
        });
    }

    /**
     * Increments the share count of a post.
     * @param actor - The user or system performing the action.
     * @param postId - The post ID.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns Success or error.
     */
    public async incrementShare(
        _actor: Actor,
        _postId: string,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return { data: { success: false } };
    }

    /**
     * Returns a summarized, public-facing version of a post (for cards/lists).
     * @param actor - The user or system performing the action.
     * @param data - Object with id or slug.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput<PostSummary | null>
     */
    public async getSummary(
        actor: Actor,
        data: GetPostSummaryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PostSummary | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { actor, ...data },
            schema: GetPostSummaryInputSchema,
            ctx,
            execute: async (validatedData, validatedActor, execCtx) => {
                const { id, slug } = validatedData;
                const field = id ? 'id' : 'slug';
                const value = id ?? slug;
                // Use model.findOne() directly to avoid loading 5 relations
                // (author, relatedAccommodation, relatedDestination, relatedEvent, sponsorship.sponsor)
                // that getSummary immediately discards.
                const post = await this.model.findOne({ [field]: value as string }, execCtx?.tx);
                if (!post) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
                }
                await this._canView(validatedActor, post as Post);
                const summary: PostSummary = {
                    id: post.id,
                    slug: post.slug,
                    title: post.title,
                    category: post.category,
                    lifecycleState: post.lifecycleState,
                    isFeatured: post.isFeatured,
                    publishedAt: post.publishedAt,
                    readingTimeMinutes: post.readingTimeMinutes,
                    media: post.media,
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput<PostEngagementStats | null>
     */
    public async getStats(
        actor: Actor,
        data: GetPostStatsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PostEngagementStats | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { actor, ...data },
            schema: GetPostStatsInputSchema,
            ctx,
            execute: async (validatedData, validatedActor, execCtx) => {
                const { id, slug } = validatedData;
                const field = id ? 'id' : 'slug';
                const value = id ?? slug;
                // Use model.findOne() directly to avoid loading 5 relations
                // that getStats immediately discards (only uses flat fields).
                const post = await this.model.findOne({ [field]: value as string }, execCtx?.tx);
                if (!post) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
                }
                await this._canView(validatedActor, post as Post);
                const stats: PostEngagementStats = {
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
        data: z.infer<typeof PostUpdateSchema>,
        ctx?: ServiceContext<PostHookState>
    ): Promise<ServiceOutput<Post>> {
        const resolvedCtx: ServiceContext<PostHookState> = { hookState: {}, ...ctx };
        if (resolvedCtx.hookState) {
            resolvedCtx.hookState.updateId = id;
        }
        try {
            return await super.update(actor, id, data, resolvedCtx as ServiceContext);
        } finally {
            if (resolvedCtx.hookState) {
                resolvedCtx.hookState.updateId = undefined;
            }
        }
    }

    /**
     * Returns a 12-month posts-per-month trend series for the admin dashboard.
     *
     * Gated on `POST_VIEW_ALL` — the same permission used by `adminList` and
     * `getById`. Delegates the DB aggregation to `PostModel.getMonthlyTrend`.
     *
     * @param actor - The actor performing the action. Must have `POST_VIEW_ALL`.
     * @param ctx - Optional service context for transaction propagation.
     * @returns Array of 12 `{ month: YYYY-MM, count: number }` items, oldest first.
     * @throws ServiceError (FORBIDDEN) when actor lacks permission.
     * @throws ServiceError (INTERNAL_ERROR) on unexpected DB errors.
     */
    public async getMonthlyTrend(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PostMonthlyTrendItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getMonthlyTrend',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor, execCtx) => {
                if (!hasPermission(validatedActor, PermissionEnum.POST_VIEW_ALL)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: POST_VIEW_ALL required for post monthly trend'
                    );
                }
                return this.model.getMonthlyTrend(execCtx?.tx);
            }
        });
    }
}
