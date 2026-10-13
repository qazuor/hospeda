/**
 * Accommodation-visibility filter for OwnerPromotionService (HOS-21 T-006).
 */

import { accommodations, ownerPromotions } from '@repo/db/schemas';
import type { SQL } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';

/**
 * Builds the EXISTS filter that hides an exclusive deal when its accommodation
 * is not publicly visible.
 *
 * Mirrors, verbatim, the condition `AccommodationModel` applies to public
 * (non-owner) accommodation reads — `publishedOnly: true`, i.e.
 * `publicationStatus = 'PUBLISHED'` (see
 * `packages/db/src/models/accommodation/accommodation.model.ts`; V6.9b replaced
 * the old visibility/suspension/restriction/lifecycle predicates, HOS-1641).
 * Reused here rather than re-derived, per HOS-21 T-006.
 *
 * `ownerPromotions.accommodationId` is nullable (D-4 owner-wide promotions), so
 * a null accommodationId always passes this filter — an owner-wide promo has
 * no single accommodation whose visibility could hide it.
 */
export function buildAccommodationVisibilityCondition(): SQL {
    const visibilityPredicate = eq(accommodations.publicationStatus, 'PUBLISHED');

    return sql`(
        ${ownerPromotions.accommodationId} IS NULL
        OR EXISTS (
            SELECT 1 FROM ${accommodations}
            WHERE ${accommodations.id} = ${ownerPromotions.accommodationId}
            AND (${visibilityPredicate})
        )
    )`;
}
