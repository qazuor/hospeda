/**
 * Resolve the buyer-visible MercadoPago subscription `reason` for a plan change.
 *
 * On a plan change Hospeda passes its `billing_plans.id` (a UUID) to the qzpay
 * MercadoPago adapter's `subscriptions.update()`. Without an explicit label the
 * adapter falls back to the synthetic `"Plan updated to: ${planId}"`, so the
 * buyer sees the raw UUID as the subscription description (HOS-220). This helper
 * resolves the plan's human display name (`metadata.displayName`, falling back
 * to the slug) so the description reads e.g. `"VIP"` instead.
 *
 * @module services/billing/plan-change-reason
 */

import { getPlanById } from '../plan.service.js';

/**
 * Resolve the display-name label to use as the MercadoPago preapproval `reason`
 * for a plan change.
 *
 * @param input - Object holding the target `billing_plans.id`.
 * @returns The plan's display name, or `undefined` when the plan cannot be
 *   resolved — in which case the caller omits `reason` and the adapter keeps its
 *   `"Plan updated to: ${planId}"` fallback rather than surfacing an error.
 */
export async function resolvePlanChangeReason(input: {
    readonly planId: string;
}): Promise<string | undefined> {
    try {
        const result = await getPlanById(input.planId);
        if (result.success && result.data.name.trim().length > 0) {
            return result.data.name;
        }
    } catch {
        // Best-effort: MP `reason` is cosmetic. Fall through to the adapter's
        // synthetic fallback rather than failing the plan-change propagation.
    }
    return undefined;
}
