import type { AccommodationFaq } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodationFaqs } from '../../schemas/accommodation/accommodation_faq.dbschema.ts';

export class AccommodationFaqModel extends BaseModelImpl<AccommodationFaq> {
    protected table = accommodationFaqs;
    public entityName = 'accommodationFaqs';

    protected getTableName(): string {
        return 'accommodationFaqs';
    }
}

/** Singleton instance of AccommodationFaqModel for use across the application. */
export const accommodationFaqModel = new AccommodationFaqModel();
