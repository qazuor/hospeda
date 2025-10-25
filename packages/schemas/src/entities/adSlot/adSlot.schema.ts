import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { AdSlotIdSchema } from '../../common/id.schema.js';

/**
 * Ad Slot Schema
 *
 * Defines advertising slots available for campaign placement with
 * reservation management, positioning, pricing, and availability tracking.
 */
export const AdSlotSchema = z.object({
    // Base fields
    id: AdSlotIdSchema,
    ...BaseAuditFields,

    // Slot identification and basic info
    name: z
        .string()
        .min(3, { message: 'zodError.adSlot.name.tooShort' })
        .max(200, { message: 'zodError.adSlot.name.tooLong' })
        .describe('Ad slot name for identification'),

    description: z
        .string()
        .min(10, { message: 'zodError.adSlot.description.tooShort' })
        .max(1000, { message: 'zodError.adSlot.description.tooLong' })
        .describe('Detailed description of the ad slot placement'),

    // Slot positioning and placement
    placement: z
        .object({
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
                .max(100)
                .optional()
                .describe(
                    'Specific section identifier (e.g., "search-filters", "recommendations")'
                ),

            priority: z
                .number()
                .int()
                .min(1, { message: 'zodError.adSlot.placement.priority.tooLow' })
                .max(10, { message: 'zodError.adSlot.placement.priority.tooHigh' })
                .describe('Display priority (1=highest, 10=lowest)')
        })
        .describe('Ad slot placement configuration'),

    // Slot dimensions and format requirements
    format: z
        .object({
            width: z
                .number()
                .int()
                .min(50, { message: 'zodError.adSlot.format.width.tooSmall' })
                .max(2000, { message: 'zodError.adSlot.format.width.tooLarge' })
                .describe('Required width in pixels'),

            height: z
                .number()
                .int()
                .min(50, { message: 'zodError.adSlot.format.height.tooSmall' })
                .max(2000, { message: 'zodError.adSlot.format.height.tooLarge' })
                .describe('Required height in pixels'),

            aspectRatio: z
                .string()
                .regex(/^\d+:\d+$/, { message: 'zodError.adSlot.format.aspectRatio.invalid' })
                .optional()
                .describe('Required aspect ratio (e.g., "16:9", "1:1")'),

            allowedFormats: z
                .array(
                    z.enum([
                        'banner',
                        'square',
                        'rectangle',
                        'skyscraper',
                        'leaderboard',
                        'mobile_banner'
                    ])
                )
                .min(1, { message: 'zodError.adSlot.format.allowedFormats.minRequired' })
                .max(6, { message: 'zodError.adSlot.format.allowedFormats.tooMany' })
                .describe('Allowed ad formats for this slot'),

            isResponsive: z
                .boolean()
                .default(true)
                .describe('Whether the slot adapts to different screen sizes')
        })
        .describe('Ad slot format and dimension requirements'),

    // Targeting and visibility rules
    targeting: z
        .object({
            // Geographic targeting
            allowedCountries: z
                .array(z.string().length(2))
                .max(100, { message: 'zodError.adSlot.targeting.countries.tooMany' })
                .optional()
                .describe('Countries where this slot is available'),

            blockedCountries: z
                .array(z.string().length(2))
                .max(50, { message: 'zodError.adSlot.targeting.blockedCountries.tooMany' })
                .default([])
                .describe('Countries where this slot is blocked'),

            // Device targeting
            allowedDevices: z
                .array(z.enum(['desktop', 'mobile', 'tablet']))
                .min(1, { message: 'zodError.adSlot.targeting.devices.minRequired' })
                .default(['desktop', 'mobile', 'tablet'])
                .describe('Allowed device types'),

            // Content targeting
            allowedContentTypes: z
                .array(z.enum(['accommodation', 'destination', 'experience', 'blog', 'general']))
                .min(1, { message: 'zodError.adSlot.targeting.contentTypes.minRequired' })
                .default(['general'])
                .describe('Types of content where this slot can appear'),

            // User targeting
            requiresAuthentication: z
                .boolean()
                .default(false)
                .describe('Whether user must be logged in to see this slot'),

            allowedUserTypes: z
                .array(z.enum(['guest', 'host', 'premium', 'all']))
                .min(1, { message: 'zodError.adSlot.targeting.userTypes.minRequired' })
                .default(['all'])
                .describe('User types that can see this slot')
        })
        .describe('Targeting and visibility rules for the ad slot'),

    // Pricing and monetization
    pricing: z
        .object({
            model: z.enum(['cpm', 'cpc', 'cpa', 'fixed_rate']).describe('Pricing model'),

            basePrice: z
                .number()
                .positive({ message: 'zodError.adSlot.pricing.basePrice.mustBePositive' })
                .max(1000, { message: 'zodError.adSlot.pricing.basePrice.tooHigh' })
                .describe('Base price for the slot'),

            currency: z.string().length(3).default('USD').describe('Pricing currency'),

            minimumBid: z
                .number()
                .positive({ message: 'zodError.adSlot.pricing.minimumBid.mustBePositive' })
                .max(500, { message: 'zodError.adSlot.pricing.minimumBid.tooHigh' })
                .optional()
                .describe('Minimum bid required (for auction-based slots)'),

            premiumMultiplier: z
                .number()
                .positive({ message: 'zodError.adSlot.pricing.premiumMultiplier.mustBePositive' })
                .max(10, { message: 'zodError.adSlot.pricing.premiumMultiplier.tooHigh' })
                .default(1)
                .describe('Multiplier for premium placements'),

            seasonalAdjustments: z
                .array(
                    z.object({
                        startDate: z.date(),
                        endDate: z.date(),
                        multiplier: z.number().positive().max(5),
                        description: z.string().max(200)
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
        .describe('Pricing configuration for the ad slot'),

    // Availability and scheduling
    availability: z
        .object({
            isActive: z.boolean().default(true).describe('Whether the slot is currently active'),

            availableFrom: z.date().optional().describe('Date when slot becomes available'),

            availableUntil: z.date().optional().describe('Date when slot expires'),

            timeSlots: z
                .array(
                    z.object({
                        dayOfWeek: z.number().int().min(0).max(6),
                        startTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
                        endTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
                        timezone: z.string().default('UTC')
                    })
                )
                .max(21, { message: 'zodError.adSlot.availability.timeSlots.tooMany' })
                .default([])
                .describe('Specific time slots when slot is available'),

            maxReservationsPerDay: z
                .number()
                .int()
                .min(1, { message: 'zodError.adSlot.availability.maxReservations.tooLow' })
                .max(100, { message: 'zodError.adSlot.availability.maxReservations.tooHigh' })
                .default(10)
                .describe('Maximum reservations allowed per day'),

            blackoutDates: z
                .array(
                    z.object({
                        startDate: z.date(),
                        endDate: z.date(),
                        reason: z.string().max(200)
                    })
                )
                .max(50, { message: 'zodError.adSlot.availability.blackoutDates.tooMany' })
                .default([])
                .describe('Dates when slot is not available')
        })
        .refine(
            (data) =>
                !data.availableFrom ||
                !data.availableUntil ||
                data.availableFrom < data.availableUntil,
            {
                message: 'zodError.adSlot.availability.invalidDateRange',
                path: ['availableUntil']
            }
        )
        .describe('Availability and scheduling configuration'),

    // Performance tracking
    performance: z
        .object({
            totalImpressions: z
                .number()
                .int()
                .min(0)
                .default(0)
                .describe('Total impressions served'),

            totalClicks: z.number().int().min(0).default(0).describe('Total clicks received'),

            totalRevenue: z.number().min(0).default(0).describe('Total revenue generated'),

            averageCTR: z.number().min(0).max(1).default(0).describe('Average click-through rate'),

            averageRPM: z
                .number()
                .min(0)
                .default(0)
                .describe('Average revenue per mille (1000 impressions)'),

            lastImpressionAt: z.date().optional().describe('Timestamp of last impression'),

            fillRate: z
                .number()
                .min(0)
                .max(1)
                .default(0)
                .describe('Percentage of requests that resulted in served ads')
        })
        .optional()
        .describe('Performance metrics for the ad slot'),

    // Content restrictions and policies
    restrictions: z
        .object({
            blockedCategories: z
                .array(
                    z.enum([
                        'adult',
                        'gambling',
                        'alcohol',
                        'tobacco',
                        'political',
                        'medical',
                        'financial'
                    ])
                )
                .max(7, { message: 'zodError.adSlot.restrictions.blockedCategories.tooMany' })
                .default([])
                .describe('Content categories not allowed in this slot'),

            requiredCertifications: z
                .array(z.string().max(100))
                .max(10, { message: 'zodError.adSlot.restrictions.certifications.tooMany' })
                .default([])
                .describe('Required advertiser certifications'),

            languageRestrictions: z
                .array(z.string().length(2))
                .max(20, { message: 'zodError.adSlot.restrictions.languages.tooMany' })
                .default([])
                .describe('Language restrictions for ad content'),

            allowExternalLinks: z
                .boolean()
                .default(true)
                .describe('Whether ads can link to external websites'),

            requiresReview: z
                .boolean()
                .default(false)
                .describe('Whether ads must be reviewed before going live')
        })
        .optional()
        .describe('Content restrictions and policy requirements'),

    // Metadata and settings
    metadata: z
        .object({
            tags: z
                .array(z.string().max(50))
                .max(20, { message: 'zodError.adSlot.metadata.tags.tooMany' })
                .default([])
                .describe('Tags for organization and filtering'),

            category: z.string().max(100).optional().describe('Slot category for grouping'),

            notes: z.string().max(2000).optional().describe('Internal notes about the ad slot'),

            isTestSlot: z
                .boolean()
                .default(false)
                .describe('Whether this is a test slot for development'),

            autoApprove: z
                .boolean()
                .default(false)
                .describe('Whether reservations are automatically approved'),

            supportContact: z
                .string()
                .email()
                .optional()
                .describe('Contact email for slot-related issues')
        })
        .optional()
        .describe('Additional metadata and settings')
});

export type AdSlot = z.infer<typeof AdSlotSchema>;
