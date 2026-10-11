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
