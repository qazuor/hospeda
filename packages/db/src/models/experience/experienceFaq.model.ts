import type { ExperienceFaq } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { experienceFaqs } from '../../schemas/experience/experience_faq.dbschema.ts';

/**
 * ExperienceFaqModel — DB access for experience FAQ entries (SPEC-240).
 * Mirrors GastronomyFaqModel: thin BaseModelImpl wrapper.
 * Custom ordering (display_order ASC NULLS LAST, created_at ASC) is handled
 * at the caller level (e.g. via db.query.experienceFaqs.findMany with orderBy).
 */
export class ExperienceFaqModel extends BaseModelImpl<ExperienceFaq> {
    protected table = experienceFaqs;
    public entityName = 'experienceFaqs';

    protected getTableName(): string {
        return 'experienceFaqs';
    }
}

/** Singleton instance of ExperienceFaqModel for use across the application. */
export const experienceFaqModel = new ExperienceFaqModel();
