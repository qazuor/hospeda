import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { UserIdSchema } from '../../common/id.schema.js';
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
    /**
     * The account that owns this partner listing.
     *
     * Null for curated partners the admin created by hand, and for a
     * provisioned partner whose anonymous applicant has not redeemed their
     * claim token yet. Ownership queries must therefore fail CLOSED on null.
     */
    ownerUserId: UserIdSchema.nullish(),
    /**
     * When the alliance began — null until it actually does.
     *
     * Relaxed from required (HOS-278 D1): provisioning creates the row before
     * any payment, so a DRAFT partner genuinely has no start date and must not
     * be forced to invent one. Written for real when the subscription
     * activates.
     */
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    ...BaseAuditFields
});

export type Partner = z.infer<typeof partnerSchema>;
