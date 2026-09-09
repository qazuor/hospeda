import { ALL_EXPERIENCE_PLANS, ALL_GASTRONOMY_PLANS, type PlanDefinition } from '@repo/billing';
import { and, billingPrices, type DrizzleClient, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { ensurePlan } from './billingPlans.seed.js';

/**
 * Ensures ONE `billing_prices` row for a commerce-domain plan, at the given
 * cadence.
 *
 * The row is skipped when `unitAmount <= 0`. A tier that has not been priced at
 * this cadence gets no row rather than a zero-amount one: a zero reads as a FREE
 * plan downstream (`initiateCommerceSubscription` answers `PLAN_NOT_PURCHASABLE`
 * on a zero amount and `NO_MONTHLY_PRICE` / `NO_ANNUAL_PRICE` on a missing row),
 * and "unpriced" and "free" must not resolve to the same row.
 *
 * Idempotent: never overwrites a price an operator has since changed —
 * `monthlyPriceArs` / `annualPriceArs` are `'commercial'` fields, so the
 * database wins.
 *
 * @param input.db - Drizzle client.
 * @param input.planId - The `billing_plans.id` to attach the price to.
 * @param input.unitAmount - Amount in centavos, or `null` for a cadence this
 *   plan does not sell.
 * @param input.billingInterval - qzpay's cadence column value (`'month'` /
 *   `'year'`), always at `intervalCount: 1` — the only two the seed and the
 *   `findMonthlyPrice` / `findAnnualPrice` lookups can express.
 * @param input.isProduction - Drives the `livemode` flag.
 * @returns What was created or skipped.
 */
async function ensureCommercePriceRow(input: {
    db: DrizzleClient;
    planId: string;
    unitAmount: number | null;
    billingInterval: 'month' | 'year';
    isProduction: boolean;
}): Promise<'created' | 'skipped' | 'none'> {
    const { db, planId, unitAmount, billingInterval, isProduction } = input;

    if (unitAmount === null || unitAmount <= 0) {
        // Unpriced at this cadence — see the docblock.
        return 'none';
    }

    const existingPrice = await db
        .select({ id: billingPrices.id })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planId),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, billingInterval),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    if (existingPrice.length > 0) {
        return 'skipped';
    }

    await db.insert(billingPrices).values({
        planId,
        currency: 'ARS',
        unitAmount,
        billingInterval,
        intervalCount: 1,
        active: true,
        livemode: isProduction
    });

    return 'created';
}

/**
 * Ensures BOTH cadences' `billing_prices` rows for one commerce plan (HOS-1285).
 *
 * The annual row is what makes the annual cadence buyable at all: checkout
 * resolves the PRICE row, not the plan column, so a tier carrying
 * `annualPriceArs` with no `'year'` row hard-throws `NO_ANNUAL_PRICE` — the same
 * shape `experience-pro` hit on the monthly side when HOS-975 activated it.
 *
 * @param input.db - Drizzle client.
 * @param input.planId - The `billing_plans.id` to attach the prices to.
 * @param input.plan - The plan definition (for both price fields).
 * @param input.isProduction - Drives the `livemode` flag.
 * @returns A human-readable summary of what happened, for the seed log.
 */
async function ensureCommercePriceRows(input: {
    db: DrizzleClient;
    planId: string;
    plan: PlanDefinition;
    isProduction: boolean;
}): Promise<string> {
    const { db, planId, plan, isProduction } = input;

    const monthly = await ensureCommercePriceRow({
        db,
        planId,
        unitAmount: plan.monthlyPriceArs,
        billingInterval: 'month',
        isProduction
    });
    const annual = await ensureCommercePriceRow({
        db,
        planId,
        unitAmount: plan.annualPriceArs,
        billingInterval: 'year',
        isProduction
    });

    return `monthly ${monthly}, annual ${annual}`;
}

/**
 * Commerce plan seed (SPEC-239 T-049 → HOS-688 §6.8, reworked by HOS-1290).
 *
 * Seeds two catalogues, each `PlanDefinition` already carrying its own
 * `product_domain` (HOS-1233 T-034 — `commerceVerticalTier()` derives it from
 * the tier's own vertical, so it never needs restating here):
 *
 * | Catalogue | `product_domain` | Why |
 * | --- | --- | --- |
 * | {@link ALL_GASTRONOMY_PLANS} | `gastronomy` | HOS-688: one subscription per owner per vertical. |
 * | {@link ALL_EXPERIENCE_PLANS} | `experience` | Same, experience side. |
 *
 * **The pre-HOS-688 `commerce-listing` plan is no longer seeded here
 * (HOS-695, release C).** It used to be re-inserted/re-stamped on every run
 * with `product_domain = 'commerce'` — a living-source assignment of the
 * retired value, which AC-33 forbids and which no longer even compiles
 * (`ProductDomainEnum.COMMERCE` does not exist). No current checkout path
 * resolves to it (`resolveCommercePlanSlug` only ever returns a per-vertical
 * gastronomy/experience slug), so a fresh DB has no reason to carry it at
 * all. An already-seeded environment's existing `commerce-listing` row is
 * UNTOUCHED by this change — its historical `product_domain='commerce'`
 * value stays whatever it already was; retiring that row is a data decision
 * about real rows (HOS-692), not something this code edit makes.
 *
 * Why a dedicated seed and NOT the `ALL_PLANS` loop in `billingPlans.seed.ts`:
 * every plan here is deliberately excluded from `ALL_PLANS` so the
 * accommodation-facing plan list, the grant-matrix snapshot tests and the
 * config-drift checks stay accommodation-only. That isolation is
 * `SPEC-239`'s and this seed does not touch it (HOS-1290's whole point is
 * the opposite: reuse the SAME propagation engine without folding the
 * catalogues together).
 *
 * **HOS-1290 — now shares the Model C sync engine with `ALL_PLANS`.** Before
 * this change, an existing row was only ever re-stamped for `product_domain`;
 * a config edit that added a `LimitKey` or an entitlement to a commerce plan
 * silently never reached an already-seeded staging/production row. This seed
 * now calls the exact same {@link ensurePlan} the accommodation/tourist loop
 * uses, so capability-layer drift (entitlements, limit-key presence,
 * `product_domain`, `metadata.category`/`isDefault`) syncs from config on
 * every commerce plan too, while commercial-layer fields (price, description,
 * `active`, limit numeric values) keep preserving the DB / operator edit,
 * exactly as accommodation plans already do.
 *
 * Idempotent throughout.
 *
 * @param _context - Seed context (unused; kept for the runner contract).
 * @param deps - Injectable dependencies. Defaults to the real `getDb()`
 *   client; tests inject a stub instead (`vi.mock('@repo/db', ...)` does not
 *   reliably intercept a `getDb()` call made from inside a `src/` module
 *   under this repo's `vite-tsconfig-paths` + `pool: 'forks'` vitest config —
 *   same limitation and same fix as
 *   `pointOfInterestCatalogRelations.ts`'s own "Testability" JSDoc note).
 */
export async function seedCommercePlan(
    _context: SeedContext,
    deps: { db?: DrizzleClient } = {}
): Promise<void> {
    const entityName = 'Commerce Plan';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName} (SPEC-239 / HOS-688)`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const db: DrizzleClient = deps.db ?? getDb();

        const catalogues: ReadonlyArray<{
            label: string;
            plans: readonly PlanDefinition[];
        }> = [
            { label: 'gastronomy', plans: ALL_GASTRONOMY_PLANS },
            { label: 'experience', plans: ALL_EXPERIENCE_PLANS }
        ];

        let created = 0;
        let skipped = 0;
        let synced = 0;

        for (const { plans } of catalogues) {
            for (const plan of plans) {
                const planResult = await ensurePlan(plan, isProduction, db);
                const priceStatus = await ensureCommercePriceRows({
                    db,
                    planId: planResult.planId,
                    plan,
                    isProduction
                });

                if (planResult.status === 'created') {
                    created++;
                    logger.success({
                        msg: `${STATUS_ICONS.Success}  Created plan "${plan.name}" (${plan.slug}) with product_domain='${plan.productDomain}' (prices: ${priceStatus})`
                    });
                } else if (planResult.status === 'synced') {
                    synced++;
                    // Field-level detail already logged inside ensurePlan.
                } else {
                    skipped++;
                    logger.info(
                        `${STATUS_ICONS.Skip}  Plan "${plan.name}" (${plan.slug}) already exists, no drift (prices: ${priceStatus})`
                    );
                }
            }
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Commerce plans: ${created} created, ${skipped} skipped, ${synced} synced (Model C). Prices are 'commercial' fields — the seed never overwrites one that already exists, so any admin-UI override stands.`
        );

        summaryTracker.trackSuccess(entityName);
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        summaryTracker.trackError(
            'Commerce Plan',
            'commercePlan.seed.ts',
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
}
