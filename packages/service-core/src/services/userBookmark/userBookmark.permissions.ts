import type { UserBookmark } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { entityNotFoundError } from '../../utils/not-found';
import { USER_BOOKMARK_ENTITY_NAME } from '../entity-names';

/**
 * Checks if an actor has the USER_BOOKMARK_VIEW_ANY permission,
 * which grants admin-level read access to any user's bookmarks.
 *
 * @param actor - The actor to check
 * @returns `true` if the actor has the view-any permission
 */
function hasViewAnyPermission(actor: Actor): boolean {
    return actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_VIEW_ANY) === true;
}

/**
 * Verifies that the actor is allowed to access the given bookmark.
 * Allows the owner of the bookmark or any actor with USER_BOOKMARK_VIEW_ANY permission.
 *
 * @param actor - The actor performing the action
 * @param bookmark - The target bookmark entity
 * @throws {ServiceError} If the actor is not the owner and lacks admin permission
 */
export const canAccessBookmark = (actor: Actor | undefined, bookmark: UserBookmark): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== bookmark.userId && !hasViewAnyPermission(actor)) {
        // HOS-600: NOT_FOUND, byte-identical to the answer for an id that
        // matches nothing. A 403 here confirmed the bookmark was real and
        // simply somebody else's, which the error contract's
        // "a foreign resource answers 404" rule exists to deny.
        throw entityNotFoundError({ entityName: USER_BOOKMARK_ENTITY_NAME });
    }
};

/**
 * Checks if an actor has the USER_BOOKMARK_VIEW_ANY permission for admin list operations.
 * Requires USER_BOOKMARK_VIEW_ANY permission in addition to admin access
 * (admin access is verified by the base class default).
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} If the actor lacks USER_BOOKMARK_VIEW_ANY permission.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_VIEW_ANY)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: USER_BOOKMARK_VIEW_ANY required for admin list'
        );
    }
}

/**
 * Verifies that the actor is allowed to create a bookmark for the given user.
 * Only the owner with USER_BOOKMARK_CREATE permission can create bookmarks for themselves.
 *
 * @param actor - The actor performing the action
 * @param userId - The target user ID for the bookmark
 * @throws {ServiceError} If the actor is not the owner or lacks the required permission
 */
export const canCreateBookmark = (actor: Actor | undefined, userId: string): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== userId || !actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only owner with permission can create bookmark'
        );
    }
};
