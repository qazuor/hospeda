import { ALL_PLANS } from '@repo/billing';
import { billingPlans, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Seed billing plans from configuration
 *
 * Populates the billing_plans table with all plan definitions including:
 * - Owner plans (Basico, Profesional, Premium)
 * - Complex plans (Complejo Basico, Profesional, Premium)
 * - Tourist plans (Gratis, Plus, VIP)
 *
 * This seed:
 * - Creates plan records with pricing and metadata
 * - Stores entitlements and limits in metadata (QZPay handles relations separately)
 * - Is idempotent (skips existing plans)
 * - Tracks seeding progress and errors
 *
 * Dependencies:
 * - billingEntitlements must be seeded first
 * - billingLimits must be seeded first
 *
 * Note: QZPay manages plan-entitlement and plan-limit relations through its
 * subscription system. We store the configuration in metadata for reference.
 *
 * @param context - Seed context (unused but kept for consistency)
 *
 * @example
 * ```typescript
 * await seedBillingPlans(context);
 * // Seeds 9 plans into billing_plans table
 * ```
 */
export async function seedBillingPlans(_context: SeedContext): Promise<void> {
    const entityName = 'Billing Plans';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName}`);
    logger.info(`${separator}`);

    try {
        const db = getDb();

        let seedCount = 0;
        let skipCount = 0;

        for (const plan of ALL_PLANS) {
            try {
                // Check if plan already exists by name
                const existing = await db
                    .select()
                    .from(billingPlans)
                    .where(eq(billingPlans.name, plan.name))
                    .limit(1);

                if (existing.length > 0) {
                    logger.info(
                        `${STATUS_ICONS.Skip}  Skipping "${plan.name}" (${plan.slug}) - already exists`
                    );
                    skipCount++;
                    continue;
                }

                // Build limits as key-value object for QZPay jsonb column
                const limitsObj: Record<string, number> = {};
                for (const l of plan.limits) {
                    limitsObj[l.key] = l.value;
                }

                // Create plan using QZPay-compatible schema
                // In development, livemode must be false to match QZPay's query filter
                const isProduction = process.env.NODE_ENV === 'production';
                await db.insert(billingPlans).values({
                    name: plan.name,
                    description: plan.description,
                    active: plan.isActive,
                    entitlements: plan.entitlements as string[],
                    limits: limitsObj,
                    livemode: isProduction,
                    metadata: {
                        slug: plan.slug,
                        category: plan.category,
                        isDefault: plan.isDefault,
                        sortOrder: plan.sortOrder,
                        trialDays: plan.trialDays,
                        hasTrial: plan.hasTrial,
                        monthlyPriceArs: plan.monthlyPriceArs,
                        annualPriceArs: plan.annualPriceArs,
                        monthlyPriceUsdRef: plan.monthlyPriceUsdRef
                    }
                });

                logger.success({
                    msg: `${STATUS_ICONS.Success}  Created plan: "${plan.name}" (${plan.slug}) - ${plan.entitlements.length} entitlements, ${plan.limits.length} limits`
                });
                seedCount++;
                summaryTracker.trackSuccess(entityName);
            } catch (error) {
                logger.error(
                    `${STATUS_ICONS.Error}  Failed to create plan "${plan.name}": ${error instanceof Error ? error.message : String(error)}`
                );
                summaryTracker.trackError(
                    entityName,
                    plan.name,
                    error instanceof Error ? error.message : String(error)
                );
            }
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Summary: ${seedCount} created, ${skipCount} skipped, ${ALL_PLANS.length} total`
        );
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
