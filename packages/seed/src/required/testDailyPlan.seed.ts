import { TEST_DAILY_PLAN, TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS } from '@repo/billing';
import { and, billingPlans, billingPrices, type DrizzleClient, eq, getDb } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Hidden daily test-plan seed (billing-interval-override tooling).
 *
 * Seeds the single {@link TEST_DAILY_PLAN} row into `billing_plans` (stamped
 * `product_domain = 'accommodation'` and `metadata.testPlan = true`) plus its
 * ONE `billing_prices` row (`billingInterval = 'day'`, `intervalCount = 1`,
 * `unitAmount = TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS`). No monthly/annual
 * price row is ever created for this plan — it is daily-only.
 *
 * Why a dedicated seed (NOT the `ALL_PLANS` loop in `billingPlans.seed.ts`):
 * mirrors the commerce/partner precedent — the accommodation seed loop, the
 * public plan list, and the grant-matrix snapshot tests all operate on
 * `ALL_PLANS` and must stay unaffected by this test-only plan.
 *
 * `product_domain = 'accommodation'` (UNLIKE commerce/partner, which use
 * their own domains) is REQUIRED so `loadEntitlements()` — which filters
 * `product_domain = 'accommodation'` — actually resolves a subscription on
 * this plan's entitlements/limits.
 *
 * Idempotent: matches the existing row by `name` (the slug). On a re-run it
 * skips the plan insert and only re-stamps `product_domain` + `metadata`
 * (both no-ops when already correct). The row always exists once seeded —
 * ONLY the `HOSPEDA_SHOW_TEST_BILLING_PLAN` env flag (checked in
 * `resolvePlanBySlug`, `apps/api/src/services/subscription-checkout.service.ts`)
 * gates whether a checkout can resolve it by slug, so flipping the flag back
 * on instantly makes the already-seeded plan subscribable again.
 *
 * @param _context - Seed context (unused; kept for the runner contract).
 */
export async function seedTestDailyPlan(_context: SeedContext): Promise<void> {
    const entityName = 'Test Daily Plan';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName} (billing-interval-override)`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const db: DrizzleClient = getDb();
        const plan = TEST_DAILY_PLAN;

        // ── Ensure the plan row (idempotent by slug) ─────────────────────────
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
                    displayName: plan.name,
                    // No monthly/annual price ROW is ever created for this plan (see
                    // JSDoc) — `plan.monthlyPriceArs` here only fills the typed
                    // display column, mirroring the commerce/partner seed pattern.
                    monthlyPriceArs: plan.monthlyPriceArs,
                    annualPriceArs: plan.annualPriceArs,
                    productDomain: ProductDomainEnum.ACCOMMODATION,
                    metadata: {
                        slug: plan.slug,
                        displayName: plan.name,
                        category: plan.category,
                        isDefault: plan.isDefault,
                        sortOrder: plan.sortOrder,
                        trialDays: plan.trialDays,
                        hasTrial: plan.hasTrial,
                        // Identifiability beyond the slug (per the billing-interval-override spec).
                        testPlan: true
                    }
                })
                .returning({ id: billingPlans.id });

            const insertedRow = inserted[0];
            if (!insertedRow) {
                throw new Error(`Insert of test daily plan "${plan.slug}" returned no row`);
            }
            planId = insertedRow.id;
            planStatus = 'created';
        }

        // ── Re-stamp product_domain + metadata.testPlan (idempotent no-op) ───
        await db
            .update(billingPlans)
            .set({
                productDomain: ProductDomainEnum.ACCOMMODATION,
                metadata: {
                    slug: plan.slug,
                    displayName: plan.name,
                    category: plan.category,
                    isDefault: plan.isDefault,
                    sortOrder: plan.sortOrder,
                    trialDays: plan.trialDays,
                    hasTrial: plan.hasTrial,
                    testPlan: true
                }
            })
            .where(eq(billingPlans.id, planId));

        if (planStatus === 'created') {
            logger.success({
                msg: `${STATUS_ICONS.Success}  Created test daily plan "${plan.name}" (${plan.slug}) with product_domain='accommodation'`
            });
        } else {
            logger.info(
                `${STATUS_ICONS.Skip}  Test daily plan "${plan.name}" (${plan.slug}) already exists — re-stamped product_domain + metadata.testPlan`
            );
        }

        // ── Ensure the daily price row (idempotent) ───────────────────────────
        const existingPrice = await db
            .select({ id: billingPrices.id })
            .from(billingPrices)
            .where(
                and(
                    eq(billingPrices.planId, planId),
                    eq(billingPrices.currency, 'ARS'),
                    eq(billingPrices.billingInterval, 'day'),
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
                unitAmount: TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS,
                billingInterval: 'day',
                intervalCount: 1,
                active: true,
                livemode: isProduction
            });
            priceStatus = 'created';
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Test daily plan: ${planStatus}; daily price: ${priceStatus}. Hidden from all listings by design — subscribing requires HOSPEDA_SHOW_TEST_BILLING_PLAN=true.`
        );

        summaryTracker.trackSuccess(entityName);
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        summaryTracker.trackError(
            'Test Daily Plan',
            TEST_DAILY_PLAN.slug,
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
}
