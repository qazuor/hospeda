/**
 * Single entry point that applies an accommodation OWNER's paid-field grants to
 * public accommodation payloads (HOS-1809).
 *
 * Every public accommodation reader goes through {@link projectPublicAccommodations}
 * so the way the grants are resolved and applied can change in one place. The
 * result is shared-cached with no auth in the cache key, so nothing here may
 * read the requesting user (HOS-19, HOS-353).
 *
 * @module utils/public-accommodation-projection
 */

import { filterPublicPaidFieldsForOwner, resolvePublicFieldGrants } from './entitlement-filter';

/** An accommodation row as the public readers hold it before serialization. */
export type PublicAccommodationRecord = object & { readonly ownerId?: unknown };

function ownerIdOf(listing: PublicAccommodationRecord): string | undefined {
    return typeof listing.ownerId === 'string' ? listing.ownerId : undefined;
}

/**
 * Applies the owner-effective public-field gating to a page of accommodations
 * and reports, from the same single read, whether each owner offers the AI chat.
 *
 * Reads the effective set once per distinct owner. An owner whose grants cannot
 * be resolved is treated as having none (fail closed).
 *
 * @param args.listings - Accommodation rows of one response page.
 * @returns The rows (same order, gated fields applied) and the owner-level AI chat
 *   flag (`hasAiChat` on public cards; a capability of the owner, not a section).
 */
export async function projectPublicAccommodationPage<T extends PublicAccommodationRecord>(args: {
    readonly listings: readonly T[];
}): Promise<{ readonly items: T[]; readonly aiChatByOwner: ReadonlyMap<string, boolean> }> {
    const grants = await resolvePublicFieldGrants(args.listings.map(ownerIdOf));
    return {
        items: args.listings.map((listing) => filterPublicPaidFieldsForOwner(listing, grants)),
        aiChatByOwner: new Map([...grants].map(([ownerId, value]) => [ownerId, value.aiChat]))
    };
}

/**
 * Applies the owner-effective public-field gating to a page of accommodations.
 *
 * @param args.listings - Accommodation rows of one response page.
 * @returns The same rows, in the same order, with the gated fields applied.
 */
export async function projectPublicAccommodations<T extends PublicAccommodationRecord>(args: {
    readonly listings: readonly T[];
}): Promise<T[]> {
    return (await projectPublicAccommodationPage(args)).items;
}
