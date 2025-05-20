import { initializeDb } from '@repo/db';
import { Pool } from 'pg';

// Create your PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Initialize the database with the pool
export const initDb = () => {
    if (!pool) {
        throw new Error('Database pool is not initialized');
    }
    initializeDb(pool);
};
