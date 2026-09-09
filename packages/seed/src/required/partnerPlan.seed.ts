import { ALL_PARTNER_PLANS, type PlanDefinition } from '@repo/billing';
import { and, billingPrices, type DrizzleClient, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { ensurePlan } from './billingPlans.seed.js';

/**
 * Ensures the `billing_prices` row(s) for one partner-domain plan: monthly
 * always, annual when the plan declares one (HOS-278 D4).
 *
 * Idempotent: each price row is looked up by its full
 * `(plan, currency, interval, intervalCount)` tuple before insert, and a
 * price change goes through the admin, not the seed.
 *
 * Only `month` and `year` are written. Quarterly and semiannual would need
 * `intervalCount` 3 and 6, which this pipeline cannot express yet — see
 * `PARTNER_SILVER_PLAN`'s JSDoc.
 *
 * @param input - `{ db, planId, plan, isProduction }` (RO-RO).
 * @returns A human-readable summary of what happened, for the seed log.
 */
async function ensurePartnerPriceRows(input: {
    readonly db: DrizzleClient;
    readonly planId: string;
    readonly plan: PlanDefinition;
    readonly isProduction: boolean;
}): Promise<string> {
    const { db, planId, plan, isProduction } = input;

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

    return `monthly ${priceStatus}, annual ${annualStatus}`;
}

/**
 * Partner plan seed (SPEC-271, extended to the two commercial tiers by
 * HOS-278 D4).
 *
 * **HOS-1290 — now shares the Model C sync engine with `ALL_PLANS`.** Before
 * this change, an existing row was only ever re-stamped for `product_domain`;
 * a config edit that added a `LimitKey` or an entitlement to a partner plan
 * silently never reached an already-seeded staging/production row (partner
 * plans currently declare none, but a future tier easily could). This seed
 * now calls the exact same `ensurePlan` the accommodation/tourist loop uses,
 * so capability-layer drift syncs from config on every partner plan too,
 * while commercial-layer fields keep preserving the DB / operator edit —
 * same split accommodation plans already get.
 *
 * Deliberately excluded from `ALL_PLANS` (same isolation precedent as the
 * commerce verticals) so accommodation pricing surfaces never expose it.
 *
 * @param _context - Seed context (unused; kept for the runner contract).
 * @param deps - Injectable dependencies. Defaults to the real `getDb()`
 *   client; tests inject a stub instead — see `commercePlan.seed.ts`'s
 *   sibling JSDoc note for why `vi.mock('@repo/db', ...)` alone does not
 *   reach a `getDb()` call made from inside a `src/` module here.
 */
export async function seedPartnerPlan(
    _context: SeedContext,
    deps: { db?: DrizzleClient } = {}
): Promise<void> {
    const entityName = 'Partner Plan';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName} (SPEC-271, HOS-278 D4)`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const db: DrizzleClient = deps.db ?? getDb();

        let created = 0;
        let skipped = 0;
        let synced = 0;

        for (const plan of ALL_PARTNER_PLANS) {
            const planResult = await ensurePlan(plan, isProduction, db);
            const priceStatus = await ensurePartnerPriceRows({
                db,
                planId: planResult.planId,
                plan,
                isProduction
            });

            if (planResult.status === 'created') {
                created++;
            } else if (planResult.status === 'synced') {
                synced++;
            } else {
                skipped++;
            }

            logger.info(
                `${STATUS_ICONS.Info}  ${plan.slug}: plan ${planResult.status}; prices: ${priceStatus}`
            );
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Partner plans: ${created} created, ${skipped} skipped, ${synced} synced (Model C).`
        );
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
