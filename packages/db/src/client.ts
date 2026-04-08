import { qzpaySchema } from '@qazuor/qzpay-drizzle';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as hospedaSchema from './schemas/index.ts';
import type { DrizzleClient } from './types.ts';

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
let runtimeClient: NodePgDatabase<typeof schema> | null = null;

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
export function initializeDb(pool: Pool): NodePgDatabase<typeof schema> {
    if (runtimeClient) {
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
export function setDb(client: NodePgDatabase<typeof schema>): void {
    runtimeClient = client;
}

/**
 * Returns the active database client.
 * Requires a prior call to initializeDb() (production) or setDb() (tests).
 *
 * @returns The database client instance
 * @throws {Error} If the database has not been initialized
 */
export function getDb(): NodePgDatabase<typeof schema> {
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
 * @param callback - Function to execute within the transaction
 * @returns Result of the callback function
 * @throws Error if database is not initialized or if transaction fails
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   const user = await userModel.create(userData, tx);
 *   await profileModel.create({ userId: user.id, ...profileData }, tx);
 *   return user;
 * });
 * ```
 */
export async function withTransaction<T>(callback: (tx: DrizzleClient) => Promise<T>): Promise<T> {
    const db = getDb();
    return await db.transaction(callback);
}

// Export schema for reference
export { schema };
