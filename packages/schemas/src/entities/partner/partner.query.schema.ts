import { z } from 'zod';
import { BaseSearchSchema } from '../../common/pagination.schema.js';

/**
 * Search partner schema for public queries.
 * Only returns active partners — `includeInactive` is intentionally absent
 * so that the active-only filter is always enforced on public endpoints.
 */
export const searchPartnerSchema = BaseSearchSchema.extend({
    q: z.string().optional(), // Text search on name/description
    /**
     * Partner type SLUG (spec D6). An unknown slug matches nothing (AC-5.2):
     * it is never a 400, so only the shape is checked here.
     */
    type: z.string().max(100).optional()
});

export type SearchPartner = z.infer<typeof searchPartnerSchema>;
