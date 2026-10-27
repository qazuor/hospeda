/** Pure per-card presentation of the backend-resolved pricing situation. */
import type { PricingSituationResponse, PricingSituationVertical } from '@repo/schemas';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import type { ApiResult } from '@/lib/api/types';
import type { PricingAudience } from '@/lib/billing-i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { PLAN_CHANGE_UNAVAILABLE, PLAN_CHANGE_UNAVAILABLE_KEY } from './my-subscription-notices';
import { buildSignupCheckoutHref } from './signup-checkout';

/** Backend situation vertical associated with each pricing audience. */
export const PRICING_VERTICAL_BY_AUDIENCE: Record<
    PricingAudience,
    PricingSituationVertical | null
> = {
    owner: 'accommodation',
    tourist: 'tourist',
    gastronomy: 'venue',
    experience: 'experience',
    partner: null
};

type LiveStatus = Extract<PricingSituationResponse, { situation: 'SUBSCRIBED' }>['status'];
/** Statuses whose cards show the shared unavailable plan-change notice. */
export const PRICING_PLAN_CHANGE_NOTICE: Record<LiveStatus, boolean> = {
    ACTIVE: PLAN_CHANGE_UNAVAILABLE.ACTIVE,
    GRACE_PERIOD: false,
    SUSPENDED: false,
    CANCEL_SCHEDULED: false,
    PAUSED: false,
    PENDING_AUTHORIZATION: false
};

/** Renderable action state for one card. */
export type PlanCardCtaView =
    | {
          readonly kind: 'checkout';
          readonly links: readonly {
              readonly cycle: 'monthly' | 'annual';
              readonly href: string;
              readonly resumes: boolean;
          }[];
      }
    | { readonly kind: 'current'; readonly showsPlanChangeNotice: boolean }
    | { readonly kind: 'planChangeUnavailable' }
    | { readonly kind: 'vipInherited' }
    | { readonly kind: 'none' };

type Plan = {
    readonly planVersionId: string;
    readonly billingOptions: { readonly monthly: string; readonly annual: string | null };
};
type Situation = PricingSituationResponse['situation'];

/** Whether the generic trial offer remains usable for a resolved account situation. */
export function resolvePlanCardTrialOffer({
    vertical,
    result
}: {
    readonly vertical: PricingSituationVertical;
    readonly result: ApiResult<PricingSituationResponse> | null;
}): boolean {
    if (!result?.ok) return true;

    const checkoutByVertical: Record<PricingSituationVertical, boolean> = {
        accommodation: false,
        venue: false,
        experience: false,
        tourist: true
    };
    const bySituation: Record<Situation, () => boolean> = {
        FIRST_USE: () => true,
        CHECKOUT: () => checkoutByVertical[vertical],
        TRIAL: () => false,
        SUBSCRIBED: () => false,
        COVERED: () => false,
        NO_PLANS: () => false,
        TOURIST_VIP_INHERITED: () => false
    };
    return bySituation[result.data.situation]();
}

/** Resolve one card without reproducing any backend authorization rule. */
export function resolvePlanCardCta({
    locale,
    vertical,
    plan,
    result
}: {
    readonly locale: SupportedLocale;
    readonly vertical: PricingSituationVertical;
    readonly plan: Plan;
    readonly result: ApiResult<PricingSituationResponse> | null;
}): PlanCardCtaView {
    const none: PlanCardCtaView = { kind: 'none' };
    if (!result?.ok) {
        if (result?.error.status === 401 && vertical === 'tourist') return checkout();
        return none;
    }
    const parsed = result.data;
    const bySituation: Record<Situation, () => PlanCardCtaView> = {
        CHECKOUT: () => checkout(),
        TRIAL: () => checkout(),
        FIRST_USE: () => none,
        NO_PLANS: () => none,
        COVERED: () => none,
        TOURIST_VIP_INHERITED: () => ({ kind: 'vipInherited' }),
        SUBSCRIBED: () => {
            if (parsed.situation !== 'SUBSCRIBED') return none;
            if (parsed.status === 'PENDING_AUTHORIZATION') {
                return checkout(
                    parsed.planVersionId === plan.planVersionId ? parsed.billingOptionId : undefined
                );
            }
            if (parsed.planVersionId === plan.planVersionId) {
                return {
                    kind: 'current',
                    showsPlanChangeNotice: PRICING_PLAN_CHANGE_NOTICE[parsed.status]
                };
            }
            return PRICING_PLAN_CHANGE_NOTICE[parsed.status]
                ? { kind: 'planChangeUnavailable' }
                : none;
        }
    };
    return bySituation[parsed.situation]();

    function checkout(resumeBillingOptionId?: string): PlanCardCtaView {
        const monthlyBillingOptionId = plan.billingOptions.monthly;
        const links = [
            {
                cycle: 'monthly' as const,
                href: buildSignupCheckoutHref({
                    locale,
                    billingOptionId: monthlyBillingOptionId
                }),
                resumes: monthlyBillingOptionId === resumeBillingOptionId
            },
            ...(plan.billingOptions.annual
                ? [
                      {
                          cycle: 'annual' as const,
                          href: buildSignupCheckoutHref({
                              locale,
                              billingOptionId: plan.billingOptions.annual
                          }),
                          resumes: plan.billingOptions.annual === resumeBillingOptionId
                      }
                  ]
                : [])
        ];
        return { kind: 'checkout', links };
    }
}

const situationPromises = new Map<
    PricingSituationVertical,
    Promise<ApiResult<PricingSituationResponse>>
>();
/** Load one situation promise per vertical for all cards on the page. */
export function loadPricingSituation({
    vertical
}: {
    readonly vertical: PricingSituationVertical;
}): Promise<ApiResult<PricingSituationResponse>> {
    let pending = situationPromises.get(vertical);
    if (!pending) {
        pending = billingSubscriptionApi.pricingSituation({ vertical, cookieHeader: undefined });
        situationPromises.set(vertical, pending);
    }
    return pending;
}

/** Clear memoized reads between isolated tests. */
export function resetPricingSituationCacheForTests(): void {
    situationPromises.clear();
}

export { PLAN_CHANGE_UNAVAILABLE_KEY };
