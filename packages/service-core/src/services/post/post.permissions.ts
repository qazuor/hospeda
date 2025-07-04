import type { PostType } from '@repo/types';
import { PermissionEnum, RoleEnum, ServiceErrorCode, VisibilityEnum } from '@repo/types';
import { type Actor, ServiceError } from '../../types';

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
 * @throws ServiceError if forbidden
 */
export function checkCanUpdatePost(actor: Actor, post: PostType): void {
    // Admins or editors can update any post, users only their own
    if (
        actor.permissions.includes(PermissionEnum.POST_UPDATE) ||
        (actor.id === post.authorId &&
            (actor.role === RoleEnum.USER || actor.role === RoleEnum.EDITOR))
    ) {
        return;
    }
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: cannot update post');
}

/**
 * Checks if the actor can delete a post.
 * @throws ServiceError if forbidden
 */
export function checkCanDeletePost(actor: Actor, post: PostType): void {
    if (
        actor.permissions.includes(PermissionEnum.POST_DELETE) ||
        (actor.id === post.authorId &&
            (actor.role === RoleEnum.USER || actor.role === RoleEnum.EDITOR))
    ) {
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
export function checkCanViewPost(actor: Actor, post: PostType): void {
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
    // For now, any authenticated user can like
    if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: cannot like post');
    }
}

/**
 * Checks if the actor can comment on a post.
 * @throws ServiceError if forbidden
 */
export function checkCanCommentPost(actor: Actor): void {
    // For now, any authenticated user can comment
    if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: cannot comment on post');
    }
}
