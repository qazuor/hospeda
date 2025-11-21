/**
 * TouristService HTTP Schemas
 *
 * HTTP-compatible schemas for tourist service operations with automatic coercion.
 * These schemas handle the conversion from HTTP input (strings, form data) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';

/**
 * Service Difficulty HTTP Schema
 */
export const ServiceDifficultyHttpSchema = z.enum(['easy', 'moderate', 'hard']);

/**
 * Tourist Service Category HTTP Schema
 */
export const TouristServiceCategoryHttpSchema = z.enum([
    'tours',
    'activities',
    'experiences',
    'transportation',
    'guides',
    'equipment_rental',
    'other'
]);

/**
 * Seasonality HTTP Schema with HTTP coercion
 */
export const SeasonalityHttpSchema = z.object({
    startMonth: z.coerce.number().int().min(1).max(12).optional(),
    endMonth: z.coerce.number().int().min(1).max(12).optional()
});

export type SeasonalityHttp = z.infer<typeof SeasonalityHttpSchema>;

/**
 * Tourist Service Details HTTP Schema
 * All numeric and boolean fields use .coerce for HTTP compatibility
 */
export const TouristServiceDetailsHttpSchema = z
    .object({
        // String fields
        duration: z.string().max(100).optional(),
        meetingPoint: z.string().max(500).optional(),
        cancelationPolicy: z.string().max(1000).optional(),
        operatingHours: z.string().max(100).optional(),

        // Numeric fields with HTTP coercion
        maxParticipants: z.coerce.number().int().positive().optional(),
        minAge: z.coerce.number().int().nonnegative().optional(),
        maxAge: z.coerce.number().int().positive().optional(),

        // Boolean fields with HTTP coercion
        pickupAvailable: z.coerce.boolean().optional(),

        // Enum fields
        difficulty: ServiceDifficultyHttpSchema.optional(),

        // Array fields
        languages: z.array(z.string().min(2).max(50)).optional(),
        included: z.array(z.string().min(1).max(200)).optional(),
        excluded: z.array(z.string().min(1).max(200)).optional(),
        requirements: z.array(z.string().min(1).max(200)).optional(),
        operatingDays: z.array(z.string().min(1).max(20)).optional(),

        // Nested objects
        seasonality: SeasonalityHttpSchema.optional()
    })
    .optional();

export type TouristServiceDetailsHttp = z.infer<typeof TouristServiceDetailsHttpSchema>;

/**
 * HTTP-compatible tourist service search schema
 */
export const TouristServiceSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters
    name: z.string().optional(),
    category: TouristServiceCategoryHttpSchema.optional(),
    clientId: z.string().uuid().optional(),

    // Array filters
    categories: createArrayQueryParam('Filter by multiple categories'),
    clientIds: createArrayQueryParam('Filter by multiple client IDs'),
    difficulties: createArrayQueryParam('Filter by difficulty levels'),

    // Boolean filters
    hasDescription: createBooleanQueryParam('Filter services with description'),
    pickupAvailable: createBooleanQueryParam('Filter services with pickup')
});

export type TouristServiceSearchHttp = z.infer<typeof TouristServiceSearchHttpSchema>;

/**
 * HTTP-compatible tourist service creation schema
 * Complete schema matching all CreateTouristServiceSchema fields with HTTP coercion
 */
export const TouristServiceCreateHttpSchema = z.object({
    // Core required fields
    clientId: z.string().uuid(),
    name: z.string().min(1).max(255),
    category: TouristServiceCategoryHttpSchema,

    // Optional fields
    description: z.string().max(2000).optional(),
    contactInfo: z.string().max(500).optional(),
    location: z.string().max(500).optional(),

    // Nested service details
    serviceDetails: TouristServiceDetailsHttpSchema,

    // Admin metadata
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type TouristServiceCreateHttp = z.infer<typeof TouristServiceCreateHttpSchema>;

/**
 * HTTP-compatible tourist service update schema
 * All fields optional for partial updates (excluding clientId)
 */
export const TouristServiceUpdateHttpSchema = z.object({
    // Core fields (all optional for updates, excluding clientId)
    name: z.string().min(1).max(255).optional(),
    category: TouristServiceCategoryHttpSchema.optional(),

    // Optional fields
    description: z.string().max(2000).optional(),
    contactInfo: z.string().max(500).optional(),
    location: z.string().max(500).optional(),

    // Nested service details
    serviceDetails: TouristServiceDetailsHttpSchema,

    // Admin metadata
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type TouristServiceUpdateHttp = z.infer<typeof TouristServiceUpdateHttpSchema>;

/**
 * HTTP to Domain Conversion Functions
 * These functions convert HTTP request data to domain-compatible formats
 */

import { TouristServiceCategorySchema } from '../../enums/tourist-service-category.schema.js';
import type { CreateTouristService, UpdateTouristService } from './touristService.crud.schema.js';
import { ServiceDifficultySchema } from './touristService.schema.js';
import type { Seasonality, TouristServiceDetails } from './touristService.schema.js';

/**
 * Convert HTTP seasonality to domain seasonality
 */
function httpToDomainSeasonality(httpSeasonality?: SeasonalityHttp): Seasonality | undefined {
    if (!httpSeasonality) return undefined;

    return {
        startMonth: httpSeasonality.startMonth,
        endMonth: httpSeasonality.endMonth
    };
}

/**
 * Convert HTTP service details to domain service details
 */
function httpToDomainServiceDetails(
    httpDetails?: TouristServiceDetailsHttp
): TouristServiceDetails | undefined {
    if (!httpDetails) return undefined;

    return {
        duration: httpDetails.duration,
        maxParticipants: httpDetails.maxParticipants,
        minAge: httpDetails.minAge,
        maxAge: httpDetails.maxAge,
        difficulty: httpDetails.difficulty
            ? ServiceDifficultySchema.parse(httpDetails.difficulty)
            : undefined,
        languages: httpDetails.languages,
        included: httpDetails.included,
        excluded: httpDetails.excluded,
        requirements: httpDetails.requirements,
        meetingPoint: httpDetails.meetingPoint,
        pickupAvailable: httpDetails.pickupAvailable,
        cancelationPolicy: httpDetails.cancelationPolicy,
        operatingDays: httpDetails.operatingDays,
        operatingHours: httpDetails.operatingHours,
        seasonality: httpToDomainSeasonality(httpDetails.seasonality)
    };
}

/**
 * Convert HTTP tourist service creation data to domain format
 */
export function httpToDomainTouristServiceCreate(
    httpData: TouristServiceCreateHttp
): CreateTouristService {
    return {
        clientId: httpData.clientId,
        name: httpData.name,
        category: TouristServiceCategorySchema.parse(httpData.category),
        description: httpData.description,
        contactInfo: httpData.contactInfo,
        location: httpData.location,
        serviceDetails: httpToDomainServiceDetails(httpData.serviceDetails),
        adminInfo: httpData.adminInfo || null
    };
}

/**
 * Convert HTTP tourist service update data to domain format
 * Only includes fields that are actually provided
 */
export function httpToDomainTouristServiceUpdate(
    httpData: TouristServiceUpdateHttp
): UpdateTouristService {
    const result: UpdateTouristService = {};

    // Only include fields that are actually provided
    if (httpData.name !== undefined) result.name = httpData.name;
    if (httpData.category !== undefined) {
        result.category = TouristServiceCategorySchema.parse(httpData.category);
    }
    if (httpData.description !== undefined) result.description = httpData.description;
    if (httpData.contactInfo !== undefined) result.contactInfo = httpData.contactInfo;
    if (httpData.location !== undefined) result.location = httpData.location;
    if (httpData.serviceDetails !== undefined) {
        result.serviceDetails = httpToDomainServiceDetails(httpData.serviceDetails);
    }
    if (httpData.adminInfo !== undefined) result.adminInfo = httpData.adminInfo;

    return result;
}
