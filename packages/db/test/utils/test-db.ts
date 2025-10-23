import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../src/schemas/index.js';

/**
 * Creates a test database connection for unit tests
 * Uses the HOSPEDA_DATABASE_URL environment variable
 */
export const createTestDb = () => {
    const connectionString = process.env.HOSPEDA_DATABASE_URL;
    if (!connectionString) {
        throw new Error(
            'HOSPEDA_DATABASE_URL is not set. Please set this environment variable in .env.local for database tests.'
        );
    }

    const pool = new Pool({ connectionString });
    return drizzle(pool, { schema });
};
