import type { ExperienceReview } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { experienceReviews } from '../../schemas/experience/experience_review.dbschema.ts';

/**
 * ExperienceReviewModel — DB access for experience reviews (SPEC-240).
 * Mirrors GastronomyReviewModel: extends BaseModelImpl for standard CRUD.
 * Custom relation queries (with user/experience) should be added here as the
 * service layer grows — same pattern as GastronomyReviewModel.
 */
export class ExperienceReviewModel extends BaseModelImpl<ExperienceReview> {
    protected table = experienceReviews;
    public entityName = 'experienceReviews';

    protected override readonly validRelationKeys = ['experience', 'user'] as const;

    protected getTableName(): string {
        return 'experience_reviews';
    }
}

/** Singleton instance of ExperienceReviewModel for use across the application. */
export const experienceReviewModel = new ExperienceReviewModel();
