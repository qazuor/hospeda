import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as schema from './schemas/index.js';

/**
 * Database client instance for runtime connection
 */
let runtimeClient: NodePgDatabase<typeof schema> | null = null;

/**
 * Static database client for type inference and autocompletion in VS Code
 * This client is never actually used for database operations
 */
const staticClient = drizzle(null as unknown as Pool, { schema });

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
 * Returns the database client.
 * During development in VS Code, returns a static client for type inference.
 * In runtime, returns the initialized client or throws if not initialized.
 *
 * @returns The database client instance
 * @throws Error if database is not initialized in runtime
 */
export function getDb(): NodePgDatabase<typeof schema> {
    // If we're in VSCode or running tests and the client hasn't been initialized,
    // return the static client for type inference
    if (
        !runtimeClient &&
        (process.env.VSCODE_PID || process.env.VITEST || process.env.NODE_ENV === 'test')
    ) {
        return staticClient;
    }

    // In runtime, require initialization
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
 *   const user = await userModel.create(tx, userData);
 *   await profileModel.create(tx, { userId: user.id, ...profileData });
 *   return user;
 * });
 * ```
 */
export async function withTransaction<T>(
    callback: (tx: NodePgDatabase<typeof schema>) => Promise<T>
): Promise<T> {
    const db = getDb();
    return await db.transaction(callback);
}

// Export schema for reference
export { schema };
