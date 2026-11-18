/**
 * @file stats-entitlement.ts
 * @description The plan gate of the statistics the assistant tools report
 * (HOS-2184 T-024, HOS-2331). One place, so `get_listing_stats` and
 * `get_owner_summary` can never gate the same numbers differently.
 *
 * - basic stats: the `view_basic_stats` entitlement, checked with
 *   `enforceUserGate`, exactly like the HTTP stats routes
 *   (`routes/{venue,experience}/protected/viewStats.ts`,
 *   `routes/views/protected/accommodations-me.ts`, the host dashboard);
 * - advanced stats (favorites): `view_advanced_stats`, read with
 *   `readEffectiveKeys`, as `get_listing_stats` always has.
 *
 * Both go through the listing-access pipeline (`@repo/verticals`
 * `resolveEntitlementStep` / the effective set). A role never decides.
 */

import { ServiceErrorCode, type VerticalEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { enforceUserGate, readEffectiveKeys } from '../../../utils/listing-access/user-gate';

/** `reason` of a refusal or an omission when the plan has no stats. */
export const NO_STATS_ENTITLEMENT_REASON = 'NO_STATS_ENTITLEMENT';

/**
 * Whether the person's plan in a vertical includes the basic statistics.
 *
 * @param args - The person and the vertical
 * @returns `true` when `view_basic_stats` is granted
 * @throws Any failure of the gate other than "entitlement required"
 */
export async function hasBasicStatsEntitlement({
    userId,
    vertical
}: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
}): Promise<boolean> {
    try {
        await enforceUserGate({ userId, vertical, keys: ['view_basic_stats'] });
        return true;
    } catch (error) {
        if (error instanceof ServiceError && error.code === ServiceErrorCode.ENTITLEMENT_REQUIRED) {
            return false;
        }
        throw error;
    }
}

/**
 * Whether the person's plan in a vertical includes the advanced statistics
 * (favorites).
 *
 * @param args - The person and the vertical
 * @returns `true` when `view_advanced_stats` is granted; `false` when it is not
 *   or the lookup failed (the effective-keys reader fails closed)
 */
export async function hasAdvancedStatsEntitlement({
    userId,
    vertical
}: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
}): Promise<boolean> {
    const keys = await readEffectiveKeys({ userId, vertical, keys: ['view_advanced_stats'] });
    return keys.view_advanced_stats === true;
}
