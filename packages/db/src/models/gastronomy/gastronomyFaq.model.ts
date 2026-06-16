import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyFaqs } from '../../schemas/gastronomy/gastronomy_faq.dbschema.ts';

/**
 * GastronomyFaqModel — DB access for gastronomy FAQ entries (SPEC-239).
 * Mirrors AccommodationFaqModel: thin BaseModelImpl wrapper.
 * Custom ordering (display_order ASC NULLS LAST, created_at ASC) is handled
 * at the caller level (e.g. via db.query.gastronomyFaqs.findMany with orderBy).
 */
export class GastronomyFaqModel extends BaseModelImpl<typeof gastronomyFaqs.$inferSelect> {
    protected table = gastronomyFaqs;
    public entityName = 'gastronomyFaqs';

    protected getTableName(): string {
        return 'gastronomyFaqs';
    }
}

/** Singleton instance of GastronomyFaqModel for use across the application. */
export const gastronomyFaqModel = new GastronomyFaqModel();
