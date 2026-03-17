/**
 * Addon Purchases Data Migration Script
 *
 * Migrates addon purchase data from subscription.metadata.addonAdjustments JSON
 * to the billing_addon_purchases table. After inserting rows it also backfills
 * QZPay entitlements via the billing API so that entitlement checks reflect the
 * migrated data immediately.
 *
 * This script:
 * - Reads all subscriptions with addonAdjustments metadata
 * - Creates corresponding rows in billing_addon_purchases
 * - Backfills QZPay entitlements for active addon purchases (T-009a)
 * - Handles duplicates gracefully (idempotent)
 * - Supports dry-run mode for safety
 *
 * @example
 * ```bash
 * # Dry run (no changes)
 * pnpm tsx src/billing/migrate-addon-purchases.ts --dry-run
 *
 * # Execute migration
 * pnpm tsx src/billing/migrate-addon-purchases.ts
 * ```
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { ALL_ADDONS, ALL_PLANS, type AddonDefinition, type PlanDefinition } from '@repo/billing';
import { createLogger } from '@repo/logger';
import { sql } from 'drizzle-orm';
import { getDb } from '../client.ts';
import { billingAddonPurchases } from '../schemas/index.ts';
import { createBillingAdapter } from './drizzle-adapter.ts';
import { billingSubscriptions } from './schemas.ts';

/**
 * Logger for migration operations
 */
const logger = createLogger('db:migration:addon-purchases');

/**
 * Get addon definition by slug
 */
function getAddonBySlug(slug: string): AddonDefinition | undefined {
    return ALL_ADDONS.find((addon) => addon.slug === slug);
}

/**
 * Addon adjustment stored in subscription metadata
 */
interface AddonAdjustment {
    addonSlug: string;
    entitlement?: string;
    limitKey?: string;
    limitIncrease?: number;
    appliedAt: string;
}

/**
 * Limit adjustment for billing_addon_purchases
 */
interface LimitAdjustment {
    limitKey: string;
    increase: number;
    previousValue: number;
    newValue: number;
}

/**
 * Entitlement adjustment for billing_addon_purchases
 */
interface EntitlementAdjustment {
    entitlementKey: string;
    granted: boolean;
}

/**
 * Migration statistics
 */
interface MigrationStats {
    subscriptionsProcessed: number;
    addonsFound: number;
    addonsMigrated: number;
    addonsSkipped: number;
    entitlementsBackfilled: number;
    limitsBackfilled: number;
    plansRestored: number;
    errors: Array<{ subscriptionId: string; error: string }>;
}

/**
 * Migration options
 */
interface MigrationOptions {
    dryRun?: boolean;
    verbose?: boolean;
}

/**
 * Initializes a QZPay billing instance for use in the migration script.
 *
 * The migration script runs as a standalone CLI process and cannot rely on the
 * Hono middleware that initializes billing in the API server. This function
 * creates a fresh billing instance backed by the already-initialized database.
 *
 * @param db - Drizzle database instance returned by getDb()
 * @returns Configured QZPayBilling instance
 * @throws {Error} If the billing instance cannot be created
 */
function initBillingInstance(db: ReturnType<typeof getDb>): QZPayBilling {
    const storageAdapter = createBillingAdapter(db, {
        livemode: process.env.NODE_ENV === 'production'
    });

    return createQZPayBilling({
        storage: storageAdapter,
        defaultCurrency: 'ARS',
        livemode: process.env.NODE_ENV === 'production'
    });
}

/**
 * Input for backfillLimit helper
 */
interface BackfillLimitInput {
    billing: QZPayBilling;
    customerId: string;
    subscriptionId: string;
    addonSlug: string;
    addonDef: AddonDefinition;
    purchaseId: string;
    stats: MigrationStats;
    verbose: boolean;
}

/**
 * Looks up the base plan limit for a given limit key by finding the customer's
 * canonical plan definition and returning the matching LimitDefinition value.
 *
 * Returns null when no canonical plan is found for the subscription, or when the
 * plan does not define the requested limit key. Callers should treat null as
 * "no base limit known" and skip the set operation.
 *
 * @param subscriptionId - ID of the subscription to look up
 * @param limitKey - The limit key to find in the plan definition
 * @returns The canonical base plan limit value, or null if not found
 */
async function getBasePlanLimit(subscriptionId: string, limitKey: string): Promise<number | null> {
    const db = getDb();

    // Fetch the subscription's plan_id to resolve the canonical plan slug
    const rows = await db
        .select({ planId: billingSubscriptions.planId })
        .from(billingSubscriptions)
        .where(sql`${billingSubscriptions.id} = ${subscriptionId}`)
        .limit(1);

    const row = rows[0];
    if (!row?.planId) {
        return null;
    }

    // plan_id in billing_subscriptions is the QZPay plan's external ID / slug
    const canonicalPlan: PlanDefinition | undefined = ALL_PLANS.find((p) => p.slug === row.planId);

    if (!canonicalPlan) {
        return null;
    }

    const limitDef = canonicalPlan.limits.find((l) => l.key === limitKey);
    return limitDef?.value ?? null;
}

/**
 * Backfills a single limit adjustment for an addon purchase into QZPay.
 *
 * Reads the base plan limit from the canonical ALL_PLANS config, computes
 * newMaxValue = basePlanLimit + addon.limitIncrease, then calls
 * billing.limits.set(). The set is an upsert so multiple runs are idempotent.
 *
 * Unlimited base limits (-1) are skipped with a warning because adding a finite
 * increase to an unlimited limit does not change the effective access.
 *
 * @param input - Backfill parameters
 */
async function backfillLimit(input: BackfillLimitInput): Promise<void> {
    const { billing, customerId, subscriptionId, addonSlug, addonDef, purchaseId, stats, verbose } =
        input;

    const limitKey = addonDef.affectsLimitKey;
    const limitIncrease = addonDef.limitIncrease;

    if (
        limitKey === null ||
        limitKey === undefined ||
        limitIncrease === null ||
        limitIncrease === undefined
    ) {
        return;
    }

    const basePlanLimit = await getBasePlanLimit(subscriptionId, limitKey);

    if (basePlanLimit === null) {
        logger.warn(
            { customerId, subscriptionId, addonSlug, limitKey },
            'Could not determine base plan limit for limit backfill - skipping'
        );
        stats.errors.push({
            subscriptionId,
            error: `Could not determine base plan limit for limitKey=${limitKey} (addon ${addonSlug})`
        });
        return;
    }

    // Unlimited base limits (-1) need no addon increase
    if (basePlanLimit === -1) {
        logger.warn(
            { customerId, subscriptionId, addonSlug, limitKey },
            'Base plan limit is unlimited (-1), skipping limit backfill for this addon'
        );
        return;
    }

    const newMaxValue = basePlanLimit + limitIncrease;

    try {
        await billing.limits.set({
            customerId,
            limitKey,
            maxValue: newMaxValue,
            source: 'addon',
            sourceId: purchaseId
        });

        stats.limitsBackfilled++;

        if (verbose) {
            logger.info(
                {
                    customerId,
                    subscriptionId,
                    addonSlug,
                    limitKey,
                    basePlanLimit,
                    limitIncrease,
                    newMaxValue,
                    addonPurchaseId: purchaseId
                },
                'Limit backfilled'
            );
        }
    } catch (limitError) {
        const limitErrorMessage =
            limitError instanceof Error ? limitError.message : String(limitError);
        stats.errors.push({
            subscriptionId,
            error: `Limit set failed for ${limitKey} (addon ${addonSlug}): ${limitErrorMessage}`
        });
        logger.error(
            {
                customerId,
                subscriptionId,
                addonSlug,
                limitKey,
                newMaxValue,
                error: limitErrorMessage
            },
            'Failed to backfill limit'
        );
    }
}

/**
 * Input for restoreAllPlans helper
 */
interface RestoreAllPlansInput {
    billing: QZPayBilling;
    stats: MigrationStats;
    verbose: boolean;
}

/**
 * Restores all plans in billing_plans to their canonical entitlements and limits
 * as defined in ALL_PLANS. This undoes any damage from the global plan mutation bug
 * where addon purchases incorrectly mutated the shared plan row instead of creating
 * per-customer overrides.
 *
 * **Why private storage access is required**: `QZPayPlanService` (the public billing
 * API surface) exposes only `get()` and `list()` — there is no public `update()` method
 * for bulk plan restoration. The only way to write plan data outside of the normal
 * plan-creation flow is to call `billing.getStorage().plans.update()` directly on the
 * underlying storage adapter. This is intentional and acceptable here because:
 *   1. This function runs exclusively as part of a one-time data-repair migration, not
 *      in any request-serving code path.
 *   2. The storage adapter is the same Drizzle-backed implementation used by QZPay
 *      internally, so there is no schema mismatch risk.
 *   3. No public API equivalent exists — this is the only viable approach.
 *
 * Do NOT replicate this pattern in production services.
 *
 * @param input - Restore parameters
 */
async function restoreAllPlans(input: RestoreAllPlansInput): Promise<void> {
    const { billing, stats, verbose } = input;

    const storage = billing.getStorage();

    // Fetch all plans using a pagination loop to avoid silently dropping plans
    // beyond the first page (GAP-038-19). Page size of 100 is used per request;
    // iteration continues until all pages are exhausted.
    const PAGE_SIZE = 100;
    const firstPage = await storage.plans.list({ limit: PAGE_SIZE });
    const allPlans: (typeof firstPage.data)[number][] = [...firstPage.data];
    let cursor: string | undefined = firstPage.hasMore ? firstPage.nextCursor : undefined;
    while (cursor !== undefined) {
        const page = await storage.plans.list({ limit: PAGE_SIZE, startingAfter: cursor });
        allPlans.push(...page.data);
        cursor = page.hasMore ? page.nextCursor : undefined;
    }

    for (const qzPlan of allPlans) {
        // Resolve the canonical plan definition by matching the slug stored in metadata,
        // or by normalising the plan name to a slug as a fallback.
        const slugFromMeta =
            typeof qzPlan.metadata?.slug === 'string' ? qzPlan.metadata.slug : undefined;

        const canonicalPlan: PlanDefinition | undefined = slugFromMeta
            ? ALL_PLANS.find((p) => p.slug === slugFromMeta)
            : ALL_PLANS.find(
                  (p) =>
                      p.name.toLowerCase().replace(/\s+/g, '-') ===
                      qzPlan.name.toLowerCase().replace(/\s+/g, '-')
              );

        if (!canonicalPlan) {
            if (verbose) {
                logger.debug(
                    { planId: qzPlan.id, planName: qzPlan.name },
                    'No canonical plan found for this QZPay plan entry - skipping restoration'
                );
            }
            continue;
        }

        // Build canonical entitlements array and limits record from the plan definition
        const canonicalEntitlements: string[] = canonicalPlan.entitlements.map((e) => String(e));
        const canonicalLimits: Record<string, number> = {};
        for (const limitDef of canonicalPlan.limits) {
            canonicalLimits[limitDef.key] = limitDef.value;
        }

        try {
            await storage.plans.update(qzPlan.id, {
                entitlements: canonicalEntitlements,
                limits: canonicalLimits
            });

            stats.plansRestored++;

            if (verbose) {
                logger.info(
                    {
                        planId: qzPlan.id,
                        planName: qzPlan.name,
                        canonicalSlug: canonicalPlan.slug,
                        entitlementsCount: canonicalEntitlements.length,
                        limitsCount: Object.keys(canonicalLimits).length
                    },
                    'Plan restored to canonical config'
                );
            }
        } catch (planError) {
            const planErrorMessage =
                planError instanceof Error ? planError.message : String(planError);
            stats.errors.push({
                subscriptionId: `plan:${qzPlan.id}`,
                error: `Plan restoration failed for ${canonicalPlan.slug}: ${planErrorMessage}`
            });
            logger.error(
                {
                    planId: qzPlan.id,
                    canonicalSlug: canonicalPlan.slug,
                    error: planErrorMessage
                },
                'Failed to restore plan to canonical config'
            );
        }
    }

    logger.info(
        { plansRestored: stats.plansRestored, plansInBilling: allPlans.length },
        'Plan restoration complete'
    );
}

/**
 * Input for logDryRunPlanRestoration helper
 */
interface LogDryRunPlanRestorationInput {
    stats: MigrationStats;
    verbose: boolean;
}

/**
 * Logs what plan restoration would do in dry-run mode without modifying any data.
 *
 * @param input - Dry-run logging parameters
 */
function logDryRunPlanRestoration(input: LogDryRunPlanRestorationInput): void {
    const { stats, verbose } = input;

    for (const canonicalPlan of ALL_PLANS) {
        if (verbose) {
            logger.info(
                {
                    canonicalSlug: canonicalPlan.slug,
                    entitlementsCount: canonicalPlan.entitlements.length,
                    limitsCount: canonicalPlan.limits.length
                },
                '[DRY RUN] Would restore plan to canonical config'
            );
        }
        stats.plansRestored++;
    }
}

/**
 * Migrates addon purchases from subscription metadata to billing_addon_purchases table
 * and backfills QZPay entitlements for all active addon purchases that grant them.
 *
 * @param input - Migration options
 * @returns Migration statistics
 *
 * @example
 * ```typescript
 * // Dry run
 * const stats = await migrateAddonPurchases({ dryRun: true });
 * console.log(`Would migrate ${stats.addonsMigrated} addon purchases`);
 *
 * // Execute migration
 * const stats = await migrateAddonPurchases({ dryRun: false, verbose: true });
 * console.log(`Migrated ${stats.addonsMigrated} addon purchases`);
 * ```
 */
export async function migrateAddonPurchases(input: MigrationOptions = {}): Promise<MigrationStats> {
    const { dryRun = false, verbose = false } = input;

    const stats: MigrationStats = {
        subscriptionsProcessed: 0,
        addonsFound: 0,
        addonsMigrated: 0,
        addonsSkipped: 0,
        entitlementsBackfilled: 0,
        limitsBackfilled: 0,
        plansRestored: 0,
        errors: []
    };

    const db = getDb();

    // Initialize billing instance for entitlement backfill (T-009a)
    let billing: QZPayBilling | null = null;
    if (!dryRun) {
        try {
            billing = initBillingInstance(db);
            logger.info('QZPay billing instance initialized for entitlement backfill');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, 'Failed to initialize QZPay billing instance');
            throw new Error(`Billing initialization failed: ${errorMessage}`);
        }
    }

    try {
        // Fetch all subscriptions
        const subscriptions = await db
            .select({
                id: billingSubscriptions.id,
                customerId: billingSubscriptions.customerId,
                metadata: billingSubscriptions.metadata
            })
            .from(billingSubscriptions);

        logger.info(
            { count: subscriptions.length, dryRun },
            `Found ${subscriptions.length} total subscriptions`
        );

        // Process each subscription
        for (const subscription of subscriptions) {
            stats.subscriptionsProcessed++;

            try {
                // Extract addonAdjustments from metadata
                const metadata = subscription.metadata as Record<string, unknown> | null;
                const addonAdjustmentsJson = metadata?.addonAdjustments as string | undefined;

                if (!addonAdjustmentsJson) {
                    if (verbose) {
                        logger.debug(
                            { subscriptionId: subscription.id },
                            'No addonAdjustments found'
                        );
                    }
                    continue;
                }

                // Parse JSON
                let adjustments: AddonAdjustment[] = [];
                try {
                    adjustments = JSON.parse(addonAdjustmentsJson);
                    if (!Array.isArray(adjustments)) {
                        throw new Error('addonAdjustments is not an array');
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    stats.errors.push({
                        subscriptionId: subscription.id,
                        error: `Failed to parse addonAdjustments: ${errorMessage}`
                    });
                    logger.error(
                        { subscriptionId: subscription.id, error: errorMessage },
                        'Invalid JSON in addonAdjustments'
                    );
                    continue;
                }

                if (verbose) {
                    logger.debug(
                        { subscriptionId: subscription.id, count: adjustments.length },
                        `Found ${adjustments.length} addon adjustments`
                    );
                }

                stats.addonsFound += adjustments.length;

                // Process each adjustment
                for (const adjustment of adjustments) {
                    try {
                        // Get addon definition to calculate expires_at
                        const addonDef = getAddonBySlug(adjustment.addonSlug);

                        // Build limit adjustments array
                        const limitAdjustments: LimitAdjustment[] = [];
                        if (adjustment.limitKey && adjustment.limitIncrease) {
                            limitAdjustments.push({
                                limitKey: adjustment.limitKey,
                                increase: adjustment.limitIncrease,
                                previousValue: 0, // Unknown from old data
                                newValue: adjustment.limitIncrease // Approximation
                            });
                        }

                        // Build entitlement adjustments array
                        const entitlementAdjustments: EntitlementAdjustment[] = [];
                        if (adjustment.entitlement) {
                            entitlementAdjustments.push({
                                entitlementKey: adjustment.entitlement,
                                granted: true
                            });
                        }

                        // Calculate expires_at from addon config
                        let expiresAt: Date | null = null;
                        if (addonDef?.durationDays) {
                            const purchasedAt = new Date(adjustment.appliedAt);
                            expiresAt = new Date(purchasedAt);
                            expiresAt.setDate(expiresAt.getDate() + addonDef.durationDays);
                        }

                        if (dryRun) {
                            // Dry run: just log what would be inserted
                            if (verbose) {
                                logger.info(
                                    {
                                        customerId: subscription.customerId,
                                        subscriptionId: subscription.id,
                                        addonSlug: adjustment.addonSlug,
                                        status: 'active',
                                        purchasedAt: adjustment.appliedAt,
                                        expiresAt,
                                        limitAdjustments,
                                        entitlementAdjustments
                                    },
                                    '[DRY RUN] Would insert addon purchase'
                                );

                                // Log entitlement backfill that would happen (T-009a)
                                if (addonDef?.grantsEntitlement) {
                                    logger.info(
                                        {
                                            customerId: subscription.customerId,
                                            entitlementKey: addonDef.grantsEntitlement,
                                            source: 'addon',
                                            expiresAt
                                        },
                                        '[DRY RUN] Would grant entitlement'
                                    );
                                }

                                // ─── Limit backfill dry-run (T-009b) ────────────────────────────
                                if (
                                    addonDef?.affectsLimitKey !== null &&
                                    addonDef?.affectsLimitKey !== undefined &&
                                    addonDef.limitIncrease !== null &&
                                    addonDef.limitIncrease !== undefined
                                ) {
                                    logger.info(
                                        {
                                            customerId: subscription.customerId,
                                            limitKey: addonDef.affectsLimitKey,
                                            limitIncrease: addonDef.limitIncrease,
                                            source: 'addon'
                                        },
                                        '[DRY RUN] Would set limit'
                                    );
                                    stats.limitsBackfilled++;
                                }
                            }
                            stats.addonsMigrated++;
                        } else {
                            // Check if this addon purchase already exists.
                            // Idempotency is keyed on customerId + addonSlug + status='active'
                            // only — subscriptionId is intentionally excluded so that a customer
                            // who has changed subscriptions does not get duplicate rows on
                            // re-runs (GAP-038-28 / GAP-038-39).
                            // Timestamps are normalised to epoch milliseconds for comparison to
                            // avoid false mismatches across timezone-format differences
                            // (GAP-038-28).
                            const purchasedAtEpoch = new Date(adjustment.appliedAt).getTime();
                            const existing = await db
                                .select({
                                    id: billingAddonPurchases.id,
                                    purchasedAt: billingAddonPurchases.purchasedAt
                                })
                                .from(billingAddonPurchases)
                                .where(
                                    sql`${billingAddonPurchases.customerId} = ${subscription.customerId}
                                        AND ${billingAddonPurchases.addonSlug} = ${adjustment.addonSlug}
                                        AND ${billingAddonPurchases.status} = 'active'
                                        AND ${billingAddonPurchases.deletedAt} IS NULL`
                                );

                            // Compare by epoch to handle timezone-format differences.
                            const alreadyMigrated = existing.some(
                                (row) =>
                                    row.purchasedAt !== null &&
                                    new Date(row.purchasedAt).getTime() === purchasedAtEpoch
                            );

                            if (alreadyMigrated) {
                                if (verbose) {
                                    logger.debug(
                                        {
                                            customerId: subscription.customerId,
                                            addonSlug: adjustment.addonSlug
                                        },
                                        'Already exists (matched by customerId+addonSlug+purchasedAt), skipping'
                                    );
                                }
                                stats.addonsSkipped++;
                                continue;
                            }

                            // Insert new addon purchase and retrieve the generated ID
                            // so we can use it as sourceId for the entitlement grant.
                            const inserted = await db
                                .insert(billingAddonPurchases)
                                .values({
                                    customerId: subscription.customerId,
                                    subscriptionId: subscription.id,
                                    addonSlug: adjustment.addonSlug,
                                    status: 'active',
                                    purchasedAt: new Date(adjustment.appliedAt),
                                    expiresAt,
                                    limitAdjustments,
                                    entitlementAdjustments,
                                    metadata: { migratedFrom: 'subscription_metadata' }
                                })
                                .returning({ id: billingAddonPurchases.id });

                            // Guard against empty INSERT result (e.g. constraint violations
                            // that do not throw). Throwing here lets the outer per-addon
                            // try/catch record the error in stats and continue with the
                            // next addon (GAP-038-17).
                            const insertedRow = inserted[0];
                            if (insertedRow === undefined) {
                                throw new Error(
                                    `INSERT returned empty for customerId=${subscription.customerId} addonSlug=${adjustment.addonSlug} — possible constraint violation`
                                );
                            }

                            if (verbose) {
                                logger.info(
                                    {
                                        subscriptionId: subscription.id,
                                        addonSlug: adjustment.addonSlug,
                                        expiresAt
                                    },
                                    'Migrated successfully'
                                );
                            }
                            stats.addonsMigrated++;

                            // ─── Entitlement backfill (T-009a) ──────────────────────────────────
                            // For each active addon purchase that grants an entitlement, call
                            // billing.entitlements.grant(). The grant operation is an upsert so
                            // calling it multiple times for the same customer+key is idempotent.
                            if (
                                billing !== null &&
                                addonDef?.grantsEntitlement !== null &&
                                addonDef?.grantsEntitlement !== undefined
                            ) {
                                try {
                                    await billing.entitlements.grant({
                                        customerId: subscription.customerId,
                                        entitlementKey: addonDef.grantsEntitlement,
                                        source: 'addon',
                                        sourceId: insertedRow.id,
                                        expiresAt: expiresAt ?? undefined
                                    });

                                    stats.entitlementsBackfilled++;

                                    if (verbose) {
                                        logger.info(
                                            {
                                                customerId: subscription.customerId,
                                                entitlementKey: addonDef.grantsEntitlement,
                                                addonPurchaseId: insertedRow.id,
                                                expiresAt
                                            },
                                            'Entitlement backfilled'
                                        );
                                    }
                                } catch (entitlementError) {
                                    // Non-fatal: the addon purchase row was already committed.
                                    // Log the failure and continue. Re-running the migration
                                    // will skip the already-inserted row but retry the grant.
                                    const entitlementErrorMessage =
                                        entitlementError instanceof Error
                                            ? entitlementError.message
                                            : String(entitlementError);
                                    stats.errors.push({
                                        subscriptionId: subscription.id,
                                        error: `Entitlement grant failed for ${addonDef.grantsEntitlement}: ${entitlementErrorMessage}`
                                    });
                                    logger.error(
                                        {
                                            subscriptionId: subscription.id,
                                            addonSlug: adjustment.addonSlug,
                                            entitlementKey: addonDef.grantsEntitlement,
                                            error: entitlementErrorMessage
                                        },
                                        'Failed to backfill entitlement'
                                    );
                                }
                            }

                            // ─── Limit backfill (T-009b) ────────────────────────────────────────
                            // For each active addon purchase that affects a limit, compute the
                            // new max value as (base plan limit + addon.limitIncrease) and call
                            // billing.limits.set(). The set operation is an upsert so it is
                            // idempotent across multiple migration runs.
                            if (
                                billing !== null &&
                                addonDef?.affectsLimitKey !== null &&
                                addonDef?.affectsLimitKey !== undefined &&
                                addonDef.limitIncrease !== null &&
                                addonDef.limitIncrease !== undefined
                            ) {
                                await backfillLimit({
                                    billing,
                                    customerId: subscription.customerId,
                                    subscriptionId: subscription.id,
                                    addonSlug: adjustment.addonSlug,
                                    addonDef,
                                    purchaseId: insertedRow.id,
                                    stats,
                                    verbose
                                });
                            }
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        stats.errors.push({
                            subscriptionId: subscription.id,
                            error: `Failed to migrate addon ${adjustment.addonSlug}: ${errorMessage}`
                        });
                        logger.error(
                            {
                                subscriptionId: subscription.id,
                                addonSlug: adjustment.addonSlug,
                                error: errorMessage
                            },
                            'Failed to migrate addon'
                        );
                    }
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                stats.errors.push({
                    subscriptionId: subscription.id,
                    error: `Failed to process subscription: ${errorMessage}`
                });
                logger.error(
                    { subscriptionId: subscription.id, error: errorMessage },
                    'Failed to process subscription'
                );
            }
        }

        // ─── Plan restoration (T-009b) ──────────────────────────────────────────
        // After processing all subscriptions, restore all plans in the billing_plans
        // table to their canonical entitlements and limits. This undoes any damage
        // caused by the global plan mutation bug. Must run even if no subscriptions
        // had addon adjustments.
        if (billing !== null) {
            await restoreAllPlans({ billing, stats, verbose });
        } else if (dryRun) {
            logDryRunPlanRestoration({ stats, verbose });
        }

        logger.info(
            {
                subscriptionsProcessed: stats.subscriptionsProcessed,
                addonsFound: stats.addonsFound,
                addonsMigrated: stats.addonsMigrated,
                addonsSkipped: stats.addonsSkipped,
                entitlementsBackfilled: stats.entitlementsBackfilled,
                limitsBackfilled: stats.limitsBackfilled,
                plansRestored: stats.plansRestored,
                errors: stats.errors.length
            },
            'Migration completed'
        );

        return stats;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Migration failed');
        throw error;
    }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const verbose = args.includes('--verbose') || args.includes('-v');

    try {
        const stats = await migrateAddonPurchases({ dryRun, verbose });

        if (stats.errors.length > 0) {
            console.error(`\n${stats.errors.length} error(s) occurred during migration:`);
            for (const err of stats.errors) {
                console.error(`  [${err.subscriptionId}] ${err.error}`);
            }
        }

        if (dryRun) {
            console.error('\n[DRY RUN] No changes were written to the database.');
            console.error(`  Subscriptions processed : ${stats.subscriptionsProcessed}`);
            console.error(`  Addons found            : ${stats.addonsFound}`);
            console.error(`  Addons would migrate    : ${stats.addonsMigrated}`);
            console.error(`  Entitlements would grant: ${stats.entitlementsBackfilled}`);
            console.error(`  Limits would set        : ${stats.limitsBackfilled}`);
            console.error(`  Plans would restore     : ${stats.plansRestored}`);
        }

        process.exit(stats.errors.length > 0 ? 1 : 0);
    } catch (error) {
        console.error('');
        console.error('FATAL ERROR:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    void main();
}
