/**
 * The ONE place a featured-listing add-on grant is turned into a column write
 * (HOS-1286).
 *
 * Before this module, "flip `featuredByEntitlement` for this grant" was written
 * out at each site that needed it — the entitlement-grant path and the
 * addon-expiry cron — and each one assumed the target was an accommodation,
 * because it always was. With three verticals, that assumption becomes a
 * dispatch, and a dispatch copied into two files is a dispatch that will
 * eventually disagree with itself.
 *
 * The asymmetry it hides is real and worth stating once here rather than at
 * every call site:
 *
 * - **accommodation** needs the owner, because a plan can grant featuring
 *   owner-wide and the single-listing primitive has to know whether that plan
 *   still grants it before clearing anything (SPEC-309 H-1). So this resolves
 *   `accommodations.owner_id` first, and a listing whose row is gone is a no-op
 *   rather than a guess;
 * - **gastronomy / experience** need no owner, because no commerce plan grants
 *   `FEATURED_LISTING` — the add-on is the only source, so a revoke is
 *   unconditional (see `commerce.sync-featured-by-entitlement.ts`).
 *
 * Every function here is best-effort by contract: a sync failure must never
 * fail the billing operation that triggered it. The reconcile cron is the
 * backstop, exactly as it was for accommodation alone.
 *
 * @module services/featured-listing-sync
 */

import { accommodations, eq, getDb } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import {
    syncFeaturedByEntitlementForAccommodation,
    syncFeaturedByEntitlementForCommerceListing
} from '@repo/service-core';
import { apiLogger } from '../utils/logger';

/** Input for {@link syncFeaturedForGrantTarget}. */
export interface SyncFeaturedForGrantTargetInput {
    /**
     * The vertical the target belongs to, as stored on the grant row. Typed
     * `string` rather than the narrow union because it comes straight off a
     * varchar column: an unrecognised value must be REFUSED at runtime, not
     * assumed away by the type system.
     */
    readonly entityType: string;
    /** The listing to flip. */
    readonly entityId: string;
    /** Target value for `featuredByEntitlement`. */
    readonly active: boolean;
}

/**
 * Flips `featuredByEntitlement` on whichever vertical's listing a grant points
 * at.
 *
 * @param input - The grant's `(entityType, entityId)` and the target value.
 * @returns `true` when a row was written; `false` when nothing matched or the
 *   entity type was not one this platform can feature.
 */
export async function syncFeaturedForGrantTarget(
    input: SyncFeaturedForGrantTargetInput
): Promise<boolean> {
    const { entityType, entityId, active } = input;

    if (entityType === ProductDomainEnum.ACCOMMODATION) {
        const [accommodation] = await getDb()
            .select({ ownerId: accommodations.ownerId })
            .from(accommodations)
            .where(eq(accommodations.id, entityId));

        if (!accommodation) {
            // An orphan grant — the listing was hard-deleted. Harmless: with the
            // FK gone, orphans are expected and match no join. Nothing to write.
            return false;
        }

        const result = await syncFeaturedByEntitlementForAccommodation({
            accommodationId: entityId,
            active,
            ownerId: accommodation.ownerId
        });
        return result.updated > 0;
    }

    if (
        entityType === ProductDomainEnum.GASTRONOMY ||
        entityType === ProductDomainEnum.EXPERIENCE
    ) {
        const result = await syncFeaturedByEntitlementForCommerceListing({
            entityType,
            entityId,
            active
        });
        return result.updated > 0;
    }

    // Not a featurable vertical. Loud rather than silent: the only ways to get
    // here are a grant row written by an older/newer deploy or by hand, and
    // both are worth a line in the log — the alternative is a paid boost that
    // never appears and never complains.
    apiLogger.error(
        { entityType, entityId, active },
        'featured-listing sync: grant names an entity type this platform cannot feature; no column was written'
    );
    return false;
}
