import type { UserBookmarkType } from '@repo/types';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Permite solo al dueño o a un admin acceder al bookmark.
 * @param actor - El usuario que realiza la acción
 * @param bookmark - El bookmark objetivo
 */
export const canAccessBookmark = (actor: Actor | undefined, bookmark: UserBookmarkType): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== bookmark.userId /* && actor.role !== 'ADMIN' */) {
        // TODO: Permitir acceso a admin si la política lo requiere
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
