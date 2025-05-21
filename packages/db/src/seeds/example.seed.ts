#!/usr/bin/env node
import 'dotenv/config';
import { Pool } from 'pg';
import { initializeDb } from '../client.js';
import { dbLogger } from '../utils/logger.js';
import { seedExampleData } from './example/index.js';

/**
 * Main entry point for seeding example data
 */
async function main() {
    dbLogger.info({ location: 'main' }, 'Starting example seed process');

    // Check if DATABASE_URL is defined
    if (!process.env.DATABASE_URL) {
        dbLogger.error(
            new Error('DATABASE_URL environment variable is not defined'),
            'Configuration error in main'
        );
        process.exit(1);
    }

    try {
        // Create a database pool for seeding
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        // Initialize the database connection
        initializeDb(pool);

        // Run the seed process
        await seedExampleData();

        // Close the database connection
        await pool.end();

        dbLogger.info({ location: 'main' }, 'Example seed process completed successfully');
    } catch (error) {
        dbLogger.error(error as Error, 'Example seed process failed in main');
        process.exit(1);
    }
}

// Run the seed process
main().catch((error) => {
    dbLogger.error(error as Error, 'Unhandled error in example seed process in main');
    process.exit(1);
});
