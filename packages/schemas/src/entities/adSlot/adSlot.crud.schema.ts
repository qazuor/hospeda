import { z } from 'zod';
import { AdSlotSchema } from './adSlot.schema.js';

/**
 * AdSlot CRUD Schemas
 *
 * Validation schemas for creating, updating, and managing ad slots
 * with business logic validations and slot-specific constraints.
 */

// Base schema for ad slot creation
export const CreateAdSlotSchema = AdSlotSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    version: true,
    performance: true
})
    .extend({
        // Override placement with stricter validation for creation
        placement: z.object({
            page: z
                .enum([
                    'homepage',
                    'search_results',
                    'accommodation_detail',
                    'booking_flow',
                    'user_profile',
                    'destination_page',
                    'blog_post',
                    'email_newsletter'
                ])
                .describe('Page where the ad slot appears'),

            position: z
                .enum([
                    'header',
                    'sidebar_top',
                    'sidebar_bottom',
                    'content_top',
                    'content_middle',
                    'content_bottom',
                    'footer',
                    'overlay',
                    'banner',
                    'sponsored_content'
                ])
                .describe('Position within the page'),

            section: z
                .string()
                .min(3, { message: 'zodError.adSlot.placement.section.tooShort' })
                .max(100, { message: 'zodError.adSlot.placement.section.tooLong' })
                .optional()
                .describe('Specific section identifier'),

            priority: z
                .number()
                .int()
                .min(1, { message: 'zodError.adSlot.placement.priority.tooLow' })
                .max(10, { message: 'zodError.adSlot.placement.priority.tooHigh' })
                .describe('Display priority (1=highest, 10=lowest)')
        }),

        // Override pricing with creation-specific validation
        pricing: z
            .object({
                model: z.enum(['cpm', 'cpc', 'cpa', 'fixed_rate']).describe('Pricing model'),

                basePrice: z
                    .number()
                    .positive({ message: 'zodError.adSlot.pricing.basePrice.mustBePositive' })
                    .max(1000, { message: 'zodError.adSlot.pricing.basePrice.tooHigh' })
                    .describe('Base price for the slot'),

                currency: z
                    .string()
                    .length(3, { message: 'zodError.adSlot.pricing.currency.invalidLength' })
                    .regex(/^[A-Z]{3}$/, {
                        message: 'zodError.adSlot.pricing.currency.invalidFormat'
                    })
                    .default('USD')
                    .describe('Pricing currency'),

                minimumBid: z
                    .number()
                    .positive({ message: 'zodError.adSlot.pricing.minimumBid.mustBePositive' })
                    .max(500, { message: 'zodError.adSlot.pricing.minimumBid.tooHigh' })
                    .optional()
                    .describe('Minimum bid required'),

                premiumMultiplier: z
                    .number()
                    .positive({
                        message: 'zodError.adSlot.pricing.premiumMultiplier.mustBePositive'
                    })
                    .min(0.1, { message: 'zodError.adSlot.pricing.premiumMultiplier.tooLow' })
                    .max(10, { message: 'zodError.adSlot.pricing.premiumMultiplier.tooHigh' })
                    .default(1)
                    .describe('Multiplier for premium placements'),

                seasonalAdjustments: z
                    .array(
                        z.object({
                            startDate: z.date(),
                            endDate: z.date(),
                            multiplier: z.number().positive().min(0.1).max(5),
                            description: z.string().min(5).max(200)
                        })
                    )
                    .max(12, { message: 'zodError.adSlot.pricing.seasonalAdjustments.tooMany' })
                    .default([])
                    .describe('Seasonal pricing adjustments')
            })
            .refine((data) => !data.minimumBid || data.minimumBid <= data.basePrice, {
                message: 'zodError.adSlot.pricing.minimumBid.exceedsBasePrice',
                path: ['minimumBid']
            })
    })
    .refine(
        (data) => {
            // Validate format dimensions match allowed formats
            const { width, height, allowedFormats } = data.format;
            const aspectRatio = width / height;

            const formatValidation: Record<
                string,
                { minWidth: number; maxWidth: number; aspectRange: [number, number] }
            > = {
                banner: { minWidth: 300, maxWidth: 970, aspectRange: [2, 6] },
                square: { minWidth: 200, maxWidth: 600, aspectRange: [0.8, 1.2] },
                rectangle: { minWidth: 300, maxWidth: 600, aspectRange: [1.2, 2.5] },
                skyscraper: { minWidth: 120, maxWidth: 300, aspectRange: [0.2, 0.8] },
                leaderboard: { minWidth: 728, maxWidth: 970, aspectRange: [4, 8] },
                mobile_banner: { minWidth: 300, maxWidth: 400, aspectRange: [2, 4] }
            };

            return allowedFormats.every((format) => {
                const rules = formatValidation[format];
                if (!rules) return true;

                return (
                    width >= rules.minWidth &&
                    width <= rules.maxWidth &&
                    aspectRatio >= rules.aspectRange[0] &&
                    aspectRatio <= rules.aspectRange[1]
                );
            });
        },
        {
            message: 'zodError.adSlot.format.dimensionsMismatchFormats',
            path: ['format', 'allowedFormats']
        }
    )
    .refine(
        (data) => {
            // Validate blackout dates don't overlap with availability dates
            if (!data.availability.availableFrom || !data.availability.availableUntil) return true;

            return data.availability.blackoutDates.every((blackout) => {
                const availableFrom = data.availability.availableFrom;
                const availableUntil = data.availability.availableUntil;

                return (
                    availableFrom &&
                    availableUntil &&
                    blackout.startDate >= availableFrom &&
                    blackout.endDate <= availableUntil
                );
            });
        },
        {
            message: 'zodError.adSlot.availability.blackoutDatesOutsideRange',
            path: ['availability', 'blackoutDates']
        }
    );

// Partial update schema
export const UpdateAdSlotSchema = CreateAdSlotSchema.partial().extend({
    id: AdSlotSchema.shape.id
});

// Schema for updating pricing specifically
export const UpdateAdSlotPricingSchema = z.object({
    id: AdSlotSchema.shape.id,
    pricing: CreateAdSlotSchema.shape.pricing,
    reason: z
        .string()
        .min(10, { message: 'zodError.adSlot.pricing.updateReason.tooShort' })
        .max(500, { message: 'zodError.adSlot.pricing.updateReason.tooLong' })
        .describe('Reason for pricing change'),
    effectiveDate: z
        .date()
        .min(new Date(), { message: 'zodError.adSlot.pricing.effectiveDate.mustBeFuture' })
        .describe('When the new pricing takes effect')
});

// Schema for updating availability
export const UpdateAdSlotAvailabilitySchema = z.object({
    id: AdSlotSchema.shape.id,
    availability: CreateAdSlotSchema.shape.availability,
    notifyReservations: z
        .boolean()
        .default(true)
        .describe('Whether to notify existing reservations of availability changes')
});

// Schema for updating performance metrics (system use only)
export const UpdateAdSlotPerformanceSchema = z
    .object({
        id: AdSlotSchema.shape.id,
        impressions: z.number().int().min(0).describe('Number of impressions to add'),
        clicks: z.number().int().min(0).default(0).describe('Number of clicks to add'),
        revenue: z.number().min(0).default(0).describe('Revenue amount to add'),
        timestamp: z
            .date()
            .default(() => new Date())
            .describe('Timestamp of the performance update')
    })
    .refine((data) => data.clicks <= data.impressions, {
        message: 'zodError.adSlot.performance.clicksExceedImpressions',
        path: ['clicks']
    });

// Schema for slot activation/deactivation
export const UpdateAdSlotStatusSchema = z.object({
    id: AdSlotSchema.shape.id,
    isActive: z.boolean().describe('Whether to activate or deactivate the slot'),
    reason: z
        .string()
        .min(5, { message: 'zodError.adSlot.status.reason.tooShort' })
        .max(500, { message: 'zodError.adSlot.status.reason.tooLong' })
        .describe('Reason for status change'),
    notifyAffectedCampaigns: z
        .boolean()
        .default(true)
        .describe('Whether to notify campaigns using this slot')
});

// Schema for bulk operations
export const BulkUpdateAdSlotsSchema = z.object({
    slotIds: z
        .array(AdSlotSchema.shape.id)
        .min(1, { message: 'zodError.adSlot.bulk.slotIds.minRequired' })
        .max(50, { message: 'zodError.adSlot.bulk.slotIds.tooMany' })
        .describe('Array of slot IDs to update'),

    operation: z.enum(['activate', 'deactivate', 'update_pricing', 'update_restrictions']),

    data: z
        .union([
            // For pricing updates
            z.object({
                pricing: CreateAdSlotSchema.shape.pricing,
                reason: z.string().min(10).max(500)
            }),
            // For restriction updates
            z.object({
                restrictions: CreateAdSlotSchema.shape.restrictions
            }),
            // For status updates
            z.object({
                isActive: z.boolean(),
                reason: z.string().min(5).max(500)
            })
        ])
        .describe('Operation-specific data'),

    executeAt: z
        .date()
        .min(new Date(), { message: 'zodError.adSlot.bulk.executeAt.mustBeFuture' })
        .optional()
        .describe('When to execute the bulk operation')
});

// Schema for slot cloning/duplication
export const CloneAdSlotSchema = z.object({
    sourceSlotId: AdSlotSchema.shape.id.describe('ID of the slot to clone'),

    newSlotData: z
        .object({
            name: CreateAdSlotSchema.shape.name,
            placement: CreateAdSlotSchema.shape.placement,
            pricing: CreateAdSlotSchema.shape.pricing.optional(),
            availability: CreateAdSlotSchema.shape.availability.optional()
        })
        .describe('Data for the new cloned slot'),

    copyPerformanceData: z
        .boolean()
        .default(false)
        .describe('Whether to copy performance metrics (usually false)'),

    copyRestrictions: z.boolean().default(true).describe('Whether to copy content restrictions')
});

export type CreateAdSlot = z.infer<typeof CreateAdSlotSchema>;
export type UpdateAdSlot = z.infer<typeof UpdateAdSlotSchema>;
export type UpdateAdSlotPricing = z.infer<typeof UpdateAdSlotPricingSchema>;
export type UpdateAdSlotAvailability = z.infer<typeof UpdateAdSlotAvailabilitySchema>;
export type UpdateAdSlotPerformance = z.infer<typeof UpdateAdSlotPerformanceSchema>;
export type UpdateAdSlotStatus = z.infer<typeof UpdateAdSlotStatusSchema>;
export type BulkUpdateAdSlots = z.infer<typeof BulkUpdateAdSlotsSchema>;
export type CloneAdSlot = z.infer<typeof CloneAdSlotSchema>;
