import { LIMIT_METADATA, LimitKey } from '@repo/billing';
import { billingLimits, getDb } from '@repo/db';
import { eq } from 'drizzle-orm';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Seed billing limits from configuration
 *
 * Populates the billing_limits table with all limit type definitions.
 * Limits define numeric constraints (e.g., max accommodations) that
 * can vary by plan.
 *
 * This seed:
 * - Inserts limits directly using Drizzle ORM
 * - Is idempotent (skips existing limits)
 * - Tracks seeding progress and errors
 *
 * Note: This seeds the limit metadata only. Actual limit values
 * are set per-plan in the billingPlans seed.
 *
 * @param context - Seed context (unused but kept for consistency)
 *
 * @example
 * ```typescript
 * await seedBillingLimits(context);
 * // Seeds 6 limit types into billing_limits table
 * ```
 */
export async function seedBillingLimits(_context: SeedContext): Promise<void> {
    const entityName = 'Billing Limits';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName}`);
    logger.info(`${separator}`);

    try {
        const db = getDb();

        let seedCount = 0;
        let skipCount = 0;

        // Get all limit keys from enum
        const limitKeys = Object.values(LimitKey);

        for (const key of limitKeys) {
            try {
                // Check if limit already exists
                const existing = await db
                    .select()
                    .from(billingLimits)
                    .where(eq(billingLimits.key, key))
                    .limit(1);

                const meta = LIMIT_METADATA[key];

                if (existing.length > 0) {
                    logger.info(`${STATUS_ICONS.Skip}  Skipping "${meta.name}" - already exists`);
                    skipCount++;
                    continue;
                }

                // Create limit definition
                await db.insert(billingLimits).values({
                    key,
                    name: meta.name,
                    description: meta.description,
                    defaultValue: 0 // Default value, will be overridden by plans
                });

                logger.success(`${STATUS_ICONS.Success}  Created limit: "${meta.name}" (${key})`);
                seedCount++;
                summaryTracker.trackSuccess(entityName);
            } catch (error) {
                const meta = LIMIT_METADATA[key];
                logger.error(
                    `${STATUS_ICONS.Error}  Failed to create limit "${meta.name}": ${error instanceof Error ? error.message : String(error)}`
                );
                summaryTracker.trackFailure(entityName);
            }
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Summary: ${seedCount} created, ${skipCount} skipped, ${limitKeys.length} total`
        );
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
