import { ENTITLEMENT_DEFINITIONS } from '@repo/billing';
import { billingEntitlements, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Seed billing entitlements from configuration
 *
 * Populates the billing_entitlements table with all entitlement definitions
 * from the billing package configuration. Entitlements define feature flags
 * that can be granted via plans or add-ons.
 *
 * This seed:
 * - Inserts entitlements directly using Drizzle ORM
 * - Is idempotent (skips existing entitlements)
 * - Tracks seeding progress and errors
 *
 * @param context - Seed context (unused but kept for consistency)
 *
 * @example
 * ```typescript
 * await seedBillingEntitlements(context);
 * // Seeds 31 entitlements into billing_entitlements table
 * ```
 */
export async function seedBillingEntitlements(_context: SeedContext): Promise<void> {
    const entityName = 'Billing Entitlements';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName}`);
    logger.info(`${separator}`);

    try {
        const db = getDb();

        let seedCount = 0;
        let skipCount = 0;

        for (const entitlement of ENTITLEMENT_DEFINITIONS) {
            try {
                // Check if entitlement already exists
                const existing = await db
                    .select()
                    .from(billingEntitlements)
                    .where(eq(billingEntitlements.key, entitlement.key))
                    .limit(1);

                if (existing.length > 0) {
                    logger.info(
                        `${STATUS_ICONS.Skip}  Skipping "${entitlement.name}" - already exists`
                    );
                    skipCount++;
                    continue;
                }

                // Create entitlement
                await db.insert(billingEntitlements).values({
                    key: entitlement.key,
                    name: entitlement.name,
                    description: entitlement.description
                });

                logger.success({
                    msg: `${STATUS_ICONS.Success}  Created entitlement: "${entitlement.name}" (${entitlement.key})`
                });
                seedCount++;
                summaryTracker.trackSuccess(entityName);
            } catch (error) {
                logger.error(
                    `${STATUS_ICONS.Error}  Failed to create entitlement "${entitlement.name}": ${error instanceof Error ? error.message : String(error)}`
                );
                summaryTracker.trackError(
                    entityName,
                    entitlement.key,
                    error instanceof Error ? error.message : String(error)
                );
            }
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Summary: ${seedCount} created, ${skipCount} skipped, ${ENTITLEMENT_DEFINITIONS.length} total`
        );
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
