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

/**
 * HTTP-compatible feature search schema with automatic coercion
 * Uses FLAT filter pattern (no nested objects) for HTTP compatibility
 */
export const FeatureSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters with HTTP coercion
    name: z.string().optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),

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
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),
    descriptionContains: z.string().min(1).max(100).optional(),

    // Array filters with HTTP coercion
    categories: createArrayQueryParam('Filter by multiple feature categories')
});

export type FeatureSearchHttp = z.infer<typeof FeatureSearchHttpSchema>;

/**
 * HTTP-compatible feature creation schema
 * Handles form data and JSON input for creating features via HTTP
 */
export const FeatureCreateHttpSchema = z.object({
    name: z.string().min(1, { message: 'zodError.feature.name.required' }).max(100),
    slug: z.string().min(1, { message: 'zodError.feature.slug.required' }).max(100),
    description: z.string().max(1000).optional(),
    category: z.string().min(1).max(50).optional(),
    icon: z.string().max(50).optional(),
    priority: z.coerce.number().int().min(0).max(100).default(50),
    isAvailable: z.coerce.boolean().default(true),
    isPremium: z.coerce.boolean().default(false),
    requiresPayment: z.coerce.boolean().default(false)
});

export type FeatureCreateHttp = z.infer<typeof FeatureCreateHttpSchema>;

/**
 * HTTP-compatible feature update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const FeatureUpdateHttpSchema = FeatureCreateHttpSchema.partial();

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
