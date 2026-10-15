import type { PermissionEnum } from '@repo/schemas';
import {
    isSuperAdminExclusivePermission,
    ServiceErrorCode,
    SUPER_ADMIN_ONLY_PERMISSION_REASON
} from '@repo/schemas';
import { ServiceError } from '../../types';

/**
 * Prevents direct grants of permissions whose authority must come from the
 * SUPER_ADMIN role. This keeps old rows harmless at resolution (V5.md:1260-1261;
 * F5-AUT-003) while making new account and role assignments fail explicitly.
 * @param params.permission - Permission requested for assignment.
 * @throws {ServiceError} VALIDATION_ERROR when the permission is exclusive.
 */
export const assertPermissionIsNotSuperAdminExclusive = (params: {
    readonly permission: PermissionEnum;
}): void => {
    if (!isSuperAdminExclusivePermission({ permission: params.permission })) return;
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'This permission can only be granted through the SUPER_ADMIN role.',
        undefined,
        SUPER_ADMIN_ONLY_PERMISSION_REASON
    );
};
