/**
 * Structured audit logging utility for security-sensitive operations.
 * Uses a dedicated AUDIT logger category for easy filtering and compliance.
 *
 * @module audit-logger
 */

import { AuditEventType, LoggerColors, logger } from '@repo/logger';
import type { AuditEventTypeValue } from '@repo/logger';
import type { AuditLogType, CreateAuditLogEntry } from '@repo/schemas';
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

/**
 * Audit event types that belong to the SECURITY log family (auth-related).
 * Everything not in this set is classified as an AUDIT-family event
 * (admin actions). The classification drives the `logType` discriminator on the
 * persisted `audit_log_entries` row (SPEC-162), which in turn determines which
 * permission (AUDIT_LOG_VIEW vs SECURITY_LOG_VIEW) can read the entry back.
 */
const SECURITY_AUDIT_EVENTS = new Set<AuditEventTypeValue>([
    AuditEventType.AUTH_LOGIN_FAILED,
    AuditEventType.AUTH_LOGIN_SUCCESS,
    AuditEventType.AUTH_LOCKOUT,
    AuditEventType.AUTH_PASSWORD_CHANGED,
    AuditEventType.ACCESS_DENIED,
    AuditEventType.SESSION_SIGNOUT
]);

/**
 * Classifies an audit event into its log family.
 *
 * @param event - The audit event type.
 * @returns `'security'` for auth-related events, `'audit'` otherwise.
 */
export function classifyAuditLogType(event: AuditEventTypeValue): AuditLogType {
    return SECURITY_AUDIT_EVENTS.has(event) ? 'security' : 'audit';
}

/**
 * Persister callback used to make audit/security events queryable (SPEC-162).
 *
 * Injected once at API startup via {@link registerAuditLogPersister}. Decoupled
 * by design so this leaf utility never imports `@repo/db` / `@repo/service-core`
 * (which would invert the dependency graph and complicate unit testing). The
 * persister itself MUST be non-throwing / fire-and-forget — `auditLog` calls it
 * synchronously inside its try/catch but does not await it.
 */
export type AuditLogPersister = (record: CreateAuditLogEntry) => void;

let auditLogPersister: AuditLogPersister | undefined;

/**
 * Registers the persister that stores audit/security events into the queryable
 * store. Call once at server startup, AFTER the database has been initialized.
 *
 * @param persister - The persister callback (fire-and-forget).
 */
export function registerAuditLogPersister(persister: AuditLogPersister): void {
    auditLogPersister = persister;
}

/**
 * Test-only helper: clears the registered persister so each test starts clean.
 */
export function __resetAuditLogPersisterForTests(): void {
    auditLogPersister = undefined;
}

/** Reads a string-ish field off the raw entry, returning undefined when absent. */
function readStr(entry: Record<string, unknown>, key: string): string | undefined {
    const value = entry[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Reads a number-ish field off the raw entry, returning undefined when absent. */
function readNum(entry: Record<string, unknown>, key: string): number | undefined {
    const value = entry[key];
    return typeof value === 'number' ? value : undefined;
}

/** Matches a canonical UUID (any version). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads a UUID field off the raw entry. Returns undefined for non-UUID values
 * (e.g. the `'anonymous'` actor marker on unauthenticated route mutations) so
 * the value never violates the uuid column / schema; the original marker is
 * still preserved in the `data` payload and the `actorRole` column.
 */
function readUuid(entry: Record<string, unknown>, key: string): string | undefined {
    const value = readStr(entry, key);
    return value && UUID_RE.test(value) ? value : undefined;
}

/**
 * Resolves the `targetId` column from the heterogeneous entry shapes:
 * - login/lockout events → the `email` under attack
 * - permission/user-admin mutations → `targetUserId`
 * - billing mutations → `resourceType:resourceId`
 *
 * @param entry - The raw audit entry as a record.
 * @returns The target identifier, or undefined when none applies.
 */
function resolveTargetId(entry: Record<string, unknown>): string | undefined {
    const targetUserId = readStr(entry, 'targetUserId');
    if (targetUserId) return targetUserId;
    const resourceId = readStr(entry, 'resourceId');
    if (resourceId) {
        const resourceType = readStr(entry, 'resourceType');
        return resourceType ? `${resourceType}:${resourceId}` : resourceId;
    }
    return readStr(entry, 'email');
}

/**
 * Builds a short, human-readable summary for the persisted `message` column.
 * The full structured payload is preserved in `data`, so this stays terse.
 *
 * @param entry - The raw audit entry as a record.
 * @returns A one-line summary string.
 */
function buildSummary(entry: Record<string, unknown>): string {
    const event = String(entry.auditEvent);
    const subject = readStr(entry, 'email') ?? resolveTargetId(entry) ?? readStr(entry, 'actorId');
    const ip = readStr(entry, 'ip');
    const method = readStr(entry, 'method');
    const path = readStr(entry, 'path') ?? readStr(entry, 'resource');
    const parts = [event];
    if (method && path) parts.push(`${method} ${path}`);
    if (subject) parts.push(subject);
    if (ip) parts.push(`from ${ip}`);
    return parts.join(' ');
}

/**
 * Maps a scrubbed audit entry to the persister's create input (SPEC-162).
 * Flat columns are extracted from the (non-sensitive) entry fields for indexing
 * and filtering; the full scrubbed payload is stored under `data`.
 *
 * @param entry - The raw audit entry (already timestamped).
 * @param scrubbed - The redacted payload to store under `data`.
 * @param isCritical - Whether the event is in {@link CRITICAL_AUDIT_EVENTS}.
 * @returns The create input for the audit log persister.
 */
export function buildPersistedAuditRecord(
    entry: AuditEntry & { timestamp?: string },
    scrubbed: Record<string, unknown>,
    isCritical: boolean
): CreateAuditLogEntry {
    const raw = entry as unknown as Record<string, unknown>;
    return {
        logType: classifyAuditLogType(entry.auditEvent),
        eventType: entry.auditEvent,
        severity: isCritical ? 'critical' : 'info',
        actorId: readUuid(raw, 'actorId'),
        actorRole: readStr(raw, 'actorRole'),
        targetId: resolveTargetId(raw),
        ip: readStr(raw, 'ip'),
        method: readStr(raw, 'method'),
        path: readStr(raw, 'path') ?? readStr(raw, 'resource'),
        statusCode: readNum(raw, 'statusCode'),
        message: buildSummary(raw),
        data: scrubbed,
        loggedAt: new Date(entry.timestamp ?? new Date().toISOString())
    };
}

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

        // Persist the event to the queryable store so it is readable from the
        // admin audit/security log viewers (SPEC-162). Fire-and-forget: the
        // persister is responsible for swallowing its own async failures, and
        // building the record here is guarded by the surrounding try/catch so a
        // mapping error never breaks the logging call site.
        if (auditLogPersister) {
            auditLogPersister(buildPersistedAuditRecord(fullEntry, scrubbed, isCritical));
        }
    } catch (error) {
        // Last-resort fallback: use console.error so that a broken audit logger
        // never silently swallows the failure or propagates into the caller.
        console.error('[audit-logger] Failed to write audit log entry', {
            auditEvent: entry.auditEvent,
            error
        });
    }
}
