/**
 * Accommodation-visibility filter for OwnerPromotionService (HOS-21 T-006).
 */

import { accommodations, ownerPromotions } from '@repo/db/schemas';
import type { SQL } from 'drizzle-orm';
import { and, eq, ne, sql } from 'drizzle-orm';

/**
 * Builds the EXISTS filter that hides an exclusive deal when its accommodation
 * is not publicly visible.
 *
 * Mirrors, verbatim, the four conditions `AccommodationModel` applies to public
 * (non-owner, non-VIP-visibility) accommodation reads — `excludeRestricted`,
 * `excludeOwnerSuspended`, `excludePlanRestricted`, `activeOnly`, all `true`
 * (see `packages/db/src/models/accommodation/accommodation.model.ts`). Reused
 * here rather than re-derived, per HOS-21 T-006.
 *
 * `ownerPromotions.accommodationId` is nullable (D-4 owner-wide promotions), so
 * a null accommodationId always passes this filter — an owner-wide promo has
 * no single accommodation whose visibility could hide it.
 */
export function buildAccommodationVisibilityCondition(): SQL {
    const visibilityPredicate =
        and(
            ne(accommodations.visibility, 'RESTRICTED'),
            eq(accommodations.ownerSuspended, false),
            eq(accommodations.planRestricted, false),
            eq(accommodations.lifecycleState, 'ACTIVE')
        ) ?? sql`1=1`;

    return sql`(
        ${ownerPromotions.accommodationId} IS NULL
        OR EXISTS (
            SELECT 1 FROM ${accommodations}
            WHERE ${accommodations.id} = ${ownerPromotions.accommodationId}
            AND (${visibilityPredicate})
        )
    )`;
}
