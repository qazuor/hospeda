import { z } from 'zod';
import { BaseSearchSchema } from '../../common/pagination.schema.js';
import { PartnerSubscriptionStatusEnumSchema } from '../../enums/partner-subscription-status.schema.js';
import { PartnerTierEnumSchema } from '../../enums/partner-tier.schema.js';
import { PartnerTypeEnumSchema } from '../../enums/partner-type.schema.js';

/**
 * Search partner schema for public queries.
 * Only returns active partners — `includeInactive` is intentionally absent
 * so that the active-only filter is always enforced on public endpoints.
 */
export const searchPartnerSchema = BaseSearchSchema.extend({
    q: z.string().optional(), // Text search on name/description
    type: PartnerTypeEnumSchema.optional(),
    tier: PartnerTierEnumSchema.optional(),
    subscriptionStatus: PartnerSubscriptionStatusEnumSchema.optional()
});

export type SearchPartner = z.infer<typeof searchPartnerSchema>;
