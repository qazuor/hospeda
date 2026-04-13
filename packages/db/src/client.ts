import { qzpaySchema } from '@qazuor/qzpay-drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as hospedaSchema from './schemas/index.ts';
import type { DrizzleClient } from './types.ts';
import { DbError, TransactionRollbackError } from './utils/error.ts';
import { dbLogger } from './utils/logger.ts';

/**
 * Combined schema including both Hospeda application schemas
 * and QZPay billing schemas for complete database access
 */
const schema = {
    ...hospedaSchema,
    ...qzpaySchema
};

/**
 * Database client instance. Set via initializeDb() at app startup
 * or via setDb() for test injection.
 */
let runtimeClient: DrizzleClient | null = null;

/**
 * Initializes the database connection with the provided connection pool.
 * This function must be called by the consuming application before using any database operations.
 *
 * @param pool - PostgreSQL connection pool provided by the consuming application
 * @returns Drizzle ORM client instance
 *
 * @example
 * ```typescript
 * import { Pool } from 'pg';
 * import { initializeDb } from '@repo/db';
 *
 * const pool = new Pool({
 *   connectionString: process.env.HOSPEDA_DATABASE_URL
 * });
 *
 * initializeDb(pool);
 * ```
 */
export function initializeDb(pool: Pool): DrizzleClient {
    if (runtimeClient) {
        dbLogger.warn(
            'initializeDb() called but database is already initialized — returning existing client'
        );
        return runtimeClient;
    }

    runtimeClient = drizzle(pool, { schema });
    return runtimeClient;
}

/**
 * Injects a database client directly. Intended for use in tests only,
 * where a real test database or mock client needs to be provided without
 * going through initializeDb() and a connection pool.
 *
 * Calling this in production code is not recommended.
 *
 * @param client - A Drizzle ORM client instance to use as the active database
 *
 * @example
 * ```typescript
 * // In a test setup file:
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import { setDb } from '@repo/db';
 *
 * const testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
 * setDb(drizzle(testPool, { schema }));
 * ```
 */
export function setDb(client: DrizzleClient): void {
    runtimeClient = client;
}

/**
 * Returns the active database client.
 * Requires a prior call to initializeDb() (production) or setDb() (tests).
 *
 * @returns The database client instance
 * @throws {Error} If the database has not been initialized
 */
export function getDb(): DrizzleClient {
    if (!runtimeClient) {
        throw new Error(
            'Database not initialized. Call initializeDb() before using database operations.'
        );
    }

    return runtimeClient;
}

/**
 * Executes a callback function within a database transaction.
 * If the callback throws an error, the transaction is rolled back.
 * If the callback completes successfully, the transaction is committed.
 *
 * Supports nested transaction passthrough: if `existingTx` is provided, the callback
 * is called directly with that transaction client instead of opening a new one. This
 * allows callers to propagate an outer transaction into nested operations without
 * creating a savepoint or a new transaction boundary.
 *
 * Error handling preserves the original error type:
 * - `TransactionRollbackError` is re-thrown as-is (intentional rollback sentinel).
 * - `DbError` is re-thrown as-is (already wrapped with full context).
 * - Unknown errors are wrapped in a new `DbError`.
 *
 * @param callback - Function to execute within the transaction
 * @param existingTx - Optional existing transaction client. When provided, the callback
 *   is invoked with this client directly and no new transaction is started.
 * @returns Result of the callback function
 * @throws {TransactionRollbackError} Re-thrown as-is when the callback throws one
 * @throws {DbError} Re-thrown as-is or wrapping an unknown error
 * @throws {Error} If the database has not been initialized
 *
 * @example
 * ```typescript
 * // New transaction
 * const result = await withTransaction(async (tx) => {
 *   const user = await userModel.create(userData, tx);
 *   await profileModel.create({ userId: user.id, ...profileData }, tx);
 *   return user;
 * });
 *
 * // Nested — reuse an outer transaction
 * await withTransaction(async (outerTx) => {
 *   await withTransaction(async (tx) => {
 *     await someModel.create(data, tx);
 *   }, outerTx);
 * });
 * ```
 */
export async function withTransaction<T>(
    callback: (tx: DrizzleClient) => Promise<T>,
    existingTx?: DrizzleClient
): Promise<T> {
    if (existingTx) {
        return callback(existingTx);
    }

    const db = getDb();
    try {
        return await db.transaction(callback);
    } catch (error) {
        if (error instanceof TransactionRollbackError || error instanceof DbError) {
            throw error;
        }
        const cause = error instanceof Error ? error : new Error(String(error));
        throw new DbError(
            'withTransaction',
            'client',
            undefined,
            `Transaction failed: ${cause.message}`,
            cause
        );
    }
}

// Export schema for reference
export { schema };
