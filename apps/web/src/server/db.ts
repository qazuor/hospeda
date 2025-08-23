import { resolve } from 'node:path';
import { initializeDb } from '@repo/db';
import logger from '@repo/logger';
import dotenv from 'dotenv';
import type { PoolConfig } from 'pg';
import { Pool } from 'pg';

// Load environment variables from the root .env.local
dotenv.config({ path: resolve(process.cwd(), '../../.env.local') });

let initialized = false;

/**
 * Ensures the database client from @repo/db is initialized for server-side usage.
 * Safe to call multiple times; initialization runs only once per process.
 */
export const ensureDatabase = (): void => {
    if (initialized) return;

    // Use process.env after loading with dotenv
    const connectionString = process.env.DATABASE_URL;
    logger.debug(
        {
            hasConnectionString: !!connectionString,
            connectionStringLength: connectionString?.length || 0,
            cwd: process.cwd(),
            envPath: resolve(process.cwd(), '../../.env.local')
        },
        'Database initialization check'
    );

    if (!connectionString) {
        // In environments without DB (e.g., static preview), skip initialization gracefully
        logger.warn('DATABASE_URL not found, skipping database initialization');
        return;
    }

    const config: PoolConfig = { connectionString };
    const pool = new Pool(config);
    initializeDb(pool);
    initialized = true;
    logger.info('Database initialized successfully');
};
