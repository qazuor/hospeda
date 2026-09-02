import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../types';
import { ServiceError } from '../types';
import { extractPostgresErrorCause, type PostgresErrorCause } from './postgres-error-cause';
import { serviceLogger as defaultLogger } from './service-logger';

let _logger = defaultLogger;

/**
 * Log level used when emitting a caught service error.
 */
export type ErrorLogLevel = 'error' | 'warn' | 'info';

/**
 * Maps a {@link ServiceErrorCode} to the log level its errors should be emitted at.
 *
 * EXPECTED client-side outcomes are not application faults and must not pollute
 * the error stream with `ERROR` + stack traces (HOS-109 / OQ-1):
 *
 * - `NOT_FOUND` (404) and `UNAUTHORIZED` (401) are routine guest/browsing
 *   outcomes → `info`.
 * - `GONE` (410) is a routine read of a soft-deleted entity (crawler/LLM
 *   deindex signal), not a fault → `info`.
 * - `FORBIDDEN` (403) is a permission denial that doubles as a probing signal,
 *   so it stays slightly louder → `warn`.
 * - `ENTITLEMENT_REQUIRED` (403) and `LIMIT_REACHED` (403) are routine
 *   plan-gating denials (a free/lower-tier plan hitting a `gate*`/`require*`
 *   middleware) — same class and severity as `FORBIDDEN` → `warn`.
 *
 * Every other code (INTERNAL_ERROR, DATABASE/PROVIDER failures, VALIDATION_ERROR,
 * etc.) keeps `error` — those are real faults worth a stack trace.
 *
 * @param code - The service error code, or `undefined` for non-`ServiceError` errors.
 * @returns The log level to emit at; defaults to `error`.
 */
export const resolveErrorLogLevel = (code: ServiceErrorCode | undefined): ErrorLogLevel => {
    switch (code) {
        case ServiceErrorCode.NOT_FOUND:
        case ServiceErrorCode.UNAUTHORIZED:
        case ServiceErrorCode.GONE:
            return 'info';
        case ServiceErrorCode.FORBIDDEN:
        case ServiceErrorCode.ENTITLEMENT_REQUIRED:
        case ServiceErrorCode.LIMIT_REACHED:
            return 'warn';
        default:
            return 'error';
    }
};

/**
 * Overrides the default logger instance with a custom one.
 * Useful for testing or integrating with a different logging system.
 * @param logger The new logger instance to use. It must conform to the `serviceLogger` interface.
 */
export const setLogger = (logger: typeof defaultLogger) => {
    _logger = logger;
};

/**
 * Builds a compact, log-safe projection of an actor.
 *
 * The full {@link Actor} carries its entire resolved `permissions` array, which
 * for staff actors (ADMIN / SUPER_ADMIN) holds hundreds of entries. Serializing
 * it on every service call floods the logs and, under high volume, interleaves
 * and corrupts the log stream. Only the identifying fields plus a permission
 * COUNT are emitted; the full permission set is never needed for log triage and
 * remains available through the permissions API when required.
 *
 * @param actor - The actor to project.
 * @returns A JSON string with `id`, `roles`, and `permissionsCount` only.
 */
const formatActor = (actor: Actor | null | undefined): string => {
    // These helpers run BEFORE the actor/permission check in every service
    // method, so they are reached with a missing actor on the unauthorized
    // path. The previous `JSON.stringify(actor)` tolerated null/undefined;
    // preserve that so logging never throws and masks the real 401/403.
    if (actor === null || actor === undefined) {
        return String(actor);
    }
    return JSON.stringify({
        id: actor.id,
        roles: actor.roles,
        permissionsCount: actor.permissions?.length ?? 0
    });
};

/**
 * Same projection as {@link formatActor}, but as a plain object instead of a
 * pre-stringified JSON string — used by {@link logError}, which now logs a
 * structured `data` payload (see its JSDoc) instead of one flat string, so
 * embedding an already-serialized string inside it would double-encode.
 * Tolerates a missing actor the same way `formatActor` does.
 */
const buildActorSummary = (actor: Actor | null | undefined): Record<string, unknown> | null => {
    if (actor === null || actor === undefined) {
        return null;
    }
    return {
        id: actor.id,
        roles: actor.roles,
        permissionsCount: actor.permissions?.length ?? 0
    };
};

/** Drizzle bakes the full statement onto `error.message` after this literal marker (`drizzle-orm/pg-core/session.ts`, `queryWithCache`). Anchor on it so only a genuinely SQL-dominated message gets trimmed — an ordinary short error message is left untouched. */
const DRIZZLE_FAILED_QUERY_MARKER = 'Failed query:';

/**
 * Builds the short, SQL-free summary used as the log's `message`/label
 * (HOS-858 AC-3).
 *
 * When `error.message` carries Drizzle's {@link DRIZZLE_FAILED_QUERY_MARKER},
 * the ~1900-character generated SQL + params dump that follows it is what
 * dominated the 37k unreadable ERROR entries from the 2026-08-01 incident
 * (see the HOS-858 report). The SQL can always be reconstructed from the
 * source; a short summary — plus the Postgres SQLSTATE when one was found —
 * cannot. The unmodified `error.message` (SQL included) is still preserved
 * verbatim under `data.errorMessage` by {@link logError} for anyone who needs
 * it; only the top-level message loses the dump.
 *
 * @param message - The raw `error.message`.
 * @param postgresCause - The result of {@link extractPostgresErrorCause}, if any.
 * @returns A short message with no generated SQL.
 */
const summarizeErrorMessage = (
    message: string,
    postgresCause: PostgresErrorCause | undefined
): string => {
    const markerIndex = message.indexOf(DRIZZLE_FAILED_QUERY_MARKER);
    if (markerIndex === -1) {
        return message;
    }
    const prefix = message
        .slice(0, markerIndex)
        .trim()
        .replace(/[:.]+$/, '');
    const causeSuffix = postgresCause ? ` (postgres ${postgresCause.code})` : '';
    return prefix.length > 0
        ? `${prefix}: query failed${causeSuffix}`
        : `Query failed${causeSuffix}`;
};

/**
 * Logs the start of a service method execution, including input and actor details.
 * @param methodName - The full name of the method being executed (e.g., 'accommodation.create').
 * @param input - The input data or parameters for the method.
 * @param actor - The actor (user or system) executing the method.
 */
export const logMethodStart = (methodName: string, input: unknown, actor: Actor): void => {
    // DEBUG, not INFO: this fires on every service call (265+ call sites) and
    // serializes the full input — far too noisy for the default prod log level
    // (I3). Visible only when the level is raised to debug.
    _logger.debug(
        `Starting ${methodName} | input: ${JSON.stringify(input)} | actor: ${formatActor(actor)}`
    );
};

/**
 * Logs the successful completion of a service method execution, including the output.
 * @param methodName - The full name of the method that completed.
 * @param output - The output data or result from the method.
 */
export const logMethodEnd = (methodName: string, output: unknown): void => {
    // DEBUG, not INFO — see logMethodStart (I3). Serializing the full output
    // (whole entities / result arrays) on every call dominated prod log volume.
    _logger.debug(`Completed ${methodName} | output: ${JSON.stringify(output)}`);
};

/**
 * Logs an error that occurred during a service method execution.
 *
 * HOS-858: previously built a single flat string dominated by whatever
 * `error.message` happened to be — for a wrapped Drizzle query failure, that
 * is `"Failed query: <~1900 chars of generated SQL> params: <...>"`, with the
 * real cause (the Postgres driver's SQLSTATE, constraint, table, column)
 * never read at all. Now:
 * - {@link extractPostgresErrorCause} walks the error's wrapping chain for a
 *   driver-reported SQLSTATE (see its JSDoc for the exact chain shape).
 * - When found, its fields are stored as their OWN keys on the structured
 *   `data` payload (`postgresErrorCode`, `postgresErrorConstraint`, ...) —
 *   never concatenated into `message` — so they are filterable/groupable in
 *   the log viewer instead of buried inside a 2000-char string.
 * - {@link summarizeErrorMessage} strips the generated SQL out of the
 *   top-level message when present; the unmodified `error.message` (SQL
 *   included) is preserved verbatim under `data.errorMessage` for anyone who
 *   still needs it.
 *
 * `detail` (which can carry a column's actual VALUE, e.g. `Key
 * (email)=(x@y.com) already exists.`) is deliberately never extracted — see
 * the "Scope decision" section in `./postgres-error-cause.ts`'s JSDoc.
 *
 * @param methodName - The name of the method where the error occurred.
 * @param error - The error object that was caught.
 * @param input - The input data that may have caused the error.
 * @param actor - The actor that was executing the method.
 */
export const logError = (methodName: string, error: Error, input: unknown, actor: Actor): void => {
    // EXPECTED outcomes (401/403/404) are not application faults: emit them at a
    // reduced level (info/warn) so they don't flood the error stream with stack
    // traces (HOS-109 / OQ-1). Real faults stay at `error`.
    const level = resolveErrorLogLevel(error instanceof ServiceError ? error.code : undefined);
    const postgresCause = extractPostgresErrorCause(error);

    const data: Record<string, unknown> = {
        input,
        actor: buildActorSummary(actor),
        errorMessage: error.message
    };
    if (postgresCause !== undefined) {
        data.postgresErrorCode = postgresCause.code;
        if (postgresCause.constraint !== undefined) {
            data.postgresErrorConstraint = postgresCause.constraint;
        }
        if (postgresCause.table !== undefined) {
            data.postgresErrorTable = postgresCause.table;
        }
        if (postgresCause.column !== undefined) {
            data.postgresErrorColumn = postgresCause.column;
        }
        if (postgresCause.schema !== undefined) {
            data.postgresErrorSchema = postgresCause.schema;
        }
    }

    _logger[level](
        data,
        `Error in ${methodName}: ${summarizeErrorMessage(error.message, postgresCause)}`
    );
};

/**
 * Logs a specific permission check event.
 * This is useful for auditing and debugging access control.
 * @param permission - The permission being checked (e.g., 'ACCOMMODATION_UPDATE_ANY').
 * @param actor - The actor whose permissions are being checked.
 * @param input - The input data related to the permission check.
 * @param error - Optional error message if the permission was denied.
 */
export const logPermission = (
    permission: string,
    actor: Actor,
    input: unknown,
    error?: string
): void => {
    _logger.permission({
        permission,
        userId: actor.id,
        roles: actor.roles,
        extraData: { input, error }
    });
};

/**
 * Logs an event where access was explicitly denied.
 * @param actor - The actor that was denied access.
 * @param input - The input data for the action that was denied.
 * @param entity - The entity being accessed.
 * @param reason - The reason why access was denied.
 * @param permission - The permission that was required but not met.
 */
export const logDenied = (
    actor: Actor,
    input: unknown,
    entity: unknown,
    reason: string,
    permission: string
): void => {
    _logger.warn(
        `Access denied: ${permission} | actor: ${formatActor(actor)} | input: ${JSON.stringify(input)} | entity: ${JSON.stringify(entity)} | reason: ${reason}`
    );
};

/**
 * Logs an event where access was explicitly granted.
 * @param actor - The actor that was granted access.
 * @param input - The input data for the action that was granted.
 * @param entity - The entity being accessed.
 * @param permission - The permission that was successfully met.
 * @param reason - The reason why access was granted.
 */
export const logGrant = (
    actor: Actor,
    input: unknown,
    entity: unknown,
    permission: string,
    reason: string
): void => {
    _logger.info(
        `Access granted: ${permission} | actor: ${formatActor(actor)} | input: ${JSON.stringify(input)} | entity: ${JSON.stringify(entity)} | reason: ${reason}`
    );
};
