/**
 * Structured audit logging utility for security-sensitive operations.
 * Uses a dedicated AUDIT logger category for easy filtering and compliance.
 *
 * @module audit-logger
 */

import { AuditEventType, LoggerColors, logger } from '@repo/logger';
import type { AuditEventTypeValue } from '@repo/logger';
import * as Sentry from '@sentry/node';

// Re-export so existing callers that import from this module are unaffected.
export { AuditEventType };
export type { AuditEventTypeValue };

/** Dedicated AUDIT logger category */
const auditLogger = logger.registerCategory('AUDIT', 'AUDIT', {
    color: LoggerColors.RED
});

/** Base fields present in every audit entry */
interface BaseAuditEntry {
    readonly auditEvent: AuditEventTypeValue;
    readonly timestamp?: string;
}

interface AuthLoginFailedEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOGIN_FAILED;
    readonly email: string;
    readonly ip: string;
    readonly reason: string;
    readonly attemptNumber: number;
    readonly locked: boolean;
}

interface AuthLoginSuccessEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOGIN_SUCCESS;
    readonly email: string;
    readonly ip: string;
}

interface AuthLockoutEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOCKOUT;
    readonly email: string;
    readonly ip: string;
    readonly attemptNumber: number;
    readonly retryAfter: number;
}

interface AuthPasswordChangedEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_PASSWORD_CHANGED;
    readonly actorId: string;
    readonly ip: string;
}

interface AccessDeniedEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.ACCESS_DENIED;
    readonly actorId: string;
    readonly actorRole: string;
    readonly resource: string;
    readonly method: string;
    readonly statusCode: number;
    readonly reason: string;
    readonly requiredPermissions?: readonly string[];
}

interface BillingMutationEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.BILLING_MUTATION;
    readonly actorId: string;
    readonly action: 'create' | 'update' | 'delete';
    readonly resourceType: string;
    readonly resourceId: string;
}

interface PermissionChangeEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.PERMISSION_CHANGE;
    readonly actorId: string;
    readonly targetUserId: string;
    readonly changeType: 'role_assignment' | 'permission_grant' | 'permission_revoke';
    readonly oldValue: string;
    readonly newValue: string;
}

interface SessionSignoutEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.SESSION_SIGNOUT;
    readonly actorId: string;
    readonly ip: string;
}

/**
 * Audit entry for PII-critical user admin mutations.
 *
 * Covers the full lifecycle of admin-driven user changes:
 * - create: admin creates a new user account
 * - soft_delete: admin soft-deletes a user (reversible)
 * - hard_delete: admin permanently deletes a user (irreversible)
 * - restore: admin restores a soft-deleted user
 */
interface UserAdminMutationEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.USER_ADMIN_MUTATION;
    /** ID of the admin performing the operation. */
    readonly actorId: string;
    /** ID of the user being created, deleted, or restored. */
    readonly targetUserId: string;
    /** Operation performed on the target user. */
    readonly operation: 'create' | 'soft_delete' | 'hard_delete' | 'restore';
}

/**
 * Audit entry for generic HTTP mutation requests.
 *
 * Emitted by the audit middleware for any state-changing HTTP method
 * (POST, PUT, PATCH, DELETE) that is not covered by a more specific event type.
 */
interface RouteMutationEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.ROUTE_MUTATION;
    /** ID of the actor performing the mutation, or 'anonymous' for unauthenticated requests. */
    readonly actorId: string;
    /** Role of the actor, or 'guest' for unauthenticated requests. */
    readonly actorRole: string;
    /** HTTP method of the request (POST, PUT, PATCH, DELETE). */
    readonly method: string;
    /** Route path of the request. */
    readonly path: string;
    /** HTTP status code of the response. */
    readonly statusCode: number;
    /** Scrubbed request body, or undefined if the body was empty or not JSON. */
    readonly requestBody?: unknown;
}

/** Discriminated union of all audit entry types */
export type AuditEntry =
    | AuthLoginFailedEntry
    | AuthLoginSuccessEntry
    | AuthLockoutEntry
    | AuthPasswordChangedEntry
    | AccessDeniedEntry
    | BillingMutationEntry
    | PermissionChangeEntry
    | SessionSignoutEntry
    | UserAdminMutationEntry
    | RouteMutationEntry;

/**
 * Audit event types that represent critical security events.
 * These are sent to Sentry at the 'warning' level to ensure elevated visibility.
 * All other audit events are sent at 'info' level.
 */
const CRITICAL_AUDIT_EVENTS = new Set<AuditEventTypeValue>([
    AuditEventType.AUTH_LOGIN_FAILED,
    AuditEventType.AUTH_LOCKOUT,
    AuditEventType.ACCESS_DENIED,
    AuditEventType.BILLING_MUTATION,
    AuditEventType.PERMISSION_CHANGE,
    AuditEventType.USER_ADMIN_MUTATION
]);

/** Regex pattern matching sensitive field names that must be redacted */
const SENSITIVE_PATTERNS =
    /password|token|secret|session_id|cookie|authorization|credential|creditcard|credit_card|ssn|apikey|api_key|privatekey|private_key|accesskey|access_key/i;

/** Maximum recursion depth to prevent stack overflow on deeply nested objects */
const MAX_SCRUB_DEPTH = 10;

/** Sentinel string used to replace sensitive values */
const REDACTED = '[REDACTED]';

/**
 * Recursively scrub sensitive field values from an object or array.
 *
 * Traverses the input structure up to `MAX_SCRUB_DEPTH` levels deep and
 * replaces any value whose key matches `SENSITIVE_PATTERNS` with the
 * `[REDACTED]` sentinel. Cycle detection via `WeakSet` prevents infinite
 * loops on circular references. Primitives and `null` are returned as-is.
 *
 * @param value - The value to scrub (object, array, or primitive).
 * @param seen  - WeakSet tracking already-visited objects to detect cycles.
 * @param depth - Current recursion depth; stops at `MAX_SCRUB_DEPTH`.
 * @returns A new structure with sensitive values replaced by `[REDACTED]`.
 *
 * @example
 * ```ts
 * scrubSensitiveData({ user: { password: 'abc', name: 'Alice' } })
 * // => { user: { password: '[REDACTED]', name: 'Alice' } }
 * ```
 */
function scrubSensitiveData(
    value: unknown,
    seen: WeakSet<object> = new WeakSet(),
    depth = 0
): unknown {
    // Hard stop at maximum depth to prevent stack overflow
    if (depth >= MAX_SCRUB_DEPTH) {
        return value;
    }

    // Primitives and null pass through unchanged
    if (value === null || typeof value !== 'object') {
        return value;
    }

    // Cycle detection: return a placeholder if we have already visited this object
    if (seen.has(value)) {
        return '[Circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
        const result = value.map((item) => scrubSensitiveData(item, seen, depth + 1));
        seen.delete(value);
        return result;
    }

    const record = value as Record<string, unknown>;
    const scrubbed: Record<string, unknown> = {};

    for (const key of Object.keys(record)) {
        if (SENSITIVE_PATTERNS.test(key)) {
            scrubbed[key] = REDACTED;
        } else {
            scrubbed[key] = scrubSensitiveData(record[key], seen, depth + 1);
        }
    }

    seen.delete(value);
    return scrubbed;
}

/**
 * Write a structured audit log entry.
 * Timestamp is auto-generated if not provided.
 * Sensitive fields are automatically redacted.
 *
 * This function is intentionally non-throwing: any internal error is caught
 * and reported via console.error as a last-resort fallback. This ensures that
 * a logging failure never interrupts a security-sensitive request path.
 */
export function auditLog(entry: AuditEntry): void {
    try {
        const fullEntry = {
            ...entry,
            timestamp: entry.timestamp ?? new Date().toISOString()
        };
        const scrubbed = scrubSensitiveData(fullEntry) as Record<string, unknown>;
        auditLogger.info(scrubbed, `AUDIT:${entry.auditEvent}`);

        // Send audit breadcrumb to Sentry for request-level tracing.
        // Critical security events use 'warning' level for elevated visibility
        // in Sentry dashboards; normal events use 'info'.
        const isCritical = CRITICAL_AUDIT_EVENTS.has(entry.auditEvent);
        Sentry.addBreadcrumb({
            category: 'audit',
            message: `AUDIT:${entry.auditEvent}`,
            level: isCritical ? 'warning' : 'info',
            data: scrubbed,
            timestamp: new Date(fullEntry.timestamp as string).getTime() / 1000
        });
    } catch (error) {
        // Last-resort fallback: use console.error so that a broken audit logger
        // never silently swallows the failure or propagates into the caller.
        console.error('[audit-logger] Failed to write audit log entry', {
            auditEvent: entry.auditEvent,
            error
        });
    }
}
