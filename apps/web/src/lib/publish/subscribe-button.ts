import { NO_PLANS_AVAILABLE_MESSAGE } from '@repo/schemas';
import type {
    PublishVerticalSlug,
    SubscribeDestinationResponse
} from '@/lib/api/endpoints-protected';
import type { ApiResult } from '@/lib/api/types';
import type { PricingAudience } from '@/lib/billing-i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { PUBLISH_PAGE_PATH_BY_VERTICAL } from './publish-page-paths';

export { NO_PLANS_AVAILABLE_MESSAGE };

export const SUBSCRIBE_VERTICAL_BY_AUDIENCE: Record<PricingAudience, PublishVerticalSlug | null> = {
    owner: 'accommodation',
    gastronomy: 'gastronomy',
    experience: 'experience',
    tourist: null,
    partner: null
};

export type SubscribeButtonView =
    | { readonly kind: 'publish'; readonly href: string; readonly trialDays: number }
    | { readonly kind: 'checkout' }
    | { readonly kind: 'covered' }
    | { readonly kind: 'noPlans' }
    | { readonly kind: 'signedOut'; readonly href: string }
    | { readonly kind: 'hidden' };

export function resolveSubscribeButtonView({
    locale,
    vertical,
    result
}: {
    readonly locale: SupportedLocale;
    readonly vertical: PublishVerticalSlug;
    readonly result: ApiResult<SubscribeDestinationResponse>;
}): SubscribeButtonView {
    const publishHref = buildUrl({ locale, path: PUBLISH_PAGE_PATH_BY_VERTICAL[vertical] });
    if (!result.ok) {
        if (result.error.status === 401) {
            return {
                kind: 'signedOut',
                href: `${buildUrl({ locale, path: 'auth/signup' })}?returnUrl=${encodeURIComponent(publishHref)}`
            };
        }
        return { kind: 'hidden' };
    }

    type Destination = SubscribeDestinationResponse['destination'];
    type DestinationHandlers = {
        readonly [Key in Destination]: (
            data: Extract<SubscribeDestinationResponse, { readonly destination: Key }>
        ) => SubscribeButtonView;
    };
    const destinations: DestinationHandlers = {
        PUBLISH: (data) =>
            Number.isInteger(data.trialDays) && data.trialDays > 0
                ? { kind: 'publish', href: publishHref, trialDays: data.trialDays }
                : { kind: 'hidden' },
        CHECKOUT: () => ({ kind: 'checkout' }),
        NO_PLANS_AVAILABLE: () => ({ kind: 'noPlans' }),
        COVERED: () => ({ kind: 'covered' })
    };
    const handler = destinations[result.data?.destination];
    if (!handler) return { kind: 'hidden' };
    return handler(result.data as never);
}

/**
 * What the "Publish" affordance of the host's property card (and the editor's
 * publish-ready dialog) may offer, derived from the SAME decision the server
 * uses when it rejects a publish: `GET /protected/publish/subscribe-destination/{vertical}`
 * (`resolveSubscribeDestination`, consulted by PB1 and `listing-access`).
 *
 * Discriminated by `kind`:
 * - `publish`: not covered, but publishing starts the owner's trial (`trialDays` > 0).
 * - `covered`: the owner is covered; publishing starts no trial.
 * - `checkout`: not covered and publishing would not start a trial; the server rejects.
 * - `noPlans`: the vertical has no sellable plan version; nothing to buy, no trial.
 * - `unknown`: the read failed or answered something unrecognised. Fails CLOSED:
 *   the card offers neither "Publish" nor "Choose plan" (HOS-1668 C-2).
 */
export type PublishAffordance =
    | {
          readonly kind: 'publish';
          readonly canPublish: true;
          readonly startsTrial: true;
          readonly trialDays: number;
      }
    | {
          readonly kind: 'covered';
          readonly canPublish: true;
          readonly startsTrial: false;
          readonly trialDays: null;
      }
    | {
          readonly kind: 'checkout';
          readonly canPublish: false;
          readonly startsTrial: false;
          readonly trialDays: null;
      }
    | {
          readonly kind: 'noPlans';
          readonly canPublish: false;
          readonly startsTrial: false;
          readonly trialDays: null;
      }
    | {
          readonly kind: 'unknown';
          readonly canPublish: false;
          readonly startsTrial: false;
          readonly trialDays: null;
      };

/**
 * The affordance used before (or instead of) a successful destination read.
 * Never publishes: an unresolved read must not leave the button enabled.
 */
export const UNKNOWN_PUBLISH_AFFORDANCE = {
    kind: 'unknown',
    canPublish: false,
    startsTrial: false,
    trialDays: null
} as const satisfies PublishAffordance;

/**
 * Maps a `subscribe-destination` read to the publish affordance. This is the
 * only place where a destination becomes a publish decision in the web app
 * (the canonical-destination guard forbids comparing destinations elsewhere).
 *
 * @param input.result - The `publishApi.subscribeDestination` result.
 * @returns The affordance; `UNKNOWN_PUBLISH_AFFORDANCE` on a failed read, a
 *   missing payload, an unrecognised destination or a non-positive trial length.
 */
export function resolvePublishAffordance({
    result
}: {
    readonly result: ApiResult<SubscribeDestinationResponse>;
}): PublishAffordance {
    if (!result.ok) return UNKNOWN_PUBLISH_AFFORDANCE;

    type Destination = SubscribeDestinationResponse['destination'];
    type AffordanceHandlers = {
        readonly [Key in Destination]: (
            data: Extract<SubscribeDestinationResponse, { readonly destination: Key }>
        ) => PublishAffordance;
    };
    const destinations: AffordanceHandlers = {
        PUBLISH: (data) =>
            Number.isInteger(data.trialDays) && data.trialDays > 0
                ? {
                      kind: 'publish',
                      canPublish: true,
                      startsTrial: true,
                      trialDays: data.trialDays
                  }
                : UNKNOWN_PUBLISH_AFFORDANCE,
        COVERED: () => ({ kind: 'covered', canPublish: true, startsTrial: false, trialDays: null }),
        CHECKOUT: () => ({
            kind: 'checkout',
            canPublish: false,
            startsTrial: false,
            trialDays: null
        }),
        NO_PLANS_AVAILABLE: () => ({
            kind: 'noPlans',
            canPublish: false,
            startsTrial: false,
            trialDays: null
        })
    };
    const handler = destinations[result.data?.destination];
    if (!handler) return UNKNOWN_PUBLISH_AFFORDANCE;
    return handler(result.data as never);
}

/**
 * Whether publishing would start the owner's trial, for surfaces that may fail
 * OPEN on an unresolved read (the `/publicar/` hero callout, HOS-1183 F-6).
 *
 * @param input.affordance - The resolved publish affordance.
 * @returns `null` when the read was unresolved, otherwise `affordance.startsTrial`.
 */
export function resolveTrialEligibility({
    affordance
}: {
    readonly affordance: PublishAffordance;
}): boolean | null {
    if (affordance.kind === 'unknown') return null;
    return affordance.startsTrial;
}
