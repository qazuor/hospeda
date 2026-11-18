import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search partner schema
 * Extends AdminSearchBaseSchema with partner-specific filters
 */
export const adminSearchPartnerSchema = AdminSearchBaseSchema.extend({
    /** Partner type SLUG (HOS-2336, AC-4.2). An unknown slug matches nothing. */
    type: z.string().max(100).optional()
});

export type AdminSearchPartner = z.infer<typeof adminSearchPartnerSchema>;
