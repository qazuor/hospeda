/**
 * ServiceListingPlan HTTP Schemas
 *
 * HTTP-compatible schemas for service listing plan operations with automatic coercion.
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
 * Support level enumeration for HTTP requests
 */
export const SupportLevelHttpSchema = z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']);

/**
 * Service Listing Plan Limits HTTP Schema
 * All numeric and boolean fields use .coerce for HTTP compatibility
 */
export const ServiceListingPlanLimitsHttpSchema = z
    .object({
        // Numeric limits with HTTP coercion
        maxListings: z.coerce.number().int().positive().optional(),
        maxPhotos: z.coerce.number().int().positive().optional(),
        maxVideos: z.coerce.number().int().nonnegative().optional(),
        maxFeaturedDays: z.coerce.number().int().positive().optional(),
        maxDescriptionLength: z.coerce.number().int().positive().optional(),
        maxTrialDays: z.coerce.number().int().positive().optional(),
        refreshInterval: z.coerce.number().int().positive().optional(),

        // Boolean flags with HTTP coercion
        allowPremiumFeatures: z.coerce.boolean().optional(),
        allowAnalytics: z.coerce.boolean().optional(),
        allowCustomPricing: z.coerce.boolean().optional(),
        allowMultiLanguage: z.coerce.boolean().optional(),
        allowCustomBranding: z.coerce.boolean().optional(),
        allowBookingIntegration: z.coerce.boolean().optional(),
        allowTrialPeriods: z.coerce.boolean().optional(),

        // Enum fields
        supportLevel: SupportLevelHttpSchema.optional(),

        // Array fields
        features: z.array(z.string()).optional()
    })
    .optional();

export type ServiceListingPlanLimitsHttp = z.infer<typeof ServiceListingPlanLimitsHttpSchema>;

/**
 * HTTP-compatible service listing plan search schema with automatic coercion
 */
export const ServiceListingPlanSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters
    name: z.string().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),

    // Boolean filters
    isActive: createBooleanQueryParam('Filter active plans'),
    isTrialAvailable: createBooleanQueryParam('Filter plans with trial'),

    // Array filters
    supportLevels: createArrayQueryParam('Filter by support levels')
});

export type ServiceListingPlanSearchHttp = z.infer<typeof ServiceListingPlanSearchHttpSchema>;

/**
 * HTTP-compatible service listing plan creation schema
 * Complete schema matching all CreateServiceListingPlanSchema fields with HTTP coercion
 */
export const ServiceListingPlanCreateHttpSchema = z.object({
    // Core required fields
    name: z.string().min(1).max(255),

    // Optional fields
    description: z.string().max(1000).optional(),

    // Pricing with HTTP coercion
    price: z.coerce.number().nonnegative(),

    // Nested limits object
    limits: ServiceListingPlanLimitsHttpSchema,

    // Plan status with HTTP coercion
    isActive: z.coerce.boolean().default(true),
    isTrialAvailable: z.coerce.boolean().default(false),
    trialDays: z.coerce.number().int().nonnegative().default(0),

    // Admin metadata
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type ServiceListingPlanCreateHttp = z.infer<typeof ServiceListingPlanCreateHttpSchema>;

/**
 * HTTP-compatible service listing plan update schema
 * All fields optional for partial updates
 */
export const ServiceListingPlanUpdateHttpSchema = z.object({
    // Core fields (all optional for updates)
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),

    // Pricing
    price: z.coerce.number().nonnegative().optional(),

    // Nested limits object
    limits: ServiceListingPlanLimitsHttpSchema,

    // Plan status
    isActive: z.coerce.boolean().optional(),
    isTrialAvailable: z.coerce.boolean().optional(),
    trialDays: z.coerce.number().int().nonnegative().optional(),

    // Admin metadata
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type ServiceListingPlanUpdateHttp = z.infer<typeof ServiceListingPlanUpdateHttpSchema>;

/**
 * HTTP to Domain Conversion Functions
 * These functions convert HTTP request data to domain-compatible formats
 */

import { SupportLevelSchema } from '../../enums/support-level.schema.js';
import type {
    CreateServiceListingPlan,
    UpdateServiceListingPlan
} from './serviceListingPlan.crud.schema.js';
import type { ServiceListingPlanLimits } from './serviceListingPlan.schema.js';

/**
 * Convert HTTP limits to domain limits
 * Parse enum fields and ensure proper structure
 */
function httpToDomainLimits(
    httpLimits: ServiceListingPlanLimitsHttp
): ServiceListingPlanLimits | undefined {
    if (!httpLimits) return undefined;

    return {
        maxListings: httpLimits.maxListings,
        maxPhotos: httpLimits.maxPhotos,
        maxVideos: httpLimits.maxVideos,
        maxFeaturedDays: httpLimits.maxFeaturedDays,
        maxDescriptionLength: httpLimits.maxDescriptionLength,
        maxTrialDays: httpLimits.maxTrialDays,
        refreshInterval: httpLimits.refreshInterval,
        allowPremiumFeatures: httpLimits.allowPremiumFeatures,
        allowAnalytics: httpLimits.allowAnalytics,
        allowCustomPricing: httpLimits.allowCustomPricing,
        allowMultiLanguage: httpLimits.allowMultiLanguage,
        allowCustomBranding: httpLimits.allowCustomBranding,
        allowBookingIntegration: httpLimits.allowBookingIntegration,
        allowTrialPeriods: httpLimits.allowTrialPeriods,
        supportLevel: httpLimits.supportLevel
            ? SupportLevelSchema.parse(httpLimits.supportLevel)
            : undefined,
        features: httpLimits.features
    };
}

/**
 * Convert HTTP service listing plan creation data to domain format
 */
export function httpToDomainServiceListingPlanCreate(
    httpData: ServiceListingPlanCreateHttp
): CreateServiceListingPlan {
    return {
        name: httpData.name,
        description: httpData.description,
        price: httpData.price,
        limits: httpToDomainLimits(httpData.limits),
        isActive: httpData.isActive ?? true,
        isTrialAvailable: httpData.isTrialAvailable ?? false,
        trialDays: httpData.trialDays ?? 0,
        adminInfo: httpData.adminInfo || null
    };
}

/**
 * Convert HTTP service listing plan update data to domain format
 * Only includes fields that are actually provided
 */
export function httpToDomainServiceListingPlanUpdate(
    httpData: ServiceListingPlanUpdateHttp
): UpdateServiceListingPlan {
    const result: UpdateServiceListingPlan = {};

    // Only include fields that are actually provided
    if (httpData.name !== undefined) result.name = httpData.name;
    if (httpData.description !== undefined) result.description = httpData.description;
    if (httpData.price !== undefined) result.price = httpData.price;
    if (httpData.limits !== undefined) result.limits = httpToDomainLimits(httpData.limits);
    if (httpData.isActive !== undefined) result.isActive = httpData.isActive;
    if (httpData.isTrialAvailable !== undefined)
        result.isTrialAvailable = httpData.isTrialAvailable;
    if (httpData.trialDays !== undefined) result.trialDays = httpData.trialDays;
    if (httpData.adminInfo !== undefined) result.adminInfo = httpData.adminInfo;

    return result;
}
