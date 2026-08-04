import type { Post } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import { type Actor, ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';
import { isAuthorEditLockedByModeration } from '../moderation/author-edit-lock';

/**
 * Checks if the actor has a specific permission.
 * @param actor - The actor to check.
 * @param permission - The required permission.
 * @throws ServiceError if forbidden
 */
const requirePermission = (actor: Actor, permission: PermissionEnum): void => {
    if (!actor || !actor.permissions?.includes(permission)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, `Forbidden: missing ${permission}`);
    }
};

/**
 * Checks if the actor can create a post.
 * @throws ServiceError if forbidden
 */
export function checkCanCreatePost(actor: Actor): void {
    requirePermission(actor, PermissionEnum.POST_CREATE);
}

/**
 * Checks if the actor can update a post.
 *
 * Two independent paths (HOS-374 §7.6.2):
 * - `POST_UPDATE` is the broad side: any post, any state.
 * - `POST_UPDATE_OWN` is the author side: only posts the actor authored, and
 *   only while the platform has not approved them — unless the actor also
 *   holds `POST_PUBLISH_OWN` (§7.6.3).
 *
 * Authorship alone no longer grants the update. Before HOS-374 any actor whose
 * id matched `authorId` could edit, with no permission at all.
 *
 * @throws ServiceError if forbidden
 */
export function checkCanUpdatePost(actor: Actor, post: Post): void {
    if (hasPermission(actor, PermissionEnum.POST_UPDATE)) {
        return;
    }
    if (actor.id === post.authorId && hasPermission(actor, PermissionEnum.POST_UPDATE_OWN)) {
        if (
            isAuthorEditLockedByModeration({
                moderationState: post.moderationState,
                canPublishOwn: hasPermission(actor, PermissionEnum.POST_PUBLISH_OWN)
            })
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Forbidden: cannot update a published post'
            );
        }
        return;
    }
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: cannot update post');
}

/**
 * Checks if the actor can delete a post.
 *
 * `POST_DELETE` deletes any post; `POST_DELETE_OWN` deletes only the actor's
 * own. Authorship alone is not enough — deleting own content is a trusted-editor
 * capability, not a plain editor one (HOS-374 §7.6.2).
 *
 * @throws ServiceError if forbidden
 */
export function checkCanDeletePost(actor: Actor, post: Post): void {
    if (hasPermission(actor, PermissionEnum.POST_DELETE)) {
        return;
    }
    if (actor.id === post.authorId && hasPermission(actor, PermissionEnum.POST_DELETE_OWN)) {
        return;
    }
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: cannot delete post');
}

/**
 * Checks if the actor can restore a post.
 * @throws ServiceError if forbidden
 */
export function checkCanRestorePost(actor: Actor): void {
    requirePermission(actor, PermissionEnum.POST_RESTORE);
}

/**
 * Checks if the actor can hard delete a post.
 * @throws ServiceError if forbidden
 */
export function checkCanHardDeletePost(actor: Actor): void {
    requirePermission(actor, PermissionEnum.POST_HARD_DELETE);
}

/**
 * Checks if the actor can view a post, considering visibility and permissions.
 * @throws ServiceError if forbidden
 */
export function checkCanViewPost(actor: Actor, post: Post): void {
    // Soft-deleted posts existed but are permanently gone. findOneWithRelations
    // does not filter deleted_at IS NULL, so enforce it here. Only posts that
    // were PUBLIC (indexable) surface as GONE (410) so crawlers/LLM fetchers
    // deindex the URL fast; a deleted PRIVATE post that was never public returns
    // NOT_FOUND (404, uniform) to preserve the anti-enumeration contract
    // (SPEC-092 T-087). The author and staff with POST_VIEW_ALL may still view a
    // deleted post for management. Without this guard, a soft-deleted PUBLIC post
    // leaked a full 200. HOS-117 T-022.
    if (
        post.deletedAt !== null &&
        post.deletedAt !== undefined &&
        actor.id !== post.authorId &&
        !hasPermission(actor, PermissionEnum.POST_VIEW_ALL)
    ) {
        if (post.visibility === VisibilityEnum.PUBLIC) {
            throw new ServiceError(ServiceErrorCode.GONE, 'Post is gone');
        }
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
    }

    if (post.visibility === VisibilityEnum.PUBLIC) return;
    if (
        post.visibility === VisibilityEnum.PRIVATE &&
        (actor.id === post.authorId || actor.permissions.includes(PermissionEnum.POST_VIEW_PRIVATE))
    ) {
        return;
    }
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: cannot view post');
}

/**
 * Checks if the actor can like a post.
 * @throws ServiceError if forbidden
 */
export function checkCanLikePost(actor: Actor): void {
    // Any authenticated user can like
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: cannot like post');
    }
}

/**
 * Checks if the actor can comment on a post.
 * @throws ServiceError if forbidden
 */
export function checkCanCommentPost(actor: Actor): void {
    // Any authenticated user can comment
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: cannot comment on post');
    }
}

/**
 * Checks if an actor has permission to admin-list this entity type.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.POST_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: POST_VIEW_ALL required for admin list'
        );
    }
}
