/**
 * What a purchased add-on adds to a customer's plan, as persisted on the
 * `billing_addon_purchases` row (extracted by HOS-847 PR 5).
 *
 * ## Why this is shared rather than computed at each site
 *
 * `limit_adjustments` is not a log line. Two live readers do arithmetic on it:
 *
 *  - `addon-plan-change.service.ts` SUMS `limitAdjustments[].increase` across a
 *    customer's active purchases to work out the combined limit after a plan
 *    change, and
 *  - `addon-entitlement.service.ts` reads `limitAdjustments[0]` during the
 *    grant-reconciliation sweep.
 *
 * A recurring add-on activated with the empty array PR 4 inserts would
 * therefore contribute ZERO to both — the customer pays every month and the
 * combined limit silently ignores it. So the recurring activation has to write
 * the same array the one-time confirmation writes, computed the same way, which
 * is what this module is: `confirmAddonPurchase`'s own computation, lifted out
 * unchanged so there is exactly one of it.
 *
 * @module services/addon-purchase-adjustments
 */

import type { AddonDefinition } from '@repo/billing';
import type { EntitlementAdjustment, LimitAdjustment } from '@repo/db/schemas/billing';
import type { BillingPlanResponse } from '@repo/schemas';
import { PlanService } from '@repo/service-core';

/**
 * DB-backed plan resolver, instantiated once at module scope. Stateless, holds
 * no connection.
 */
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
export async function resolvePlanByIdOrSlug(planId: string): Promise<BillingPlanResponse | null> {
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

/** What {@link computeAddonPurchaseAdjustments} returns. */
export interface AddonPurchaseAdjustments {
    readonly limitAdjustments: LimitAdjustment[];
    readonly entitlementAdjustments: EntitlementAdjustment[];
}

/**
 * Compute the limit and entitlement deltas a single add-on purchase records.
 *
 * `previousValue` is the BASE plan limit, not the customer's current effective
 * one: the arrays describe what this purchase adds on top of the plan, and
 * `addon-plan-change.service.ts` sums the `increase` of every active purchase
 * over that same base. Anchoring on a value that already included other add-ons
 * would double-count them.
 *
 * A plan that could not be resolved yields a baseline of `0` (soft-skip),
 * exactly as the one-time confirmation path has always done — `increase` is
 * what the readers use, and it is right regardless.
 *
 * @param params.addon - The catalog definition being purchased.
 * @param params.plan - The customer's base plan, or `null` when unresolvable.
 * @returns The two JSONB arrays to persist on the purchase row.
 */
export function computeAddonPurchaseAdjustments(params: {
    readonly addon: AddonDefinition;
    readonly plan: BillingPlanResponse | null;
}): AddonPurchaseAdjustments {
    const { addon, plan } = params;

    const limitAdjustments: LimitAdjustment[] = [];
    if (addon.affectsLimitKey && addon.limitIncrease) {
        const previousValue = plan?.limits[addon.affectsLimitKey] ?? 0;
        limitAdjustments.push({
            limitKey: addon.affectsLimitKey,
            increase: addon.limitIncrease,
            previousValue,
            newValue: previousValue + addon.limitIncrease
        });
    }

    const entitlementAdjustments: EntitlementAdjustment[] = [];
    if (addon.grantsEntitlement) {
        entitlementAdjustments.push({
            entitlementKey: addon.grantsEntitlement,
            granted: true
        });
    }

    return { limitAdjustments, entitlementAdjustments };
}
