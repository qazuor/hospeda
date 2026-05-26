import type { DestinationFaq } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { destinationFaqs } from '../../schemas/destination/destination_faq.dbschema.ts';

export class DestinationFaqModel extends BaseModelImpl<DestinationFaq> {
    protected table = destinationFaqs;
    public entityName = 'destinationFaqs';

    protected getTableName(): string {
        return 'destinationFaqs';
    }
}

/** Singleton instance of DestinationFaqModel for use across the application. */
export const destinationFaqModel = new DestinationFaqModel();
