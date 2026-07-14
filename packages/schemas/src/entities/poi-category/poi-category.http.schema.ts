/**
 * POI Category HTTP Schemas
 *
 * HTTP-compatible schemas for POI category operations with automatic query
 * string coercion. These schemas handle the conversion from HTTP query
 * parameters (strings) to properly typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';
import { I18nTextSchema } from '../../common/i18n.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * HTTP-compatible POI category search schema with automatic coercion
 * Extends base search with POI-category-specific filters
 */
export const PoiCategorySearchHttpSchema = BaseHttpSearchSchema.extend({
    // Text search filters
    slug: z.string().optional()
});

export type PoiCategorySearchHttp = z.infer<typeof PoiCategorySearchHttpSchema>;

/**
 * HTTP-compatible POI category creation schema
 * Handles JSON body input for creating POI categories via HTTP
 */
export const PoiCategoryCreateHttpSchema = z.object({
    slug: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/),
    nameI18n: I18nTextSchema,
    icon: z.string().min(1).max(100).optional(),
    displayWeight: z.coerce.number().int().min(1).max(100).default(50)
});

export type PoiCategoryCreateHttp = z.infer<typeof PoiCategoryCreateHttpSchema>;

/**
 * HTTP-compatible POI category update schema
 * Handles partial updates via HTTP PATCH requests
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const PoiCategoryUpdateHttpSchema = z
    .object(stripShapeDefaults(PoiCategoryCreateHttpSchema.shape))
    .partial();

export type PoiCategoryUpdateHttp = z.infer<typeof PoiCategoryUpdateHttpSchema>;

/**
 * HTTP-compatible POI category query parameters for single retrieval
 * Used for GET /poi-categories/:id type requests
 */
export const PoiCategoryGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includePointsOfInterest: createBooleanQueryParam('Include assigned points of interest')
});

export type PoiCategoryGetHttp = z.infer<typeof PoiCategoryGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';

import type { PoiCategoryCreateInput, PoiCategoryUpdateInput } from './poi-category.crud.schema.js';
import type { PoiCategorySearchInput } from './poi-category.query.schema.js';

/**
 * Convert HTTP POI category search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 */
export const httpToDomainPoiCategorySearch = (
    httpParams: PoiCategorySearchHttp
): PoiCategorySearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Text search filters
        slug: httpParams.slug
    };
};

/**
 * Convert HTTP POI category create data to domain create input
 * Handles JSON body conversion to proper domain types
 * Sets default lifecycle state to ACTIVE
 */
export const httpToDomainPoiCategoryCreate = (
    httpData: PoiCategoryCreateHttp
): PoiCategoryCreateInput => {
    return {
        slug: httpData.slug,
        nameI18n: httpData.nameI18n,
        icon: httpData.icon,
        displayWeight: httpData.displayWeight,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
};

/**
 * Convert HTTP POI category update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 */
export const httpToDomainPoiCategoryUpdate = (
    httpData: PoiCategoryUpdateHttp
): PoiCategoryUpdateInput => {
    return {
        slug: httpData.slug,
        nameI18n: httpData.nameI18n,
        icon: httpData.icon,
        displayWeight: httpData.displayWeight
        // Note: lifecycleState not included in updates - should be handled separately
    };
};
