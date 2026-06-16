import type { GastronomyReview } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyReviews } from '../../schemas/gastronomy/gastronomy_review.dbschema.ts';

/**
 * GastronomyReviewModel — DB access for gastronomy reviews (SPEC-239).
 * Mirrors AccommodationReviewModel: extends BaseModelImpl for standard CRUD.
 * Custom relation queries (with user/gastronomy) should be added here as the
 * service layer grows — same pattern as AccommodationReviewModel.findAllWithUser.
 */
export class GastronomyReviewModel extends BaseModelImpl<GastronomyReview> {
    protected table = gastronomyReviews;
    public entityName = 'gastronomyReviews';

    protected override readonly validRelationKeys = ['gastronomy', 'user'] as const;

    protected getTableName(): string {
        return 'gastronomy_reviews';
    }
}

/** Singleton instance of GastronomyReviewModel for use across the application. */
export const gastronomyReviewModel = new GastronomyReviewModel();
