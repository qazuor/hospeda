import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * The permission the `all` scope of the assistant activity requires:
 * `MCP_ACTIVITY_VIEW` (decision D-15), SUPER_ADMIN only. ADMIN does not hold
 * it. It replaced the interim `AUDIT_LOG_VIEW` of PR-10 in HOS-2349, together
 * with the enum migration and the SUPER_ADMIN grant.
 */
export const MCP_ACTIVITY_ALL_SCOPE_PERMISSION = PermissionEnum.MCP_ACTIVITY_VIEW;

/**
 * Checks the actor may read every user's assistant activity (scope `all`).
 * The `own` scope needs no permission: it is the actor's own rows.
 *
 * @param actor - The actor performing the read.
 * @throws {ServiceError} FORBIDDEN without {@link MCP_ACTIVITY_ALL_SCOPE_PERMISSION}.
 */
export const checkCanViewAllMcpActivity = (actor: Actor): void => {
    if (!hasPermission(actor, MCP_ACTIVITY_ALL_SCOPE_PERMISSION)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing permission to view all assistant activity'
        );
    }
};
