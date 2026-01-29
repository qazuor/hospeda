import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    SponsorshipIdSchema,
    SponsorshipLevelIdSchema,
    SponsorshipPackageIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { SponsorshipStatusEnum } from '../../enums/sponsorship-status.enum.js';
import { SponsorshipStatusEnumSchema } from '../../enums/sponsorship-status.schema.js';
import { SponsorshipTargetTypeEnumSchema } from '../../enums/sponsorship-target-type.schema.js';

/**
 * Sponsorship analytics data
 */
export const SponsorshipAnalyticsSchema = z
    .object({
        impressions: z
            .number()
            .int({ message: 'zodError.sponsorship.analytics.impressions.int' })
            .min(0, { message: 'zodError.sponsorship.analytics.impressions.min' })
            .default(0),
        clicks: z
            .number()
            .int({ message: 'zodError.sponsorship.analytics.clicks.int' })
            .min(0, { message: 'zodError.sponsorship.analytics.clicks.min' })
            .default(0),
        couponsUsed: z
            .number()
            .int({ message: 'zodError.sponsorship.analytics.couponsUsed.int' })
            .min(0, { message: 'zodError.sponsorship.analytics.couponsUsed.min' })
            .default(0)
    })
    .default({
        impressions: 0,
        clicks: 0,
        couponsUsed: 0
    });
export type SponsorshipAnalytics = z.infer<typeof SponsorshipAnalyticsSchema>;

/**
 * Sponsorship entity schema
 */
export const SponsorshipSchema = z.object({
    id: SponsorshipIdSchema,
    ...BaseAuditFields,

    slug: z
        .string({
            message: 'zodError.sponsorship.slug.required'
        })
        .min(1, { message: 'zodError.sponsorship.slug.min' }),

    sponsorUserId: UserIdSchema,
    targetType: SponsorshipTargetTypeEnumSchema,

    targetId: z
        .string({
            message: 'zodError.sponsorship.targetId.required'
        })
        .uuid({ message: 'zodError.sponsorship.targetId.uuid' }),

    levelId: SponsorshipLevelIdSchema,
    packageId: SponsorshipPackageIdSchema.nullable().optional(),
    status: SponsorshipStatusEnumSchema.default(SponsorshipStatusEnum.PENDING),

    startsAt: z.coerce.date({
        message: 'zodError.sponsorship.startsAt.required'
    }),

    endsAt: z.coerce
        .date({
            message: 'zodError.sponsorship.endsAt.invalid'
        })
        .nullable()
        .optional(),

    paymentId: z.string().nullable().optional(),

    logoUrl: z.string().url({ message: 'zodError.sponsorship.logoUrl.url' }).nullable().optional(),

    linkUrl: z.string().url({ message: 'zodError.sponsorship.linkUrl.url' }).nullable().optional(),

    couponCode: z.string().nullable().optional(),

    couponDiscountPercent: z
        .number()
        .int({ message: 'zodError.sponsorship.couponDiscountPercent.int' })
        .min(0, { message: 'zodError.sponsorship.couponDiscountPercent.min' })
        .max(100, { message: 'zodError.sponsorship.couponDiscountPercent.max' })
        .nullable()
        .optional(),

    analytics: SponsorshipAnalyticsSchema
});
export type Sponsorship = z.infer<typeof SponsorshipSchema>;

/**
 * Create input for sponsorship
 */
export const SponsorshipCreateInputSchema = SponsorshipSchema.omit({
    id: true,
    analytics: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).extend({
    slug: z
        .string({
            message: 'zodError.sponsorship.slug.required'
        })
        .min(1, { message: 'zodError.sponsorship.slug.min' })
        .optional()
});
export type SponsorshipCreateInput = z.infer<typeof SponsorshipCreateInputSchema>;

/**
 * Update input for sponsorship
 */
export const SponsorshipUpdateInputSchema = SponsorshipCreateInputSchema.partial();
export type SponsorshipUpdateInput = z.infer<typeof SponsorshipUpdateInputSchema>;

/**
 * Search input for sponsorships
 */
export const SponsorshipSearchSchema = z.object({
    sponsorUserId: UserIdSchema.optional(),
    targetType: SponsorshipTargetTypeEnumSchema.optional(),
    targetId: z.string().uuid().optional(),
    status: SponsorshipStatusEnumSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type SponsorshipSearchInput = z.infer<typeof SponsorshipSearchSchema>;
