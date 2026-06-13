import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    SponsorshipIdSchema,
    SponsorshipLevelIdSchema,
    SponsorshipPackageIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { SponsorshipStatusEnum } from '../../enums/sponsorship-status.enum.js';
import { SponsorshipStatusEnumSchema } from '../../enums/sponsorship-status.schema.js';
import { SponsorshipTargetTypeEnumSchema } from '../../enums/sponsorship-target-type.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';

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
    ...BaseLifecycleFields,

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
    sponsorshipStatus: SponsorshipStatusEnumSchema.default(SponsorshipStatusEnum.PENDING),

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
 * Update input for sponsorship.
 *
 * SPEC-063-gaps T-017 (GAP-016, AC-003-03): `.strict()` enforces that legacy keys
 * (e.g. `status`) are rejected at the route boundary with a 400 VALIDATION_ERROR
 * instead of being silently dropped by the Hono zValidator middleware.
 *
 * SPEC-063-gaps T-030 (GAP-015): `sponsorshipStatus` is overridden to `.optional()`
 * (without a default) so the field-level guard in `_beforeUpdate` can distinguish
 * between "caller did not touch sponsorshipStatus" and "caller is mutating it".
 * The base `SponsorshipCreateInputSchema.sponsorshipStatus` keeps `.default(PENDING)`
 * because new sponsorships always start as PENDING.
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const SponsorshipUpdateInputSchema = z
    .object(
        stripShapeDefaults(
            SponsorshipCreateInputSchema.extend({
                sponsorshipStatus: SponsorshipStatusEnumSchema.optional()
            }).shape
        )
    )
    .partial()
    .strict();
export type SponsorshipUpdateInput = z.infer<typeof SponsorshipUpdateInputSchema>;

/**
 * Search input for sponsorships
 */
export const SponsorshipSearchSchema = z.object({
    sponsorUserId: UserIdSchema.optional(),
    targetType: SponsorshipTargetTypeEnumSchema.optional(),
    targetId: z.string().uuid().optional(),
    sponsorshipStatus: SponsorshipStatusEnumSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    // SPEC-063-gaps T-031 (GAP-041): renamed `limit` → `pageSize` to match the
    // monorepo-wide pagination convention (PaginationQuerySchema, AdminSearchBaseSchema).
    // No backward-compat shim per CLAUDE.md policy.
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type SponsorshipSearchInput = z.infer<typeof SponsorshipSearchSchema>;
