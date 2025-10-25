import { z } from 'zod';
import { AccommodationSchema } from '../accommodation/accommodation.schema.js';
import { NotificationSchema } from '../notification/notification.schema.js';
import { UserSchema } from '../user/user.schema.js';
import { CampaignSchema } from './campaign.schema.js';

/**
 * Campaign with Creator relationship
 * Campaign with user who created it
 */
export const CampaignWithCreatorSchema = CampaignSchema.extend({
    creator: UserSchema.pick({
        id: true,
        name: true,
        email: true,
        profileImageUrl: true,
        isActive: true
    })
});

/**
 * Campaign with Performance Details
 * Campaign with detailed performance metrics and history
 */
export const CampaignWithPerformanceSchema = CampaignSchema.extend({
    performanceHistory: z
        .array(
            z.object({
                date: z.date(),
                impressions: z.number().int().min(0),
                clicks: z.number().int().min(0),
                conversions: z.number().int().min(0),
                spend: z.number().min(0),
                clickThroughRate: z.number().min(0).max(1),
                conversionRate: z.number().min(0).max(1),
                costPerClick: z.number().min(0),
                costPerConversion: z.number().min(0),
                returnOnAdSpend: z.number().min(0)
            })
        )
        .max(365)
        .default([])
        .describe('Daily performance history'),

    performanceSummary: z
        .object({
            totalImpressions: z.number().int().min(0),
            totalClicks: z.number().int().min(0),
            totalConversions: z.number().int().min(0),
            totalSpend: z.number().min(0),
            averageCTR: z.number().min(0).max(1),
            averageConversionRate: z.number().min(0).max(1),
            averageCPC: z.number().min(0),
            averageCPA: z.number().min(0),
            totalROAS: z.number().min(0),
            bestPerformingDay: z.date().optional(),
            worstPerformingDay: z.date().optional()
        })
        .optional()
        .describe('Performance summary metrics')
});

/**
 * Campaign with Related Notifications
 * Campaign with notifications that were sent as part of this campaign
 */
export const CampaignWithNotificationsSchema = CampaignSchema.extend({
    notifications: z
        .array(
            NotificationSchema.pick({
                id: true,
                type: true,
                status: true,
                channel: true,
                recipientType: true,
                recipientId: true,
                title: true,
                createdAt: true,
                sentAt: true,
                deliveredAt: true,
                readAt: true
            })
        )
        .max(1000)
        .default([])
        .describe('Notifications sent for this campaign'),

    notificationStats: z
        .object({
            totalSent: z.number().int().min(0),
            totalDelivered: z.number().int().min(0),
            totalRead: z.number().int().min(0),
            totalFailed: z.number().int().min(0),
            deliveryRate: z.number().min(0).max(1),
            readRate: z.number().min(0).max(1),
            failureRate: z.number().min(0).max(1),
            byChannel: z
                .record(
                    z.string(),
                    z.object({
                        sent: z.number().int().min(0),
                        delivered: z.number().int().min(0),
                        read: z.number().int().min(0),
                        failed: z.number().int().min(0)
                    })
                )
                .default({})
        })
        .optional()
        .describe('Notification delivery statistics')
});

/**
 * Campaign with Target Accommodations
 * Campaign with accommodations that are being promoted
 */
export const CampaignWithAccommodationsSchema = CampaignSchema.extend({
    targetAccommodations: z
        .array(
            AccommodationSchema.pick({
                id: true,
                name: true,
                hostId: true,
                status: true,
                isActive: true,
                address: true,
                basePrice: true,
                mainImageUrl: true
            })
        )
        .max(100)
        .optional()
        .describe('Accommodations targeted by this campaign'),

    accommodationPerformance: z
        .array(
            z.object({
                accommodationId: z.string().uuid(),
                impressions: z.number().int().min(0),
                clicks: z.number().int().min(0),
                conversions: z.number().int().min(0),
                revenue: z.number().min(0),
                clickThroughRate: z.number().min(0).max(1),
                conversionRate: z.number().min(0).max(1)
            })
        )
        .max(100)
        .default([])
        .describe('Performance metrics per accommodation')
});

/**
 * Campaign with Budget Tracking
 * Campaign with detailed budget spending and allocation tracking
 */
export const CampaignWithBudgetTrackingSchema = CampaignSchema.extend({
    budgetTracking: z
        .object({
            dailySpending: z
                .array(
                    z.object({
                        date: z.date(),
                        budgetAllocated: z.number().min(0),
                        amountSpent: z.number().min(0),
                        impressions: z.number().int().min(0),
                        clicks: z.number().int().min(0),
                        conversions: z.number().int().min(0),
                        utilizationRate: z.number().min(0).max(1)
                    })
                )
                .max(365)
                .default([]),

            channelAllocation: z
                .record(
                    z.string(),
                    z.object({
                        allocatedBudget: z.number().min(0),
                        spentBudget: z.number().min(0),
                        utilizationRate: z.number().min(0).max(1),
                        performance: z.object({
                            impressions: z.number().int().min(0),
                            clicks: z.number().int().min(0),
                            conversions: z.number().int().min(0),
                            costPerConversion: z.number().min(0)
                        })
                    })
                )
                .default({}),

            budgetAlerts: z
                .array(
                    z.object({
                        type: z.enum([
                            'overspend',
                            'underspend',
                            'pace_warning',
                            'daily_limit_reached'
                        ]),
                        message: z.string().max(500),
                        threshold: z.number().min(0),
                        currentValue: z.number().min(0),
                        createdAt: z.date(),
                        resolved: z.boolean().default(false)
                    })
                )
                .max(50)
                .default([])
        })
        .optional()
        .describe('Detailed budget tracking and alerts')
});

/**
 * Campaign with Full Analytics
 * Campaign with comprehensive analytics including audience insights
 */
export const CampaignWithAnalyticsSchema = CampaignSchema.extend({
    audienceAnalytics: z
        .object({
            demographics: z.object({
                ageGroups: z
                    .record(
                        z.string(),
                        z.object({
                            impressions: z.number().int().min(0),
                            clicks: z.number().int().min(0),
                            conversions: z.number().int().min(0),
                            clickThroughRate: z.number().min(0).max(1),
                            conversionRate: z.number().min(0).max(1)
                        })
                    )
                    .default({}),

                countries: z
                    .record(
                        z.string(),
                        z.object({
                            impressions: z.number().int().min(0),
                            clicks: z.number().int().min(0),
                            conversions: z.number().int().min(0),
                            spend: z.number().min(0)
                        })
                    )
                    .default({}),

                languages: z
                    .record(
                        z.string(),
                        z.object({
                            impressions: z.number().int().min(0),
                            clicks: z.number().int().min(0),
                            conversions: z.number().int().min(0)
                        })
                    )
                    .default({}),

                userSegments: z
                    .record(
                        z.string(),
                        z.object({
                            impressions: z.number().int().min(0),
                            clicks: z.number().int().min(0),
                            conversions: z.number().int().min(0),
                            averageOrderValue: z.number().min(0)
                        })
                    )
                    .default({})
            }),

            timeAnalytics: z.object({
                hourlyPerformance: z
                    .array(
                        z.object({
                            hour: z.number().int().min(0).max(23),
                            impressions: z.number().int().min(0),
                            clicks: z.number().int().min(0),
                            conversions: z.number().int().min(0)
                        })
                    )
                    .length(24)
                    .default([]),

                dayOfWeekPerformance: z
                    .array(
                        z.object({
                            dayOfWeek: z.number().int().min(0).max(6),
                            impressions: z.number().int().min(0),
                            clicks: z.number().int().min(0),
                            conversions: z.number().int().min(0),
                            averageCPC: z.number().min(0)
                        })
                    )
                    .length(7)
                    .default([])
            }),

            deviceAnalytics: z
                .object({
                    desktop: z.object({
                        impressions: z.number().int().min(0),
                        clicks: z.number().int().min(0),
                        conversions: z.number().int().min(0)
                    }),
                    mobile: z.object({
                        impressions: z.number().int().min(0),
                        clicks: z.number().int().min(0),
                        conversions: z.number().int().min(0)
                    }),
                    tablet: z.object({
                        impressions: z.number().int().min(0),
                        clicks: z.number().int().min(0),
                        conversions: z.number().int().min(0)
                    })
                })
                .optional()
        })
        .optional()
        .describe('Detailed audience and performance analytics')
});

/**
 * Complete Campaign with All Relations
 * Campaign with all possible relationship data
 */
export const CampaignWithAllRelationsSchema = CampaignSchema.extend({
    creator: UserSchema.pick({
        id: true,
        name: true,
        email: true,
        profileImageUrl: true
    }),

    lastUpdatedBy: UserSchema.pick({
        id: true,
        name: true,
        email: true
    }).optional(),

    // Simplified relations to avoid circular dependencies
    notificationCount: z.number().int().min(0).default(0),
    accommodationCount: z.number().int().min(0).default(0),

    // Performance summary
    performanceSummary: z
        .object({
            totalImpressions: z.number().int().min(0),
            totalClicks: z.number().int().min(0),
            totalConversions: z.number().int().min(0),
            totalSpend: z.number().min(0),
            averageCTR: z.number().min(0).max(1),
            averageConversionRate: z.number().min(0).max(1),
            totalROAS: z.number().min(0)
        })
        .optional()
});

export type CampaignWithCreator = z.infer<typeof CampaignWithCreatorSchema>;
export type CampaignWithPerformance = z.infer<typeof CampaignWithPerformanceSchema>;
export type CampaignWithNotifications = z.infer<typeof CampaignWithNotificationsSchema>;
export type CampaignWithAccommodations = z.infer<typeof CampaignWithAccommodationsSchema>;
export type CampaignWithBudgetTracking = z.infer<typeof CampaignWithBudgetTrackingSchema>;
export type CampaignWithAnalytics = z.infer<typeof CampaignWithAnalyticsSchema>;
export type CampaignWithAllRelations = z.infer<typeof CampaignWithAllRelationsSchema>;
