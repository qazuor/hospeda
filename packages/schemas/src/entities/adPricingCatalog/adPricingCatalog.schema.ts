import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { AdPricingCatalogIdSchema, AdSlotIdSchema } from '../../common/id.schema.js';
import {
    CampaignChannelSchema,
    PricingModelEnum,
    PricingModelEnumSchema
} from '../../enums/index.js';

/**
 * Ad Pricing Catalog Pricing Config Schema
 *
 * Defines the dynamic pricing configuration options including seasonal
 * multipliers, audience targeting rates, geographic pricing, and custom rules.
 */
export const AdPricingCatalogPricingConfigSchema = z
    .object({
        // Dynamic pricing options
        demandMultiplier: z.number().positive().optional(),
        seasonalMultipliers: z.record(z.string(), z.number().positive()).optional(),

        // Audience targeting surcharges
        audienceTargetingRates: z.record(z.string(), z.number().positive()).optional(),

        // Geographic pricing
        geographicMultipliers: z.record(z.string(), z.number().positive()).optional(),

        // Custom pricing rules
        customRules: z
            .array(
                z.object({
                    condition: z.string().min(1, {
                        message: 'zodError.adPricingCatalog.pricingConfig.customRules.condition.min'
                    }),
                    multiplier: z.number().positive({
                        message:
                            'zodError.adPricingCatalog.pricingConfig.customRules.multiplier.positive'
                    }),
                    description: z.string().min(1, {
                        message:
                            'zodError.adPricingCatalog.pricingConfig.customRules.description.min'
                    })
                })
            )
            .optional()
    })
    .optional();

/**
 * Ad Pricing Catalog Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an AdPricingCatalog entity
 * representing pricing configurations for advertising slots with channel-specific pricing.
 */
export const AdPricingCatalogSchema = z.object({
    // Base fields
    id: AdPricingCatalogIdSchema,
    ...BaseAuditFields,

    // Ad Pricing Catalog-specific core fields
    adSlotId: AdSlotIdSchema,

    // Channel-specific pricing
    channel: CampaignChannelSchema,

    // Pricing structure
    basePrice: z
        .number({
            message: 'zodError.adPricingCatalog.basePrice.required'
        })
        .positive({ message: 'zodError.adPricingCatalog.basePrice.positive' }),

    currency: z
        .string({
            message: 'zodError.adPricingCatalog.currency.required'
        })
        .min(3, { message: 'zodError.adPricingCatalog.currency.min' })
        .max(3, { message: 'zodError.adPricingCatalog.currency.max' })
        .default('USD'),

    // Pricing model
    pricingModel: PricingModelEnumSchema.default(PricingModelEnum.CPM),

    // Time-based pricing (optional)
    dailyRate: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.dailyRate.positive' })
        .optional(),

    weeklyRate: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.weeklyRate.positive' })
        .optional(),

    monthlyRate: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.monthlyRate.positive' })
        .optional(),

    // Premium multipliers
    weekendMultiplier: z
        .number({
            message: 'zodError.adPricingCatalog.weekendMultiplier.required'
        })
        .positive({ message: 'zodError.adPricingCatalog.weekendMultiplier.positive' })
        .default(1.0),

    holidayMultiplier: z
        .number({
            message: 'zodError.adPricingCatalog.holidayMultiplier.required'
        })
        .positive({ message: 'zodError.adPricingCatalog.holidayMultiplier.positive' })
        .default(1.0),

    // Budget constraints (optional)
    minimumBudget: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.minimumBudget.positive' })
        .optional(),

    maximumBudget: z
        .number()
        .positive({ message: 'zodError.adPricingCatalog.maximumBudget.positive' })
        .optional(),

    // Availability and scheduling (optional)
    availableFrom: z
        .date({
            message: 'zodError.adPricingCatalog.availableFrom.invalid'
        })
        .optional(),

    availableUntil: z
        .date({
            message: 'zodError.adPricingCatalog.availableUntil.invalid'
        })
        .optional(),

    // Pricing metadata and configuration
    pricingConfig: AdPricingCatalogPricingConfigSchema,

    // Catalog metadata
    description: z
        .string()
        .min(1, { message: 'zodError.adPricingCatalog.description.min' })
        .max(1000, { message: 'zodError.adPricingCatalog.description.max' })
        .optional(),

    isActive: z
        .boolean({
            message: 'zodError.adPricingCatalog.isActive.required'
        })
        .default(true),

    // Admin metadata
    adminInfo: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type export for the main AdPricingCatalog entity
 */
export type AdPricingCatalog = z.infer<typeof AdPricingCatalogSchema>;

/**
 * Type export for AdPricingCatalog pricing configuration
 */
export type AdPricingCatalogPricingConfig = z.infer<typeof AdPricingCatalogPricingConfigSchema>;
