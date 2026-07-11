/**
 * Point Of Interest HTTP Schemas
 *
 * HTTP-compatible schemas for point-of-interest operations with automatic
 * query string coercion. These schemas handle the conversion from HTTP
 * query parameters (strings) to properly typed objects for the domain
 * layer — in particular `lat`/`long`/`displayWeight`, which are numeric
 * domain fields but arrive as strings over HTTP.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { PointOfInterestTypeEnumSchema } from '../../enums/point-of-interest-type.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * HTTP-compatible point-of-interest search schema with automatic coercion
 * Extends base search with point-of-interest-specific filters
 */
export const PointOfInterestSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Text search filters
    slug: z.string().optional(),
    description: z.string().optional(),

    // Type filter (closed enum, HOS-113 OQ-3)
    type: PointOfInterestTypeEnumSchema.optional(),

    // Boolean filters with HTTP coercion
    isFeatured: createBooleanQueryParam('Filter featured points of interest'),
    isBuiltin: createBooleanQueryParam('Filter built-in points of interest'),

    // Destination relation filter
    destinationId: z.string().uuid().optional(),

    // Array filters
    destinations: createArrayQueryParam('Filter by multiple destination IDs')
});

export type PointOfInterestSearchHttp = z.infer<typeof PointOfInterestSearchHttpSchema>;

/**
 * HTTP-compatible point-of-interest creation schema
 * Handles form data and JSON input for creating points of interest via HTTP.
 * `lat`/`long`/`displayWeight` are coerced from query-string-safe strings to
 * numbers.
 */
export const PointOfInterestCreateHttpSchema = z.object({
    slug: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/),
    lat: z.coerce.number().min(-90).max(90),
    long: z.coerce.number().min(-180).max(180),
    type: PointOfInterestTypeEnumSchema,
    description: z.string().min(10).max(500).optional(),
    icon: z.string().min(1).max(100).optional(),
    isFeatured: z.coerce.boolean().default(false),
    isBuiltin: z.coerce.boolean().default(false),
    displayWeight: z.coerce.number().int().min(1).max(100).default(50)
});

export type PointOfInterestCreateHttp = z.infer<typeof PointOfInterestCreateHttpSchema>;

/**
 * HTTP-compatible point-of-interest update schema
 * Handles partial updates via HTTP PATCH requests
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const PointOfInterestUpdateHttpSchema = z
    .object(stripShapeDefaults(PointOfInterestCreateHttpSchema.shape))
    .partial();

export type PointOfInterestUpdateHttp = z.infer<typeof PointOfInterestUpdateHttpSchema>;

/**
 * HTTP-compatible point-of-interest query parameters for single retrieval
 * Used for GET /points-of-interest/:id type requests
 */
export const PointOfInterestGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeDestinations: createBooleanQueryParam('Include destination information')
});

export type PointOfInterestGetHttp = z.infer<typeof PointOfInterestGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';

import type {
    PointOfInterestCreateInput,
    PointOfInterestUpdateInput
} from './point-of-interest.crud.schema.js';
import type { PointOfInterestSearchInput } from './point-of-interest.query.schema.js';

/**
 * Convert HTTP point-of-interest search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 */
export const httpToDomainPointOfInterestSearch = (
    httpParams: PointOfInterestSearchHttp
): PointOfInterestSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Text search filters
        slug: httpParams.slug,
        // Note: description filter not available in domain search

        // Type filter
        type: httpParams.type,

        // Boolean filters
        isFeatured: httpParams.isFeatured,
        isBuiltin: httpParams.isBuiltin,

        // Destination relation filter
        destinationId: httpParams.destinationId

        // Note: destinations array not available in domain search
    };
};

/**
 * Convert HTTP point-of-interest create data to domain create input
 * Handles form data conversion to proper domain types.
 * Sets default lifecycle state to ACTIVE.
 */
export const httpToDomainPointOfInterestCreate = (
    httpData: PointOfInterestCreateHttp
): PointOfInterestCreateInput => {
    return {
        slug: httpData.slug,
        lat: httpData.lat,
        long: httpData.long,
        type: httpData.type,
        description: httpData.description,
        icon: httpData.icon,
        isFeatured: httpData.isFeatured,
        isBuiltin: httpData.isBuiltin,
        displayWeight: httpData.displayWeight,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
};

/**
 * Convert HTTP point-of-interest update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 */
export const httpToDomainPointOfInterestUpdate = (
    httpData: PointOfInterestUpdateHttp
): PointOfInterestUpdateInput => {
    return {
        slug: httpData.slug,
        lat: httpData.lat,
        long: httpData.long,
        type: httpData.type,
        description: httpData.description,
        icon: httpData.icon,
        isFeatured: httpData.isFeatured,
        isBuiltin: httpData.isBuiltin,
        displayWeight: httpData.displayWeight
        // Note: lifecycleState not included in updates - should be handled separately
    };
};
