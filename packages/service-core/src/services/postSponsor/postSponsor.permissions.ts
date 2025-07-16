import { ServiceError } from '@repo/service-core';
import type { PostSponsorType } from '@repo/types';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';
import { hasPermission } from '../../utils/permission';

/**
 * Checks if the actor can manage PostSponsors (create, update, delete, restore, view).
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export const checkCanManagePostSponsor = (actor: Actor, _entity?: PostSponsorType): void => {
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
