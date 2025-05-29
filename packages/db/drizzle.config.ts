import type { Config } from 'drizzle-kit';

/**
 * Drizzle ORM configuration for migration generation and schema definition.
 */

export default {
    schema: './src/dbschemas',
    out: './src/migrations',
    driver: 'pg',
    dbCredentials: {
        connectionString: process.env.DATABASE_URL || ''
    }
} satisfies Config;
