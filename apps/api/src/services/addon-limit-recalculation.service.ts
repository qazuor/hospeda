/**
 * Addon Limit Recalculation Service
 *
 * Provides the `recalculateAddonLimitsForCustomer` shared function used by:
 * - Flow B (plan change): recomputes limits after the customer switches plans
 * - AC-3.9 (individual addon cancellation): recomputes limits after a single
 *   addon is canceled, so the remaining addons are still accounted for
 *
 * This module is intentionally NOT used by Flow A (subscription cancellation),
 * which revokes all addons directly via `revokeAddonForSubscriptionCancellation`
 * in {@link ./addon-lifecycle.service}.
 *
 * @module services/addon-limit-recalculation
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getAddonBySlug, getPlanBySlug } from '@repo/billing';
import * as Sentry from '@sentry/node';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { apiLogger } from '../utils/logger.js';
import { ADDON_RECALC_SOURCE_ID } from './addon-lifecycle.constants.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * The outcome of a single limit recalculation attempt.
 */
export type RecalculationOutcome = 'success' | 'skipped' | 'failed';

/**
 * Result returned by {@link recalculateAddonLimitsForCustomer}.
 */
export interface RecalculationResult {
    /** The limit key that was (re)calculated. */
    limitKey: string;
    /**
     * The max value that was in effect before this recalculation (the base plan
     * limit). 0 when the outcome is `'failed'` and the old value could not be
     * determined.
     */
    oldMaxValue: number;
    /** The new max value set after recalculation. 0 on failure, -1 on skip. */
    newMaxValue: number;
    /** Number of active addon purchases that contributed to this limitKey. */
    addonCount: number;
    /** Whether the recalculation succeeded, was intentionally skipped, or failed. */
    outcome: RecalculationOutcome;
    /**
     * Human-readable explanation. Always present for `'skipped'` and `'failed'`
     * outcomes; absent on `'success'`.
     */
    reason?: string;
}

/**
 * Input parameters for {@link recalculateAddonLimitsForCustomer}.
 */
export interface RecalculateAddonLimitsInput {
    /** Billing customer UUID whose limits need to be recalculated. */
    customerId: string;
    /** The specific limit key to recalculate (e.g. `'max_accommodations'`). */
    limitKey: string;
    /** Initialized QZPay billing instance for subscriptions and limits APIs. */
    billing: QZPayBilling;
    /**
     * Drizzle database instance for querying `billing_addon_purchases`.
     * Typed with an open schema record to remain compatible with both the Hospeda
     * combined schema (hospeda + qzpay) and test injections, without creating a
     * hard dependency on a specific schema bundle from this service file.
     */
    db: NodePgDatabase<Record<string, unknown>>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Recomputes and re-applies the aggregated addon limit for a customer after
 * a plan change (Flow B) or individual addon cancellation (AC-3.9).
 *
 * This function is intentionally NOT used by Flow A (subscription cancellation),
 * which revokes all addons directly via `revokeAddonForSubscriptionCancellation`.
 *
 * ### Algorithm
 * 1. Query all `status = 'active'` AND `deleted_at IS NULL` addon purchases for the
 *    customer from `billing_addon_purchases`.
 * 2. Filter to purchases whose addon definition (`getAddonBySlug`) has
 *    `affectsLimitKey === limitKey`.
 * 3. Get the active subscription via `billing.subscriptions.getByCustomerId`.
 * 4. Resolve the base plan limit from the canonical plan config
 *    (`getPlanBySlug(subscription.planId)`).
 * 5. If the base plan limit is `-1` (unlimited), skip — addons cannot exceed
 *    unlimited and no QZPay call is needed.
 * 6. Sum `purchase.limitAdjustments[limitKey].increase` across all matching purchases.
 * 7. If `totalAddonIncrement > 0`: call `billing.limits.set(...)` with
 *    `newMaxValue = basePlanLimit + totalAddonIncrement`, storing the result under
 *    {@link ADDON_RECALC_SOURCE_ID}.
 * 8. If `totalAddonIncrement === 0`: call `billing.limits.removeBySource('addon',
 *    ADDON_RECALC_SOURCE_ID)` to clean up the now-stale aggregated limit.
 *
 * ### Notes
 * - The aggregated limit is always stored with {@link ADDON_RECALC_SOURCE_ID} so
 *   cleanup does not affect limits owned by other sources.
 * - This function does NOT modify `billing_addon_purchases` rows.
 * - If the plan slug is not found in the local config the function returns
 *   `outcome: 'failed'` rather than silently falling back to 0.
 *
 * @param input - Customer ID, limit key, billing client, and DB instance.
 * @returns A {@link RecalculationResult} describing what happened.
 *
 * @example
 * ```ts
 * const result = await recalculateAddonLimitsForCustomer({
 *   customerId: 'cust-uuid',
 *   limitKey: 'max_accommodations',
 *   billing,
 *   db,
 * });
 *
 * if (result.outcome === 'failed') {
 *   logger.error({ result }, 'Limit recalculation failed');
 * }
 * ```
 */
export async function recalculateAddonLimitsForCustomer(
    input: RecalculateAddonLimitsInput
): Promise<RecalculationResult> {
    const { customerId, limitKey, billing, db } = input;

    const failedResult = (reason: string): RecalculationResult => ({
        limitKey,
        oldMaxValue: 0,
        newMaxValue: 0,
        addonCount: 0,
        outcome: 'failed',
        reason
    });

    try {
        // ── Step 1: Load all active addon purchases for the customer ──────────

        // Lazy-import mirrors the pattern in addon.checkout.ts to avoid circular
        // module references at load time.
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
            { customerId, limitKey, purchaseCount: activePurchases.length },
            'Loaded active addon purchases for limit recalculation'
        );

        // ── Step 2: Filter to purchases that affect this limitKey ─────────────

        const relevantPurchases = activePurchases.filter((purchase: { addonSlug: string }) => {
            const addonDef = getAddonBySlug(purchase.addonSlug);
            return addonDef?.affectsLimitKey === limitKey;
        });

        // ── Step 3: Resolve the active subscription ───────────────────────────

        const subscriptions = await billing.subscriptions.getByCustomerId(customerId);

        if (!subscriptions || subscriptions.length === 0) {
            return failedResult('Customer has no subscriptions');
        }

        const activeSubscription = subscriptions.find(
            (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!activeSubscription) {
            return failedResult('Customer has no active or trialing subscription');
        }

        // ── Step 4: Resolve base plan limit from canonical config ─────────────

        const planDef = getPlanBySlug(activeSubscription.planId);

        if (!planDef) {
            apiLogger.error(
                { customerId, planId: activeSubscription.planId, limitKey },
                'Plan not found in canonical config during addon limit recalculation'
            );
            return failedResult(
                `Plan '${activeSubscription.planId}' not found in canonical config`
            );
        }

        const planLimitDef = planDef.limits.find((l) => l.key === limitKey);

        if (!planLimitDef) {
            // The limitKey is valid but not explicitly declared for this plan.
            // Treat the base as 0 and continue rather than failing hard, since
            // some plans intentionally omit limits that do not apply to them.
            apiLogger.warn(
                { customerId, planId: planDef.slug, limitKey },
                'limitKey not present in plan limits array; treating base value as 0'
            );
        }

        const basePlanLimit = planLimitDef?.value ?? 0;

        // ── Step 5: Skip if the plan grants unlimited ─────────────────────────

        if (basePlanLimit === -1) {
            apiLogger.info(
                { customerId, limitKey, planId: planDef.slug },
                'Base plan has unlimited for this limitKey; skipping recalculation'
            );
            return {
                limitKey,
                oldMaxValue: -1,
                newMaxValue: -1,
                addonCount: relevantPurchases.length,
                outcome: 'skipped',
                reason: 'Base plan has unlimited for this limitKey'
            };
        }

        // ── Step 6: Sum increments from all matching purchases ────────────────

        let totalAddonIncrement = 0;

        for (const purchase of relevantPurchases) {
            const adjustments: Array<{ limitKey: string; increase: number }> =
                purchase.limitAdjustments ?? [];
            const match = adjustments.find((la) => la.limitKey === limitKey);
            if (match) {
                totalAddonIncrement += match.increase;
            }
        }

        const newMaxValue = basePlanLimit + totalAddonIncrement;

        apiLogger.info(
            {
                customerId,
                limitKey,
                basePlanLimit,
                totalAddonIncrement,
                newMaxValue,
                relevantPurchaseCount: relevantPurchases.length
            },
            'Computed new max value for addon limit recalculation'
        );

        // ── Step 7 / 8: Apply or remove the aggregated limit ─────────────────

        if (totalAddonIncrement > 0) {
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
                'Updated aggregated addon limit via billing.limits.set'
            );
        } else {
            // No remaining addons contribute to this limitKey — remove the stale
            // aggregated entry so QZPay falls back to the base plan limit.
            await billing.limits.removeBySource('addon', ADDON_RECALC_SOURCE_ID);

            apiLogger.info(
                { customerId, limitKey, sourceId: ADDON_RECALC_SOURCE_ID },
                'Removed aggregated addon limit via billing.limits.removeBySource (no remaining addons)'
            );
        }

        return {
            limitKey,
            oldMaxValue: basePlanLimit,
            newMaxValue,
            addonCount: relevantPurchases.length,
            outcome: 'success'
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { error: errorMessage, customerId, limitKey },
            'Unexpected error during addon limit recalculation'
        );

        Sentry.captureException(error, {
            extra: { customerId, limitKey }
        });

        return failedResult(`Unexpected error: ${errorMessage}`);
    }
}
