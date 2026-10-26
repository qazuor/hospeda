import type { VenueFaq } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyFaqs } from '../../schemas/venue/venue_faq.dbschema.ts';

/**
 * VenueFaqModel — DB access for gastronomy FAQ entries (SPEC-239).
 * Mirrors AccommodationFaqModel: thin BaseModelImpl wrapper.
 * Custom ordering (display_order ASC NULLS LAST, created_at ASC) is handled
 * at the caller level (e.g. via db.query.gastronomyFaqs.findMany with orderBy).
 */
export class VenueFaqModel extends BaseModelImpl<VenueFaq> {
    protected table = gastronomyFaqs;
    public entityName = 'gastronomyFaqs';

    protected getTableName(): string {
        return 'gastronomyFaqs';
    }
}

/** Singleton instance of VenueFaqModel for use across the application. */
export const venueFaqModel = new VenueFaqModel();
