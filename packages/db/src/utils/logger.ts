// Standardized logger helpers for DB layer
import { logger as baseLogger } from '@repo/logger';

/**
 * Logger instance used by DB helpers.
 * Exported for testing so spies can hook into the exact instance used.
 */
export const dbLogger = baseLogger;

/**
 * Logs a successful database query with context.
 * @param table - The table name
 * @param action - The action performed (e.g., 'findAll', 'create')
 * @param params - The query parameters
 * @param result - The query result
 */
export const logQuery = (table: string, action: string, params: unknown, result: unknown) => {
    dbLogger.info({ table, action, params, result }, `[DB] ${table}.${action} OK`);
};

/**
 * Logs a database action without result (e.g., before/after a mutation).
 * @param table - The table name
 * @param action - The action performed
 * @param params - The action parameters
 */
export const logAction = (table: string, action: string, params: unknown) => {
    dbLogger.info({ table, action, params }, `[DB] ${table}.${action}`);
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
        `[DB] ${table}.${action} ERROR`
    );
};
