import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedTestUsers } from './testUsers.seed.js';

/**
 * Executes the test-users seed group.
 *
 * This group is intentionally separate from `--required` (production-safe
 * system data) and `--example` (sample content). Test users are local-dev
 * fixtures for SPEC-143 Block 1 billing/entitlement testing and must NEVER
 * run against staging or production databases.
 *
 * Triggered exclusively by the `--test-users` CLI flag or the standalone
 * `pnpm db:seed:test-users` command. The required seed (specifically
 * `billingPlans.seed.ts`) must have been run previously so the per-user
 * subscription rows can resolve their plan id.
 *
 * @param context - Seed context with configuration and utilities
 * @returns Promise that resolves when test users seeding completes
 *
 * @throws {Error} When seeding fails and continueOnError is false
 */
export async function runTestUserSeeds(context: SeedContext): Promise<void> {
    logger.info(`${STATUS_ICONS.Seed} Initializing test users load (SPEC-143 Block 1)...\n`);

    try {
        await seedTestUsers(context);

        logger.success({ msg: `${STATUS_ICONS.Success} Test users load completed.` });
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error} Test users load interrupted`);
        logger.error(`   Error: ${(error as Error).message}`);

        if (!context.continueOnError) {
            throw error;
        }
    } finally {
        summaryTracker.print();
    }
}
