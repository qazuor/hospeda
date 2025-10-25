/**
 * ClientAccessRight HTTP Schemas
 *
 * HTTP-compatible schemas for client access right operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';
import { AccessRightScopeEnumSchema } from '../../enums/access-right-scope.schema.js';

/**
 * HTTP-compatible client access right search schema with automatic coercion
 * Handles query string parameters from HTTP requests and converts them to typed objects
 */
export const HttpClientAccessRightSearchSchema = BaseHttpSearchSchema.extend({
    // Basic filters with HTTP coercion
    clientId: z.string().uuid().optional(),
    feature: z.string().min(1).max(100).optional(),
    scope: AccessRightScopeEnumSchema.optional(),
    scopeType: z.string().min(1).max(50).optional(),

    // Boolean filters with HTTP coercion
    isActive: createBooleanQueryParam('Filter by active status based on validity period'),
    isExpired: createBooleanQueryParam('Filter by expired access rights'),
    includeExpired: createBooleanQueryParam('Include expired access rights in results'),
    includeInactive: createBooleanQueryParam('Include inactive access rights in results'),

    // Date filters with HTTP coercion
    validFromAfter: z.coerce.date().optional(),
    validFromBefore: z.coerce.date().optional(),
    validToAfter: z.coerce.date().optional(),
    validToBefore: z.coerce.date().optional(),

    // Numeric filters with HTTP coercion
    expiringWithinDays: z.coerce.number().int().min(1).max(365).optional(),
    createdWithinDays: z.coerce.number().int().min(1).max(365).optional()
});

export type HttpClientAccessRightSearch = z.infer<typeof HttpClientAccessRightSearchSchema>;

/**
 * HTTP-compatible client access right creation schema
 * Handles form data and JSON input for creating client access rights via HTTP
 */
export const ClientAccessRightCreateHttpSchema = z.object({
    clientId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    subscriptionItemId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    feature: z.string().min(1, { message: 'zodError.clientAccessRight.feature.required' }).max(100),
    scope: AccessRightScopeEnumSchema,

    // Optional scoped access fields
    scopeId: z.string().uuid().optional(),
    scopeType: z.string().min(1).max(50).optional(),

    // Validity period
    validFrom: z.coerce.date().optional(), // Defaults to now if not provided
    validTo: z.coerce.date().optional() // Optional expiration
});

export type ClientAccessRightCreateHttp = z.infer<typeof ClientAccessRightCreateHttpSchema>;

/**
 * HTTP-compatible client access right update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const ClientAccessRightUpdateHttpSchema = ClientAccessRightCreateHttpSchema.partial();

export type ClientAccessRightUpdateHttp = z.infer<typeof ClientAccessRightUpdateHttpSchema>;

/**
 * HTTP-compatible client access right query parameters for single retrieval
 * Used for GET /client-access-rights/:id type requests
 */
export const ClientAccessRightGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeClient: createBooleanQueryParam('Include client information'),
    includeSubscription: createBooleanQueryParam('Include subscription information'),
    checkValidity: createBooleanQueryParam('Check if access right is currently valid')
});

export type ClientAccessRightGetHttp = z.infer<typeof ClientAccessRightGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type {
    ClientAccessRightCreateInput,
    ClientAccessRightUpdateInput
} from './client-access-right.crud.schema.js';
import type { ClientAccessRightSearchInput } from './client-access-right.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Maps HTTP query parameters to properly typed domain search fields
 */
export const httpToDomainClientAccessRightSearch = (
    httpParams: HttpClientAccessRightSearch
): ClientAccessRightSearchInput => {
    // Check if any filter fields are provided
    const hasFilters = !!(
        httpParams.clientId ||
        httpParams.feature ||
        httpParams.scope ||
        httpParams.scopeType ||
        httpParams.isActive !== undefined ||
        httpParams.isExpired !== undefined ||
        httpParams.validFromAfter ||
        httpParams.validFromBefore ||
        httpParams.validToAfter ||
        httpParams.validToBefore ||
        httpParams.q
    );

    return {
        // Base pagination and sorting
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Client access right-specific filters only if any are provided
        ...(hasFilters
            ? {
                  filters: {
                      clientId: httpParams.clientId,
                      feature: httpParams.feature,
                      scope: httpParams.scope,
                      scopeType: httpParams.scopeType,
                      isActive: httpParams.isActive,
                      isExpired: httpParams.isExpired,
                      validFromAfter: httpParams.validFromAfter,
                      validFromBefore: httpParams.validFromBefore,
                      validToAfter: httpParams.validToAfter,
                      validToBefore: httpParams.validToBefore,
                      q: httpParams.q
                  }
              }
            : {})
    };
};

/**
 * Convert HTTP create data to domain create input
 * Maps HTTP form/JSON data to domain object with required fields and proper structure
 */
export const httpToDomainClientAccessRightCreate = (
    httpData: ClientAccessRightCreateHttp
): ClientAccessRightCreateInput => ({
    // Required fields
    clientId: httpData.clientId,
    subscriptionItemId: httpData.subscriptionItemId,
    feature: httpData.feature,
    scope: httpData.scope,

    // Optional scoped access fields
    scopeId: httpData.scopeId,
    scopeType: httpData.scopeType,

    // Validity period with defaults
    validFrom: httpData.validFrom || new Date(), // Default to current date/time
    validTo: httpData.validTo
});

/**
 * Convert HTTP update data to domain update input
 * Maps HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainClientAccessRightUpdate = (
    httpData: ClientAccessRightUpdateHttp
): ClientAccessRightUpdateInput => ({
    // All fields are optional for updates
    clientId: httpData.clientId,
    subscriptionItemId: httpData.subscriptionItemId,
    feature: httpData.feature,
    scope: httpData.scope,
    scopeId: httpData.scopeId,
    scopeType: httpData.scopeType,
    validFrom: httpData.validFrom,
    validTo: httpData.validTo
});
