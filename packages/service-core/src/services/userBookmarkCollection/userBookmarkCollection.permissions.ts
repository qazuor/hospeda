import type { UserBookmarkCollection } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has the USER_BOOKMARK_COLLECTION_VIEW_ANY permission,
 * which grants admin-level read access to any user's bookmark collections.
 *
 * @param actor - The actor to check
 * @returns `true` if the actor has the view-any permission
 */
export function hasViewAnyPermission(actor: Actor): boolean {
    return actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY) === true;
}

/**
 * Verifies that the actor is allowed to access the given collection.
 * Allows the owner of the collection or any actor with
 * USER_BOOKMARK_COLLECTION_VIEW_ANY permission.
 *
 * @param actor - The actor performing the action
 * @param collection - The target bookmark collection entity
 * @throws {ServiceError} If the actor is not the owner and lacks admin permission
 */
export const canAccessCollection = (
    actor: Actor | undefined,
    collection: UserBookmarkCollection
): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== collection.userId && !hasViewAnyPermission(actor)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only owner can access collection'
        );
    }
};

/**
 * Checks if an actor has the USER_BOOKMARK_COLLECTION_VIEW_ANY permission
 * for admin list operations.
 * Requires USER_BOOKMARK_COLLECTION_VIEW_ANY in addition to base admin access
 * (admin access is verified by the base class default).
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} If the actor lacks USER_BOOKMARK_COLLECTION_VIEW_ANY permission.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: USER_BOOKMARK_COLLECTION_VIEW_ANY required for admin list'
        );
    }
}

/**
 * Verifies that the actor is allowed to create a bookmark collection for
 * the given user. Only the owner with USER_BOOKMARK_COLLECTION_CREATE
 * permission can create collections for themselves.
 *
 * @param actor - The actor performing the action
 * @param userId - The target user ID for the collection
 * @throws {ServiceError} If the actor is not the owner or lacks the required permission
 */
export const canCreateCollection = (actor: Actor | undefined, userId: string): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (
        actor.id !== userId ||
        !actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only owner with permission can create collection'
        );
    }
};
