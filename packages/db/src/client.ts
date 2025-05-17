import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';
/**
 * PostgreSQL connection pool using DATABASE_URL from environment.
 */
const pool = new Pool({
    connectionString:
        'postgresql://Hospeda_owner:npg_La2CYHS3MRXQ@ep-dry-bird-ac8a18ef-pooler.sa-east-1.aws.neon.tech/Hospeda?sslmode=require'
});

/**
 * Shared Drizzle ORM client instance for executing queries.
 */

export const db = drizzle(pool, { schema });
