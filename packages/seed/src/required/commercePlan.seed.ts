import { ALL_EXPERIENCE_PLANS, ALL_GASTRONOMY_PLANS, type PlanDefinition } from '@repo/billing';
import { and, billingPlans, billingPrices, type DrizzleClient, eq, getDb } from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/** Outcome of seeding one plan row. */
type EnsureOutcome = { plan: 'created' | 'skipped'; price: 'created' | 'skipped' | 'none' };

/**
 * Seeds one commerce-domain plan row (and its monthly `billing_prices` row).
 *
 * `product_domain` is set at insert time AND re-stamped by a typed `UPDATE`
 * afterwards, so a re-run self-heals the domain regardless of how an existing
 * row got there — which matters here because HOS-692 rewrites the domain of
 * every commerce row and the undo migration puts it back.
 *
 * The price row is skipped when `monthlyPriceArs <= 0`. The disabled tiers of
 * each vertical have not been priced yet (§6.8 enables only premium), and
 * seeding a zero-amount price would be worse than seeding none: it reads as a
 * free plan rather than as an unpriced one.
 *
 * Idempotent: matches by `name` (the slug), skips the insert on a re-run, and
 * never overwrites a price an operator has since changed — `monthlyPriceArs` is
 * a `'commercial'` field, so the database wins.
 *
 * @param input.db - Drizzle client.
 * @param input.plan - The plan definition to seed.
 * @param input.productDomain - The `billing_plans.product_domain` to stamp.
 * @param input.isProduction - Drives the `livemode` flag.
 * @returns What was created and what was skipped.
 */
async function ensureCommercePlan(input: {
    db: DrizzleClient;
    plan: PlanDefinition;
    productDomain: ProductDomainValue;
    isProduction: boolean;
}): Promise<EnsureOutcome> {
    const { db, plan, productDomain, isProduction } = input;

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
                productDomain,
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

    // Re-stamp product_domain (idempotent no-op when already correct).
    await db.update(billingPlans).set({ productDomain }).where(eq(billingPlans.id, planId));

    if (plan.monthlyPriceArs <= 0) {
        // Unpriced tier — see the docblock.
        return { plan: planStatus, price: 'none' };
    }

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

    if (existingPrice.length > 0) {
        return { plan: planStatus, price: 'skipped' };
    }

    await db.insert(billingPrices).values({
        planId,
        currency: 'ARS',
        unitAmount: plan.monthlyPriceArs,
        billingInterval: 'month',
        intervalCount: 1,
        active: true,
        livemode: isProduction
    });

    return { plan: planStatus, price: 'created' };
}

/**
 * Commerce plan seed (SPEC-239 T-049 → HOS-688 §6.8).
 *
 * Seeds two catalogues, each stamped with its own `billing_plans.product_domain`:
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
 * config-drift checks stay accommodation-only.
 *
 * Idempotent throughout — see {@link ensureCommercePlan}.
 *
 * @param _context - Seed context (unused; kept for the runner contract).
 */
export async function seedCommercePlan(_context: SeedContext): Promise<void> {
    const entityName = 'Commerce Plan';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName} (SPEC-239 / HOS-688)`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const db: DrizzleClient = getDb();

        const catalogues: ReadonlyArray<{
            plans: readonly PlanDefinition[];
            productDomain: ProductDomainValue;
        }> = [
            { plans: ALL_GASTRONOMY_PLANS, productDomain: ProductDomainEnum.GASTRONOMY },
            { plans: ALL_EXPERIENCE_PLANS, productDomain: ProductDomainEnum.EXPERIENCE }
        ];

        let created = 0;
        let skipped = 0;

        for (const { plans, productDomain } of catalogues) {
            for (const plan of plans) {
                const outcome = await ensureCommercePlan({
                    db,
                    plan,
                    productDomain,
                    isProduction
                });

                if (outcome.plan === 'created') {
                    created++;
                    logger.success({
                        msg: `${STATUS_ICONS.Success}  Created plan "${plan.name}" (${plan.slug}) with product_domain='${productDomain}' (price: ${outcome.price})`
                    });
                } else {
                    skipped++;
                    logger.info(
                        `${STATUS_ICONS.Skip}  Plan "${plan.name}" (${plan.slug}) already exists — re-stamped product_domain='${productDomain}' (price: ${outcome.price})`
                    );
                }
            }
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Commerce plans: ${created} created, ${skipped} skipped. Prices are 'commercial' fields — the seed never overwrites one that already exists, so any admin-UI override stands.`
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
