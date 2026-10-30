import type { VenueFaq } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { venueFaqs } from '../../schemas/venue/venue_faq.dbschema.ts';

/**
 * VenueFaqModel — DB access for venue FAQ entries (SPEC-239).
 * Mirrors AccommodationFaqModel: thin BaseModelImpl wrapper.
 * Custom ordering (display_order ASC NULLS LAST, created_at ASC) is handled
 * at the caller level (e.g. via db.query.venueFaqs.findMany with orderBy).
 */
export class VenueFaqModel extends BaseModelImpl<VenueFaq> {
    protected table = venueFaqs;
    public entityName = 'venueFaqs';

    protected getTableName(): string {
        return 'venueFaqs';
    }
}

/** Singleton instance of VenueFaqModel for use across the application. */
export const venueFaqModel = new VenueFaqModel();
