import type { AccommodationExternalListing } from '@repo/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodationExternalListings } from '../../schemas/accommodation-external/accommodation_external_listings.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for the `accommodation_external_listings` table (SPEC-237).
 *
 * Manages owner-registered links to external platform listings
 * (Google, Booking.com, Airbnb, etc.) for a given accommodation.
 *
 * Inherits standard CRUD and soft-delete from BaseModelImpl.
 */
export class AccommodationExternalListingModel extends BaseModelImpl<AccommodationExternalListing> {
    protected table = accommodationExternalListings;
    public entityName = 'accommodationExternalListings';

    protected override readonly validRelationKeys = ['accommodation', 'reputation'] as const;

    protected getTableName(): string {
        return 'accommodationExternalListings';
    }

    /**
     * Finds all non-deleted external listing rows for a given accommodation.
     *
     * Results include listings with any lifecycle state (ACTIVE, ARCHIVED, etc.)
     * but exclude soft-deleted rows (deletedAt IS NOT NULL). Callers that need
     * only active listings should filter by lifecycleState after retrieval.
     *
     * @param accommodationId - UUID of the accommodation to query.
     * @param tx - Optional transaction client. When supplied, the query
     *   executes within the caller's transaction.
     * @returns Promise resolving to an array of non-deleted listing rows,
     *   ordered by platform name ASC for deterministic display.
     * @throws DbError if the database query fails.
     */
    async findByAccommodation(
        accommodationId: string,
        tx?: DrizzleClient
    ): Promise<AccommodationExternalListing[]> {
        const db = this.getClient(tx);
        const logContext = { accommodationId };

        try {
            const results = await db
                .select()
                .from(accommodationExternalListings)
                .where(
                    and(
                        eq(accommodationExternalListings.accommodationId, accommodationId),
                        isNull(accommodationExternalListings.deletedAt)
                    )
                )
                .orderBy(accommodationExternalListings.platform);

            try {
                logQuery(this.entityName, 'findByAccommodation', logContext, results);
            } catch {}

            return results as AccommodationExternalListing[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByAccommodation', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByAccommodation', logContext, err.message);
        }
    }
}

/** Singleton instance of AccommodationExternalListingModel for use across the application. */
export const accommodationExternalListingModel = new AccommodationExternalListingModel();
