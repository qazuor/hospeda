/**
 * Shared audit event type definitions for structured audit logging.
 *
 * These types are shared across all apps in the monorepo so that consumers
 * (e.g. the admin dashboard) can reference audit event type constants without
 * creating a dependency on the API app.
 *
 * @module logger/audit-types
 */

/**
 * Audit event type constants.
 * Each event type corresponds to a specific security-sensitive operation.
 *
 * @example
 * ```ts
 * import { AuditEventType } from '@repo/logger';
 *
 * auditLog({
 *   auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
 *   email: 'user@example.com',
 *   ip: '127.0.0.1',
 * });
 * ```
 */
export const AuditEventType = {
    AUTH_LOGIN_FAILED: 'auth.login.failed',
    AUTH_LOGIN_SUCCESS: 'auth.login.success',
    AUTH_LOCKOUT: 'auth.lockout',
    AUTH_PASSWORD_CHANGED: 'auth.password.changed',
    ACCESS_DENIED: 'access.denied',
    BILLING_MUTATION: 'billing.mutation',
    PERMISSION_CHANGE: 'permission.change',
    SESSION_SIGNOUT: 'session.signout',
    USER_ADMIN_MUTATION: 'user.admin.mutation',
    /**
     * Generic audit event for HTTP mutation requests (POST, PUT, PATCH, DELETE).
     * Emitted by the audit middleware for any state-changing route that is not
     * already covered by a more specific audit event type.
     */
    ROUTE_MUTATION: 'route.mutation'
} as const;

/**
 * Union of all possible audit event type string values.
 */
export type AuditEventTypeValue = (typeof AuditEventType)[keyof typeof AuditEventType];
