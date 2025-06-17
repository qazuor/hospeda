import type { AccommodationReviewType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { accommodationReviews } from '../../schemas/accommodation/accommodation_review.dbschema';

export class AccommodationReviewModel extends BaseModel<AccommodationReviewType> {
    protected table = accommodationReviews;
    protected entityName = 'accommodationReviews';
}
