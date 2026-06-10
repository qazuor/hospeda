import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if the actor can view cron run history.
 *
 * Cron run history is operational/observability data. Access is gated by
 * {@link PermissionEnum.SYSTEM_MAINTENANCE_MODE}, the same permission that guards
 * the existing cron-admin endpoints (list jobs + manual trigger), keeping the
 * whole cron surface behind a single gate.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If the actor lacks SYSTEM_MAINTENANCE_MODE permission.
 */
export const checkCanViewCronRuns = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SYSTEM_MAINTENANCE_MODE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing SYSTEM_MAINTENANCE_MODE permission'
        );
    }
};
