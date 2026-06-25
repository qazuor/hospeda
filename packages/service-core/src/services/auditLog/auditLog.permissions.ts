import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { AuditLogType } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if the actor can view admin audit log entries (`logType = 'audit'`).
 *
 * Gated by {@link PermissionEnum.AUDIT_LOG_VIEW} — a SUPER_ADMIN-only permission
 * (SPEC-162). Audit logs expose who-did-what across sensitive admin mutations.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If the actor lacks AUDIT_LOG_VIEW permission.
 */
export const checkCanViewAuditLogs = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.AUDIT_LOG_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing AUDIT_LOG_VIEW permission'
        );
    }
};

/**
 * Checks if the actor can view security log entries (`logType = 'security'`).
 *
 * Gated by {@link PermissionEnum.SECURITY_LOG_VIEW} — a SUPER_ADMIN-only
 * permission (SPEC-162). Security logs expose auth failures, lockouts, and
 * access-denied events.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If the actor lacks SECURITY_LOG_VIEW permission.
 */
export const checkCanViewSecurityLogs = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SECURITY_LOG_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing SECURITY_LOG_VIEW permission'
        );
    }
};

/**
 * Dispatches to the permission check matching the requested log family.
 * `audit` requires AUDIT_LOG_VIEW; `security` requires SECURITY_LOG_VIEW.
 *
 * @param actor - The actor performing the action.
 * @param logType - The log family being queried.
 * @throws {ServiceError} If the actor lacks the matching VIEW permission.
 */
export const checkCanViewAuditLogType = (actor: Actor, logType: AuditLogType): void => {
    if (logType === 'security') {
        checkCanViewSecurityLogs(actor);
        return;
    }
    checkCanViewAuditLogs(actor);
};
