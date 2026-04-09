/**
 * Integration test global setup.
 *
 * Loads environment variables from the API app's .env.local so that
 * HOSPEDA_DATABASE_URL is available to all integration test files.
 * This file is referenced via `setupFiles` in vitest.config.integration.ts.
 *
 * Prerequisites: `pnpm db:start` (Docker must be running with hospeda_test DB)
 */
import path from 'node:path';
import { config } from 'dotenv';

// Load env from the API app (packages/db has no env of its own — see CLAUDE.md)
config({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });
