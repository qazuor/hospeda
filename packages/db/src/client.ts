import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';
/**
 * PostgreSQL connection pool using DATABASE_URL from environment.
 */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

/**
 * Shared Drizzle ORM client instance for executing queries.
 */

export const db = drizzle(pool, { schema });
