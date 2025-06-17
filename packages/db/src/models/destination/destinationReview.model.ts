import type { DestinationReviewType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { destinationReviews } from '../../schemas/destination/destination_review.dbschema';

export class DestinationReviewModel extends BaseModel<DestinationReviewType> {
    protected table = destinationReviews;
    protected entityName = 'destinationReviews';
}
