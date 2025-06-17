import type { AccommodationFaqType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { accommodationFaqs } from '../../schemas/accommodation/accommodation_faq.dbschema';

export class AccommodationFaqModel extends BaseModel<AccommodationFaqType> {
    protected table = accommodationFaqs;
    protected entityName = 'accommodationFaqs';
}
