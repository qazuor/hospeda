import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { PartnerSubscriptionStatusEnumSchema } from '../../enums/partner-subscription-status.schema.js';
import { PartnerTierEnumSchema } from '../../enums/partner-tier.schema.js';
import { PartnerTypeEnumSchema } from '../../enums/partner-type.schema.js';

/**
 * Partner analytics JSONB structure
 */
export const partnerAnalyticsSchema = z.object({
    impressions: z.number().int().min(0).optional(),
    clicks: z.number().int().min(0).optional()
});

export type PartnerAnalytics = z.infer<typeof partnerAnalyticsSchema>;

/**
 * Base partner schema
 * Core entity structure with all fields
 */
export const partnerSchema = z.object({
    id: z.string().uuid(),
    slug: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1).max(255),
    type: PartnerTypeEnumSchema,
    tier: PartnerTierEnumSchema,
    logoUrl: z.string().url().nullable().optional(),
    websiteUrl: z.string().url().nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    subscriptionStatus: PartnerSubscriptionStatusEnumSchema,
    lifecycleState: LifecycleStatusEnumSchema,
    analytics: partnerAnalyticsSchema.default({}),
    planId: z.string().uuid().nullable().optional(),
    subscriptionId: z.string().uuid().nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    ...BaseAuditFields
});

export type Partner = z.infer<typeof partnerSchema>;
