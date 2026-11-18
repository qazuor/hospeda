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
 * An owner-wide promotion (D-4: accommodation type with no target) always passes
 * this filter — it has no single accommodation whose visibility could hide it.
 * A VENUE promotion never passes: this filter is the accommodation one, and a venue
 * promotion has its own visibility rule (HOS-2273). Dual read (HOS-2270, release N):
 * the target is `entity_id`, falling back to the legacy `accommodation_id` for a row
 * whose `entity_id` has not been copied yet.
 */
export function buildAccommodationVisibilityCondition(): SQL {
    const visibilityPredicate = eq(accommodations.publicationStatus, 'PUBLISHED');

    return sql`(
        ${ownerPromotions.entityType} = 'accommodation'
        AND (
            (${ownerPromotions.entityId} IS NULL AND ${ownerPromotions.accommodationId} IS NULL)
            OR EXISTS (
                SELECT 1 FROM ${accommodations}
                WHERE ${accommodations.id} = COALESCE(${ownerPromotions.entityId}, ${ownerPromotions.accommodationId})
                AND (${visibilityPredicate})
            )
        )
    )`;
}
