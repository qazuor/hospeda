import type { AccommodationReviewType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { accommodationReviews } from '../../schemas/accommodation/accommodation_review.dbschema';

/**
 * Model for accommodation reviews. Use for all DB access related to accommodation reviews.
 * Inherits CRUD and paginated methods from BaseModel.
 */
export class AccommodationReviewModel extends BaseModel<AccommodationReviewType> {
    protected table = accommodationReviews;
    protected entityName = 'accommodationReviews';
}
