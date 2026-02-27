import { ALL_ADDONS } from '@repo/billing';
import { billingAddons, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Seed billing add-ons from configuration
 *
 * Populates the billing_addons table with all add-on definitions including:
 * - One-time add-ons (Visibility boost 7d, 30d)
 * - Recurring add-ons (Extra photos, accommodations, properties)
 *
 * This seed:
 * - Creates add-on records with pricing and metadata
 * - Stores entitlement/limit configurations in metadata
 * - Is idempotent (skips existing add-ons)
 * - Tracks seeding progress and errors
 *
 * Dependencies:
 * - billingEntitlements must be seeded first (if add-on grants entitlement)
 * - billingLimits must be seeded first (if add-on affects limit)
 *
 * @param context - Seed context (unused but kept for consistency)
 *
 * @example
 * ```typescript
 * await seedBillingAddons(context);
 * // Seeds 5 add-ons into billing_addons table
 * ```
 */
export async function seedBillingAddons(_context: SeedContext): Promise<void> {
    const entityName = 'Billing Add-ons';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName}`);
    logger.info(`${separator}`);

    try {
        const db = getDb();

        let seedCount = 0;
        let skipCount = 0;

        for (const addon of ALL_ADDONS) {
            try {
                // Check if add-on already exists by name
                const existing = await db
                    .select()
                    .from(billingAddons)
                    .where(eq(billingAddons.name, addon.name))
                    .limit(1);

                if (existing.length > 0) {
                    logger.info(
                        `${STATUS_ICONS.Skip}  Skipping "${addon.name}" (${addon.slug}) - already exists`
                    );
                    skipCount++;
                    continue;
                }

                // Build entitlements array from granted entitlement
                const entitlements: string[] = addon.grantsEntitlement
                    ? [addon.grantsEntitlement]
                    : [];

                // Build limits object from affected limit key
                const limits: Record<string, number> =
                    addon.affectsLimitKey && addon.limitIncrease
                        ? { [addon.affectsLimitKey]: addon.limitIncrease }
                        : {};

                // Create add-on using QZPay-compatible schema
                // In development, livemode must be false to match QZPay's query filter
                const isProduction = process.env.NODE_ENV === 'production';
                await db.insert(billingAddons).values({
                    name: addon.name,
                    description: addon.description,
                    active: addon.isActive,
                    unitAmount: addon.priceArs,
                    currency: 'ARS',
                    billingInterval: addon.billingType === 'one_time' ? 'one_time' : 'month',
                    billingIntervalCount: 1,
                    entitlements,
                    limits,
                    livemode: isProduction,
                    metadata: {
                        slug: addon.slug,
                        durationDays: addon.durationDays,
                        targetCategories: addon.targetCategories,
                        sortOrder: addon.sortOrder
                    }
                });

                const typeLabel = addon.billingType === 'one_time' ? 'one-time' : 'recurring';
                const priceLabel = `ARS ${(addon.priceArs / 100).toLocaleString('es-AR')}`;

                logger.success({
                    msg: `${STATUS_ICONS.Success}  Created add-on: "${addon.name}" (${addon.slug}) - ${typeLabel}, ${priceLabel}`
                });
                seedCount++;
                summaryTracker.trackSuccess(entityName);
            } catch (error) {
                logger.error(
                    `${STATUS_ICONS.Error}  Failed to create add-on "${addon.name}": ${error instanceof Error ? error.message : String(error)}`
                );
                summaryTracker.trackError(
                    entityName,
                    addon.name,
                    error instanceof Error ? error.message : String(error)
                );
            }
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Summary: ${seedCount} created, ${skipCount} skipped, ${ALL_ADDONS.length} total`
        );
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
