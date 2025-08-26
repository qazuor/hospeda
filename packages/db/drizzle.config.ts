import path from 'node:path';
import { config as envConfig } from 'dotenv';
import type { Config } from 'drizzle-kit';

/**
 * Drizzle ORM configuration for migration generation and schema definition.
 */

envConfig({
    path: path.resolve(__dirname, '../../.env.local')
});

export default {
    schema: './src/schemas',
    out: './src/migrations',
    driver: 'pg',
    dbCredentials: {
        connectionString: process.env.HOSPEDA_DATABASE_URL || ''
    }
} satisfies Config;
