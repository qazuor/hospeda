import { initializeDb } from '@repo/db';
import type { PoolConfig } from 'pg';
import { Pool } from 'pg';

let initialized = false;

/**
 * Ensures the database client from @repo/db is initialized for server-side usage.
 * Safe to call multiple times; initialization runs only once per process.
 */
export const ensureDatabase = (): void => {
    if (initialized) return;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        // In environments without DB (e.g., static preview), skip initialization gracefully
        return;
    }

    const config: PoolConfig = { connectionString };
    const pool = new Pool(config);
    initializeDb(pool);
    initialized = true;
};
