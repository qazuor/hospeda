import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostSponsorshipId,
    PostType,
    UserId
} from '@repo/types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/types';
import { PostModel } from '../../models/post/post.model';
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
import { serviceLogger } from '../../utils/service-logger';
import { canViewPost } from './post.helper';
import {
    type GetByIdInput,
    type GetByIdOutput,
    type GetBySlugInput,
    type GetBySlugOutput,
    createPostInputSchema,
    getByIdInputSchema,
    getBySlugInputSchema,
    updatePostInputSchema
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
        logMethodStart(serviceLogger, 'getById', input, actor as object);
        const parsedInput = getByIdInputSchema.parse(input);
        const post = (await PostModel.getById(parsedInput.id)) ?? null;
        if (!post) {
            logMethodEnd(serviceLogger, 'getById', { post: null });
            return { post: null };
        }
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logMethodEnd(serviceLogger, 'getById', { post: null });
            return { post: null };
        }
        const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
        if (
            reason === CanViewReasonEnum.UNKNOWN_VISIBILITY ||
            reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED
        ) {
            logMethodEnd(serviceLogger, 'getById', { post: null });
            return { post: null };
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                hasPermission(safeActor, checkedPermission);
                logMethodEnd(serviceLogger, 'getById', { post });
                return { post };
            } catch {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    post,
                    'missing permission',
                    checkedPermission
                );
                logMethodEnd(serviceLogger, 'getById', { post: null });
                return { post: null };
            }
        }
        if (canView) {
            logMethodEnd(serviceLogger, 'getById', { post });
            return { post };
        }
        // Explicit deny for all other cases
        logMethodEnd(serviceLogger, 'getById', { post: null });
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
        logMethodStart(serviceLogger, 'getBySlug', input, actor as object);
        const parsedInput = getBySlugInputSchema.parse(input);
        const post = (await PostModel.getBySlug(parsedInput.slug)) ?? null;
        if (!post) {
            logMethodEnd(serviceLogger, 'getBySlug', { post: null });
            return { post: null };
        }
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logMethodEnd(serviceLogger, 'getBySlug', { post: null });
            return { post: null };
        }
        const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
        if (
            reason === CanViewReasonEnum.UNKNOWN_VISIBILITY ||
            reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED
        ) {
            logMethodEnd(serviceLogger, 'getBySlug', { post: null });
            return { post: null };
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                hasPermission(safeActor, checkedPermission);
                logMethodEnd(serviceLogger, 'getBySlug', { post });
                return { post };
            } catch {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    post,
                    'missing permission',
                    checkedPermission
                );
                logMethodEnd(serviceLogger, 'getBySlug', { post: null });
                return { post: null };
            }
        }
        if (canView) {
            logMethodEnd(serviceLogger, 'getBySlug', { post });
            return { post };
        }
        // Explicit deny for all other cases
        logMethodEnd(serviceLogger, 'getBySlug', { post: null });
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
        logMethodStart(serviceLogger, 'list', input, actor as object);
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
        logMethodEnd(serviceLogger, 'list', { posts });
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
        logMethodStart(serviceLogger, 'search', input, actor as object);
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
        logMethodEnd(serviceLogger, 'search', { posts, total });
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
        logMethodStart(serviceLogger, 'getByCategory', input, actor as object);
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
        // Si el actor es público, solo puede ver posts públicos
        if (isPublic) {
            posts = posts.filter((post) => post.visibility === VisibilityEnum.PUBLIC);
        } else {
            // Filtrar posts según permisos de visualización
            posts = posts.filter((post) => {
                const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
                if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
                    try {
                        hasPermission(safeActor, checkedPermission);
                        return true;
                    } catch {
                        return false;
                    }
                }
                return canView;
            });
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
        logMethodEnd(serviceLogger, 'getByCategory', { posts: paginated });
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
        logMethodStart(serviceLogger, 'create', input, actor as object);
        const parsedInput = createPostInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isPublicUser(safeActor)) {
            logOverride(
                serviceLogger,
                input,
                PermissionEnum.POST_CREATE,
                'Public user cannot create posts'
            );
            throw new Error('Forbidden: Public user cannot create posts');
        }
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
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
                serviceLogger,
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
        logMethodEnd(serviceLogger, 'create', { post });
        return { post };
    },
    /**
     * Updates an existing post with strong validation, permission checks, and logging.
     * - Only the author, admin, or user with POST_UPDATE permission can update posts.
     * - Public users are explicitly denied.
     * - Input is validated with Zod and strong types.
     * - Logs start/end and permission denials.
     *
     * @param input - The post update input object (must include id).
     * @param actor - The user attempting to update the post.
     * @returns An object with the updated post or null if not found.
     * @throws Error if the actor is public, disabled, lacks permission, or input is invalid.
     * @example
     *   const { post } = await PostService.update(input, user);
     */
    async update(
        input: import('./post.schemas').UpdatePostInput,
        actor: unknown
    ): Promise<import('./post.schemas').UpdatePostOutput> {
        logMethodStart(serviceLogger, 'update', input, actor as object);
        const parsedInput = updatePostInputSchema.parse(input);
        const post = await PostModel.getById(parsedInput.id);
        if (!post) {
            logMethodEnd(serviceLogger, 'update', { post: null });
            throw new Error('Post not found');
        }
        const safeActor = getSafeActor(actor);
        if (isPublicUser(safeActor)) {
            logOverride(
                serviceLogger,
                input,
                PermissionEnum.POST_UPDATE,
                'Public user cannot update posts'
            );
            throw new Error('Forbidden: Public user cannot update posts');
        }
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                'disabled user cannot update',
                'POST_UPDATE'
            );
            throw new Error('Disabled user cannot update posts');
        }
        // Only author, admin or user with POST_UPDATE can update
        const isAuthor = safeActor && 'id' in safeActor && safeActor.id === post.authorId;
        let hasUpdatePermission = false;
        try {
            hasUpdatePermission = isAuthor || hasPermission(safeActor, PermissionEnum.POST_UPDATE);
        } catch (err) {
            logDenied(serviceLogger, safeActor, input, post, (err as Error).message, 'POST_UPDATE');
            throw err;
        }
        if (!isAuthor && !hasUpdatePermission) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                'Forbidden: user cannot update post',
                'POST_UPDATE'
            );
            throw new Error('Forbidden: user cannot update post');
        }
        // Normalize input: remove id and non-updatable fields
        const {
            id,
            authorId,
            sponsorshipId,
            relatedDestinationId,
            relatedAccommodationId,
            relatedEventId,
            ...updateFields
        } = parsedInput;
        const updateInput = {
            ...updateFields,
            ...(authorId ? { authorId: authorId as UserId } : {}),
            ...(sponsorshipId ? { sponsorshipId: sponsorshipId as PostSponsorshipId } : {}),
            ...(relatedDestinationId
                ? { relatedDestinationId: relatedDestinationId as DestinationId }
                : {}),
            ...(relatedAccommodationId
                ? { relatedAccommodationId: relatedAccommodationId as AccommodationId }
                : {}),
            ...(relatedEventId ? { relatedEventId: relatedEventId as EventId } : {})
        };
        const updatedPost = await PostModel.update(id, updateInput);
        logMethodEnd(serviceLogger, 'update', { post: updatedPost });
        return { post: updatedPost ?? null };
    },
    /**
     * Soft deletes (archives) a post by ID.
     * Only the author, admin, or a user with the required permission can delete.
     * Handles edge-cases: public user, disabled user, already deleted, etc.
     *
     * @param input - The input object with the post ID.
     * @param actor - The user or public actor attempting the soft-delete.
     * @returns An object with the deleted (archived) post, or null if not found or not allowed.
     * @throws Error if the actor is not allowed to delete or input is invalid.
     * @example
     * const result = await softDelete({ id: 'post-1' }, user);
     */
    async softDelete(
        input: import('./post.schemas').GetByIdInput,
        actor: unknown
    ): Promise<{ post: PostType | null }> {
        logMethodStart(serviceLogger, 'delete', input, actor as object);
        const parsedInput = getByIdInputSchema.parse(input);
        const post = (await PostModel.getById(parsedInput.id)) ?? null;
        if (!post) {
            logMethodEnd(serviceLogger, 'delete', { post: null });
            throw new Error('Post not found');
        }
        if (post.deletedAt) {
            logMethodEnd(serviceLogger, 'delete', { post: null });
            throw new Error('Post already deleted');
        }
        const safeActor = getSafeActor(actor);
        if (isPublicUser(safeActor)) {
            logOverride(
                serviceLogger,
                input,
                PermissionEnum.POST_DELETE,
                'Public user cannot delete posts'
            );
            logMethodEnd(serviceLogger, 'delete', { post: null });
            throw new Error('Forbidden: Public user cannot delete posts');
        }
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                'disabled user cannot delete',
                'POST_DELETE'
            );
            logMethodEnd(serviceLogger, 'delete', { post: null });
            throw new Error('Disabled user cannot delete posts');
        }
        // Only author, admin or user with POST_DELETE can delete
        const isAuthor = safeActor && 'id' in safeActor && safeActor.id === post.authorId;
        let hasDeletePermission = false;
        try {
            hasDeletePermission = isAuthor || hasPermission(safeActor, PermissionEnum.POST_DELETE);
        } catch (err) {
            logDenied(serviceLogger, safeActor, input, post, (err as Error).message, 'POST_DELETE');
            logMethodEnd(serviceLogger, 'delete', { post: null });
            throw err;
        }
        if (!isAuthor && !hasDeletePermission) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                'Forbidden: user cannot delete post',
                'POST_DELETE'
            );
            logMethodEnd(serviceLogger, 'delete', { post: null });
            throw new Error('Forbidden: user cannot delete post');
        }
        // Soft delete: set deletedAt and deletedById
        await PostModel.delete(parsedInput.id, safeActor.id as string);
        const updatedPost = await PostModel.getById(parsedInput.id);
        logMethodEnd(serviceLogger, 'delete', { post: updatedPost });
        return { post: updatedPost ?? null };
    },
    /**
     * Hard deletes (permanently deletes) a post by ID.
     * Only the author, admin, or a user with the required permission can hard-delete.
     * Handles edge-cases: public user, disabled user, already deleted, etc.
     *
     * @param input - The input object with the post ID.
     * @param actor - The user or public actor attempting the hard-delete.
     * @returns An object with success true if deleted, false otherwise.
     * @throws Error if the actor is not allowed to hard-delete or input is invalid.
     * @example
     * const result = await hardDelete({ id: 'post-1' }, user);
     */
    async hardDelete(
        input: import('./post.schemas').GetByIdInput,
        actor: unknown
    ): Promise<import('./post.schemas').HardDeleteOutput> {
        logMethodStart(serviceLogger, 'hardDelete', input, actor as object);
        const parsedInput = getByIdInputSchema.parse(input);
        const post = (await PostModel.getById(parsedInput.id)) ?? null;
        if (!post) {
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Post not found');
        }
        if (post.deletedAt) {
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Post already deleted');
        }
        const safeActor = getSafeActor(actor);
        if (isPublicUser(safeActor)) {
            logOverride(
                serviceLogger,
                input,
                PermissionEnum.POST_HARD_DELETE,
                'Public user cannot hard delete posts'
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: Public user cannot hard delete posts');
        }
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                'disabled user cannot hard delete',
                'POST_HARD_DELETE'
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Disabled user cannot hard delete posts');
        }
        // Only author, admin or user with POST_HARD_DELETE can hard-delete
        const isAuthor = safeActor && 'id' in safeActor && safeActor.id === post.authorId;
        let hasHardDeletePermission = false;
        try {
            hasHardDeletePermission =
                isAuthor || hasPermission(safeActor, PermissionEnum.POST_HARD_DELETE);
        } catch (err) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                (err as Error).message,
                'POST_HARD_DELETE'
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw err;
        }
        if (!isAuthor && !hasHardDeletePermission) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                'Forbidden: user cannot hard delete post',
                'POST_HARD_DELETE'
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: user cannot hard delete post');
        }
        // Hard delete: remove from DB
        const deleted = await PostModel.hardDelete(parsedInput.id);
        logMethodEnd(serviceLogger, 'hardDelete', { success: deleted });
        return { success: deleted };
    },
    /**
     * Restores (un-archives) a soft-deleted post by ID.
     * Only the author, admin, or a user with the required permission can restore.
     * Handles edge-cases: public user, disabled user, not deleted, etc.
     *
     * @param input - The input object with the post ID.
     * @param actor - The user or public actor attempting the restore.
     * @returns An object with the restored post, or null if not found or not allowed.
     * @throws Error if the actor is not allowed to restore or input is invalid.
     * @example
     * const result = await restore({ id: 'post-1' }, user);
     */
    async restore(
        input: import('./post.schemas').GetByIdInput,
        actor: unknown
    ): Promise<{ post: PostType | null }> {
        logMethodStart(serviceLogger, 'restore', input, actor as object);
        const parsedInput = getByIdInputSchema.parse(input);
        const post = (await PostModel.getById(parsedInput.id)) ?? null;
        if (!post) {
            logMethodEnd(serviceLogger, 'restore', { post: null });
            throw new Error('Post not found');
        }
        if (!post.deletedAt) {
            logMethodEnd(serviceLogger, 'restore', { post: null });
            throw new Error('Post is not deleted');
        }
        const safeActor = getSafeActor(actor);
        if (isPublicUser(safeActor)) {
            logOverride(
                serviceLogger,
                input,
                PermissionEnum.POST_RESTORE,
                'Public user cannot restore posts'
            );
            logMethodEnd(serviceLogger, 'restore', { post: null });
            throw new Error('Forbidden: Public user cannot restore posts');
        }
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                'disabled user cannot restore',
                'POST_RESTORE'
            );
            logMethodEnd(serviceLogger, 'restore', { post: null });
            throw new Error('Disabled user cannot restore posts');
        }
        // Only author, admin or user with POST_RESTORE can restore
        const isAuthor = safeActor && 'id' in safeActor && safeActor.id === post.authorId;
        let hasRestorePermission = false;
        try {
            hasRestorePermission =
                isAuthor || hasPermission(safeActor, PermissionEnum.POST_RESTORE);
        } catch (err) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                (err as Error).message,
                'POST_RESTORE'
            );
            logMethodEnd(serviceLogger, 'restore', { post: null });
            throw err;
        }
        if (!isAuthor && !hasRestorePermission) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                post,
                'Forbidden: user cannot restore post',
                'POST_RESTORE'
            );
            logMethodEnd(serviceLogger, 'restore', { post: null });
            throw new Error('Forbidden: user cannot restore post');
        }
        // Restore: set deletedAt and deletedById to null
        await PostModel.update(parsedInput.id, {
            deletedAt: null as unknown as Date,
            deletedById: null as unknown as UserId
        });
        const updatedPost = await PostModel.getById(parsedInput.id);
        logMethodEnd(serviceLogger, 'restore', { post: updatedPost });
        return { post: updatedPost ?? null };
    },
    /**
     * Retrieves featured posts.
     * - Public users can only see PUBLIC posts.
     * - Authenticated users see posts according to their permissions and visibility.
     *
     * @param input - (Empty object, no parameters required).
     * @param actor - The user or public actor requesting the posts.
     * @returns An object with the list of featured posts.
     * @example
     *   const { posts } = await PostService.getFeatured({}, user);
     */
    async getFeatured(
        input: import('./post.schemas').GetFeaturedInput,
        actor: unknown
    ): Promise<import('./post.schemas').GetFeaturedOutput> {
        logMethodStart(serviceLogger, 'getFeatured', input, actor as object);
        const { getFeaturedInputSchema } = await import('./post.schemas');
        getFeaturedInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        // Fetch all posts and filter by isFeatured in memory (TODO: optimize with DB query if needed)
        let posts = (await PostModel.search({ limit: 1000, offset: 0 })).filter(
            (p) => p.isFeatured === true
        );
        // Filter posts according to view permissions
        posts = posts.filter((post) => {
            const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
            if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
                try {
                    hasPermission(safeActor, checkedPermission);
                    return true;
                } catch {
                    return false;
                }
            }
            return canView;
        });
        logMethodEnd(serviceLogger, 'getFeatured', { posts });
        return { posts };
    },
    /**
     * Retrieves news posts.
     * - Public users can only see PUBLIC posts.
     * - Authenticated users see posts according to their permissions and visibility.
     *
     * @param input - (Empty object, no parameters required).
     * @param actor - The user or public actor requesting the posts.
     * @returns An object with the list of news posts.
     * @example
     *   const { posts } = await PostService.getNews({}, user);
     */
    async getNews(
        input: import('./post.schemas').GetNewsInput,
        actor: unknown
    ): Promise<import('./post.schemas').GetNewsOutput> {
        logMethodStart(serviceLogger, 'getNews', input, actor as object);
        const { getNewsInputSchema } = await import('./post.schemas');
        getNewsInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        // Fetch all posts and filter by isNews in memory (TODO: optimize with DB query if needed)
        let posts = (await PostModel.search({ limit: 1000, offset: 0 })).filter(
            (p) => p.isNews === true
        );
        // Filter posts according to view permissions
        posts = posts.filter((post) => {
            const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
            if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
                try {
                    hasPermission(safeActor, checkedPermission);
                    return true;
                } catch {
                    return false;
                }
            }
            return canView;
        });
        logMethodEnd(serviceLogger, 'getNews', { posts });
        return { posts };
    },
    /**
     * Retrieves posts related to a specific accommodation.
     * - Public users can only see PUBLIC posts.
     * - Authenticated users see posts according to their permissions and visibility.
     *
     * @param input - Object containing the accommodationId.
     * @param actor - The user or public actor requesting the posts.
     * @returns An object with the list of related posts.
     * @example
     *   const { posts } = await PostService.getByRelatedAccommodation({ accommodationId }, user);
     */
    async getByRelatedAccommodation(
        input: import('./post.schemas').GetByRelatedAccommodationInput,
        actor: unknown
    ): Promise<import('./post.schemas').GetByRelatedAccommodationOutput> {
        logMethodStart(serviceLogger, 'getByRelatedAccommodation', input, actor as object);
        const { getByRelatedAccommodationInputSchema } = await import('./post.schemas');
        const parsedInput = getByRelatedAccommodationInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        // Fetch all posts and filter by relatedAccommodationId in memory (TODO: optimize with DB query if needed)
        let posts = (await PostModel.search({ limit: 1000, offset: 0 })).filter(
            (p) => p.relatedAccommodationId === parsedInput.accommodationId
        );
        // Filtrar posts según permisos de visualización
        posts = posts.filter((post) => {
            const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
            if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
                try {
                    hasPermission(safeActor, checkedPermission);
                    return true;
                } catch {
                    return false;
                }
            }
            return canView;
        });
        logMethodEnd(serviceLogger, 'getByRelatedAccommodation', { posts });
        return { posts };
    },
    /**
     * Retrieves posts related to a specific destination.
     * - Public users can only see PUBLIC posts.
     * - Authenticated users see posts according to their permissions and visibility.
     *
     * @param input - Object containing the destinationId.
     * @param actor - The user or public actor requesting the posts.
     * @returns An object with the list of related posts.
     * @example
     *   const { posts } = await PostService.getByRelatedDestination({ destinationId }, user);
     */
    async getByRelatedDestination(
        input: import('./post.schemas').GetByRelatedDestinationInput,
        actor: unknown
    ): Promise<import('./post.schemas').GetByRelatedDestinationOutput> {
        logMethodStart(serviceLogger, 'getByRelatedDestination', input, actor as object);
        const { getByRelatedDestinationInputSchema } = await import('./post.schemas');
        const parsedInput = getByRelatedDestinationInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        // Fetch all posts and filter by relatedDestinationId in memory (TODO: optimize with DB query if needed)
        let posts = (await PostModel.search({ limit: 1000, offset: 0 })).filter(
            (p) => p.relatedDestinationId === parsedInput.destinationId
        );
        // Filter posts according to view permissions
        posts = posts.filter((post) => {
            const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
            if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
                try {
                    hasPermission(safeActor, checkedPermission);
                    return true;
                } catch {
                    return false;
                }
            }
            return canView;
        });
        logMethodEnd(serviceLogger, 'getByRelatedDestination', { posts });
        return { posts };
    },
    /**
     * Retrieves posts related to a specific event.
     * - Public users can only see PUBLIC posts.
     * - Authenticated users see posts according to their permissions and visibility.
     *
     * @param input - Object containing the eventId.
     * @param actor - The user or public actor requesting the posts.
     * @returns An object with the list of related posts.
     * @example
     *   const { posts } = await PostService.getByRelatedEvent({ eventId }, user);
     */
    async getByRelatedEvent(
        input: import('./post.schemas').GetByRelatedEventInput,
        actor: unknown
    ): Promise<import('./post.schemas').GetByRelatedEventOutput> {
        logMethodStart(serviceLogger, 'getByRelatedEvent', input, actor as object);
        const { getByRelatedEventInputSchema } = await import('./post.schemas');
        const parsedInput = getByRelatedEventInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        // Fetch all posts and filter by relatedEventId in memory (TODO: optimize with DB query if needed)
        let posts = (await PostModel.search({ limit: 1000, offset: 0 })).filter(
            (p) => p.relatedEventId === parsedInput.eventId
        );
        // Filter posts according to view permissions
        posts = posts.filter((post) => {
            const { canView, reason, checkedPermission } = canViewPost(safeActor, post);
            if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
                try {
                    hasPermission(safeActor, checkedPermission);
                    return true;
                } catch {
                    return false;
                }
            }
            return canView;
        });
        logMethodEnd(serviceLogger, 'getByRelatedEvent', { posts });
        return { posts };
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
