import type { AccommodationFaq } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { accommodationFaqs } from '../../schemas/accommodation/accommodation_faq.dbschema.ts';

export class AccommodationFaqModel extends BaseModel<AccommodationFaq> {
    protected table = accommodationFaqs;
    protected entityName = 'accommodationFaqs';

    protected getTableName(): string {
        return 'accommodationFaqs';
    }
}
