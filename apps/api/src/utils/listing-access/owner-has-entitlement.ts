/**
 * Owner entitlement lookup for read-side shaping (HOS-2658, spec §8.5).
 *
 * Extracted from the accommodation protected GET so the listing translation
 * state can drop `richDescription` with exactly the same rule: paid content
 * follows the LISTING OWNER's effective entitlement, whoever is reading.
 *
 * @module utils/listing-access/owner-has-entitlement
 */

import type { VerticalEnum } from '@repo/schemas';
import { apiLogger } from '../logger';
import { getListingAccessPorts } from './ports';

/**
 * Tells whether the owner's effective set grants an entitlement key for a vertical.
 *
 * Fails closed: a lookup error answers `{ has: false }` and logs a warning, so
 * a broken effective-set read never leaks premium content.
 *
 * @param input - The owner id, the vertical and the entitlement key.
 * @returns Object with `has: true` when the entitlement value is above zero.
 */
export async function ownerHasEntitlement({
    ownerId,
    vertical,
    key
}: {
    readonly ownerId: string;
    readonly vertical: VerticalEnum;
    readonly key: string;
}): Promise<{ readonly has: boolean }> {
    try {
        const effective = await getListingAccessPorts().effectiveSet({ userId: ownerId, vertical });
        const value = effective.entitlements.get({ key, userId: ownerId, vertical }) ?? 0;
        return { has: value > 0 };
    } catch (error) {
        apiLogger.warn(
            {
                ownerId,
                vertical,
                key,
                error: error instanceof Error ? error.message : String(error)
            },
            'owner-has-entitlement: entitlement lookup failed'
        );
        return { has: false };
    }
}
