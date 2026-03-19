import path from 'node:path';
import { config as envConfig } from 'dotenv';
import type { Config } from 'drizzle-kit';

/**
 * Drizzle ORM configuration for migration generation and schema definition.
 */

// Per-app env strategy (SPEC-035): packages/db has no env of its own.
// Database connection string lives in the API app's env file.
envConfig({
    path: path.resolve(__dirname, '../../apps/api/.env.local')
});

export default {
    schema: ['./src/schemas', './src/billing/schemas.ts'],
    out: './src/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.HOSPEDA_DATABASE_URL || ''
    }
} satisfies Config;
