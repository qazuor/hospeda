import { initializeDb } from '@repo/db';
import { Pool } from 'pg';

/**
 * Database connection pool for seed operations
 */
let pool: Pool | null = null;

/**
 * Initializes the database connection for seed operations.
 * Must be called before any database operations.
 */
export const initSeedDb = () => {
    if (pool) {
        return; // Already initialized
    }

    // Create PostgreSQL connection pool
    pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    // Initialize the database with the pool
    initializeDb(pool);
};

/**
 * Closes the database connection pool.
 * Should be called when seed operations are complete.
 */
export const closeSeedDb = async () => {
    if (pool) {
        await pool.end();
        pool = null;
    }
};
