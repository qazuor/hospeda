import { z } from 'zod';
import { FeatureSchema } from './feature.schema.js';

/**
 * Feature Relations Schemas
 *
 * This file contains schemas for features with related entities:
 * - FeatureWithUsageStats
 * - FeatureWithAccommodations
 * - FeatureWithCategory
 * - FeatureWithSimilar
 * - FeatureWithFull (all relations)
 */

// Import related schemas (these will be created later)
// For now, we'll define basic summary schemas inline to avoid circular dependencies

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * Accommodation summary schema for relations
 * Contains essential accommodation information
 */
const AccommodationSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    summary: z.string(),
    type: z.string(),
    isFeatured: z.boolean(),
    rating: z.number().min(0).max(5).optional(),
    location: z
        .object({
            country: z.string(),
            state: z.string().optional(),
            city: z.string()
        })
        .optional(),
    media: z
        .object({
            images: z.array(z.string()).optional()
        })
        .optional(),
    price: z
        .object({
            basePrice: z.number().min(0),
            currency: z.string()
        })
        .optional(),
    createdAt: z.date()
});

/**
 * Feature category summary schema for relations
 * Contains category information with statistics
 */
const FeatureCategorySummarySchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    featureCount: z.number().int().min(0),
    availableFeatureCount: z.number().int().min(0),
    totalUsageCount: z.number().int().min(0),
    averageUsagePerFeature: z.number().min(0),
    averagePriority: z.number().min(0).max(100),
    icon: z.string().optional(),
    color: z.string().optional(),
    sortOrder: z.number().int().min(0).optional()
});

// ============================================================================
// FEATURE WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Feature with usage statistics
 * Includes detailed usage breakdown and trends
 */
export const FeatureWithUsageStatsSchema = FeatureSchema.extend({
    usageStats: z.object({
        totalUsages: z.number().int().min(0),
        accommodationsCount: z.number().int().min(0),
        lastUsedAt: z.date().optional(),
        firstUsedAt: z.date().optional(),
        usageGrowthRate: z.number().optional(),
        popularityRank: z.number().int().min(1).optional(),
        usageTrend: z.enum(['increasing', 'decreasing', 'stable']).optional(),
        peakUsagePeriod: z
            .object({
                period: z.string(),
                usageCount: z.number().int().min(0)
            })
            .optional(),
        availabilityRate: z.number().min(0).max(1).optional(), // How often it's available when requested
        demandScore: z.number().min(0).max(100).optional() // Combination of usage and requests
    })
});

/**
 * Feature with accommodations
 * Includes an array of accommodations using this feature
 */
export const FeatureWithAccommodationsSchema = FeatureSchema.extend({
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),
    featuredAccommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsByType: z.record(z.string(), z.number().int().min(0)).optional(), // e.g., { "hotel": 15, "cabin": 8 }
    accommodationsByRating: z
        .object({
            fiveStars: z.number().int().min(0).default(0),
            fourStars: z.number().int().min(0).default(0),
            threeStars: z.number().int().min(0).default(0),
            twoStars: z.number().int().min(0).default(0),
            oneStar: z.number().int().min(0).default(0),
            unrated: z.number().int().min(0).default(0)
        })
        .optional(),
    premiumAccommodationsCount: z.number().int().min(0).optional(), // Count of high-end accommodations
    budgetAccommodationsCount: z.number().int().min(0).optional() // Count of budget accommodations
});

/**
 * Feature with category information
 * Includes detailed category data and related features in the same category
 */
export const FeatureWithCategorySchema = FeatureSchema.extend({
    categoryInfo: FeatureCategorySummarySchema.optional(),
    relatedFeatures: z
        .array(
            FeatureSchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                icon: true,
                priority: true,
                isAvailable: true,
                usageCount: true
            })
        )
        .optional(),
    categoryRank: z.number().int().min(1).optional(), // Rank within category by usage
    priorityRankInCategory: z.number().int().min(1).optional() // Rank within category by priority
});

/**
 * Feature with similar features
 * Includes features that are commonly used together or are similar
 */
export const FeatureWithSimilarSchema = FeatureSchema.extend({
    similarFeatures: z
        .array(
            FeatureSchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                category: true,
                icon: true,
                priority: true,
                isAvailable: true,
                usageCount: true
            }).extend({
                similarityScore: z.number().min(0).max(1), // How similar (0-1)
                coOccurrenceCount: z.number().int().min(0) // How often used together
            })
        )
        .optional(),

    frequentlyUsedWith: z
        .array(
            FeatureSchema.pick({
                id: true,
                slug: true,
                name: true,
                category: true,
                icon: true,
                priority: true,
                isAvailable: true
            }).extend({
                coOccurrenceRate: z.number().min(0).max(1), // Percentage of co-occurrence
                coOccurrenceCount: z.number().int().min(0)
            })
        )
        .optional(),

    alternatives: z
        .array(
            FeatureSchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                category: true,
                icon: true,
                priority: true,
                isAvailable: true,
                usageCount: true
            }).extend({
                alternativeReason: z.string().optional(), // Why it's an alternative
                priorityDifference: z.number().optional() // Priority difference from current feature
            })
        )
        .optional(),

    complementaryFeatures: z
        .array(
            FeatureSchema.pick({
                id: true,
                slug: true,
                name: true,
                category: true,
                icon: true,
                priority: true
            }).extend({
                complementReason: z.string().optional(), // Why it complements this feature
                synergySCore: z.number().min(0).max(1).optional() // How well they work together
            })
        )
        .optional()
});

/**
 * Feature with pricing information
 * Includes pricing data from accommodations that offer this feature
 */
export const FeatureWithPricingSchema = FeatureSchema.extend({
    pricingInfo: z
        .object({
            isFreeInMost: z.boolean(), // True if most accommodations include it for free
            isPremiumFeature: z.boolean(), // True if it's typically a premium/paid feature
            averageAdditionalCost: z.number().min(0).optional(),
            priceRange: z
                .object({
                    min: z.number().min(0),
                    max: z.number().min(0),
                    currency: z.string()
                })
                .optional(),
            pricingDistribution: z
                .object({
                    free: z.number().int().min(0).default(0),
                    lowCost: z.number().int().min(0).default(0), // < $20
                    mediumCost: z.number().int().min(0).default(0), // $20-100
                    highCost: z.number().int().min(0).default(0) // > $100
                })
                .optional(),
            mostCommonPrice: z.number().min(0).optional(),
            priceCorrelationWithRating: z.number().min(-1).max(1).optional() // Correlation between feature price and accommodation rating
        })
        .optional()
});

/**
 * Feature with geographic distribution
 * Shows where this feature is most commonly found
 */
export const FeatureWithGeographicSchema = FeatureSchema.extend({
    geographicDistribution: z
        .object({
            byCountry: z
                .array(
                    z.object({
                        country: z.string(),
                        accommodationsCount: z.number().int().min(0),
                        percentage: z.number().min(0).max(100),
                        averagePriority: z.number().min(0).max(100).optional()
                    })
                )
                .optional(),
            byRegion: z
                .array(
                    z.object({
                        region: z.string(),
                        accommodationsCount: z.number().int().min(0),
                        percentage: z.number().min(0).max(100),
                        averagePriority: z.number().min(0).max(100).optional()
                    })
                )
                .optional(),
            mostPopularIn: z
                .object({
                    country: z.string(),
                    region: z.string().optional(),
                    accommodationsCount: z.number().int().min(0),
                    dominancePercentage: z.number().min(0).max(100)
                })
                .optional(),
            leastPopularIn: z
                .object({
                    country: z.string(),
                    region: z.string().optional(),
                    accommodationsCount: z.number().int().min(0),
                    scarcityPercentage: z.number().min(0).max(100)
                })
                .optional()
        })
        .optional()
});

/**
 * Feature with availability analysis
 * Includes detailed availability patterns and constraints
 */
export const FeatureWithAvailabilitySchema = FeatureSchema.extend({
    availabilityAnalysis: z
        .object({
            currentStatus: z.enum(['available', 'unavailable', 'limited', 'seasonal']),
            availabilityHistory: z
                .array(
                    z.object({
                        date: z.date(),
                        status: z.enum(['available', 'unavailable', 'limited']),
                        reason: z.string().optional()
                    })
                )
                .optional(),
            seasonalPatterns: z
                .object({
                    peak: z.array(z.string()).optional(), // Months when most available
                    low: z.array(z.string()).optional(), // Months when least available
                    yearRound: z.boolean().default(true)
                })
                .optional(),
            constraints: z
                .array(
                    z.object({
                        type: z.enum(['weather', 'maintenance', 'demand', 'regulatory', 'other']),
                        description: z.string(),
                        impact: z.enum(['minor', 'moderate', 'major']),
                        duration: z.string().optional() // e.g., "seasonal", "permanent", "temporary"
                    })
                )
                .optional(),
            uptime: z.number().min(0).max(1).optional(), // Percentage of time available
            maintenanceSchedule: z
                .object({
                    frequency: z.string().optional(), // e.g., "monthly", "quarterly"
                    duration: z.string().optional(), // e.g., "2 hours", "1 day"
                    nextScheduled: z.date().optional()
                })
                .optional()
        })
        .optional()
});

/**
 * Feature with all relations
 * Includes all possible related data
 */
export const FeatureWithFullRelationsSchema = FeatureSchema.extend({
    // Usage statistics
    usageStats: z.object({
        totalUsages: z.number().int().min(0),
        accommodationsCount: z.number().int().min(0),
        lastUsedAt: z.date().optional(),
        firstUsedAt: z.date().optional(),
        usageGrowthRate: z.number().optional(),
        popularityRank: z.number().int().min(1).optional(),
        usageTrend: z.enum(['increasing', 'decreasing', 'stable']).optional(),
        availabilityRate: z.number().min(0).max(1).optional(),
        demandScore: z.number().min(0).max(100).optional()
    }),

    // Accommodations
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),
    featuredAccommodations: z.array(AccommodationSummarySchema).optional(),

    // Category information
    categoryInfo: FeatureCategorySummarySchema.optional(),
    relatedFeatures: z
        .array(
            FeatureSchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                icon: true,
                priority: true,
                isAvailable: true,
                usageCount: true
            })
        )
        .optional(),
    categoryRank: z.number().int().min(1).optional(),
    priorityRankInCategory: z.number().int().min(1).optional(),

    // Similar features
    similarFeatures: z
        .array(
            FeatureSchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                category: true,
                icon: true,
                priority: true,
                isAvailable: true,
                usageCount: true
            }).extend({
                similarityScore: z.number().min(0).max(1),
                coOccurrenceCount: z.number().int().min(0)
            })
        )
        .optional(),

    frequentlyUsedWith: z
        .array(
            FeatureSchema.pick({
                id: true,
                slug: true,
                name: true,
                category: true,
                icon: true,
                priority: true,
                isAvailable: true
            }).extend({
                coOccurrenceRate: z.number().min(0).max(1),
                coOccurrenceCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Pricing information
    pricingInfo: z
        .object({
            isFreeInMost: z.boolean(),
            isPremiumFeature: z.boolean(),
            averageAdditionalCost: z.number().min(0).optional(),
            priceRange: z
                .object({
                    min: z.number().min(0),
                    max: z.number().min(0),
                    currency: z.string()
                })
                .optional(),
            mostCommonPrice: z.number().min(0).optional()
        })
        .optional(),

    // Availability analysis
    availabilityAnalysis: z
        .object({
            currentStatus: z.enum(['available', 'unavailable', 'limited', 'seasonal']),
            uptime: z.number().min(0).max(1).optional(),
            constraints: z
                .array(
                    z.object({
                        type: z.enum(['weather', 'maintenance', 'demand', 'regulatory', 'other']),
                        description: z.string(),
                        impact: z.enum(['minor', 'moderate', 'major'])
                    })
                )
                .optional()
        })
        .optional()
});

// ============================================================================
// FEATURE COMPARISON SCHEMAS
// ============================================================================

/**
 * Feature comparison input schema
 * Parameters for comparing multiple features
 */
export const FeatureComparisonInputSchema = z.object({
    featureIds: z
        .array(z.string().uuid(), {
            message: 'zodError.feature.comparison.featureIds.required'
        })
        .min(2, { message: 'zodError.feature.comparison.featureIds.min' })
        .max(10, { message: 'zodError.feature.comparison.featureIds.max' }),
    includeUsageStats: z
        .boolean({
            message: 'zodError.feature.comparison.includeUsageStats.invalidType'
        })
        .optional()
        .default(true),
    includePricing: z
        .boolean({
            message: 'zodError.feature.comparison.includePricing.invalidType'
        })
        .optional()
        .default(true),
    includeAvailability: z
        .boolean({
            message: 'zodError.feature.comparison.includeAvailability.invalidType'
        })
        .optional()
        .default(true),
    includeGeographic: z
        .boolean({
            message: 'zodError.feature.comparison.includeGeographic.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Feature comparison output schema
 * Returns comparison data for multiple features
 */
export const FeatureComparisonOutputSchema = z.object({
    features: z.array(
        FeatureSchema.extend({
            usageStats: z
                .object({
                    totalUsages: z.number().int().min(0),
                    accommodationsCount: z.number().int().min(0),
                    popularityRank: z.number().int().min(1).optional(),
                    availabilityRate: z.number().min(0).max(1).optional()
                })
                .optional(),
            pricingInfo: z
                .object({
                    isFreeInMost: z.boolean(),
                    isPremiumFeature: z.boolean(),
                    averageAdditionalCost: z.number().min(0).optional()
                })
                .optional(),
            availabilityInfo: z
                .object({
                    currentStatus: z.enum(['available', 'unavailable', 'limited', 'seasonal']),
                    uptime: z.number().min(0).max(1).optional()
                })
                .optional(),
            geographicInfo: z
                .object({
                    mostPopularCountry: z.string().optional(),
                    globalUsagePercentage: z.number().min(0).max(100).optional()
                })
                .optional()
        })
    ),
    comparisonMetrics: z.object({
        mostPopular: z.string().uuid(),
        leastPopular: z.string().uuid(),
        highestPriority: z.string().uuid(),
        lowestPriority: z.string().uuid(),
        mostAvailable: z.string().uuid().optional(),
        leastAvailable: z.string().uuid().optional(),
        mostExpensive: z.string().uuid().optional(),
        mostAffordable: z.string().uuid().optional(),
        similarities: z
            .array(
                z.object({
                    featureId1: z.string().uuid(),
                    featureId2: z.string().uuid(),
                    similarityScore: z.number().min(0).max(1),
                    commonCategories: z.array(z.string()).optional()
                })
            )
            .optional()
    })
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type FeatureWithUsageStats = z.infer<typeof FeatureWithUsageStatsSchema>;
export type FeatureWithAccommodations = z.infer<typeof FeatureWithAccommodationsSchema>;
export type FeatureWithCategory = z.infer<typeof FeatureWithCategorySchema>;
export type FeatureWithSimilar = z.infer<typeof FeatureWithSimilarSchema>;
export type FeatureWithPricing = z.infer<typeof FeatureWithPricingSchema>;
export type FeatureWithGeographic = z.infer<typeof FeatureWithGeographicSchema>;
export type FeatureWithAvailability = z.infer<typeof FeatureWithAvailabilitySchema>;
export type FeatureWithFullRelations = z.infer<typeof FeatureWithFullRelationsSchema>;
export type FeatureComparisonInput = z.infer<typeof FeatureComparisonInputSchema>;
export type FeatureComparisonOutput = z.infer<typeof FeatureComparisonOutputSchema>;
