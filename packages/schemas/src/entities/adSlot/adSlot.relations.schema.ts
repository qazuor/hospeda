import { z } from 'zod';
import { AdMediaAssetIdSchema, CampaignIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { AdSlotSchema } from './adSlot.schema.js';

/**
 * AdSlot Relations Schemas
 *
 * Defines relationships between ad slots and other entities including
 * campaigns, reservations, media assets, and performance analytics.
 */

// Ad slot reservation schema
export const AdSlotReservationSchema = z
    .object({
        id: z.string().uuid(),
        adSlotId: AdSlotSchema.shape.id,
        campaignId: CampaignIdSchema,

        // Reservation details
        reservedBy: UserIdSchema.describe('User who made the reservation'),
        reservationDate: z.date().describe('When the reservation was made'),

        // Schedule
        startDate: z.date().describe('Campaign start date for this slot'),
        endDate: z.date().describe('Campaign end date for this slot'),

        // Time slots (if slot has time restrictions)
        timeSlots: z
            .array(
                z.object({
                    dayOfWeek: z.number().int().min(0).max(6),
                    startTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
                    endTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
                    timezone: z.string().default('UTC')
                })
            )
            .max(21)
            .default([])
            .describe('Specific time slots reserved'),

        // Status and approval
        status: z.enum(['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled']),
        approvedBy: UserIdSchema.optional().describe('User who approved the reservation'),
        approvedAt: z.date().optional().describe('When the reservation was approved'),

        // Pricing and payment
        agreedPrice: z.number().positive().describe('Agreed price for the reservation'),
        currency: z.string().length(3).default('USD'),
        paymentStatus: z.enum(['pending', 'paid', 'refunded', 'disputed']).default('pending'),

        // Terms and conditions
        terms: z
            .object({
                cancellationPolicy: z.enum(['flexible', 'moderate', 'strict']).default('moderate'),
                cancellationDeadline: z.date().optional(),
                minimumDuration: z.number().int().min(1).default(1),
                maximumDuration: z.number().int().max(365).optional(),
                autoRenewal: z.boolean().default(false)
            })
            .optional(),

        // Notes and communication
        notes: z.string().max(1000).optional().describe('Reservation notes'),
        rejectionReason: z.string().max(500).optional().describe('Reason for rejection'),

        // Metadata
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().optional()
    })
    .refine((data) => data.startDate <= data.endDate, {
        message: 'zodError.adSlotReservation.invalidDateRange',
        path: ['endDate']
    })
    .refine((data) => (data.status === 'approved' ? !!data.approvedBy : true), {
        message: 'zodError.adSlotReservation.approvedByRequired',
        path: ['approvedBy']
    });

// Ad slot with campaign assignment
export const AdSlotWithCampaignSchema = AdSlotSchema.extend({
    currentCampaign: z
        .object({
            campaignId: CampaignIdSchema,
            campaignName: z.string(),
            reservationId: z.string().uuid(),
            startDate: z.date(),
            endDate: z.date(),
            status: z.enum(['pending', 'approved', 'active', 'completed']),
            performance: z
                .object({
                    impressions: z.number().int().min(0).default(0),
                    clicks: z.number().int().min(0).default(0),
                    revenue: z.number().min(0).default(0),
                    ctr: z.number().min(0).max(1).default(0)
                })
                .optional()
        })
        .optional()
        .describe('Currently assigned campaign'),

    upcomingCampaigns: z
        .array(
            z.object({
                campaignId: CampaignIdSchema,
                campaignName: z.string(),
                reservationId: z.string().uuid(),
                startDate: z.date(),
                endDate: z.date(),
                status: z.enum(['pending', 'approved'])
            })
        )
        .max(10)
        .default([])
        .describe('Upcoming campaign reservations'),

    reservationHistory: z
        .array(
            z.object({
                campaignId: CampaignIdSchema,
                campaignName: z.string(),
                reservationId: z.string().uuid(),
                startDate: z.date(),
                endDate: z.date(),
                status: z.enum(['completed', 'cancelled']),
                finalRevenue: z.number().min(0).default(0),
                completedAt: z.date()
            })
        )
        .max(50)
        .default([])
        .describe('Historical reservations for this slot')
});

// Ad slot media assets relationship
export const AdSlotMediaAssetsSchema = z.object({
    adSlotId: AdSlotSchema.shape.id,

    // Default/template assets for the slot
    defaultAssets: z
        .array(
            z.object({
                assetId: AdMediaAssetIdSchema,
                assetType: z.enum(['image', 'video', 'gif', 'interactive']),
                purpose: z.enum(['background', 'placeholder', 'template', 'preview']),
                isDefault: z.boolean().default(false),
                displayOrder: z.number().int().min(1).default(1)
            })
        )
        .max(10)
        .default([])
        .describe('Default assets for this slot'),

    // Current active assets (from campaign)
    activeAssets: z
        .array(
            z.object({
                assetId: AdMediaAssetIdSchema,
                campaignId: CampaignIdSchema,
                assetType: z.enum(['image', 'video', 'gif', 'interactive']),
                startDate: z.date(),
                endDate: z.date(),
                displayOrder: z.number().int().min(1).default(1),
                isActive: z.boolean().default(true)
            })
        )
        .max(5)
        .default([])
        .describe('Currently active campaign assets'),

    // Asset performance tracking
    assetPerformance: z
        .array(
            z.object({
                assetId: AdMediaAssetIdSchema,
                impressions: z.number().int().min(0).default(0),
                clicks: z.number().int().min(0).default(0),
                ctr: z.number().min(0).max(1).default(0),
                lastShown: z.date().optional()
            })
        )
        .max(20)
        .default([])
        .describe('Performance metrics for assets in this slot')
});

// Ad slot targeting analytics
export const AdSlotTargetingAnalyticsSchema = z.object({
    adSlotId: AdSlotSchema.shape.id,

    // Geographic performance
    geographicPerformance: z
        .array(
            z.object({
                country: z.string().length(2),
                impressions: z.number().int().min(0).default(0),
                clicks: z.number().int().min(0).default(0),
                revenue: z.number().min(0).default(0),
                ctr: z.number().min(0).max(1).default(0),
                rpm: z.number().min(0).default(0)
            })
        )
        .max(100)
        .default([])
        .describe('Performance breakdown by country'),

    // Device performance
    devicePerformance: z
        .array(
            z.object({
                device: z.enum(['desktop', 'mobile', 'tablet']),
                impressions: z.number().int().min(0).default(0),
                clicks: z.number().int().min(0).default(0),
                revenue: z.number().min(0).default(0),
                ctr: z.number().min(0).max(1).default(0),
                fillRate: z.number().min(0).max(1).default(0)
            })
        )
        .max(3)
        .default([])
        .describe('Performance breakdown by device type'),

    // Content type performance
    contentPerformance: z
        .array(
            z.object({
                contentType: z.enum([
                    'accommodation',
                    'destination',
                    'experience',
                    'blog',
                    'general'
                ]),
                impressions: z.number().int().min(0).default(0),
                clicks: z.number().int().min(0).default(0),
                revenue: z.number().min(0).default(0),
                ctr: z.number().min(0).max(1).default(0),
                engagementRate: z.number().min(0).max(1).default(0)
            })
        )
        .max(5)
        .default([])
        .describe('Performance breakdown by content type'),

    // Time-based performance
    timePerformance: z
        .array(
            z.object({
                hour: z.number().int().min(0).max(23),
                dayOfWeek: z.number().int().min(0).max(6),
                impressions: z.number().int().min(0).default(0),
                clicks: z.number().int().min(0).default(0),
                ctr: z.number().min(0).max(1).default(0),
                optimalForTargeting: z.boolean().default(false)
            })
        )
        .max(168) // 24 hours * 7 days
        .default([])
        .describe('Performance breakdown by time slots'),

    // Audience insights
    audienceInsights: z
        .object({
            topPerformingUserTypes: z
                .array(
                    z.object({
                        userType: z.enum(['guest', 'host', 'premium', 'all']),
                        conversionRate: z.number().min(0).max(1).default(0),
                        averageRevenue: z.number().min(0).default(0),
                        engagementScore: z.number().min(0).max(10).default(0)
                    })
                )
                .max(4)
                .default([]),

            recommendedTargeting: z
                .object({
                    bestCountries: z.array(z.string().length(2)).max(10).default([]),
                    bestDevices: z
                        .array(z.enum(['desktop', 'mobile', 'tablet']))
                        .max(3)
                        .default([]),
                    bestContentTypes: z
                        .array(
                            z.enum([
                                'accommodation',
                                'destination',
                                'experience',
                                'blog',
                                'general'
                            ])
                        )
                        .max(5)
                        .default([]),
                    optimalTimeSlots: z
                        .array(
                            z.object({
                                dayOfWeek: z.number().int().min(0).max(6),
                                startHour: z.number().int().min(0).max(23),
                                endHour: z.number().int().min(0).max(23)
                            })
                        )
                        .max(21)
                        .default([])
                })
                .optional()
        })
        .optional()
        .describe('Audience insights and targeting recommendations')
});

// Comprehensive ad slot with all relations
export const AdSlotWithRelationsSchema = AdSlotSchema.extend({
    // Current reservations and campaigns
    reservations: z
        .array(AdSlotReservationSchema.omit({ adSlotId: true }))
        .max(100)
        .default([])
        .describe('All reservations for this slot'),

    // Media assets
    mediaAssets: AdSlotMediaAssetsSchema.omit({ adSlotId: true }).optional(),

    // Performance analytics
    analytics: AdSlotTargetingAnalyticsSchema.omit({ adSlotId: true }).optional(),

    // Competitor analysis
    competitorInsights: z
        .object({
            similarSlots: z
                .array(
                    z.object({
                        slotId: AdSlotSchema.shape.id,
                        slotName: z.string(),
                        similarityScore: z.number().min(0).max(1),
                        competitiveAdvantages: z.array(z.string()).max(5).default([]),
                        pricingComparison: z.enum(['higher', 'lower', 'similar']),
                        performanceComparison: z.enum(['better', 'worse', 'similar'])
                    })
                )
                .max(10)
                .default([]),

            marketPosition: z
                .object({
                    rank: z.number().int().min(1),
                    totalSlots: z.number().int().min(1),
                    marketShare: z.number().min(0).max(1).default(0),
                    priceCompetitiveness: z.number().min(0).max(10).default(5)
                })
                .optional()
        })
        .optional()
        .describe('Competitive analysis and market positioning')
});

export type AdSlotReservation = z.infer<typeof AdSlotReservationSchema>;
export type AdSlotWithCampaign = z.infer<typeof AdSlotWithCampaignSchema>;
export type AdSlotMediaAssets = z.infer<typeof AdSlotMediaAssetsSchema>;
export type AdSlotTargetingAnalytics = z.infer<typeof AdSlotTargetingAnalyticsSchema>;
export type AdSlotWithRelations = z.infer<typeof AdSlotWithRelationsSchema>;
