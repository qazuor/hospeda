/** Pricing destinations and copy-only audience helpers; never publisher authorization. */
import { canAccessPublisherArea } from '@/lib/account/publisher-access';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';

/** Resolves pricing from effective publisher authority, preserving host-first precedence. */
export function resolveSubscriptionPlansPath({
    permissions
}: {
    readonly permissions: readonly string[];
}): string {
    if (canAccessPublisherArea({ area: 'host', permissions }))
        return PRICING_PAGE_PATH_BY_AUDIENCE.owner;
    if (canAccessPublisherArea({ area: 'venue', permissions }))
        return PRICING_PAGE_PATH_BY_AUDIENCE.venue;
    if (canAccessPublisherArea({ area: 'experience', permissions }))
        return PRICING_PAGE_PATH_BY_AUDIENCE.experience;
    return PRICING_PAGE_PATH_BY_AUDIENCE.tourist;
}

/** Resolves pricing for a caller that already knows the product audience. */
export function resolveSubscriptionPlansPathForAudience({
    audience
}: {
    readonly audience: 'host' | 'tourist' | 'venue' | 'experience';
}): string {
    return PRICING_PAGE_PATH_BY_AUDIENCE[audience === 'host' ? 'owner' : audience];
}

/** Copy-only role-to-catalog map. This never grants publisher access. */
const OWNER_VERTICAL_PLANS_PATH_BY_ROLE = {
    HOST: PRICING_PAGE_PATH_BY_AUDIENCE.owner,
    VENUE_OWNER: PRICING_PAGE_PATH_BY_AUDIENCE.venue,
    EXPERIENCE_OWNER: PRICING_PAGE_PATH_BY_AUDIENCE.experience
} as const satisfies Readonly<Record<string, string>>;

/** Existing chooser destination when copy-only audience is ambiguous. */
export const OWNER_PLANS_FALLBACK_PATH = 'mi-cuenta/publica';

/** Chooses an empty-subscription CTA, not an authorization decision. */
export function resolveEmptySubscriptionPlansPath({
    roles
}: {
    readonly roles: readonly string[] | null;
}): string {
    const held = new Set(roles ?? []);
    const paths = Object.entries(OWNER_VERTICAL_PLANS_PATH_BY_ROLE)
        .filter(([role]) => held.has(role))
        .map(([, path]) => path);
    return paths.length === 1 && paths[0] ? paths[0] : OWNER_PLANS_FALLBACK_PATH;
}

/** Selects owner wording only; never use this to admit a route or resource. */
export function isOwnerAudience({ roles }: { readonly roles: readonly string[] | null }): boolean {
    return (roles ?? []).some((role) => role in OWNER_VERTICAL_PLANS_PATH_BY_ROLE);
}
