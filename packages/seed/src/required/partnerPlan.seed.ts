import { PARTNER_LISTING_PLAN } from '@repo/billing';
import { type DrizzleClient, and, billingPlans, billingPrices, eq, getDb, sql } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Partner-listing plan seed (SPEC-271).
 */
export async function seedPartnerPlan(_context: SeedContext): Promise<void> {
    const entityName = 'Partner Plan';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName} (SPEC-271)`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const db: DrizzleClient = getDb();
        const plan = PARTNER_LISTING_PLAN;

        const existing = await db
            .select({ id: billingPlans.id })
            .from(billingPlans)
            .where(eq(billingPlans.name, plan.slug))
            .limit(1);

        let planId: string;
        let planStatus: 'created' | 'skipped';

        const existingRow = existing[0];
        if (existingRow) {
            planId = existingRow.id;
            planStatus = 'skipped';
        } else {
            const limitsObj: Record<string, number> = {};
            for (const l of plan.limits) {
                limitsObj[l.key] = l.value;
            }

            const inserted = await db
                .insert(billingPlans)
                .values({
                    name: plan.slug,
                    description: plan.description,
                    active: plan.isActive,
                    entitlements: plan.entitlements as string[],
                    limits: limitsObj,
                    livemode: isProduction,
                    metadata: {
                        slug: plan.slug,
                        displayName: plan.name,
                        category: plan.category,
                        isDefault: plan.isDefault,
                        sortOrder: plan.sortOrder,
                        trialDays: plan.trialDays,
                        hasTrial: plan.hasTrial,
                        monthlyPriceArs: plan.monthlyPriceArs,
                        annualPriceArs: plan.annualPriceArs,
                        monthlyPriceUsdRef: plan.monthlyPriceUsdRef
                    }
                })
                .returning({ id: billingPlans.id });

            const insertedRow = inserted[0];
            if (!insertedRow) {
                throw new Error(`Insert of partner plan "${plan.slug}" returned no row`);
            }
            planId = insertedRow.id;
            planStatus = 'created';
        }

        await db.execute(
            sql`UPDATE billing_plans SET product_domain = ${ProductDomainEnum.PARTNER} WHERE id = ${planId}`
        );

        const existingPrice = await db
            .select({ id: billingPrices.id })
            .from(billingPrices)
            .where(
                and(
                    eq(billingPrices.planId, planId),
                    eq(billingPrices.currency, 'ARS'),
                    eq(billingPrices.billingInterval, 'month'),
                    eq(billingPrices.intervalCount, 1)
                )
            )
            .limit(1);

        let priceStatus: 'created' | 'skipped';
        if (existingPrice.length > 0) {
            priceStatus = 'skipped';
        } else {
            await db.insert(billingPrices).values({
                planId,
                currency: 'ARS',
                unitAmount: plan.monthlyPriceArs,
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: isProduction
            });
            priceStatus = 'created';
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Partner plan: ${planStatus}; monthly price: ${priceStatus}. NOTE: monthlyPriceArs is a PLACEHOLDER — owner must confirm the real price via the admin UI.`
        );

        summaryTracker.trackSuccess(entityName);
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        summaryTracker.trackError(
            'Partner Plan',
            PARTNER_LISTING_PLAN.slug,
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
}
