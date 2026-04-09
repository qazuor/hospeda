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
import { getAddonBySlug, getPlanBySlug } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { ADDON_RECALC_SOURCE_ID } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';
import { detectAndNotifyDowngrades } from './addon-downgrade-detection.service.js';
import type { RecalculationResult } from './addon-limit-recalculation.service.js';
import {
    computeDirection,
    hashCustomerId,
    resolvePlanBaseLimit,
    sumIncrements
} from './addon-plan-change.helpers.js';

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
 * 2. Resolves each purchase's addon definition via `getAddonBySlug`.
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
    const { customerId, oldPlanId, newPlanId, billing, db } = input;

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
    if (lastRecalc !== undefined && Date.now() - lastRecalc < DEDUP_WINDOW_MS) {
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

    // ── Step 0c: Per-customer advisory lock (GAP-043-035) ─────────────────────
    // Prevents concurrent recalculations for the same customer from racing.
    const lockId = hashCustomerId(customerId);
    await db.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

    // ── Step 1: Load all active addon purchases for the customer ──────────────

    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

    const activePurchases = await db
        .select()
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

    // ── Step 2 & 3: Resolve addon defs, filter to limit-type only ─────────────

    type PurchaseRow = (typeof activePurchases)[number];

    interface LimitAddon {
        purchase: PurchaseRow;
        limitKey: string;
    }

    const limitAddons: LimitAddon[] = [];

    for (const purchase of activePurchases) {
        const addonDef = getAddonBySlug(purchase.addonSlug);

        if (!addonDef) {
            apiLogger.warn(
                { customerId, addonSlug: purchase.addonSlug, purchaseId: purchase.id },
                'Addon definition not found during plan-change recalculation; skipping purchase'
            );
            continue;
        }

        if (!addonDef.affectsLimitKey) {
            // Entitlement-type addon — not affected by plan limit changes
            continue;
        }

        limitAddons.push({ purchase, limitKey: addonDef.affectsLimitKey });
    }

    // ── Step 4: Early exit when no limit-type addons are active ───────────────

    if (limitAddons.length === 0) {
        apiLogger.debug(
            { customerId, oldPlanId, newPlanId },
            'No active limit addons for customer, skipping plan-change recalculation'
        );

        clearEntitlementCache(customerId);

        return {
            customerId,
            oldPlanId,
            newPlanId,
            recalculations: [],
            direction: computeDirection([], oldPlanId, newPlanId)
        };
    }

    // ── Step 5: Group purchases by limitKey ────────────────────────────────────

    const byLimitKey = new Map<string, PurchaseRow[]>();

    for (const { purchase, limitKey } of limitAddons) {
        const group = byLimitKey.get(limitKey) ?? [];
        group.push(purchase);
        byLimitKey.set(limitKey, group);
    }

    const affectedLimitKeys = [...byLimitKey.keys()] as readonly string[];

    // ── Step 6: Validate new plan exists in canonical config ──────────────────

    const newPlanDef = getPlanBySlug(newPlanId);

    if (!newPlanDef) {
        apiLogger.error(
            { customerId, newPlanId },
            'New plan not found in canonical config during plan-change recalculation'
        );
        Sentry.captureMessage(
            `Plan '${newPlanId}' not found in canonical config during plan-change recalculation`,
            {
                level: 'error',
                tags: { subsystem: 'billing-addon-lifecycle', action: 'plan-change-recalc' },
                extra: { customerId, oldPlanId, newPlanId }
            }
        );

        return {
            customerId,
            oldPlanId,
            newPlanId,
            recalculations: affectedLimitKeys.map((limitKey) => ({
                limitKey,
                oldMaxValue: 0,
                newMaxValue: 0,
                addonCount: byLimitKey.get(limitKey)?.length ?? 0,
                outcome: 'failed' as const,
                reason: `New plan '${newPlanId}' not found in canonical config`
            })),
            direction: 'lateral'
        };
    }

    // ── Step 7: Process each limitKey group ───────────────────────────────────

    const recalculations: RecalculationResult[] = [];

    for (const [limitKey, purchases] of byLimitKey) {
        const planLimitDef = newPlanDef.limits.find((l) => l.key === limitKey);

        // AC-3.6: limitKey not in new plan's limits array
        if (!planLimitDef) {
            apiLogger.warn(
                { customerId, newPlanId, limitKey },
                'limitKey not present in new plan limits array; treating new base as 0'
            );
            Sentry.captureMessage(
                `limitKey '${limitKey}' not found in plan '${newPlanId}' during plan-change recalculation`,
                {
                    level: 'warning',
                    tags: { subsystem: 'billing-addon-lifecycle', action: 'plan-change-recalc' },
                    extra: { customerId, oldPlanId, newPlanId, limitKey }
                }
            );
        }

        const newBasePlanLimit = planLimitDef?.value ?? 0;

        // AC-3.5: new plan has unlimited for this key — skip
        if (newBasePlanLimit === -1) {
            apiLogger.debug(
                { customerId, newPlanId, limitKey },
                'New plan has unlimited for limitKey; skipping recalculation for this key'
            );

            const oldBasePlanLimit = resolvePlanBaseLimit(oldPlanId, limitKey);
            const totalAddonIncrement = sumIncrements(purchases, limitKey);

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
        const totalAddonIncrement = sumIncrements(purchases, limitKey);
        const newMaxValue = newBasePlanLimit + totalAddonIncrement;

        // Compute old max value for T-011 downgrade detection
        const oldBasePlanLimit = resolvePlanBaseLimit(oldPlanId, limitKey);
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

        // Apply the recalculated limit via QZPay
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
                tags: { subsystem: 'billing-addon-lifecycle', action: 'plan-change-recalc-set' },
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

    // ── Step 8: Downgrade detection and notification dispatch (AC-4.1–4.4) ────
    await detectAndNotifyDowngrades({ customerId, recalculations, billing, newPlanDef });

    // ── Step 9: Clear entitlement cache ───────────────────────────────────────

    clearEntitlementCache(customerId);

    // ── Step 9b: Mark recalculation timestamp for dedup guard (GAP-043-014) ───
    recentRecalculations.set(customerId, Date.now());

    // ── Step 10: Summary audit log ────────────────────────────────────────────

    const direction = computeDirection(affectedLimitKeys, oldPlanId, newPlanId);
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
