/**
 * Resolve a plan's buyer-visible display name from its `billing_plans.id`.
 *
 * `billing_plans.name` stores the plan SLUG (`owner-basico`) per SPEC-168; the
 * human display name (`"Basic"`) lives in `metadata.displayName`. Service-core's
 * `getPlanById` → `mapDbToPlan` already prefers `metadata.displayName` (falling
 * back to the slug), so this helper is the single source of truth for turning a
 * plan id into a label a customer should actually see — used both as the
 * MercadoPago preapproval `reason` on a plan change (HOS-220) and as the
 * `planName` in user-facing subscription/billing notification emails (HOS-231).
 *
 * The qzpay adapter's `billing.plans.get().name` returns the RAW slug, not the
 * display name, so notification code MUST resolve labels through this helper
 * rather than reading `plan.name` off a qzpay plan object.
 *
 * @module services/billing/plan-change-reason
 */

import { getPlanById } from '../plan.service.js';

/**
 * A qzpay plan object (`billing.plans.get()` result) narrowed to the two fields
 * needed to derive its buyer-visible label.
 */
export interface PlanDisplayNameSource {
    readonly name: string;
    readonly metadata?: unknown;
}

/**
 * Resolve a plan's buyer-visible display name from an ALREADY-FETCHED qzpay plan
 * object — zero extra queries. Prefers `metadata.displayName`, falling back to
 * `name` (which is the raw slug on a qzpay plan object).
 *
 * Use this when you already hold a `billing.plans.get()` result (webhook/cron
 * paths that fetch the plan for other reasons); use {@link resolvePlanDisplayName}
 * when you only have the plan id. This is the single source of truth for the
 * "prefer displayName, fall back to slug" rule (previously duplicated as a
 * private helper in `subscription-checkout.service.ts`).
 *
 * @param plan - An already-fetched qzpay plan object.
 * @returns The display name, or the slug when no `displayName` is set.
 */
export function planDisplayNameFromPlan(plan: PlanDisplayNameSource): string {
    if (
        typeof plan.metadata === 'object' &&
        plan.metadata !== null &&
        'displayName' in plan.metadata
    ) {
        const displayName = (plan.metadata as Record<string, unknown>).displayName;
        if (typeof displayName === 'string' && displayName.trim().length > 0) {
            return displayName;
        }
    }
    return plan.name;
}

/**
 * Resolve the buyer-visible display name for a plan.
 *
 * @param input - Object holding the target `billing_plans.id`.
 * @returns The plan's display name (`metadata.displayName`, or the slug when no
 *   display name is set), or `undefined` when the plan cannot be resolved — in
 *   which case the caller decides its own fallback (omit the MP `reason`, or use
 *   a generic notification label) rather than surfacing an error.
 */
export async function resolvePlanDisplayName(input: {
    readonly planId: string;
}): Promise<string | undefined> {
    try {
        const result = await getPlanById(input.planId);
        if (result.success && result.data.name.trim().length > 0) {
            return result.data.name;
        }
    } catch {
        // Best-effort: the resolved label is cosmetic. Fall through to the
        // caller's fallback rather than failing the surrounding operation.
    }
    return undefined;
}

/**
 * Resolve the display-name label to use as the MercadoPago preapproval `reason`
 * for a plan change. A plan's MP `reason` IS its display name, so this is a
 * semantic alias of {@link resolvePlanDisplayName}: without it the qzpay adapter
 * falls back to the synthetic `"Plan updated to: ${planId}"` (raw UUID) the
 * buyer would otherwise see (HOS-220).
 *
 * @param input - Object holding the target `billing_plans.id`.
 * @returns The plan's display name, or `undefined` when the plan cannot be
 *   resolved — in which case the caller omits `reason` and the adapter keeps its
 *   `"Plan updated to: ${planId}"` fallback.
 */
export async function resolvePlanChangeReason(input: {
    readonly planId: string;
}): Promise<string | undefined> {
    return resolvePlanDisplayName(input);
}
