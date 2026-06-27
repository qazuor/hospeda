import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

export function checkCanManageFlags(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.FEATURE_FLAG_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: FEATURE_FLAG_MANAGE required for feature flag management'
        );
    }
}
