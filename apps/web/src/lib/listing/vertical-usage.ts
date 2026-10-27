import type { LimitKeyEnum, OwnerListingSummary } from '@repo/schemas';
import { LimitKeyEnum as LimitKeys, PublicationStatusEnum } from '@repo/schemas';
import { isUnlimitedLimit } from '@/components/billing/plan-card-delta';
import { effectiveSetApi } from '@/lib/api/endpoints-protected';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import { getUsageThreshold } from '@/lib/host/usage-badge';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';

/** One of the two listing verticals shown in the owner index. */
export type ListingVertical = 'venue' | 'experience';

/** Usage and effective capacity for one listing vertical. */
export interface ListingUsage {
    /** Vertical whose listings and effective limit were read. */
    readonly vertical: ListingVertical;
    /** Number of published listings occupying this vertical's quota. */
    readonly currentUsage: number;
    /** Finite positive limit from the owner's effective set. */
    readonly maxAllowed: number;
    /** Display threshold derived by the shared host usage helper. */
    readonly threshold: ReturnType<typeof getUsageThreshold>;
}

const LIMIT_KEY_BY_VERTICAL: Readonly<Record<ListingVertical, LimitKeyEnum>> = {
    venue: LimitKeys.MAX_VENUES,
    experience: LimitKeys.MAX_EXPERIENCES
};

/**
 * Builds a usage badge from one vertical's effective set and owner listings.
 *
 * @param input.vertical - Vertical being evaluated.
 * @param input.effectiveSet - Effective entitlements and limits for that vertical.
 * @param input.listings - Owner listing summaries across supported verticals.
 * @returns Usage data when the vertical has a finite positive cap, otherwise `null`.
 */
export function buildListingUsage({
    vertical,
    effectiveSet,
    listings
}: {
    readonly vertical: ListingVertical;
    readonly effectiveSet: EntitlementsData;
    readonly listings: readonly OwnerListingSummary[];
}): ListingUsage | null {
    const maxAllowed = effectiveSet.limits[LIMIT_KEY_BY_VERTICAL[vertical]];
    if (
        effectiveSet.failed ||
        maxAllowed === undefined ||
        maxAllowed === Infinity ||
        isUnlimitedLimit({ value: maxAllowed }) ||
        maxAllowed <= 0
    )
        return null;
    const currentUsage = listings.filter(
        (listing) =>
            listing.vertical === vertical &&
            listing.publicationStatus === PublicationStatusEnum.PUBLISHED
    ).length;
    return {
        vertical,
        currentUsage,
        maxAllowed,
        threshold: getUsageThreshold(currentUsage, maxAllowed)
    };
}

/**
 * Reads each requested vertical's effective set without sharing module cache state.
 *
 * @param input.verticals - Listing verticals to load independently.
 * @param input.cookieHeader - Request cookie forwarded to the protected API.
 * @returns A map with a successful or failed effective set for every requested vertical.
 */
export async function fetchListingEffectiveSets({
    verticals,
    cookieHeader
}: {
    readonly verticals: readonly ListingVertical[];
    readonly cookieHeader?: string;
}): Promise<ReadonlyMap<ListingVertical, EntitlementsData>> {
    const entries = await Promise.all(
        verticals.map(async (vertical): Promise<readonly [ListingVertical, EntitlementsData]> => {
            try {
                const result = await effectiveSetApi.get({ vertical, cookieHeader });
                if (result.ok) {
                    const effectiveSet: EntitlementsData = { ...result.data, failed: false };
                    return [vertical, effectiveSet];
                }
            } catch {
                // A failed vertical must not prevent the other effective set from rendering.
            }
            return [
                vertical,
                { entitlements: {}, limits: {}, hasLiveNonTrialTitle: false, failed: true }
            ];
        })
    );
    return new Map(entries);
}

/**
 * Resolves the pricing page for the selected listing vertical.
 *
 * @param input.vertical - Vertical whose quota can be expanded.
 * @returns Localized path segment for the vertical pricing page.
 */
export function resolveUsageUpgradePath({
    vertical
}: {
    readonly vertical: ListingVertical;
}): string {
    return PRICING_PAGE_PATH_BY_AUDIENCE[vertical === 'venue' ? 'gastronomy' : vertical];
}
