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
