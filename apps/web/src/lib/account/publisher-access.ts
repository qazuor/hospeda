/** Declarative publisher surface policy. API resource/action checks remain authoritative. */
import { PermissionEnum as P } from '@repo/schemas';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** ANY permission grants a surface; ownership surfaces instead require their named fact. */
export interface PublisherAccessPolicy {
    readonly requiredPermissions: readonly P[];
    readonly ownership?: 'ownsPartner' | 'ownsHostTradeListing';
}

/** Operation-specific policies, not a reconstruction of roles or API requirements. */
export const PUBLISHER_ACCESS = {
    // Auth-only owner APIs: CREATE is the existing navigation eligibility policy.
    host: { requiredPermissions: [P.ACCOMMODATION_CREATE] },
    accommodationEdit: {
        requiredPermissions: [P.ACCOMMODATION_UPDATE_OWN, P.ACCOMMODATION_UPDATE_ANY]
    },
    inbox: { requiredPermissions: [P.CONVERSATION_VIEW_OWN] },
    promotions: { requiredPermissions: [P.OWNER_PROMOTION_VIEW_OWN] },
    promotionCreate: { requiredPermissions: [P.OWNER_PROMOTION_CREATE] },
    promotionEdit: { requiredPermissions: [P.OWNER_PROMOTION_UPDATE_OWN] },
    directory: { requiredPermissions: [P.HOST_TRADE_VIEW] },
    venue: { requiredPermissions: [P.VENUE_EDIT_OWN, P.VENUE_EDIT_ALL] },
    experience: { requiredPermissions: [P.EXPERIENCE_EDIT_OWN, P.EXPERIENCE_EDIT_ALL] },
    commerce: {
        requiredPermissions: [
            P.VENUE_EDIT_OWN,
            P.VENUE_EDIT_ALL,
            P.EXPERIENCE_EDIT_OWN,
            P.EXPERIENCE_EDIT_ALL
        ]
    },
    posts: { requiredPermissions: [P.POST_CREATE, P.POST_UPDATE_OWN, P.POST_UPDATE] },
    postCreate: { requiredPermissions: [P.POST_CREATE] },
    postEdit: { requiredPermissions: [P.POST_UPDATE_OWN, P.POST_UPDATE] },
    events: { requiredPermissions: [P.EVENT_CREATE, P.EVENT_UPDATE_OWN, P.EVENT_UPDATE] },
    eventCreate: { requiredPermissions: [P.EVENT_CREATE] },
    eventEdit: { requiredPermissions: [P.EVENT_UPDATE_OWN, P.EVENT_UPDATE] },
    partner: { requiredPermissions: [], ownership: 'ownsPartner' },
    provider: { requiredPermissions: [], ownership: 'ownsHostTradeListing' }
} as const satisfies Readonly<Record<string, PublisherAccessPolicy>>;

/** Stable surface/operation identifier. */
export type PublisherArea = keyof typeof PUBLISHER_ACCESS;

/** Evaluates resolved effective permissions or explicit ownership, never roles. */
export function canAccessPublisherArea({
    area,
    permissions,
    ownsPartner = false,
    ownsHostTradeListing = false
}: {
    readonly area: PublisherArea;
    readonly permissions: readonly string[];
    readonly ownsPartner?: boolean;
    readonly ownsHostTradeListing?: boolean;
}): boolean {
    const policy: PublisherAccessPolicy = PUBLISHER_ACCESS[area];
    if (policy.ownership) return { ownsPartner, ownsHostTradeListing }[policy.ownership];
    return policy.requiredPermissions.some((permission) => permissions.includes(permission));
}

/** Common locale-aware destination for denied publisher surfaces. */
export function publisherDenyRedirect({ locale }: { readonly locale: SupportedLocale }): string {
    return buildUrl({ locale, path: 'mi-cuenta' });
}

/** Checks session-based admission before a publisher page reads domain data. */
export function guardPublisherArea({
    astro,
    area
}: {
    readonly astro: {
        readonly locals: {
            readonly locale: SupportedLocale;
            readonly user?: {
                readonly permissions?: readonly string[];
                readonly ownsPartner?: boolean;
                readonly ownsHostTradeListing?: boolean;
            } | null;
        };
        readonly redirect: (path: string) => Response;
    };
    readonly area: PublisherArea;
}): Response | null {
    const user = astro.locals.user;
    if (!user) return null;
    if (
        canAccessPublisherArea({
            area,
            permissions: user.permissions ?? [],
            ownsPartner: user.ownsPartner,
            ownsHostTradeListing: user.ownsHostTradeListing
        })
    )
        return null;
    return astro.redirect(publisherDenyRedirect({ locale: astro.locals.locale }));
}
