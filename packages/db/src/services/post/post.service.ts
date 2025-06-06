import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostSponsorshipId,
    PostType,
    UserId
} from '@repo/types';
import { RoleEnum } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { PostModel } from '../../models/post/post.model';
import { dbLogger } from '../../utils/logger';
import { logDenied, logOverride } from '../../utils/permission-logger';
import { hasPermission } from '../../utils/permission-manager';
import {
    CanViewReasonEnum,
    getSafeActor,
    isPublicUser,
    isUserDisabled,
    logMethodEnd,
    logMethodStart
} from '../../utils/service-helper';
import { canViewPost } from './post.helper';
import {
    type GetByIdInput,
    type GetByIdOutput,
    type GetBySlugInput,
    type GetBySlugOutput,
    createPostInputSchema,
    getByIdInputSchema,
    getBySlugInputSchema
} from './post.schemas';

/**
 * PostService - Service layer for posts (MVP + future methods)
 * All methods follow RO-RO pattern, strong typing, and English documentation.
 */
export const PostService = {
    /**
     * Retrieves a post by its unique ID, applying robust permission checks, logging, and edge-case handling.
     * - Public posts are visible to anyone.
     * - The author can view their own posts (any visibility).
     * - Admins and superadmins can view any post.
     * - Private and draft posts require explicit permission.
     * - Disabled users cannot view any post.
     *
     * @param input - Object containing the post ID ({ id: PostId }).
     * @param actor - The user or public actor requesting the post.
     * @returns An object with the post if accessible, or null otherwise.
     * @throws Error if the post has unknown visibility (should not occur in current logic).
     * @example
     *   const { post } = await PostService.getById({ id: 'post-123' }, adminUser);
     */
    async getById(input: GetByIdInput, actor: unknown): Promise<GetByIdOutput> {
        logMethodStart(dbLogger, 'getById', input, actor as object);
        const parsedInput = getByIdInputSchema.parse(input);
        const post = (await PostModel.getById(parsedInput.id)) ?? null;
        if (!post) {
            logMethodEnd(dbLogger, 'getById', { post: null });
            return { post: null };
        }
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logMethodEnd(dbLogger, 'getById', { post: null });
            return { post: null };
        }
        const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
        if (
            reason === CanViewReasonEnum.UNKNOWN_VISIBILITY ||
            reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED
        ) {
            logMethodEnd(dbLogger, 'getById', { post: null });
            return { post: null };
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                hasPermission(safeActor, checkedPermission);
                logMethodEnd(dbLogger, 'getById', { post });
                return { post };
            } catch {
                logDenied(
                    dbLogger,
                    safeActor,
                    input,
                    post,
                    'missing permission',
                    checkedPermission
                );
                logMethodEnd(dbLogger, 'getById', { post: null });
                return { post: null };
            }
        }
        if (canView) {
            logMethodEnd(dbLogger, 'getById', { post });
            return { post };
        }
        // Explicit deny for all other cases
        logMethodEnd(dbLogger, 'getById', { post: null });
        return { post: null };
    },
    /**
     * Retrieves a post by its unique slug, applying robust permission checks, logging, and edge-case handling.
     * - Public posts are visible to anyone.
     * - The author can view their own posts (any visibility).
     * - Admins and superadmins can view any post.
     * - Private and draft posts require explicit permission.
     * - Disabled users cannot view any post.
     *
     * @param input - Object containing the post slug ({ slug: string }).
     * @param actor - The user or public actor requesting the post.
     * @returns An object with the post if accessible, or null otherwise.
     * @throws Error if the post has unknown visibility (should not occur in current logic).
     * @example
     *   const { post } = await PostService.getBySlug({ slug: 'my-post' }, adminUser);
     */
    async getBySlug(input: GetBySlugInput, actor: unknown): Promise<GetBySlugOutput> {
        logMethodStart(dbLogger, 'getBySlug', input, actor as object);
        const parsedInput = getBySlugInputSchema.parse(input);
        const post = (await PostModel.getBySlug(parsedInput.slug)) ?? null;
        if (!post) {
            logMethodEnd(dbLogger, 'getBySlug', { post: null });
            return { post: null };
        }
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logMethodEnd(dbLogger, 'getBySlug', { post: null });
            return { post: null };
        }
        const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
        if (
            reason === CanViewReasonEnum.UNKNOWN_VISIBILITY ||
            reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED
        ) {
            logMethodEnd(dbLogger, 'getBySlug', { post: null });
            return { post: null };
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                hasPermission(safeActor, checkedPermission);
                logMethodEnd(dbLogger, 'getBySlug', { post });
                return { post };
            } catch {
                logDenied(
                    dbLogger,
                    safeActor,
                    input,
                    post,
                    'missing permission',
                    checkedPermission
                );
                logMethodEnd(dbLogger, 'getBySlug', { post: null });
                return { post: null };
            }
        }
        if (canView) {
            logMethodEnd(dbLogger, 'getBySlug', { post });
            return { post };
        }
        // Explicit deny for all other cases
        logMethodEnd(dbLogger, 'getBySlug', { post: null });
        return { post: null };
    },
    /**
     * Lists posts with optional filters and pagination.
     * Handles edge-cases: public user, RO-RO pattern.
     *
     * Why: Centralizes visibility and access logic for bulk searches, preventing information leaks.
     *
     * @param input - The input object with filters and pagination.
     * @param actor - The user or public actor requesting the list.
     * @returns An object with the list of posts.
     * @example
     *   const result = await PostService.list({ limit: 10, offset: 0 }, user);
     */
    async list(
        input: import('./post.schemas').ListInput,
        actor: unknown
    ): Promise<import('./post.schemas').ListOutput> {
        logMethodStart(dbLogger, 'list', input, actor as object);
        const parsedInput = (await import('./post.schemas')).listInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        // Public users can only see PUBLIC posts
        const isPublic =
            safeActor &&
            typeof safeActor === 'object' &&
            'role' in safeActor &&
            safeActor.role === RoleEnum.GUEST;
        let finalInput = { ...parsedInput };
        if (isPublic) {
            finalInput = { ...finalInput, visibility: VisibilityEnum.PUBLIC };
        }
        // Call the model with the correct params
        const posts = await PostModel.list({
            limit: finalInput.limit,
            offset: finalInput.offset,
            order: finalInput.order,
            orderBy: finalInput.orderBy
        });
        logMethodEnd(dbLogger, 'list', { posts });
        return { posts };
    },
    /**
     * Advanced search for posts with filters, pagination, and strong permission logic.
     * - Public users can only see PUBLIC posts.
     * - Uses enums for category, lifecycle, and visibility.
     * - Returns paginated results and total count.
     *
     * @param input - Search filters and pagination.
     * @param actor - The user or public actor requesting the search.
     * @returns An object with the list of posts and total count.
     * @example
     *   const { posts, total } = await PostService.search({ q: 'foo', limit: 10 }, user);
     */
    async search(
        input: import('./post.schemas').SearchInput,
        actor: unknown
    ): Promise<import('./post.schemas').SearchOutput> {
        logMethodStart(dbLogger, 'search', input, actor as object);
        const { searchInputSchema } = await import('./post.schemas');
        const parsedInput = searchInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        // Public users can only see PUBLIC posts
        const isPublic =
            safeActor &&
            typeof safeActor === 'object' &&
            'role' in safeActor &&
            safeActor.role === RoleEnum.GUEST;
        let finalInput = { ...parsedInput };
        if (isPublic) {
            finalInput = { ...finalInput, visibility: VisibilityEnum.PUBLIC };
        }
        // Query posts and total count
        const [posts, total] = await Promise.all([
            PostModel.search({ ...finalInput }),
            PostModel.count({ ...finalInput })
        ]);
        logMethodEnd(dbLogger, 'search', { posts, total });
        return { posts, total };
    },
    /**
     * Retrieves posts by category, with pagination and permission logic.
     * - Public users can only see PUBLIC posts.
     * - Uses PostCategoryEnum for category.
     *
     * @param input - Object containing the category and pagination.
     * @param actor - The user or public actor requesting the posts.
     * @returns An object with the list of posts.
     * @example
     *   const { posts } = await PostService.getByCategory({ category: PostCategoryEnum.EVENTS }, user);
     */
    async getByCategory(
        input: import('./post.schemas').GetByCategoryInput,
        actor: unknown
    ): Promise<import('./post.schemas').GetByCategoryOutput> {
        logMethodStart(dbLogger, 'getByCategory', input, actor as object);
        const { getByCategoryInputSchema } = await import('./post.schemas');
        const parsedInput = getByCategoryInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        // Public users can only see PUBLIC posts
        const isPublic =
            safeActor &&
            typeof safeActor === 'object' &&
            'role' in safeActor &&
            safeActor.role === RoleEnum.GUEST;
        let posts = await PostModel.getByCategory(parsedInput.category);
        // Filter by visibility for public users
        if (isPublic) {
            posts = posts.filter((p) => p.visibility === VisibilityEnum.PUBLIC);
        }
        // Apply ordering
        const orderBy = parsedInput.orderBy;
        if (orderBy) {
            posts = posts.sort((a, b) => {
                const aValue = a[orderBy];
                const bValue = b[orderBy];
                if (aValue === bValue) return 0;
                if (parsedInput.order === 'desc') return aValue < bValue ? 1 : -1;
                return aValue > bValue ? 1 : -1;
            });
        }
        // Apply pagination
        const paginated = posts.slice(parsedInput.offset, parsedInput.offset + parsedInput.limit);
        logMethodEnd(dbLogger, 'getByCategory', { posts: paginated });
        return { posts: paginated };
    },
    /**
     * Creates a new post with strong validation, permission checks, and logging.
     * - Only authenticated users with POST_CREATE permission can create posts.
     * - Public users are explicitly denied.
     * - Input is validated with Zod and strong types.
     * - Logs start/end and permission denials.
     *
     * @param input - The post creation input object.
     * @param actor - The user attempting to create the post.
     * @returns An object with the created post.
     * @throws Error if the actor is public, disabled, lacks permission, or input is invalid.
     * @example
     *   const { post } = await PostService.create(input, user);
     */
    async create(
        input: import('./post.schemas').CreatePostInput,
        actor: unknown
    ): Promise<import('./post.schemas').CreatePostOutput> {
        logMethodStart(dbLogger, 'create', input, actor as object);
        const parsedInput = createPostInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isPublicUser(safeActor)) {
            logOverride(
                dbLogger,
                input,
                PermissionEnum.POST_CREATE,
                'Public user cannot create posts'
            );
            throw new Error('Forbidden: Public user cannot create posts');
        }
        if (isUserDisabled(safeActor)) {
            logDenied(
                dbLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility },
                'disabled user cannot create',
                'POST_CREATE'
            );
            throw new Error('Disabled user cannot create posts');
        }
        try {
            hasPermission(safeActor, PermissionEnum.POST_CREATE);
        } catch (err) {
            logDenied(
                dbLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility },
                (err as Error).message,
                'POST_CREATE'
            );
            throw err;
        }
        // Add required fields for NewPostInputType, fix branded types y media
        const postInput = {
            ...parsedInput,
            authorId: parsedInput.authorId as UserId,
            sponsorshipId: parsedInput.sponsorshipId as PostSponsorshipId | undefined,
            relatedDestinationId: parsedInput.relatedDestinationId as DestinationId | undefined,
            relatedAccommodationId: parsedInput.relatedAccommodationId as
                | AccommodationId
                | undefined,
            relatedEventId: parsedInput.relatedEventId as EventId | undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.PENDING_REVIEW,
            media:
                parsedInput.media && 'url' in parsedInput.media
                    ? {
                          featuredImage: {
                              url: parsedInput.media.url,
                              moderationState: ModerationStatusEnum.PENDING_REVIEW
                          }
                      }
                    : {
                          featuredImage: {
                              url: '',
                              moderationState: ModerationStatusEnum.PENDING_REVIEW
                          }
                      }
        };
        const post = await PostModel.create(postInput);
        logMethodEnd(dbLogger, 'create', { post });
        return { post };
    },
    /** Update an existing post. */
    async update(_input: unknown, _actor: unknown): Promise<{ post: PostType | null }> {
        throw new Error('Not implemented');
    },
    /** Soft delete a post. */
    async softDelete(_input: unknown, _actor: unknown): Promise<{ post: PostType | null }> {
        throw new Error('Not implemented');
    },
    /** Hard delete a post. */
    async hardDelete(_input: unknown, _actor: unknown): Promise<{ success: boolean }> {
        throw new Error('Not implemented');
    },
    /** Restore a soft-deleted post. */
    async restore(_input: unknown, _actor: unknown): Promise<{ post: PostType | null }> {
        throw new Error('Not implemented');
    },
    /** Get featured posts. */
    async getFeatured(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get news posts. */
    async getNews(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get posts related to an accommodation. */
    async getByRelatedAccommodation(
        _input: unknown,
        _actor: unknown
    ): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get posts related to a destination. */
    async getByRelatedDestination(
        _input: unknown,
        _actor: unknown
    ): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get posts related to an event. */
    async getByRelatedEvent(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    // --- Future methods ---
    /** Get posts by tag. */
    async getByTag(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get posts by sponsorship. */
    async getBySponsorship(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Count posts with filters. */
    async count(_input: unknown, _actor: unknown): Promise<{ count: number }> {
        throw new Error('Not implemented');
    },
    /** Get expired posts. */
    async getExpired(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get draft posts. */
    async getDrafts(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get posts by date range. */
    async getByDateRange(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Bulk delete posts. */
    async bulkDelete(_input: unknown, _actor: unknown): Promise<{ success: boolean }> {
        throw new Error('Not implemented');
    },
    /** Bulk update posts. */
    async bulkUpdate(_input: unknown, _actor: unknown): Promise<{ success: boolean }> {
        throw new Error('Not implemented');
    },
    /** Like or dislike a post. */
    async like(_input: unknown, _actor: unknown): Promise<{ post: PostType | null }> {
        throw new Error('Not implemented');
    },
    /** Comment on a post. */
    async comment(_input: unknown, _actor: unknown): Promise<{ post: PostType | null }> {
        throw new Error('Not implemented');
    },
    /** Share a post. */
    async share(_input: unknown, _actor: unknown): Promise<{ post: PostType | null }> {
        throw new Error('Not implemented');
    },
    /** Get posts by author. */
    async getByAuthor(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    }
};
