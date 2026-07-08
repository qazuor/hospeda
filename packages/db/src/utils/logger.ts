// Standardized logger helpers for DB layer
import { logger as baseLogger, type ILogger, LoggerColors } from '@repo/logger';

/**
 * Logger instance used by DB helpers.
 * Exported for testing so spies can hook into the exact instance used.
 */
const dbLogger = baseLogger.registerCategory('db', 'DB', {
    color: LoggerColors.MAGENTA,
    truncateLongText: true
});

/**
 * Reduce a raw query result to a compact, size-bounded summary.
 *
 * A successful DB query used to log its ENTIRE result payload (full rows with
 * nested relations), which flooded the logs and dominated logging cost. A log
 * line should identify the query — table, action, how many rows — not dump the
 * data. This collapses any result shape into a few scalar fields:
 *
 * - array of rows              → `{ rowCount }` (or `{ count }` for a lone count row)
 * - paginated `{ items, total }` → `{ itemCount, total }`
 * - single row with an `id`     → `{ id }`
 * - anything else               → `{ rows: 1 }`
 *
 * The concrete data is never included. Callers that need to inspect a payload
 * do so with a repro/query, not by scraping production logs.
 *
 * @param result - The raw query result
 * @returns A small summary object safe to log, or `null` when there is no result
 */
export const summarizeResult = (result: unknown): Record<string, unknown> | null => {
    if (result === null || result === undefined) {
        return null;
    }

    if (Array.isArray(result)) {
        // Aggregate queries (`count`) return a single `[{ count: n }]` row —
        // surface the value instead of a useless `rowCount: 1`.
        if (result.length === 1) {
            const only = result[0] as Record<string, unknown> | undefined;
            if (only && typeof only.count === 'number') {
                return { count: only.count };
            }
        }
        return { rowCount: result.length };
    }

    if (typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        if (Array.isArray(obj.items)) {
            return {
                itemCount: obj.items.length,
                ...(typeof obj.total === 'number' ? { total: obj.total } : {})
            };
        }
        if (obj.id !== undefined) {
            return { id: obj.id };
        }
        return { rows: 1 };
    }

    // Primitive result (e.g. a boolean from `exists`).
    return { value: result };
};

/**
 * Logs a successful database query with context, at DEBUG level.
 *
 * Emitted at DEBUG (not INFO) so the default production level (INFO) shows no
 * per-query line, while `API_LOG_LEVEL=debug` surfaces summarized query traces
 * in development. Only a {@link summarizeResult} summary is logged — never the
 * raw result payload.
 *
 * @param table - The table name
 * @param action - The action performed (e.g., 'findAll', 'create')
 * @param params - The query parameters
 * @param result - The query result (summarized, never logged in full)
 */
export const logQuery = (table: string, action: string, params: unknown, result: unknown) => {
    dbLogger.debug(
        { table, action, params, result: summarizeResult(result) },
        `${table}.${action} OK`
    );
};

/**
 * Logs a database action without result (e.g., before/after a mutation), at
 * DEBUG level so it does not add per-mutation noise to production (INFO) logs.
 *
 * @param table - The table name
 * @param action - The action performed
 * @param params - The action parameters
 */
export const logAction = (table: string, action: string, params: unknown) => {
    dbLogger.debug({ table, action, params }, `${table}.${action}`);
};

/**
 * Logs a database error with full context.
 * @param table - The table name
 * @param action - The action performed
 * @param params - The parameters used in the action
 * @param error - The error object
 */
export const logError = (table: string, action: string, params: unknown, error: Error) => {
    dbLogger.error(
        { table, action, params, error: error.message, stack: error.stack },
        `${table}.${action} ERROR`
    );
};

/**
 * Extends the base `ILogger` interface with a service-specific `permission` method.
 */
type DbLogger = ILogger;

const typedDbLogger = dbLogger as unknown as DbLogger;

export type { DbLogger };
export { typedDbLogger as dbLogger };
