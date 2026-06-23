/**
 * Feature HTTP Schemas
 *
 * HTTP-compatible schemas for feature operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { i18nText } from '../../common/i18n.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * HTTP-compatible feature search schema with automatic coercion
 * Uses FLAT filter pattern (no nested objects) for HTTP compatibility
 */
export const FeatureSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters with HTTP coercion
    slug: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),

    /** Filter by applicable vertical (SPEC-266) */
    applicableVertical: z.enum(['accommodation', 'gastronomy', 'experience']).optional(),

    // Boolean filters with HTTP coercion
    isAvailable: createBooleanQueryParam('Filter by feature availability status'),
    hasIcon: createBooleanQueryParam('Filter features that have icons'),
    hasDescription: createBooleanQueryParam('Filter features with descriptions'),
    isPopular: createBooleanQueryParam('Filter popular features'),
    isPremium: createBooleanQueryParam('Filter premium features'),
    requiresPayment: createBooleanQueryParam('Filter features requiring payment'),
    isUnused: createBooleanQueryParam('Filter unused features'),

    // Numeric filters with HTTP coercion
    minPriority: z.coerce.number().int().min(0).max(100).optional(),
    maxPriority: z.coerce.number().int().min(0).max(100).optional(),
    minUsageCount: z.coerce.number().int().min(0).optional(),
    maxUsageCount: z.coerce.number().int().min(0).optional(),
    popularityThreshold: z.coerce.number().int().min(1).optional(),

    // Date filters with HTTP coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),

    // Text pattern filters
    descriptionContains: z.string().min(1).max(100).optional(),

    // Array filters with HTTP coercion
    categories: createArrayQueryParam('Filter by multiple feature categories')
});

export type FeatureSearchHttp = z.infer<typeof FeatureSearchHttpSchema>;

/**
 * HTTP-compatible feature creation schema.
 * Accepts localized i18n objects for name and description so the admin form
 * can submit per-language values directly.
 */
export const FeatureCreateHttpSchema = z.object({
    slug: z.string().min(1, { message: 'zodError.feature.slug.required' }).max(100).optional(),
    description: i18nText({ min: 10, max: 500 }).optional(),
    /** Verticals this feature is applicable to (SPEC-266). */
    applicableVerticals: z
        .array(z.enum(['accommodation', 'gastronomy', 'experience']))
        .min(1)
        .default(['accommodation']),
    category: z.string().min(1).max(50).optional(),
    icon: z.string().max(50).optional(),
    priority: z.coerce.number().int().min(0).max(100).default(50),
    isAvailable: z.coerce.boolean().default(true),
    isPremium: z.coerce.boolean().default(false),
    requiresPayment: z.coerce.boolean().default(false),
    displayWeight: z.coerce.number().int().min(1).max(100).default(50)
});

export type FeatureCreateHttp = z.infer<typeof FeatureCreateHttpSchema>;

/**
 * HTTP-compatible feature update schema
 * Handles partial updates via HTTP PATCH requests
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const FeatureUpdateHttpSchema = z
    .object(stripShapeDefaults(FeatureCreateHttpSchema.shape))
    .partial();

export type FeatureUpdateHttp = z.infer<typeof FeatureUpdateHttpSchema>;

/**
 * HTTP-compatible feature query parameters for single feature retrieval
 * Used for GET /features/:id type requests
 */
export const FeatureGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeUsageStats: createBooleanQueryParam('Include feature usage statistics'),
    includeRelatedFeatures: createBooleanQueryParam('Include related features data')
});

export type FeatureGetHttp = z.infer<typeof FeatureGetHttpSchema>;

/**
 * HTTP to Domain Conversion Functions
 * These functions convert HTTP request data to domain-compatible formats
 */

import type { FeatureCreateInputSchema, FeatureUpdateInputSchema } from './feature.crud.schema.js';

/**
 * Convert HTTP search parameters to domain search format
 */
export function httpToDomainFeatureSearch(httpData: FeatureSearchHttp): Partial<FeatureSearchHttp> {
    return {
        ...httpData,
        isAvailable: httpData.isAvailable,
        hasIcon: httpData.hasIcon,
        hasDescription: httpData.hasDescription,
        isPopular: httpData.isPopular,
        isPremium: httpData.isPremium,
        requiresPayment: httpData.requiresPayment,
        isUnused: httpData.isUnused
    };
}

/**
 * Convert HTTP feature creation data to domain format.
 * The admin form sends the i18n object directly; no wrapping needed.
 */
export function httpToDomainFeatureCreate(
    httpData: FeatureCreateHttp
): z.infer<typeof FeatureCreateInputSchema> {
    return {
        // description is already an I18nText object from the HTTP form
        slug: httpData.slug,
        description: httpData.description,
        applicableVerticals: httpData.applicableVerticals,
        icon: httpData.icon,
        isBuiltin: false, // Default value
        isFeatured: false, // Default value
        displayWeight: httpData.displayWeight
    };
}

/**
 * Convert HTTP feature update data to domain format.
 * The admin form sends the i18n object directly; no wrapping needed.
 */
export function httpToDomainFeatureUpdate(
    httpData: FeatureUpdateHttp
): z.infer<typeof FeatureUpdateInputSchema> {
    return {
        // description is already an I18nText object when provided
        slug: httpData.slug,
        description: httpData.description,
        applicableVerticals: httpData.applicableVerticals,
        icon: httpData.icon,
        displayWeight: httpData.displayWeight
    };
}
