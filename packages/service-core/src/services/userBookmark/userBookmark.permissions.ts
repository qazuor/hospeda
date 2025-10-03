import type { UserBookmark } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Permite solo al dueño o a un admin acceder al bookmark.
 * @param actor - El usuario que realiza la acción
 * @param bookmark - El bookmark objetivo
 */
export const canAccessBookmark = (actor: Actor | undefined, bookmark: UserBookmark): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== bookmark.userId /* && actor.role !== 'ADMIN' */) {
        // TODO [896b78b8-73b8-4462-b564-88a616dd1c4e]: Allow admin access if policy requires
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only owner can access bookmark'
        );
    }
};

/**
 * Permite solo al dueño crear bookmarks para sí mismo.
 * @param actor - El usuario que realiza la acción
 * @param userId - El userId objetivo
 */
export const canCreateBookmark = (actor: Actor | undefined, userId: string): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== userId || !actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only owner with permission can create bookmark'
        );
    }
};
