import type { PostSponsor } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

/**
 * Checks if the actor can manage PostSponsors (create, update, delete, restore, view).
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export const checkCanManagePostSponsor = (actor: Actor, _entity?: PostSponsor): void => {
    if (!actor) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.POST_SPONSOR_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to manage post sponsors'
        );
    }
};

/**
 * Checks if an actor has the POST_SPONSOR_VIEW permission for admin list operations.
 * Requires POST_SPONSOR_VIEW permission in addition to admin access
 * (admin access is verified by the base class default).
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} If the actor lacks POST_SPONSOR_VIEW permission.
 */
export const checkCanAdminList = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.POST_SPONSOR_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: POST_SPONSOR_VIEW required for admin list'
        );
    }
};
