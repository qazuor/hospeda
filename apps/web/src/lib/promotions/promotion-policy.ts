/**
 * The two catalog values every promotion text reads (HOS-2589 §7.6): the free quota
 * X (the TOURIST floor plan's `max_free_visible_promotions`) and the name of the plan
 * that makes a tourist VIP. Never a literal in code (G7).
 *
 * @module lib/promotions/promotion-policy
 */
import { EntitlementKeyEnum, LimitKeyEnum } from '@repo/schemas';
import {
    type FetchPlansResult,
    FREE_TIER_CARD_SLUG,
    planNamesWithEntitlement
} from '@/lib/billing/fetch-plans';

/** What the promotion texts need from the catalog; `null` when unreadable. */
export interface PromotionPolicy {
    readonly freeQuota: number | null;
    readonly vipPlanName: string | null;
}

/**
 * Reads the free quota and the VIP plan name from the TOURIST public catalog.
 *
 * @param input - `result`: the tourist `fetchPublicPlans` result.
 * @returns The policy; each value is `null` when the catalog does not carry it.
 */
export function readPromotionPolicy(input: { readonly result: FetchPlansResult }): PromotionPolicy {
    if (!input.result.ok) return { freeQuota: null, vipPlanName: null };
    const floor = input.result.plans.find((plan) => plan.slug === FREE_TIER_CARD_SLUG.tourist);
    const freeQuota = floor?.limits[LimitKeyEnum.MAX_FREE_VISIBLE_PROMOTIONS];
    const [vipPlanName] = planNamesWithEntitlement({
        result: input.result,
        entitlement: EntitlementKeyEnum.VIP_PROMOTIONS_ACCESS
    });
    return {
        freeQuota: typeof freeQuota === 'number' ? freeQuota : null,
        vipPlanName: vipPlanName ?? null
    };
}
