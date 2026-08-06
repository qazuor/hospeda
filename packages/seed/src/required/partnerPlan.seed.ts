import { ALL_PARTNER_PLANS, type PlanDefinition } from '@repo/billing';
import { and, billingPlans, billingPrices, type DrizzleClient, eq, getDb } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Ensures one partner-domain plan exists, with its monthly price and — when the
 * plan declares one — its annual price (HOS-278 D4).
 *
 * Idempotent at every step: an existing plan is reused rather than updated (a
 * price change goes through the admin, not the seed), and each price row is
 * looked up by its full `(plan, currency, interval, intervalCount)` tuple
 * before insert.
 *
 * Only `month` and `year` are written. Quarterly and semiannual would need
 * `intervalCount` 3 and 6, which the shared `ensurePrice` helper and the
 * `findMonthlyPrice`/`findAnnualPrice` lookups cannot express yet — see
 * `PARTNER_SILVER_PLAN`'s JSDoc.
 *
 * @param input - `{ plan, db, isProduction }` (RO-RO).
 * @returns What happened, for the seed log.
 */
async function ensurePartnerPlan({
    plan,
    db,
    isProduction
}: {
    readonly plan: PlanDefinition;
    readonly db: DrizzleClient;
    readonly isProduction: boolean;
}): Promise<{ readonly planStatus: string; readonly priceStatus: string }> {
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
                // HOS-39 T-005 / HOS-73: displayName/monthlyPriceArs/annualPriceArs
                // are typed top-level columns as of qzpay-drizzle 1.11.0 (still
                // duplicated in metadata below).
                displayName: plan.name,
                monthlyPriceArs: plan.monthlyPriceArs,
                annualPriceArs: plan.annualPriceArs,
                productDomain: ProductDomainEnum.PARTNER,
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

    // Re-stamp product_domain='partner' (idempotent no-op if already set).
    await db
        .update(billingPlans)
        .set({ productDomain: ProductDomainEnum.PARTNER })
        .where(eq(billingPlans.id, planId));

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

    let annualStatus = 'n/a';
    if (plan.annualPriceArs !== null) {
        const existingAnnual = await db
            .select({ id: billingPrices.id })
            .from(billingPrices)
            .where(
                and(
                    eq(billingPrices.planId, planId),
                    eq(billingPrices.currency, 'ARS'),
                    eq(billingPrices.billingInterval, 'year'),
                    eq(billingPrices.intervalCount, 1)
                )
            )
            .limit(1);

        if (existingAnnual.length > 0) {
            annualStatus = 'skipped';
        } else {
            await db.insert(billingPrices).values({
                planId,
                currency: 'ARS',
                unitAmount: plan.annualPriceArs,
                billingInterval: 'year',
                intervalCount: 1,
                active: true,
                livemode: isProduction
            });
            annualStatus = 'created';
        }
    }

    return { planStatus, priceStatus: `monthly ${priceStatus}, annual ${annualStatus}` };
}

/**
 * Partner plan seed (SPEC-271, extended to the two commercial tiers by
 * HOS-278 D4).
 */
export async function seedPartnerPlan(_context: SeedContext): Promise<void> {
    const entityName = 'Partner Plan';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName} (SPEC-271, HOS-278 D4)`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const db: DrizzleClient = getDb();

        for (const plan of ALL_PARTNER_PLANS) {
            const { planStatus, priceStatus } = await ensurePartnerPlan({
                plan,
                db,
                isProduction
            });
            logger.info(
                `${STATUS_ICONS.Info}  ${plan.slug}: plan ${planStatus}; prices: ${priceStatus}`
            );
        }

        logger.info(`${separator}`);
        summaryTracker.trackSuccess(entityName);
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        summaryTracker.trackError(
            'Partner Plan',
            'partner plans',
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
}
