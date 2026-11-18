import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * The permission the `all` scope of the assistant activity requires.
 *
 * Interim: `AUDIT_LOG_VIEW` (SUPER_ADMIN only). It already lets its holder
 * read these same `mcp.tool.call` rows through `GET /api/v1/admin/audit-logs`,
 * so the `all` scope exposes nothing new. HOS-2349 (PR-12 of HOS-2335) adds
 * `MCP_ACTIVITY_VIEW` (D-15) and switches this constant to it, in the same
 * change as the enum migration and the SUPER_ADMIN grant.
 */
export const MCP_ACTIVITY_ALL_SCOPE_PERMISSION = PermissionEnum.AUDIT_LOG_VIEW;

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
