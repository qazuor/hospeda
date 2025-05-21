import { initializeDb } from '@repo/db';
import { StateEnum, type UserType } from '@repo/types';
import { Pool } from 'pg';

/**
 * Initializes the database connection
 * @returns Database client pool
 */
export function initDb() {
    try {
        // Create a database pool
        const pool = new Pool({
            connectionString: import.meta.env.ASTRO_DATABASE_URL
        });

        // Initialize the database with the pool
        initializeDb(pool);

        return pool;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

/**
 * The public user actor for database operations
 * Used when we don't have an authenticated user
 */
export const publicUser: UserType = {
    id: 'public',
    roleId: 'USER',
    permissions: [],
    userName: '',
    passwordHash: '',
    state: StateEnum.ACTIVE,
    name: '',
    displayName: '',
    createdAt: new Date(),
    createdById: '',
    updatedAt: new Date(),
    updatedById: ''
};

// Initialize the database connection
initDb();
