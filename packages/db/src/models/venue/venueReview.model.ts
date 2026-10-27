import type { VenueReview } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { venueReviews } from '../../schemas/venue/venue_review.dbschema.ts';

/**
 * VenueReviewModel — DB access for gastronomy reviews (SPEC-239).
 * Mirrors AccommodationReviewModel: extends BaseModelImpl for standard CRUD.
 * Custom relation queries (with user/gastronomy) should be added here as the
 * service layer grows — same pattern as AccommodationReviewModel.findAllWithUser.
 */
export class VenueReviewModel extends BaseModelImpl<VenueReview> {
    protected table = venueReviews;
    public entityName = 'venueReviews';

    protected override readonly validRelationKeys = ['venue', 'user'] as const;

    /**
     * Returns the Drizzle query key for this model.
     * Must match the JS variable name used in the Drizzle schema (camelCase),
     * NOT the SQL table name. Used by findAllWithRelations via db.query[tableName]
     * (BETA-150: returning the snake_case SQL name made every public
     * GET /gastronomies/:id/reviews request 500 with
     * "Invalid table configuration for: venue_reviews").
     */
    protected getTableName(): string {
        return 'venueReviews';
    }
}

/** Singleton instance of VenueReviewModel for use across the application. */
export const venueReviewModel = new VenueReviewModel();
