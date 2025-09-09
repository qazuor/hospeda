import { z } from 'zod';
import { AmenitySchema } from './amenity.schema.js';

/**
 * Amenity Relations Schemas
 *
 * This file contains schemas for amenities with related entities:
 * - AmenityWithUsageStats
 * - AmenityWithAccommodations
 * - AmenityWithCategory
 * - AmenityWithSimilar
 * - AmenityWithFull (all relations)
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
 * Amenity category summary schema for relations
 * Contains category information with statistics
 */
const AmenityCategorySummarySchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    amenityCount: z.number().int().min(0),
    totalUsageCount: z.number().int().min(0),
    averageUsagePerAmenity: z.number().min(0),
    icon: z.string().optional(),
    color: z.string().optional(),
    sortOrder: z.number().int().min(0).optional()
});

// ============================================================================
// AMENITY WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Amenity with usage statistics
 * Includes detailed usage breakdown and trends
 */
export const AmenityWithUsageStatsSchema = AmenitySchema.extend({
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
            .optional()
    })
});

/**
 * Amenity with accommodations
 * Includes an array of accommodations using this amenity
 */
export const AmenityWithAccommodationsSchema = AmenitySchema.extend({
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
        .optional()
});

/**
 * Amenity with category information
 * Includes detailed category data and related amenities in the same category
 */
export const AmenityWithCategorySchema = AmenitySchema.extend({
    categoryInfo: AmenityCategorySummarySchema.optional(),
    relatedAmenities: z
        .array(
            AmenitySchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                icon: true,
                usageCount: true
            })
        )
        .optional(),
    categoryRank: z.number().int().min(1).optional() // Rank within category by usage
});

/**
 * Amenity with similar amenities
 * Includes amenities that are commonly used together or are similar
 */
export const AmenityWithSimilarSchema = AmenitySchema.extend({
    similarAmenities: z
        .array(
            AmenitySchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                category: true,
                icon: true,
                usageCount: true
            }).extend({
                similarityScore: z.number().min(0).max(1), // How similar (0-1)
                coOccurrenceCount: z.number().int().min(0) // How often used together
            })
        )
        .optional(),

    frequentlyUsedWith: z
        .array(
            AmenitySchema.pick({
                id: true,
                slug: true,
                name: true,
                category: true,
                icon: true
            }).extend({
                coOccurrenceRate: z.number().min(0).max(1), // Percentage of co-occurrence
                coOccurrenceCount: z.number().int().min(0)
            })
        )
        .optional(),

    alternatives: z
        .array(
            AmenitySchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                category: true,
                icon: true,
                usageCount: true
            }).extend({
                alternativeReason: z.string().optional() // Why it's an alternative
            })
        )
        .optional()
});

/**
 * Amenity with pricing information
 * Includes pricing data from accommodations that offer this amenity
 */
export const AmenityWithPricingSchema = AmenitySchema.extend({
    pricingInfo: z
        .object({
            isFreeInMost: z.boolean(), // True if most accommodations include it for free
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
                    lowCost: z.number().int().min(0).default(0), // < $10
                    mediumCost: z.number().int().min(0).default(0), // $10-50
                    highCost: z.number().int().min(0).default(0) // > $50
                })
                .optional(),
            mostCommonPrice: z.number().min(0).optional()
        })
        .optional()
});

/**
 * Amenity with geographic distribution
 * Shows where this amenity is most commonly found
 */
export const AmenityWithGeographicSchema = AmenitySchema.extend({
    geographicDistribution: z
        .object({
            byCountry: z
                .array(
                    z.object({
                        country: z.string(),
                        accommodationsCount: z.number().int().min(0),
                        percentage: z.number().min(0).max(100)
                    })
                )
                .optional(),
            byRegion: z
                .array(
                    z.object({
                        region: z.string(),
                        accommodationsCount: z.number().int().min(0),
                        percentage: z.number().min(0).max(100)
                    })
                )
                .optional(),
            mostPopularIn: z
                .object({
                    country: z.string(),
                    region: z.string().optional(),
                    accommodationsCount: z.number().int().min(0)
                })
                .optional()
        })
        .optional()
});

/**
 * Amenity with all relations
 * Includes all possible related data
 */
export const AmenityWithFullRelationsSchema = AmenitySchema.extend({
    // Usage statistics
    usageStats: z.object({
        totalUsages: z.number().int().min(0),
        accommodationsCount: z.number().int().min(0),
        lastUsedAt: z.date().optional(),
        firstUsedAt: z.date().optional(),
        usageGrowthRate: z.number().optional(),
        popularityRank: z.number().int().min(1).optional(),
        usageTrend: z.enum(['increasing', 'decreasing', 'stable']).optional()
    }),

    // Accommodations
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),
    featuredAccommodations: z.array(AccommodationSummarySchema).optional(),

    // Category information
    categoryInfo: AmenityCategorySummarySchema.optional(),
    relatedAmenities: z
        .array(
            AmenitySchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                icon: true,
                usageCount: true
            })
        )
        .optional(),
    categoryRank: z.number().int().min(1).optional(),

    // Similar amenities
    similarAmenities: z
        .array(
            AmenitySchema.pick({
                id: true,
                slug: true,
                name: true,
                description: true,
                category: true,
                icon: true,
                usageCount: true
            }).extend({
                similarityScore: z.number().min(0).max(1),
                coOccurrenceCount: z.number().int().min(0)
            })
        )
        .optional(),

    frequentlyUsedWith: z
        .array(
            AmenitySchema.pick({
                id: true,
                slug: true,
                name: true,
                category: true,
                icon: true
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
        .optional()
});

// ============================================================================
// AMENITY COMPARISON SCHEMAS
// ============================================================================

/**
 * Amenity comparison input schema
 * Parameters for comparing multiple amenities
 */
export const AmenityComparisonInputSchema = z.object({
    amenityIds: z
        .array(z.string().uuid(), {
            message: 'zodError.amenity.comparison.amenityIds.required'
        })
        .min(2, { message: 'zodError.amenity.comparison.amenityIds.min' })
        .max(10, { message: 'zodError.amenity.comparison.amenityIds.max' }),
    includeUsageStats: z
        .boolean({
            message: 'zodError.amenity.comparison.includeUsageStats.invalidType'
        })
        .optional()
        .default(true),
    includePricing: z
        .boolean({
            message: 'zodError.amenity.comparison.includePricing.invalidType'
        })
        .optional()
        .default(true),
    includeGeographic: z
        .boolean({
            message: 'zodError.amenity.comparison.includeGeographic.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Amenity comparison output schema
 * Returns comparison data for multiple amenities
 */
export const AmenityComparisonOutputSchema = z.object({
    amenities: z.array(
        AmenitySchema.extend({
            usageStats: z
                .object({
                    totalUsages: z.number().int().min(0),
                    accommodationsCount: z.number().int().min(0),
                    popularityRank: z.number().int().min(1).optional()
                })
                .optional(),
            pricingInfo: z
                .object({
                    isFreeInMost: z.boolean(),
                    averageAdditionalCost: z.number().min(0).optional()
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
        mostExpensive: z.string().uuid().optional(),
        mostAffordable: z.string().uuid().optional(),
        similarities: z
            .array(
                z.object({
                    amenityId1: z.string().uuid(),
                    amenityId2: z.string().uuid(),
                    similarityScore: z.number().min(0).max(1)
                })
            )
            .optional()
    })
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AmenityWithUsageStats = z.infer<typeof AmenityWithUsageStatsSchema>;
export type AmenityWithAccommodations = z.infer<typeof AmenityWithAccommodationsSchema>;
export type AmenityWithCategory = z.infer<typeof AmenityWithCategorySchema>;
export type AmenityWithSimilar = z.infer<typeof AmenityWithSimilarSchema>;
export type AmenityWithPricing = z.infer<typeof AmenityWithPricingSchema>;
export type AmenityWithGeographic = z.infer<typeof AmenityWithGeographicSchema>;
export type AmenityWithFullRelations = z.infer<typeof AmenityWithFullRelationsSchema>;
export type AmenityComparisonInput = z.infer<typeof AmenityComparisonInputSchema>;
export type AmenityComparisonOutput = z.infer<typeof AmenityComparisonOutputSchema>;
