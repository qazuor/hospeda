import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ServiceListingPlanIdSchema } from '../../common/id.schema.js';
import { SupportLevelSchema } from '../../enums/support-level.schema.js';
import { numericField } from '../../utils/index.js';

/**
 * Service Listing Plan Limits Schema
 * Defines the capabilities and restrictions of a service listing plan
 */
export const ServiceListingPlanLimitsSchema = z
    .object({
        maxListings: z
            .number()
            .int()
            .positive({ message: 'zodError.serviceListingPlan.limits.maxListings.positive' })
            .optional(),
        maxPhotos: z
            .number()
            .int()
            .positive({ message: 'zodError.serviceListingPlan.limits.maxPhotos.positive' })
            .optional(),
        maxVideos: z
            .number()
            .int()
            .nonnegative({ message: 'zodError.serviceListingPlan.limits.maxVideos.nonnegative' })
            .optional(),
        maxFeaturedDays: z
            .number()
            .int()
            .positive({ message: 'zodError.serviceListingPlan.limits.maxFeaturedDays.positive' })
            .optional(),
        maxDescriptionLength: z
            .number()
            .int()
            .positive({
                message: 'zodError.serviceListingPlan.limits.maxDescriptionLength.positive'
            })
            .optional(),
        allowPremiumFeatures: z.boolean().optional(),
        allowAnalytics: z.boolean().optional(),
        allowCustomPricing: z.boolean().optional(),
        allowMultiLanguage: z.boolean().optional(),
        allowCustomBranding: z.boolean().optional(),
        allowBookingIntegration: z.boolean().optional(),
        allowTrialPeriods: z.boolean().optional(),
        maxTrialDays: z
            .number()
            .int()
            .positive({ message: 'zodError.serviceListingPlan.limits.maxTrialDays.positive' })
            .optional(),
        supportLevel: SupportLevelSchema.optional(),
        refreshInterval: z
            .number()
            .int()
            .positive({ message: 'zodError.serviceListingPlan.limits.refreshInterval.positive' })
            .optional(),
        features: z.array(z.string()).optional()
    })
    .optional();

export type ServiceListingPlanLimits = z.infer<typeof ServiceListingPlanLimitsSchema>;

/**
 * ServiceListingPlan Schema - Plans that define limits and features for service listings
 *
 * Defines the features, restrictions, and pricing for service listings
 * that can be purchased by clients for promoting their tourist services.
 */
export const ServiceListingPlanSchema = z.object({
    // Base fields
    id: ServiceListingPlanIdSchema,
    ...BaseAuditFields,

    // Plan details
    name: z
        .string({ message: 'zodError.serviceListingPlan.name.required' })
        .min(1, { message: 'zodError.serviceListingPlan.name.min' })
        .max(255, { message: 'zodError.serviceListingPlan.name.max' }),

    description: z
        .string()
        .max(1000, { message: 'zodError.serviceListingPlan.description.max' })
        .optional(),

    // Pricing
    price: numericField(z.number().nonnegative()),

    // Plan limits and features
    limits: ServiceListingPlanLimitsSchema,

    // Plan status
    isActive: z.boolean().default(true),
    isTrialAvailable: z.boolean().default(false),
    trialDays: numericField(z.number().int().nonnegative()).default(0),

    // Admin metadata
    ...BaseAdminFields
});

export type ServiceListingPlan = z.infer<typeof ServiceListingPlanSchema>;
