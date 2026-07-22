import { COMMERCE_LISTING_PLAN } from '@repo/billing';
import { and, billingPlans, billingPrices, type DrizzleClient, eq, getDb } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Commerce-listing plan seed (SPEC-239 T-049).
 *
 * Seeds the single {@link COMMERCE_LISTING_PLAN} row into `billing_plans` (and
 * its monthly `billing_prices` row) with `product_domain = 'commerce'` set
 * directly at insert time, then re-stamps it via a typed `UPDATE` (idempotent
 * no-op) so a re-run always self-heals the domain regardless of how the
 * existing row got there.
 *
 * Why a dedicated seed (NOT the `ALL_PLANS` loop in `billingPlans.seed.ts`):
 * The commerce plan is intentionally excluded from `ALL_PLANS` so the
 * accommodation-facing plan list, the grant-matrix snapshot tests, and the
 * config-drift checks stay accommodation-only.
 *
 * Idempotent: matches the existing row by `name` (the slug). On a re-run it
 * skips the insert and only re-stamps `product_domain` (a no-op when already
 * `'commerce'`).
 *
 * @param _context - Seed context (unused; kept for the runner contract).
 */
export async function seedCommercePlan(_context: SeedContext): Promise<void> {
    const entityName = 'Commerce Plan';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName} (SPEC-239)`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const db: DrizzleClient = getDb();
        const plan = COMMERCE_LISTING_PLAN;

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
                    // HOS-39 T-005 / HOS-73: displayName/monthlyPriceArs/annualPriceArs
                    // are typed top-level columns as of qzpay-drizzle 1.11.0 (still
                    // duplicated in metadata below).
                    displayName: plan.name,
                    monthlyPriceArs: plan.monthlyPriceArs,
                    annualPriceArs: plan.annualPriceArs,
                    productDomain: ProductDomainEnum.COMMERCE,
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
                throw new Error(`Insert of commerce plan "${plan.slug}" returned no row`);
            }
            planId = insertedRow.id;
            planStatus = 'created';
        }

        // ── Re-stamp product_domain='commerce' (idempotent no-op if already set) ──
        await db
            .update(billingPlans)
            .set({ productDomain: ProductDomainEnum.COMMERCE })
            .where(eq(billingPlans.id, planId));

        if (planStatus === 'created') {
            logger.success({
                msg: `${STATUS_ICONS.Success}  Created commerce plan "${plan.name}" (${plan.slug}) with product_domain='commerce'`
            });
        } else {
            logger.info(
                `${STATUS_ICONS.Skip}  Commerce plan "${plan.name}" (${plan.slug}) already exists — re-stamped product_domain='commerce'`
            );
        }

        // ── Ensure the monthly price row (idempotent) ────────────────────────
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
            `${STATUS_ICONS.Info}  Commerce plan: ${planStatus}; monthly price: ${priceStatus}. monthlyPriceArs is CONFIRMED (ARS 15.000/mes, owner 2026-07-22, HOS-166 OQ-2) — it is still a commercial-layer field, so any later admin-UI override stands.`
        );

        summaryTracker.trackSuccess(entityName);
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        summaryTracker.trackError(
            'Commerce Plan',
            COMMERCE_LISTING_PLAN.slug,
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
}
