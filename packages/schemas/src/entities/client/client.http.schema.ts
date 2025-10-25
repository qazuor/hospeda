/**
 * Client HTTP Schemas
 *
 * HTTP-compatible schemas for client operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';

/**
 * Client status enumeration for HTTP requests
 */
export const ClientStatusHttpSchema = z.enum(['active', 'pending', 'suspended', 'deactivated'], {
    message: 'zodError.client.status.invalid'
});

/**
 * HTTP-compatible client search schema with automatic coercion
 * Handles query string parameters from HTTP requests and converts them to typed objects
 * Follows the same pattern as accommodation - no transform needed
 */
export const HttpClientSearchSchema = BaseHttpSearchSchema.extend({
    // Basic filters with HTTP coercion
    name: z.string().min(1).max(200).optional(),
    billingEmail: z.string().email().optional(),
    userId: z.string().uuid().optional(),

    // Boolean filters with HTTP coercion
    isActive: createBooleanQueryParam('Filter by client active status'),

    // Date filters with HTTP coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),

    // Text search filters
    nameContains: z.string().min(1).max(200).optional(),
    emailContains: z.string().min(1).max(100).optional()
});

export type HttpClientSearch = z.infer<typeof HttpClientSearchSchema>;

/**
 * HTTP-compatible client creation schema
 * Handles form data and JSON input for creating clients via HTTP
 */
export const ClientCreateHttpSchema = z.object({
    name: z.string().min(1, { message: 'zodError.client.name.required' }).max(200),
    billingEmail: z.string().email({ message: 'zodError.client.billingEmail.invalid' }),
    userId: z.string().uuid().nullable(), // Nullable for organization support

    status: ClientStatusHttpSchema.default('pending')
});

export type ClientCreateHttp = z.infer<typeof ClientCreateHttpSchema>;

/**
 * HTTP-compatible client update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const ClientUpdateHttpSchema = ClientCreateHttpSchema.partial();

export type ClientUpdateHttp = z.infer<typeof ClientUpdateHttpSchema>;

/**
 * HTTP-compatible client query parameters for single client retrieval
 * Used for GET /clients/:id type requests
 */
export const ClientGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeSubscriptions: createBooleanQueryParam('Include client subscriptions data'),
    includeAccessRights: createBooleanQueryParam('Include client access rights data')
});

export type ClientGetHttp = z.infer<typeof ClientGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { ClientCreateInput, ClientUpdateInput } from './client.crud.schema.js';
import type { ClientSearchInput } from './client.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Maps HTTP query parameters directly to domain fields like accommodation pattern
 */
export const httpToDomainClientSearch = (httpParams: HttpClientSearch): ClientSearchInput => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,

    // Entity-specific filters - direct mapping like accommodation
    name: httpParams.name,
    billingEmail: httpParams.billingEmail,
    userId: httpParams.userId,
    createdAfter: httpParams.createdAfter,
    createdBefore: httpParams.createdBefore
});

/**
 * Convert HTTP create data to domain create input
 * Maps HTTP form/JSON data to domain object with required fields and proper structure
 */
export const httpToDomainClientCreate = (httpData: ClientCreateHttp): ClientCreateInput => ({
    // Basic required fields that exist in domain schema
    name: httpData.name,
    billingEmail: httpData.billingEmail,
    userId: httpData.userId,

    // Required fields with defaults for domain schema
    lifecycleState: LifecycleStatusEnum.ACTIVE // Default lifecycle state
});

/**
 * Convert HTTP update data to domain update input
 * Maps HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainClientUpdate = (httpData: ClientUpdateHttp): ClientUpdateInput => ({
    // Basic updateable fields that exist in domain schema
    name: httpData.name,
    billingEmail: httpData.billingEmail,
    userId: httpData.userId,

    // Only set lifecycle state if provided
    ...(httpData.status === 'active' ? { lifecycleState: LifecycleStatusEnum.ACTIVE } : {}),
    ...(httpData.status === 'deactivated' ? { lifecycleState: LifecycleStatusEnum.ARCHIVED } : {})
});
