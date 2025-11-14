import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to view.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_USAGE_VIEW))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can view discount code usage'
        );
    }
}
