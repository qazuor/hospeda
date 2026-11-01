/**
 * Entitlement gate for the uploaded menu file on the venue public READS that
 * return the stored listing as-is (HOS-1792).
 *
 * `getBySlug` builds its own response and runs `applyVenueMenuManagementGate`
 * with the full entitlement set. The by-id, list and by-destination reads
 * return the stored row, so before this module they published `menuFileUrl` /
 * `menuFileKind` for owners whose plan does not grant `manage_venue_menu`.
 *
 * This is the SINGLE place those three reads go through. It reuses
 * `applyVenueMenuManagementGate` (the same projection by-slug uses) and the
 * same `readEffectiveKeys` resolver, which fails closed on a lookup error.
 *
 * @module routes/venue/public/menu-file-gate
 */

import type { VenueMenuFileKind } from '@repo/schemas';
import { VerticalEnum } from '@repo/schemas';
import { readEffectiveKeys } from '../../../utils/listing-access/user-gate';
import { applyVenueMenuManagementGate } from './menu-projection';

/** Minimum shape of a stored venue needed to gate its menu file. */
export interface VenueMenuFileCarrier {
    readonly ownerId: string;
    readonly menuFileUrl?: string | null | undefined;
    readonly menuFileKind?: VenueMenuFileKind | null | undefined;
}

/**
 * Applies the menu-file gate to one venue, given an already-resolved grant.
 *
 * @param input.venue - The stored venue.
 * @param input.ownerGrantsMenuManagement - Whether the owner's plan grants `manage_venue_menu`.
 * @returns The venue with `menuFileUrl`/`menuFileKind` projected.
 */
function projectMenuFile<T extends VenueMenuFileCarrier>(input: {
    readonly venue: T;
    readonly ownerGrantsMenuManagement: boolean;
}): T {
    const { menuFileUrl, menuFileKind } = applyVenueMenuManagementGate({
        venue: input.venue,
        menuSections: [],
        ownerGrantsMenuManagement: input.ownerGrantsMenuManagement,
        ownerGrantsMenuItemPhotos: false,
        ownerGrantsMenuTranslations: false
    });
    return { ...input.venue, menuFileUrl, menuFileKind };
}

/**
 * Gates the menu file of a list of venues. Entitlements are resolved once per
 * distinct owner, not once per venue.
 *
 * @param input.venues - The stored venues.
 * @returns The same venues, with the menu file withheld where the plan does not grant it.
 */
export async function gateVenueMenuFiles<T extends VenueMenuFileCarrier>(input: {
    readonly venues: readonly T[];
}): Promise<readonly T[]> {
    const ownerIds = [...new Set(input.venues.map((venue) => venue.ownerId))];
    const grants = new Map<string, boolean>(
        await Promise.all(
            ownerIds.map(async (userId): Promise<[string, boolean]> => {
                const keys = await readEffectiveKeys({
                    userId,
                    vertical: VerticalEnum.VENUE,
                    keys: ['manage_venue_menu']
                });
                return [userId, keys.manage_venue_menu ?? false];
            })
        )
    );
    return input.venues.map((venue) =>
        projectMenuFile({
            venue,
            ownerGrantsMenuManagement: grants.get(venue.ownerId) ?? false
        })
    );
}

/**
 * Gates the menu file of a single venue.
 *
 * @param input.venue - The stored venue.
 * @returns The venue with the menu file withheld when the plan does not grant it.
 */
export async function gateVenueMenuFile<T extends VenueMenuFileCarrier>(input: {
    readonly venue: T;
}): Promise<T> {
    const [gated] = await gateVenueMenuFiles({ venues: [input.venue] });
    return gated as T;
}
