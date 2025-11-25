import { resolve } from 'node:path';
import { config } from 'dotenv';
import { validateApiEnv } from '../../../src/utils/env.js';

/**
 * Load test environment variables
 * This must be called BEFORE any imports from src/
 */
export function setupTestEnv() {
    // Load .env.test from project root
    const envPath = resolve(__dirname, '../../../../../.env.test');
    const result = config({ path: envPath });

    if (result.error) {
        console.warn(`⚠️  Failed to load ${envPath}:`, result.error.message);
    }

    // Ensure NODE_ENV is test
    process.env.NODE_ENV = 'test';

    // Validate environment variables
    validateApiEnv();
}

// Auto-execute when imported
setupTestEnv();
