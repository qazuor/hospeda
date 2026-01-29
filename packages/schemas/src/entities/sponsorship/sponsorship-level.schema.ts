import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SponsorshipLevelIdSchema } from '../../common/id.schema.js';
import { SponsorshipTargetTypeEnumSchema } from '../../enums/sponsorship-target-type.schema.js';
import { SponsorshipTierEnumSchema } from '../../enums/sponsorship-tier.schema.js';

/**
 * Benefit definition for a sponsorship level
 */
export const SponsorshipBenefitSchema = z.object({
    key: z.string({
        message: 'zodError.sponsorshipLevel.benefit.key.required'
    }),
    label: z.string({
        message: 'zodError.sponsorshipLevel.benefit.label.required'
    }),
    description: z.string().optional()
});
export type SponsorshipBenefit = z.infer<typeof SponsorshipBenefitSchema>;

/**
 * Sponsorship Level entity schema
 */
export const SponsorshipLevelSchema = z.object({
    id: SponsorshipLevelIdSchema,
    ...BaseAuditFields,

    slug: z
        .string({
            message: 'zodError.sponsorshipLevel.slug.required'
        })
        .min(1, { message: 'zodError.sponsorshipLevel.slug.min' }),

    name: z
        .string({
            message: 'zodError.sponsorshipLevel.name.required'
        })
        .min(1, { message: 'zodError.sponsorshipLevel.name.min' })
        .max(100, { message: 'zodError.sponsorshipLevel.name.max' }),

    description: z
        .string()
        .max(500, { message: 'zodError.sponsorshipLevel.description.max' })
        .optional()
        .nullable(),

    targetType: SponsorshipTargetTypeEnumSchema,
    tier: SponsorshipTierEnumSchema,

    priceAmount: z
        .number({
            message: 'zodError.sponsorshipLevel.priceAmount.required'
        })
        .int({ message: 'zodError.sponsorshipLevel.priceAmount.int' })
        .min(0, { message: 'zodError.sponsorshipLevel.priceAmount.min' }),

    priceCurrency: z
        .string({
            message: 'zodError.sponsorshipLevel.priceCurrency.required'
        })
        .default('ARS'),

    benefits: z.array(SponsorshipBenefitSchema).default([]),

    sortOrder: z.number().int({ message: 'zodError.sponsorshipLevel.sortOrder.int' }).default(0),

    isActive: z.boolean().default(true)
});
export type SponsorshipLevel = z.infer<typeof SponsorshipLevelSchema>;

/**
 * Create input for sponsorship level
 */
export const SponsorshipLevelCreateInputSchema = SponsorshipLevelSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).extend({
    slug: z
        .string({
            message: 'zodError.sponsorshipLevel.slug.required'
        })
        .min(1, { message: 'zodError.sponsorshipLevel.slug.min' })
        .optional()
});
export type SponsorshipLevelCreateInput = z.infer<typeof SponsorshipLevelCreateInputSchema>;

/**
 * Update input for sponsorship level
 */
export const SponsorshipLevelUpdateInputSchema = SponsorshipLevelCreateInputSchema.partial();
export type SponsorshipLevelUpdateInput = z.infer<typeof SponsorshipLevelUpdateInputSchema>;

/**
 * Search input for sponsorship levels
 */
export const SponsorshipLevelSearchSchema = z.object({
    targetType: SponsorshipTargetTypeEnumSchema.optional(),
    tier: SponsorshipTierEnumSchema.optional(),
    isActive: z.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type SponsorshipLevelSearchInput = z.infer<typeof SponsorshipLevelSearchSchema>;
