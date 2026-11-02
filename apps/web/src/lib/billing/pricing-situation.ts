/** Pure per-card presentation of the backend-resolved pricing situation. */
import {
    type ListingNoticesResponse,
    type PricingSituationResponse,
    type PricingSituationVertical,
    PublicationStatusEnum
} from '@repo/schemas';
import { billingSubscriptionApi, publishApi } from '@/lib/api/endpoints-protected';
import type { ApiResult } from '@/lib/api/types';
import type { PricingAudience } from '@/lib/billing-i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { PLAN_CHANGE_UNAVAILABLE, PLAN_CHANGE_UNAVAILABLE_KEY } from './my-subscription-notices';
import { buildSignupCheckoutHref } from './signup-checkout';

/** Backend situation vertical associated with each pricing audience. */
export const PRICING_VERTICAL_BY_AUDIENCE: Record<
    PricingAudience,
    PricingSituationVertical | null
> = {
    owner: 'accommodation',
    tourist: 'tourist',
    venue: 'venue',
    experience: 'experience',
    partner: null
};

/**
 * Where the host manages the listings of one vertical (HOS-1977, HOS-1998).
 * `null`: the vertical owns no listings (tourist), so there is nothing to
 * republish.
 */
const LISTINGS_PATH_BY_PRICING_VERTICAL: Record<PricingSituationVertical, string | null> = {
    accommodation: 'mi-cuenta/propiedades',
    venue: 'mi-cuenta/comercio',
    experience: 'mi-cuenta/comercio',
    tourist: null
};

/** The publish-API vertical slug of each pricing vertical, `null` for tourist. */
const PUBLISH_SLUG_BY_PRICING_VERTICAL: Record<
    PricingSituationVertical,
    'accommodation' | 'venue' | 'experience' | null
> = {
    accommodation: 'accommodation',
    venue: 'venue',
    experience: 'experience',
    tourist: null
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
    | { readonly kind: 'republish'; readonly href: string }
    | { readonly kind: 'planChangeUnavailable' }
    | { readonly kind: 'vipInherited' }
    | { readonly kind: 'none' };

type Plan = {
    readonly planVersionId: string;
    readonly billingOptions: { readonly monthly: string; readonly annual: string | null };
};
type Situation = PricingSituationResponse['situation'];

/**
 * Whether the trial line the card rendered from the catalog stays visible for
 * this account (HOS-1967).
 *
 * The card only ever renders a trial line when the public catalog's
 * `trialOffer` says the vertical offers one; this decides nothing about the
 * offer itself, only whether THIS account can still take it. It never
 * reproduces a per-vertical rule: the backend situation already encodes it.
 *
 * - An anonymous visitor (`401`) keeps the catalog offer: nothing about them is
 *   known, and the catalog read that produced the line did succeed.
 * - Any other failed read hides it: on a failed read the web promises nothing.
 * - `FIRST_USE` is the only situation in which publishing starts the trial.
 *   Every other situation, `CHECKOUT` included, charges or covers without one.
 */
export function resolvePlanCardTrialOffer({
    result
}: {
    readonly result: ApiResult<PricingSituationResponse> | null;
}): boolean {
    if (result === null) return false;
    if (!result.ok) return result.error.status === 401;

    const bySituation: Record<Situation, boolean> = {
        FIRST_USE: true,
        CHECKOUT: false,
        TRIAL: false,
        SUBSCRIBED: false,
        COVERED: false,
        NO_PLANS: false,
        TOURIST_VIP_INHERITED: false
    };
    return bySituation[result.data.situation];
}

/** Resolve one card without reproducing any backend authorization rule. */
export function resolvePlanCardCta({
    locale,
    vertical,
    plan,
    result,
    ownsBillingUnpublishedListing = false
}: {
    readonly locale: SupportedLocale;
    readonly vertical: PricingSituationVertical;
    readonly plan: Plan;
    readonly result: ApiResult<PricingSituationResponse> | null;
    /**
     * HOS-1977: the host owns a listing the system took down for billing
     * (see {@link hasBillingUnpublishedListing}). Only `FIRST_USE` reads it.
     */
    readonly ownsBillingUnpublishedListing?: boolean;
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
        // HOS-1977: an unspent trial plus a billing-unpublished listing means
        // the way out is republishing it (PB1 starts the trial). Nothing to
        // charge here, so the CTA leads to the listing card, not to checkout.
        FIRST_USE: () => {
            const listingsPath = LISTINGS_PATH_BY_PRICING_VERTICAL[vertical];
            return ownsBillingUnpublishedListing && listingsPath
                ? { kind: 'republish', href: buildUrl({ locale, path: listingsPath }) }
                : none;
        },
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
    billingUnpublishedPromises.clear();
}

export { PLAN_CHANGE_UNAVAILABLE_KEY };

/**
 * Whether the host owns at least one listing in `UNPUBLISHED_BY_BILLING`, read
 * from `GET /protected/publish/listing-notices/{vertical}` (HOS-1977). A failed
 * or malformed read is `false`: the plans page promises nothing it could not
 * confirm.
 */
export function hasBillingUnpublishedListing({
    result
}: {
    readonly result: ApiResult<ListingNoticesResponse>;
}): boolean {
    if (!result.ok || !Array.isArray(result.data?.items)) return false;
    return result.data.items.some(
        (item) => item.publicationStatus === PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    );
}

const billingUnpublishedPromises = new Map<PricingSituationVertical, Promise<boolean>>();
/** Load, once per vertical for all cards on the page, whether the host owns a billing-unpublished listing. */
export function loadBillingUnpublishedListing({
    vertical
}: {
    readonly vertical: PricingSituationVertical;
}): Promise<boolean> {
    let pending = billingUnpublishedPromises.get(vertical);
    if (!pending) {
        const slug = PUBLISH_SLUG_BY_PRICING_VERTICAL[vertical];
        pending = slug
            ? publishApi
                  .listingNotices({ vertical: slug, cookieHeader: undefined })
                  .then((result) => hasBillingUnpublishedListing({ result }))
                  .catch(() => {
                      // A rejected read is not cached: the next card retries.
                      billingUnpublishedPromises.delete(vertical);
                      return false;
                  })
            : Promise.resolve(false);
        billingUnpublishedPromises.set(vertical, pending);
    }
    return pending;
}
