// Standardized logger helpers for DB layer
import { type ILogger, LoggerColors, logger as baseLogger } from '@repo/logger';

/**
 * Logger instance used by DB helpers.
 * Exported for testing so spies can hook into the exact instance used.
 */
const dbLogger = baseLogger.registerCategory('db', 'DB', {
    color: LoggerColors.MAGENTA,
    truncateLongText: true
});

/**
 * Logs a successful database query with context.
 * @param table - The table name
 * @param action - The action performed (e.g., 'findAll', 'create')
 * @param params - The query parameters
 * @param result - The query result
 */
export const logQuery = (table: string, action: string, params: unknown, result: unknown) => {
    dbLogger.info({ table, action, params, result }, `${table}.${action} OK`);
};

/**
 * Logs a database action without result (e.g., before/after a mutation).
 * @param table - The table name
 * @param action - The action performed
 * @param params - The action parameters
 */
export const logAction = (table: string, action: string, params: unknown) => {
    dbLogger.info({ table, action, params }, `${table}.${action}`);
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

export { typedDbLogger as dbLogger };
export type { DbLogger };
