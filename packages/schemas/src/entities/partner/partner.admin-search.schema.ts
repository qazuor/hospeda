// biome-ignore lint/style/useImportType: z is used in z.infer() for type inference
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { PartnerSubscriptionStatusEnumSchema } from '../../enums/partner-subscription-status.schema.js';
import { PartnerTierEnumSchema } from '../../enums/partner-tier.schema.js';
import { PartnerTypeEnumSchema } from '../../enums/partner-type.schema.js';

/**
 * Admin search partner schema
 * Extends AdminSearchBaseSchema with partner-specific filters
 */
export const adminSearchPartnerSchema = AdminSearchBaseSchema.extend({
    type: PartnerTypeEnumSchema.optional(),
    tier: PartnerTierEnumSchema.optional(),
    subscriptionStatus: PartnerSubscriptionStatusEnumSchema.optional()
});

export type AdminSearchPartner = z.infer<typeof adminSearchPartnerSchema>;
