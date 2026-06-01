import { ALL_PLANS, type PlanDefinition } from '@repo/billing';
import { type DrizzleClient, and, billingPlans, billingPrices, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

// ---------------------------------------------------------------------------
// Divergence detection helpers
// ---------------------------------------------------------------------------

/**
 * Describes a single diverged field between the seed config and the DB row.
 */
interface DivergenceEntry {
    readonly field: string;
    readonly config: unknown;
    readonly db: unknown;
}

/**
 * Computes diverged fields between the seed config definition and the existing
 * DB row snapshot. Only compares fields that the seed controls; operator-added
 * fields (e.g. custom metadata keys) are ignored.
 *
 * @param plan - Seed config definition
 * @param dbRow - Existing DB row snapshot
 * @returns Array of diverged field descriptors (empty when config matches DB)
 */
function detectDivergences(
    plan: PlanDefinition,
    dbRow: {
        readonly description: string | null;
        readonly active: boolean | null;
        readonly entitlements: unknown;
        readonly limits: unknown;
        readonly metadata: unknown;
    }
): readonly DivergenceEntry[] {
    const diffs: DivergenceEntry[] = [];

    const meta = (dbRow.metadata ?? {}) as Record<string, unknown>;
    const limitsObj: Record<string, number> = {};
    for (const l of plan.limits) {
        limitsObj[l.key] = l.value;
    }

    /** Compare two values that may be objects/arrays using JSON serialization */
    function differs(a: unknown, b: unknown): boolean {
        return JSON.stringify(a) !== JSON.stringify(b);
    }

    if (dbRow.description !== plan.description) {
        diffs.push({ field: 'description', config: plan.description, db: dbRow.description });
    }
    if (dbRow.active !== plan.isActive) {
        diffs.push({ field: 'active', config: plan.isActive, db: dbRow.active });
    }
    if (differs(dbRow.entitlements, plan.entitlements)) {
        diffs.push({ field: 'entitlements', config: plan.entitlements, db: dbRow.entitlements });
    }
    if (differs(dbRow.limits, limitsObj)) {
        diffs.push({ field: 'limits', config: limitsObj, db: dbRow.limits });
    }
    if (meta.displayName !== plan.name) {
        diffs.push({ field: 'metadata.displayName', config: plan.name, db: meta.displayName });
    }
    if (meta.category !== plan.category) {
        diffs.push({ field: 'metadata.category', config: plan.category, db: meta.category });
    }
    if (meta.monthlyPriceArs !== plan.monthlyPriceArs) {
        diffs.push({
            field: 'metadata.monthlyPriceArs',
            config: plan.monthlyPriceArs,
            db: meta.monthlyPriceArs
        });
    }
    if (meta.annualPriceArs !== plan.annualPriceArs) {
        diffs.push({
            field: 'metadata.annualPriceArs',
            config: plan.annualPriceArs,
            db: meta.annualPriceArs
        });
    }
    if (meta.isDefault !== plan.isDefault) {
        diffs.push({ field: 'metadata.isDefault', config: plan.isDefault, db: meta.isDefault });
    }
    if (meta.sortOrder !== plan.sortOrder) {
        diffs.push({ field: 'metadata.sortOrder', config: plan.sortOrder, db: meta.sortOrder });
    }
    if (meta.hasTrial !== plan.hasTrial) {
        diffs.push({ field: 'metadata.hasTrial', config: plan.hasTrial, db: meta.hasTrial });
    }
    if (meta.trialDays !== plan.trialDays) {
        diffs.push({ field: 'metadata.trialDays', config: plan.trialDays, db: meta.trialDays });
    }

    return diffs;
}

/**
 * ARS is the only currency Hospeda bills in. Centralized so the seed
 * does not silently disagree with the rest of the billing stack.
 */
const SEED_CURRENCY = 'ARS';

/**
 * Result of `ensurePlan` so callers know whether the row was newly
 * created or already existed (for log counters).
 *
 * `status`:
 * - `'created'` — the row did not exist and was inserted.
 * - `'skipped'` — the row existed and config matches DB (no divergence).
 * - `'diverged'` — the row existed but config differs from the DB value.
 *   The DB row is NOT overwritten; a warning is logged. Operators must
 *   apply config changes manually or via the admin UI.
 */
interface EnsurePlanResult {
    readonly planId: string;
    readonly status: 'created' | 'skipped' | 'diverged';
}

/**
 * Ensure a `billing_plans` row exists for the given plan definition,
 * creating one when missing. Returns the resolved `plan.id` so callers
 * can chain price creation.
 *
 * Idempotent: matches existing rows by `name` (the seed's stable handle
 * — there are no DB-side unique constraints on slug).
 *
 * **Divergence policy (SPEC-168 T-018):** when a row already exists and its
 * persisted values differ from the seed config, a warning is logged listing
 * every diverged field. The DB row is NOT overwritten — the operator must
 * apply config changes manually or via the admin UI. This prevents the seed
 * from clobbering runtime edits performed through the admin plan management UI.
 *
 * `db` is injectable for tests; production callers omit it and the
 * default `getDb()` resolves the runtime client.
 */
async function ensurePlan(
    plan: PlanDefinition,
    livemode: boolean,
    db: DrizzleClient = getDb()
): Promise<EnsurePlanResult> {
    // Lookup AND insert use the slug as `name`. The Hospeda backend treats
    // `QZPayPlan.name` as the slug (see apps/api/src/services/
    // subscription-checkout.service.ts:72 — `resolvePlanBySlug` matches by
    // `p.name === planSlug`). Storing the human display name here would
    // make every checkout fail with PLAN_NOT_FOUND because the resolver
    // never finds a match. The human label still lives in metadata.displayName
    // for any UI that wants it.
    const existing = await db
        .select({
            id: billingPlans.id,
            description: billingPlans.description,
            active: billingPlans.active,
            entitlements: billingPlans.entitlements,
            limits: billingPlans.limits,
            metadata: billingPlans.metadata
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, plan.slug))
        .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
        // Detect divergences between config and DB — never overwrite.
        const diffs = detectDivergences(plan, existingRow);
        if (diffs.length > 0) {
            logger.warn(
                `${STATUS_ICONS.Skip}  Plan "${plan.slug}" diverged from config (${diffs.length} field(s)). DB is NOT updated — apply changes via admin UI.`
            );
            for (const diff of diffs) {
                logger.warn(
                    `   field "${diff.field}": config=${JSON.stringify(diff.config)}, db=${JSON.stringify(diff.db)}`
                );
            }
            return { planId: existingRow.id, status: 'diverged' };
        }
        return { planId: existingRow.id, status: 'skipped' };
    }

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
            livemode,
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
        throw new Error(`Insert of plan "${plan.slug}" returned no row`);
    }

    return { planId: insertedRow.id, status: 'created' };
}

/**
 * Inputs for {@link ensurePrice}.
 *
 * `billingInterval` uses the qzpay-core enum values (`'month'` / `'year'`)
 * — NOT the user-facing aliases (`'monthly'` / `'annual'`) — to match
 * what `billing_prices.billing_interval` stores and what
 * `findMonthlyPrice` / `findAnnualPrice` filter by downstream.
 */
interface EnsurePriceInput {
    readonly planId: string;
    readonly unitAmount: number;
    readonly billingInterval: 'month' | 'year';
    readonly trialDays: number;
    readonly hasTrial: boolean;
    readonly livemode: boolean;
}

/**
 * Ensure a `billing_prices` row exists for the given (planId, currency,
 * billingInterval, intervalCount=1) tuple. Skips when an active row
 * already matches; never updates an existing row (price changes go
 * through a separate flow, not the seed).
 *
 * `trialDays` is forwarded only when the plan declares a trial and the
 * interval is monthly. Annual plans don't carry a trial in Hospeda's
 * model (annual = one-time upfront charge, no MP preapproval).
 *
 * `db` is injectable for tests; production callers omit it.
 */
async function ensurePrice(
    input: EnsurePriceInput,
    db: DrizzleClient = getDb()
): Promise<'created' | 'skipped'> {
    const existing = await db
        .select({ id: billingPrices.id })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, input.planId),
                eq(billingPrices.currency, SEED_CURRENCY),
                eq(billingPrices.billingInterval, input.billingInterval),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    if (existing.length > 0) {
        return 'skipped';
    }

    const shouldAttachTrial =
        input.hasTrial && input.billingInterval === 'month' && input.trialDays > 0;

    await db.insert(billingPrices).values({
        planId: input.planId,
        currency: SEED_CURRENCY,
        unitAmount: input.unitAmount,
        billingInterval: input.billingInterval,
        intervalCount: 1,
        active: true,
        livemode: input.livemode,
        ...(shouldAttachTrial ? { trialDays: input.trialDays } : {})
    });

    return 'created';
}

/**
 * Seed billing plans + prices from configuration.
 *
 * For each entry in `ALL_PLANS` this:
 * 1. Ensures the matching `billing_plans` row exists.
 * 2. Ensures a monthly `billing_prices` row exists (always — every plan
 *    has a `monthlyPriceArs`).
 * 3. Ensures an annual `billing_prices` row exists when the plan
 *    declares `annualPriceArs` (skipped for plans like sponsor-only
 *    that have no annual variant).
 *
 * Fully idempotent: re-running against an already-seeded DB is a no-op.
 * The seed is the ONLY entry point for the initial config-to-DB transfer;
 * day-to-day plan/price edits happen through the admin UI directly
 * against the DB, not by re-running the seed.
 *
 * **Divergence policy (SPEC-168 T-018):** when an existing plan's DB values
 * differ from the seed config, a warning is logged for each diverged field.
 * The DB row is never overwritten — edits must be applied via the admin UI.
 *
 * @param _context - Seed context (unused but kept for the runner contract)
 */
export async function seedBillingPlans(_context: SeedContext): Promise<void> {
    const entityName = 'Billing Plans';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName}`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';

        let plansCreated = 0;
        let plansSkipped = 0;
        let plansDiverged = 0;
        let pricesCreated = 0;
        let pricesSkipped = 0;

        for (const plan of ALL_PLANS) {
            try {
                const planResult = await ensurePlan(plan, isProduction);
                if (planResult.status === 'created') {
                    plansCreated++;
                    logger.success({
                        msg: `${STATUS_ICONS.Success}  Created plan: "${plan.name}" (${plan.slug}) - ${plan.entitlements.length} entitlements, ${plan.limits.length} limits`
                    });
                } else if (planResult.status === 'diverged') {
                    plansDiverged++;
                    // Warning already emitted inside ensurePlan with field-level detail
                } else {
                    plansSkipped++;
                    logger.info(
                        `${STATUS_ICONS.Skip}  Skipping plan "${plan.name}" (${plan.slug}) - already exists, no drift`
                    );
                }

                // Monthly price — always present in the config.
                const monthlyResult = await ensurePrice({
                    planId: planResult.planId,
                    unitAmount: plan.monthlyPriceArs,
                    billingInterval: 'month',
                    trialDays: plan.trialDays,
                    hasTrial: plan.hasTrial,
                    livemode: isProduction
                });
                if (monthlyResult === 'created') {
                    pricesCreated++;
                } else {
                    pricesSkipped++;
                }

                // Annual price — only when the plan declares one.
                if (plan.annualPriceArs !== null && plan.annualPriceArs > 0) {
                    const annualResult = await ensurePrice({
                        planId: planResult.planId,
                        unitAmount: plan.annualPriceArs,
                        billingInterval: 'year',
                        trialDays: plan.trialDays,
                        hasTrial: plan.hasTrial,
                        livemode: isProduction
                    });
                    if (annualResult === 'created') {
                        pricesCreated++;
                    } else {
                        pricesSkipped++;
                    }
                }

                summaryTracker.trackSuccess(entityName);
            } catch (error) {
                logger.error(
                    `${STATUS_ICONS.Error}  Failed to seed plan "${plan.name}": ${error instanceof Error ? error.message : String(error)}`
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
            `${STATUS_ICONS.Info}  Plans: ${plansCreated} created, ${plansSkipped} skipped, ${plansDiverged} diverged (${ALL_PLANS.length} total)`
        );
        if (plansDiverged > 0) {
            logger.warn(
                `${STATUS_ICONS.Skip}  ${plansDiverged} plan(s) have config-vs-DB drift. See warnings above. Apply changes via admin UI.`
            );
        }
        logger.info(
            `${STATUS_ICONS.Info}  Prices: ${pricesCreated} created, ${pricesSkipped} skipped`
        );
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Internals exposed for unit tests only.
 */
export const _internals = {
    ensurePlan,
    ensurePrice,
    detectDivergences
};
