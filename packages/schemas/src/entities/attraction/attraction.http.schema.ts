/**
 * Attraction HTTP Schemas
 *
 * HTTP-compatible schemas for attraction operations with automatic query string coercion.
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
 * HTTP-compatible attraction search schema with automatic coercion
 * Extends base search with attraction-specific filters
 */
export const AttractionSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Text search filters
    name: z.string().optional(),
    description: z.string().optional(),

    // Boolean filters with HTTP coercion
    isFeatured: createBooleanQueryParam('Filter featured attractions'),
    isBuiltin: createBooleanQueryParam('Filter built-in attractions'),

    // Location filters
    destinationId: z.string().uuid().optional(),

    // Array filters
    destinations: createArrayQueryParam('Filter by multiple destination IDs'),
    icons: createArrayQueryParam('Filter by icon types')
});

export type AttractionSearchHttp = z.infer<typeof AttractionSearchHttpSchema>;

/**
 * HTTP-compatible attraction creation schema
 * Handles form data and JSON input for creating attractions via HTTP
 */
export const AttractionCreateHttpSchema = z.object({
    name: z.string().min(3).max(100),
    slug: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
    description: z.string().min(10).max(500),
    icon: z.string().min(1).max(100),
    destinationId: z.string().uuid().optional(),
    isFeatured: z.coerce.boolean().default(false),
    isBuiltin: z.coerce.boolean().default(false)
});

export type AttractionCreateHttp = z.infer<typeof AttractionCreateHttpSchema>;

/**
 * HTTP-compatible attraction update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const AttractionUpdateHttpSchema = AttractionCreateHttpSchema.partial();

export type AttractionUpdateHttp = z.infer<typeof AttractionUpdateHttpSchema>;

/**
 * HTTP-compatible attraction query parameters for single attraction retrieval
 * Used for GET /attractions/:id type requests
 */
export const AttractionGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeDestination: createBooleanQueryParam('Include destination information')
});

export type AttractionGetHttp = z.infer<typeof AttractionGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { AttractionSearchInput } from './attraction.query.schema.js';

import type { AttractionCreateInput, AttractionUpdateInput } from './attraction.crud.schema.js';

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';

/**
 * Convert HTTP attraction search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 */
export const httpToDomainAttractionSearch = (
    httpParams: AttractionSearchHttp
): AttractionSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Text search filters
        name: httpParams.name,
        // Note: description filter not available in domain search

        // Boolean filters
        isFeatured: httpParams.isFeatured,
        isBuiltin: httpParams.isBuiltin,

        // Location filters
        destinationId: httpParams.destinationId

        // Note: destinations and icons arrays not available in domain search
    };
};

/**
 * Convert HTTP attraction create data to domain create input
 * Handles form data conversion to proper domain types
 * Sets default lifecycle state to ACTIVE
 */
export const httpToDomainAttractionCreate = (
    httpData: AttractionCreateHttp
): AttractionCreateInput => {
    return {
        name: httpData.name,
        slug: httpData.slug,
        description: httpData.description,
        icon: httpData.icon,
        destinationId: httpData.destinationId,
        isFeatured: httpData.isFeatured,
        isBuiltin: httpData.isBuiltin,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
};

/**
 * Convert HTTP attraction update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 */
export const httpToDomainAttractionUpdate = (
    httpData: AttractionUpdateHttp
): AttractionUpdateInput => {
    return {
        name: httpData.name,
        slug: httpData.slug,
        description: httpData.description,
        icon: httpData.icon,
        destinationId: httpData.destinationId,
        isFeatured: httpData.isFeatured,
        isBuiltin: httpData.isBuiltin
        // Note: lifecycleState not included in updates - should be handled separately
    };
};
