import { type BusinessVerticalId, resolveBusinessVerticals } from '@repo/schemas';
import type { PublishVerticalSlug } from '@/lib/api/endpoints-protected';
import { PUBLISH_FROM_PLANS_PARAM, PUBLISH_FROM_PLANS_VALUE } from './publish-page-paths';
import type { PublishPageSlot } from './publish-page-slot';

/** Presentation of a public publish page for the current journey. */
export type PublishPageVariant = 'guest' | 'direct' | 'member';

/** Selects the guest funnel, compact create flow, or logged-in introduction. */
export function resolvePublishPageVariant({
    isAuthenticated,
    fromPlans,
    hasVerticalAccess
}: {
    readonly isAuthenticated: boolean;
    readonly fromPlans: boolean;
    readonly hasVerticalAccess: boolean;
}): PublishPageVariant {
    if (!isAuthenticated) return 'guest';
    return fromPlans || hasVerticalAccess ? 'direct' : 'member';
}

const BUSINESS_VERTICAL_BY_PUBLISH_VERTICAL = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
} as const satisfies Record<PublishVerticalSlug, BusinessVerticalId>;

/** Resolves all three pages with the account menu's effective-permission predicate. */
export function resolvePublishPageFlow({
    isAuthenticated,
    permissions,
    vertical,
    searchParams,
    slot
}: {
    readonly isAuthenticated: boolean;
    readonly permissions: readonly string[];
    readonly vertical: PublishVerticalSlug;
    readonly searchParams: URLSearchParams;
    readonly slot: PublishPageSlot;
}): { readonly variant: PublishPageVariant; readonly redirectUrl: string | undefined } {
    const { verticals } = resolveBusinessVerticals({
        permissions,
        ownsHostTradeListing: false,
        ownsPartner: false
    });
    const variant = resolvePublishPageVariant({
        isAuthenticated,
        fromPlans: searchParams.get(PUBLISH_FROM_PLANS_PARAM) === PUBLISH_FROM_PLANS_VALUE,
        hasVerticalAccess: verticals.includes(BUSINESS_VERTICAL_BY_PUBLISH_VERTICAL[vertical])
    });
    // At-cap and multi-draft decisions retain their panel and its explicit choices.
    const redirectUrl =
        variant === 'direct' &&
        slot.state === 'precheck_panel' &&
        slot.decision === 'resume_or_create' &&
        slot.drafts.length === 1
            ? slot.editUrl
            : undefined;
    return { variant, redirectUrl };
}
