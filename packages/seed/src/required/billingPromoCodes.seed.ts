import { DEFAULT_PROMO_CODES } from '@repo/billing';
import { billingPromoCodes, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Seed billing promo codes from configuration
 *
 * Populates the billing_promo_codes table with default promo code definitions:
 * - HOSPEDA_FREE: 100% discount, permanent, unlimited (internal use)
 * - LANZAMIENTO50: 50% discount, 3 months, max 100 redemptions (new users)
 * - BIENVENIDO30: 30% discount, 1 month, max 500 redemptions (new users)
 *
 * This seed:
 * - Creates promo code records with discount and restriction metadata
 * - Is idempotent (skips existing codes by code string)
 * - Tracks seeding progress and errors
 *
 * @param context - Seed context (unused but kept for consistency)
 *
 * @example
 * ```typescript
 * await seedBillingPromoCodes(context);
 * // Seeds 3 promo codes into billing_promo_codes table
 * ```
 */
export async function seedBillingPromoCodes(_context: SeedContext): Promise<void> {
    const entityName = 'Billing Promo Codes';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName}`);
    logger.info(`${separator}`);

    try {
        const db = getDb();

        let seedCount = 0;
        let skipCount = 0;

        for (const promoDef of DEFAULT_PROMO_CODES) {
            try {
                // Check if promo code already exists
                const existing = await db
                    .select()
                    .from(billingPromoCodes)
                    .where(eq(billingPromoCodes.code, promoDef.code))
                    .limit(1);

                if (existing.length > 0) {
                    logger.info(
                        `${STATUS_ICONS.Skip}  Skipping "${promoDef.code}" - already exists`
                    );
                    skipCount++;
                    continue;
                }

                // Build config metadata
                const config: Record<string, unknown> = {
                    description: promoDef.description,
                    isPermanent: promoDef.isPermanent,
                    durationCycles: promoDef.durationCycles
                };

                // Insert promo code
                await db.insert(billingPromoCodes).values({
                    code: promoDef.code,
                    type: 'percentage',
                    value: promoDef.discountPercent,
                    active: promoDef.isActive,
                    maxUses: promoDef.maxRedemptions,
                    usedCount: 0,
                    expiresAt: promoDef.expiresAt,
                    validPlans: promoDef.restrictedToPlans,
                    newCustomersOnly: promoDef.newUserOnly,
                    config,
                    livemode: false
                });

                logger.info(
                    `${STATUS_ICONS.Success}  Seeded "${promoDef.code}" (${promoDef.discountPercent}% discount)`
                );
                seedCount++;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error(
                    `${STATUS_ICONS.Error}  Failed to seed "${promoDef.code}": ${message}`
                );
                summaryTracker.trackError(entityName, promoDef.code, message);
            }
        }

        logger.info('');
        logger.info(
            `${STATUS_ICONS.Info}  ${entityName} summary: ${seedCount} seeded, ${skipCount} skipped`
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${STATUS_ICONS.Error}  Failed to seed ${entityName}: ${message}`);
        summaryTracker.trackError(entityName, 'billingPromoCodes', message);
        throw error;
    }
}
