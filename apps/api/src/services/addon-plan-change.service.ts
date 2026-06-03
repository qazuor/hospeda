/**
 * Addon Plan Change Service
 *
 * Orchestrates addon limit recalculation for ALL limit keys affected by active
 * addon purchases when a customer changes plan (Flow B). Unlike
 * `recalculateAddonLimitsForCustomer` (which handles a single `limitKey` and
 * resolves the base plan from the customer's active QZPay subscription), this
 * function accepts the old and new plan slugs explicitly — because at the time
 * of the call the subscription in QZPay may already reflect the new plan or may
 * not yet, depending on when the webhook fires.
 *
 * ### What this module does
 * - Recalculates addon limit contributions for all affected limit keys.
 * - Detects per-limit downgrades (AC-4.1 through AC-4.4) and dispatches
 *   `PLAN_DOWNGRADE_LIMIT_WARNING` notifications when current usage exceeds
 *   the new combined limit (fire-and-forget, non-blocking).
 * - Reports downgrade limit violations to Sentry via `captureMessage`.
 *
 * ### What this module does NOT do
 * - It does NOT update `billing_addon_purchases` rows.
 * - It does NOT modify the subscription in QZPay.
 *
 * @module services/addon-plan-change
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { DrizzleClient } from '@repo/db';
import type { BillingPlanResponse } from '@repo/schemas';
import {
    ADDON_RECALC_SOURCE_ID,
    AddonCatalogService,
    BILLING_EVENT_TYPES,
    PlanService,
    withServiceTransaction
} from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';
import { detectAndNotifyDowngrades } from './addon-downgrade-detection.service.js';
import type { RecalculationResult } from './addon-limit-recalculation.service.js';
import { computeDirection, hashCustomerId, sumIncrements } from './addon-plan-change.helpers.js';

// ─── Catalog service (DB-backed addon reads — SPEC-192 T-013) ─────────────────
// Instantiated once at module level; stateless, no DB connection held.
const catalogService = new AddonCatalogService();

// ─── Plan service (DB-backed plan reads — SPEC-192 T-026) ─────────────────────
// Instantiated once at module level; stateless, no DB connection held.
//
// Post-SPEC-168, `planId` may be a `billing_plans` UUID (new rows) or a
// legacy slug (older rows/seeds). Use `resolvePlanByIdOrSlug` for dual-resolve.
const planService = new PlanService();

/**
 * Resolves a billing plan from the DB using dual-resolve:
 * 1. Try `getById(planId)` — succeeds for UUID planIds.
 * 2. On NOT_FOUND, fall back to `getBySlug(planId)` — handles slug planIds.
 *
 * Returns `null` if neither lookup succeeds.
 *
 * @param planId - UUID or slug of the billing plan
 * @returns Resolved plan or `null` when not found
 */
async function resolvePlanByIdOrSlug(planId: string): Promise<BillingPlanResponse | null> {
    const byId = await planService.getById(planId);
    if (byId.success) {
        return byId.data;
    }
    const bySlug = await planService.getBySlug(planId);
    if (bySlug.success) {
        return bySlug.data;
    }
    return null;
}

// ─── Dedup guard (GAP-043-014) ────────────────────────────────────────────────

/**
 * In-memory map tracking the timestamp of the last successful plan-change
 * recalculation per customer. Used to deduplicate rapid back-to-back calls
 * (e.g. two webhook deliveries for the same event) within a 5-minute window.
 *
 * Process-local only — restarts clear the map, which is acceptable since the
 * 5-minute window is much shorter than typical restart intervals.
 */
const recentRecalculations = new Map<string, number>();

/** Window in ms within which a second recalculation for the same customer is suppressed. */
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * The direction of a plan change relative to a specific limit key.
 *
 * - `'upgrade'`: new plan's base limit is strictly higher than old plan's
 * - `'downgrade'`: new plan's base limit is strictly lower than old plan's
 * - `'lateral'`: both plans have the same base limit for this key (or both
 *   unlimited, or the key does not exist in either plan)
 */
export type PlanChangeDirection = 'upgrade' | 'downgrade' | 'lateral';

/**
 * Result of the full plan-change recalculation across all affected limit keys.
 */
export interface PlanChangeRecalculationResult {
    /** Billing customer UUID that was processed. */
    customerId: string;
    /** Slug of the plan the customer is leaving. */
    oldPlanId: string;
    /** Slug of the plan the customer is moving to. */
    newPlanId: string;
    /**
     * One {@link RecalculationResult} per unique limit key that had at least one
     * active limit-type addon purchase. Empty when no limit addons are active.
     */
    recalculations: RecalculationResult[];
    /**
     * Overall direction of the plan change, determined by comparing the total
     * base limit capacity across all affected limit keys between old and new plan.
     *
     * Computed as: if `sum(newPlanBaseLimits) > sum(oldPlanBaseLimits)` → upgrade,
     * if less → downgrade, otherwise lateral.
     *
     * Note: unlimited (-1) values are excluded from the sum.
     */
    direction: PlanChangeDirection;
}

/**
 * Input parameters for {@link handlePlanChangeAddonRecalculation}.
 */
export interface PlanChangeRecalculationInput {
    /** Billing customer UUID whose active addons need recalculation. */
    customerId: string;
    /**
     * Plan slug the customer is leaving (e.g. `'owner-basico'`).
     * Used to compute `oldMaxValue` per limit key for T-011 downgrade detection.
     */
    oldPlanId: string;
    /**
     * Plan slug the customer is moving to (e.g. `'owner-pro'`).
     * Used to resolve the new base limit for each affected limit key.
     */
    newPlanId: string;
    /** Initialized QZPay billing instance. */
    billing: QZPayBilling;
    /**
     * Drizzle database instance for querying `billing_addon_purchases`.
     */
    db: DrizzleClient;
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Recalculates addon limit contributions for ALL limit keys affected by a
 * customer's active addon purchases after a plan change (Flow B).
 *
 * This function is the orchestrating entry point for Flow B. It:
 * 1. Queries all `status = 'active' AND deleted_at IS NULL` addon purchases for
 *    the customer.
 * 2. Resolves each purchase's addon definition via `AddonCatalogService.getBySlug` (DB-backed, SPEC-192 T-013).
 * 3. Filters to limit-type addons only (`addon.affectsLimitKey != null`).
 * 4. Groups purchases by `limitKey`.
 * 5. For each unique `limitKey`:
 *    - Resolves the new plan's base limit from canonical config.
 *    - If unlimited (-1): skips the key (no addon can exceed unlimited).
 *    - If plan or key is missing in config: logs + Sentry + skips, collecting
 *      the error without blocking remaining keys.
 *    - Sums `purchase.limitAdjustments[limitKey].increase` across the group.
 *    - Calls `billing.limits.set(...)` with `newMaxValue = base + totalIncrement`.
 * 6. Detects downgrades (AC-4.1–4.4): delegates to {@link detectAndNotifyDowngrades}.
 * 7. Clears the entitlement cache for the customer.
 * 8. Returns a summary with per-key results and the overall change direction.
 *
 * ### Design note
 * Unlike `recalculateAddonLimitsForCustomer`, this function does NOT resolve the
 * plan from the QZPay subscription — it accepts the plan slugs explicitly because
 * the QZPay subscription may already reflect the new plan by the time this runs.
 *
 * @param input - Customer ID, old/new plan slugs, billing client, and DB instance.
 * @returns A {@link PlanChangeRecalculationResult} with per-key outcomes.
 *
 * @example
 * ```ts
 * const result = await handlePlanChangeAddonRecalculation({
 *   customerId: 'cust-uuid',
 *   oldPlanId: 'owner-pro',
 *   newPlanId: 'owner-basico',
 *   billing,
 *   db,
 * });
 * // Downgrade warnings (if any) were already dispatched inside this call.
 * ```
 */
export async function handlePlanChangeAddonRecalculation(
    input: PlanChangeRecalculationInput
): Promise<PlanChangeRecalculationResult> {
    const { customerId, oldPlanId, newPlanId, billing } = input;

    // Capture a single reference timestamp for the entire invocation.
    // This prevents subtle bugs where multiple Date.now() calls within the same
    // execution path return slightly different values if the function takes time.
    const nowMs = Date.now();

    // ── Step 0: Feature flag guard ────────────────────────────────────────────
    const addonLifecycleEnabled = env.HOSPEDA_ADDON_LIFECYCLE_ENABLED;
    if (!addonLifecycleEnabled) {
        apiLogger.info(
            { customerId, oldPlanId, newPlanId },
            'Addon lifecycle processing disabled via HOSPEDA_ADDON_LIFECYCLE_ENABLED'
        );
        return {
            customerId,
            oldPlanId,
            newPlanId,
            recalculations: [],
            direction: 'lateral'
        };
    }

    // ── Step 0b: Dedup guard (GAP-043-014) ────────────────────────────────────
    // Suppress duplicate recalculations triggered within a 5-minute window for
    // the same customer (e.g. two webhook deliveries for the same plan change).
    const lastRecalc = recentRecalculations.get(customerId);
    if (lastRecalc !== undefined && nowMs - lastRecalc < DEDUP_WINDOW_MS) {
        apiLogger.info(
            { customerId, oldPlanId, newPlanId },
            'Skipping duplicate plan-change recalculation (within 5-minute dedup window)'
        );
        return {
            customerId,
            oldPlanId,
            newPlanId,
            recalculations: [],
            direction: 'lateral'
        };
    }

    // ── Pre-Phase 1: Resolve plan definitions via PlanService (DB-backed, T-026) ──
    // Both oldPlanId and newPlanId may be UUIDs (new rows) or slugs (legacy rows).
    // Resolve both before entering the transaction so the advisory lock is not held
    // during async PlanService calls. `newPlanDef` is required to continue;
    // `oldPlanDef` is best-effort (used for direction/downgrade computation only).
    const newPlanDef = await resolvePlanByIdOrSlug(newPlanId);
    const oldPlanDef = await resolvePlanByIdOrSlug(oldPlanId);

    // Limits maps for direction/base-limit computation in Phase-2.
    // Empty maps are safe: resolvePlanBaseLimit returns 0 for missing keys.
    const newPlanLimits: Readonly<Record<string, number>> = newPlanDef?.limits ?? {};
    const oldPlanLimits: Readonly<Record<string, number>> = oldPlanDef?.limits ?? {};

    // ── Phase 1: Read data inside a transaction (with advisory lock + dedup) ─────
    // All DB reads happen here. The transaction commits at the end of this block,
    // releasing the advisory lock. QZPay calls happen OUTSIDE any open transaction
    // to avoid holding DB locks during slow external HTTP round-trips.

    /** Minimal purchase row shape needed for limit recalculation. */
    type PurchaseRecord = {
        id: string;
        addonSlug: string;
        limitAdjustments: Array<{ limitKey: string; increase: number }> | null | undefined;
    };

    type PlanChangeData =
        | {
              earlyReturn: PlanChangeRecalculationResult;
          }
        | {
              byLimitKey: Map<string, PurchaseRecord[]>;
              affectedLimitKeys: readonly string[];
              subscriptionId: string | undefined;
          };

    const phase1 = await withServiceTransaction(async (ctx) => {
        // ── Step 0c: Per-customer advisory lock (GAP-043-035) ─────────────────
        const lockId = hashCustomerId(customerId);
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        await ctx.tx!.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

        // ── Step 0d: DB-backed dedup check ────────────────────────────────────
        const { billingSubscriptionEvents, billingSubscriptions } = await import('@repo/db');

        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const recentRecalc = await ctx
            .tx!.select({ id: billingSubscriptionEvents.id })
            .from(billingSubscriptionEvents)
            .innerJoin(
                billingSubscriptions,
                eq(billingSubscriptionEvents.subscriptionId, billingSubscriptions.id)
            )
            .where(
                and(
                    eq(billingSubscriptions.customerId, customerId),
                    eq(
                        billingSubscriptionEvents.eventType,
                        BILLING_EVENT_TYPES.ADDON_RECALC_COMPLETED
                    ),
                    gte(billingSubscriptionEvents.createdAt, new Date(nowMs - DEDUP_WINDOW_MS))
                )
            )
            .limit(1);

        if (recentRecalc.length > 0) {
            apiLogger.info(
                { customerId, oldPlanId, newPlanId },
                'Skipping duplicate plan-change recalculation (DB dedup: ADDON_RECALC_COMPLETED within 5-minute window)'
            );
            const result: PlanChangeData = {
                earlyReturn: {
                    customerId,
                    oldPlanId,
                    newPlanId,
                    recalculations: [],
                    direction: 'lateral'
                }
            };
            return result;
        }

        // ── Step 1: Load all active addon purchases for the customer ──────────
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const activePurchases = await ctx
            .tx!.select()
            .from(billingAddonPurchases)
            .where(
                and(
                    eq(billingAddonPurchases.customerId, customerId),
                    eq(billingAddonPurchases.status, 'active'),
                    isNull(billingAddonPurchases.deletedAt)
                )
            );

        apiLogger.info(
            { customerId, oldPlanId, newPlanId, purchaseCount: activePurchases.length },
            'Loaded active addon purchases for plan-change recalculation'
        );

        // ── Steps 2 & 3: Resolve addon defs, filter to limit-type only ────────
        type PurchaseRow = (typeof activePurchases)[number];

        interface LimitAddon {
            purchase: PurchaseRow;
            limitKey: string;
        }

        const limitAddons: LimitAddon[] = [];

        for (const purchase of activePurchases) {
            // SPEC-192 T-013: resolve addon definition from DB-backed catalog.
            // Preserves original skip-and-log semantics on not-found/error.
            const catalogResult = await catalogService.getBySlug(purchase.addonSlug);

            if (!catalogResult.success) {
                apiLogger.warn(
                    { customerId, addonSlug: purchase.addonSlug, purchaseId: purchase.id },
                    'Addon definition not found during plan-change recalculation; skipping purchase'
                );
                continue;
            }

            const addonDef = catalogResult.data;

            if (!addonDef.affectsLimitKey) {
                continue;
            }

            limitAddons.push({ purchase, limitKey: addonDef.affectsLimitKey });
        }

        // ── Step 4: Early exit when no limit-type addons are active ──────────
        if (limitAddons.length === 0) {
            apiLogger.debug(
                { customerId, oldPlanId, newPlanId },
                'No active limit addons for customer, skipping plan-change recalculation'
            );
            const result: PlanChangeData = {
                earlyReturn: {
                    customerId,
                    oldPlanId,
                    newPlanId,
                    recalculations: [],
                    direction: computeDirection([], oldPlanLimits, newPlanLimits)
                }
            };
            return result;
        }

        // ── Step 5: Group purchases by limitKey ───────────────────────────────
        const byLimitKey = new Map<string, PurchaseRow[]>();

        for (const { purchase, limitKey } of limitAddons) {
            const group = byLimitKey.get(limitKey) ?? [];
            group.push(purchase);
            byLimitKey.set(limitKey, group);
        }

        const affectedLimitKeys = [...byLimitKey.keys()] as readonly string[];

        // ── Step 6: Validate new plan was resolved (DB-backed, SPEC-192 T-026) ──
        // `newPlanDef` was resolved before Phase-1 via PlanService dual-resolve.
        // If it is null the plan is genuinely absent from the DB — treat as fatal.
        if (!newPlanDef) {
            apiLogger.error(
                { customerId, newPlanId },
                'New plan not found in DB during plan-change recalculation (tried getById + getBySlug)'
            );
            Sentry.captureMessage(
                `Plan '${newPlanId}' not found in DB during plan-change recalculation`,
                {
                    level: 'error',
                    tags: { subsystem: 'billing-addon-lifecycle', action: 'plan-change-recalc' },
                    extra: { customerId, oldPlanId, newPlanId }
                }
            );
            const result: PlanChangeData = {
                earlyReturn: {
                    customerId,
                    oldPlanId,
                    newPlanId,
                    recalculations: affectedLimitKeys.map((limitKey) => ({
                        limitKey,
                        oldMaxValue: 0,
                        newMaxValue: 0,
                        addonCount: byLimitKey.get(limitKey)?.length ?? 0,
                        outcome: 'failed' as const,
                        reason: `New plan '${newPlanId}' not found in DB`
                    })),
                    direction: 'lateral'
                }
            };
            return result;
        }

        // ── Pre-fetch subscriptionId for dedup event write (Phase 3) ─────────
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const activeSubRows = await ctx
            .tx!.select({ id: billingSubscriptions.id })
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.customerId, customerId),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .limit(1);

        // Map full drizzle rows to the minimal PurchaseRecord shape needed outside
        const purchaseRecordMap = new Map<string, PurchaseRecord[]>();
        for (const [limitKey, purchases] of byLimitKey) {
            purchaseRecordMap.set(
                limitKey,
                purchases.map((p) => ({
                    id: p.id,
                    addonSlug: p.addonSlug,
                    limitAdjustments: Array.isArray(p.limitAdjustments)
                        ? (p.limitAdjustments as Array<{ limitKey: string; increase: number }>)
                        : null
                }))
            );
        }

        const result: PlanChangeData = {
            byLimitKey: purchaseRecordMap,
            affectedLimitKeys,
            subscriptionId: activeSubRows[0]?.id
        };
        return result;
    });

    // Early return if phase 1 decided we should stop
    if ('earlyReturn' in phase1) {
        if (
            'recalculations' in phase1.earlyReturn &&
            phase1.earlyReturn.recalculations.length === 0
        ) {
            clearEntitlementCache(customerId);
        }
        return phase1.earlyReturn;
    }

    const { byLimitKey, affectedLimitKeys, subscriptionId } = phase1;

    // ── Phase 2: QZPay calls — OUTSIDE any open transaction ──────────────────
    // Calling billing.limits.set() while holding a DB transaction is hazardous:
    // - If QZPay is slow the DB transaction holds row-level locks for the full
    //   duration, blocking concurrent readers/writers.
    // - If QZPay succeeds but the DB tx later rolls back, the external state is
    //   mutated with no compensating action.
    // By calling QZPay here (after the Phase 1 tx committed) we eliminate both
    // risks. The dedup event is written in Phase 3 after QZPay completes.

    const recalculations: RecalculationResult[] = [];

    for (const [limitKey, purchases] of byLimitKey) {
        // ── Resolve new plan base limit from pre-fetched DB limits map (T-026) ──
        // `newPlanLimits` is a `Record<string,number>` from PlanService (DB shape).
        // A missing key is treated as 0 (same semantics as the old config path).
        const newBasePlanLimit: number = newPlanLimits[limitKey] ?? 0;

        // AC-3.6: limitKey not in new plan's limits map (treated as 0)
        if (!(limitKey in newPlanLimits)) {
            apiLogger.warn(
                { customerId, newPlanId, limitKey },
                'limitKey not present in new plan limits map (DB); treating new base as 0'
            );
            Sentry.captureMessage(
                `limitKey '${limitKey}' not found in plan '${newPlanId}' limits map during plan-change recalculation`,
                {
                    level: 'warning',
                    tags: {
                        subsystem: 'billing-addon-lifecycle',
                        action: 'plan-change-recalc'
                    },
                    extra: { customerId, oldPlanId, newPlanId, limitKey }
                }
            );
        }

        // AC-3.5: new plan has unlimited for this key — skip
        if (newBasePlanLimit === -1) {
            apiLogger.debug(
                { customerId, newPlanId, limitKey },
                'New plan has unlimited for limitKey; skipping recalculation for this key'
            );

            // Use pre-fetched old plan limits (DB-backed, T-026)
            const oldBasePlanLimit: number = oldPlanLimits[limitKey] ?? 0;
            const totalAddonIncrement = sumIncrements(purchases as PurchaseRecord[], limitKey);

            recalculations.push({
                limitKey,
                oldMaxValue: oldBasePlanLimit === -1 ? -1 : oldBasePlanLimit + totalAddonIncrement,
                newMaxValue: -1,
                addonCount: purchases.length,
                outcome: 'skipped',
                reason: 'New plan has unlimited for this limitKey'
            });
            continue;
        }

        // Sum increments from all purchases in this group
        const totalAddonIncrement = sumIncrements(purchases as PurchaseRecord[], limitKey);
        const newMaxValue = newBasePlanLimit + totalAddonIncrement;

        // Compute old max value for T-011 downgrade detection (DB-backed, T-026)
        const oldBasePlanLimit: number = oldPlanLimits[limitKey] ?? 0;
        const oldMaxValue = oldBasePlanLimit === -1 ? -1 : oldBasePlanLimit + totalAddonIncrement;

        apiLogger.info(
            {
                customerId,
                limitKey,
                oldBasePlanLimit,
                newBasePlanLimit,
                totalAddonIncrement,
                oldMaxValue,
                newMaxValue,
                purchaseCount: purchases.length
            },
            'Computed new max value for plan-change addon limit recalculation'
        );

        // Apply the recalculated limit via QZPay — outside any DB transaction
        try {
            await billing.limits.set({
                customerId,
                limitKey,
                maxValue: newMaxValue,
                source: 'addon',
                sourceId: ADDON_RECALC_SOURCE_ID
            });

            apiLogger.info(
                {
                    customerId,
                    limitKey,
                    newMaxValue,
                    sourceId: ADDON_RECALC_SOURCE_ID
                },
                'Updated aggregated addon limit via billing.limits.set for plan change'
            );

            recalculations.push({
                limitKey,
                oldMaxValue,
                newMaxValue,
                addonCount: purchases.length,
                outcome: 'success'
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            apiLogger.error(
                { customerId, limitKey, newMaxValue, error: errorMessage },
                'Failed to apply recalculated addon limit during plan change'
            );

            Sentry.captureException(err, {
                tags: {
                    subsystem: 'billing-addon-lifecycle',
                    action: 'plan-change-recalc-set'
                },
                extra: { customerId, oldPlanId, newPlanId, limitKey, newMaxValue }
            });

            recalculations.push({
                limitKey,
                oldMaxValue,
                newMaxValue: 0,
                addonCount: purchases.length,
                outcome: 'failed',
                reason: `billing.limits.set failed: ${errorMessage}`
            });
            // Failure in one limitKey does NOT block others — continue
        }
    }

    // ── Step 8: Downgrade detection and notification dispatch (AC-4.1–4.4) ──
    // `newPlanDef` is now BillingPlanResponse (DB-backed, T-026). Cast to the
    // shape that detectAndNotifyDowngrades expects — it only reads `.name`,
    // which both PlanDefinition and BillingPlanResponse have.
    // biome-ignore lint/suspicious/noExplicitAny: cross-package shape cast (name field compatible)
    await detectAndNotifyDowngrades({
        customerId,
        recalculations,
        billing,
        newPlanDef: newPlanDef as any
    });

    // ── Step 9: Clear entitlement cache ──────────────────────────────────────
    clearEntitlementCache(customerId);

    // ── Step 9b: Mark recalculation timestamp for dedup guard (GAP-043-014) ─
    recentRecalculations.set(customerId, nowMs);

    // ── Phase 3: Write dedup event in a new transaction ──────────────────────
    // Opens a fresh transaction only to record the ADDON_RECALC_COMPLETED event.
    // Keeping this separate from Phase 1 ensures the dedup write reflects the
    // actual QZPay outcome (Phase 2) rather than pre-committing before the
    // external call.
    await withServiceTransaction(async (ctx) => {
        const { billingSubscriptionEvents } = await import('@repo/db');

        if (subscriptionId) {
            // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
            await ctx.tx!.insert(billingSubscriptionEvents).values({
                subscriptionId,
                eventType: BILLING_EVENT_TYPES.ADDON_RECALC_COMPLETED,
                triggerSource: 'addon-plan-change',
                metadata: {
                    oldPlanId,
                    newPlanId,
                    limits: recalculations,
                    customerId,
                    timestamp: new Date().toISOString()
                }
            });

            apiLogger.debug(
                { customerId, subscriptionId },
                'Wrote ADDON_RECALC_COMPLETED dedup event to billing_subscription_events'
            );
        } else {
            apiLogger.warn(
                { customerId, oldPlanId, newPlanId },
                'No active subscription found for customer — dedup event not written to DB'
            );
        }
    });

    // ── Step 10: Summary audit log ────────────────────────────────────────────
    // Pass pre-resolved limits maps to computeDirection (DB-backed, T-026)
    const direction = computeDirection(affectedLimitKeys, oldPlanLimits, newPlanLimits);
    const successCount = recalculations.filter((r) => r.outcome === 'success').length;
    const failedCount = recalculations.filter((r) => r.outcome === 'failed').length;
    const skippedCount = recalculations.filter((r) => r.outcome === 'skipped').length;

    apiLogger.info(
        {
            eventType: 'plan_changed',
            customerId,
            oldPlanId,
            newPlanId,
            direction,
            limitKeysProcessed: affectedLimitKeys.length,
            successCount,
            failedCount,
            skippedCount
        },
        'Plan-change addon recalculation complete'
    );

    return {
        customerId,
        oldPlanId,
        newPlanId,
        recalculations,
        direction
    };
}
