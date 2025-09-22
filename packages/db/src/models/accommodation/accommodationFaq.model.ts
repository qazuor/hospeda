import type { AccommodationFaq } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { accommodationFaqs } from '../../schemas/accommodation/accommodation_faq.dbschema';

export class AccommodationFaqModel extends BaseModel<AccommodationFaq> {
    protected table = accommodationFaqs;
    protected entityName = 'accommodationFaqs';
}
