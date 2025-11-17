import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BenefitListingPlanIdSchema } from '../../common/id.schema.js';

/**
 * Benefit Listing Plan Limits Schema
 * Defines the capabilities and restrictions of a benefit listing plan
 */
export const BenefitListingPlanLimitsSchema = z
    .object({
        maxListings: z
            .number()
            .int()
            .positive({ message: 'zodError.benefitListingPlan.limits.maxListings.positive' })
            .optional(),
        maxBenefitsPerListing: z
            .number()
            .int()
            .positive({
                message: 'zodError.benefitListingPlan.limits.maxBenefitsPerListing.positive'
            })
            .optional(),
        allowCustomBranding: z.boolean().optional(),
        allowAnalytics: z.boolean().optional(),
        allowPromotions: z.boolean().optional(),
        allowTrialPeriods: z.boolean().optional(),
        maxTrialDays: z
            .number()
            .int()
            .positive({ message: 'zodError.benefitListingPlan.limits.maxTrialDays.positive' })
            .optional(),
        features: z.array(z.string()).optional()
    })
    .optional();

export type BenefitListingPlanLimits = z.infer<typeof BenefitListingPlanLimitsSchema>;

/**
 * BenefitListingPlan Schema - Plans that define limits and features for benefit listings
 *
 * Defines the features and restrictions that apply to benefit listings
 * purchased by clients for their accommodations.
 */
export const BenefitListingPlanSchema = z.object({
    // Base fields
    id: BenefitListingPlanIdSchema,
    ...BaseAuditFields,

    // Plan information
    name: z
        .string({ message: 'zodError.benefitListingPlan.name.required' })
        .min(1, { message: 'zodError.benefitListingPlan.name.min' })
        .max(255, { message: 'zodError.benefitListingPlan.name.max' }),

    description: z
        .string()
        .max(1000, { message: 'zodError.benefitListingPlan.description.max' })
        .optional(),

    // Plan limits and features
    limits: BenefitListingPlanLimitsSchema,

    // Admin metadata
    ...BaseAdminFields
});

export type BenefitListingPlan = z.infer<typeof BenefitListingPlanSchema>;
