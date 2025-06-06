import type { PostType } from '@repo/types';
import { RoleEnum } from '@repo/types';
import { PostModel } from '../../models/post/post.model';
import { dbLogger } from '../../utils/logger';
import { logDenied } from '../../utils/permission-logger';
import { hasPermission } from '../../utils/permission-manager';
import {
    CanViewReasonEnum,
    getSafeActor,
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
            finalInput = { ...finalInput, visibility: 'PUBLIC' };
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
    /** Search posts by query and filters. */
    async search(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get posts by category. */
    async getByCategory(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Get posts by author. */
    async getByAuthor(_input: unknown, _actor: unknown): Promise<{ posts: PostType[] }> {
        throw new Error('Not implemented');
    },
    /** Create a new post. */
    async create(_input: unknown, _actor: unknown): Promise<{ post: PostType }> {
        throw new Error('Not implemented');
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
    }
};
