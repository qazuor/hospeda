#!/usr/bin/env node
import { logger } from '@repo/logger';
import 'dotenv/config';
import { Pool } from 'pg';
import { initializeDb } from '../client.js';
import { seedExampleData } from './example/index.js';

/**
 * Main entry point for seeding example data
 */
async function main() {
    logger.info('Starting example seed process', 'main');

    // Check if DATABASE_URL is defined
    if (!process.env.DATABASE_URL) {
        logger.error('DATABASE_URL environment variable is not defined', 'main');
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

        logger.info('Example seed process completed successfully', 'main');
    } catch (error) {
        logger.error('Example seed process failed', 'main', error);
        process.exit(1);
    }
}

// Run the seed process
main().catch((error) => {
    logger.error('Unhandled error in example seed process', 'main', error);
    process.exit(1);
});
