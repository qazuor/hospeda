import { logger } from '@repo/logger';

/**
 * Utility helpers for database-level operations.
 * Placeholder for future common queries, helpers, or composition utilities.
 */
export function logQueryStart(operation: string) {
    logger.info(`[DB] Executing: ${operation}`);
}

/**
 * Converts a TypeScript string enum to a readonly string tuple
 * that Drizzle ORM expects in column enum definition.
 */
export function enumToTuple<T extends Record<string, string>>(e: T): [string, ...string[]] {
    const values = Object.values(e);
    if (values.length === 0) throw new Error('Enum must have at least one value');
    return values as [string, ...string[]];
}
