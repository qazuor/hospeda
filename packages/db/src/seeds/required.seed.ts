#!/usr/bin/env node
import { logger } from '@repo/logger';
import 'dotenv/config';
import { Pool } from 'pg';
import { initializeDb } from '../client.js';
import { seedRequiredData } from './required/index.js';

/**
 * Main entry point for seeding required data
 */
async function main() {
    logger.info('Starting required seed process', 'main');

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
        await seedRequiredData();

        // Close the database connection
        await pool.end();

        logger.info('Required seed process completed successfully', 'main');
    } catch (error) {
        logger.error('Required seed process failed', 'main', error);
        process.exit(1);
    }
}

// Run the seed process
main().catch((error) => {
    logger.error('Unhandled error in required seed process', 'main', error);
    process.exit(1);
});
