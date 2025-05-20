import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as schema from './schema/index.js';

/**
 * Database client instance
 */
let dbClient: ReturnType<typeof drizzle> | null = null;

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
 *   connectionString: process.env.DATABASE_URL
 * });
 *
 * initializeDb(pool);
 * ```
 */
export function initializeDb(pool: Pool): ReturnType<typeof drizzle> {
    if (dbClient) {
        return dbClient;
    }

    dbClient = drizzle(pool, { schema });
    return dbClient;
}

/**
 * Returns the initialized database client.
 * Throws an error if the database has not been initialized.
 *
 * @returns The initialized Drizzle ORM client
 * @throws Error if the database has not been initialized
 */
export function getDb(): ReturnType<typeof drizzle> {
    if (!dbClient) {
        throw new Error(
            'Database not initialized. Call initializeDb() before using database operations.'
        );
    }
    return dbClient;
}

// Export schema for reference
export { schema };
