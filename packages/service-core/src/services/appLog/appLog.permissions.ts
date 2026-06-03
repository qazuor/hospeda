import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if the actor can view application log entries.
 *
 * App log entries are operational/observability data. Access is gated by
 * {@link PermissionEnum.SYSTEM_MAINTENANCE_MODE} — the same permission that
 * guards the cron observability surface (SPEC-161) — because the log viewer
 * is co-located under Plataforma → Operaciones del sistema (SPEC-184).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If the actor lacks SYSTEM_MAINTENANCE_MODE permission.
 */
export const checkCanViewAppLogs = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SYSTEM_MAINTENANCE_MODE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing SYSTEM_MAINTENANCE_MODE permission'
        );
    }
};
