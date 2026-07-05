/**
 * API-specific schemas
 * These schemas are used exclusively by the API routes
 */

export * from './api.schema.js'; // Query parameters (pagination, sort, search, date/price/location ranges)
export * from './auth.schema.js'; // Authentication schemas (actor, auth status, cache stats)
export * from './billing/index.js'; // Billing schemas (plan change request/response)
export * from './examples/task.schema.js';
export * from './health/health.schema.js';
export * from './health.schema.js'; // Health check schemas (health, database, liveness, readiness)
export * from './http/base-http.schema.js';
export * from './info.schema.js'; // API information schemas (metadata, version info)
export * from './params.schema.js'; // Path parameters (IDs, slugs, entity-specific parameters)
export {
    createOperationResultSchema,
    createPaginatedResponseSchema,
    createSingleItemResponseSchema,
    type ErrorResponse,
    ErrorResponseSchema,
    type PaginationMetadata,
    PaginationMetadataSchema,
    type ResponseMetadata,
    ResponseMetadataSchema
} from './response/base-response.schema.js';
export * from './result.schema.js'; // Result schemas (success, delete, restore, assignment, removal)
export * from './system/system.schema.js';
