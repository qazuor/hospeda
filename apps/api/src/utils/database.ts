/**
 * Database initialization utilities
 * Handles the setup of database connection for the API
 */
import { initializeDb } from '@repo/db';
import { Pool } from 'pg';
import { env, getDatabasePoolConfig } from './env';
import { apiLogger } from './logger';

/**
 * Database connection pool for API operations
 */
let pool: Pool | null = null;
let dbInitialized = false;

/**
 * Initializes the database connection pool and sets up Drizzle ORM
 * Should be called before starting the server
 */
export const initializeDatabase = async (): Promise<void> => {
    if (dbInitialized) {
        apiLogger.info('Database already initialized, skipping...');
        return;
    }

    try {
        // Check if DATABASE_URL is provided
        if (!env.DATABASE_URL) {
            apiLogger.warn('DATABASE_URL not provided. Database operations will not be available.');
            apiLogger.warn('Services will use mock data or throw initialization errors.');
            return;
        }

        apiLogger.info('Initializing database connection...');

        // Get database pool configuration from environment variables
        const poolConfig = getDatabasePoolConfig();

        apiLogger.info(
            'Database pool configuration:',
            JSON.stringify({
                maxConnections: poolConfig.max,
                idleTimeoutMs: poolConfig.idleTimeoutMillis,
                connectionTimeoutMs: poolConfig.connectionTimeoutMillis
            })
        );

        // Create PostgreSQL connection pool with configurable settings
        pool = new Pool({
            connectionString: env.DATABASE_URL,
            ...poolConfig
        });

        // Test the connection
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();

        // Initialize Drizzle ORM with the pool using @repo/db pattern
        initializeDb(pool);

        dbInitialized = true;
        apiLogger.info('✅ Database initialized successfully');

        // Handle pool errors
        pool.on('error', (err) => {
            apiLogger.error('Database pool error:', err.message);
        });
    } catch (error) {
        apiLogger.error(
            '❌ Failed to initialize database:',
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
};

/**
 * Closes the database connection pool.
 * Should be called during graceful shutdown.
 */
export const closeDatabase = async (): Promise<void> => {
    if (pool) {
        apiLogger.info('Closing database connection...');
        await pool.end();
        pool = null;
        dbInitialized = false;
        apiLogger.info('✅ Database connection closed');
    }
};

/**
 * Checks if the database has been initialized
 */
export const isDatabaseInitialized = (): boolean => {
    return dbInitialized;
};
