/**
 * Script to setup test database schema
 * This pushes the Drizzle schema to the test database
 */

import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
const envPath = resolve(__dirname, '../.env.test');
const result = config({ path: envPath });

if (result.error) {
    console.error('❌ Failed to load .env.test:', result.error.message);
    process.exit(1);
}

// Verify we have the test database URL
const dbUrl = process.env.HOSPEDA_DATABASE_URL || process.env.TEST_DB_URL;

if (!dbUrl) {
    console.error('❌ No database URL found in .env.test');
    console.error('Expected: HOSPEDA_DATABASE_URL or TEST_DB_URL');
    process.exit(1);
}

// Verify it's the test database (port 5433)
if (!dbUrl.includes('5433')) {
    console.error('❌ Database URL does not appear to be the test database');
    console.error('Expected port 5433, got:', dbUrl);
    process.exit(1);
}

console.info('📦 Setting up test database schema...');
console.info(`   Database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password

try {
    // Run drizzle-kit push with the test database URL
    execSync('pnpm --filter @repo/db db:push', {
        env: {
            ...process.env,
            HOSPEDA_DATABASE_URL: dbUrl
        },
        stdio: 'inherit',
        cwd: resolve(__dirname, '..')
    });

    console.info('✅ Test database schema setup complete');
} catch (_error) {
    console.error('❌ Failed to setup test database schema');
    process.exit(1);
}
